import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PublicMenu from './PublicMenu';
import { filterCombos, formatPrice, formatTiming, formatValidTill, getDishOffer, normalizeCombos } from './offerDisplay';

const YEAR = new Date().getFullYear();

// --- Browser API stubs (SSE + cross-tab sync) ---
class FakeEventSource {
  constructor(url) { this.url = url; }
  addEventListener() {}
  close() {}
}
class FakeBroadcastChannel {
  constructor(name) { this.name = name; }
  postMessage() {}
  close() {}
}

const mockFetch = vi.fn();

const baseDish = {
  isVeg: true,
  image: '',
  description: '',
  availableBreakfast: false,
  availableLunch: true,
  availableDinner: true
};

const legacyResponse = {
  restaurant_name: 'Spice Hub',
  tagline: 'Fresh every day',
  categories: [
    {
      id: '1',
      name: 'Starters',
      items: [
        { ...baseDish, id: '101', name: 'Paneer Tikka', price: 280 },
        { ...baseDish, id: '102', name: 'Chicken 65', price: 300, isVeg: false }
      ]
    }
  ]
};

const percentageOffer = {
  offerId: '28',
  title: 'Diwali Special',
  badgeType: 'discount',
  type: 'discount',
  discountMode: 'percentage',
  discountPercentage: 10,
  originalPrice: 280,
  offerPrice: 252,
  savings: 28,
  endDate: `${YEAR}-11-13`
};

const fixedOffer = {
  offerId: '29',
  title: 'Weekend treat',
  badgeType: 'weekend-offer',
  type: 'discount',
  discountMode: 'fixed',
  discountPercentage: null,
  originalPrice: 300,
  offerPrice: 249.5,
  savings: 50.5,
  endDate: `${YEAR}-11-13`
};

const combo = {
  id: '26',
  title: 'Lunch Duo',
  badgeType: 'combo-offer',
  comboPrice: 450,
  originalTotal: 580,
  savings: 130,
  endDate: `${YEAR}-11-13`,
  timing: 'L/D',
  dishes: [
    { id: '101', name: 'Paneer Tikka', price: 280, image: '', isVeg: true },
    { id: '102', name: 'Chicken 65', price: 300, image: '', isVeg: false }
  ]
};

const withOffers = (overrides = {}) => ({
  ...legacyResponse,
  categories: [
    {
      id: '1',
      name: 'Starters',
      items: [
        { ...baseDish, id: '101', name: 'Paneer Tikka', price: 280, offer: percentageOffer, comboIds: ['26'] },
        { ...baseDish, id: '102', name: 'Chicken 65', price: 300, isVeg: false, offer: fixedOffer, comboIds: ['26'] },
        { ...baseDish, id: '103', name: 'Masala Papad', price: 60, offer: null, comboIds: [] }
      ]
    }
  ],
  combos: [combo],
  ...overrides
});

const respondWith = (data) => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => data });
};

