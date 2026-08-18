import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock child pages or subcomponents if needed to prevent rendering errors
vi.mock('./pages/landingpage/LandingPage', () => ({
  default: () => <div>Landing Page Mocked</div>
}));

describe('App Component Routing', () => {
  it('renders landing page by default', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Verify default path '/' renders Landing Page
    expect(screen.getByText('Landing Page Mocked')).toBeInTheDocument();
  });
});
