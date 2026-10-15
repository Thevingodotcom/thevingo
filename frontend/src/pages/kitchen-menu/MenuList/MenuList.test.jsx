import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import MenuList from './MenuList';
import { buildTemplateWorkbookBlob } from '../../../utils/menuImportExcel';
import { downloadBlob } from '../../../utils/download';

// Only the template builder is mocked; file detection/parsing stays real.
vi.mock('../../../utils/menuImportExcel', async (importOriginal) => ({
  ...(await importOriginal()),
  buildTemplateWorkbookBlob: vi.fn(async () => new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
}));
// jsdom has no URL.createObjectURL; record downloads instead.
vi.mock('../../../utils/download', () => ({ downloadBlob: vi.fn() }));
// Dish backup status is covered in MenuListTrash.test.jsx; here it is
// "unavailable" (today's behaviour) so no extra fetch call is made.
const dishBackupStub = vi.hoisted(() => ({
  status: 'ready', available: false, enabled: false, retentionDays: 30, trashCount: 0, error: '',
  reload: () => {}, save: async () => {}, setTrashCount: () => {}
}));
vi.mock('../../../app/useDishBackup', () => ({
  useDishBackup: () => dishBackupStub,
  default: () => dishBackupStub
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockCategories = [
  {
    id: '1',
    name: 'Biriyani',
    items: [
      {
        id: '101',
        name: 'Hyderabadi Chicken Biriyani',
        price: 280,
        isVeg: false,
        image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300',
        description: 'Authentic dum biriyani with aromatic spices',
        availableBreakfast: false,
        availableLunch: true,
        availableDinner: true
      }
    ]
  }
];

describe('MenuList Dish Details and Edit Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens dish details modal when a dish card is clicked', () => {
    const setCategories = vi.fn();
    render(<MenuList categories={mockCategories} setCategories={setCategories} />);

    // Verify dish name is rendered in card
    expect(screen.getByText('Hyderabadi Chicken Biriyani')).toBeInTheDocument();
    expect(screen.getByText('280 Rs')).toBeInTheDocument();

    // Click on the food card
    const foodCard = screen.getByText('Hyderabadi Chicken Biriyani').closest('article');
    fireEvent.click(foodCard);

    // Verify Details modal opens
    expect(screen.getByText('Dish details')).toBeInTheDocument();
    expect(screen.getByText('Authentic dum biriyani with aromatic spices')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit dish/i })).toBeInTheDocument();
  });

  it('opens edit form populated with dish data and saves changes', async () => {
    let categoriesState = [...mockCategories];
    const setCategories = vi.fn((updater) => {
      if (typeof updater === 'function') {
        categoriesState = updater(categoriesState);
      } else {
        categoriesState = updater;
      }
    });

    render(<MenuList categories={categoriesState} setCategories={setCategories} />);

    // Click on the food card to open details
    const foodCard = screen.getByText('Hyderabadi Chicken Biriyani').closest('article');
    fireEvent.click(foodCard);

    // Click "Edit dish" button in details modal
    const editBtn = screen.getByRole('button', { name: /Edit dish/i });
    fireEvent.click(editBtn);

    // Verify Edit modal opens with populated inputs
    expect(screen.getByText('Edit dish')).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText(/Enter dish name/i);
    const priceInput = screen.getByPlaceholderText('0');
    const descInput = screen.getByPlaceholderText(/Describe the dish ingredients/i);

    expect(nameInput.value).toBe('Hyderabadi Chicken Biriyani');
    expect(priceInput.value).toBe('280');
    expect(descInput.value).toBe('Authentic dum biriyani with aromatic spices');

    // Change fields
    fireEvent.change(nameInput, { target: { value: 'Special Hyderabadi Dum Biriyani' } });
    fireEvent.change(priceInput, { target: { value: '310' } });

    // Mock API success response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        dish: {
          id: '101',
          name: 'Special Hyderabadi Dum Biriyani',
          price: 310,
          categoryId: '1',
          isVeg: false,
          image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300',
          description: 'Authentic dum biriyani with aromatic spices',
          availableBreakfast: false,
          availableLunch: true,
          availableDinner: true
        }
      })
    });

    // Save changes
    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(setCategories).toHaveBeenCalled();
    });
  });

  it('discards unsaved edits when Cancel is clicked', () => {
    const setCategories = vi.fn();
    render(<MenuList categories={mockCategories} setCategories={setCategories} />);

    // Click on food card
    const foodCard = screen.getByText('Hyderabadi Chicken Biriyani').closest('article');
    fireEvent.click(foodCard);

    // Open edit
    const editBtn = screen.getByRole('button', { name: /Edit dish/i });
    fireEvent.click(editBtn);

    const nameInput = screen.getByPlaceholderText(/Enter dish name/i);
    fireEvent.change(nameInput, { target: { value: 'Cancelled Biriyani' } });

    // Click cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Edit modal should close (Save changes button is no longer visible)
    expect(screen.queryByRole('button', { name: /Save changes/i })).not.toBeInTheDocument();
    // And details modal is back
    expect(screen.getByText('Dish details')).toBeInTheDocument();
  });

  it('shows a single Edit action in dish details and a single action bar in the edit form', () => {
    render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);
    fireEvent.click(screen.getByText('Hyderabadi Chicken Biriyani').closest('article'));
    expect(screen.getAllByRole('button', { name: /Edit/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Edit dish/i }));
    expect(screen.getAllByRole('button', { name: /Save changes/i })).toHaveLength(1);
    // Native file input text is gone; one styled chooser instead.
    expect(screen.queryByText(/Keep current image/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change image/i })).toBeInTheDocument();
  });

  it('sends remove_image=true when the existing image is removed while editing', async () => {
    render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);
    fireEvent.click(screen.getByText('Hyderabadi Chicken Biriyani').closest('article'));
    fireEvent.click(screen.getByRole('button', { name: /Edit dish/i }));

    fireEvent.click(screen.getByRole('button', { name: /Remove image/i }));
    expect(screen.getByRole('button', { name: /Choose image/i })).toBeInTheDocument();

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ dish: { id: '101', image: null } }) });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = mockFetch.mock.calls[0][1].body;
    expect(body.get('remove_image')).toBe('true');
    expect(body.has('image')).toBe(false);
  });

  it('does not send an image field when the edited image is untouched', async () => {
    render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);
    fireEvent.click(screen.getByText('Hyderabadi Chicken Biriyani').closest('article'));
    fireEvent.click(screen.getByRole('button', { name: /Edit dish/i }));

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ dish: { id: '101' } }) });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = mockFetch.mock.calls[0][1].body;
    expect(body.has('image')).toBe(false);
    expect(body.has('remove_image')).toBe(false);
  });

  it('creates a dish without an image field when no image is chosen', async () => {
    render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Add Action'));
    fireEvent.click(screen.getByRole('button', { name: 'Item' }));

    expect(screen.queryByText(/No file chosen/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Enter dish name/i), { target: { value: 'Veg Pulao' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '150' } });

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ dish: { id: '202', name: 'Veg Pulao' } }) });
    fireEvent.click(screen.getByRole('button', { name: /Save dish/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = mockFetch.mock.calls[0][1].body;
    expect(body.get('name')).toBe('Veg Pulao');
    expect(body.has('image')).toBe(false);
  });

  it('asks for confirmation (with dish count) before deleting a category', async () => {
    let categoriesState = [...mockCategories];
    const setCategories = vi.fn((updater) => {
      categoriesState = typeof updater === 'function' ? updater(categoriesState) : updater;
    });
    render(<MenuList categories={categoriesState} setCategories={setCategories} />);

    const optionsBtn = screen.getByText('Biriyani', { selector: 'h3' }).parentElement.querySelector('.category-options-btn');
    fireEvent.click(optionsBtn);
    fireEvent.click(screen.getByRole('button', { name: /Delete category/i }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Biriyani');
    expect(dialog).toHaveTextContent(/1 dish in this category/i);

    // Cancel does not delete
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();

    // Confirm deletes
    fireEvent.click(optionsBtn);
    fireEvent.click(screen.getByRole('button', { name: /Delete category/i }));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/menu/categories/1'), expect.objectContaining({ method: 'DELETE' }));
      expect(categoriesState).toHaveLength(0);
    });
  });

  it('always offers Import menu, even when dishes exist', () => {
    render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Import menu/i }));
    expect(screen.getByText(/Import Menu from Excel\/CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/added to your current menu/i)).toBeInTheDocument();
  });

  describe('Import menu', () => {
    // mockClear (clearAllMocks) keeps queued *Once implementations; reset them.
    beforeEach(() => mockFetch.mockReset());

    const HEADER = 'Category,Dish Name,Price,Veg Type (veg/non_veg),Breakfast (1/0),Lunch (1/0),Dinner (1/0)';
    const csvFile = (lines, name = 'menu.csv') => new File([[HEADER, ...lines].join('\r\n')], name, { type: 'text/csv' });
    const okDish = (id, name) => ({ ok: true, status: 201, json: async () => ({ success: true, dish: { id, name, price: 100, isVeg: true } }) });
    const okCategory = (id, name) => ({ ok: true, status: 201, json: async () => ({ success: true, category: { id, name, items: [] } }) });
    const okPrices = (dishes) => ({ ok: true, status: 200, json: async () => ({ success: true, updated: dishes.length, message: 'Prices updated', dishes }) });

    const openAndPick = (file, categories = mockCategories, setCategories = vi.fn()) => {
      render(<MenuList categories={categories} setCategories={setCategories} />);
      fireEvent.click(screen.getByRole('button', { name: /Import menu/i }));
      fireEvent.change(screen.getByTestId('menu-import-input'), { target: { files: [file] } });
      return setCategories;
    };
    // The review screen always comes first; nothing is sent until Apply is clicked.
    const approve = async (options) => {
      const button = await screen.findByRole('button', { name: /^Apply \d+ changes?$/ }, options);
      fireEvent.click(button);
    };
    const stateful = (initial) => {
      const ref = { state: initial };
      ref.setCategories = vi.fn(updater => { ref.state = typeof updater === 'function' ? updater(ref.state) : updater; });
      return ref;
    };

    // Menu used by the review / price-change tests.
    const richMenu = [
      {
        id: '1',
        name: 'Biriyani',
        items: [
          { id: '101', name: 'Hyderabadi Chicken Biriyani', price: 280, isVeg: false },
          { id: '102', name: 'Veg Biriyani', price: 200, isVeg: true }
        ]
      },
      { id: '2', name: 'Starters', items: [{ id: '201', name: 'Paneer Tikka', price: 180, isVeg: true }] }
    ];
    const mixedFile = () => csvFile([
      'biriyani,  hyderabadi chicken   biriyani,₹300,non_veg,0,1,1',
      'Starters,Paneer Tikka,165,veg,1,1,1',
      'Biriyani,Veg Biriyani,200,veg,0,1,1',
      'Biriyani,Egg Biriyani,150,non_veg,0,1,1',
      'Drinks,Lime Soda,50,veg,1,1,1'
    ]);

    it('shows a blocking loading screen with progress while importing', async () => {
      let resolveFirst;
      mockFetch
        .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
        .mockResolvedValueOnce(okDish('302', 'Veg Biriyani'));

      openAndPick(csvFile(['Biriyani,Mutton Biriyani,320,non_veg,0,1,1', 'Biriyani,Veg Biriyani,200,veg,0,1,1']));
      await approve();

      expect(await screen.findByText('0 of 2 dishes')).toBeInTheDocument();
      expect(screen.getByText('Applying changes…')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: /Import progress/i })).toHaveAttribute('aria-valuemax', '2');
      expect(screen.getByText('Adding dishes').closest('li')).toHaveAttribute('aria-current', 'step');
      expect(screen.getByText('Updating prices').closest('li')).toHaveTextContent('none needed');
      expect(screen.getByRole('button', { name: /Close import dialog/i })).toBeDisabled();
      expect(screen.queryByTestId('menu-import-input')).not.toBeInTheDocument();

      resolveFirst(okDish('301', 'Mutton Biriyani'));
      expect(await screen.findByText('Added 2 dishes')).toBeInTheDocument();
      expect(screen.getByText('Menu updated')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Close import dialog/i })).not.toBeDisabled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ name: 'Mutton Biriyani', price: 320, categoryId: '1', isVeg: false, availableBreakfast: false });
    });

    it('shows detailed validation errors and makes no API calls', async () => {
      openAndPick(csvFile([
        'Biriyani,Mutton Biriyani,abc,non_veg,0,1,1',
        ',No Category,100,veg,1,1,1',
        'Biriyani,Egg Biriyani,150,eggy,1,1,1'
      ]));

      expect(await screen.findByText('Found 3 problems in 3 rows')).toBeInTheDocument();
      const list = screen.getByRole('list', { name: /Problems found in the file/i });
      expect(list).toHaveTextContent("Row 2Price 'abc' is not a number");
      expect(list).toHaveTextContent('Row 3Category is missing');
      expect(list).toHaveTextContent("Row 4Veg type 'eggy' is not valid");
      expect(screen.getByText(/nothing was imported/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Download error report/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Download sample CSV template/i })).toBeInTheDocument();
      expect(screen.getByText('Choose another file')).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('lists missing columns with the expected header row', async () => {
      openAndPick(new File(['Category,Dish\r\nBiriyani,Veg Biriyani\r\n'], 'menu.csv', { type: 'text/csv' }));

      expect(await screen.findByText('Missing required column: Price')).toBeInTheDocument();
      expect(screen.getAllByText(HEADER).length).toBeGreaterThan(0);
      expect(screen.getByText('Dish', { selector: '.menu-import-chip' })).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    const xlsxFile = async (rows, name = 'menu.xlsx') => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Menu');
      rows.forEach(row => sheet.addRow(row));
      const buffer = await workbook.xlsx.writeBuffer();
      return new File([buffer], name);
    };

    it('explains both formats in the instructions and accepts .csv and .xlsx', () => {
      render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /Import menu/i }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('Download the template (Excel or CSV).');
      expect(dialog).toHaveTextContent(/pick Veg Type and availability from the dropdowns/);
      expect(dialog).toHaveTextContent(/the file type is detected automatically/);
      expect(dialog).toHaveTextContent(/only the price is updated/);
      expect(dialog).not.toHaveTextContent(/save .* as .*\.csv/i);
      expect(screen.getByText('Choose File')).toBeInTheDocument();
      expect(screen.getByText(/\.csv or \.xlsx up to 2 MB/)).toBeInTheDocument();
      const accept = screen.getByTestId('menu-import-input').getAttribute('accept');
      expect(accept).toContain('.csv');
      expect(accept).toContain('.xlsx');
    });

    describe('template download menu', () => {
      let downloads;
      let clickSpy;
      beforeEach(() => {
        downloads = [];
        clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordDownload() {
          downloads.push(this.getAttribute('download'));
        });
      });
      afterEach(() => clickSpy.mockRestore());

      const openMenu = () => {
        render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Import menu/i }));
        const button = screen.getByRole('button', { name: /Download template/i });
        expect(button).toHaveAttribute('aria-haspopup', 'menu');
        expect(button).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(button);
        return button;
      };

      it('offers Excel (first) and CSV, and Escape closes only the menu', () => {
        const button = openMenu();
        expect(button).toHaveAttribute('aria-expanded', 'true');
        const items = screen.getAllByRole('menuitem');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent('Excel template (.xlsx)');
        expect(items[0]).toHaveTextContent(/Dropdowns for veg type & availability/);
        expect(items[1]).toHaveTextContent('CSV template (.csv)');
        expect(items[0]).toHaveFocus();

        fireEvent.keyDown(items[0], { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // With the menu closed, Escape closes the dialog as before.
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      it('closes the menu on an outside click', () => {
        openMenu();
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByText('Instructions:'));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('downloads the CSV template', () => {
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: /CSV template/i }));
        expect(downloads).toEqual(['vingo_menu_template.csv']);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(buildTemplateWorkbookBlob).not.toHaveBeenCalled();
      });

      it('builds and downloads the Excel template with the current categories', async () => {
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: /Excel template/i }));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
        expect(buildTemplateWorkbookBlob).toHaveBeenCalledWith({ existingCategories: ['Biriyani'] });
        expect(downloadBlob.mock.calls[0][0]).toBeInstanceOf(Blob);
        expect(downloadBlob.mock.calls[0][1]).toBe('vingo_menu_template.xlsx');
        expect(await screen.findByRole('button', { name: /Download template/i })).toBeInTheDocument();
        expect(downloads).toEqual([]);
      });

      it('keeps the template links working on the problems screen', async () => {
        render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Import menu/i }));
        fireEvent.change(screen.getByTestId('menu-import-input'), { target: { files: [csvFile(['Biriyani,Mutton Biriyani,abc,non_veg,0,1,1'])] } });

        fireEvent.click(await screen.findByRole('button', { name: /Download sample CSV template/i }));
        expect(downloads).toEqual(['vingo_menu_template.csv']);

        fireEvent.click(screen.getByRole('button', { name: /Download Excel template/i }));
        await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'vingo_menu_template.xlsx'));
      });

      it('shows an inline error when the Excel template cannot be built', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        buildTemplateWorkbookBlob.mockRejectedValueOnce(new Error('chunk failed'));
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: /Excel template/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/Excel template couldn't be created/);
        expect(downloadBlob).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        consoleSpy.mockRestore();
      });
    });

    it('imports dishes from a real .xlsx workbook', async () => {
      mockFetch
        .mockResolvedValueOnce(okDish('301', 'Mutton Biriyani'))
        .mockResolvedValueOnce(okDish('302', 'Veg Biriyani'));
      const file = await xlsxFile([
        ['Category', 'Dish Name', 'Price', 'Veg Type', 'Breakfast', 'Lunch', 'Dinner'],
        ['Biriyani', 'Mutton Biriyani', 320, 'Non Veg', 'No', 'Yes', 'Yes'],
        ['Biriyani', 'Veg Biriyani', 200, 'Veg', 'Yes', 'Yes', 'No']
      ]);

      openAndPick(file);
      await approve({ timeout: 5000 });

      expect(await screen.findByText('Added 2 dishes')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
        name: 'Mutton Biriyani', price: 320, categoryId: '1', isVeg: false,
        availableBreakfast: false, availableLunch: true, availableDinner: true
      });
      expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toMatchObject({
        name: 'Veg Biriyani', price: 200, isVeg: true,
        availableBreakfast: true, availableLunch: true, availableDinner: false
      });
    });

    it('imports a CSV file that has no extension', async () => {
      mockFetch.mockResolvedValueOnce(okDish('301', 'Mutton Biriyani'));
      openAndPick(new File([[HEADER, 'Biriyani,Mutton Biriyani,320,non_veg,0,1,1'].join('\r\n')], 'menu'));
      await approve();

      expect(await screen.findByText('Added 1 dish')).toBeInTheDocument();
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ name: 'Mutton Biriyani', price: 320 });
    });

    it('rejects a legacy .xls workbook without calling the API', async () => {
      const oleHeader = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
      const bytes = new Uint8Array(512);
      bytes.set(oleHeader);
      openAndPick(new File([bytes], 'menu.xls'));

      expect(await screen.findByText("This file can't be imported")).toBeInTheDocument();
      expect(screen.getByText(/Old Excel format \(\.xls\)/)).toBeInTheDocument();
      expect(screen.getByText(/save it and choose it again/)).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('continues after a failed row and reports each failure with the server message', async () => {
      mockFetch
        .mockResolvedValueOnce(okDish('301', 'Mutton Biriyani'))
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ success: false, message: 'Name, price, and category are required.' }) })
        .mockResolvedValueOnce(okDish('303', 'Prawn Biriyani'));
      const menu = stateful([...mockCategories]);

      openAndPick(csvFile([
        'Biriyani,Mutton Biriyani,320,non_veg,0,1,1',
        'Biriyani,Veg Biriyani,200,veg,0,1,1',
        'Biriyani,Prawn Biriyani,350,non_veg,0,1,1'
      ]), mockCategories, menu.setCategories);
      await approve();

      expect(await screen.findByText('Added 2 of 3 dishes')).toBeInTheDocument();
      expect(screen.getByText('Import finished with problems')).toBeInTheDocument();
      const failed = screen.getByRole('list', { name: /Rows that failed/i });
      expect(failed).toHaveTextContent('Row 3Veg Biriyani (Biriyani): Name, price, and category are required.');
      expect(screen.getByRole('button', { name: /Download rows not imported/i })).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(menu.state[0].items.map(item => item.name)).toEqual(['Hyderabadi Chicken Biriyani', 'Mutton Biriyani', 'Prawn Biriyani']);
    });

    it('stops and reports clearly when the connection is lost', async () => {
      mockFetch
        .mockResolvedValueOnce(okDish('301', 'Mutton Biriyani'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));

      openAndPick(csvFile([
        'Biriyani,Mutton Biriyani,320,non_veg,0,1,1',
        'Biriyani,Veg Biriyani,200,veg,0,1,1',
        'Biriyani,Prawn Biriyani,350,non_veg,0,1,1'
      ]));
      await approve();

      expect(await screen.findByText('Added 1 of 3 dishes')).toBeInTheDocument();
      expect(screen.getByText('Import stopped')).toBeInTheDocument();
      expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
      expect(screen.getByText(/2 dishes were not sent/)).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('creates missing categories first and does not resend dishes whose price is unchanged', async () => {
      mockFetch
        .mockResolvedValueOnce(okCategory('9', 'Drinks'))
        .mockResolvedValueOnce(okDish('401', 'Lime Soda'));

      openAndPick(csvFile([
        'Biriyani,hyderabadi chicken biriyani,280,non_veg,0,1,1',
        'Drinks,Lime Soda,50,veg,1,1,1'
      ]));

      expect(await screen.findByTestId('menu-import-count-unchanged')).toHaveTextContent('Unchanged dishes1');
      await approve();

      expect(await screen.findByText('Added 1 dish (1 new category)')).toBeInTheDocument();
      expect(screen.getByText(/1 new category created: Drinks/)).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/menu\/categories$/);
      expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toMatchObject({ name: 'Lime Soda', categoryId: '9' });
    });

    describe('review before applying', () => {
      it('shows counts, old and new prices and new dishes, and sends nothing before approval', async () => {
        openAndPick(mixedFile(), richMenu);

        expect(await screen.findByText('Review changes')).toBeInTheDocument();
        expect(screen.getByText('4 changes to apply')).toBeInTheDocument();
        expect(screen.getByTestId('menu-import-count-prices')).toHaveTextContent('Price changes2');
        expect(screen.getByTestId('menu-import-count-dishes')).toHaveTextContent('New dishes2');
        expect(screen.getByTestId('menu-import-count-categories')).toHaveTextContent('New categories1');
        expect(screen.getByTestId('menu-import-count-unchanged')).toHaveTextContent('Unchanged dishes1');

        const prices = screen.getByRole('table', { name: /Price changes/i });
        const [, chickenRow, paneerRow] = within(prices).getAllByRole('row');
        expect(chickenRow).toHaveTextContent('Hyderabadi Chicken Biriyani');
        expect(chickenRow).toHaveTextContent('Biriyani');
        expect(chickenRow).toHaveTextContent('280 Rs300 Rs▲ +20 Rs');
        expect(paneerRow).toHaveTextContent('Paneer Tikka');
        expect(paneerRow).toHaveTextContent('180 Rs165 Rs▼ −15 Rs');

        const fresh = screen.getByRole('table', { name: /New dishes/i });
        const [, eggRow, sodaRow] = within(fresh).getAllByRole('row');
        expect(eggRow).toHaveTextContent('Egg Biriyani');
        expect(eggRow).toHaveTextContent('150 Rs');
        expect(eggRow).not.toHaveTextContent('New category');
        expect(sodaRow).toHaveTextContent('Lime Soda');
        expect(sodaRow).toHaveTextContent('DrinksNew category');

        expect(screen.getByText(/Only prices are updated for dishes already on your menu/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply 4 changes' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
        expect(screen.getByRole('button', { name: /Close import dialog/i })).not.toBeDisabled();
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('Cancel goes back to choosing a file without sending anything', async () => {
        const setCategories = openAndPick(mixedFile(), richMenu);
        fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

        expect(screen.getByText('Choose File')).toBeInTheDocument();
        expect(screen.queryByText('Review changes')).not.toBeInTheDocument();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(setCategories).not.toHaveBeenCalled();
      });

      it('Apply updates prices in one PATCH, then creates categories and dishes, and updates the menu', async () => {
        mockFetch
          .mockResolvedValueOnce(okPrices([{ id: '101', price: 300 }, { id: '201', price: 165 }]))
          .mockResolvedValueOnce(okCategory('9', 'Drinks'))
          .mockResolvedValueOnce(okDish('103', 'Egg Biriyani'))
          .mockResolvedValueOnce(okDish('401', 'Lime Soda'));
        const menu = stateful(richMenu);

        openAndPick(mixedFile(), richMenu, menu.setCategories);
        await approve();

        expect(await screen.findByText('Updated 2 prices · Added 2 dishes (1 new category)')).toBeInTheDocument();
        expect(screen.getByText('Menu updated')).toBeInTheDocument();

        expect(mockFetch).toHaveBeenCalledTimes(4);
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toMatch(/\/api\/menu\/dishes\/prices$/);
        expect(init.method).toBe('PATCH');
        expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: expect.stringMatching(/^Bearer /) });
        expect(JSON.parse(init.body)).toEqual({ updates: [{ id: '101', price: 300 }, { id: '201', price: 165 }] });
        expect(mockFetch.mock.calls[1][0]).toMatch(/\/api\/menu\/categories$/);
        expect(mockFetch.mock.calls.slice(2).map(([, req]) => JSON.parse(req.body).name)).toEqual(['Egg Biriyani', 'Lime Soda']);
        expect(mockFetch.mock.calls.filter(([, req]) => req.method === 'PATCH')).toHaveLength(1);

        const [biriyani, starters, drinks] = menu.state;
        expect(biriyani.items.map(item => [item.name, item.price])).toEqual([
          ['Hyderabadi Chicken Biriyani', 300], ['Veg Biriyani', 200], ['Egg Biriyani', 100]
        ]);
        expect(starters.items[0]).toMatchObject({ id: '201', price: 165 });
        expect(drinks).toMatchObject({ id: '9', name: 'Drinks' });
        expect(drinks.items.map(item => item.name)).toEqual(['Lime Soda']);
      });

      it('shows the "Updating prices" step and updates only prices when there are no new dishes', async () => {
        let resolvePrices;
        mockFetch.mockImplementationOnce(() => new Promise(resolve => { resolvePrices = resolve; }));
        const menu = stateful(richMenu);

        openAndPick(csvFile(['Starters,Paneer Tikka,190,veg,1,1,1']), richMenu, menu.setCategories);
        await approve();

        const step = await screen.findByText('Updating prices');
        expect(step.closest('li')).toHaveAttribute('aria-current', 'step');
        expect(step.closest('li')).toHaveTextContent('1 price');

        resolvePrices(okPrices([{ id: '201', price: 190 }]));
        expect(await screen.findByText('Updated 1 price')).toBeInTheDocument();
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(menu.state[1].items[0].price).toBe(190);
      });

      it('stops everything when the price update fails, and says nothing was changed', async () => {
        const message = 'Some dishes were not found on your menu. Nothing was changed.';
        mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ success: false, message, missingIds: ['201'] }) });
        const setCategories = vi.fn();

        openAndPick(mixedFile(), richMenu, setCategories);
        await approve();

        expect(await screen.findByText("Prices couldn't be updated — nothing was changed")).toBeInTheDocument();
        expect(screen.getByText(message)).toBeInTheDocument();
        expect(screen.getByText(/None of the 2 prices were updated and no categories or dishes were added/)).toBeInTheDocument();
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(setCategories).not.toHaveBeenCalled();

        // Retrying sends the same approved changes again.
        mockFetch
          .mockResolvedValueOnce(okPrices([{ id: '101', price: 300 }, { id: '201', price: 165 }]))
          .mockResolvedValueOnce(okCategory('9', 'Drinks'))
          .mockResolvedValueOnce(okDish('103', 'Egg Biriyani'))
          .mockResolvedValueOnce(okDish('401', 'Lime Soda'));
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText('Updated 2 prices · Added 2 dishes (1 new category)')).toBeInTheDocument();
        expect(mockFetch).toHaveBeenCalledTimes(5);
      });

      it('says the menu is already up to date when nothing changed, without an Apply button', async () => {
        openAndPick(csvFile([
          'Biriyani,Hyderabadi Chicken Biriyani,280.00,non_veg,0,1,1',
          'Starters,paneer tikka,180,veg,1,1,1'
        ]), richMenu);

        expect(await screen.findByText('Your menu is already up to date — no changes found in this file.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Apply/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
        expect(screen.getByText('Choose another file')).toBeInTheDocument();
        expect(mockFetch).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      it('catches a price above the server limit before the review screen', async () => {
        openAndPick(csvFile(['Biriyani,Gold Biriyani,123456789,veg,0,1,1']));

        expect(await screen.findByText('Found 1 problem in 1 row')).toBeInTheDocument();
        expect(screen.getByRole('list', { name: /Problems found in the file/i })).toHaveTextContent("Price '123456789' is too large (max 99,999,999.99)");
        expect(screen.queryByText('Review changes')).not.toBeInTheDocument();
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });
  });

  it('shows removable active-filter chips with a Clear all action', () => {
    render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);
    expect(screen.queryByText(/Clear all/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filter dishes/i }));
    fireEvent.click(screen.getByLabelText('Veg'));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));

    expect(screen.getByText('Veg', { selector: '.menu-filter-chip' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Clear all/i }));
    expect(screen.queryByText(/Clear all/i)).not.toBeInTheDocument();
    expect(screen.getByText('Hyderabadi Chicken Biriyani')).toBeInTheDocument();
  });

  describe('Grid/List view toggle', () => {
    beforeEach(() => window.localStorage.clear());

    it('defaults to grid view and switches to list view, remembering the choice', () => {
      render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);

      const foodGrid = screen.getByText('Hyderabadi Chicken Biriyani').closest('.food-grid');
      expect(foodGrid).not.toHaveClass('list-view');

      const gridBtn = screen.getByTitle('Grid view');
      const listBtn = screen.getByTitle('List view');
      expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
      expect(listBtn).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(listBtn);
      expect(foodGrid).toHaveClass('list-view');
      expect(listBtn).toHaveAttribute('aria-pressed', 'true');
      expect(window.localStorage.getItem('thevingo_menu_view')).toBe('list');
    });

    it('restores the previously saved list view on mount', () => {
      window.localStorage.setItem('thevingo_menu_view', 'list');
      render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);

      const foodGrid = screen.getByText('Hyderabadi Chicken Biriyani').closest('.food-grid');
      expect(foodGrid).toHaveClass('list-view');
      expect(screen.getByTitle('List view')).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows availability badges on each row in list view only', () => {
      render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);
      const card = screen.getByText('Hyderabadi Chicken Biriyani').closest('article');
      expect(card.querySelector('.food-avail-group')).toBeNull();

      fireEvent.click(screen.getByTitle('List view'));
      const badges = card.querySelectorAll('.food-avail-group .dish-avail-badge');
      expect([...badges].map(b => b.textContent)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
      expect(badges[0]).not.toHaveClass('is-available');
      expect(badges[1]).toHaveClass('is-available');
      expect(badges[2]).toHaveClass('is-available');
    });

    it('opens the edit form directly when a dish is clicked in list view', () => {
      window.localStorage.setItem('thevingo_menu_view', 'list');
      render(<MenuList categories={mockCategories} setCategories={vi.fn()} />);

      fireEvent.click(screen.getByText('Hyderabadi Chicken Biriyani').closest('article'));

      expect(screen.queryByText('Dish details')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Hyderabadi Chicken Biriyani')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save changes/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
      expect(screen.queryByRole('button', { name: /Save changes/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Dish details')).not.toBeInTheDocument();
    });
  });

  describe('Delete all', () => {
    beforeEach(() => mockFetch.mockReset());

    it('is not offered when the menu is already empty', () => {
      render(<MenuList categories={[]} setCategories={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Add Action'));
      expect(screen.queryByRole('button', { name: /Delete all/i })).not.toBeInTheDocument();
    });

    it('asks for confirmation with category/dish counts, and only deletes on confirm', async () => {
      let categoriesState = [...mockCategories];
      const setCategories = vi.fn((updater) => {
        categoriesState = typeof updater === 'function' ? updater(categoriesState) : updater;
      });
      render(<MenuList categories={categoriesState} setCategories={setCategories} />);

      fireEvent.click(screen.getByTitle('Add Action'));
      fireEvent.click(screen.getByRole('button', { name: /Delete all/i }));

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent('Delete entire menu?');
      expect(dialog).toHaveTextContent('all 1 category and 1 dish');

      // Cancel does not delete anything
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();

      // Confirm calls the delete-all endpoint and clears the menu
      fireEvent.click(screen.getByTitle('Add Action'));
      fireEvent.click(screen.getByRole('button', { name: /Delete all/i }));
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
      fireEvent.click(screen.getByRole('button', { name: /Delete everything/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/menu/all'), expect.objectContaining({ method: 'DELETE' }));
        expect(categoriesState).toEqual([]);
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('keeps the menu and shows an error when the delete-all request fails', async () => {
      window.alert = vi.fn();
      const setCategories = vi.fn();
      render(<MenuList categories={mockCategories} setCategories={setCategories} />);

      fireEvent.click(screen.getByTitle('Add Action'));
      fireEvent.click(screen.getByRole('button', { name: /Delete all/i }));
      mockFetch.mockResolvedValueOnce({ ok: false });
      fireEvent.click(screen.getByRole('button', { name: /Delete everything/i }));

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to delete the menu.'));
      expect(setCategories).not.toHaveBeenCalled();
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });
});
