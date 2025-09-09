import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import ForgotPasswordPage from './page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

describe('ForgotPasswordPage', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, message: 'Reset email sent' }),
    });
  });

  it('renders forgot password form with all elements', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByText('비밀번호 재설정')).toBeInTheDocument();
    expect(screen.getByText(/비밀번호를 잊으셨나요/)).toBeInTheDocument();
    expect(screen.getByLabelText(/이메일/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /재설정 링크 전송/ })).toBeInTheDocument();
    expect(screen.getByText(/로그인으로 돌아가기/)).toBeInTheDocument();
  });

  it('validates email format before submission', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/이메일/);
    const submitButton = screen.getByRole('button', { name: /재설정 링크 전송/ });

    // Try to submit with invalid email
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    // Email validation should be handled by HTML5 validation
    expect(emailInput).toBeInvalid();
  });

  it('submits form with valid email and shows success message', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/이메일/);
    const submitButton = screen.getByRole('button', { name: /재설정 링크 전송/ });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });
    });

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/이메일을 확인해주세요/)).toBeInTheDocument();
      expect(screen.getByText(/비밀번호 재설정 링크를 전송했습니다/)).toBeInTheDocument();
    });
  });

  it('handles API error response', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ 
        ok: false, 
        message: '등록되지 않은 이메일입니다.' 
      }),
    });

    render(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/이메일/);
    const submitButton = screen.getByRole('button', { name: /재설정 링크 전송/ });

    await user.type(emailInput, 'notfound@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('등록되지 않은 이메일입니다.')).toBeInTheDocument();
    });
  });

  it('handles rate limiting response', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ 
        ok: false, 
        message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' 
      }),
    });

    render(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/이메일/);
    const submitButton = screen.getByRole('button', { name: /재설정 링크 전송/ });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/너무 많은 요청입니다/)).toBeInTheDocument();
    });
  });

  it('handles network error', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/이메일/);
    const submitButton = screen.getByRole('button', { name: /재설정 링크 전송/ });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('서버 오류가 발생했습니다.')).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (global.fetch as jest.Mock).mockReturnValueOnce(promise);

    render(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/이메일/);
    const submitButton = screen.getByRole('button', { name: /재설정 링크 전송/ });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    // Button should be disabled and show loading text
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('전송 중...')).toBeInTheDocument();

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('provides link back to login page', () => {
    render(<ForgotPasswordPage />);

    const loginLink = screen.getByRole('link', { name: /로그인으로 돌아가기/ });
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('clears error message when user starts typing', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ 
        ok: false, 
        message: '오류가 발생했습니다.' 
      }),
    });

    render(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/이메일/);
    const submitButton = screen.getByRole('button', { name: /재설정 링크 전송/ });

    // First submission fails
    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('오류가 발생했습니다.')).toBeInTheDocument();
    });

    // Start typing again
    await user.clear(emailInput);
    await user.type(emailInput, 'new@example.com');

    // Error should be cleared
    expect(screen.queryByText('오류가 발생했습니다.')).not.toBeInTheDocument();
  });

  it('prevents multiple simultaneous submissions', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (global.fetch as jest.Mock).mockReturnValueOnce(promise);

    render(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/이메일/);
    const submitButton = screen.getByRole('button', { name: /재설정 링크 전송/ });

    await user.type(emailInput, 'test@example.com');
    
    // Try to click multiple times
    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    // Should only call fetch once
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => ({ ok: true }),
    });
  });
});