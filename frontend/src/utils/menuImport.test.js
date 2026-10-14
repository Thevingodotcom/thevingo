import { describe, it, expect } from 'vitest';
import {
  MAX_IMPORT_FILE_BYTES,
  TEMPLATE_HEADERS,
  buildCsv,
  buildDishesCsv,
  buildIssueReportCsv,
  buildTemplateCsv,
  checkImportFile,
  groupIssuesByRow,
  parseCsv,
  parsePrice,
  validateMenuImport
} from './menuImport';

const HEADER = TEMPLATE_HEADERS.join(',');
const csv = (...lines) => [HEADER, ...lines].join('\n');
const messages = (issues) => issues.map(i => `Row ${i.row}: ${i.message}`);

describe('parseCsv', () => {
  it('handles quoted fields with commas, escaped quotes and line breaks', () => {
    const { records } = parseCsv('a,"b, c","say ""hi"""\n"multi\nline",x,y\n');
    expect(records).toHaveLength(2);
    expect(records[0].fields).toEqual(['a', 'b, c', 'say "hi"']);
    expect(records[1].fields).toEqual(['multi\nline', 'x', 'y']);
    expect(records[1].row).toBe(2);
  });

  it('handles CRLF line endings and a BOM', () => {
    const { records } = parseCsv('﻿Category,Dish Name\r\nStarters,Soup\r\n');
    expect(records.map(r => r.fields)).toEqual([['Category', 'Dish Name'], ['Starters', 'Soup']]);
  });

  it('keeps blank lines so row numbers match the spreadsheet', () => {
    const { records } = parseCsv('h1,h2\n\nx,y');
    expect(records[2]).toMatchObject({ row: 3, fields: ['x', 'y'] });
  });

  it('reports an unclosed quote', () => {
    const { records } = parseCsv('a,b\n"open,c\nd,e');
    expect(records[1].errors[0]).toMatch(/never closed/);
  });

  it('detects semicolon-delimited files', () => {
    const { delimiter, records } = parseCsv('Category;Dish Name;Price\nA;B;10');
    expect(delimiter).toBe(';');
    expect(records[1].fields).toEqual(['A', 'B', '10']);
  });
});

describe('parsePrice', () => {
  it('accepts plain numbers and common currency formats', () => {
    expect(parsePrice('180').value).toBe(180);
    expect(parsePrice('₹ 99.50').value).toBe(99.5);
    expect(parsePrice('Rs. 1,200').value).toBe(1200);
    expect(parsePrice('250/-').value).toBe(250);
  });

  it('rejects non-numbers, negatives, zero and blanks', () => {
    expect(parsePrice('abc').error).toBe("Price 'abc' is not a number");
    expect(parsePrice('-20').error).toMatch(/cannot be negative/);
    expect(parsePrice('0').error).toMatch(/greater than 0/);
    expect(parsePrice('  ').error).toBe('Price is missing');
    expect(parsePrice('10.555').error).toMatch(/2 decimal places/);
  });

  it('rejects prices above the server limit of 99,999,999.99', () => {
    expect(parsePrice('99999999.99').value).toBe(99999999.99);
    expect(parsePrice('123456789').error).toBe("Price '123456789' is too large (max 99,999,999.99)");
    expect(parsePrice('100000000.00').error).toMatch(/too large/);
  });
});

describe('checkImportFile', () => {
  it('asks for a .csv or .xlsx file when nothing is picked', () => {
    const result = checkImportFile(null);
    expect(result.code).toBe('no-file');
    expect(result.message).toMatch(/\.csv or \.xlsx/);
  });

  it('does not judge the type by the extension (the content decides later)', () => {
    expect(checkImportFile({ name: 'menu.xlsx', size: 100 })).toBeNull();
    expect(checkImportFile({ name: 'menu.pdf', size: 100 })).toBeNull();
    expect(checkImportFile({ name: 'menu', size: 100 })).toBeNull();
    expect(checkImportFile({ name: 'MENU.CSV', size: 10 })).toBeNull();
  });

  it('rejects empty and oversized files', () => {
    expect(checkImportFile({ name: 'menu.csv', size: 0 }).code).toBe('empty-file');
    expect(checkImportFile({ name: 'menu.xlsx', size: MAX_IMPORT_FILE_BYTES + 1 }).code).toBe('too-large');
  });
});

