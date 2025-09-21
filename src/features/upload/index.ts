/**
 * Upload Feature Public API
 * FSD Architecture - Features Layer
 */

// Hooks
export { useFileUpload } from './hooks/useFileUpload';
export type { UploadState } from './hooks/useFileUpload';

// Components
export { FileUploadZone } from './ui/FileUploadZone';

// Re-export utilities from shared layer
export {
  formatFileSize,
  sanitizeFileName,
  isValidVideoFile,
  isFileSizeValid,
  createFileChunks,
  calculateProgress,
  createUploadSession,
  calculateFileChecksum,
  DEFAULT_CHUNK_SIZE,
  MAX_FILE_SIZE,
  SUPPORTED_VIDEO_TYPES,
  type UploadProgress,
  type UploadSession,
  type UploadChunk,
  type RetryConfig,
} from '@/shared/lib/upload-utils';