/**
 * Export 기능 통합 테스트
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ExportActions } from '@/widgets/export';
import projectSlice from '@/app/store/project-slice';
import authSlice from '@/app/store/auth-slice';

// Mock export utilities
vi.mock('../utils', () => ({
  exportScenarioToPDF: vi.fn().mockResolvedValue({
    success: true,
    fileName: 'test-scenario.pdf',
    downloadUrl: 'blob:test-url'
  }),
  exportScenarioToExcel: vi.fn().mockResolvedValue({
    success: true,
    fileName: 'test-scenario.xlsx',
    downloadUrl: 'blob:test-url'
  }),
  exportPromptToExcel: vi.fn().mockResolvedValue({
    success: true,
    fileName: 'test-prompts.xlsx',
    downloadUrl: 'blob:test-url'
  })
}));

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      project: projectSlice,
      auth: authSlice
    },
    preloadedState: {
      project: {
        id: 'test-project',
        scenario: {
          id: 'test-scenario',
          title: '테스트 시나리오',
          description: '테스트 설명',
          shots: [
            {
              id: 'shot-1',
              title: '첫 번째 샷',
              description: '첫 번째 샷 설명',
              duration: 10
            }
          ],
          createdAt: '2024-01-01T00:00:00Z',
          version: '1.0'
        },
        prompt: {
          id: 'test-prompt',
          title: '테스트 프롬프트',
          content: '프롬프트 내용',
          createdAt: '2024-01-01T00:00:00Z'
        },
        video: null,
        versions: [],
        scenarioId: null,
        promptId: null,
        videoAssetId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      },
      auth: {
        user: {
          id: 'test-user',
          email: 'test@example.com',
          username: 'testuser'
        },
        isAuthenticated: true,
        isLoading: false,
        isRefreshing: false,
        lastCheckTime: null,
        error: null
      },
      ...initialState
    }
  });
};

const renderWithProvider = (component: React.ReactElement, store = createMockStore()) => {
  return render(<Provider store={store}>{component}</Provider>);
};

describe('Export Integration', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario Export', () => {
    it('should export scenario as PDF', async () => {
      renderWithProvider(<ExportActions mode="scenario" />);

      // Click export button
      const exportButton = screen.getByRole('button', { name: /내보내기 옵션 열기/i });
      await user.click(exportButton);

      // Select PDF format
      const pdfOption = screen.getByText('PDF 형식으로 내보내기');
      await user.click(pdfOption);

      // Wait for export modal to appear
      await waitFor(() => {
        expect(screen.getByText('내보내기 준비 중...')).toBeInTheDocument();
      });

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('내보내기 완료!')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should export scenario as Excel', async () => {
      renderWithProvider(<ExportActions mode="scenario" />);

      const exportButton = screen.getByRole('button');
      await user.click(exportButton);

      const excelOption = screen.getByText('Excel 형식으로 내보내기');
      await user.click(excelOption);

      await waitFor(() => {
        expect(screen.getByText('내보내기 완료!')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should disable export when no scenario data', () => {
      const storeWithoutScenario = createMockStore({
        project: {
          scenario: null,
          prompt: null
        }
      });

      renderWithProvider(<ExportActions mode="scenario" />, storeWithoutScenario);

      const exportButton = screen.getByRole('button');
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Prompt Export', () => {
    it('should export prompts as Excel', async () => {
      renderWithProvider(<ExportActions mode="prompt" />);

      const exportButton = screen.getByRole('button');
      await user.click(exportButton);

      // Prompt mode only has Excel option
      const excelOption = screen.getByText('Excel 형식으로 내보내기');
      await user.click(excelOption);

      await waitFor(() => {
        expect(screen.getByText('내보내기 완료!')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should only show Excel format for prompt mode', async () => {
      renderWithProvider(<ExportActions mode="prompt" />);

      const exportButton = screen.getByRole('button');
      await user.click(exportButton);

      expect(screen.getByText('Excel 형식으로 내보내기')).toBeInTheDocument();
      expect(screen.queryByText('PDF 형식으로 내보내기')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle export errors', async () => {
      // Mock export to fail
      vi.doMock('../utils', () => ({
        exportScenarioToPDF: vi.fn().mockResolvedValue({
          success: false,
          fileName: '',
          error: '내보내기 실패'
        })
      }));

      renderWithProvider(<ExportActions mode="scenario" />);

      const exportButton = screen.getByRole('button');
      await user.click(exportButton);

      const pdfOption = screen.getByText('PDF 형식으로 내보내기');
      await user.click(pdfOption);

      await waitFor(() => {
        expect(screen.getByText('내보내기 실패')).toBeInTheDocument();
      });
    });

    it('should allow retry after failure', async () => {
      // First call fails, second succeeds
      const mockExport = vi.fn()
        .mockResolvedValueOnce({
          success: false,
          fileName: '',
          error: '네트워크 오류'
        })
        .mockResolvedValueOnce({
          success: true,
          fileName: 'test.pdf',
          downloadUrl: 'blob:test-url'
        });

      vi.doMock('../utils', () => ({
        exportScenarioToPDF: mockExport
      }));

      renderWithProvider(<ExportActions mode="scenario" />);

      const exportButton = screen.getByRole('button');
      await user.click(exportButton);

      const pdfOption = screen.getByText('PDF 형식으로 내보내기');
      await user.click(pdfOption);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('내보내기 실패')).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText('다시 시도');
      await user.click(retryButton);

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('내보내기 완료!')).toBeInTheDocument();
      });

      expect(mockExport).toHaveBeenCalledTimes(2);
    });
  });

  describe('Custom Data', () => {
    it('should use custom scenario data when provided', async () => {
      const customData = {
        title: '커스텀 시나리오',
        shots: [
          {
            id: 'custom-shot',
            title: '커스텀 샷',
            description: '커스텀 설명'
          }
        ],
        metadata: {
          createdAt: '2024-01-01T00:00:00Z'
        }
      };

      renderWithProvider(
        <ExportActions mode="scenario" customData={customData} />
      );

      const exportButton = screen.getByRole('button');
      expect(exportButton).not.toBeDisabled();

      await user.click(exportButton);

      const pdfOption = screen.getByText('PDF 형식으로 내보내기');
      await user.click(pdfOption);

      await waitFor(() => {
        expect(screen.getByText('내보내기 완료!')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithProvider(<ExportActions mode="scenario" />);

      const exportButton = screen.getByRole('button', { name: /내보내기 옵션 열기/i });
      expect(exportButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderWithProvider(<ExportActions mode="scenario" />);

      const exportButton = screen.getByRole('button');

      // Focus and activate with keyboard
      exportButton.focus();
      expect(exportButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByText('내보내기 형식 선택')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByText('내보내기 형식 선택')).not.toBeInTheDocument();
      });
    });
  });
});