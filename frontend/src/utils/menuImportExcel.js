/**
 * Menu import: Excel (.xlsx) support.
 *
 * The importer itself works on CSV text (see menuImport.js). This module
 * builds the downloadable .xlsx template / menu workbook (with dropdowns for
 * the fixed-value columns) and turns a picked file - CSV or .xlsx, decided
 * from its content rather than its name - into that CSV text.
 *
 * exceljs is loaded on demand to keep it out of the main bundle.
 */
import { MAX_IMPORT_ROWS, MENU_IMPORT_COLUMNS, buildCsv } from './menuImport';

export const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXCEL_MACRO_MIME_TYPE = 'application/vnd.ms-excel.sheet.macroEnabled.12';

/** Value for the file input's `accept` attribute. */
export const IMPORT_FILE_ACCEPT = ['.csv', 'text/csv', '.xlsx', EXCEL_MIME_TYPE, '.xlsm', EXCEL_MACRO_MIME_TYPE].join(',');

const MENU_SHEET_NAME = 'Menu';
const LISTS_SHEET_NAME = 'Lists';

// Workbook headers are friendlier than the CSV template's ("Veg Type" rather
// than "Veg Type (veg/non_veg)") - the dropdowns show the allowed values.
// Every header still matches one of the importer's column aliases.
const EXCEL_HEADER_LABELS = { vegType: 'Veg Type', breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const COLUMN_WIDTHS = { category: 22, name: 32, price: 10, vegType: 12, breakfast: 12, lunch: 10, dinner: 10, description: 50 };

const EXCEL_COLUMNS = MENU_IMPORT_COLUMNS.map(col => ({
  key: col.key,
  header: EXCEL_HEADER_LABELS[col.key] || col.label,
  width: COLUMN_WIDTHS[col.key] || 16
}));

/** Header row of the generated workbooks. */
export const EXCEL_TEMPLATE_HEADERS = EXCEL_COLUMNS.map(col => col.header);

const TEMPLATE_SAMPLE_ROWS = [
  { category: 'Main Course', name: 'Paneer Butter Masala', price: 180, vegType: 'Veg', breakfast: 'Yes', lunch: 'Yes', dinner: 'Yes', description: 'Cottage cheese in a creamy tomato gravy' },
  { category: 'Starters', name: 'Chicken 65', price: 220, vegType: 'Non Veg', breakfast: 'No', lunch: 'Yes', dinner: 'Yes', description: '' }
];

// First 8 bytes of a zip archive (.xlsx) and of an OLE compound file (.xls,
// and also password-protected .xlsx).
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];
const SNIFF_BYTES = 1024;

const excelError = (code, message, cause) => Object.assign(new Error(message), { code, cause });

const loadExcelJS = async () => {
  try {
    return (await import('exceljs')).default;
  } catch (error) {
    // The chunk is fetched on demand, so this is usually a network problem.
    throw excelError('excel-load-failed', 'Excel support could not be loaded.', error);
  }
};

/* ---------- Writing ---------- */

const categoryNames = (categories) => {
  const seen = new Set();
  const names = [];
  (categories || []).forEach(category => {
    const name = String((typeof category === 'string' ? category : category?.name) ?? '').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    names.push(name);
  });
  return names;
};

const yesNoValidation = (meal) => ({
  type: 'list',
  allowBlank: true,
  formulae: ['"Yes,No"'],
  showInputMessage: true,
  promptTitle: meal,
  prompt: `Yes if the dish is served at ${meal.toLowerCase()}. Blank means Yes.`,
  showErrorMessage: true,
  errorStyle: 'stop',
  errorTitle: 'Choose Yes or No',
  error: `${meal} must be Yes or No — pick one from the list.`
});

