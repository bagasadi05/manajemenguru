
import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';
import { SunIcon, MoonIcon } from '../Icons';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const handleToggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    // Update HTML class immediately to avoid race conditions with Tailwind CDN
    document.documentElement.classList.toggle('dark', next === 'dark');
    setTheme(next);
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleToggle} aria-label="Toggle theme">
      {theme === 'light' ? (
        <SunIcon className="h-5 w-5" />
      ) : (
        <MoonIcon className="h-5 w-5" />
      )}
    </Button>
  );
};

export default ThemeToggle;
