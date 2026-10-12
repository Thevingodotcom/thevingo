import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const categories = [
  { id: '1', name: 'Starters', items: [{ id: 'a' }, { id: 'b' }] },
  { id: '2', name: 'Mains', items: [{ id: 'c' }] },
  { id: '3', name: 'Empty' }
];

// Shape returned by GET /api/offers
const offers = [
  { id: '1', status: 'Active', isActive: true },
  { id: '2', status: 'Inactive', isActive: false },
  { id: '3', status: 'Active' }
];

const renderDashboard = (props = {}) => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <Routes>
      <Route
        path="/dashboard"
        element={<Dashboard categories={categories} offers={offers} scanCount={9} isDataLoading={false} {...props} />}
      />
      <Route path="*" element={<LocationProbe />} />
    </Routes>
  </MemoryRouter>
);

const card = (label) => screen.getByRole('button', { name: new RegExp(`^${label}:`) });

describe('Dashboard stat cards', () => {
  it('shows counts, treating status "Active" as active', () => {
    renderDashboard();
    expect(card('Active offer')).toHaveTextContent('2');
    expect(card('Total Scan')).toHaveTextContent('9');
    expect(card('Dish')).toHaveTextContent('3');
    expect(card('Category')).toHaveTextContent('3');
  });

  it('shows a loading placeholder while data loads', () => {
    renderDashboard({ isDataLoading: true });
    expect(card('Dish')).toHaveTextContent('...');
  });

  it.each([
    ['Active offer', '/dashboard/offers'],
    ['Total Scan', '/dashboard/distribution'],
    ['Dish', '/dashboard/kitchen-menu'],
    ['Category', '/dashboard/kitchen-menu']
  ])('%s card navigates to %s', (label, path) => {
    renderDashboard();
    fireEvent.click(card(label));
    expect(screen.getByTestId('location')).toHaveTextContent(path);
  });

  it('cards are focusable buttons', () => {
    renderDashboard();
    const button = card('Dish');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('asks the app to refresh data when mounted', () => {
    const onRefresh = vi.fn();
    renderDashboard({ onRefresh });
    expect(onRefresh).toHaveBeenCalled();
  });
});
