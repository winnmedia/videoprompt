/**
 * API 검증 미들웨어 테스트
 * TDD 원칙: RED → GREEN → REFACTOR
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { 
  validateApiKeys, 
  validateRequestSize, 
  sanitizeInput,
  validateWebhookSignature 
} from '@/shared/lib/api-validation';

describe('API 검증 미들웨어 테스트', () => {
  describe('validateApiKeys', () => {
    const originalEnv = process.env;
    
    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    test('필요한 API 키가 모두 설정된 경우 통과해야 함', () => {
      process.env.GOOGLE_GEMINI_API_KEY = 'test-gemini-key';
      process.env.SEEDANCE_API_KEY = 'test-seedance-key';

      const result = validateApiKeys(['gemini', 'seedance']);
      expect(result.isValid).toBe(true);
    });

    test('필요한 API 키가 누락된 경우 실패해야 함', () => {
      process.env.GOOGLE_GEMINI_API_KEY = '';
      process.env.SEEDANCE_API_KEY = 'test-seedance-key';

      const result = validateApiKeys(['gemini', 'seedance']);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('GEMINI API 키');
    });

    test('빈 배열인 경우 통과해야 함', () => {
      const result = validateApiKeys([]);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateRequestSize', () => {
    test('허용된 크기 내의 요청이 통과해야 함', () => {
      const contentLength = '1048576'; // 1MB
      const result = validateRequestSize(contentLength, 10); // 10MB 제한

      expect(result.isValid).toBe(true);
    });

    test('제한을 초과하는 요청이 차단되어야 함', () => {
      const contentLength = '20971520'; // 20MB
      const result = validateRequestSize(contentLength, 10); // 10MB 제한

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('요청 크기가 너무 큽니다');
    });

    test('Content-Length가 없는 경우 통과해야 함', () => {
      const result = validateRequestSize(null, 10);
      expect(result.isValid).toBe(true);
    });

    test('잘못된 Content-Length 형식이 차단되어야 함', () => {
      const result = validateRequestSize('invalid', 10);
      expect(result.isValid).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    test('HTML 태그가 제거되어야 함', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World';
      const sanitized = sanitizeInput(maliciousInput);

      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<script>');
    });

    test('객체의 모든 속성이 sanitize되어야 함', () => {
      const maliciousObject = {
        name: '<img src="x" onerror="alert()">John',
        description: '<b>Bold</b> text',
        nested: {
          value: '<script>evil()</script>nested'
        }
      };

      const sanitized = sanitizeInput(maliciousObject);

      expect(sanitized.name).toBe('John');
      expect(sanitized.description).toBe('Bold text');
      expect(sanitized.nested.value).toBe('nested');
    });

    test('배열의 모든 요소가 sanitize되어야 함', () => {
      const maliciousArray = [
        '<script>alert(1)</script>item1',
        '<img src="x" onerror="alert()">item2'
      ];

      const sanitized = sanitizeInput(maliciousArray);

      expect(sanitized[0]).toBe('item1');
      expect(sanitized[1]).toBe('item2');
    });

    test('문자열 길이가 제한되어야 함', () => {
      const longString = 'a'.repeat(20000); // 20KB
      const sanitized = sanitizeInput(longString);

      expect(sanitized.length).toBeLessThanOrEqual(10000); // 10KB 제한
    });

    test('키 길이가 제한되어야 함', () => {
      const objectWithLongKeys = {
        ['a'.repeat(200)]: 'value1', // 200자 키 (제한 초과)
        'normalKey': 'value2'
      };

      const sanitized = sanitizeInput(objectWithLongKeys);

      expect(Object.keys(sanitized)).not.toContain('a'.repeat(200));
      expect(sanitized.normalKey).toBe('value2');
    });
  });

  describe('validateWebhookSignature', () => {
    test('유효한 서명이 통과해야 함', () => {
      const payload = 'test-payload';
      const signature = 'valid-signature';
      const secret = 'webhook-secret';

      const result = validateWebhookSignature(payload, signature, secret);
      
      // 현재 기본 구현에서는 길이 검증만 수행
      expect(result).toBe(true);
    });

    test('빈 서명이 실패해야 함', () => {
      const result = validateWebhookSignature('payload', '', 'secret');
      expect(result).toBe(false);
    });

    test('빈 시크릿이 실패해야 함', () => {
      const result = validateWebhookSignature('payload', 'signature', '');
      expect(result).toBe(false);
    });

    test('null 값들이 실패해야 함', () => {
      const result = validateWebhookSignature('payload', null as any, null as any);
      expect(result).toBe(false);
    });
  });
});