function addValidations(sheet, existingCategories) {
  const lastRow = MAX_IMPORT_ROWS + 1;
  const range = (key) => {
    const { letter } = sheet.getColumn(key);
    return `${letter}2:${letter}${lastRow}`;
  };

  sheet.dataValidations.add(range('price'), {
    type: 'decimal',
    operator: 'greaterThan',
    allowBlank: true,
    formulae: [0],
    showInputMessage: true,
    promptTitle: 'Price',
    prompt: 'A number greater than 0, e.g. 180 or 129.50.',
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Invalid price',
    error: 'Enter the price as a number greater than 0, without ₹ or commas (e.g. 180 or 129.50).'
  });
  sheet.dataValidations.add(range('vegType'), {
    type: 'list',
    allowBlank: true,
    formulae: ['"Veg,Non Veg"'],
    showInputMessage: true,
    promptTitle: 'Veg Type',
    prompt: 'Veg or Non Veg. Blank means Veg.',
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Choose Veg or Non Veg',
    error: 'Veg Type must be Veg or Non Veg — pick one from the list.'
  });
  [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']].forEach(([key, meal]) => {
    sheet.dataValidations.add(range(key), yesNoValidation(meal));
  });

  const names = categoryNames(existingCategories);
  if (!names.length) return;
  // The list lives on a hidden sheet: an inline list is capped at 255 characters.
  const lists = sheet.workbook.addWorksheet(LISTS_SHEET_NAME, { state: 'hidden' });
  names.forEach((name, index) => { lists.getCell(index + 1, 1).value = name; });
  sheet.dataValidations.add(range('category'), {
    type: 'list',
    allowBlank: true,
    formulae: [`${LISTS_SHEET_NAME}!$A$1:$A$${names.length}`],
    showInputMessage: true,
    promptTitle: 'Category',
    prompt: 'Pick a category from your menu, or type a new one.',
    // 'information' only informs, so a new category can still be typed in.
    showErrorMessage: true,
    errorStyle: 'information',
    errorTitle: 'New category',
    error: "This category isn't on your menu yet — it will be created when you import. Click OK to keep it."
  });
}

/**
 * Builds the menu import workbook (.xlsx): a "Menu" sheet with the import
 * columns, the given rows and dropdowns for the fixed-value columns.
 *
 * @param {{ rows?: Array<object>, existingCategories?: Array<string|{name: string}> }} options
 *   `rows` are keyed by the MENU_IMPORT_COLUMNS keys; `existingCategories`
 *   feed the Category dropdown (a new category can still be typed in).
 * @returns {Promise<Blob>}
 */
export async function buildMenuWorkbookBlob({ rows = [], existingCategories = [] } = {}) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(MENU_SHEET_NAME, { views: [{ state: 'frozen', ySplit: 1 }] });

  sheet.columns = EXCEL_COLUMNS;
  sheet.addRows(rows);

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF05A28' } };
  });
  sheet.getColumn('description').alignment = { wrapText: true, vertical: 'top' };

  addValidations(sheet, existingCategories);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: EXCEL_MIME_TYPE });
}

/** The import template: the menu workbook with two sample dishes. */
export const buildTemplateWorkbookBlob = ({ existingCategories = [] } = {}) =>
  buildMenuWorkbookBlob({ rows: TEMPLATE_SAMPLE_ROWS, existingCategories });

/* ---------- Reading ---------- */

// Up to 15 significant digits, like Excel shows: 0.1 + 0.2 reads as 0.3.
const formatNumber = (value) => (Number.isFinite(value) ? String(Number(value.toPrecision(15))) : '');

const formatDate = (value) => (Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10));

/** Plain text for an exceljs cell value (rich text, formula, hyperlink, ...). */
function cellToText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map(part => part.text ?? '').join('');
    if ('error' in value) return '';
    if ('formula' in value || 'sharedFormula' in value || 'result' in value) return cellToText(value.result);
    if ('text' in value) return cellToText(value.text);
  }
  return String(value);
}

const isHidden = (sheet) => sheet.state === 'hidden' || sheet.state === 'veryHidden';

const pickSheet = (workbook) =>
  workbook.worksheets.find(sheet => sheet.name.trim().toLowerCase() === MENU_SHEET_NAME.toLowerCase())
  || workbook.worksheets.find(sheet => !isHidden(sheet))
  || workbook.worksheets[0];

/**
 * Rows 1..last row with a value, blank rows included so row numbers match
 * the spreadsheet, each padded to the last column with a value.
 */
function sheetToRows(sheet) {
  const valuesByRow = new Map();
  let lastRow = 0;
  let lastColumn = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const text = cellToText(cell.value);
      if (!text) return;
      values[columnNumber - 1] = text;
      lastRow = Math.max(lastRow, rowNumber);
      lastColumn = Math.max(lastColumn, columnNumber);
    });
    valuesByRow.set(rowNumber, values);
  });

  const rows = [];
  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber++) {
    const values = valuesByRow.get(rowNumber) || [];
    rows.push(Array.from({ length: lastColumn }, (_, index) => values[index] ?? ''));
  }
  return rows;
}

/**
 * Converts an .xlsx workbook to CSV text for validateMenuImport. Reads the
 * "Menu" sheet, else the first visible one.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<string>}
 * @throws {Error} with `code` 'excel-unreadable', 'excel-no-sheet' or 'excel-load-failed'
 */
