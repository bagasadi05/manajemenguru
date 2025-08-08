
import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        className={`h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:ring-offset-gray-950 dark:focus:ring-indigo-600 dark:checked:bg-indigo-500 dark:checked:border-indigo-500 transition duration-150 ease-in-out ${className}`}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';