import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, afterEach } from 'vitest';
import LandingPage from './LandingPage';

const renderPage = () =>
  render(
    <BrowserRouter>
      <LandingPage />
    </BrowserRouter>
  );

describe('LandingPage Component', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('renders landing page with heading and call to actions', () => {
    renderPage();

    // Assert main header or titles are present
    expect(screen.getByText(/Start Your Free Journey Today/i)).toBeInTheDocument();

    // Hero: primary CTA creates an account, secondary link logs in
    expect(screen.getByRole('link', { name: /Create free account/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /See how it works/i })).toBeInTheDocument();
    expect(screen.getByText(/Already have an account\?/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Log in$/i })).toHaveAttribute('href', '/login');
  });

  it('shows Login and Create account in the header for visitors', () => {
    renderPage();
    const header = within(document.getElementById('landing-header'));

    expect(header.getByRole('link', { name: /^Login$/i })).toHaveAttribute('href', '/login');
    expect(header.getByRole('link', { name: /^Create account$/i })).toHaveAttribute('href', '/register');
    expect(header.queryByRole('link', { name: /Go to dashboard/i })).not.toBeInTheDocument();
  });

  it('shows Go to dashboard instead of auth actions for logged-in users', () => {
    sessionStorage.setItem('token', 'mock-jwt-token');
    renderPage();
    const header = within(document.getElementById('landing-header'));

    expect(header.getByRole('link', { name: /Go to dashboard/i })).toHaveAttribute('href', '/dashboard');
    expect(header.queryByRole('link', { name: /^Login$/i })).not.toBeInTheDocument();
    expect(header.queryByRole('link', { name: /^Create account$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Already have an account\?/i)).not.toBeInTheDocument();
  });
});
