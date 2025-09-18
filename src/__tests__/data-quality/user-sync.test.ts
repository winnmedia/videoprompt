/**
 * 사용자 동기화 데이터 품질 테스트 스위트
 * TDD 원칙에 따른 실패 테스트부터 시작
 *
 * 테스트 범위:
 * 1. 스키마 계약 준수 검증
 * 2. 데이터 변환 정확성 검증
 * 3. 동기화 상태 무결성 검증
 * 4. 에러 상황 처리 검증
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  UserSyncService,
  createUserSyncService,
} from '@/shared/lib/user-sync.service';
import {
  SupabaseUserDTOSchema,
  PrismaUserDomainSchema,
  transformSupabaseUserToPrisma,
  UserDataQualityRules,
  type SupabaseUserDTO,
  type UserSyncRequest,
} from '@/shared/contracts/user-sync.schema';
import {
  validateAndTransformSupabaseUser,
  safeTransformUserToPrisma,
  validateUserDataQuality,
} from '@/shared/api/dto-transformers';

// Mock 데이터 - 고정된 결정론적 테스트 데이터
const MOCK_SUPABASE_USER: SupabaseUserDTO = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  email_confirmed_at: '2024-01-01T00:00:00.000Z',
  last_sign_in_at: '2024-01-15T12:00:00.000Z',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-15T12:00:00.000Z',
  user_metadata: {
    username: 'testuser',
    avatar_url: 'https://example.com/avatar.jpg',
  },
  app_metadata: {
    role: 'user',
  },
};

const MOCK_INVALID_SUPABASE_USER = {
  id: 'invalid-uuid',
  email: 'invalid-email',
  // 필수 필드 누락
};

const MOCK_PRISMA_CLIENT = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('사용자 동기화 데이터 품질 테스트', () => {
  let userSyncService: UserSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    userSyncService = createUserSyncService(MOCK_PRISMA_CLIENT as any);
  });

  describe('1. 스키마 계약 준수 검증', () => {
    test('유효한 Supabase User DTO 검증 성공', () => {
      const result = SupabaseUserDTOSchema.safeParse(MOCK_SUPABASE_USER);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(MOCK_SUPABASE_USER.id);
        expect(result.data.email).toBe(MOCK_SUPABASE_USER.email);
      }
    });

    test('잘못된 Supabase User DTO 검증 실패', () => {
      const result = SupabaseUserDTOSchema.safeParse(MOCK_INVALID_SUPABASE_USER);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.errors;
        expect(errors.some(e => e.path.includes('id'))).toBe(true); // UUID 형식 오류
        expect(errors.some(e => e.path.includes('email'))).toBe(true); // 이메일 형식 오류
      }
    });

    test('변환된 Prisma User 도메인 모델 검증', () => {
      const prismaUserData = transformSupabaseUserToPrisma(MOCK_SUPABASE_USER);

      // 필수 필드 존재 확인
      expect(prismaUserData.id).toBe(MOCK_SUPABASE_USER.id);
      expect(prismaUserData.email).toBe(MOCK_SUPABASE_USER.email);
      expect(prismaUserData.username).toBe('testuser');
      expect(prismaUserData.emailVerified).toBe(true); // email_confirmed_at이 있으면 true
      expect(prismaUserData.role).toBe('user');
    });
  });

  describe('2. 데이터 변환 정확성 검증', () => {
    test('이메일 인증 상태 올바른 변환', () => {
      // 이메일 인증됨
      const confirmedUser = {
        ...MOCK_SUPABASE_USER,
        email_confirmed_at: '2024-01-01T00:00:00.000Z',
      };
      const result = transformSupabaseUserToPrisma(confirmedUser);
      expect(result.emailVerified).toBe(true);
      expect(result.verifiedAt).toBe('2024-01-01T00:00:00.000Z');

      // 이메일 미인증
      const unconfirmedUser = {
        ...MOCK_SUPABASE_USER,
        email_confirmed_at: null,
      };
      const result2 = transformSupabaseUserToPrisma(unconfirmedUser);
      expect(result2.emailVerified).toBe(false);
      expect(result2.verifiedAt).toBeNull();
    });

    test('사용자명 fallback 로직 검증', () => {
      // username이 없는 경우
      const userWithoutUsername = {
        ...MOCK_SUPABASE_USER,
        user_metadata: {},
      };
      const result = transformSupabaseUserToPrisma(userWithoutUsername);
      expect(result.username).toBe('test'); // 이메일 앞부분 사용

      // 이메일도 없는 경우
      const userWithoutEmail = {
        ...MOCK_SUPABASE_USER,
        email: '',
        user_metadata: {},
      };
      const result2 = transformSupabaseUserToPrisma(userWithoutEmail);
      expect(result2.username).toBe('user_123e4567'); // ID 앞부분 사용
    });

    test('역할(role) 변환 검증', () => {
      const adminUser = {
        ...MOCK_SUPABASE_USER,
        app_metadata: { role: 'admin' },
      };
      const result = transformSupabaseUserToPrisma(adminUser);
      expect(result.role).toBe('admin');

      // 잘못된 역할은 기본값으로
      const invalidRoleUser = {
        ...MOCK_SUPABASE_USER,
        app_metadata: { role: 'invalid' },
      };
      const result2 = transformSupabaseUserToPrisma(invalidRoleUser);
      expect(result2.role).toBe('user'); // 기본값
    });
  });

  describe('3. 데이터 품질 검증', () => {
    test('완전한 사용자 데이터 품질 점수 100점', () => {
      const qualityResult = validateUserDataQuality({
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(qualityResult.isValid).toBe(true);
      expect(qualityResult.score).toBe(100);
      expect(qualityResult.issues).toHaveLength(0);
    });

    test('불완전한 데이터의 품질 점수 계산', () => {
      const qualityResult = validateUserDataQuality({
        id: '', // 누락
        email: 'invalid-email', // 잘못된 형식
        username: 'ab', // 너무 짧음
      });

      expect(qualityResult.isValid).toBe(false);
      expect(qualityResult.score).toBeLessThan(50);
      expect(qualityResult.issues.length).toBeGreaterThan(0);
    });

    test('데이터 무결성 규칙 준수 검증', () => {
      // 필수 필드 검증
      expect(UserDataQualityRules.requiredFields).toContain('id');
      expect(UserDataQualityRules.requiredFields).toContain('email');
      expect(UserDataQualityRules.requiredFields).toContain('username');

      // 유니크 제약 조건
      expect(UserDataQualityRules.uniqueConstraints).toContain('email');
      expect(UserDataQualityRules.uniqueConstraints).toContain('username');

      // 임계값 설정
      expect(UserDataQualityRules.syncQualityThresholds.healthy).toBe(95);
      expect(UserDataQualityRules.syncQualityThresholds.critical).toBe(60);
    });
  });

  describe('4. DTO 변환 안전성 검증', () => {
    test('유효한 데이터의 안전한 변환', () => {
      const result = safeTransformUserToPrisma(MOCK_SUPABASE_USER, 'Test Context');

      expect(result).not.toBeNull();
      expect(result?.id).toBe(MOCK_SUPABASE_USER.id);
      expect(result?.email).toBe(MOCK_SUPABASE_USER.email);
    });

    test('잘못된 데이터의 graceful degradation', () => {
      const result = safeTransformUserToPrisma(MOCK_INVALID_SUPABASE_USER, 'Test Context');

      expect(result).toBeNull(); // 실패 시 null 반환
    });

    test('validateAndTransformSupabaseUser 에러 처리', () => {
      expect(() => {
        validateAndTransformSupabaseUser(MOCK_INVALID_SUPABASE_USER, 'Test Context');
      }).toThrow('Test Context 데이터 계약 위반');
    });
  });

  describe('5. 동기화 서비스 통합 테스트', () => {
    test('동기화 요청 스키마 검증', () => {
      const validRequest: UserSyncRequest = {
        supabaseUserId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        emailConfirmed: true,
        userMetadata: { username: 'testuser' },
        syncReason: 'signup',
      };

      expect(() => {
        // 내부적으로 스키마 검증이 수행됨
        userSyncService.syncUser(validRequest);
      }).not.toThrow();
    });

    test('동기화 상태 점수 계산 로직', async () => {
      // Mock 데이터 설정
      MOCK_PRISMA_CLIENT.user.findUnique.mockResolvedValue({
        id: MOCK_SUPABASE_USER.id,
        email: MOCK_SUPABASE_USER.email,
        updatedAt: new Date(),
      });

      const status = await userSyncService.checkSyncStatus(MOCK_SUPABASE_USER.id);

      expect(status.supabaseUserId).toBe(MOCK_SUPABASE_USER.id);
      expect(status.healthScore).toBeGreaterThanOrEqual(0);
      expect(status.healthScore).toBeLessThanOrEqual(100);
    });
  });

  describe('6. 경계값 및 에지 케이스 테스트', () => {
    test('빈 문자열 처리', () => {
      const userWithEmptyStrings = {
        ...MOCK_SUPABASE_USER,
        email: '',
        user_metadata: { username: '' },
      };

      const result = transformSupabaseUserToPrisma(userWithEmptyStrings);
      expect(result.username).not.toBe(''); // 빈 문자열이 아닌 fallback 값
    });

    test('null/undefined 값 처리', () => {
      const userWithNulls = {
        ...MOCK_SUPABASE_USER,
        email_confirmed_at: null,
        user_metadata: null,
        app_metadata: null,
      };

      const result = transformSupabaseUserToPrisma(userWithNulls);
      expect(result.emailVerified).toBe(false);
      expect(result.verifiedAt).toBeNull();
      expect(result.role).toBe('user'); // 기본값
    });

    test('매우 긴 문자열 처리', () => {
      const longString = 'a'.repeat(1000);
      const userWithLongData = {
        ...MOCK_SUPABASE_USER,
        user_metadata: { username: longString },
      };

      // 변환은 성공하지만 나중에 DB 제약 조건에서 걸러짐
      expect(() => {
        transformSupabaseUserToPrisma(userWithLongData);
      }).not.toThrow();
    });
  });

  describe('7. 성능 및 메모리 테스트', () => {
    test('대량 데이터 변환 성능', () => {
      const startTime = performance.now();

      // 1000개 사용자 데이터 변환
      for (let i = 0; i < 1000; i++) {
        const userData = {
          ...MOCK_SUPABASE_USER,
          id: `123e4567-e89b-12d3-a456-42661417${i.toString().padStart(4, '0')}`,
          email: `test${i}@example.com`,
        };
        transformSupabaseUserToPrisma(userData);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // 1000개 변환이 1초 이내에 완료되어야 함
      expect(executionTime).toBeLessThan(1000);
    });

    test('메모리 누수 방지 검증', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 대량 변환 후 가비지 컬렉션
      for (let i = 0; i < 1000; i++) {
        safeTransformUserToPrisma(MOCK_SUPABASE_USER, 'Memory Test');
      }

      // 강제 GC (테스트 환경에서만)
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 메모리 증가가 10MB 이하여야 함
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});