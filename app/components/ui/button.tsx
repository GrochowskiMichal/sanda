import React, { InputHTMLAttributes, forwardRef } from 'react';

interface FileInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  variant?: 'primary' | 'secondary';
}

const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, variant = 'primary', children, ...props }, ref) => {
    const baseClasses = 'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer';
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    };

    const inputClasses = `${baseClasses} ${variantClasses[variant]} ${className || ''}`.trim();

    return (
      <label className={inputClasses}>
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          ref={ref}
          {...props}
        />
        {children}
      </label>
    );
  }
);

FileInput.displayName = 'FileInput';

export { FileInput };
export type { FileInputProps };
