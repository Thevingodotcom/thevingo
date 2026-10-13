/**
 * Menu import: CSV parsing + validation (pure functions, no React).
 *
 * The kitchen-menu "Import menu" dialog accepts a CSV (from Excel / Google
 * Sheets) or an .xlsx workbook, validates every row up front and only then
 * talks to the server. Workbooks are first converted to the same CSV text by
 * menuImportExcel.js (readImportFile), so everything here works on CSV text.
 * It is synchronous and side-effect free so it can be unit tested in
 * isolation.
 *
 * Row numbers in every message are the numbers a user sees in a spreadsheet:
 * the header is row 1, the first dish is row 2. A quoted value that spans
 * several lines still counts as one spreadsheet row.
 */

export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_IMPORT_ROWS = 1000;

/**
 * Columns understood by the importer. `label` is what the template header
 * uses; `aliases` are accepted alternatives (compared after normalisation:
 * lower-case, text in brackets removed, punctuation collapsed to spaces).
 */
export const MENU_IMPORT_COLUMNS = [
  { key: 'category', label: 'Category', required: true, aliases: ['category', 'category name', 'categories', 'menu category', 'section'] },
  { key: 'name', label: 'Dish Name', required: true, aliases: ['dish name', 'dish', 'name', 'item', 'item name', 'dish title'] },
  { key: 'price', label: 'Price', required: true, aliases: ['price', 'rate', 'amount', 'cost', 'mrp', 'price rs', 'price inr'] },
  { key: 'vegType', label: 'Veg Type (veg/non_veg)', required: false, aliases: ['veg type', 'veg non veg', 'veg nonveg', 'type', 'food type', 'dish type', 'veg', 'is veg', 'diet'] },
  { key: 'breakfast', label: 'Breakfast (1/0)', required: false, aliases: ['breakfast', 'available breakfast', 'breakfast available'] },
  { key: 'lunch', label: 'Lunch (1/0)', required: false, aliases: ['lunch', 'available lunch', 'lunch available'] },
  { key: 'dinner', label: 'Dinner (1/0)', required: false, aliases: ['dinner', 'available dinner', 'dinner available'] },
  { key: 'description', label: 'Description', required: false, aliases: ['description', 'desc', 'details', 'dish description'] }
];

/** Header row of the downloadable template (Description is optional and left out). */
export const TEMPLATE_HEADERS = MENU_IMPORT_COLUMNS.filter(col => col.key !== 'description').map(col => col.label);
export const REQUIRED_COLUMN_LABELS = MENU_IMPORT_COLUMNS.filter(col => col.required).map(col => col.label);

// Columns we write ourselves into "failed rows" downloads; ignored silently on re-import.
const IGNORED_HEADERS = ['error', 'errors', 'problem', 'problems', 'import error', 'row'];

const VEG_VALUES = ['veg', 'vegetarian', 'v', 'pureveg', 'pure veg'];
const NON_VEG_VALUES = ['nonveg', 'non veg', 'non_veg', 'non-veg', 'nonvegetarian', 'non vegetarian', 'non-vegetarian', 'nv'];
const YES_VALUES = ['1', 'yes', 'y', 'true', 'available'];
const NO_VALUES = ['0', 'no', 'n', 'false', 'unavailable', 'not available'];

const BOM = '﻿';

const lower = (value) => String(value ?? '').trim().toLowerCase();
const collapse = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

/** Shortens a cell value for use inside a message. */
export const quoteValue = (value) => {
  const text = collapse(value);
  return `'${text.length > 40 ? `${text.slice(0, 37)}…` : text}'`;
};

