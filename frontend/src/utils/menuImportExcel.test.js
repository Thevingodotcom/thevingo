import { describe, it, expect, vi, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { MAX_IMPORT_ROWS, validateMenuImport } from './menuImport';
import {
  EXCEL_MIME_TYPE,
  EXCEL_TEMPLATE_HEADERS,
  IMPORT_FILE_ACCEPT,
  buildMenuWorkbookBlob,
  buildTemplateWorkbookBlob,
  detectImportFileType,
  excelToCsvText,
  readImportFile
} from './menuImportExcel';

// jsdom's Blob has no arrayBuffer(); read it the old way.
const readAsArrayBuffer = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsArrayBuffer(blob);
});

const loadWorkbook = async (blob) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readAsArrayBuffer(blob));
  return workbook;
};

/** Writes a workbook built by `fill` and returns its bytes. */
const workbookBytes = async (fill) => {
  const workbook = new ExcelJS.Workbook();
  fill(workbook);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
};

const LEGACY_XLS_BYTES = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
const GARBAGE_BYTES = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x00, 0x00, 0x00, 0x13]);

const dish = (overrides = {}) => ({
  category: 'Starters', name: 'Paneer Tikka', price: 129.5, vegType: 'Veg', breakfast: 'Yes', lunch: 'No', dinner: 'Yes', description: '', ...overrides
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildTemplateWorkbookBlob', () => {
  it('builds an .xlsx with the import headers, two sample dishes and dropdowns', async () => {
    const blob = await buildTemplateWorkbookBlob();
    expect(blob.type).toBe(EXCEL_MIME_TYPE);

    const workbook = await loadWorkbook(blob);
    const sheet = workbook.getWorksheet('Menu');
    expect(sheet.getRow(1).values.slice(1)).toEqual(['Category', 'Dish Name', 'Price', 'Veg Type', 'Breakfast', 'Lunch', 'Dinner', 'Description']);
    expect(sheet.getRow(1).getCell(1).font).toMatchObject({ bold: true, color: { argb: 'FFFFFFFF' } });
    expect(sheet.getRow(1).getCell(1).fill).toMatchObject({ fgColor: { argb: 'FFF05A28' } });
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet.getRow(2).values.slice(1, 8)).toEqual(['Main Course', 'Paneer Butter Masala', 180, 'Veg', 'Yes', 'Yes', 'Yes']);
    expect(sheet.getRow(3).values.slice(1, 8)).toEqual(['Starters', 'Chicken 65', 220, 'Non Veg', 'No', 'Yes', 'Yes']);

    const lastRow = MAX_IMPORT_ROWS + 1;
    ['D2', `D${lastRow}`].forEach(address => {
      expect(sheet.getCell(address).dataValidation).toMatchObject({ type: 'list', formulae: ['"Veg,Non Veg"'] });
    });
    ['E2', 'F50', `G${lastRow}`].forEach(address => {
      expect(sheet.getCell(address).dataValidation).toMatchObject({ type: 'list', formulae: ['"Yes,No"'], showErrorMessage: true });
    });
    expect(sheet.getCell('C2').dataValidation).toMatchObject({ type: 'decimal', operator: 'greaterThan', formulae: [0], showErrorMessage: true });
    expect(sheet.getCell('C2').dataValidation.error).toMatch(/greater than 0/);
    expect(sheet.getCell(`D${lastRow + 1}`).dataValidation).toBeUndefined();

    // No categories yet: no Category dropdown and no list sheet.
    expect(sheet.getCell('A2').dataValidation).toBeUndefined();
    expect(workbook.getWorksheet('Lists')).toBeUndefined();
  });

  it('keeps existing categories on a hidden sheet for a Category dropdown that still allows new names', async () => {
    const workbook = await loadWorkbook(await buildTemplateWorkbookBlob({
      existingCategories: [{ id: 1, name: 'Starters' }, { id: 2, name: ' starters ' }, { id: 3, name: '' }, 'Main Course', { id: 4, name: 'Desserts' }]
    }));
    const lists = workbook.getWorksheet('Lists');
    expect(lists.state).toBe('hidden');
    expect(lists.getColumn(1).values.slice(1)).toEqual(['Starters', 'Main Course', 'Desserts']);

    const validation = workbook.getWorksheet('Menu').getCell('A2').dataValidation;
    expect(validation).toMatchObject({ type: 'list', formulae: ['Lists!$A$1:$A$3'], errorStyle: 'information', showErrorMessage: true });
  });
});

