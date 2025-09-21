/**
 * useExport 훅 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExport } from '../hooks/useExport';
import type { ScenarioExportData, PromptExportData } from '../types';

// Mock export utilities
vi.mock('../utils', () => ({
  exportScenarioToPDF: vi.fn(),
  exportScenarioToExcel: vi.fn(),
  exportPromptToExcel: vi.fn()
}));

import {
  exportScenarioToPDF,
  exportScenarioToExcel,
  exportPromptToExcel
} from '../utils';

const mockExportScenarioToPDF = vi.mocked(exportScenarioToPDF);
const mockExportScenarioToExcel = vi.mocked(exportScenarioToExcel);
const mockExportPromptToExcel = vi.mocked(exportPromptToExcel);

describe('useExport', () => {
  const mockScenarioData: ScenarioExportData = {
    title: '테스트 시나리오',
    shots: [],
    metadata: {
      createdAt: '2024-01-01T00:00:00Z'
    }
  };

  const mockPromptData: PromptExportData = {
    projectName: '테스트 프로젝트',
    prompts: [],
    metadata: {
      totalPrompts: 0,
      exportedAt: '2024-01-01 00:00:00'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useExport());

    expect(result.current.exportState.status).toBe('idle');
    expect(result.current.exportState.progress).toBe(0);
    expect(result.current.isExporting).toBe(false);
  });

  it('should handle successful scenario PDF export', async () => {
    const mockSuccessResult = {
      success: true,
      fileName: 'test.pdf',
      downloadUrl: 'blob:test-url'
    };

    mockExportScenarioToPDF.mockResolvedValue(mockSuccessResult);

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useExport({ onSuccess }));

    await act(async () => {
      const promise = result.current.exportScenario(mockScenarioData, 'pdf');

      // Fast-forward through the timer delays
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(300);

      await promise;
    });

    expect(result.current.exportState.status).toBe('completed');
    expect(result.current.exportState.progress).toBe(100);
    expect(onSuccess).toHaveBeenCalledWith(mockSuccessResult);
    expect(mockExportScenarioToPDF).toHaveBeenCalledWith(
      mockScenarioData,
      expect.objectContaining({ format: 'pdf' })
    );
  });

  it('should handle successful scenario Excel export', async () => {
    const mockSuccessResult = {
      success: true,
      fileName: 'test.xlsx',
      downloadUrl: 'blob:test-url'
    };

    mockExportScenarioToExcel.mockResolvedValue(mockSuccessResult);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      const promise = result.current.exportScenario(mockScenarioData, 'excel');

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(300);

      await promise;
    });

    expect(result.current.exportState.status).toBe('completed');
    expect(mockExportScenarioToExcel).toHaveBeenCalledWith(mockScenarioData);
  });

  it('should handle export errors', async () => {
    const errorMessage = 'Export failed';
    mockExportScenarioToPDF.mockResolvedValue({
      success: false,
      fileName: '',
      error: errorMessage
    });

    const onError = vi.fn();
    const { result } = renderHook(() => useExport({ onError }));

    await act(async () => {
      const promise = result.current.exportScenario(mockScenarioData, 'pdf');

      await vi.advanceTimersByTimeAsync(500);

      await promise;
    });

    expect(result.current.exportState.status).toBe('error');
    expect(result.current.exportState.error).toBe(errorMessage);
    expect(onError).toHaveBeenCalledWith(errorMessage);
  });

  it('should handle prompt export', async () => {
    const mockSuccessResult = {
      success: true,
      fileName: 'prompts.xlsx',
      downloadUrl: 'blob:test-url'
    };

    mockExportPromptToExcel.mockResolvedValue(mockSuccessResult);

    const { result } = renderHook(() => useExport());

    await act(async () => {
      const promise = result.current.exportPrompts(mockPromptData);

      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(300);

      await promise;
    });

    expect(result.current.exportState.status).toBe('completed');
    expect(mockExportPromptToExcel).toHaveBeenCalledWith(mockPromptData);
  });

  it('should reset state', () => {
    const { result } = renderHook(() => useExport());

    act(() => {
      result.current.resetState();
    });

    expect(result.current.exportState.status).toBe('idle');
    expect(result.current.exportState.progress).toBe(0);
    expect(result.current.exportState.error).toBeUndefined();
  });

  it('should track progress through different states', async () => {
    mockExportScenarioToPDF.mockResolvedValue({
      success: true,
      fileName: 'test.pdf',
      downloadUrl: 'blob:test-url'
    });

    const { result } = renderHook(() => useExport());

    const promise = act(async () => {
      return result.current.exportScenario(mockScenarioData, 'pdf');
    });

    // Check preparing state
    expect(result.current.exportState.status).toBe('preparing');
    expect(result.current.exportState.progress).toBe(10);
    expect(result.current.isExporting).toBe(true);

    // Advance timer to generating state
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.exportState.status).toBe('generating');
    expect(result.current.exportState.progress).toBe(30);

    // Complete the export
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await promise;
    });

    expect(result.current.exportState.status).toBe('completed');
    expect(result.current.exportState.progress).toBe(100);
    expect(result.current.isExporting).toBe(false);
  });

  it('should handle unsupported format', async () => {
    const { result } = renderHook(() => useExport());

    await act(async () => {
      // @ts-expect-error Testing invalid format
      const promise = result.current.exportScenario(mockScenarioData, 'invalid');

      await vi.advanceTimersByTimeAsync(500);

      await promise;
    });

    expect(result.current.exportState.status).toBe('error');
    expect(result.current.exportState.error).toContain('지원하지 않는 형식');
  });
});