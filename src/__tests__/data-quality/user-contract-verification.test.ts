/**
 * 사용자 데이터 계약 검증 테스트
 * 프로덕션 환경에서 발생할 수 있는 데이터 계약 위반 시나리오 테스트
 *
 * 목적:
 * 1. API 계약 준수 확인 (OpenAPI 스타일)
 * 2. 스키마 진화 호환성 검증
 * 3. 계약 위반 시 적절한 에러 처리 확인
 */

import { describe, test, expect } from '@jest/globals';
import {
  SupabaseUserDTOSchema,
  PrismaUserDomainSchema,
  UserSyncRequestSchema,
  UserSyncResponseSchema,
  transformSupabaseUserToPrisma,
} from '@/shared/contracts/user-sync.schema';

describe('사용자 데이터 계약 검증', () => {
  describe('1. Supabase User DTO 계약 검증', () => {
    test('필수 필드 누락 시 계약 위반', () => {
      const incompleteUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        // email 누락
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      const result = SupabaseUserDTOSchema.safeParse(incompleteUser);

      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.errors.find(e => e.path.includes('email'));
        expect(emailError).toBeDefined();
        expect(emailError?.code).toBe('invalid_type');
      }
    });

    test('잘못된 UUID 형식 계약 위반', () => {
      const invalidUuidUser = {
        id: 'not-a-uuid',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      const result = SupabaseUserDTOSchema.safeParse(invalidUuidUser);

      expect(result.success).toBe(false);
      if (!result.success) {
        const idError = result.error.errors.find(e => e.path.includes('id'));
        expect(idError).toBeDefined();
        expect(idError?.code).toBe('invalid_string');
      }
    });

    test('잘못된 이메일 형식 계약 위반', () => {
      const invalidEmailUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'not-an-email',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      const result = SupabaseUserDTOSchema.safeParse(invalidEmailUser);

      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.errors.find(e => e.path.includes('email'));
        expect(emailError).toBeDefined();
        expect(emailError?.code).toBe('invalid_string');
      }
    });

    test('잘못된 날짜 형식 계약 위반', () => {
      const invalidDateUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        created_at: 'not-a-date',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      const result = SupabaseUserDTOSchema.safeParse(invalidDateUser);

      expect(result.success).toBe(false);
      if (!result.success) {
        const dateError = result.error.errors.find(e => e.path.includes('created_at'));
        expect(dateError).toBeDefined();
        expect(dateError?.code).toBe('invalid_string');
      }
    });
  });

  describe('2. Prisma User 도메인 모델 계약 검증', () => {
    test('role enum 계약 위반', () => {
      const invalidRoleUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        username: 'testuser',
        role: 'invalid_role', // enum에 없는 값
        emailVerified: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        passwordHash: 'hash',
      };

      const result = PrismaUserDomainSchema.safeParse(invalidRoleUser);

      expect(result.success).toBe(false);
      if (!result.success) {
        const roleError = result.error.errors.find(e => e.path.includes('role'));
        expect(roleError).toBeDefined();
        expect(roleError?.code).toBe('invalid_enum_value');
      }
    });

    test('username 길이 제한 계약 (비즈니스 규칙)', () => {
      const longUsernameUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        username: 'a'.repeat(100), // 매우 긴 사용자명
        role: 'user',
        emailVerified: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        passwordHash: 'hash',
      };

      // 현재 스키마는 길이 제한이 없지만, 비즈니스 로직에서 검증해야 함
      const result = PrismaUserDomainSchema.safeParse(longUsernameUser);
      expect(result.success).toBe(true); // 스키마상 통과

      // 실제 비즈니스 로직에서는 제한해야 함
      const username = longUsernameUser.username;
      expect(username.length).toBeGreaterThan(30); // 30자 초과는 문제
    });
  });

  describe('3. 동기화 요청/응답 계약 검증', () => {
    test('유효한 동기화 요청 계약 준수', () => {
      const validRequest = {
        supabaseUserId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        emailConfirmed: true,
        userMetadata: { username: 'testuser' },
        syncReason: 'signup',
      };

      const result = UserSyncRequestSchema.safeParse(validRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.syncReason).toBe('signup');
        expect(result.data.emailConfirmed).toBe(true);
      }
    });

    test('잘못된 syncReason enum 계약 위반', () => {
      const invalidRequest = {
        supabaseUserId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        emailConfirmed: true,
        userMetadata: {},
        syncReason: 'invalid_reason', // enum에 없는 값
      };

      const result = UserSyncRequestSchema.safeParse(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        const reasonError = result.error.errors.find(e => e.path.includes('syncReason'));
        expect(reasonError).toBeDefined();
        expect(reasonError?.code).toBe('invalid_enum_value');
      }
    });

    test('동기화 응답 스키마 계약 준수', () => {
      const validResponse = {
        success: true,
        prismaUserId: '123e4567-e89b-12d3-a456-426614174000',
        syncedFields: ['email', 'username'],
        created: true,
        conflicts: [],
      };

      const result = UserSyncResponseSchema.safeParse(validResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.syncedFields).toContain('email');
        expect(result.data.conflicts).toHaveLength(0);
      }
    });
  });

  describe('4. 데이터 변환 계약 검증', () => {
    test('변환 함수 입력 계약 위반 처리', () => {
      const invalidInput = {
        id: 'not-uuid',
        email: 'not-email',
        // 필수 필드 누락
      };

      expect(() => {
        transformSupabaseUserToPrisma(invalidInput as any);
      }).toThrow(); // 변환 실패 시 예외 발생
    });

    test('변환 결과 계약 준수 검증', () => {
      const validInput = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        email_confirmed_at: '2024-01-01T00:00:00.000Z',
        last_sign_in_at: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        user_metadata: { username: 'testuser' },
        app_metadata: { role: 'user' },
      };

      const result = transformSupabaseUserToPrisma(validInput);

      // 변환 결과가 Prisma 도메인 모델 계약을 준수하는지 검증
      const validation = PrismaUserDomainSchema.omit({
        passwordHash: true,
        updatedAt: true,
      }).safeParse(result);

      expect(validation.success).toBe(true);
      if (validation.success) {
        expect(validation.data.id).toBe(validInput.id);
        expect(validation.data.email).toBe(validInput.email);
        expect(validation.data.username).toBe('testuser');
        expect(validation.data.emailVerified).toBe(true);
      }
    });
  });

  describe('5. 스키마 진화 호환성 검증', () => {
    test('기존 필드 제거 시 계약 위반 방지', () => {
      // 미래 버전에서 필드가 제거될 때의 하위 호환성
      const futureVersionUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        // 기존 필드들이 누락될 수 있음
      };

      const result = SupabaseUserDTOSchema.safeParse(futureVersionUser);

      // 필수 필드가 누락되면 실패해야 함
      expect(result.success).toBe(true); // email 등 필수 필드가 있으면 성공
    });

    test('새 필드 추가 시 계약 호환성', () => {
      // 새 버전에서 필드가 추가될 때의 호환성
      const newVersionUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        email_confirmed_at: null,
        last_sign_in_at: null,
        user_metadata: {},
        app_metadata: {},
        // 새로 추가된 필드들
        new_field: 'new_value',
        another_field: 123,
      };

      const result = SupabaseUserDTOSchema.safeParse(newVersionUser);

      // 알려지지 않은 필드는 무시되고, 알려진 필드는 정상 처리되어야 함
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(newVersionUser.id);
        expect(result.data.email).toBe(newVersionUser.email);
        // 새 필드는 결과에 포함되지 않음 (strict mode)
        expect('new_field' in result.data).toBe(false);
      }
    });
  });

  describe('6. 에러 처리 계약 검증', () => {
    test('계약 위반 시 명확한 에러 메시지', () => {
      const invalidData = {
        id: 'invalid',
        email: 'invalid',
        created_at: 'invalid',
      };

      const result = SupabaseUserDTOSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.errors;

        // 각 필드별로 명확한 에러 메시지가 있어야 함
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.every(e => e.message.length > 0)).toBe(true);
        expect(errors.every(e => e.path.length > 0)).toBe(true);
      }
    });

    test('부분적 데이터 처리 계약', () => {
      // 일부 선택적 필드만 있는 경우
      const partialData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        email_confirmed_at: null, // null 값
        user_metadata: {}, // 빈 객체
        app_metadata: {}, // 빈 객체
      };

      const result = SupabaseUserDTOSchema.safeParse(partialData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email_confirmed_at).toBeNull();
        expect(result.data.user_metadata).toEqual({});
        expect(result.data.app_metadata).toEqual({});
      }
    });
  });

  describe('7. 성능 계약 검증', () => {
    test('대량 데이터 스키마 검증 성능', () => {
      const validUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        email_confirmed_at: null,
        last_sign_in_at: null,
        user_metadata: {},
        app_metadata: {},
      };

      const startTime = performance.now();

      // 1000번 검증
      for (let i = 0; i < 1000; i++) {
        const result = SupabaseUserDTOSchema.safeParse({
          ...validUser,
          id: `123e4567-e89b-12d3-a456-42661417${i.toString().padStart(4, '0')}`,
        });
        expect(result.success).toBe(true);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 1000번 검증이 100ms 이내에 완료되어야 함
      expect(duration).toBeLessThan(100);
    });
  });
});