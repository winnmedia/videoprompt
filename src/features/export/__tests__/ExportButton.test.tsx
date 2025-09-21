/**
 * ExportButton 컴포넌트 테스트
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportButton } from '../ui/ExportButton';
import type { ExportFormat } from '../types';

describe('ExportButton', () => {
  const mockOnExport = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render export button with default variant', () => {
    render(<ExportButton onExport={mockOnExport} />);

    const button = screen.getByRole('button', { name: /내보내기 옵션 열기/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('내보내기');
  });

  it('should render compact variant', () => {
    render(<ExportButton onExport={mockOnExport} variant="compact" />);

    const button = screen.getByRole('button', { name: /내보내기 옵션/i });
    expect(button).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<ExportButton onExport={mockOnExport} disabled />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should show loading state', () => {
    render(<ExportButton onExport={mockOnExport} isLoading />);

    expect(screen.getByRole('button')).toBeDisabled();
    // Check for loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should open dropdown when clicked', async () => {
    render(<ExportButton onExport={mockOnExport} />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.getByText('내보내기 형식 선택')).toBeInTheDocument();
    expect(screen.getByText('PDF 형식으로 내보내기')).toBeInTheDocument();
    expect(screen.getByText('Excel 형식으로 내보내기')).toBeInTheDocument();
  });

  it('should close dropdown when clicking outside', async () => {
    render(
      <div>
        <ExportButton onExport={mockOnExport} />
        <div data-testid="outside">Outside element</div>
      </div>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.getByText('내보내기 형식 선택')).toBeInTheDocument();

    // Click outside
    await user.click(screen.getByTestId('outside'));

    await waitFor(() => {
      expect(screen.queryByText('내보내기 형식 선택')).not.toBeInTheDocument();
    });
  });

  it('should call onExport with PDF format', async () => {
    render(<ExportButton onExport={mockOnExport} />);

    const button = screen.getByRole('button');
    await user.click(button);

    const pdfButton = screen.getByText('PDF 형식으로 내보내기');
    await user.click(pdfButton);

    expect(mockOnExport).toHaveBeenCalledWith('pdf');
  });

  it('should call onExport with Excel format', async () => {
    render(<ExportButton onExport={mockOnExport} />);

    const button = screen.getByRole('button');
    await user.click(button);

    const excelButton = screen.getByText('Excel 형식으로 내보내기');
    await user.click(excelButton);

    expect(mockOnExport).toHaveBeenCalledWith('excel');
  });

  it('should only show available formats', async () => {
    render(
      <ExportButton
        onExport={mockOnExport}
        availableFormats={['pdf']}
      />
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.getByText('PDF 형식으로 내보내기')).toBeInTheDocument();
    expect(screen.queryByText('Excel 형식으로 내보내기')).not.toBeInTheDocument();
  });

  it('should close dropdown after selection', async () => {
    render(<ExportButton onExport={mockOnExport} />);

    const button = screen.getByRole('button');
    await user.click(button);

    const pdfButton = screen.getByText('PDF 형식으로 내보내기');
    await user.click(pdfButton);

    await waitFor(() => {
      expect(screen.queryByText('내보내기 형식 선택')).not.toBeInTheDocument();
    });
  });

  it('should handle keyboard navigation', async () => {
    render(<ExportButton onExport={mockOnExport} />);

    const button = screen.getByRole('button');

    // Focus the button
    button.focus();
    expect(button).toHaveFocus();

    // Press Enter to open dropdown
    await user.keyboard('{Enter}');
    expect(screen.getByText('내보내기 형식 선택')).toBeInTheDocument();

    // Press Escape to close dropdown
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('내보내기 형식 선택')).not.toBeInTheDocument();
    });
  });

  it('should apply custom className', () => {
    render(<ExportButton onExport={mockOnExport} className="custom-class" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should handle async onExport function', async () => {
    const asyncOnExport = vi.fn().mockResolvedValue(undefined);

    render(<ExportButton onExport={asyncOnExport} />);

    const button = screen.getByRole('button');
    await user.click(button);

    const pdfButton = screen.getByText('PDF 형식으로 내보내기');
    await user.click(pdfButton);

    expect(asyncOnExport).toHaveBeenCalledWith('pdf');
    await waitFor(() => {
      expect(asyncOnExport).toHaveBeenCalled();
    });
  });
});