describe('buildMenuWorkbookBlob + excelToCsvText', () => {
  it('round-trips into dishes the importer accepts', async () => {
    const blob = await buildMenuWorkbookBlob({
      rows: [
        dish({ description: 'Smoky, grilled' }),
        dish({ category: 'Main Course', name: 'Chicken Curry', price: 220, vegType: 'Non Veg', breakfast: 'No', lunch: 'Yes', dinner: 'No' })
      ],
      existingCategories: ['Starters']
    });
    const text = await excelToCsvText(await readAsArrayBuffer(blob));
    // The hidden "Lists" sheet is ignored.
    expect(text.split('\r\n')[0]).toBe(EXCEL_TEMPLATE_HEADERS.join(','));

    const result = validateMenuImport(text, { existingCategories: [{ id: 7, name: 'Starters', items: [] }] });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.dishes).toEqual([
      { row: 2, categoryName: 'Starters', categoryId: 7, name: 'Paneer Tikka', price: 129.5, isVeg: true, availableBreakfast: true, availableLunch: false, availableDinner: true, description: 'Smoky, grilled' },
      { row: 3, categoryName: 'Main Course', categoryId: null, name: 'Chicken Curry', price: 220, isVeg: false, availableBreakfast: false, availableLunch: true, availableDinner: false, description: '' }
    ]);
    expect(result.newCategories).toEqual(['Main Course']);
  });

  it('keeps blank rows so error messages use spreadsheet row numbers', async () => {
    const blob = await buildMenuWorkbookBlob({ rows: [dish(), {}, dish({ name: 'Veg Roll', price: 'abc' })] });
    const result = validateMenuImport(await excelToCsvText(await readAsArrayBuffer(blob)));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.objectContaining({ row: 4, column: 'Price', message: "Price 'abc' is not a number" })]);
  });

  it('turns rich text, formulas, hyperlinks, booleans, dates and errors into plain text', async () => {
    const bytes = await workbookBytes(workbook => {
      const sheet = workbook.addWorksheet('Menu');
      sheet.addRow(['Category', 'Dish Name', 'Price', 'Veg Type', 'Breakfast', 'Lunch', 'Dinner', 'Description']);
      sheet.addRow([
        { richText: [{ text: 'Star' }, { font: { bold: true }, text: 'ters' }] },
        { text: 'Paneer Tikka', hyperlink: 'https://example.com/paneer' },
        { formula: '0.1+0.2', result: 0.1 + 0.2 },
        'Veg',
        true,
        false,
        { formula: '1/0', result: { error: '#DIV/0!' } },
        new Date(Date.UTC(2026, 0, 15))
      ]);
      sheet.addRow(['Starters', 'Chicken 65', 129.50000000000003, { error: '#N/A' }]);
    });
    const text = await excelToCsvText(bytes.buffer);
    expect(text.split('\r\n')).toEqual([
      'Category,Dish Name,Price,Veg Type,Breakfast,Lunch,Dinner,Description',
      'Starters,Paneer Tikka,0.3,Veg,1,0,,2026-01-15',
      'Starters,Chicken 65,129.5,,,,,',
      ''
    ]);
  });

  it('reads the "Menu" sheet, else the first visible sheet', async () => {
    const menuSecond = await workbookBytes(workbook => {
      workbook.addWorksheet('Notes').addRow(['Read me']);
      workbook.addWorksheet('Menu').addRow(['Category']);
    });
    expect(await excelToCsvText(menuSecond.buffer)).toBe('Category\r\n');

    const hiddenFirst = await workbookBytes(workbook => {
      workbook.addWorksheet('Lists', { state: 'hidden' }).addRow(['Starters']);
      workbook.addWorksheet('Dishes').addRow(['Dish Name']);
    });
    expect(await excelToCsvText(hiddenFirst.buffer)).toBe('Dish Name\r\n');
  });

  it('returns empty text for an empty sheet', async () => {
    const bytes = await workbookBytes(workbook => { workbook.addWorksheet('Menu'); });
    expect(await excelToCsvText(bytes.buffer)).toBe('');
  });

  it('throws coded errors for unreadable workbooks', async () => {
    await expect(excelToCsvText(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]).buffer)).rejects.toMatchObject({ code: 'excel-unreadable' });
    const noSheets = await workbookBytes(() => {});
    await expect(excelToCsvText(noSheets.buffer)).rejects.toMatchObject({ code: 'excel-no-sheet' });
  });
});

