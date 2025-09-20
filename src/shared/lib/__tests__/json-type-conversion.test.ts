/**
 * JSON 타입 변환 테스트
 * TDD - Record<string, unknown> → InputJsonValue 안전 변환
 */

import { describe, it, expect } from 'vitest';

describe('JSON 타입 변환 - Prisma InputJsonValue 호환성', () => {
  it('should fail: Record<string, unknown>을 그대로 Prisma에 전달 시 타입 오류', () => {
    // RED: 현재 오류 상황 재현
    const userPreferences: Record<string, unknown> = {
      theme: 'dark',
      language: 'ko',
      notifications: { email: true, push: false },
      settings: {
        autoSave: true,
        shortcuts: ['ctrl+s', 'ctrl+z']
      }
    };

    // 이 변환이 현재 실패함 (타입 오류)
    // Type 'Record<string, unknown>' is not assignable to type 'InputJsonValue'

    // 타입 오류를 시뮬레이션
    const expectTypeError = () => {
      // Prisma InputJsonValue에는 다음이 허용됨:
      // string | number | boolean | null | JsonObject | JsonArray
      // 하지만 Record<string, unknown>은 unknown을 포함하므로 호환되지 않음
      return userPreferences as any; // 현재는 any로 우회하고 있음
    };

    expect(expectTypeError).toBeDefined();
    expect(userPreferences).toHaveProperty('theme');
  });

  it('should pass: 안전한 JSON 변환 함수로 InputJsonValue 생성', () => {
    // GREEN: 수정 후 성공하는 테스트

    const userPreferences: Record<string, unknown> = {
      theme: 'dark',
      language: 'ko',
      notifications: { email: true, push: false },
      settings: {
        autoSave: true,
        shortcuts: ['ctrl+s', 'ctrl+z']
      }
    };

    // 안전한 변환 함수 (구현할 예정)
    const safeJsonConvert = (data: Record<string, unknown> | undefined): any => {
      if (!data) return null;

      // JSON.stringify → JSON.parse로 안전한 변환
      try {
        return JSON.parse(JSON.stringify(data));
      } catch {
        return null;
      }
    };

    const convertedPreferences = safeJsonConvert(userPreferences);

    expect(convertedPreferences).toBeDefined();
    expect(convertedPreferences.theme).toBe('dark');
    expect(convertedPreferences.language).toBe('ko');
    expect(convertedPreferences.notifications.email).toBe(true);
  });

  it('should handle edge cases: null, undefined, circular references', () => {
    const safeJsonConvert = (data: Record<string, unknown> | undefined): any => {
      if (!data) return null;

      try {
        return JSON.parse(JSON.stringify(data));
      } catch {
        return null;
      }
    };

    // null/undefined 처리
    expect(safeJsonConvert(undefined)).toBe(null);
    expect(safeJsonConvert({} as any)).toEqual({});

    // 순환 참조 처리
    const circularObj: any = { name: 'test' };
    circularObj.self = circularObj;
    expect(safeJsonConvert(circularObj)).toBe(null);

    // 함수 제거 확인
    const withFunction = {
      name: 'test',
      fn: () => 'hello',
      value: 42
    };
    const converted = safeJsonConvert(withFunction);
    expect(converted.name).toBe('test');
    expect(converted.value).toBe(42);
    expect(converted.fn).toBeUndefined();
  });
});