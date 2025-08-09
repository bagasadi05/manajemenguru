import { render, screen, act } from '@testing-library/react';
import GreetingRobot from './GreetingRobot';
import { vi } from 'vitest';

describe('GreetingRobot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the greeting message with the user name', () => {
    const userName = 'Pak Guru';
    const onAnimationEnd = vi.fn();

    render(<GreetingRobot userName={userName} onAnimationEnd={onAnimationEnd} />);

    // Fast-forward time until the bubble appears
    act(() => {
        vi.advanceTimersByTime(1200);
    });

    const greetingText = screen.getByText(/Selamat Datang, Pak Guru!/i);
    expect(greetingText).toBeInTheDocument();

    // Fast-forward time until the bubble disappears
    act(() => {
        vi.advanceTimersByTime(3500);
    });

    expect(screen.queryByText(/Selamat Datang, Pak Guru!/i)).not.toBeInTheDocument();
  });
});
