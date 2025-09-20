/**
 * Shared layer public API exports
 * FSD 아키텍처에 따라 shared 레이어의 모든 공개 인터페이스를 제공합니다.
 */

// Core utilities and functions
export * from './lib';

// Common type definitions
export * from './types';

// Data validation schemas
export * from './schemas';

// Reusable hooks
export * from './hooks';

// UI store actions - Public API 노출 (moved to app layer)
// export { addToast, removeToast, clearAllToasts as clearToasts } from '../app/store/ui-slice';