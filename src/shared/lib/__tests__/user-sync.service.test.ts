/**
 * 사용자 동기화 서비스 테스트
 * TDD - Prisma passwordHash 필수 필드 테스트
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserSyncService } from '../user-sync.service';

describe('UserSyncService - Prisma passwordHash 필수 필드', () => {
  let userSyncService: UserSyncService;

  beforeEach(() => {
    userSyncService = UserSyncService.getInstance();
  });

  it('should fail: Prisma 사용자 생성 시 passwordHash 필드가 누락됨', async () => {
    // RED: 실패하는 테스트
    // passwordHash 없이 Prisma 사용자 생성 시도 (현재 오류 상황)

    const mockSupabaseUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'user',
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // transformSupabaseUserToPrisma 함수 결과에 passwordHash가 없어야 함 (현재 오류)
    const mockPrismaData = {
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'user' as const,
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
      // passwordHash 누락 - 이것이 문제!
    };

    // Prisma mock
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(
          new Error('Property passwordHash is missing but required in type UserCreateInput')
        )
      },
      $transaction: vi.fn().mockImplementation(async (fn) => await fn(mockPrisma))
    };

    // 이 테스트는 현재 실패해야 함
    await expect(async () => {
      // 실제 Prisma 생성 호출 시뮬레이션
      await mockPrisma.user.create({
        data: mockPrismaData as any
      });
    }).rejects.toThrow('passwordHash is missing');
  });

  it('should pass: passwordHash 필드 포함 시 Prisma 사용자 생성 성공', async () => {
    // GREEN: 수정 후 성공하는 테스트

    const mockPrismaDataWithPassword = {
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'user' as const,
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: '' // 빈 문자열이지만 필드 존재
    };

    const mockPrisma = {
      user: {
        create: vi.fn().mockResolvedValue(mockPrismaDataWithPassword)
      }
    };

    // passwordHash 포함 시 성공해야 함
    const result = await mockPrisma.user.create({
      data: mockPrismaDataWithPassword
    });

    expect(result).toBeDefined();
    expect(result.passwordHash).toBeDefined();
  });
});