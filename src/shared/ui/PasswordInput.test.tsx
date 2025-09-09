import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('renders password input with hidden password by default', () => {
    render(
      <PasswordInput
        value=""
        onChange={() => {}}
        placeholder="Enter password"
      />
    );

    const input = screen.getByPlaceholderText('Enter password');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('toggles password visibility when clicking show/hide button', async () => {
    const user = userEvent.setup();
    render(
      <PasswordInput
        value="testpassword"
        onChange={() => {}}
        placeholder="Enter password"
      />
    );

    const input = screen.getByPlaceholderText('Enter password');
    const toggleButton = screen.getByRole('button', { name: /show password/i });

    // Initially password is hidden
    expect(input).toHaveAttribute('type', 'password');

    // Click to show password
    await user.click(toggleButton);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();

    // Click to hide password again
    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('calls onChange when typing in the input', async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    
    render(
      <PasswordInput
        value=""
        onChange={handleChange}
        placeholder="Enter password"
      />
    );

    const input = screen.getByPlaceholderText('Enter password');
    await user.type(input, 'newpassword');

    expect(handleChange).toHaveBeenCalled();
  });

  it('displays error message when error prop is provided', () => {
    render(
      <PasswordInput
        value=""
        onChange={() => {}}
        error="Password is required"
        placeholder="Enter password"
      />
    );

    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('applies error styles when error prop is provided', () => {
    render(
      <PasswordInput
        value=""
        onChange={() => {}}
        error="Password is required"
        placeholder="Enter password"
      />
    );

    const input = screen.getByPlaceholderText('Enter password');
    expect(input.className).toContain('border-danger');
  });

  it('passes through additional props to the input element', () => {
    render(
      <PasswordInput
        value=""
        onChange={() => {}}
        placeholder="Enter password"
        id="password-field"
        name="password"
        required
        disabled
      />
    );

    const input = screen.getByPlaceholderText('Enter password');
    expect(input).toHaveAttribute('id', 'password-field');
    expect(input).toHaveAttribute('name', 'password');
    expect(input).toHaveAttribute('required');
    expect(input).toBeDisabled();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <PasswordInput
        value=""
        onChange={() => {}}
        className="custom-class"
        placeholder="Enter password"
      />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('supports keyboard navigation for accessibility', async () => {
    const user = userEvent.setup();
    render(
      <PasswordInput
        value="password"
        onChange={() => {}}
        placeholder="Enter password"
      />
    );

    const input = screen.getByPlaceholderText('Enter password');
    const toggleButton = screen.getByRole('button', { name: /show password/i });

    // Focus should move to toggle button with tab
    input.focus();
    await user.tab();
    expect(toggleButton).toHaveFocus();

    // Enter key should toggle visibility
    await user.keyboard('{Enter}');
    expect(input).toHaveAttribute('type', 'text');

    // Space key should also toggle visibility
    await user.keyboard(' ');
    expect(input).toHaveAttribute('type', 'password');
  });
});