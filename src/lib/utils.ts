import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function createTimeRange(start: number, end: number): string {
  return `${formatTimestamp(start)}-${formatTimestamp(end)}`;
}

// AbortController 기반 fetch 타임아웃 유틸
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export function safeJsonParse<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Header overflow 에러 방지를 위한 응답 크기 검증
 * @param data 검증할 데이터
 * @param maxSize 최대 허용 크기 (기본값: 5000)
 * @returns 안전한 데이터 또는 에러 응답
 */
export function validateResponseSize(
  data: any,
  maxSize: number = 5000,
): { safe: boolean; data?: any; error?: string } {
  try {
    const jsonString = JSON.stringify(data);
    if (jsonString.length > maxSize) {
      console.warn(`Response size ${jsonString.length} exceeds limit ${maxSize}`);
      return {
        safe: false,
        error: `Response too large (${jsonString.length} > ${maxSize}) - potential header overflow prevented`,
      };
    }
    return { safe: true, data };
  } catch (error) {
    return {
      safe: false,
      error: `Failed to validate response size: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * 안전한 응답 생성 - Header overflow 방지
 * @param data 원본 데이터
 * @param maxSize 최대 허용 크기
 * @returns 안전한 응답 데이터
 */
export function createSafeResponse(data: any, maxSize: number = 5000): any {
  const validation = validateResponseSize(data, maxSize);
  if (!validation.safe) {
    return {
      ok: false,
      error: validation.error,
      timestamp: new Date().toISOString(),
    };
  }
  return validation.data;
}
