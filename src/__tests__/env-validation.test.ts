/**
 * 환경변수 검증 시스템 테스트
 *
 * RED 단계: 환경변수 검증 및 보안 기본값 설정
 * - Zod 스키마를 통한 런타임 검증
 * - 필수 환경변수 누락 시 에러
 * - 잘못된 형식 검증
 * - 보안 기본값 제공
 */

import { EnvValidator } from '../shared/config/env-validator';

describe('EnvValidator - 환경변수 검증', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // 환경변수 초기화
    delete process.env.DATABASE_URL;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.NODE_ENV;
    delete process.env.DEBUG;
    delete process.env.API_RATE_LIMIT;
    delete process.env.GEMINI_API_KEY;
    delete process.env.SCENARIO_GENERATION_TIMEOUT;
    delete process.env.STORY_CACHE_TTL;
    delete process.env.MAX_STORY_LENGTH;
    delete process.env.MAX_SCENES_PER_STORY;

    // EnvValidator 초기화
    EnvValidator.reset();
  });

  afterEach(() => {
    process.env = originalEnv;
    EnvValidator.reset();
  });

  describe('필수 환경변수 검증', () => {
    it('모든 필수 환경변수가 있으면 검증을 통과해야 한다', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long';
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';

      const result = EnvValidator.validate();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.DATABASE_URL).toBe('postgresql://localhost:5432/test');
        expect(result.data.NEXTAUTH_SECRET).toBe('test-secret-at-least-32-characters-long');
      }
    });

    it('DATABASE_URL이 누락되면 에러를 반환해야 한다', () => {
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long';
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('DATABASE_URL');
      }
    });

    it('NEXTAUTH_SECRET이 32자 미만이면 에러를 반환해야 한다', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'short'; // 32자 미만
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('NEXTAUTH_SECRET');
        expect(result.error.issues[0].message).toContain('32');
      }
    });

    it('잘못된 URL 형식이면 에러를 반환해야 한다', () => {
      process.env.DATABASE_URL = 'invalid-url';
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long';
      process.env.NEXTAUTH_URL = 'not-a-url';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.issues.map(issue => issue.message);
        expect(errorMessages.some(msg => msg.includes('URL'))).toBe(true);
      }
    });
  });

  describe('보안 기본값', () => {
    it('NODE_ENV가 설정되지 않으면 development를 기본값으로 사용해야 한다', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long';
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      delete process.env.NODE_ENV;

      const result = EnvValidator.validate();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('development');
      }
    });

    it('API_RATE_LIMIT이 설정되지 않으면 기본값을 사용해야 한다', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long';
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';

      const result = EnvValidator.validate();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.API_RATE_LIMIT).toBe(30); // 분당 30회 기본값
        expect(result.data.API_HOURLY_LIMIT).toBe(300); // 시간당 300회 기본값
      }
    });

    it('잘못된 숫자 형식이면 에러를 반환해야 한다', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long';
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.API_RATE_LIMIT = 'not-a-number';

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('API_RATE_LIMIT');
      }
    });
  });

  describe('보안 검증', () => {
    it('프로덕션 환경에서 DEBUG가 활성화되어 있으면 경고해야 한다', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'Super-Secure-Production-Secret-123!@#$%^&*()_+ABCDEFabcdef';
      process.env.NEXTAUTH_URL = 'https://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.NODE_ENV = 'production';
      process.env.DEBUG = 'true';

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      EnvValidator.validate();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('프로덕션 환경에서 DEBUG가 활성화')
      );

      consoleSpy.mockRestore();
    });

    it('프로덕션 환경에서 약한 시크릿이면 에러를 반환해야 한다', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'weak-secret-for-production-env'; // 약한 시크릿
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.NODE_ENV = 'production';

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasSecurityError = result.error.issues.some(issue =>
          issue.message.includes('프로덕션') || issue.message.includes('보안')
        );
        expect(hasSecurityError).toBe(true);
      }
    });
  });

  describe('환경별 설정', () => {
    it('개발 환경에서는 HTTPS가 필수가 아니어야 한다', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long';
      process.env.NEXTAUTH_URL = 'http://localhost:3000'; // HTTP OK in dev
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.NODE_ENV = 'development';

      const result = EnvValidator.validate();
      expect(result.success).toBe(true);
    });

    it('프로덕션 환경에서는 HTTPS가 필수여야 한다', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'super-secure-production-secret-with-high-entropy-123456789';
      process.env.NEXTAUTH_URL = 'http://example.com'; // HTTP not OK in prod
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.NODE_ENV = 'production';

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasHttpsError = result.error.issues.some(issue =>
          issue.message.includes('HTTPS') || issue.message.includes('https')
        );
        expect(hasHttpsError).toBe(true);
      }
    });
  });

  describe('Gemini API 키 검증', () => {
    beforeEach(() => {
      // 기본 필수 환경변수 설정
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long';
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    });

    it('유효한 Gemini API 키 형식을 허용해야 한다', () => {
      process.env.GEMINI_API_KEY = 'AIzaSyDVZ123456789abcdefghijklmnopqrstuv';

      const result = EnvValidator.validate();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.GEMINI_API_KEY).toBe('AIzaSyDVZ123456789abcdefghijklmnopqrstuv');
      }
    });

    it('잘못된 Gemini API 키 형식은 에러를 반환해야 한다', () => {
      process.env.GEMINI_API_KEY = 'invalid-gemini-key-format';

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasGeminiError = result.error.issues.some(issue =>
          issue.message.includes('GEMINI_API_KEY') && issue.message.includes('AIza')
        );
        expect(hasGeminiError).toBe(true);
      }
    });

    it('Gemini API 키가 없어도 검증을 통과해야 한다 (선택사항)', () => {
      delete process.env.GEMINI_API_KEY;

      const result = EnvValidator.validate();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.GEMINI_API_KEY).toBeUndefined();
      }
    });
  });

  describe('시나리오 기획 설정 검증', () => {
    beforeEach(() => {
      // 기본 필수 환경변수 설정
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long';
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    });

    it('시나리오 기획 설정의 기본값을 올바르게 설정해야 한다', () => {
      const result = EnvValidator.validate();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.SCENARIO_GENERATION_TIMEOUT).toBe(60000); // 60초
        expect(result.data.STORY_CACHE_TTL).toBe(3600); // 1시간
        expect(result.data.MAX_STORY_LENGTH).toBe(5000); // 5000자
        expect(result.data.MAX_SCENES_PER_STORY).toBe(20); // 20개
      }
    });

    it('커스텀 시나리오 설정을 올바르게 파싱해야 한다', () => {
      process.env.SCENARIO_GENERATION_TIMEOUT = '30000';
      process.env.STORY_CACHE_TTL = '1800';
      process.env.MAX_STORY_LENGTH = '3000';
      process.env.MAX_SCENES_PER_STORY = '15';

      const result = EnvValidator.validate();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.SCENARIO_GENERATION_TIMEOUT).toBe(30000);
        expect(result.data.STORY_CACHE_TTL).toBe(1800);
        expect(result.data.MAX_STORY_LENGTH).toBe(3000);
        expect(result.data.MAX_SCENES_PER_STORY).toBe(15);
      }
    });

    it('시나리오 생성 타임아웃이 범위를 벗어나면 에러를 반환해야 한다', () => {
      process.env.SCENARIO_GENERATION_TIMEOUT = '400000'; // 5분 초과

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasTimeoutError = result.error.issues.some(issue =>
          issue.path?.includes('SCENARIO_GENERATION_TIMEOUT')
        );
        expect(hasTimeoutError).toBe(true);
      }
    });

    it('스토리 캐시 TTL이 범위를 벗어나면 에러를 반환해야 한다', () => {
      process.env.STORY_CACHE_TTL = '100000'; // 24시간 초과

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasCacheError = result.error.issues.some(issue =>
          issue.path?.includes('STORY_CACHE_TTL')
        );
        expect(hasCacheError).toBe(true);
      }
    });

    it('최대 스토리 길이가 범위를 벗어나면 에러를 반환해야 한다', () => {
      process.env.MAX_STORY_LENGTH = '60000'; // 50000자 초과

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasLengthError = result.error.issues.some(issue =>
          issue.path?.includes('MAX_STORY_LENGTH')
        );
        expect(hasLengthError).toBe(true);
      }
    });

    it('최대 씬 개수가 범위를 벗어나면 에러를 반환해야 한다', () => {
      process.env.MAX_SCENES_PER_STORY = '150'; // 100개 초과

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasScenesError = result.error.issues.some(issue =>
          issue.path?.includes('MAX_SCENES_PER_STORY')
        );
        expect(hasScenesError).toBe(true);
      }
    });

    it('잘못된 숫자 형식의 시나리오 설정은 에러를 반환해야 한다', () => {
      process.env.SCENARIO_GENERATION_TIMEOUT = 'not-a-number';

      const result = EnvValidator.validate();
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasParsingError = result.error.issues.some(issue =>
          issue.path?.includes('SCENARIO_GENERATION_TIMEOUT')
        );
        expect(hasParsingError).toBe(true);
      }
    });
  });

  describe('환경변수 검증 요약 출력', () => {
    it('시나리오 기획 설정을 포함한 검증 요약을 출력해야 한다', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters-long';
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.GEMINI_API_KEY = 'AIzaSyDVZ123456789abcdefghijklmnopqrstuv';

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      EnvValidator.validate();
      EnvValidator.printValidationSummary();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('시나리오 생성 타임아웃')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('스토리 캐시 TTL')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('최대 스토리 길이')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('최대 씬 수')
      );

      consoleSpy.mockRestore();
    });
  });
});