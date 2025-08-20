
import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';
import { SunIcon, MoonIcon } from '../Icons';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === 'light' ? (
        <SunIcon className="h-5 w-5" />
      ) : (
        <MoonIcon className="h-5 w-5" />
      )}
    </Button>
  );
};

export default ThemeToggle;