describe('validateMenuImport', () => {
  it('parses a valid file into dishes and new categories', () => {
    const result = validateMenuImport(csv(
      'Main Course,Paneer Butter Masala,180,veg,1,1,1',
      '"Starters","Chicken 65, Dry",220,non_veg,0,1,1'
    ));
    expect(result.ok).toBe(true);
    expect(result.newCategories).toEqual(['Main Course', 'Starters']);
    expect(result.dishes[1]).toMatchObject({
      row: 3, categoryName: 'Starters', name: 'Chicken 65, Dry', price: 220, isVeg: false,
      availableBreakfast: false, availableLunch: true, availableDinner: true
    });
  });

  it('tolerates header case, whitespace, BOM and CRLF; optional columns default', () => {
    const result = validateMenuImport('﻿  category , DISH NAME,price \r\nDesserts,Gulab Jamun,60\r\n');
    expect(result.ok).toBe(true);
    expect(result.dishes[0]).toMatchObject({ name: 'Gulab Jamun', isVeg: true, availableBreakfast: true });
  });

  it('reports an empty file', () => {
    const result = validateMenuImport('');
    expect(result.ok).toBe(false);
    expect(result.fileErrors[0].code).toBe('empty-file');
  });

  it('reports a header-only file', () => {
    const result = validateMenuImport(`${HEADER}\r\n`);
    expect(result.fileErrors[0].code).toBe('no-rows');
  });

  it('lists missing columns with the expected and found headers', () => {
    const result = validateMenuImport('Category,Dish\nStarters,Soup');
    const [error] = result.fileErrors;
    expect(error.code).toBe('missing-columns');
    expect(error.missing).toEqual(['Price']);
    expect(error.found).toEqual(['Category', 'Dish']);
    expect(error.expected).toEqual(TEMPLATE_HEADERS);
    expect(result.dishes).toEqual([]);
  });

  it('hints when the first row looks like data instead of a header', () => {
    const result = validateMenuImport('Starters,Soup,120\nMains,Rice,90');
    expect(result.fileErrors[0].message).toMatch(/looks like dish data/);
  });

  it('reports per-row errors with spreadsheet row numbers and imports nothing', () => {
    const result = validateMenuImport(csv(
      'Starters,Soup,120,veg,1,1,1',
      ',Missing Category,100,veg,1,1,1',
      'Starters,,100,veg,1,1,1',
      'Starters,Bad Price,abc,veg,1,1,1',
      'Starters,Negative,-5,veg,1,1,1',
      'Starters,Bad Veg,100,vegan,1,1,1',
      'Starters,Bad Lunch,100,veg,1,2,1',
      'Starters,Too,Many,Columns,1,1,1,x,y'
    ));
    expect(result.ok).toBe(false);
    expect(result.dishes).toEqual([]);
    expect(messages(result.errors)).toEqual([
      'Row 3: Category is missing',
      'Row 4: Dish name is missing',
      "Row 5: Price 'abc' is not a number",
      "Row 6: Price '-5' cannot be negative",
      "Row 7: Veg type 'vegan' is not valid — use veg or non_veg",
      "Row 8: Lunch '2' is not valid — use 1 (available) or 0 (not available)",
      expect.stringMatching(/^Row 9: Row has 9 values but the header has 7 columns/)
    ]);
  });

  it('counts quoted multi-line values as one row', () => {
    const result = validateMenuImport(csv('Starters,"Soup\nof the day",abc,veg,1,1,1'));
    expect(messages(result.errors)).toEqual(["Row 2: Price 'abc' is not a number"]);
  });

  it('reports a too-large price as a row error', () => {
    const result = validateMenuImport(csv('Starters,Soup,120,veg,1,1,1', 'Starters,Gold Plate,123456789,veg,1,1,1'));
    expect(result.ok).toBe(false);
    expect(messages(result.errors)).toEqual(["Row 3: Price '123456789' is too large (max 99,999,999.99)"]);
    expect(result.dishes).toEqual([]);
  });

  it('skips duplicates within the file and leaves unchanged dishes out of the import', () => {
    const existing = [{ id: '7', name: 'Starters', items: [{ id: '1', name: 'Tomato Soup', price: 120 }] }];
    const result = validateMenuImport(csv(
      'starters,tomato soup,120,veg,1,1,1',
      'Starters,Paneer Tikka,200,veg,1,1,1',
      'Starters, Paneer  Tikka ,210,veg,1,1,1',
      'Drinks,Lime Soda,50,veg,1,1,1'
    ), { existingCategories: existing });
    expect(result.ok).toBe(true);
    expect(result.dishes.map(d => d.name)).toEqual(['Paneer Tikka', 'Lime Soda']);
    expect(result.dishes[0]).toMatchObject({ categoryId: '7', categoryName: 'Starters' });
    expect(result.newCategories).toEqual(['Drinks']);
    expect(result.priceChanges).toEqual([]);
    expect(result.unchangedCount).toBe(1);
    expect(messages(result.warnings)).toEqual([
      "Row 4: 'Paneer Tikka' in 'Starters' is listed again (first on row 3) — this row will be skipped"
    ]);
  });

  it('rejects binary (renamed Excel) content', () => {
    const result = validateMenuImport('PK\u0003\u0004\u0000\u0000binary');
    expect(result.fileErrors[0].code).toBe('binary-file');
  });
});

