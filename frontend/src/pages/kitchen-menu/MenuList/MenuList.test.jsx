import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MenuList from './MenuList';

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

    const openAndPick = (file, categories = mockCategories, setCategories = vi.fn()) => {
      render(<MenuList categories={categories} setCategories={setCategories} />);
      fireEvent.click(screen.getByRole('button', { name: /Import menu/i }));
      fireEvent.change(screen.getByTestId('menu-import-input'), { target: { files: [file] } });
      return setCategories;
    };

    it('shows a blocking loading screen with progress while importing', async () => {
      let resolveFirst;
      mockFetch
        .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
        .mockResolvedValueOnce(okDish('302', 'Veg Biriyani'));

      openAndPick(csvFile(['Biriyani,Mutton Biriyani,320,non_veg,0,1,1', 'Biriyani,Veg Biriyani,200,veg,0,1,1']));

      expect(await screen.findByText('0 of 2 dishes')).toBeInTheDocument();
      expect(screen.getByText('Importing menu…')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: /Import progress/i })).toHaveAttribute('aria-valuemax', '2');
      expect(screen.getByText('Adding dishes').closest('li')).toHaveAttribute('aria-current', 'step');
      expect(screen.getByRole('button', { name: /Close import dialog/i })).toBeDisabled();
      expect(screen.queryByTestId('menu-import-input')).not.toBeInTheDocument();

      resolveFirst(okDish('301', 'Mutton Biriyani'));
      expect(await screen.findByText('Imported 2 of 2 dishes')).toBeInTheDocument();
      expect(screen.getByText('Menu imported')).toBeInTheDocument();
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

    it('explains that Excel files must be saved as CSV', async () => {
      openAndPick(new File(['PK'], 'menu.xlsx'));
      expect(await screen.findByText(/Excel files \(\.xlsx\) can't be imported directly/i)).toBeInTheDocument();
      expect(screen.getByText(/CSV UTF-8/)).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('continues after a failed row and reports each failure with the server message', async () => {
      mockFetch
        .mockResolvedValueOnce(okDish('301', 'Mutton Biriyani'))
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ success: false, message: 'Name, price, and category are required.' }) })
        .mockResolvedValueOnce(okDish('303', 'Prawn Biriyani'));
      let state = [...mockCategories];
      const setCategories = vi.fn(updater => { state = typeof updater === 'function' ? updater(state) : updater; });

      openAndPick(csvFile([
        'Biriyani,Mutton Biriyani,320,non_veg,0,1,1',
        'Biriyani,Veg Biriyani,200,veg,0,1,1',
        'Biriyani,Prawn Biriyani,350,non_veg,0,1,1'
      ]), mockCategories, setCategories);

      expect(await screen.findByText('Imported 2 of 3 dishes')).toBeInTheDocument();
      expect(screen.getByText('Import finished with problems')).toBeInTheDocument();
      const failed = screen.getByRole('list', { name: /Rows that failed/i });
      expect(failed).toHaveTextContent('Row 3Veg Biriyani (Biriyani): Name, price, and category are required.');
      expect(screen.getByRole('button', { name: /Download rows not imported/i })).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(state[0].items.map(item => item.name)).toEqual(['Hyderabadi Chicken Biriyani', 'Mutton Biriyani', 'Prawn Biriyani']);
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

      expect(await screen.findByText('Imported 1 of 3 dishes')).toBeInTheDocument();
      expect(screen.getByText('Import stopped')).toBeInTheDocument();
      expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
      expect(screen.getByText(/2 dishes were not sent/)).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('creates missing categories first and skips dishes already on the menu', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ success: true, category: { id: '9', name: 'Drinks', items: [] } }) })
        .mockResolvedValueOnce(okDish('401', 'Lime Soda'));

      openAndPick(csvFile([
        'Biriyani,hyderabadi chicken biriyani,280,non_veg,0,1,1',
        'Drinks,Lime Soda,50,veg,1,1,1'
      ]));

      expect(await screen.findByText('Imported 1 of 1 dish')).toBeInTheDocument();
      expect(screen.getByText(/1 new category created: Drinks/)).toBeInTheDocument();
      expect(screen.getByRole('list', { name: /Skipped rows/i })).toHaveTextContent(/already on your menu in 'Biriyani'/);
      expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/menu\/categories$/);
      expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toMatchObject({ name: 'Lime Soda', categoryId: '9' });
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
});
