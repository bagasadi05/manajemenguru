import React from 'react';

interface LoadingSpinnerProps {
  /** Tailwind classes controlling width and height, e.g. "w-16 h-16" */
  sizeClass?: string;
  /** Tailwind classes controlling border width, e.g. "border-4" */
  borderWidthClass?: string;
  /** Tailwind classes for the border color, e.g. "border-blue-500" */
  colorClass?: string;
  /** Additional classes applied to the spinner */
  className?: string;
  /** When true, wrap the spinner in a full screen centered container */
  fullScreen?: boolean;
  /** Extra classes for the container when fullScreen is true */
  containerClassName?: string;
}

/**
 * Reusable loading spinner built with TailwindCSS classes.
 * Allows customization of size, border width, and color while
 * avoiding markup duplication across the app.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  sizeClass = 'w-16 h-16',
  borderWidthClass = 'border-4',
  colorClass = 'border-blue-500',
  className = '',
  fullScreen = false,
  containerClassName = '',
}) => {
  const spinner = (
    <div
      className={`${sizeClass} ${borderWidthClass} ${colorClass} border-t-transparent rounded-full animate-spin ${className}`}
    />
  );

  return fullScreen ? (
    <div className={`flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950 ${containerClassName}`}>
      {spinner}
    </div>
  ) : (
    spinner
  );
};

export default LoadingSpinner;
