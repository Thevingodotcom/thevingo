import React, { useEffect, useRef, useState } from 'react';
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
import { runMenuImport } from './runMenuImport';

const VISIBLE_ISSUE_LIMIT = 50;

const STEPS = [
  { key: 'reading', label: 'Reading file' },
  { key: 'validating', label: 'Checking every row' },
  { key: 'categories', label: 'Creating categories' },
  { key: 'dishes', label: 'Adding dishes' }
];

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const readFileText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('read failed'));
  reader.readAsText(file);
});

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

/* ---------- Icons ---------- */
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const StatusIcon = ({ tone }) => (
  <span className={`menu-import-status-icon is-${tone}`} aria-hidden="true">
    {tone === 'success' ? (
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
  const stepIndex = phase === 'reading' ? 0 : phase === 'validating' ? 1 : progress.step === 'categories' ? 2 : 3;
  const dishTotal = progress.dishTotal || 0;
  const dishDone = progress.step === 'dishes' ? progress.done : 0;
  const percent = dishTotal ? Math.round((dishDone / dishTotal) * 100) : 0;
  const importing = phase === 'importing';

  return (
    <div className="menu-import-progress" role="status" aria-live="polite" aria-busy="true">
      <div className="menu-import-spinner" aria-hidden="true"></div>
      <p className="menu-import-progress-title">Importing menu…</p>
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
          if (step.key === 'categories' && importing) {
            detail = progress.categoryTotal === 0
              ? 'none needed'
              : `${Math.min(progress.step === 'categories' ? progress.done : progress.categoryTotal, progress.categoryTotal)} of ${progress.categoryTotal}`;
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
      <p className="menu-import-progress-hint">Please keep this window open until the import finishes.</p>
    </div>
  );
}

function FilePicker({ label, onFile, variant = 'primary' }) {
  return (
    <label className={`menu-import-pick is-${variant}`}>
      {label}
      <input
        type="file"
        accept=".csv,text/csv,.xlsx,.xls"
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

/* ---------- Dialog ---------- */
function MenuImportDialog({ categories, setCategories, onClose, onMenuChanged }) {
  // phase: select | reading | validating | invalid | importing | done
  const [phase, setPhase] = useState('select');
  const [fileName, setFileName] = useState('');
  const [validation, setValidation] = useState(null);
  const [progress, setProgress] = useState({ step: null, done: 0, total: 0, dishTotal: 0, categoryTotal: 0, currentName: '' });
  const [outcome, setOutcome] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const busyRef = useRef(false);

  const busy = phase === 'reading' || phase === 'validating' || phase === 'importing';

  useEffect(() => {
    if (phase !== 'importing') return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const showInvalid = (result) => {
    setValidation(result);
    setPhase('invalid');
    haptics?.error?.();
  };

  const mergeIntoMenu = (result) => {
    const { createdCategories, addedDishes } = result;
    if (!createdCategories.length && !addedDishes.length) return;
    const byCategory = new Map();
    addedDishes.forEach(({ dish, categoryId }) => {
      const key = String(categoryId);
      byCategory.set(key, [...(byCategory.get(key) || []), dish]);
    });
    setCategories(prev => {
      const existingIds = new Set(prev.map(cat => String(cat.id)));
      const merged = prev.map(cat => {
        const extra = byCategory.get(String(cat.id));
        return extra && extra.length ? { ...cat, items: [...(cat.items || []), ...extra] } : cat;
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
    setPhase('reading');

    try {
      const fileProblem = checkImportFile(file);
      if (fileProblem) {
        showInvalid({ ok: false, fileErrors: [fileProblem], errors: [], warnings: [] });
        return;
      }

      let text;
      try {
        text = await readFileText(file);
      } catch {
        showInvalid({ ok: false, fileErrors: [{ code: 'read-failed', title: "The file couldn't be read", message: 'It may have been moved, or it is still open and locked by another program. Close it and try again.' }], errors: [], warnings: [] });
        return;
      }

      setPhase('validating');
      await nextTick();
      const result = validateMenuImport(text, { existingCategories: categories });
      if (!result.ok) {
        showInvalid(result);
        return;
      }

      if (result.dishes.length === 0) {
        setValidation(result);
        setOutcome({ importedCount: 0, total: 0, failures: [], notAttempted: [], createdCategories: [], categoryFailures: [], stopReason: null });
        setPhase('done');
        haptics?.warning?.();
        return;
      }

      setValidation(result);
      setProgress({ step: 'categories', done: 0, total: result.newCategories.length, dishTotal: result.dishes.length, categoryTotal: result.newCategories.length, currentName: '' });
      setPhase('importing');

      const runResult = await runMenuImport({
        dishes: result.dishes,
        newCategories: result.newCategories,
        apiUrl: API_URL,
        token: authStorage.getToken(),
        onProgress: (update) => setProgress(prev => ({ ...prev, ...update }))
      });

      mergeIntoMenu(runResult);
      setOutcome({ ...runResult, total: result.dishes.length });
      setPhase('done');
      if (runResult.importedCount === result.dishes.length) haptics?.success?.();
      else if (runResult.importedCount > 0) haptics?.warning?.();
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

  const downloadTemplate = () => downloadCsv('vingo_menu_template.csv', buildTemplateCsv());
  const downloadReport = () => downloadCsv(`${baseName(fileName)}_errors.csv`, buildIssueReportCsv(validation || {}));

  const templateLink = (
    <button type="button" className="menu-import-link" onClick={downloadTemplate}>Download sample CSV template</button>
  );

  /* ----- Views ----- */
  const renderSelect = () => (
    <div className="menu-import-body">
      <p className="menu-import-heading">Instructions:</p>
      <ol className="menu-import-instructions">
        <li>Download the Excel template using the button below.</li>
        <li>Add one dish per row. Required columns: <strong>{MENU_IMPORT_COLUMNS.filter(c => c.required).map(c => c.label).join(', ')}</strong>.</li>
        <li>Save the completed file as a <strong>.csv</strong> file (Excel: File → Save As → CSV UTF-8).</li>
        <li>Click "Choose CSV File" to select and import your menu.</li>
      </ol>
      {categories.length > 0 && (
        <p className="menu-import-note">
          Imported dishes are added to your current menu. Rows whose category already exists are placed in that category; nothing is removed. Dishes already on your menu are skipped.
        </p>
      )}

      <button type="button" className="menu-import-template-btn" onClick={downloadTemplate}>
        Download Excel/CSV Template
      </button>

      <div
        className={`menu-import-dropzone${isDragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <FilePicker label="Choose CSV File" onFile={handleFile} />
        <p className="menu-import-dropzone-hint">or drag and drop it here · .csv up to {Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} MB</p>
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
              <strong>{fileName}</strong> — nothing was imported. Fix {problemCount === 1 ? 'the problem' : 'the problems'} below in your spreadsheet, save it as CSV and choose it again.
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
          Expected header row: <code>{TEMPLATE_HEADERS.join(',')}</code> · {templateLink}
        </p>
      </div>
    );
  };

  const renderDone = () => {
    const { importedCount, total, failures, notAttempted, createdCategories, stopReason } = outcome;
    const warnings = validation?.warnings || [];
    const notImported = [...failures, ...notAttempted].sort((a, b) => a.dish.row - b.dish.row);
    let tone = 'success';
    let title = 'Menu imported';
    if (total === 0) { tone = 'warning'; title = 'Nothing to import'; }
    else if (importedCount === 0) { tone = 'error'; title = stopReason ? 'Import stopped' : 'Import failed'; }
    else if (importedCount < total) { tone = 'warning'; title = stopReason ? 'Import stopped' : 'Import finished with problems'; }

    return (
      <div className="menu-import-body">
        <div className="menu-import-result-head">
          <StatusIcon tone={tone} />
          <div>
            <p className="menu-import-result-title" role={tone === 'success' ? 'status' : 'alert'}>{title}</p>
            <p className="menu-import-result-count">
              {total === 0
                ? 'Every dish in this file is already on your menu or listed twice, so nothing new was added.'
                : `Imported ${importedCount} of ${plural(total, 'dish', 'dishes')}`}
            </p>
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
        {phase === 'done' && outcome && renderDone()}
      </div>
    </div>
  );
}

export default MenuImportDialog;
