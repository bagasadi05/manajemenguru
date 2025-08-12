import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../hooks/useTheme';
import ThemeToggle from './ThemeToggle';

// A helper component to display the current theme
const TestDisplay = () => {
  const { theme } = useTheme();
  return <div data-testid="theme-display">{theme}</div>;
};

describe('ThemeToggle', () => {
  // Clear localStorage before each test
  beforeEach(() => {
    localStorage.clear();
    // Reset the class on the root element
    document.documentElement.classList.remove('dark', 'light');
  });

  it('should toggle the theme from light to dark and back', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
        <TestDisplay />
      </ThemeProvider>
    );

    const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
    const themeDisplay = screen.getByTestId('theme-display');

    // 1. Initial state should be light (based on default test environment)
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(themeDisplay.textContent).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');

    // 2. First click: Toggle to dark mode
    fireEvent.click(toggleButton);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(themeDisplay.textContent).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    // 3. Second click: Toggle back to light mode
    fireEvent.click(toggleButton);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(themeDisplay.textContent).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('should initialize from localStorage if a theme is set', () => {
    localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <TestDisplay />
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByTestId('theme-display').textContent).toBe('dark');
  });
});
