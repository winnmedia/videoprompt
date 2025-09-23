/**
 * TypedStorage - 타입 안전한 localStorage 래퍼
 * 테스트 환경에서 모킹 가능하도록 설계
 */

export const STORAGE_KEYS = {
  USER: 'videoprompt:user',
  PREFERENCES: 'videoprompt:preferences',
  THEME: 'videoprompt:theme',
  SESSION: 'videoprompt:session',
} as const;

export interface TypedStorageInterface {
  getItem<T>(key: string): T | null;
  setItem<T>(key: string, value: T): void;
  removeItem(key: string): void;
  clear(): void;
}

class TypedStorageImpl implements TypedStorageInterface {
  getItem<T>(key: string): T | null {
    try {
      if (typeof window === 'undefined') return null;

      const item = localStorage.getItem(key);
      if (item === null) return null;

      return JSON.parse(item) as T;
    } catch (error) {
      console.warn(`Failed to get item ${key}:`, error);
      return null;
    }
  }

  setItem<T>(key: string, value: T): void {
    try {
      if (typeof window === 'undefined') return;

      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to set item ${key}:`, error);
    }
  }

  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined') return;

      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove item ${key}:`, error);
    }
  }

  clear(): void {
    try {
      if (typeof window === 'undefined') return;

      localStorage.clear();
    } catch (error) {
      console.warn('Failed to clear storage:', error);
    }
  }
}

export const TypedStorage = new TypedStorageImpl();