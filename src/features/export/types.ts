/**
 * Export feature types
 * FSD: features/export/types
 */

export type ExportFormat = 'pdf' | 'excel';

export type ExportStatus = 'idle' | 'preparing' | 'generating' | 'downloading' | 'completed' | 'error';

export interface ExportState {
  status: ExportStatus;
  progress: number;
  error?: string;
  downloadUrl?: string;
}

export interface ExportOptions {
  format: ExportFormat;
  includeImages?: boolean;
  compression?: boolean;
  pageSize?: 'A4' | 'A3' | 'letter';
}

export interface ScenarioExportData {
  title: string;
  description?: string;
  shots: Array<{
    id: string;
    title: string;
    description: string;
    duration?: number;
    location?: string;
    characters?: string[];
    equipment?: string[];
    notes?: string;
  }>;
  metadata: {
    createdAt: string;
    createdBy?: string;
    projectId?: string;
    version?: string;
  };
}

export interface PromptExportData {
  projectName: string;
  prompts: Array<{
    id: string;
    title: string;
    content: string;
    type: 'system' | 'user' | 'assistant';
    category?: string;
    tags?: string[];
    createdAt: string;
    updatedAt?: string;
  }>;
  metadata: {
    totalPrompts: number;
    exportedAt: string;
    projectId?: string;
  };
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  filePath?: string;
  downloadUrl?: string;
  error?: string;
}