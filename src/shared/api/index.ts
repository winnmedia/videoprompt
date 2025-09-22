/**
 * Shared API Public API
 *
 * 외부 API와의 통신을 담당하는 모듈들의 진입점입니다.
 * Anti-Corruption Layer 역할을 수행하여 외부 데이터를 내부 도메인 모델로 변환합니다.
 */

export { supabaseClient } from './supabase-client';
export { apiClient } from './api-client';
export { dataTransformers } from './dto-transformers';
export type * from './types';

// Planning API exports
export * from './planning-schemas';
export * from './planning-utils';
