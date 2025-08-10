import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoginPage from '../LoginPage';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ login: vi.fn(), signup: vi.fn(), session: null }),
}));

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ success: vi.fn() }),
}));

vi.mock('../../ui/Modal', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../ui/Button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button>,
}));

vi.mock('../../ui/Input', () => ({
  Input: (props: any) => <input {...props} />, 
}));

describe('LoginPage', () => {
  it('renders login form', () => {
    render(<LoginPage />);
    expect(screen.getByText(/Belum punya akun\?/i)).toBeTruthy();
  });
});
