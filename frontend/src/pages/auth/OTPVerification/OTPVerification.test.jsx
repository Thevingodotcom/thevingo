import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OTPVerification from './OTPVerification';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const ResetPasswordStub = () => {
  const location = useLocation();
  return <div>reset screen: {location.state?.message}</div>;
};

const renderOTP = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/verify-otp', state: { email: 'user@example.com', type: 'reset' } }]}>
      <Routes>
        <Route path="/verify-otp" element={<OTPVerification />} />
        <Route path="/reset-password" element={<ResetPasswordStub />} />
        <Route path="/forgot-password" element={<div>forgot screen</div>} />
      </Routes>
    </MemoryRouter>
  );

// Flush pending promise callbacks (fetch/json resolution) under fake timers.
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('OTPVerification Component', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('disables resend during the countdown and re-enables it when it ends', async () => {
    renderOTP();

    const resend = screen.getByRole('button', { name: /Resend OTP in 1:00/i });
    expect(resend).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: /Resend OTP in 0:59/i })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(59000);
    });
    const enabled = screen.getByRole('button', { name: /^Resend OTP$/i });
    expect(enabled).toBeEnabled();

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    fireEvent.click(enabled);
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/auth\/send-otp$/);
    expect(screen.getByText(/A new OTP has been sent/i)).toBeInTheDocument();
    // Timer restarts after a successful resend
    expect(screen.getByRole('button', { name: /Resend OTP in 1:00/i })).toBeDisabled();
  });

  it('navigates to reset password immediately after a successful verification', async () => {
    renderOTP();

    const inputs = screen.getAllByRole('textbox');
    '123456'.split('').forEach((digit, i) => {
      fireEvent.change(inputs[i], { target: { value: digit } });
    });

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    fireEvent.click(screen.getByRole('button', { name: /Verify Email/i }));
    await flush();

    // No timers advanced: navigation must not depend on an artificial delay
    expect(screen.getByText(/reset screen: OTP verified/i)).toBeInTheDocument();
  });

  it('redirects to forgot password when opened without an email', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/verify-otp', state: { type: 'reset' } }]}>
        <Routes>
          <Route path="/verify-otp" element={<OTPVerification />} />
          <Route path="/forgot-password" element={<div>forgot screen</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('forgot screen')).toBeInTheDocument();
  });
});
