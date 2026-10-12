import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResetPassword from './ResetPassword';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const LoginStub = () => {
  const location = useLocation();
  return <div>login screen: {location.state?.message}</div>;
};

describe('ResetPassword Component', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('shows the handed-over message and goes to login right after a successful reset', async () => {
    render(
      <MemoryRouter
        initialEntries={[{
          pathname: '/reset-password',
          state: { email: 'user@example.com', otp: '123456', message: 'OTP verified. Please set your new password.' }
        }]}
      >
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/login" element={<LoginStub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/OTP verified/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Enter new password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter new password'), { target: { value: 'newpass123' } });

    let resolveFetch;
    mockFetch.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve; }));

    const submit = screen.getByRole('button', { name: /Reset password/i });
    fireEvent.click(submit);

    // Loading state while in flight, and a second click does not resubmit
    expect(screen.getByRole('button', { name: /Resetting/i })).toBeDisabled();
    fireEvent.submit(submit.closest('form'));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    resolveFetch({ ok: true, json: async () => ({ success: true }) });

    await waitFor(() => {
      expect(screen.getByText(/login screen: Password reset successfully/i)).toBeInTheDocument();
    });
  });
});
