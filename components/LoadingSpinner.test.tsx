import { render } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default classes', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner).toHaveClass('w-16', 'h-16', 'border-4', 'border-blue-500');
  });

  it('supports custom size and color classes', () => {
    const { container } = render(
      <LoadingSpinner sizeClass="w-4 h-4" borderWidthClass="border-2" colorClass="border-red-500" />
    );
    const spinner = container.firstChild as HTMLElement;
    expect(spinner).toHaveClass('w-4', 'h-4', 'border-2', 'border-red-500');
  });
});
