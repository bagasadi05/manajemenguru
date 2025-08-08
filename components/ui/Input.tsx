
import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={`flex h-10 w-full rounded-md border border-gray-300 bg-transparent dark:border-gray-600 dark:bg-gray-800 py-2 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';