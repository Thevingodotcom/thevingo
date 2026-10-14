import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Offers from './Offers';

const categories = [
  {
    id: '1',
    name: 'Starters',
    items: [
      { id: '11', name: 'Paneer Tikka', price: 200, isVeg: true },
      { id: '12', name: 'Chicken 65', price: 249.99, isVeg: false }
    ]
  },
  {
    id: '2',
    name: 'Mains',
    items: [
      { id: '21', name: 'Veg Biryani', price: 300, isVeg: true },
      { id: '22', name: 'Mutton Biryani', price: 450, isVeg: false }
    ]
  }
];

// Legacy row (created before offer types/dates existed)
const legacyOffer = {
  id: '7',
  name: 'Lunch Combo',
  badgeType: 'combo-biriyani',
  duration: 'Oct 05-Nov 12',
  status: 'Active',
  timing: 'L/D',
  pricePercent: '450',
  isActive: true,
  checked: false,
  offerType: 'discount',
  discountMode: null,
  discountPercentage: null,
  comboPrice: null,
  startDate: null,
  endDate: null,
  effectiveStatus: 'unscheduled',
  dishes: []
};

const fixedOffer = {
  id: '9',
  name: 'Weekend Feast',
  badgeType: 'weekend-offer',
  duration: 'Oct 10-Oct 31',
  status: 'Active',
  timing: 'B/L/D',
  pricePercent: 'Fixed',
  isActive: true,
  checked: false,
  offerType: 'discount',
  discountMode: 'fixed',
  discountPercentage: null,
  comboPrice: null,
  startDate: '2026-10-10',
  endDate: '2026-10-31',
  effectiveStatus: 'active',
  dishes: [
    { dishId: '11', offerPrice: 180 },
    { dishId: '22', offerPrice: 399.5 },
    { dishId: '999', offerPrice: 50 } // deleted dish
  ]
};

let latestOffers = null;
const Harness = ({ initialOffers = [] }) => {
  const [offers, setOffers] = useState(initialOffers);
  latestOffers = offers;
  return <Offers offers={offers} setOffers={setOffers} categories={categories} />;
};

const mockFetchOk = (offer) => vi.spyOn(globalThis, 'fetch').mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, message: 'ok', offer })
});

const openCreate = () => fireEvent.click(screen.getByTitle('Add New Offer'));
const setDates = (start, end) => {
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: start } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: end } });
};
const previewBtn = () => screen.getByRole('button', { name: /^preview$/i });
const previewRows = () => screen.getAllByTestId('offer-preview-row').map(row => row.textContent);

