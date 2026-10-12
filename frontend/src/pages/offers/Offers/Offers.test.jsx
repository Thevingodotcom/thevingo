import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Offers from './Offers';

const initialOffers = [
  {
    id: '7',
    name: 'Lunch Combo',
    badgeType: 'combo-biriyani',
    duration: 'Oct 05-Nov 12',
    status: 'Active',
    timing: 'L/D',
    pricePercent: '15%',
    isActive: true,
    checked: false
  }
];

let latestOffers = null;
const Harness = () => {
  const [offers, setOffers] = useState(initialOffers);
  latestOffers = offers;
  return <Offers offers={offers} setOffers={setOffers} />;
};

describe('Offers edit flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    latestOffers = null;
  });

  it('opens the form prefilled and saves via PUT /api/offers/:id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        offer: {
          id: '7',
          name: 'Dinner Combo',
          badgeType: 'combo-offer',
          duration: 'Oct 05-Nov 12',
          status: 'Active',
          timing: 'L/D',
          pricePercent: '20%',
          isActive: true,
          checked: false
        }
      })
    });

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /edit offer lunch combo/i }));

    expect(screen.getByText('Edit Offer')).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText(/monsoon special combo/i);
    const priceInput = screen.getByPlaceholderText(/150 Rs or 15%/i);
    expect(nameInput).toHaveValue('Lunch Combo');
    expect(priceInput).toHaveValue('15%');

    fireEvent.change(nameInput, { target: { value: 'Dinner Combo' } });
    fireEvent.change(priceInput, { target: { value: '20%' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/offers\/7$/);
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({
      name: 'Dinner Combo',
      badgeType: 'combo-offer',
      duration: 'Oct 05-Nov 12', // untouched dates keep the stored text
      timing: 'L/D',
      pricePercent: '20%'
    });

    await waitFor(() => expect(screen.queryByText('Edit Offer')).not.toBeInTheDocument());
    expect(latestOffers).toHaveLength(1);
    expect(latestOffers[0].name).toBe('Dinner Combo');
    expect(latestOffers[0].pricePercent).toBe('20%');
    expect(screen.getByText('Dinner Combo')).toBeInTheDocument();
  });

  it('the add button still opens an empty create form', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /edit offer lunch combo/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    fireEvent.click(screen.getByTitle('Add New Offer'));
    expect(screen.getByText('Create New Offer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/monsoon special combo/i)).toHaveValue('');
  });
});
