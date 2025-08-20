import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        className={`h-5 w-5 shrink-0 rounded-md border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-900 dark:ring-offset-gray-950 dark:focus:ring-purple-600 dark:checked:bg-purple-500 dark:checked:border-purple-500 transition duration-150 ease-in-out ${className}`}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';

export const FormCheckbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, ...props }, ref) => {
      return (
        <input
          type="checkbox"
          ref={ref}
          className={`form-checkbox h-5 w-5 shrink-0 rounded-md border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-900 dark:ring-offset-gray-950 dark:focus:ring-purple-600 dark:checked:bg-purple-500 dark:checked:border-purple-500 transition duration-150 ease-in-out ${className}`}
          {...props}
        />
      );
    }
  );
FormCheckbox.displayName = 'FormCheckbox';