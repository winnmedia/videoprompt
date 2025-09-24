/**
 * Common Utility Functions
 * 프로젝트 전반에서 사용되는 공통 유틸리티 함수들
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tailwind CSS 클래스 병합 (clsx + tailwind-merge)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 딜레이 함수 (async/await 호환)
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 안전한 JSON 파싱
export function safeJsonParse<T = unknown>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

// 문자열 잘라내기 (말줄임표 추가)
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

// 바이트 크기를 읽기 쉬운 형태로 변환
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 깊은 복사 (deep clone)
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

// 디바운스 함수 생성
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 스로틀 함수 생성
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// 랜덤 ID 생성
export function generateId(prefix = '', length = 8): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return prefix ? `${prefix}_${result}` : result;
}

// 객체에서 빈 값 제거
export function removeEmptyValues<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};

  for (const key in obj) {
    const value = obj[key];
    if (value !== null && value !== undefined && value !== '') {
      result[key] = value;
    }
  }

  return result;
}

// 배열을 청크로 나누기
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// 배열 요소 중복 제거 (고유값만)
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

// 배열을 키로 그룹화
export function groupBy<T, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const group = String(item[key]);
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
}

// 숫자를 쉼표가 포함된 문자열로 변환
export function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR');
}

// URL 안전 문자열 생성 (슬러그)
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // 특수문자 제거
    .replace(/[\s_-]+/g, '-') // 공백과 언더스코어를 하이픈으로
    .replace(/^-+|-+$/g, ''); // 앞뒤 하이픈 제거
}

// 파일 확장자 추출
export function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

// 이메일 형식 검증
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// URL 형식 검증
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// 한글 포함 여부 검증
export function hasKorean(text: string): boolean {
  const koreanRegex = /[가-힣]/;
  return koreanRegex.test(text);
}

// 비밀번호 강도 검증
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('비밀번호는 최소 8자 이상이어야 합니다');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('대문자를 포함해야 합니다');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('소문자를 포함해야 합니다');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('숫자를 포함해야 합니다');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('특수문자를 포함해야 합니다');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
