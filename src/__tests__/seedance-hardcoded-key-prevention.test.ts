/**
 * $300 사건 재발 방지: 하드코딩된 API 키 사용 금지 테스트
 *
 * 테스트 시나리오:
 * 1. 환경변수 없을 때 → Mock으로 전환 (하드코딩 키 사용 금지)
 * 2. 무효한 키일 때 → Mock으로 전환
 * 3. 프로덕션에서 키 없을 때 → 503 에러 (하드코딩 키 사용 금지)
 * 4. 하드코딩된 키 패턴 감지 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('$300 사건 재발 방지: 하드코딩 키 완전 박멸', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 환경 변수 초기화
    vi.resetModules();
    process.env = { ...originalEnv };

    // 콘솔 목업 (로그 노이즈 방지)
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('환경변수 없을 때 하드코딩 키 사용 금지', () => {
    it('개발환경에서 환경변수 없으면 Mock 사용해야 함', async () => {
      // Given: 개발환경이고 API 키 환경변수가 없음
      process.env.NODE_ENV = 'development';
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.MODELARK_API_KEY;
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_API;

      // When: shouldUseMockProvider 호출
      const { shouldUseMockProvider } = await import('@/lib/providers/seedance-validators');
      const shouldUseMock = shouldUseMockProvider();

      // Then: Mock을 사용해야 함
      expect(shouldUseMock).toBe(true);
    });

    it('프로덕션에서 환경변수 없으면 Mock 사용하지 않음 (에러 발생)', async () => {
      // Given: 프로덕션 환경이고 API 키 환경변수가 없음
      process.env.NODE_ENV = 'production';
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.MODELARK_API_KEY;
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_API;

      // When: shouldUseMockProvider 호출
      const { shouldUseMockProvider } = await import('@/lib/providers/seedance-validators');
      const shouldUseMock = shouldUseMockProvider();

      // Then: Mock을 사용하지 않음 (에러 발생시킴)
      expect(shouldUseMock).toBe(false);
    });

    it('API 키 없을 때 createSeedanceVideo가 적절히 에러 처리해야 함', async () => {
      // Given: API 키 환경변수가 없고 Mock 비활성화
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.MODELARK_API_KEY;
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_ENABLE_MOCK_API = 'false'; // Mock 명시적 비활성화

      // When: createSeedanceVideo 호출
      const { createSeedanceVideo } = await import('@/lib/providers/seedance');

      try {
        const result = await createSeedanceVideo({
          prompt: 'test prompt'
        });

        // Then: Mock이 비활성화되었으므로 에러가 반환되어야 함
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Seedance API 키가 설정되지 않았거나 올바르지 않습니다');
      } catch (error) {
        // Throw된 경우에도 에러 메시지 확인
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('Seedance API 키가 설정되지 않았거나 올바르지 않습니다');
      }
    });
  });

  describe('무효한 키일 때 하드코딩 키 사용 금지', () => {
    it('UUID 형식 테스트 키는 무효로 처리되어야 함', async () => {
      // Given: UUID 형식의 테스트 키
      process.env.SEEDANCE_API_KEY = '007f7ffe-84c3-4cdc-b0af-4e00dafdc81c';
      process.env.NODE_ENV = 'development';

      // When: 키 검증
      const { isValidSeedanceApiKey, shouldUseMockProvider } = await import('@/lib/providers/seedance-validators');
      const isValid = isValidSeedanceApiKey(process.env.SEEDANCE_API_KEY);
      const shouldUseMock = shouldUseMockProvider();

      // Then: 무효한 키로 처리되고 Mock 사용
      expect(isValid).toBe(false);
      expect(shouldUseMock).toBe(true);
    });

    it('차단된 테스트 키 패턴은 무효로 처리되어야 함', async () => {
      // Given: 차단된 테스트 키 패턴들
      const blockedKeys = [
        'test-key-12345',
        'mock-key-67890',
        'fake-key-abcdef',
        'demo-key-xyz123'
      ];

      const { isValidSeedanceApiKey } = await import('@/lib/providers/seedance-validators');

      for (const key of blockedKeys) {
        // When: 차단된 키 검증
        process.env.SEEDANCE_API_KEY = key;
        const isValid = isValidSeedanceApiKey(key);

        // Then: 무효한 키로 처리되어야 함
        expect(isValid).toBe(false);
      }
    });

    it('짧은 키는 무효로 처리되어야 함', async () => {
      // Given: 20자 미만의 짧은 키
      const shortKey = 'short123';
      process.env.SEEDANCE_API_KEY = shortKey;

      // When: 키 검증
      const { isValidSeedanceApiKey } = await import('@/lib/providers/seedance-validators');
      const isValid = isValidSeedanceApiKey(shortKey);

      // Then: 무효한 키로 처리되어야 함
      expect(isValid).toBe(false);
    });
  });

  describe('유효한 키 패턴 검증', () => {
    it('ark_ 접두사가 있는 키는 유효해야 함', async () => {
      // Given: ark_ 접두사가 있는 키
      const validKey = 'ark_' + 'a'.repeat(50);
      process.env.SEEDANCE_API_KEY = validKey;

      // When: 키 검증
      const { isValidSeedanceApiKey, shouldUseMockProvider } = await import('@/lib/providers/seedance-validators');
      const isValid = isValidSeedanceApiKey(validKey);
      const shouldUseMock = shouldUseMockProvider();

      // Then: 유효한 키로 처리되지만 테스트 환경에서는 Mock 사용
      expect(isValid).toBe(true);
      expect(shouldUseMock).toBe(true); // 테스트 환경에서는 항상 Mock
    });

    it('50자 이상의 긴 키는 유효해야 함', async () => {
      // Given: 50자 이상의 긴 키
      const validKey = 'a'.repeat(60);
      process.env.SEEDANCE_API_KEY = validKey;

      // When: 키 검증
      const { isValidSeedanceApiKey, shouldUseMockProvider } = await import('@/lib/providers/seedance-validators');
      const isValid = isValidSeedanceApiKey(validKey);
      const shouldUseMock = shouldUseMockProvider();

      // Then: 유효한 키로 처리되지만 테스트 환경에서는 Mock 사용
      expect(isValid).toBe(true);
      expect(shouldUseMock).toBe(true); // 테스트 환경에서는 항상 Mock
    });
  });

  describe('Mock 명시적 활성화', () => {
    it('NEXT_PUBLIC_ENABLE_MOCK_API=true면 강제로 Mock 사용', async () => {
      // Given: Mock API 명시적 활성화
      process.env.NEXT_PUBLIC_ENABLE_MOCK_API = 'true';
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(50); // 유효한 키도 있음

      // When: shouldUseMockProvider 호출
      const { shouldUseMockProvider } = await import('@/lib/providers/seedance-validators');
      const shouldUseMock = shouldUseMockProvider();

      // Then: 유효한 키가 있어도 Mock 사용
      expect(shouldUseMock).toBe(true);
    });
  });

  describe('API 키 상태 디버깅 정보', () => {
    it('getApiKeyStatus가 정확한 상태 정보를 반환해야 함', async () => {
      // Given: 특정 환경 설정 (테스트 환경의 특성 고려)
      process.env.SEEDANCE_API_KEY = 'ark_valid_key_12345678901234567890123456789012345678901234567890';
      process.env.NODE_ENV = 'test'; // 실제 테스트 환경 반영
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_API; // Mock 강제 비활성화

      // When: API 키 상태 조회
      const { getApiKeyStatus } = await import('@/lib/providers/seedance-validators');
      const status = getApiKeyStatus();

      // Then: 정확한 상태 정보 반환 (테스트 환경 특성 반영)
      expect(status.hasApiKey).toBe(true);
      expect(status.keySource).toBe('SEEDANCE_API_KEY');
      expect(status.keyFormat).toMatch(/^ark_vali\.\.\.[a-zA-Z0-9]{8}$/);  // 실제 포맷에 맞게 수정
      expect(status.isValid).toBe(true);
      // 테스트 환경에서는 항상 Mock 사용
      expect(status.shouldUseMock).toBe(true);
      expect(status.environment).toBe('test'); // 실제 환경 반영
      expect(status.mockExplicitlyEnabled).toBe(false);
    });
  });

  describe('하드코딩 키 감지 회귀 테스트', () => {
    it('seedance.ts에서 하드코딩된 키 문자열이 없어야 함', async () => {
      // Given: seedance.ts 파일 내용
      const fs = await import('fs');
      const path = await import('path');
      const seedanceFilePath = path.resolve(process.cwd(), 'src/lib/providers/seedance.ts');
      const fileContent = fs.readFileSync(seedanceFilePath, 'utf-8');

      // When: 하드코딩된 키 패턴 검색
      const hardcodedKeyPatterns = [
        /Bearer\s+[a-zA-Z0-9_-]{20,}/g,  // Bearer 토큰 패턴
        /api[_-]?key[^=]*=\s*['"][^'"]+['"]/gi,  // api_key= 패턴
        /['"][a-f0-9-]{36}['"]/g,  // UUID 패턴
        /ark_[a-zA-Z0-9_-]{20,}/g,  // ark_ 접두사 키 패턴
      ];

      // Then: 하드코딩된 키가 없어야 함
      for (const pattern of hardcodedKeyPatterns) {
        const matches = fileContent.match(pattern);
        if (matches) {
          // 환경변수 참조나 주석은 허용
          const validMatches = matches.filter(match =>
            !match.includes('process.env') &&
            !match.includes('//') &&
            !match.includes('/*') &&
            !match.includes('환경변수') &&
            !match.includes('example')
          );
          expect(validMatches).toHaveLength(0);
        }
      }
    });
  });
});