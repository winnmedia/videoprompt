/**
 * ExportButton 간단한 컴포넌트 테스트
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportButton } from '../ui/ExportButton';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Download: () => React.createElement('div', { 'data-testid': 'download-icon' }),
  FileText: () => React.createElement('div', { 'data-testid': 'file-text-icon' }),
  FileSpreadsheet: () => React.createElement('div', { 'data-testid': 'file-spreadsheet-icon' }),
  Loader2: () => React.createElement('div', { 'data-testid': 'loader-icon' })
}));

describe('ExportButton (Simple)', () => {
  const mockOnExport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render export button', () => {
    render(<ExportButton onExport={mockOnExport} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('내보내기');
  });

  it('should render with custom className', () => {
    render(<ExportButton onExport={mockOnExport} className="custom-class" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<ExportButton onExport={mockOnExport} disabled />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should show loading state', () => {
    render(<ExportButton onExport={mockOnExport} isLoading />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('should render compact variant', () => {
    render(<ExportButton onExport={mockOnExport} variant="compact" />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should show correct available formats', () => {
    render(<ExportButton onExport={mockOnExport} availableFormats={['pdf']} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});