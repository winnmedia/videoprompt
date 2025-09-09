import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useParams } from 'next/navigation';
import ResetPasswordPage from './page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}));

// Mock our custom components
jest.mock('@/shared/ui/PasswordInput', () => ({
  PasswordInput: ({ value, onChange, error, placeholder, ...props }: any) => (
    <input
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-invalid={!!error}
      {...props}
    />
  ),
}));

jest.mock('@/shared/ui/PasswordStrengthIndicator', () => ({
  PasswordStrengthIndicator: ({ password, showRequirements }: any) => (
    <div data-testid="password-strength">
      Password Strength: {password.length > 0 ? 'Shown' : 'Hidden'}
      {showRequirements && <div>Requirements shown</div>}
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

describe('ResetPasswordPage', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useParams as jest.Mock).mockReturnValue({ token: 'valid-reset-token' });
  });

  it('renders reset password form with all elements', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByText('새 비밀번호 설정')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('새 비밀번호 입력')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('비밀번호 확인')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /비밀번호 재설정/ })).toBeInTheDocument();
    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
  });

  it('validates token on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, valid: true }),
    });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-reset-token' }),
      });
    });
  });

  it('shows error for invalid token', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ 
        ok: false, 
        message: '유효하지 않거나 만료된 토큰입니다.' 
      }),
    });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText('유효하지 않거나 만료된 토큰입니다.')).toBeInTheDocument();
      expect(screen.getByText(/비밀번호 재설정 링크가 유효하지 않습니다/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /다시 요청하기/ })).toHaveAttribute('href', '/forgot-password');
    });
  });

  it('validates password requirements', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, valid: true }),
    });

    render(<ResetPasswordPage />);

    const newPasswordInput = screen.getByPlaceholderText('새 비밀번호 입력');
    const confirmPasswordInput = screen.getByPlaceholderText('비밀번호 확인');
    const submitButton = screen.getByRole('button', { name: /비밀번호 재설정/ });

    // Type weak password
    await user.type(newPasswordInput, 'weak');
    await user.type(confirmPasswordInput, 'weak');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/비밀번호는 최소 8자 이상이어야 합니다/)).toBeInTheDocument();
    });
  });

  it('validates password confirmation match', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, valid: true }),
    });

    render(<ResetPasswordPage />);

    const newPasswordInput = screen.getByPlaceholderText('새 비밀번호 입력');
    const confirmPasswordInput = screen.getByPlaceholderText('비밀번호 확인');
    const submitButton = screen.getByRole('button', { name: /비밀번호 재설정/ });

    await user.type(newPasswordInput, 'StrongP@ssw0rd123');
    await user.type(confirmPasswordInput, 'DifferentP@ssw0rd');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    });
  });

  it('successfully resets password with valid inputs', async () => {
    const user = userEvent.setup();
    
    // First call for token validation
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, valid: true }),
    });

    render(<ResetPasswordPage />);

    // Wait for token validation
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Second call for password reset
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, message: 'Password reset successful' }),
    });

    const newPasswordInput = screen.getByPlaceholderText('새 비밀번호 입력');
    const confirmPasswordInput = screen.getByPlaceholderText('비밀번호 확인');
    const submitButton = screen.getByRole('button', { name: /비밀번호 재설정/ });

    await user.type(newPasswordInput, 'StrongP@ssw0rd123');
    await user.type(confirmPasswordInput, 'StrongP@ssw0rd123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'valid-reset-token',
          password: 'StrongP@ssw0rd123',
        }),
      });
    });

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText('비밀번호가 재설정되었습니다')).toBeInTheDocument();
      expect(screen.getByText(/새 비밀번호로 로그인할 수 있습니다/)).toBeInTheDocument();
    });

    // Should redirect to login after delay
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?message=비밀번호가 성공적으로 재설정되었습니다.');
    }, { timeout: 4000 });
  });

  it('handles API error during password reset', async () => {
    const user = userEvent.setup();
    
    // Token validation succeeds
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, valid: true }),
    });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Password reset fails
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ 
        ok: false, 
        message: '비밀번호 재설정에 실패했습니다.' 
      }),
    });

    const newPasswordInput = screen.getByPlaceholderText('새 비밀번호 입력');
    const confirmPasswordInput = screen.getByPlaceholderText('비밀번호 확인');
    const submitButton = screen.getByRole('button', { name: /비밀번호 재설정/ });

    await user.type(newPasswordInput, 'StrongP@ssw0rd123');
    await user.type(confirmPasswordInput, 'StrongP@ssw0rd123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('비밀번호 재설정에 실패했습니다.')).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    const user = userEvent.setup();
    
    // Token validation
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, valid: true }),
    });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (global.fetch as jest.Mock).mockReturnValueOnce(promise);

    const newPasswordInput = screen.getByPlaceholderText('새 비밀번호 입력');
    const confirmPasswordInput = screen.getByPlaceholderText('비밀번호 확인');
    const submitButton = screen.getByRole('button', { name: /비밀번호 재설정/ });

    await user.type(newPasswordInput, 'StrongP@ssw0rd123');
    await user.type(confirmPasswordInput, 'StrongP@ssw0rd123');
    await user.click(submitButton);

    // Button should be disabled and show loading text
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('재설정 중...')).toBeInTheDocument();

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('shows password strength indicator while typing', async () => {
    const user = userEvent.setup();
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, valid: true }),
    });

    render(<ResetPasswordPage />);

    const newPasswordInput = screen.getByPlaceholderText('새 비밀번호 입력');

    await user.type(newPasswordInput, 'StrongP@ssw0rd123');

    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
    expect(screen.getByText('Requirements shown')).toBeInTheDocument();
  });

  it('clears error when user modifies input', async () => {
    const user = userEvent.setup();
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, valid: true }),
    });

    render(<ResetPasswordPage />);

    const newPasswordInput = screen.getByPlaceholderText('새 비밀번호 입력');
    const confirmPasswordInput = screen.getByPlaceholderText('비밀번호 확인');
    const submitButton = screen.getByRole('button', { name: /비밀번호 재설정/ });

    // Submit with mismatched passwords
    await user.type(newPasswordInput, 'StrongP@ssw0rd123');
    await user.type(confirmPasswordInput, 'Different');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    });

    // Start typing again to clear error
    await user.clear(confirmPasswordInput);
    await user.type(confirmPasswordInput, 'StrongP@ssw0rd123');

    expect(screen.queryByText('비밀번호가 일치하지 않습니다.')).not.toBeInTheDocument();
  });
});