export async function excelToCsvText(arrayBuffer) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch (error) {
    throw excelError('excel-unreadable', 'The Excel workbook could not be read.', error);
  }
  const sheet = pickSheet(workbook);
  if (!sheet) throw excelError('excel-no-sheet', 'The Excel workbook has no worksheets.');
  const rows = sheetToRows(sheet);
  return rows.length ? buildCsv(rows) : '';
}

/* ---------- Picking a file ---------- */

// jsdom's Blob has no arrayBuffer()/text(), so read through FileReader.
const readBlob = (blob, method) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('The file could not be read.'));
  reader[method](blob);
});

const startsWith = (bytes, magic) => magic.every((byte, index) => bytes[index] === byte);

/**
 * Detects the file type from its first bytes; the name/extension is ignored.
 * @param {Blob} file
 * @returns {Promise<'csv'|'xlsx'|'xls-legacy'|'unknown'>}
 */
export async function detectImportFileType(file) {
  const bytes = new Uint8Array(await readBlob(file.slice(0, SNIFF_BYTES), 'readAsArrayBuffer'));
  if (startsWith(bytes, ZIP_MAGIC)) return 'xlsx';
  if (startsWith(bytes, OLE_MAGIC)) return 'xls-legacy';
  return bytes.includes(0) ? 'unknown' : 'csv';
}

const getExtension = (fileName) => {
  const match = /\.[^./\\]+$/.exec(String(fileName || ''));
  return match ? match[0].toLowerCase() : '';
};

const SAVE_AS_HINT = 'Open it in Excel and use File → Save As → "Excel Workbook (*.xlsx)" or "CSV UTF-8 (Comma delimited) (*.csv)", then import the saved file.';

const FILE_ERRORS = {
  'read-failed': () => ({
    title: "The file couldn't be read",
    message: 'It may have been moved, or it is still open and locked by another program. Close it and try again.'
  }),
  'excel-legacy': (name) => ({
    title: "Old Excel format (.xls) isn't supported",
    message: `"${name}" is an Excel 97–2003 workbook (.xls) or a password-protected file. Remove any password, then save it in a newer format. ${SAVE_AS_HINT}`
  }),
  'unsupported-type': (name) => {
    const ext = getExtension(name);
    return {
      title: ext ? `Unsupported file type (${ext})` : 'Unsupported file type',
      message: `"${name}" is not a CSV or Excel file. Only .csv and .xlsx files are supported — download the template, fill it in and save it as .xlsx or CSV.`
    };
  },
  'excel-unreadable': (name) => ({
    title: "The Excel file couldn't be read",
    message: `"${name}" couldn't be opened as an Excel workbook. It may be damaged, password-protected or saved in another format (such as .xlsb or .ods). ${SAVE_AS_HINT}`
  }),
  'excel-no-sheet': (name) => ({
    title: 'The workbook has no sheets',
    message: `"${name}" doesn't contain a worksheet. Put your dishes on a sheet named "Menu" (or the first sheet) and save it again.`
  }),
  'excel-load-failed': () => ({
    title: "Excel support couldn't be loaded",
    message: 'Check your internet connection and try again, or save the file as CSV and import that instead.'
  })
};

const importFileError = (code, file) => ({ fileError: { code, ...FILE_ERRORS[code](file?.name || 'The file') } });

/**
 * Reads the picked import file (call after checkImportFile). CSV is read as
 * text; an .xlsx workbook is converted to the equivalent CSV text.
 *
 * @param {File} file
 * @returns {Promise<{ text: string, type: 'csv'|'xlsx' } | { fileError: { code: string, title: string, message: string } }>}
 *   fileError codes: read-failed, excel-legacy, unsupported-type,
 *   excel-unreadable, excel-no-sheet, excel-load-failed
 */
export async function readImportFile(file) {
  let type;
  try {
    type = await detectImportFileType(file);
  } catch {
    return importFileError('read-failed', file);
  }
  if (type === 'xls-legacy') return importFileError('excel-legacy', file);
  if (type === 'unknown') return importFileError('unsupported-type', file);

  if (type === 'csv') {
    try {
      return { text: await readBlob(file, 'readAsText'), type: 'csv' };
    } catch {
      return importFileError('read-failed', file);
    }
  }

  let buffer;
  try {
    buffer = await readBlob(file, 'readAsArrayBuffer');
  } catch {
    return importFileError('read-failed', file);
  }
  try {
    return { text: await excelToCsvText(buffer), type: 'xlsx' };
  } catch (error) {
    return importFileError(FILE_ERRORS[error?.code] ? error.code : 'excel-unreadable', file);
  }
}
