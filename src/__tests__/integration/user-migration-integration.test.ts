/**
 * 사용자 마이그레이션 통합 테스트
 * CI/CD 파이프라인에서 실행되는 자동화 테스트
 *
 * 목적:
 * 1. 마이그레이션 프로세스 전체 검증
 * 2. 실제 DB 스키마와의 호환성 확인
 * 3. 성능 및 안정성 검증
 * 4. 롤백 시나리오 검증
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  UserMigrationService,
  createUserMigrationService,
} from '@/shared/lib/user-migration.service';
import {
  UserSyncService,
  createUserSyncService,
} from '@/shared/lib/user-sync.service';

// 테스트용 Prisma 클라이언트 (별도 테스트 DB 사용)
let testPrisma: PrismaClient;
let migrationService: UserMigrationService;
let syncService: UserSyncService;

// 테스트 데이터
const TEST_USERS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'user1@test.com',
    email_confirmed_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    user_metadata: { username: 'testuser1' },
    app_metadata: { role: 'user' },
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'user2@test.com',
    email_confirmed_at: null,
    created_at: '2024-01-02T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
    user_metadata: { username: 'testuser2' },
    app_metadata: { role: 'user' },
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'admin@test.com',
    email_confirmed_at: '2024-01-03T00:00:00.000Z',
    created_at: '2024-01-03T00:00:00.000Z',
    updated_at: '2024-01-03T00:00:00.000Z',
    user_metadata: { username: 'admin' },
    app_metadata: { role: 'admin' },
  },
];

describe('사용자 마이그레이션 통합 테스트', () => {
  beforeAll(async () => {
    // 테스트 환경 설정
    const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

    if (!testDatabaseUrl) {
      throw new Error('TEST_DATABASE_URL 또는 DATABASE_URL 환경변수가 필요합니다');
    }

    testPrisma = new PrismaClient({
      datasources: {
        db: { url: testDatabaseUrl },
      },
    });

    migrationService = createUserMigrationService(testPrisma);
    syncService = createUserSyncService(testPrisma);

    // DB 연결 확인
    await testPrisma.$connect();
    console.log('🔗 테스트 DB 연결 완료');
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    // 테스트 전 데이터 정리
    await testPrisma.user.deleteMany({
      where: {
        id: {
          in: TEST_USERS.map(u => u.id),
        },
      },
    });
  });

  describe('1. 기본 마이그레이션 프로세스 검증', () => {
    test('단일 사용자 동기화 성공', async () => {
      const testUser = TEST_USERS[0];

      // Mock Supabase 응답
      const mockSupabaseAdmin = {
        auth: {
          admin: {
            getUserById: jest.fn().mockResolvedValue({
              data: { user: testUser },
              error: null,
            }),
          },
        },
      };

      // 동기화 실행
      const syncResult = await syncService.syncUser({
        supabaseUserId: testUser.id,
        email: testUser.email,
        emailConfirmed: Boolean(testUser.email_confirmed_at),
        userMetadata: testUser.user_metadata,
        syncReason: 'signup',
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.created).toBe(true);
      expect(syncResult.syncedFields).toContain('email');

      // DB에 실제로 저장되었는지 확인
      const savedUser = await testPrisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(savedUser).not.toBeNull();
      expect(savedUser?.email).toBe(testUser.email);
      expect(savedUser?.username).toBe('testuser1');
      expect(savedUser?.emailVerified).toBe(true);
    });

    test('중복 사용자 업데이트 처리', async () => {
      const testUser = TEST_USERS[0];

      // 먼저 사용자 생성
      await testPrisma.user.create({
        data: {
          id: testUser.id,
          email: testUser.email,
          username: 'oldusername',
          role: 'user',
          emailVerified: false,
          passwordHash: 'supabase_managed',
        },
      });

      // 업데이트된 정보로 동기화
      const syncResult = await syncService.syncUser({
        supabaseUserId: testUser.id,
        email: testUser.email,
        emailConfirmed: true,
        userMetadata: { username: 'newusername' },
        syncReason: 'profile_update',
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.created).toBe(false); // 업데이트
      expect(syncResult.syncedFields).toContain('username');

      // 업데이트 확인
      const updatedUser = await testPrisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(updatedUser?.username).toBe('newusername');
      expect(updatedUser?.emailVerified).toBe(true);
    });
  });

  describe('2. 데이터 무결성 검증', () => {
    test('무결성 검증 프로세스', async () => {
      // 테스트 데이터 설정
      await testPrisma.user.createMany({
        data: TEST_USERS.map(user => ({
          id: user.id,
          email: user.email,
          username: user.user_metadata.username,
          role: user.app_metadata.role as 'user' | 'admin',
          emailVerified: Boolean(user.email_confirmed_at),
          passwordHash: 'supabase_managed',
        })),
      });

      const integrityResult = await migrationService.verifyDataIntegrity();

      expect(integrityResult.isValid).toBe(true);
      expect(integrityResult.statistics.totalPrismaUsers).toBe(3);
      expect(integrityResult.statistics.duplicateEmails).toBe(0);
      expect(integrityResult.issues).toHaveLength(0);
    });

    test('중복 이메일 검출', async () => {
      // 중복 이메일로 사용자 생성
      await testPrisma.user.createMany({
        data: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            email: 'duplicate@test.com',
            username: 'user1',
            role: 'user',
            emailVerified: true,
            passwordHash: 'hash1',
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            email: 'duplicate@test.com', // 중복!
            username: 'user2',
            role: 'user',
            emailVerified: true,
            passwordHash: 'hash2',
          },
        ],
      });

      const integrityResult = await migrationService.verifyDataIntegrity();

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.statistics.duplicateEmails).toBeGreaterThan(0);
      expect(integrityResult.issues.some(issue => issue.includes('중복'))).toBe(true);
    });
  });

  describe('3. 배치 처리 및 성능 검증', () => {
    test('배치 처리 성능 (소규모)', async () => {
      const startTime = performance.now();

      // 50명의 가상 사용자 생성
      const batchUsers = Array.from({ length: 50 }, (_, i) => ({
        id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
        email: `batch${i}@test.com`,
        username: `batchuser${i}`,
        role: 'user' as const,
        emailVerified: true,
        passwordHash: 'supabase_managed',
      }));

      await testPrisma.user.createMany({ data: batchUsers });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // 50명 배치 처리가 1초 이내에 완료되어야 함
      expect(executionTime).toBeLessThan(1000);

      // 데이터 검증
      const userCount = await testPrisma.user.count({
        where: {
          email: { startsWith: 'batch' },
        },
      });

      expect(userCount).toBe(50);
    });

    test('메모리 사용량 모니터링', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 대량 동기화 시뮬레이션
      const promises = Array.from({ length: 100 }, async (_, i) => {
        const user = {
          id: `mem-${i.toString().padStart(4, '0')}-0000-0000-0000-000000000000`,
          email: `memory${i}@test.com`,
          username: `memoryuser${i}`,
          role: 'user' as const,
          emailVerified: true,
          passwordHash: 'supabase_managed',
        };

        return testPrisma.user.create({ data: user });
      });

      await Promise.all(promises);

      // 강제 GC
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 메모리 증가가 50MB 이하여야 함
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('4. 에러 처리 및 복구 검증', () => {
    test('DB 연결 실패 처리', async () => {
      // 잘못된 DB 클라이언트로 서비스 생성
      const invalidPrisma = new PrismaClient({
        datasources: {
          db: { url: 'postgresql://invalid:invalid@invalid:5432/invalid' },
        },
      });

      const invalidService = createUserSyncService(invalidPrisma);

      const syncResult = await invalidService.syncUser({
        supabaseUserId: TEST_USERS[0].id,
        email: TEST_USERS[0].email,
        emailConfirmed: true,
        userMetadata: {},
        syncReason: 'login',
      });

      expect(syncResult.success).toBe(false);

      await invalidPrisma.$disconnect();
    });

    test('트랜잭션 롤백 검증', async () => {
      const testUser = TEST_USERS[0];

      // 트랜잭션 중 실패 시뮬레이션을 위한 Mock
      const mockPrisma = {
        ...testPrisma,
        $transaction: jest.fn().mockRejectedValue(new Error('Transaction failed')),
      };

      const mockService = createUserSyncService(mockPrisma as any);

      const syncResult = await mockService.syncUser({
        supabaseUserId: testUser.id,
        email: testUser.email,
        emailConfirmed: true,
        userMetadata: testUser.user_metadata,
        syncReason: 'signup',
      });

      expect(syncResult.success).toBe(false);

      // 실제 DB에 데이터가 저장되지 않았는지 확인
      const user = await testPrisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(user).toBeNull();
    });
  });

  describe('5. 특수 데이터 케이스 검증', () => {
    test('특수문자 포함 데이터 처리', async () => {
      const specialUser = {
        id: '44444444-4444-4444-4444-444444444444',
        email: 'special+user@test.com',
        email_confirmed_at: '2024-01-01T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        user_metadata: { username: 'special_user-123' },
        app_metadata: { role: 'user' },
      };

      const syncResult = await syncService.syncUser({
        supabaseUserId: specialUser.id,
        email: specialUser.email,
        emailConfirmed: true,
        userMetadata: specialUser.user_metadata,
        syncReason: 'signup',
      });

      expect(syncResult.success).toBe(true);

      const savedUser = await testPrisma.user.findUnique({
        where: { id: specialUser.id },
      });

      expect(savedUser?.email).toBe('special+user@test.com');
      expect(savedUser?.username).toBe('special_user-123');
    });

    test('긴 데이터 필드 처리', async () => {
      const longDataUser = {
        id: '55555555-5555-5555-5555-555555555555',
        email: 'long@test.com',
        email_confirmed_at: '2024-01-01T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        user_metadata: {
          username: 'a'.repeat(100), // 매우 긴 사용자명
          bio: 'b'.repeat(1000), // 긴 바이오
        },
        app_metadata: { role: 'user' },
      };

      const syncResult = await syncService.syncUser({
        supabaseUserId: longDataUser.id,
        email: longDataUser.email,
        emailConfirmed: true,
        userMetadata: longDataUser.user_metadata,
        syncReason: 'signup',
      });

      // 동기화는 성공하지만 DB 제약 조건에서 처리됨
      expect(syncResult.success).toBe(true);
    });
  });

  describe('6. 동시성 및 경합 조건 검증', () => {
    test('동시 동기화 요청 처리', async () => {
      const testUser = TEST_USERS[0];

      // 동일한 사용자에 대한 동시 동기화 요청
      const syncPromises = Array.from({ length: 5 }, () =>
        syncService.syncUser({
          supabaseUserId: testUser.id,
          email: testUser.email,
          emailConfirmed: true,
          userMetadata: testUser.user_metadata,
          syncReason: 'login',
        })
      );

      const results = await Promise.all(syncPromises);

      // 모든 요청이 성공하거나 안전하게 처리되어야 함
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // DB에는 하나의 사용자만 존재해야 함
      const userCount = await testPrisma.user.count({
        where: { id: testUser.id },
      });

      expect(userCount).toBe(1);
    });
  });
});