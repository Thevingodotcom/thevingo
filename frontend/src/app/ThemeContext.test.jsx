import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from './ThemeContext';

const Probe = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button type="button" onClick={toggleTheme}>toggle</button>
      <button type="button" onClick={() => setTheme('dark')}>force-dark</button>
    </div>
  );
};

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it('defaults to light when nothing is stored and the OS has no preference', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
  });

  it('reads a previously saved theme on mount', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
  });

  it('toggleTheme flips the value and persists it to localStorage', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('setTheme sets an explicit value', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    fireEvent.click(screen.getByText('force-dark'));
    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('useTheme throws outside of a ThemeProvider', () => {
    const BadProbe = () => {
      useTheme();
      return null;
    };
    // Silence the expected React error boundary console output for this assertion
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadProbe />)).toThrow('useTheme must be used within a ThemeProvider');
    spy.mockRestore();
  });
});