describe('Offers create flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    latestOffers = null;
  });

  it('requires an offer name: Preview stays disabled and lists what is missing', () => {
    render(<Harness />);
    openCreate();

    const nameInput = screen.getByLabelText('Offer Name');
    expect(nameInput).toBeRequired();
    expect(screen.getByText(/are required/i)).toBeInTheDocument();
    expect(previewBtn()).toBeDisabled();
    expect(previewBtn()).toHaveAttribute('aria-describedby', 'offer-preview-blockers');
    const blockers = () => document.getElementById('offer-preview-blockers');
    expect(blockers()).toHaveTextContent('Enter an offer name.');
    expect(blockers()).toHaveTextContent('Enter the discount percentage.');
    expect(blockers()).toHaveTextContent('Select at least 1 dish.');

    // Everything else filled in: still blocked by the name alone
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chicken 65' }));
    expect(previewBtn()).toBeDisabled();
    expect(blockers()).toHaveTextContent('Enter an offer name.');
    expect(blockers()).not.toHaveTextContent('Select at least 1 dish.');

    // A name of only spaces does not count
    fireEvent.change(nameInput, { target: { value: '   ' } });
    expect(previewBtn()).toBeDisabled();

    // Leaving the empty field shows the error on the field itself
    fireEvent.blur(nameInput);
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(nameInput, { target: { value: 'Weekend Deal' } });
    expect(previewBtn()).toBeEnabled();
    expect(previewBtn()).not.toHaveAttribute('aria-describedby');
    expect(blockers()).toBeNull();
  });

  it('creates a percentage discount: search + select dishes -> preview -> confirm -> POST', async () => {
    const fetchMock = mockFetchOk({
      id: '30', name: 'Diwali Deal', badgeType: 'discount', isActive: true, checked: false,
      offerType: 'discount', discountMode: 'percentage', discountPercentage: 15,
      startDate: '2026-10-20', endDate: '2026-11-05', effectiveStatus: 'scheduled', timing: 'B/L/D',
      duration: 'Oct 20-Nov 05', pricePercent: '15%', dishes: [{ dishId: '12', offerPrice: null }, { dishId: '21', offerPrice: null }, { dishId: '22', offerPrice: null }]
    });
    render(<Harness />);
    openCreate();

    expect(screen.getByText('Create New Offer')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /discount offer/i })).toHaveAttribute('aria-checked', 'true');
    expect(previewBtn()).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/monsoon special combo/i), { target: { value: 'Diwali Deal' } });
    setDates('2026-10-20', '2026-11-05');
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '15' } });

    // Search narrows the list
    fireEvent.change(screen.getByLabelText('Search dishes'), { target: { value: 'chick' } });
    expect(screen.queryByRole('checkbox', { name: 'Paneer Tikka' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chicken 65' }));
    fireEvent.click(screen.getByLabelText('Clear dish search'));

    // Select all in a category
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all in Mains' }));
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select all in Starters' }).indeterminate).toBe(true);

    fireEvent.click(previewBtn());
    expect(screen.getByText('Preview Offer')).toBeInTheDocument();
    expect(previewRows()).toEqual([
      expect.stringMatching(/Chicken 65.*249\.99 Rs.*212\.49 Rs.*37\.50 Rs/),
      expect.stringMatching(/Veg Biryani.*300 Rs.*255 Rs.*45 Rs/),
      expect.stringMatching(/Mutton Biryani.*450 Rs.*382\.50 Rs.*67\.50 Rs/)
    ]);
    const totals = screen.getByLabelText('Offer totals');
    expect(totals).toHaveTextContent('Dishes3');
    expect(totals).toHaveTextContent('Original total999.99 Rs');
    expect(totals).toHaveTextContent('Total savings150 Rs (15% off)');
    expect(screen.getByText('Oct 20, 2026 → Nov 5, 2026')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /publish offer/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Publish this offer?')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/offers$/);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      name: 'Diwali Deal',
      badgeType: 'discount',
      timing: 'B/L/D',
      isActive: true,
      offerType: 'discount',
      discountMode: 'percentage',
      discountPercentage: 15,
      startDate: '2026-10-20',
      endDate: '2026-11-05',
      dishes: [{ dishId: '12' }, { dishId: '21' }, { dishId: '22' }]
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(latestOffers).toHaveLength(1);
    expect(latestOffers[0].id).toBe('30');
    const row = screen.getByText('Diwali Deal').closest('.offer-row-card');
    expect(within(row).getByTestId('offer-status')).toHaveTextContent('Scheduled');
    expect(within(row).getByText('15% off')).toBeInTheDocument();
    expect(within(row).getByText('Discount · 3 dishes')).toBeInTheDocument();
  });

  it('creates a fixed-price discount with per-dish prices', async () => {
    const fetchMock = mockFetchOk({ id: '31', name: 'Happy Hour', isActive: true, effectiveStatus: 'active' });
    render(<Harness />);
    openCreate();

    fireEvent.change(screen.getByPlaceholderText(/monsoon special combo/i), { target: { value: 'Happy Hour' } });
    setDates('2026-10-14', '2026-10-14');
    fireEvent.change(screen.getByLabelText('Discount type'), { target: { value: 'fixed' } });
    expect(screen.queryByLabelText('Discount (%)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Paneer Tikka' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mutton Biryani' }));
    expect(previewBtn()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Offer price for Paneer Tikka'), { target: { value: '200' } });
    expect(screen.getByText('Must be less than 200 Rs.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Offer price for Paneer Tikka'), { target: { value: '149.5' } });
    expect(screen.queryByText('Must be less than 200 Rs.')).not.toBeInTheDocument();
    expect(previewBtn()).toBeDisabled(); // Mutton Biryani still has no price
    fireEvent.change(screen.getByLabelText('Offer price for Mutton Biryani'), { target: { value: '400' } });
    expect(previewBtn()).toBeEnabled();

    fireEvent.click(previewBtn());
    expect(previewRows()).toEqual([
      expect.stringMatching(/Paneer Tikka.*200 Rs.*149\.50 Rs.*50\.50 Rs/),
      expect.stringMatching(/Mutton Biryani.*450 Rs.*400 Rs.*50 Rs/)
    ]);
    expect(screen.getByLabelText('Offer totals')).toHaveTextContent('Total savings100.50 Rs (15% off)');

    fireEvent.click(screen.getByRole('button', { name: /publish offer/i }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /^publish$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      name: 'Happy Hour',
      badgeType: 'discount',
      timing: 'B/L/D',
      isActive: true,
      offerType: 'discount',
      discountMode: 'fixed',
      startDate: '2026-10-14',
      endDate: '2026-10-14',
      dishes: [{ dishId: '11', offerPrice: 149.5 }, { dishId: '22', offerPrice: 400 }]
    });
  });

  it('creates a combo: validates dish count and price, previews totals', async () => {
    const fetchMock = mockFetchOk({ id: '32', name: 'Family Combo', isActive: true, effectiveStatus: 'active' });
    render(<Harness />);
    openCreate();

    fireEvent.click(screen.getByRole('radio', { name: /combo offer/i }));
    expect(screen.getByLabelText('Badge Style')).toHaveValue('combo-offer');
    fireEvent.change(screen.getByPlaceholderText(/monsoon special combo/i), { target: { value: 'Family Combo' } });
    setDates('2026-10-14', '2026-12-31');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Veg Biryani' }));
    expect(screen.getAllByText('Select at least 2 dishes for a combo.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Paneer Tikka' }));
    expect(screen.queryByText('Select at least 2 dishes for a combo.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Combo price (Rs)'), { target: { value: '500' } });
    expect(screen.getAllByText("Combo price must be less than the dishes' total (500 Rs).").length).toBeGreaterThan(0);
    expect(previewBtn()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Combo price (Rs)'), { target: { value: '425' } });
    expect(previewBtn()).toBeEnabled();
    fireEvent.click(previewBtn());

    expect(previewRows()).toEqual([
      expect.stringMatching(/Veg Biryani.*300 Rs/),
      expect.stringMatching(/Paneer Tikka.*200 Rs/)
    ]);
    const totals = screen.getByLabelText('Offer totals');
    expect(totals).toHaveTextContent('Dishes2');
    expect(totals).toHaveTextContent('Original total500 Rs');
    expect(totals).toHaveTextContent('Combo price425 Rs');
    expect(totals).toHaveTextContent('Customer saves75 Rs (15% off)');

    fireEvent.click(screen.getByRole('button', { name: /publish offer/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('as a combo of 2 dishes for 425 Rs');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /^publish$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      name: 'Family Combo',
      badgeType: 'combo-offer',
      timing: 'B/L/D',
      isActive: true,
      offerType: 'combo',
      comboPrice: 425,
      startDate: '2026-10-14',
      endDate: '2026-12-31',
      dishes: [{ dishId: '21' }, { dishId: '11' }]
    });
  });

  it('cancel at the confirmation sends nothing; Back keeps the form values', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<Harness />);
    openCreate();

    fireEvent.change(screen.getByPlaceholderText(/monsoon special combo/i), { target: { value: 'Quick Deal' } });
    setDates('2026-10-14', '2026-10-30');
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Paneer Tikka' }));
    fireEvent.click(previewBtn());

    fireEvent.click(screen.getByRole('button', { name: /publish offer/i }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Preview Offer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByPlaceholderText(/monsoon special combo/i)).toHaveValue('Quick Deal');
    expect(screen.getByLabelText('Discount (%)')).toHaveValue('10');
    expect(screen.getByRole('checkbox', { name: 'Paneer Tikka' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the preview open and shows the server message when saving fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'Offer price must be less than the dish price' })
    });
    render(<Harness />);
    openCreate();
    fireEvent.change(screen.getByPlaceholderText(/monsoon special combo/i), { target: { value: 'Quick Deal' } });
    setDates('2026-10-14', '2026-10-30');
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Paneer Tikka' }));
    fireEvent.click(previewBtn());
    fireEvent.click(screen.getByRole('button', { name: /publish offer/i }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /^publish$/i }));

    expect(await screen.findByText('Offer price must be less than the dish price')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Preview Offer')).toBeInTheDocument();
    expect(latestOffers).toHaveLength(0);
  });

  it('the add button opens an empty create form', () => {
    render(<Harness initialOffers={[fixedOffer]} />);
    fireEvent.click(screen.getByRole('button', { name: /edit offer weekend feast/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    openCreate();
    expect(screen.getByText('Create New Offer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/monsoon special combo/i)).toHaveValue('');
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });
});

describe('Offers edit flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    latestOffers = null;
  });

  it('prefills from the offer, drops deleted dishes, and saves via PUT /api/offers/:id', async () => {
    const fetchMock = mockFetchOk({
      ...fixedOffer,
      name: 'Weekend Feast XL',
      endDate: '2026-11-30',
      duration: 'Oct 10-Nov 30',
      dishes: [{ dishId: '11', offerPrice: 175 }, { dishId: '22', offerPrice: 399.5 }]
    });
    render(<Harness initialOffers={[fixedOffer]} />);
    fireEvent.click(screen.getByRole('button', { name: /edit offer weekend feast/i }));

    expect(screen.getByText('Edit Offer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/monsoon special combo/i)).toHaveValue('Weekend Feast');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-10-10');
    expect(screen.getByLabelText('End date')).toHaveValue('2026-10-31');
    expect(screen.getByLabelText('Discount type')).toHaveValue('fixed');
    expect(screen.getByLabelText('Badge Style')).toHaveValue('weekend-offer');
    expect(screen.getByLabelText('Timing')).toHaveValue('B/L/D');
    expect(screen.getByRole('checkbox', { name: 'Paneer Tikka' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Mutton Biryani' })).toBeChecked();
    expect(screen.getByLabelText('Offer price for Paneer Tikka')).toHaveValue('180');
    expect(screen.getByLabelText('Offer price for Mutton Biryani')).toHaveValue('399.5');
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 dish in this offer is no longer on your menu');

    fireEvent.change(screen.getByPlaceholderText(/monsoon special combo/i), { target: { value: 'Weekend Feast XL' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-30' } });
    fireEvent.change(screen.getByLabelText('Offer price for Paneer Tikka'), { target: { value: '175' } });
    fireEvent.click(previewBtn());
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Save changes?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/offers\/9$/);
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({
      name: 'Weekend Feast XL',
      badgeType: 'weekend-offer',
      timing: 'B/L/D',
      isActive: true,
      offerType: 'discount',
      discountMode: 'fixed',
      startDate: '2026-10-10',
      endDate: '2026-11-30',
      dishes: [{ dishId: '11', offerPrice: 175 }, { dishId: '22', offerPrice: 399.5 }]
    });

    await waitFor(() => expect(screen.queryByText('Edit Offer')).not.toBeInTheDocument());
    expect(latestOffers).toHaveLength(1);
    expect(latestOffers[0].name).toBe('Weekend Feast XL');
    expect(screen.getByText('Weekend Feast XL')).toBeInTheDocument();
    expect(screen.getByText('Oct 10-Nov 30')).toBeInTheDocument();
  });

  it('opens a legacy offer with dates from its duration text and type from its badge', () => {
    render(<Harness initialOffers={[legacyOffer]} />);
    fireEvent.click(screen.getByRole('button', { name: /edit offer lunch combo/i }));

    expect(screen.getByRole('radio', { name: /combo offer/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Combo price (Rs)')).toHaveValue('450');
    expect(screen.getByLabelText('Badge Style')).toHaveValue('combo-offer');
    expect(screen.getByLabelText('Timing')).toHaveValue('L/D');
    expect(screen.getByLabelText('Start date').value).toMatch(/^\d{4}-10-05$/);
    expect(screen.getByLabelText('End date').value).toMatch(/^\d{4}-11-12$/);
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/created before dish selection/);
    expect(previewBtn()).toBeDisabled();
  });
});

describe('Offers list', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const listOffers = [
    { ...fixedOffer, id: 'a', name: 'Now Live', effectiveStatus: 'active' },
    { ...fixedOffer, id: 'b', name: 'Coming Soon', effectiveStatus: 'scheduled', startDate: '2099-12-01', endDate: '2099-12-31' },
    { ...fixedOffer, id: 'c', name: 'Old Deal', effectiveStatus: 'expired' },
    { ...fixedOffer, id: 'd', name: 'Switched Off', isActive: false, status: 'Inactive', effectiveStatus: 'inactive' },
    { ...legacyOffer, id: 'e', name: 'Legacy Deal' },
    { id: 'f', name: 'Pre-contract', badgeType: 'discount', duration: 'Oct 01-Oct 31', status: 'Active', timing: 'L/D', pricePercent: '20%', isActive: true, checked: false }
  ];

  const statusOf = (name) => within(screen.getByText(name).closest('.offer-row-card')).getByTestId('offer-status');

  it('shows each offer\'s effectiveStatus', () => {
    render(<Harness initialOffers={listOffers} />);
    expect(statusOf('Now Live')).toHaveTextContent('Active');
    expect(statusOf('Coming Soon')).toHaveTextContent('Scheduled');
    expect(statusOf('Coming Soon')).toHaveAttribute('title', 'Starts Dec 1, 2099');
    expect(statusOf('Old Deal')).toHaveTextContent('Expired');
    expect(statusOf('Switched Off')).toHaveTextContent('Inactive');
    expect(statusOf('Legacy Deal')).toHaveTextContent('Not scheduled');
    expect(statusOf('Pre-contract')).toHaveTextContent('Active'); // no effectiveStatus: toggle-based
    expect(within(screen.getByText('Pre-contract').closest('.offer-row-card')).getByText('20%')).toBeInTheDocument();
    expect(within(screen.getByText('Now Live').closest('.offer-row-card')).getByText('Fixed prices')).toBeInTheDocument();
  });

  it('the toggle still switches the offer and refreshes its status', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    render(<Harness initialOffers={[listOffers[1]]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /turn offer coming soon off/i }));
    await waitFor(() => expect(statusOf('Coming Soon')).toHaveTextContent('Inactive'));
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/offers\/b\/toggle$/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ isActive: false });

    fireEvent.click(screen.getByRole('checkbox', { name: /turn offer coming soon on/i }));
    await waitFor(() => expect(statusOf('Coming Soon')).toHaveTextContent('Scheduled'));
  });
});
