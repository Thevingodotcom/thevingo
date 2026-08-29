import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import LandingPage from './LandingPage';

describe('LandingPage Component', () => {
  it('renders landing page with heading and call to actions', () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    // Assert main header or titles are present
    expect(screen.getByText(/Start Your Free Journey Today/i)).toBeInTheDocument();
    
    // Assert check for CTA buttons
    expect(screen.getByRole('link', { name: /Create account/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See how it works/i })).toBeInTheDocument();
  });
});
