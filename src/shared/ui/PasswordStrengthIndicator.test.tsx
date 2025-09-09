import React from 'react';
import { render, screen } from '@testing-library/react';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

describe('PasswordStrengthIndicator', () => {
  it('renders nothing when password is empty', () => {
    const { container } = render(<PasswordStrengthIndicator password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows weak strength for short passwords', () => {
    render(<PasswordStrengthIndicator password="abc" />);
    
    expect(screen.getByText('약함')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '1');
    expect(progressBar).toHaveAttribute('aria-valuemax', '4');
  });

  it('shows fair strength for medium passwords without complexity', () => {
    render(<PasswordStrengthIndicator password="password123" />);
    
    expect(screen.getByText('보통')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '2');
  });

  it('shows good strength for passwords with mixed case and numbers', () => {
    render(<PasswordStrengthIndicator password="Password123" />);
    
    expect(screen.getByText('좋음')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '3');
  });

  it('shows strong strength for complex passwords', () => {
    render(<PasswordStrengthIndicator password="MyP@ssw0rd123!" />);
    
    expect(screen.getByText('강함')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '4');
  });

  it('displays strength requirements checklist', () => {
    render(<PasswordStrengthIndicator password="Test123@" showRequirements />);
    
    expect(screen.getByText(/최소 8자 이상/)).toBeInTheDocument();
    expect(screen.getByText(/대문자 포함/)).toBeInTheDocument();
    expect(screen.getByText(/소문자 포함/)).toBeInTheDocument();
    expect(screen.getByText(/숫자 포함/)).toBeInTheDocument();
    expect(screen.getByText(/특수문자 포함/)).toBeInTheDocument();
  });

  it('shows met requirements with checkmarks', () => {
    render(<PasswordStrengthIndicator password="MyP@ssw0rd" showRequirements />);
    
    // All requirements should be met
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it('shows unmet requirements with x marks', () => {
    render(<PasswordStrengthIndicator password="pass" showRequirements />);
    
    // Most requirements should not be met
    const xmarks = screen.getAllByText('✗');
    expect(xmarks.length).toBeGreaterThan(0);
  });

  it('applies correct color classes based on strength', () => {
    const { rerender } = render(<PasswordStrengthIndicator password="weak" />);
    let indicator = screen.getByTestId('strength-indicator');
    expect(indicator.className).toContain('bg-danger');

    rerender(<PasswordStrengthIndicator password="password123" />);
    indicator = screen.getByTestId('strength-indicator');
    expect(indicator.className).toContain('bg-warning');

    rerender(<PasswordStrengthIndicator password="Password123" />);
    indicator = screen.getByTestId('strength-indicator');
    expect(indicator.className).toContain('bg-success');

    rerender(<PasswordStrengthIndicator password="MyP@ssw0rd123!" />);
    indicator = screen.getByTestId('strength-indicator');
    expect(indicator.className).toContain('bg-success');
  });

  it('calculates strength based on multiple criteria', () => {
    // Test various password patterns
    const testCases = [
      { password: '12345678', expectedStrength: '약함' }, // Only numbers
      { password: 'abcdefgh', expectedStrength: '약함' }, // Only lowercase
      { password: 'ABCDEFGH', expectedStrength: '약함' }, // Only uppercase  
      { password: 'Abcdefgh', expectedStrength: '보통' }, // Mixed case
      { password: 'Abcd1234', expectedStrength: '좋음' }, // Mixed case + numbers
      { password: 'Ab@1234!', expectedStrength: '강함' }, // All types
    ];

    testCases.forEach(({ password, expectedStrength }) => {
      const { unmount } = render(<PasswordStrengthIndicator password={password} />);
      expect(screen.getByText(expectedStrength)).toBeInTheDocument();
      unmount();
    });
  });

  it('handles special characters in password correctly', () => {
    const specialPasswords = [
      'P@$$w0rd',
      'Test!@#$%',
      'My-Pass_123',
      'Secure&Safe123',
    ];

    specialPasswords.forEach((password) => {
      const { unmount } = render(<PasswordStrengthIndicator password={password} />);
      expect(screen.getByText(/강함|좋음/)).toBeInTheDocument();
      unmount();
    });
  });

  it('updates dynamically when password changes', () => {
    const { rerender } = render(<PasswordStrengthIndicator password="weak" />);
    expect(screen.getByText('약함')).toBeInTheDocument();

    rerender(<PasswordStrengthIndicator password="StrongP@ssw0rd!" />);
    expect(screen.getByText('강함')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<PasswordStrengthIndicator password="TestPassword123" />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-label', '비밀번호 강도');
    expect(progressBar).toHaveAttribute('aria-valuenow');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '4');
  });
});