const renderMenu = async () => {
  render(
    <MemoryRouter initialEntries={['/menu/spice-hub']}>
      <Routes>
        <Route path="/menu/:userId" element={<PublicMenu />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByText('Spice Hub');
};

const cardFor = (dishName) => screen.getByRole('heading', { level: 4, name: dishName }).closest('article');

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PublicMenu offers', () => {
  it('shows a percentage offer: badge, offer price, struck original price and savings', async () => {
    respondWith(withOffers());
    await renderMenu();

    const card = cardFor('Paneer Tikka');
    expect(card).toHaveClass('public-food-card--offer');
    const c = within(card);
    expect(c.getByText('10% OFF')).toBeInTheDocument();
    expect(c.getByText('Diwali Special')).toBeInTheDocument();

    const now = c.getByText('252 Rs');
    expect(now).toHaveClass('pm-price-now');
    expect(now).toHaveTextContent('Offer price: 252 Rs');

    const was = c.getByText('280 Rs');
    expect(was.tagName).toBe('S');
    expect(was).toHaveTextContent('Original price: 280 Rs');

    expect(c.getByText('Save 28 Rs')).toBeInTheDocument();
  });

  it('labels a fixed-price offer as "Offer price" and keeps cents', async () => {
    respondWith(withOffers());
    await renderMenu();

    const c = within(cardFor('Chicken 65'));
    expect(c.getByText('Offer price')).toBeInTheDocument();
    expect(c.queryByText(/% OFF/)).not.toBeInTheDocument();
    expect(c.getByText('Weekend')).toBeInTheDocument();
    expect(c.getByText('249.50 Rs')).toHaveClass('pm-price-now');
    expect(c.getByText('300 Rs').tagName).toBe('S');
    expect(c.getByText('Save 50.50 Rs')).toBeInTheDocument();
  });

  it('renders a dish without an offer exactly as before', async () => {
    respondWith(withOffers());
    await renderMenu();

    const card = cardFor('Masala Papad');
    expect(card).toHaveClass('public-food-card');
    expect(card).not.toHaveClass('public-food-card--offer');
    const price = within(card).getByText('60 Rs');
    expect(price.tagName).toBe('P');
    expect(price).toHaveClass('public-food-price');
    expect(card.querySelector('s')).toBeNull();
    expect(card.querySelector('.pm-offer-badge')).toBeNull();
    expect(within(card).queryByRole('button', { name: /combo/i })).not.toBeInTheDocument();
  });

  it('renders the combo offers section with dishes, totals, savings and validity', async () => {
    respondWith(withOffers());
    await renderMenu();

    const section = screen.getByRole('region', { name: 'Combo offers' });
    const comboCard = within(section).getByTestId('public-combo-card');
    const c = within(comboCard);
    expect(c.getByRole('heading', { name: 'Lunch Duo' })).toBeInTheDocument();
    expect(c.getByText('Combo offer')).toBeInTheDocument();

    const dishes = c.getByRole('list', { name: 'Included dishes' });
    expect(within(dishes).getAllByRole('listitem')).toHaveLength(2);
    expect(within(dishes).getByText('Paneer Tikka')).toBeInTheDocument();
    expect(within(dishes).getByText('(Non Veg)', { exact: false })).toBeInTheDocument();

    expect(c.getByText('450 Rs')).toHaveTextContent('Combo price: 450 Rs');
    const total = c.getByText('580 Rs');
    expect(total.tagName).toBe('S');
    expect(total).toHaveTextContent('Original total: 580 Rs');
    expect(c.getByText('Save 130 Rs')).toBeInTheDocument();
    expect(c.getByText('Valid till 13 Nov')).toBeInTheDocument();
    expect(c.getByText('Lunch/Dinner')).toBeInTheDocument();

    // The combo section sits above the categories
    const categoryHeading = screen.getByRole('heading', { level: 3, name: 'Starters' });
    expect(section.compareDocumentPosition(categoryHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('"Part of a combo" chip scrolls to and highlights the combo card', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    respondWith(withOffers());
    await renderMenu();

    const chip = within(cardFor('Paneer Tikka')).getByRole('button', { name: /Part of a combo: show Lunch Duo/ });
    fireEvent.click(chip);

    const comboCard = screen.getByTestId('public-combo-card');
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.instances[0]).toBe(comboCard);
    expect(comboCard).toHaveClass('is-highlighted');
    expect(comboCard).toHaveFocus();
    delete Element.prototype.scrollIntoView;
  });

  it('hides the combo section when combos is empty', async () => {
    respondWith(withOffers({ combos: [] }));
    await renderMenu();

    expect(screen.queryByRole('region', { name: 'Combo offers' })).not.toBeInTheDocument();
    expect(screen.queryByText('Combo offers')).not.toBeInTheDocument();
    // comboIds pointing at a combo that isn't published get no chip
    expect(screen.queryByRole('button', { name: /Part of a combo/ })).not.toBeInTheDocument();
  });

  it('renders an older response without offer/comboIds/combos as before', async () => {
    respondWith(legacyResponse);
    await renderMenu();

    expect(screen.queryByText('Combo offers')).not.toBeInTheDocument();
    expect(document.querySelector('.pm-offer-badge')).toBeNull();
    expect(document.querySelector('s')).toBeNull();
    expect(within(cardFor('Paneer Tikka')).getByText('280 Rs')).toHaveClass('public-food-price');
    expect(within(cardFor('Chicken 65')).getByText('300 Rs')).toHaveClass('public-food-price');
  });

  it('search filters combos by combo title or dish name', async () => {
    respondWith(withOffers());
    await renderMenu();
    const search = screen.getByPlaceholderText('Search');

    fireEvent.change(search, { target: { value: 'chicken' } });
    expect(screen.getByRole('region', { name: 'Combo offers' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 4, name: 'Masala Papad' })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'duo' } });
    expect(screen.getByRole('region', { name: 'Combo offers' })).toBeInTheDocument();
    // Only the combo matched, so the "nothing found" message stays hidden
    expect(screen.queryByText('No categories or dishes found.')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'papad' } });
    expect(screen.queryByRole('region', { name: 'Combo offers' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Masala Papad' })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.getByText('No categories or dishes found.')).toBeInTheDocument());
  });
});

describe('offerDisplay helpers', () => {
  it('ignores malformed or non-discounting offers', () => {
    expect(getDishOffer({ price: 100 })).toBeNull();
    expect(getDishOffer({ price: 100, offer: null })).toBeNull();
    expect(getDishOffer({ price: 100, offer: { offerPrice: 'x' } })).toBeNull();
    expect(getDishOffer({ price: 100, offer: { offerPrice: 100, originalPrice: 100 } })).toBeNull();
    const offer = getDishOffer({ price: 100, offer: { offerPrice: 80, discountMode: 'percentage', discountPercentage: 20 } });
    expect(offer).toMatchObject({ label: '20% OFF', originalPrice: 100, offerPrice: 80, savings: 20, style: 'discount' });
  });

  it('normalizes combos and drops unusable ones', () => {
    expect(normalizeCombos(undefined)).toEqual([]);
    expect(normalizeCombos([{ id: '1', comboPrice: 10, dishes: [] }])).toEqual([]);
    const [c] = normalizeCombos([{ id: 7, comboPrice: '90', dishes: [{ id: 1, name: 'A', price: 60 }, { id: 2, name: 'B', price: 40 }] }]);
    expect(c).toMatchObject({ id: '7', title: 'Combo offer', comboPrice: 90, originalTotal: 100, savings: 10, style: 'combo' });
  });

  it('filters combos by dish type and category', () => {
    const combos = normalizeCombos([combo, { ...combo, id: '27', dishes: [combo.dishes[0], { ...combo.dishes[0], id: '104', name: 'Veg Roll' }] }]);
    expect(filterCombos(combos, { dishType: 'veg' }).map(x => x.id)).toEqual(['27']);
    expect(filterCombos(combos, { dishType: 'non-veg' }).map(x => x.id)).toEqual(['26']);
    const categories = [{ name: 'Mains', items: [{ id: '102' }] }];
    expect(filterCombos(combos, { selectedCategory: 'Mains', categories }).map(x => x.id)).toEqual(['26']);
  });

  it('formats prices, dates and timings', () => {
    expect(formatPrice(280)).toBe('280');
    expect(formatPrice('199.5')).toBe('199.50');
    expect(formatValidTill(`${YEAR}-11-13`)).toBe('13 Nov');
    expect(formatValidTill(`${YEAR + 1}-01-05`)).toBe(`5 Jan ${YEAR + 1}`);
    expect(formatValidTill('0000-00-00')).toBeNull();
    expect(formatValidTill(null)).toBeNull();
    expect(formatTiming('B/L/D')).toBe('Breakfast/Lunch/Dinner');
    expect(formatTiming('All day')).toBe('All day');
  });
});