describe('validateMenuImport: comparison with the current menu', () => {
  const existing = [
    {
      id: '7',
      name: 'Main Course',
      items: [
        { id: '101', name: 'Paneer Butter Masala', price: 160 },
        { id: '102', name: 'Dal Makhani', price: '140.00' },
        { id: '103', name: 'Veg Pulao', price: 1100 }
      ]
    },
    { id: '8', name: 'Starters', items: [{ id: '201', name: 'Chicken 65', price: 220 }] }
  ];

  it('lists price changes with old and new price, using the existing dish for display', () => {
    const result = validateMenuImport(csv(
      'main course,  paneer butter   masala ,₹180,veg,1,1,1',
      'Main Course,Veg Pulao,"Rs. 1,200",veg,1,1,1',
      'STARTERS,chicken 65,199.5,non_veg,0,1,1'
    ), { existingCategories: existing });
    expect(result.ok).toBe(true);
    expect(result.priceChanges).toEqual([
      { row: 2, dishId: '101', name: 'Paneer Butter Masala', categoryName: 'Main Course', categoryId: '7', oldPrice: 160, newPrice: 180 },
      { row: 3, dishId: '103', name: 'Veg Pulao', categoryName: 'Main Course', categoryId: '7', oldPrice: 1100, newPrice: 1200 },
      { row: 4, dishId: '201', name: 'Chicken 65', categoryName: 'Starters', categoryId: '8', oldPrice: 220, newPrice: 199.5 }
    ]);
    expect(result.dishes).toEqual([]);
    expect(result.newCategories).toEqual([]);
    expect(result.unchangedCount).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it('counts dishes with the same price (compared to 2 decimals) as unchanged, without warnings', () => {
    const result = validateMenuImport(csv(
      'Main Course,Paneer Butter Masala,160.00,veg,1,1,1',
      'Main Course,Dal Makhani,140,veg,1,1,1',
      'Main Course,Veg Pulao,"1,100",veg,0,0,0'
    ), { existingCategories: existing });
    expect(result.ok).toBe(true);
    expect(result.priceChanges).toEqual([]);
    expect(result.dishes).toEqual([]);
    expect(result.unchangedCount).toBe(3);
    // Availability etc. of existing dishes is ignored, so no "not available" warning either.
    expect(result.warnings).toEqual([]);
  });

  it('treats a dish that exists in a different category as new for this category', () => {
    const result = validateMenuImport(csv('Starters,Paneer Butter Masala,180,veg,1,1,1'), { existingCategories: existing });
    expect(result.priceChanges).toEqual([]);
    expect(result.dishes).toHaveLength(1);
    expect(result.dishes[0]).toMatchObject({ name: 'Paneer Butter Masala', categoryId: '8', categoryName: 'Starters', price: 180 });
  });

  it('mixes price changes, new dishes and new categories', () => {
    const result = validateMenuImport(csv(
      'Main Course,Paneer Butter Masala,170,veg,1,1,1',
      'Main Course,Kadai Paneer,210,veg,1,1,1',
      'Drinks,Lime Soda,50,veg,1,1,1',
      'Main Course,Dal Makhani,140,veg,1,1,1'
    ), { existingCategories: existing });
    expect(result.priceChanges.map(c => [c.name, c.oldPrice, c.newPrice])).toEqual([['Paneer Butter Masala', 160, 170]]);
    expect(result.dishes.map(d => [d.name, d.categoryId])).toEqual([['Kadai Paneer', '7'], ['Lime Soda', null]]);
    expect(result.newCategories).toEqual(['Drinks']);
    expect(result.unchangedCount).toBe(1);
  });

  it('keeps the first row of a dish listed twice and warns about the rest', () => {
    const result = validateMenuImport(csv(
      'Main Course,Paneer Butter Masala,180,veg,1,1,1',
      'Main Course,paneer butter masala,999,veg,1,1,1'
    ), { existingCategories: existing });
    expect(result.priceChanges).toHaveLength(1);
    expect(result.priceChanges[0]).toMatchObject({ row: 2, newPrice: 180 });
    expect(messages(result.warnings)).toEqual([
      "Row 3: 'paneer butter masala' in 'Main Course' is listed again (first on row 2) — this row will be skipped"
    ]);
  });

  it('treats an existing dish without a usable price as a change with no old price', () => {
    const result = validateMenuImport(csv('Starters,Spring Roll,90,veg,1,1,1'), {
      existingCategories: [{ id: '8', name: 'Starters', items: [{ id: '202', name: 'Spring Roll', price: null }] }]
    });
    expect(result.priceChanges).toEqual([
      { row: 2, dishId: '202', name: 'Spring Roll', categoryName: 'Starters', categoryId: '8', oldPrice: null, newPrice: 90 }
    ]);
  });

  it('returns no price changes when the file has errors', () => {
    const result = validateMenuImport(csv(
      'Main Course,Paneer Butter Masala,180,veg,1,1,1',
      'Main Course,Dal Makhani,140,veg,1,1,1',
      'Main Course,Broken,abc,veg,1,1,1'
    ), { existingCategories: existing });
    expect(result.ok).toBe(false);
    expect(result.priceChanges).toEqual([]);
    expect(result.unchangedCount).toBe(0);
    expect(result.dishes).toEqual([]);
  });

  it('returns empty diff fields for file-level errors', () => {
    const result = validateMenuImport('Category,Dish\nStarters,Soup', { existingCategories: existing });
    expect(result.priceChanges).toEqual([]);
    expect(result.unchangedCount).toBe(0);
  });
});

describe('report helpers', () => {
  it('groups issues by row and caps the visible list', () => {
    const issues = Array.from({ length: 60 }, (_, i) => ({ row: Math.floor(i / 2) + 2, message: `m${i}` }));
    const { groups, hiddenCount } = groupIssuesByRow(issues, 50);
    expect(groups).toHaveLength(25);
    expect(groups[0].issues).toHaveLength(2);
    expect(hiddenCount).toBe(10);
  });

  it('escapes values when building CSV', () => {
    expect(buildCsv([['a,b', 'say "hi"', 'plain']])).toBe('"a,b","say ""hi""",plain\r\n');
  });

  it('builds an error report with row, column, severity and problem', () => {
    const result = validateMenuImport(csv('Starters,Soup,abc,veg,1,1,1'));
    const report = buildIssueReportCsv(result);
    expect(report.split('\r\n')[0]).toBe('Row,Column,Severity,Problem');
    expect(report).toContain("2,Price,error,Price 'abc' is not a number");
  });

  it('template and failed-rows CSVs round-trip through the validator', () => {
    expect(validateMenuImport(buildTemplateCsv()).ok).toBe(true);
    const { dishes } = validateMenuImport(buildTemplateCsv());
    const again = validateMenuImport(buildDishesCsv(dishes.map(dish => ({ dish, message: 'Server error, try again' }))));
    expect(again.ok).toBe(true);
    expect(again.warnings).toEqual([]);
    expect(again.dishes.map(d => d.name)).toEqual(dishes.map(d => d.name));
  });
});
