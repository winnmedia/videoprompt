/**
 * Export utilities 테스트
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  downloadFile,
  formatFileSize,
  sanitizeFileName,
  exportScenarioToPDF,
  exportScenarioToExcel,
  exportPromptToExcel
} from '../utils';
import type { ScenarioExportData, PromptExportData } from '../types';

// Mock DOM APIs
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:test-url'),
    revokeObjectURL: vi.fn()
  }
});

// Mock document methods
Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    href: '',
    download: '',
    click: vi.fn(),
    style: {}
  }))
});

Object.defineProperty(document, 'body', {
  value: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
});

describe('Export Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFileName('file<>name')).toBe('file_name');
      expect(sanitizeFileName('file/name')).toBe('file_name');
      expect(sanitizeFileName('file name')).toBe('file_name');
      expect(sanitizeFileName('file__name')).toBe('file_name');
    });

    it('should limit length', () => {
      const longName = 'a'.repeat(150);
      const result = sanitizeFileName(longName);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });

  describe('downloadFile', () => {
    it('should create download link and trigger download', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      const fileName = 'test.txt';

      downloadFile(blob, fileName);

      expect(window.URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();
      expect(window.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportScenarioToPDF', () => {
    const mockScenarioData: ScenarioExportData = {
      title: '테스트 시나리오',
      description: '테스트 설명',
      shots: [
        {
          id: 'shot-1',
          title: '첫 번째 샷',
          description: '첫 번째 샷 설명',
          duration: 10,
          location: '스튜디오',
          characters: ['캐릭터1'],
          equipment: ['카메라'],
          notes: '노트'
        }
      ],
      metadata: {
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'test-user',
        projectId: 'project-1',
        version: '1.0'
      }
    };

    it('should export scenario to PDF successfully', async () => {
      const result = await exportScenarioToPDF(mockScenarioData);

      expect(result.success).toBe(true);
      expect(result.fileName).toContain('scenario_');
      expect(result.fileName).toContain('.pdf');
      expect(result.downloadUrl).toBeDefined();
    });

    it('should handle export errors gracefully', async () => {
      // Test with invalid data that might cause errors
      const invalidData = {
        ...mockScenarioData,
        title: null as any, // Invalid title
        shots: undefined as any // Invalid shots
      };

      const result = await exportScenarioToPDF(invalidData);

      // The function should still return a result, even with problematic data
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.fileName).toBeDefined();
    });
  });

  describe('exportScenarioToExcel', () => {
    const mockScenarioData: ScenarioExportData = {
      title: '테스트 시나리오',
      shots: [
        {
          id: 'shot-1',
          title: '첫 번째 샷',
          description: '첫 번째 샷 설명'
        }
      ],
      metadata: {
        createdAt: '2024-01-01T00:00:00Z'
      }
    };

    it('should export scenario to Excel successfully', async () => {
      const result = await exportScenarioToExcel(mockScenarioData);

      expect(result.success).toBe(true);
      expect(result.fileName).toContain('scenario_');
      expect(result.fileName).toContain('.xlsx');
    });
  });

  describe('exportPromptToExcel', () => {
    const mockPromptData: PromptExportData = {
      projectName: '테스트 프로젝트',
      prompts: [
        {
          id: 'prompt-1',
          title: '테스트 프롬프트',
          content: '프롬프트 내용',
          type: 'user',
          createdAt: '2024-01-01T00:00:00Z'
        }
      ],
      metadata: {
        totalPrompts: 1,
        exportedAt: '2024-01-01 00:00:00'
      }
    };

    it('should export prompts to Excel successfully', async () => {
      const result = await exportPromptToExcel(mockPromptData);

      expect(result.success).toBe(true);
      expect(result.fileName).toContain('prompts_');
      expect(result.fileName).toContain('.xlsx');
    });
  });
});