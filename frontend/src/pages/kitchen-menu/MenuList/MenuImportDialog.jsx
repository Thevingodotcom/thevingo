import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../../../config';
import { haptics } from '../../../utils/haptics';
import authStorage from '../../../app/authStorage';
import {
  MAX_IMPORT_FILE_BYTES,
  MENU_IMPORT_COLUMNS,
  TEMPLATE_HEADERS,
  buildDishesCsv,
  buildIssueReportCsv,
  buildTemplateCsv,
  checkImportFile,
  countRows,
  groupIssuesByRow,
  validateMenuImport
} from '../../../utils/menuImport';
import { IMPORT_FILE_ACCEPT, buildTemplateWorkbookBlob, readImportFile } from '../../../utils/menuImportExcel';
import { downloadBlob } from '../../../utils/download';
import { runMenuImport } from './runMenuImport';

const VISIBLE_ISSUE_LIMIT = 50;

const STEPS = [
  { key: 'reading', label: 'Reading file' },
  { key: 'validating', label: 'Checking every row' },
  { key: 'prices', label: 'Updating prices' },
  { key: 'categories', label: 'Creating categories' },
  { key: 'dishes', label: 'Adding dishes' }
];
const STEP_INDEX = Object.fromEntries(STEPS.map((step, index) => [step.key, index]));

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// Prices are shown like the dish cards ("280 Rs"); decimals only when needed.
const formatAmount = (value) => {
  const amount = Math.abs(Number(value));
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
};
const formatPrice = (value) => (value == null || !Number.isFinite(Number(value)) ? '—' : `${formatAmount(value)} Rs`);

/** "+20 Rs" / "−15 Rs" with a direction, so increases and decreases don't rely on colour. */
const priceDifference = (oldPrice, newPrice) => {
  if (oldPrice == null) return { direction: 'none', text: '—', label: 'No previous price' };
  const diff = Math.round((newPrice - oldPrice) * 100) / 100;
  const up = diff > 0;
  return {
    direction: up ? 'up' : 'down',
    text: `${up ? '+' : '−'}${formatAmount(diff)} Rs`,
    label: `${up ? 'Up' : 'Down'} by ${formatAmount(diff)} Rs`
  };
};

// Let the browser paint the current step before doing synchronous work.
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

const downloadCsv = (fileName, csv) => {
  const link = document.createElement('a');
  // BOM so Excel opens the UTF-8 file with the right encoding.
  link.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${csv}`)}`);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  try { link.click(); } catch { /* jsdom / blocked downloads */ }
  document.body.removeChild(link);
};

const baseName = (fileName) => String(fileName || 'menu').replace(/\.[^.]+$/, '');

const EXCEL_TEMPLATE_NAME = 'vingo_menu_template.xlsx';
const CSV_TEMPLATE_NAME = 'vingo_menu_template.csv';
const TEMPLATE_BUTTON_ID = 'menu-import-template-btn';
const TEMPLATE_MENU_ID = 'menu-import-template-menu';

/* ---------- Icons ---------- */
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const StatusIcon = ({ tone }) => (
  <span className={`menu-import-status-icon is-${tone}`} aria-hidden="true">
    {tone === 'info' ? (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><polyline points="9 14 11 16 15 12"></polyline></svg>
    ) : tone === 'success' ? (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    ) : tone === 'warning' ? (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    ) : (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    )}
  </span>
);

