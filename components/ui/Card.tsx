
import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    className={['bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg rounded-2xl shadow-lg shadow-gray-500/10 dark:shadow-black/20 border border-white/20 dark:border-gray-800/50 transition-all duration-300', className].filter(Boolean).join(' ')}
    {...props}
  />
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    className={['p-4 md:p-6 border-b border-gray-200/50 dark:border-gray-800/50', className].filter(Boolean).join(' ')}
    {...props}
  />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h3
    className={['text-lg font-semibold text-gray-900 dark:text-white', className].filter(Boolean).join(' ')}
    {...props}
  />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p
    className={['text-sm text-gray-500 dark:text-gray-400 mt-1', className].filter(Boolean).join(' ')}
    {...props}
  />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    className={['p-4 md:p-6', className].filter(Boolean).join(' ')}
    {...props}
  />
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    className={['p-4 md:p-6 border-t border-gray-200/50 dark:border-gray-800/50', className].filter(Boolean).join(' ')}
    {...props}
  />
);
