import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { buildMenuSheetRows, downloadMenu, getMenuExportFileName, hasExportableDishes } from './menuExport';
import { MENU_IMPORT_COLUMNS, buildCsv, validateMenuImport } from './menuImport';
import { EXCEL_TEMPLATE_HEADERS } from './menuImportExcel';

const categories = [
  {
    id: 1,
    name: 'Starters',
    items: [
      { id: 11, name: 'Chicken 65, Dry', price: 220, isVeg: false, availableBreakfast: false, availableLunch: true, availableDinner: 1, description: 'Spicy' },
      { id: 12, name: 'Paneer Tikka', price: '129.50', isVeg: 'true', availableBreakfast: 'true', availableLunch: 0, availableDinner: 'false' }
    ]
  },
  { id: 2, name: 'Empty', items: [] }
];

describe('menuExport', () => {
  it('builds one row per dish keyed by the import columns, skipping empty categories', () => {
    const rows = buildMenuSheetRows(categories);
    expect(rows).toEqual([
      { category: 'Starters', name: 'Chicken 65, Dry', price: 220, vegType: 'Non Veg', breakfast: 'No', lunch: 'Yes', dinner: 'Yes', description: 'Spicy' },
      { category: 'Starters', name: 'Paneer Tikka', price: 129.5, vegType: 'Veg', breakfast: 'Yes', lunch: 'No', dinner: 'No', description: '' }
    ]);
  });

  it('produces rows the menu importer accepts unchanged', () => {
    const rows = buildMenuSheetRows(categories);
    const csv = buildCsv([
      MENU_IMPORT_COLUMNS.map(col => col.label),
      ...rows.map(row => MENU_IMPORT_COLUMNS.map(col => row[col.key]))
    ]);
    const result = validateMenuImport(csv);
    expect(result.ok).toBe(true);
    expect(result.dishes[0]).toMatchObject({ name: 'Chicken 65, Dry', price: 220, isVeg: false, availableBreakfast: false, availableLunch: true, availableDinner: true });
    expect(result.dishes[1]).toMatchObject({ name: 'Paneer Tikka', price: 129.5, isVeg: true, availableBreakfast: true, availableLunch: false, availableDinner: false });
  });

  it('knows whether there is anything to export', () => {
    expect(hasExportableDishes(categories)).toBe(true);
    expect(hasExportableDishes([{ id: 2, name: 'Empty', items: [] }])).toBe(false);
    expect(hasExportableDishes(undefined)).toBe(false);
  });

  it('downloads an .xlsx workbook whose header and rows match the import format', async () => {
    let downloaded;
    // jsdom has no object URLs, so install stubs for the duration of the test.
    URL.createObjectURL = vi.fn(blob => { downloaded = blob; return 'blob:menu'; });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('sri-annapoorna-menu.xlsx');
    });

    try {
      await downloadMenu('excel', { categories, restaurantName: 'Sri Annapoorna' });
      expect(click).toHaveBeenCalledTimes(1);

      const workbook = new ExcelJS.Workbook();
      // jsdom's Blob has no arrayBuffer(); read it the old way.
      const buffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(downloaded);
      });
      await workbook.xlsx.load(buffer);
      const sheet = workbook.getWorksheet('Menu');
      expect(sheet.getRow(1).values.slice(1)).toEqual(EXCEL_TEMPLATE_HEADERS);
      expect(EXCEL_TEMPLATE_HEADERS).toEqual(['Category', 'Dish Name', 'Price', 'Veg Type', 'Breakfast', 'Lunch', 'Dinner', 'Description']);
      expect(sheet.getRow(2).values.slice(1)).toEqual(['Starters', 'Chicken 65, Dry', 220, 'Non Veg', 'No', 'Yes', 'Yes', 'Spicy']);
      expect(sheet.rowCount).toBe(3);
      expect(sheet.getCell('D2').dataValidation).toMatchObject({ type: 'list', formulae: ['"Veg,Non Veg"'] });
      // Every category on the menu (even an empty one) is offered in the Category dropdown.
      expect(sheet.getCell('A2').dataValidation).toMatchObject({ type: 'list', formulae: ['Lists!$A$1:$A$2'] });
      expect(workbook.getWorksheet('Lists').getColumn(1).values.slice(1)).toEqual(['Starters', 'Empty']);
    } finally {
      delete URL.createObjectURL;
      delete URL.revokeObjectURL;
      click.mockRestore();
    }
  });

  it('rejects an unknown format', async () => {
    await expect(downloadMenu('docx', { categories })).rejects.toThrow(/Unknown menu export format/);
  });

  it('names files after the restaurant', () => {
    expect(getMenuExportFileName('Sri Annapoorna Hotel', 'pdf')).toBe('sri-annapoorna-hotel-menu.pdf');
    expect(getMenuExportFileName('', 'xlsx')).toBe('menu.xlsx');
  });
});
