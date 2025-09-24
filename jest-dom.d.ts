/// <reference types="@testing-library/jest-dom" />

// Jest DOM 타입 확장
import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveFocus(): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveAttribute(attr: string, value?: any): R;
      toHaveClass(...classNames: string[]): R;
      toHaveStyle(style: string | Record<string, any>): R;
      toHaveValue(value: string | string[] | number): R;
      toBeChecked(): R;
      toBePartiallyChecked(): R;
      toHaveFormValues(expectedValues: Record<string, any>): R;
      toHaveDisplayValue(value: string | RegExp | string[] | RegExp[]): R;
      toBeRequired(): R;
      toBeInvalid(): R;
      toBeValid(): R;
      toHaveAccessibleName(name?: string | RegExp): R;
      toHaveAccessibleDescription(description?: string | RegExp): R;
      toHaveErrorMessage(message?: string | RegExp): R;
    }
  }
}