/* ---------- Pieces ---------- */
function IssueList({ issues, tone = 'error', label, onDownload }) {
  const { groups, hiddenCount } = groupIssuesByRow(issues, VISIBLE_ISSUE_LIMIT);
  return (
    <>
      <ul className={`menu-import-issues is-${tone}`} aria-label={label}>
        {groups.map(group => (
          <li key={group.row ?? 'file'} className="menu-import-issue-group">
            <span className="menu-import-issue-row">{group.row == null ? 'File' : `Row ${group.row}`}</span>
            <ul className="menu-import-issue-messages">
              {group.issues.map((item, index) => (
                <li key={index}>{item.message}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <p className="menu-import-more">
          …and {plural(hiddenCount, 'more problem')}.{' '}
          {onDownload && (
            <button type="button" className="menu-import-link" onClick={onDownload}>Download the full report</button>
          )}
        </p>
      )}
    </>
  );
}

function FileErrorCard({ error }) {
  return (
    <div className="menu-import-file-error">
      <p className="menu-import-file-error-title">{error.title}</p>
      <p className="menu-import-file-error-text">{error.message}</p>
      {error.code === 'missing-columns' && (
        <dl className="menu-import-headers">
          <dt>Expected header row (row 1)</dt>
          <dd><code>{error.expected.join(',')}</code></dd>
          <dt>Found in your file</dt>
          <dd>
            {error.found.length ? (
              <span className="menu-import-chips">
                {error.found.map((header, index) => <span key={index} className="menu-import-chip">{header}</span>)}
              </span>
            ) : <em>No column names</em>}
          </dd>
          <dt>Missing</dt>
          <dd>
            <span className="menu-import-chips">
              {error.missing.map(header => <span key={header} className="menu-import-chip is-missing">{header}</span>)}
            </span>
          </dd>
        </dl>
      )}
    </div>
  );
}

function ProgressView({ phase, progress, fileName }) {
  const stepIndex = phase === 'reading' ? STEP_INDEX.reading
    : phase === 'validating' ? STEP_INDEX.validating
      : STEP_INDEX[progress.step] ?? STEP_INDEX.dishes;
  const dishTotal = progress.dishTotal || 0;
  const dishDone = progress.step === 'dishes' ? progress.done : 0;
  const percent = dishTotal ? Math.round((dishDone / dishTotal) * 100) : 0;
  const importing = phase === 'importing';

  return (
    <div className="menu-import-progress" role="status" aria-live="polite" aria-busy="true">
      <div className="menu-import-spinner" aria-hidden="true"></div>
      <p className="menu-import-progress-title">{importing ? 'Applying changes…' : 'Checking your file…'}</p>
      <p className="menu-import-progress-file">{fileName}</p>

      {importing && dishTotal > 0 && (
        <>
          <p className="menu-import-progress-count">{`${dishDone} of ${plural(dishTotal, 'dish', 'dishes')}`}</p>
          <div
            className="menu-import-bar"
            role="progressbar"
            aria-label="Import progress"
            aria-valuemin={0}
            aria-valuemax={dishTotal}
            aria-valuenow={dishDone}
          >
            <div className="menu-import-bar-fill" style={{ width: `${percent}%` }}></div>
          </div>
        </>
      )}

      <ol className="menu-import-steps">
        {STEPS.map((step, index) => {
          const state = index < stepIndex ? 'done' : index === stepIndex ? 'active' : 'pending';
          let detail = '';
          if (step.key === 'prices' && importing) {
            detail = progress.priceTotal ? plural(progress.priceTotal, 'price') : 'none needed';
          }
          if (step.key === 'categories' && importing) {
            detail = progress.categoryTotal === 0
              ? 'none needed'
              : `${Math.min(progress.step === 'categories' ? progress.done : progress.step === 'prices' ? 0 : progress.categoryTotal, progress.categoryTotal)} of ${progress.categoryTotal}`;
          }
          if (step.key === 'dishes' && state === 'active' && progress.currentName) {
            detail = progress.currentName;
          }
          return (
            <li key={step.key} className={`menu-import-step is-${state}`} aria-current={state === 'active' ? 'step' : undefined}>
              <span className="menu-import-step-dot" aria-hidden="true">{state === 'done' ? <CheckIcon /> : index + 1}</span>
              <span className="menu-import-step-label">{step.label}</span>
              {detail && <span className="menu-import-step-detail">{detail}</span>}
            </li>
          );
        })}
      </ol>
      <p className="menu-import-progress-hint">
        {importing ? 'Please keep this window open until the import finishes.' : 'Nothing is saved until you review the changes and approve them.'}
      </p>
    </div>
  );
}

function FilePicker({ label, onFile, variant = 'primary' }) {
  return (
    <label className={`menu-import-pick is-${variant}`}>
      {label}
      <input
        type="file"
        accept={IMPORT_FILE_ACCEPT}
        className="menu-import-file-input"
        data-testid="menu-import-input"
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

const ChevronIcon = () => (
  <svg className="menu-import-template-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

/**
 * "Download template" button with an Excel / CSV choice. The open state lives
 * in the dialog so its document-level Escape handler can close just this menu
 * instead of the whole dialog.
 */
function TemplateDownloadMenu({ open, onOpenChange, busy, error, onExcel, onCsv }) {
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const menuItems = () => Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []);

  useEffect(() => {
    if (!open) return undefined;
    menuItems()[0]?.focus();
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onOpenChange(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open, onOpenChange]);

  const onMenuKeyDown = (e) => {
    const items = menuItems();
    const index = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      onOpenChange(false);
    }
  };

  const choose = (action) => {
    onOpenChange(false);
    buttonRef.current?.focus();
    action();
  };

  return (
    <div className="menu-import-template" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        id={TEMPLATE_BUTTON_ID}
        className="menu-import-template-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? TEMPLATE_MENU_ID : undefined}
        aria-busy={busy || undefined}
        onClick={() => { if (!busy) onOpenChange(!open); }}
        onKeyDown={(e) => {
          if (!open && !busy && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            onOpenChange(true);
          }
        }}
      >
        <span>{busy ? 'Preparing Excel template…' : 'Download template'}</span>
        {!busy && <ChevronIcon />}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={TEMPLATE_MENU_ID}
          className="menu-import-template-menu"
          role="menu"
          aria-labelledby={TEMPLATE_BUTTON_ID}
          onKeyDown={onMenuKeyDown}
        >
          <button type="button" role="menuitem" className="menu-import-template-item" onClick={() => choose(onExcel)}>
            <span className="menu-import-template-item-title">
              Excel template (.xlsx)
              <span className="menu-import-template-badge">Recommended</span>
            </span>
            <span className="menu-import-template-item-sub">Dropdowns for veg type &amp; availability</span>
          </button>
          <button type="button" role="menuitem" className="menu-import-template-item" onClick={() => choose(onCsv)}>
            <span className="menu-import-template-item-title">CSV template (.csv)</span>
            <span className="menu-import-template-item-sub">Plain text for any spreadsheet app</span>
          </button>
        </div>
      )}
      {error && <p className="menu-import-template-error" role="alert">{error}</p>}
    </div>
  );
}

/* ---------- Dialog ---------- */
function MenuImportDialog({ categories, setCategories, onClose, onMenuChanged }) {
  // phase: select | reading | validating | invalid | review | importing | done
  const [phase, setPhase] = useState('select');
  const [fileName, setFileName] = useState('');
  const [validation, setValidation] = useState(null);
  const [progress, setProgress] = useState({ step: null, done: 0, total: 0, priceTotal: 0, dishTotal: 0, categoryTotal: 0, currentName: '' });
  const [outcome, setOutcome] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const busyRef = useRef(false);
  const templateMenuOpenRef = useRef(false);
  const templateBusyRef = useRef(false);
  const mountedRef = useRef(true);
  const reviewFocusRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const setTemplateMenu = useCallback((open) => {
    templateMenuOpenRef.current = open;
    setTemplateMenuOpen(open);
  }, []);

  const busy = phase === 'reading' || phase === 'validating' || phase === 'importing';

  // On the review screen the safe action (Cancel / Done) gets the focus, without
  // scrolling the dialog away from the summary at the top.
  useEffect(() => {
    if (phase === 'review') reviewFocusRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    if (phase !== 'importing') return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Escape with the template menu open closes only that menu.
      if (templateMenuOpenRef.current) {
        setTemplateMenu(false);
        document.getElementById(TEMPLATE_BUTTON_ID)?.focus();
        return;
      }
      if (!busyRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, setTemplateMenu]);

  const showInvalid = (result) => {
    setValidation(result);
    setPhase('invalid');
    haptics?.error?.();
  };

  const mergeIntoMenu = (result) => {
    const { createdCategories, addedDishes, updatedPrices = [] } = result;
    if (!createdCategories.length && !addedDishes.length && !updatedPrices.length) return;
    const byCategory = new Map();
    addedDishes.forEach(({ dish, categoryId }) => {
      const key = String(categoryId);
      byCategory.set(key, [...(byCategory.get(key) || []), dish]);
    });
    const priceById = new Map(updatedPrices.map(({ id, price }) => [String(id), price]));
    const withNewPrices = (items = []) => (priceById.size
      ? items.map(item => (priceById.has(String(item.id)) ? { ...item, price: priceById.get(String(item.id)) } : item))
      : items);
    setCategories(prev => {
      const existingIds = new Set(prev.map(cat => String(cat.id)));
      const merged = prev.map(cat => {
        const extra = byCategory.get(String(cat.id)) || [];
        const items = withNewPrices(cat.items);
        return extra.length || items !== cat.items ? { ...cat, items: [...(items || []), ...extra] } : cat;
      });
      const fresh = createdCategories
        .filter(cat => !existingIds.has(String(cat.id)))
        .map(cat => ({ ...cat, items: byCategory.get(String(cat.id)) || [] }));
      return [...merged, ...fresh];
    });
    onMenuChanged?.();
  };

  const handleFile = async (file) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setFileName(file.name);
    setValidation(null);
    setOutcome(null);
    setTemplateMenu(false);
    setTemplateError('');
    setPhase('reading');

    try {
      const fileProblem = checkImportFile(file);
      if (fileProblem) {
        showInvalid({ ok: false, fileErrors: [fileProblem], errors: [], warnings: [] });
        return;
      }

      // The type (CSV or .xlsx) is detected from the content; Excel sheets come back as CSV text.
      const read = await readImportFile(file);
      if (read.fileError) {
        showInvalid({ ok: false, fileErrors: [read.fileError], errors: [], warnings: [] });
        return;
      }

      setPhase('validating');
      await nextTick();
      const result = validateMenuImport(read.text, { existingCategories: categories });
      if (!result.ok) {
        showInvalid(result);
        return;
      }

      // Nothing is sent yet: the user reviews the changes and approves them first.
      setValidation(result);
      setPhase('review');
    } catch (err) {
      console.error('Import error:', err);
      showInvalid({ ok: false, fileErrors: [{ code: 'unexpected', title: 'Something went wrong', message: 'The file could not be checked. Please try again.' }], errors: [], warnings: [] });
    } finally {
      busyRef.current = false;
    }
  };

  const cancelReview = () => {
    if (busyRef.current) return;
    setValidation(null);
    setOutcome(null);
    setFileName('');
    setPhase('select');
  };

  const applyChanges = async () => {
    const result = validation;
    if (busyRef.current || !result) return;
    busyRef.current = true;
    const priceChanges = result.priceChanges || [];
    setOutcome(null);
    setProgress({
      step: priceChanges.length ? 'prices' : 'categories',
      done: 0,
      total: priceChanges.length || result.newCategories.length,
      priceTotal: priceChanges.length,
      dishTotal: result.dishes.length,
      categoryTotal: result.newCategories.length,
      currentName: ''
    });
    setPhase('importing');

    try {
      const runResult = await runMenuImport({
        priceChanges,
        dishes: result.dishes,
        newCategories: result.newCategories,
        apiUrl: API_URL,
        token: authStorage.getToken(),
        onProgress: (update) => setProgress(prev => ({ ...prev, ...update }))
      });

      mergeIntoMenu(runResult);
      setOutcome({ ...runResult, total: result.dishes.length, priceTotal: priceChanges.length });
      setPhase('done');
      if (runResult.priceFailure) haptics?.error?.();
      else if (runResult.importedCount === result.dishes.length) haptics?.success?.();
      else if (runResult.importedCount > 0 || runResult.updatedPriceCount > 0) haptics?.warning?.();
      else haptics?.error?.();
    } catch (err) {
      console.error('Import error:', err);
      showInvalid({ ok: false, fileErrors: [{ code: 'unexpected', title: 'Something went wrong', message: 'The import could not be completed. Please try again.' }], errors: [], warnings: [] });
    } finally {
      busyRef.current = false;
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && !busy) handleFile(file);
  };

  const downloadCsvTemplate = () => {
    setTemplateError('');
    downloadCsv(CSV_TEMPLATE_NAME, buildTemplateCsv());
  };

  const downloadExcelTemplate = async () => {
    if (templateBusyRef.current) return;
    templateBusyRef.current = true;
    setTemplateError('');
    setTemplateBusy(true);
    try {
      const blob = await buildTemplateWorkbookBlob({
        existingCategories: categories.map(cat => cat.name).filter(Boolean)
      });
      downloadBlob(blob, EXCEL_TEMPLATE_NAME);
    } catch (err) {
      console.error('Template error:', err);
      if (mountedRef.current) setTemplateError("The Excel template couldn't be created. Please try again, or download the CSV template instead.");
    } finally {
      templateBusyRef.current = false;
      if (mountedRef.current) setTemplateBusy(false);
    }
  };
  const downloadReport = () => downloadCsv(`${baseName(fileName)}_errors.csv`, buildIssueReportCsv(validation || {}));

  const templateLinks = (
    <>
      <button type="button" className="menu-import-link" onClick={downloadExcelTemplate} aria-busy={templateBusy || undefined}>
        {templateBusy ? 'Preparing Excel template…' : 'Download Excel template'}
      </button>
      {' · '}
      <button type="button" className="menu-import-link" onClick={downloadCsvTemplate}>Download sample CSV template</button>
    </>
  );

  /* ----- Views ----- */
  const renderSelect = () => (
    <div className="menu-import-body">
      <p className="menu-import-heading">Instructions:</p>
      <ol className="menu-import-instructions">
        <li>Download the template (Excel or CSV).</li>
        <li>
          Add one dish per row. Required columns: <strong>{MENU_IMPORT_COLUMNS.filter(c => c.required).map(c => c.label).join(', ')}</strong>.
          {' '}In the Excel template, pick Veg Type and availability from the dropdowns.
        </li>
        <li>Click "Choose File" to upload your <strong>.xlsx</strong> or <strong>.csv</strong> file — the file type is detected automatically.</li>
      </ol>
      {categories.length > 0 && (
        <p className="menu-import-note">
          Imported dishes are added to your current menu. Rows whose category already exists are placed in that category; nothing is removed. For dishes already on your menu, only the price is updated. You'll see every change and approve it before anything is saved.
        </p>
      )}

      <TemplateDownloadMenu
        open={templateMenuOpen}
        onOpenChange={setTemplateMenu}
        busy={templateBusy}
        error={templateError}
        onExcel={downloadExcelTemplate}
        onCsv={downloadCsvTemplate}
      />

      <div
        className={`menu-import-dropzone${isDragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <FilePicker label="Choose File" onFile={handleFile} />
        <p className="menu-import-dropzone-hint">or drag and drop it here · .csv or .xlsx up to {Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} MB</p>
      </div>
    </div>
  );

  const renderInvalid = () => {
    const { fileErrors = [], errors = [], warnings = [] } = validation || {};
    const problemCount = fileErrors.length + errors.length;
    const rowCount = countRows(errors);
    return (
      <div className="menu-import-body">
        <div className="menu-import-result-head">
          <StatusIcon tone="error" />
          <div>
            <p className="menu-import-result-title" role="alert">
              {fileErrors.length ? "This file can't be imported" : `Found ${plural(errors.length, 'problem')} in ${plural(rowCount, 'row')}`}
            </p>
            <p className="menu-import-result-sub">
              <strong>{fileName}</strong> — nothing was imported. Fix {problemCount === 1 ? 'the problem' : 'the problems'} below in your spreadsheet, save it and choose it again.
            </p>
          </div>
        </div>

        {fileErrors.map((error, index) => <FileErrorCard key={index} error={error} />)}

        {errors.length > 0 && (
          <IssueList issues={errors} label="Problems found in the file" onDownload={downloadReport} />
        )}

        {warnings.length > 0 && (
          <div className="menu-import-section">
            <p className="menu-import-section-title">Also note ({plural(warnings.length, 'warning')})</p>
            <IssueList issues={warnings} tone="warning" label="Warnings" onDownload={downloadReport} />
          </div>
        )}

        <div className="menu-import-actions">
          <FilePicker label="Choose another file" onFile={handleFile} />
          {(errors.length > 0 || warnings.length > 0) && (
            <button type="button" className="menu-import-secondary" onClick={downloadReport}>Download error report</button>
          )}
        </div>
        <p className="menu-import-footnote">
          Expected header row: <code>{TEMPLATE_HEADERS.join(',')}</code> · {templateLinks}
        </p>
        {templateError && <p className="menu-import-template-error" role="alert">{templateError}</p>}
      </div>
    );
  };

  const renderReview = () => {
    const { priceChanges = [], dishes = [], newCategories = [], unchangedCount = 0, warnings = [] } = validation || {};
    const changeCount = priceChanges.length + dishes.length;
    const newCategoryKeys = new Set(newCategories.map(name => name.toLowerCase()));
    const summary = [
      { key: 'prices', label: 'Price changes', count: priceChanges.length },
      { key: 'dishes', label: 'New dishes', count: dishes.length },
      { key: 'categories', label: 'New categories', count: newCategories.length },
      { key: 'unchanged', label: 'Unchanged dishes', count: unchangedCount }
    ];
    const warningList = warnings.length > 0 && (
      <div className="menu-import-section">
        <p className="menu-import-section-title">Skipped / notes ({warnings.length})</p>
        <IssueList issues={warnings} tone="warning" label="Skipped rows" />
      </div>
    );

    if (changeCount === 0) {
      return (
        <div className="menu-import-body">
          <div className="menu-import-result-head">
            <StatusIcon tone="success" />
            <div>
              <p className="menu-import-result-title" role="status">Your menu is already up to date — no changes found in this file.</p>
              <p className="menu-import-result-sub">
                <strong>{fileName}</strong>
                {unchangedCount > 0 && ` — ${plural(unchangedCount, 'dish', 'dishes')} already ${unchangedCount === 1 ? 'has' : 'have'} the same price on your menu.`}
                {' '}Nothing was saved.
              </p>
            </div>
          </div>

          {warningList}

          <div className="menu-import-actions">
            <button ref={reviewFocusRef} type="button" className="menu-import-primary" onClick={onClose}>Done</button>
            <FilePicker label="Choose another file" onFile={handleFile} variant="secondary" />
          </div>
        </div>
      );
    }

    return (
      <div className="menu-import-body">
        <div className="menu-import-result-head">
          <StatusIcon tone="info" />
          <div>
            <p className="menu-import-result-title">Review changes</p>
            <p className="menu-import-result-count">{`${plural(changeCount, 'change')} to apply`}</p>
            <p className="menu-import-result-sub">
              <strong>{fileName}</strong> — nothing has been saved yet. Check the changes below, then apply them.
            </p>
          </div>
        </div>

        <dl className="menu-import-summary" aria-label="Summary of changes">
          {summary.map(item => (
            <div key={item.key} className={`menu-import-summary-item${item.count === 0 ? ' is-zero' : ''}`} data-testid={`menu-import-count-${item.key}`}>
              <dt>{item.label}</dt>
              <dd>{item.count}</dd>
            </div>
          ))}
        </dl>

        {priceChanges.length > 0 && (
          <div className="menu-import-section">
            <p className="menu-import-section-title" id="menu-import-price-changes">Price changes ({priceChanges.length})</p>
            <div className="menu-import-table-wrap">
              <table className="menu-import-table" aria-labelledby="menu-import-price-changes">
                <thead>
                  <tr>
                    <th scope="col">Dish</th>
                    <th scope="col" className="is-num">Old price</th>
                    <th scope="col" className="is-num">New price</th>
                    <th scope="col" className="is-num">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {priceChanges.map(change => {
                    const diff = priceDifference(change.oldPrice, change.newPrice);
                    return (
                      <tr key={`${change.dishId}-${change.row}`}>
                        <th scope="row">
                          <span className="menu-import-table-name">{change.name}</span>
                          <span className="menu-import-table-sub">{change.categoryName}</span>
                        </th>
                        <td className="is-num menu-import-old-price">{formatPrice(change.oldPrice)}</td>
                        <td className="is-num menu-import-new-price">{formatPrice(change.newPrice)}</td>
                        <td className="is-num">
                          <span className={`menu-import-diff is-${diff.direction}`} title={diff.label}>
                            {diff.direction !== 'none' && <span aria-hidden="true">{diff.direction === 'up' ? '▲ ' : '▼ '}</span>}
                            {diff.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {dishes.length > 0 && (
          <div className="menu-import-section">
            <p className="menu-import-section-title" id="menu-import-new-dishes">New dishes ({dishes.length})</p>
            <div className="menu-import-table-wrap">
              <table className="menu-import-table" aria-labelledby="menu-import-new-dishes">
                <thead>
                  <tr>
                    <th scope="col">Dish</th>
                    <th scope="col" className="is-num">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {dishes.map(dish => (
                    <tr key={dish.row}>
                      <th scope="row">
                        <span className="menu-import-table-name">{dish.name}</span>
                        <span className="menu-import-table-sub">
                          {dish.categoryName}
                          {dish.categoryId == null && newCategoryKeys.has(dish.categoryName.toLowerCase()) && (
                            <span className="menu-import-new-badge">New category</span>
                          )}
                        </span>
                      </th>
                      <td className="is-num">{formatPrice(dish.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="menu-import-note menu-import-review-note">
          Only prices are updated for dishes already on your menu. Their veg type, availability and description stay as they are.
        </p>

        {warningList}

        <div className="menu-import-actions menu-import-review-actions">
          <button type="button" className="menu-import-primary" onClick={applyChanges}>
            {`Apply ${plural(changeCount, 'change')}`}
          </button>
          <button ref={reviewFocusRef} type="button" className="menu-import-secondary" onClick={cancelReview}>Cancel</button>
        </div>
      </div>
    );
  };

  const renderPriceFailure = () => {
    const { priceFailure, priceTotal } = outcome;
    const lostConnection = priceFailure.code === 'network';
    return (
      <div className="menu-import-body">
        <div className="menu-import-result-head">
          <StatusIcon tone="error" />
          <div>
            <p className="menu-import-result-title" role="alert">
              {lostConnection ? "Prices couldn't be updated" : "Prices couldn't be updated — nothing was changed"}
            </p>
            <p className="menu-import-result-sub"><strong>{fileName}</strong></p>
          </div>
        </div>

        <div className="menu-import-banner is-error">
          <strong>{priceFailure.message}</strong>{' '}
          {lostConnection
            ? `The connection was lost while updating ${plural(priceTotal, 'price')}, so they may not have been saved. No categories or dishes were added. Check your connection and try again.`
            : `None of the ${plural(priceTotal, 'price')} ${priceTotal === 1 ? 'was' : 'were'} updated and no categories or dishes were added.`}
          {priceFailure.code === 'auth' && ' Please log in again, then import the file again.'}
        </div>

        <div className="menu-import-actions">
          {priceFailure.code !== 'auth' && (
            <button type="button" className="menu-import-primary" onClick={applyChanges}>Try again</button>
          )}
          <FilePicker label="Choose another file" onFile={handleFile} variant="secondary" />
          <button type="button" className="menu-import-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  };

  const renderDone = () => {
    if (outcome.priceFailure) return renderPriceFailure();
    const { importedCount, total, failures, notAttempted, createdCategories, stopReason, updatedPriceCount = 0, priceTotal = 0 } = outcome;
    const warnings = validation?.warnings || [];
    const notImported = [...failures, ...notAttempted].sort((a, b) => a.dish.row - b.dish.row);
    const anySaved = importedCount > 0 || updatedPriceCount > 0;
    let tone = 'success';
    let title = 'Menu updated';
    if (importedCount < total) {
      tone = anySaved ? 'warning' : 'error';
      title = stopReason ? 'Import stopped' : anySaved ? 'Import finished with problems' : 'Import failed';
    }

    const counts = [];
    if (priceTotal > 0) counts.push(`Updated ${plural(updatedPriceCount, 'price')}`);
    if (total > 0) {
      const added = importedCount === total ? `Added ${plural(total, 'dish', 'dishes')}` : `Added ${importedCount} of ${plural(total, 'dish', 'dishes')}`;
      counts.push(createdCategories.length ? `${added} (${plural(createdCategories.length, 'new category', 'new categories')})` : added);
    }

    return (
      <div className="menu-import-body">
        <div className="menu-import-result-head">
          <StatusIcon tone={tone} />
          <div>
            <p className="menu-import-result-title" role={tone === 'success' ? 'status' : 'alert'}>{title}</p>
            <p className="menu-import-result-count">{counts.join(' · ')}</p>
            {createdCategories.length > 0 && (
              <p className="menu-import-result-sub">
                {plural(createdCategories.length, 'new category', 'new categories')} created: {createdCategories.map(cat => cat.name).join(', ')}
              </p>
            )}
          </div>
        </div>

        {stopReason && (
          <div className="menu-import-banner is-error" role="alert">
            <strong>{stopReason.message}</strong>{' '}
            {updatedPriceCount > 0 && 'The price changes were saved. '}
            {`It stopped after ${importedCount} of ${plural(total, 'dish', 'dishes')}; ${plural(notAttempted.length, 'dish was', 'dishes were')} not sent. Download the rows that weren't imported and import them again once you're back online.`}
          </div>
        )}

        {failures.length > 0 && (
          <div className="menu-import-section">
            <p className="menu-import-section-title">{plural(failures.length, 'dish', 'dishes')} could not be added</p>
            <IssueList
              issues={failures.map(({ dish, message }) => ({ row: dish.row, column: null, message: `${dish.name} (${dish.categoryName}): ${message}`, severity: 'error' }))}
              label="Rows that failed"
            />
          </div>
        )}

        {warnings.length > 0 && (
          <div className="menu-import-section">
            <p className="menu-import-section-title">Skipped / notes ({warnings.length})</p>
            <IssueList issues={warnings} tone="warning" label="Skipped rows" />
          </div>
        )}

        <div className="menu-import-actions">
          <button type="button" className="menu-import-primary" onClick={onClose}>Done</button>
          {notImported.length > 0 && (
            <button
              type="button"
              className="menu-import-secondary"
              onClick={() => downloadCsv(`${baseName(fileName)}_not_imported.csv`, buildDishesCsv(notImported))}
            >
              Download rows not imported
            </button>
          )}
          <FilePicker label="Import another file" onFile={handleFile} variant="secondary" />
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-content menu-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-import-title"
        aria-busy={busy}
      >
        <div className="modal-header menu-import-header">
          <h3 id="menu-import-title" className="modal-title menu-import-title">Import Menu from Excel/CSV</h3>
          <button
            type="button"
            className="modal-close-btn menu-import-close"
            aria-label="Close import dialog"
            disabled={busy}
            title={busy ? 'Please wait until the import finishes' : 'Close'}
            onClick={() => !busy && onClose()}
          >
            ×
          </button>
        </div>

        {phase === 'select' && renderSelect()}
        {busy && <ProgressView phase={phase} progress={progress} fileName={fileName} />}
        {phase === 'invalid' && renderInvalid()}
        {phase === 'review' && validation && renderReview()}
        {phase === 'done' && outcome && renderDone()}
      </div>
    </div>
  );
}

export default MenuImportDialog;
