import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import PricingPage from './PricingPage';

describe('PricingPage Component', () => {
  it('renders plans and pricing sections', () => {
    render(
      <BrowserRouter>
        <PricingPage />
      </BrowserRouter>
    );

    // Verify page title
    expect(screen.getByText(/Plans and pricing/i)).toBeInTheDocument();
    
    // Verify Starter plan details
    expect(screen.getByText(/Starters/i)).toBeInTheDocument();
    expect(screen.getByText(/Free limited access to Vingo menu card/i)).toBeInTheDocument();
    
    // Verify features lists are rendered
    expect(screen.getByText(/Dynamic price change/i)).toBeInTheDocument();
    expect(screen.getByText(/Add up to 30 items in you menu card/i)).toBeInTheDocument();
  });
});
