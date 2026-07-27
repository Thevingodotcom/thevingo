import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Login from './Login';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Login Component', () => {
  it('renders login form and responds to input changes', async () => {
    render(
      <BrowserRouter>
        <Login onLogin={() => {}} />
      </BrowserRouter>
    );

    // Verify title and input fields
    expect(screen.getByText(/Login to you vingo account/i)).toBeInTheDocument();
    
    const emailInput = screen.getByPlaceholderText(/Email address/i);
    const passwordInput = screen.getByPlaceholderText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /Login/i });

    // Simulate input changes
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');

    // Simulate successful API submission
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'mock-jwt-token', user: { id: 1, username: 'tester' } }),
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it('renders error message on API failure', async () => {
    render(
      <BrowserRouter>
        <Login onLogin={() => {}} />
      </BrowserRouter>
    );

    const emailInput = screen.getByPlaceholderText(/Email address/i);
    const passwordInput = screen.getByPlaceholderText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /Login/i });

    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });

    // Mock failed login response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: 'Invalid credentials' }),
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