export const normalizeHeader = (value) => String(value ?? '')
  .replace(/^﻿/, '')
  .toLowerCase()
  .replace(/\(.*?\)/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const formatBytes = (bytes) => (bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Checks the picked file before reading it (presence and size). The type is
 * not judged by the extension: readImportFile (menuImportExcel.js) decides
 * CSV vs .xlsx from the file's content. Returns a file-level issue or null
 * when the file looks acceptable.
 */
export function checkImportFile(file) {
  if (!file) {
    return { code: 'no-file', title: 'No file selected', message: 'Choose a .csv or .xlsx file to import.' };
  }
  if (typeof file.size === 'number' && file.size === 0) {
    return { code: 'empty-file', title: 'The file is empty', message: `"${file.name}" has no content. Add your dishes below the header row and save it again.` };
  }
  if (typeof file.size === 'number' && file.size > MAX_IMPORT_FILE_BYTES) {
    return {
      code: 'too-large',
      title: 'The file is too large',
      message: `"${file.name}" is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_IMPORT_FILE_BYTES)}. Split the menu into smaller files and import them one at a time.`
    };
  }
  return null;
}

/** Picks the delimiter used in the first non-empty line (Excel in some locales uses ';'). */
export function detectDelimiter(text) {
  const firstLine = String(text || '').split(/\r?\n/).find(line => line.trim()) || '';
  const unquoted = firstLine.replace(/"[^"]*"/g, '');
  const counts = [',', ';', '\t'].map(delim => [delim, unquoted.split(delim).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

/**
 * RFC 4180 style CSV parser. Handles quoted fields containing delimiters,
 * escaped quotes ("") and line breaks, CRLF / LF / CR line endings and a
 * leading byte-order mark.
 *
 * Returns { delimiter, records } where each record is
 * { row, fields: string[], errors: string[] } and `row` is the 1-based
 * spreadsheet row number. Blank lines are kept as records (with a single
 * empty field) so the numbering matches the spreadsheet.
 */
export function parseCsv(input, delimiter) {
  let text = String(input ?? '');
  if (text.startsWith(BOM)) text = text.slice(1);
  const delim = delimiter || detectDelimiter(text);

  const records = [];
  let fields = [];
  let field = '';
  let inQuotes = false;
  let afterClosingQuote = false;
  let fieldStarted = false;
  let recordErrors = [];

  const pushField = () => {
    fields.push(field);
    field = '';
    afterClosingQuote = false;
    fieldStarted = false;
  };
  const pushRecord = () => {
    pushField();
    records.push({ row: records.length + 1, fields, errors: recordErrors });
    fields = [];
    recordErrors = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
          afterClosingQuote = true;
        }
      } else if (char === '\r') {
        // Normalise line breaks inside quoted values to \n.
        field += '\n';
        if (text[i + 1] === '\n') i++;
      } else {
        field += char;
      }
      continue;
    }

    if (char === delim) {
      pushField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      pushRecord();
    } else if (char === '"' && !fieldStarted && !afterClosingQuote) {
      inQuotes = true;
      fieldStarted = true;
      field = '';
    } else if (afterClosingQuote) {
      if (char.trim()) {
        const message = `Column ${fields.length + 1} has text after its closing quote. A value with quotes inside must be wrapped in quotes with each inner quote doubled, e.g. "Chef's ""Special""".`;
        if (!recordErrors.includes(message)) recordErrors.push(message);
        field += char;
      }
    } else {
      if (char.trim()) fieldStarted = true;
      field += char;
    }
  }

  if (inQuotes) {
    recordErrors.push(`A quote (") opened in column ${fields.length + 1} is never closed, so everything after it was read as one value. Make sure every opening quote has a matching closing quote.`);
  }
  // Last record (no trailing newline), unless the text ended exactly on a line break.
  if (field !== '' || fields.length > 0 || inQuotes || afterClosingQuote || recordErrors.length) {
    pushRecord();
  }

  return { delimiter: delim, records };
}

const isBlankRecord = (record) => record.errors.length === 0 && record.fields.every(value => !value.trim());

/** Parses a price cell. Accepts "180", "180.50", "₹180", "Rs. 1,200", "180/-". */
export function parsePrice(raw) {
  const original = collapse(raw);
  if (!original) return { error: 'Price is missing' };
  let cleaned = original
    .replace(/^(₹|rs\.?|inr)\s*/i, '')
    .replace(/\s*(₹|rs\.?|inr|\/-)$/i, '')
    .trim();
  if (/^-?\d{1,3}(,\d{2,3})+(\.\d+)?$/.test(cleaned)) cleaned = cleaned.replace(/,/g, '');
  if (/^-\s*\d+(\.\d+)?$/.test(cleaned)) return { error: `Price ${quoteValue(original)} cannot be negative` };
  if (!/^\d+(\.\d+)?$/.test(cleaned) && !/^\.\d+$/.test(cleaned)) {
    return { error: `Price ${quoteValue(original)} is not a number` };
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { error: `Price ${quoteValue(original)} is not a number` };
  if (value === 0) return { error: 'Price must be greater than 0' };
  const decimals = (cleaned.split('.')[1] || '').length;
  if (decimals > 2) return { error: `Price ${quoteValue(original)} has more than 2 decimal places` };
  return { value };
}

/** Parses the veg type cell. Blank means veg (matches the add-dish default). */
export function parseVegType(raw) {
  const value = lower(raw).replace(/\s+/g, ' ');
  if (!value) return { value: true };
  if (VEG_VALUES.includes(value)) return { value: true };
  if (NON_VEG_VALUES.includes(value) || NON_VEG_VALUES.includes(value.replace(/[\s_-]/g, ''))) return { value: false };
  return { error: `Veg type ${quoteValue(raw)} is not valid — use veg or non_veg` };
}

/** Parses an availability cell (1/0, yes/no, true/false). Blank means available. */
export function parseAvailability(raw, label) {
  const value = lower(raw);
  if (!value) return { value: true };
  if (YES_VALUES.includes(value)) return { value: true };
  if (NO_VALUES.includes(value)) return { value: false };
  return { error: `${label} ${quoteValue(raw)} is not valid — use 1 (available) or 0 (not available)` };
}

const findColumn = (normalized) => MENU_IMPORT_COLUMNS.find(col => col.aliases.includes(normalized));

const issue = (row, column, message, severity = 'error') => ({ row, column, message, severity });

const fileError = (code, title, message, extra = {}) => ({ code, title, message, ...extra });

const dishKey = (category, name) => `${lower(collapse(category))}|${lower(collapse(name))}`;

const emptyResult = (fileErrors, warnings = []) => ({
  ok: false,
  fileErrors,
  errors: [],
  warnings,
  dishes: [],
  newCategories: [],
  dataRowCount: 0,
  headers: []
});

/**
 * Parses and validates the full import file.
 *
 * @param {string} text  file contents
 * @param {{ existingCategories?: Array<{id, name, items?}> }} options
 * @returns {{
 *   ok: boolean,                 // true when nothing blocks the import
 *   fileErrors: Array<{code,title,message,expected?,found?,missing?}>,
 *   errors: Array<{row,column,message,severity}>,
 *   warnings: Array<{row,column,message,severity}>,
 *   dishes: Array<{row,categoryName,categoryId,name,price,isVeg,availableBreakfast,availableLunch,availableDinner,description}>,
 *   newCategories: string[],
 *   dataRowCount: number,
 *   headers: string[]
 * }}
 */
export function validateMenuImport(text, { existingCategories = [] } = {}) {
  const raw = String(text ?? '');
  const warnings = [];

  if (raw.startsWith('PK\u0003\u0004') || raw.startsWith('ÐÏ\u0011à') || raw.includes('\u0000')) {
    return emptyResult([fileError(
      'binary-file',
      'This is not a CSV file',
      'The file contains binary data — it looks like an Excel workbook that was renamed to .csv. Open it in Excel and use File → Save As → "CSV UTF-8 (Comma delimited) (*.csv)" instead of renaming it.'
    )]);
  }

  if (!raw.replace(BOM, '').trim()) {
    return emptyResult([fileError('empty-file', 'The file is empty', 'There is nothing in the file. Download the template, add your dishes below the header row and save it as CSV.')]);
  }

  if (raw.includes('�')) {
    warnings.push(issue(null, null, "Some characters couldn't be read (shown as �). Save the file as \"CSV UTF-8\" to keep symbols like ₹ and accented letters.", 'warning'));
  }

  const { records } = parseCsv(raw);
  const headerIndex = records.findIndex(record => !isBlankRecord(record));
  if (headerIndex === -1) {
    return emptyResult([fileError('empty-file', 'The file is empty', 'The file only contains empty rows. Download the template, add your dishes below the header row and save it as CSV.')], warnings);
  }
  const headerRecord = records[headerIndex];
  const headers = headerRecord.fields.map(value => collapse(value.replace(/^﻿/, '')));

  // ---- Header / columns -------------------------------------------------
  const columnIndex = {};
  const unknownHeaders = [];
  const duplicateHeaders = [];
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return;
    const column = findColumn(normalized);
    if (!column) {
      if (!IGNORED_HEADERS.includes(normalized)) unknownHeaders.push(header);
      return;
    }
    if (columnIndex[column.key] !== undefined) {
      duplicateHeaders.push(`"${column.label}" appears in columns ${columnIndex[column.key] + 1} and ${index + 1}`);
      return;
    }
    columnIndex[column.key] = index;
  });

  const missing = MENU_IMPORT_COLUMNS.filter(col => col.required && columnIndex[col.key] === undefined).map(col => col.label);
  const fileErrors = [];
  if (headerRecord.errors.length) {
    headerRecord.errors.forEach(message => fileErrors.push(fileError('bad-header', `Row ${headerRecord.row} (header) can't be read`, message)));
  }
  if (missing.length) {
    const looksLikeData = headers.some(header => /^\d+(\.\d+)?$/.test(header));
    fileErrors.push(fileError(
      'missing-columns',
      `Missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
      looksLikeData
        ? `Row ${headerRecord.row} looks like dish data, not a header row. The first row must contain the column names exactly as in the template.`
        : `The first row of the file must be the header row with the column names from the template (upper/lower case and extra spaces don't matter).`,
      { expected: TEMPLATE_HEADERS, found: headers.filter(Boolean), missing }
    ));
  }
  if (duplicateHeaders.length) {
    fileErrors.push(fileError('duplicate-columns', 'The same column appears more than once', `${duplicateHeaders.join('; ')}. Keep only one of each column.`));
  }
  if (unknownHeaders.length && !missing.length) {
    warnings.push(issue(headerRecord.row, null, `Column${unknownHeaders.length === 1 ? '' : 's'} ${unknownHeaders.map(h => `"${h}"`).join(', ')} ${unknownHeaders.length === 1 ? "isn't" : "aren't"} recognised and will be ignored`, 'warning'));
  }

  const dataRecords = records.slice(headerIndex + 1).filter(record => !isBlankRecord(record));

  if (fileErrors.length) {
    return { ...emptyResult(fileErrors, warnings), headers, dataRowCount: dataRecords.length };
  }
  if (dataRecords.length === 0) {
    return {
      ...emptyResult([fileError('no-rows', 'No dishes found', `The file only has the header row. Add one dish per row starting at row ${headerRecord.row + 1}.`)], warnings),
      headers
    };
  }
  if (dataRecords.length > MAX_IMPORT_ROWS) {
    return {
      ...emptyResult([fileError('too-many-rows', 'Too many rows', `The file has ${dataRecords.length} dishes; up to ${MAX_IMPORT_ROWS} can be imported at once. Split it into smaller files.`)], warnings),
      headers,
      dataRowCount: dataRecords.length
    };
  }

  // ---- Rows ---------------------------------------------------------------
  const errors = [];
  const valid = [];
  const headerCount = headers.length;
  const cell = (record, key) => (columnIndex[key] === undefined ? '' : (record.fields[columnIndex[key]] ?? ''));

  dataRecords.forEach(record => {
    const { row } = record;
    if (record.errors.length) {
      record.errors.forEach(message => errors.push(issue(row, null, message)));
      return;
    }
    const extra = record.fields.slice(headerCount);
    if (extra.some(value => value.trim())) {
      errors.push(issue(row, null, `Row has ${record.fields.length} values but the header has ${headerCount} columns. A value that contains a comma (for example a dish name, or a price like 1,200) must be wrapped in double quotes.`));
      return;
    }

    const rowErrors = [];
    const categoryName = collapse(cell(record, 'category'));
    const name = collapse(cell(record, 'name'));
    if (!categoryName) rowErrors.push(issue(row, 'Category', 'Category is missing'));
    if (!name) rowErrors.push(issue(row, 'Dish Name', 'Dish name is missing'));

    const price = parsePrice(cell(record, 'price'));
    if (price.error) rowErrors.push(issue(row, 'Price', price.error));

    const veg = parseVegType(cell(record, 'vegType'));
    if (veg.error) rowErrors.push(issue(row, 'Veg Type', veg.error));

    const availability = {};
    [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']].forEach(([key, label]) => {
      const parsed = parseAvailability(cell(record, key), label);
      if (parsed.error) rowErrors.push(issue(row, label, parsed.error));
      availability[key] = parsed.value;
    });

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    if (!availability.breakfast && !availability.lunch && !availability.dinner) {
      warnings.push(issue(row, null, `${quoteValue(name)} is not available for breakfast, lunch or dinner, so customers won't see it until you change that`, 'warning'));
    }

    valid.push({
      row,
      categoryName,
      name,
      price: price.value,
      isVeg: veg.value,
      availableBreakfast: availability.breakfast,
      availableLunch: availability.lunch,
      availableDinner: availability.dinner,
      description: collapse(cell(record, 'description'))
    });
  });

  // ---- Duplicates -----------------------------------------------------
  const existingByName = new Map();
  (existingCategories || []).forEach(category => {
    const key = lower(collapse(category?.name));
    if (!key || existingByName.has(key)) return;
    existingByName.set(key, {
      category,
      dishNames: new Set((category.items || []).map(item => lower(collapse(item?.name))))
    });
  });

  const firstRowByKey = new Map();
  const dishes = [];
  const newCategories = [];
  const newCategoryKeys = new Set();

  valid.forEach(dish => {
    const key = dishKey(dish.categoryName, dish.name);
    if (firstRowByKey.has(key)) {
      warnings.push(issue(dish.row, 'Dish Name', `${quoteValue(dish.name)} in ${quoteValue(dish.categoryName)} is listed again (first on row ${firstRowByKey.get(key)}) — this row will be skipped`, 'warning'));
      return;
    }
    firstRowByKey.set(key, dish.row);

    const catKey = lower(dish.categoryName);
    const existing = existingByName.get(catKey);
    if (existing && existing.dishNames.has(lower(dish.name))) {
      warnings.push(issue(dish.row, 'Dish Name', `${quoteValue(dish.name)} is already on your menu in ${quoteValue(existing.category.name)} — this row will be skipped`, 'warning'));
      return;
    }

    if (!existing && !newCategoryKeys.has(catKey)) {
      newCategoryKeys.add(catKey);
      newCategories.push(dish.categoryName);
    }
    dishes.push({
      ...dish,
      categoryId: existing ? existing.category.id : null,
      categoryName: existing ? existing.category.name : dish.categoryName
    });
  });

  return {
    ok: errors.length === 0,
    fileErrors: [],
    errors,
    warnings,
    dishes: errors.length ? [] : dishes,
    newCategories: errors.length ? [] : newCategories,
    dataRowCount: dataRecords.length,
    headers
  };
}

/** Counts distinct rows that have at least one issue. */
export const countRows = (issues) => new Set(issues.filter(i => i.row != null).map(i => i.row)).size;

/**
 * Groups issues by row for display, keeping at most `limit` messages.
 * File-level issues (row == null) come first.
 */
export function groupIssuesByRow(issues, limit = 50) {
  const sorted = [...issues].sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  const shown = sorted.slice(0, limit);
  const groups = [];
  shown.forEach(item => {
    const last = groups[groups.length - 1];
    if (last && last.row === item.row) last.issues.push(item);
    else groups.push({ row: item.row, issues: [item] });
  });
  return { groups, hiddenCount: Math.max(0, sorted.length - shown.length) };
}

// ---- CSV writers ----------------------------------------------------------

const escapeCsvValue = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Serialises rows (arrays of values) to CSV with CRLF line endings. */
export const buildCsv = (rows) => rows.map(row => row.map(escapeCsvValue).join(',')).join('\r\n') + '\r\n';

export const buildTemplateCsv = () => buildCsv([
  TEMPLATE_HEADERS,
  ['Main Course', 'Paneer Butter Masala', '180', 'veg', '1', '1', '1'],
  ['Starters', 'Chicken 65', '220', 'non_veg', '0', '1', '1']
]);

/** CSV report of file-level problems, row errors and warnings. */
export function buildIssueReportCsv({ fileErrors = [], errors = [], warnings = [] } = {}) {
  const rows = [['Row', 'Column', 'Severity', 'Problem']];
  fileErrors.forEach(err => {
    const detail = err.missing
      ? ` Expected header row: ${err.expected.join(',')}. Found: ${err.found.join(',') || '(nothing)'}.`
      : '';
    rows.push(['', '', 'error', `${err.title}. ${err.message}${detail}`]);
  });
  [...errors, ...warnings]
    .sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1))
    .forEach(item => rows.push([item.row ?? '', item.column ?? '', item.severity, item.message]));
  return buildCsv(rows);
}

/**
 * CSV of dishes in the template format (plus an "Error" column the importer
 * ignores), so rows that weren't imported can be fixed and re-imported.
 */
export function buildDishesCsv(entries) {
  const rows = [[...TEMPLATE_HEADERS, 'Description', 'Error']];
  entries.forEach(({ dish, message }) => rows.push([
    dish.categoryName,
    dish.name,
    dish.price,
    dish.isVeg ? 'veg' : 'non_veg',
    dish.availableBreakfast ? 1 : 0,
    dish.availableLunch ? 1 : 0,
    dish.availableDinner ? 1 : 0,
    dish.description || '',
    message || ''
  ]));
  return buildCsv(rows);
}
