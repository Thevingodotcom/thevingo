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
});
