import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Register from './Register';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Register Component', () => {
  it('renders register step 1 correctly and validates inputs', async () => {
    render(
      <BrowserRouter>
        <Register onRegister={() => {}} />
      </BrowserRouter>
    );

    // Verify presence of step 1 elements
    expect(screen.getByText(/Create account/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Name/i);
    const emailInput = screen.getByPlaceholderText(/Email address/i);
    const contactInput = screen.getByPlaceholderText(/Contact/i);
    const passwordInput = screen.getByPlaceholderText(/Password/i);
    const nextButton = screen.getByRole('button', { name: /Next/i });

    // Simulate entering step 1 details
    fireEvent.change(nameInput, { target: { value: 'john_doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.change(contactInput, { target: { value: '1234567890' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(nameInput.value).toBe('john_doe');
    expect(emailInput.value).toBe('john@example.com');
    expect(contactInput.value).toBe('1234567890');
    expect(passwordInput.value).toBe('password123');

    // Mock the check-email check to succeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Email available' }),
    });

    // Mock send-otp API request which happens right after checking email
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'OTP sent' }),
    });

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
