/**
 * JSON 타입 변환 유틸리티
 * Prisma InputJsonValue 호환성을 위한 안전한 변환
 */

import { Prisma } from '@prisma/client';
import { logger } from '@/shared/lib/logger';

/**
 * Record<string, unknown>을 Prisma InputJsonValue로 안전하게 변환
 *
 * @param data - 변환할 데이터
 * @returns Prisma InputJsonValue 호환 타입 또는 null
 */
export function toInputJsonValue(
  data: Record<string, unknown> | undefined | null
): Prisma.InputJsonValue {
  if (!data || typeof data !== 'object') {
    return {};
  }

  try {
    // JSON.stringify → JSON.parse로 순환 참조 및 함수 제거
    const serialized = JSON.stringify(data);
    const parsed = JSON.parse(serialized);

    // Prisma InputJsonValue 호환성 확인
    return parsed as Prisma.InputJsonValue;
  } catch (error) {
    logger.debug('JSON 변환 실패, 빈 객체 반환:', error);
    return {};
  }
}

/**
 * 타입 안전한 JSON 객체 생성
 *
 * @param data - 변환할 데이터
 * @returns 안전한 JSON 객체
 */
export function createSafeJsonObject(
  data: Record<string, unknown> | undefined | null
): Record<string, any> | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  try {
    const serialized = JSON.stringify(data);
    return JSON.parse(serialized);
  } catch {
    return null;
  }
}

/**
 * JSON 데이터 검증
 *
 * @param data - 검증할 데이터
 * @returns 유효한 JSON인지 여부
 */
export function isValidJsonData(data: unknown): boolean {
  try {
    JSON.stringify(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * 중첩된 객체에서 함수 제거
 *
 * @param obj - 정리할 객체
 * @returns 함수가 제거된 객체
 */
export function sanitizeForJson(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'function') {
    return undefined;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJson).filter(item => item !== undefined);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedValue = sanitizeForJson(value);
      if (sanitizedValue !== undefined) {
        sanitized[key] = sanitizedValue;
      }
    }
    return sanitized;
  }

  return obj;
}