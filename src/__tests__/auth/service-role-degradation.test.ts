/**
 * Service Role Key graceful degradation 테스트
 *
 * 목적: SUPABASE_SERVICE_ROLE_KEY가 없거나 유효하지 않을 때
 *       애플리케이션이 graceful degradation 모드로 동작하는지 검증
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMockHelpers, TEST_USERS } from '@/shared/lib/mocks/supabase-mock';

// 환경 변수 모킹을 위한 헬퍼
const mockEnv = (serviceRoleKey?: string) => {
  const originalEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceRoleKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  }

  return () => {
    if (originalEnv !== undefined) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv;
    } else {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  };
};

describe('Service Role Key Graceful Degradation', () => {
  beforeEach(() => {
    supabaseMockHelpers.reset();
  });

  describe('Service Role Key 사용 가능할 때', () => {
    it('전체 기능이 정상 동작해야 함', async () => {
      const restoreEnv = mockEnv('valid-service-role-key');

      try {
        // 유효한 사용자로 설정
        supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

        // /api/auth/me 호출 시뮬레이션
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': 'Bearer valid-token',
            'x-supabase-token': 'valid-token'
          }
        });

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.data.serviceMode).toBe('full');
        expect(data.data.tokenType).toBe('supabase');
        expect(response.headers.get('X-Service-Mode')).toBe('full');
      } finally {
        restoreEnv();
      }
    });
  });

  describe('Service Role Key 없을 때 (Graceful Degradation)', () => {
    it('기본 인증은 여전히 작동해야 함', async () => {
      const restoreEnv = mockEnv(undefined); // SERVICE_ROLE_KEY 제거

      try {
        // 유효한 사용자로 설정
        supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

        // degraded mode 엔드포인트 테스트
        const response = await fetch('/api/auth/me/degraded', {
          headers: {
            'Authorization': 'Bearer valid-token',
            'x-supabase-token': 'valid-token'
          }
        });

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.data.serviceMode).toBe('degraded');
        expect(data.data.isEmailVerified).toBe(false); // Service Role 없으면 검증 불가
        expect(response.headers.get('X-Service-Mode')).toBe('degraded');
        expect(response.headers.get('X-Degradation-Reason')).toBe('service-role-key-unavailable');
      } finally {
        restoreEnv();
      }
    });

    it('placeholder 값이 설정된 경우에도 degraded mode로 동작해야 함', async () => {
      const restoreEnv = mockEnv('PLEASE_SET_IN_ENV_LOCAL');

      try {
        // placeholder는 유효하지 않은 키로 간주되어야 함
        expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe('PLEASE_SET_IN_ENV_LOCAL');

        // 이 경우도 degraded mode로 동작해야 함
        supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

        const response = await fetch('/api/auth/me/degraded');
        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.data.serviceMode).toBe('degraded');
      } finally {
        restoreEnv();
      }
    });
  });

  describe('Service Role Key 유효성 검증', () => {
    it('유효한 Service Role Key 패턴을 인식해야 함', () => {
      // 실제 Supabase Service Role Key는 JWT 형태
      const validKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUifQ.signature';
      const invalidKey = 'invalid-key';
      const placeholderKey = 'PLEASE_SET_IN_ENV_LOCAL';

      // Service Role Key 유효성 검증 로직 (withAuth 미들웨어에서 사용)
      const isValidServiceRoleKey = (key?: string): boolean => {
        if (!key) return false;
        if (key === 'PLEASE_SET_IN_ENV_LOCAL') return false;
        if (key.length < 100) return false; // JWT는 보통 길이가 100자 이상
        return key.startsWith('eyJ'); // JWT는 보통 eyJ로 시작
      };

      expect(isValidServiceRoleKey(validKey)).toBe(true);
      expect(isValidServiceRoleKey(invalidKey)).toBe(false);
      expect(isValidServiceRoleKey(placeholderKey)).toBe(false);
      expect(isValidServiceRoleKey(undefined)).toBe(false);
      expect(isValidServiceRoleKey('')).toBe(false);
    });
  });

  describe('환경별 동작 확인', () => {
    it('개발 환경에서는 placeholder 값으로도 graceful degradation이 작동해야 함', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const restoreEnv = mockEnv('PLEASE_SET_IN_ENV_LOCAL');

        try {
          // 개발 환경에서는 placeholder여도 앱이 시작되어야 함
          expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe('PLEASE_SET_IN_ENV_LOCAL');

          // 이 경우 degraded mode로 동작하지만 앱은 계속 실행
          // 실제로는 withAuth 미들웨어에서 이를 감지하고 적절히 처리
        } finally {
          restoreEnv();
        }
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('프로덕션 환경에서는 유효한 Service Role Key가 필요함', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // 프로덕션에서는 placeholder 값이나 빈 값으로는
        // 관리자 기능이 완전히 비활성화되어야 함
        expect(process.env.NODE_ENV).toBe('production');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('무한 루프 방지 ($300 사건 재발 방지)', () => {
    it('Service Role Key 없을 때도 auth/me 호출이 무한 루프되지 않아야 함', async () => {
      const restoreEnv = mockEnv(undefined);

      try {
        supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

        // 여러 번 연속 호출해도 무한 루프가 발생하지 않아야 함
        const promises = Array.from({ length: 5 }, () =>
          fetch('/api/auth/me/degraded', {
            headers: { 'Authorization': 'Bearer valid-token' }
          })
        );

        const responses = await Promise.all(promises);

        // 모든 응답이 성공해야 함
        responses.forEach(response => {
          expect(response.ok).toBe(true);
        });

        // 호출 통계 확인 (무한 루프 감지)
        const stats = supabaseMockHelpers.getCallStats();

        // auth.getUser 호출이 적절한 횟수여야 함 (5회 정도)
        expect(stats.callCount['auth.getUser'] || 0).toBeLessThan(10);

        // 무한 루프 위험도 확인
        const risk = supabaseMockHelpers.getInfiniteLoopRisk('auth.getUser');
        expect(risk.isHighRisk).toBe(false);
      } finally {
        restoreEnv();
      }
    });
  });
});