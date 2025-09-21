/**
 * Export 훅
 * FSD: features/export/hooks
 */

'use client';

import { useState, useCallback } from 'react';
import type {
  ExportFormat,
  ExportState,
  ExportOptions,
  ExportResult,
  ScenarioExportData,
  PromptExportData
} from '../types';
import {
  exportScenarioToPDF,
  exportScenarioToExcel,
  exportPromptToExcel
} from '../utils';

interface UseExportOptions {
  onSuccess?: (result: ExportResult) => void;
  onError?: (error: string) => void;
}

export function useExport(options: UseExportOptions = {}) {
  const [exportState, setExportState] = useState<ExportState>({
    status: 'idle',
    progress: 0
  });

  const updateProgress = useCallback((progress: number, status?: ExportState['status']) => {
    setExportState(prev => ({
      ...prev,
      progress,
      ...(status && { status })
    }));
  }, []);

  const resetState = useCallback(() => {
    setExportState({
      status: 'idle',
      progress: 0,
      error: undefined,
      downloadUrl: undefined
    });
  }, []);

  const exportScenario = useCallback(async (
    data: ScenarioExportData,
    format: ExportFormat,
    exportOptions?: ExportOptions
  ) => {
    resetState();

    try {
      // 준비 단계
      setExportState({
        status: 'preparing',
        progress: 10
      });

      await new Promise(resolve => setTimeout(resolve, 500)); // UI 피드백을 위한 지연

      // 생성 단계
      updateProgress(30, 'generating');

      let result: ExportResult;

      if (format === 'pdf') {
        result = await exportScenarioToPDF(data, exportOptions);
      } else if (format === 'excel') {
        result = await exportScenarioToExcel(data);
      } else {
        throw new Error(`지원하지 않는 형식입니다: ${format}`);
      }

      updateProgress(80);

      if (!result.success) {
        throw new Error(result.error || '내보내기에 실패했습니다.');
      }

      // 다운로드 단계
      updateProgress(90, 'downloading');

      await new Promise(resolve => setTimeout(resolve, 300));

      // 완료
      setExportState({
        status: 'completed',
        progress: 100,
        downloadUrl: result.downloadUrl
      });

      options.onSuccess?.(result);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

      setExportState({
        status: 'error',
        progress: 0,
        error: errorMessage
      });

      options.onError?.(errorMessage);

      return {
        success: false,
        fileName: '',
        error: errorMessage
      };
    }
  }, [resetState, updateProgress, options]);

  const exportPrompts = useCallback(async (
    data: PromptExportData
  ) => {
    resetState();

    try {
      setExportState({
        status: 'preparing',
        progress: 10
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      updateProgress(30, 'generating');

      const result = await exportPromptToExcel(data);

      updateProgress(80);

      if (!result.success) {
        throw new Error(result.error || '내보내기에 실패했습니다.');
      }

      updateProgress(90, 'downloading');

      await new Promise(resolve => setTimeout(resolve, 300));

      setExportState({
        status: 'completed',
        progress: 100,
        downloadUrl: result.downloadUrl
      });

      options.onSuccess?.(result);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

      setExportState({
        status: 'error',
        progress: 0,
        error: errorMessage
      });

      options.onError?.(errorMessage);

      return {
        success: false,
        fileName: '',
        error: errorMessage
      };
    }
  }, [resetState, updateProgress, options]);

  return {
    exportState,
    exportScenario,
    exportPrompts,
    resetState,
    isExporting: exportState.status !== 'idle' && exportState.status !== 'completed' && exportState.status !== 'error'
  };
}