describe('detectImportFileType', () => {
  it('recognises a workbook by its content, whatever its name', async () => {
    const bytes = await workbookBytes(workbook => { workbook.addWorksheet('Menu').addRow(['Category']); });
    expect(await detectImportFileType(new File([bytes], 'menu.xlsx'))).toBe('xlsx');
    expect(await detectImportFileType(new File([bytes], 'menu.csv'))).toBe('xlsx');
  });

  it('recognises the old .xls format', async () => {
    expect(await detectImportFileType(new File([LEGACY_XLS_BYTES], 'menu.xls'))).toBe('xls-legacy');
  });

  it('treats text as CSV even without a .csv extension', async () => {
    expect(await detectImportFileType(new File(['Category,Dish Name,Price\nStarters,Paneer Tikka,180\n'], 'menu'))).toBe('csv');
    expect(await detectImportFileType(new File(['Category;Dish Name;Price ₹\n'], 'menu.txt'))).toBe('csv');
  });

  it('flags binary files', async () => {
    expect(await detectImportFileType(new File([GARBAGE_BYTES], 'menu.csv'))).toBe('unknown');
  });
});

describe('readImportFile', () => {
  it('reads a CSV file as text', async () => {
    const text = 'Category,Dish Name,Price\r\nStarters,Paneer Tikka,180\r\n';
    expect(await readImportFile(new File([text], 'menu'))).toEqual({ text, type: 'csv' });
  });

  it('converts a workbook to CSV text', async () => {
    const blob = await buildTemplateWorkbookBlob();
    const result = await readImportFile(new File([await readAsArrayBuffer(blob)], 'template.xlsx'));
    expect(result.type).toBe('xlsx');
    expect(validateMenuImport(result.text)).toMatchObject({ ok: true, dataRowCount: 2 });
  });

  it('explains that .xls files must be saved as .xlsx or CSV', async () => {
    const { fileError } = await readImportFile(new File([LEGACY_XLS_BYTES], 'menu.xls'));
    expect(fileError).toMatchObject({ code: 'excel-legacy', title: "Old Excel format (.xls) isn't supported" });
    expect(fileError.message).toMatch(/Excel Workbook \(\*\.xlsx\)/);
    expect(fileError.message).toMatch(/CSV/);
  });

  it('rejects files that are neither CSV nor .xlsx', async () => {
    const { fileError } = await readImportFile(new File([GARBAGE_BYTES], 'menu.pdf'));
    expect(fileError).toMatchObject({ code: 'unsupported-type', title: 'Unsupported file type (.pdf)' });
    expect(fileError.message).toMatch(/Only \.csv and \.xlsx/);
  });

  it('reports a damaged workbook', async () => {
    const { fileError } = await readImportFile(new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9, 9])], 'menu.xlsx'));
    expect(fileError.code).toBe('excel-unreadable');
    expect(fileError.message).toMatch(/damaged|password/);
  });

  it('reports a workbook without sheets', async () => {
    const bytes = await workbookBytes(() => {});
    const { fileError } = await readImportFile(new File([bytes], 'menu.xlsx'));
    expect(fileError.code).toBe('excel-no-sheet');
  });

  it('reports a file that cannot be read', async () => {
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function () {
      setTimeout(() => this.onerror(new Event('error')));
    });
    const { fileError } = await readImportFile(new File(['Category\n'], 'menu.csv'));
    expect(fileError).toEqual({
      code: 'read-failed',
      title: "The file couldn't be read",
      message: 'It may have been moved, or it is still open and locked by another program. Close it and try again.'
    });
  });
});

describe('IMPORT_FILE_ACCEPT', () => {
  it('lists CSV and Excel workbook types', () => {
    const accepted = IMPORT_FILE_ACCEPT.split(',');
    expect(accepted).toEqual(expect.arrayContaining(['.csv', 'text/csv', '.xlsx', EXCEL_MIME_TYPE, '.xlsm']));
  });
});
