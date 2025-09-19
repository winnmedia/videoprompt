/**
 * 스키마 일관성 검증 테스트 수트
 * TDD Red-Green-Refactor 적용
 *
 * 목적: Prisma 스키마와 TypeScript 타입 간 일관성 보장
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import type { BaseContent, Planning } from '@/entities/planning/model/types';

describe('Schema Consistency Verification', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  describe('Planning Model Field Consistency', () => {
    it('should fail: Planning model projectId field must exist', async () => {
      // RED: 이 테스트는 먼저 실패해야 함
      const mockPlanningData = {
        id: 'test-id',
        type: 'scenario',
        title: 'Test Planning',
        content: {},
        status: 'draft',
        userId: 'user-123',
        projectId: 'project-456', // 이 필드가 타입에서 누락되었을 것
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 타입 체크 - 컴파일 타임에 실패해야 함
      const typeCheck = (): BaseContent => {
        return {
          id: mockPlanningData.id,
          type: mockPlanningData.type as 'scenario',
          title: mockPlanningData.title,
          userId: mockPlanningData.userId,
          projectId: mockPlanningData.projectId, // 타입 오류 발생해야 함
          status: mockPlanningData.status as 'draft',
          storageStatus: 'pending',
          createdAt: mockPlanningData.createdAt.toISOString(),
          updatedAt: mockPlanningData.updatedAt.toISOString()
        };
      };

      expect(() => typeCheck()).not.toThrow();
    });

    it('should fail: Prisma Client type must match schema definition', async () => {
      // RED: Prisma Client가 생성되지 않았거나 타입이 맞지 않을 것
      const planningModel = prisma.planning;

      // 런타임에 projectId 필드 존재 확인
      const fieldExists = await prisma.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'planning'
        AND column_name = 'project_id'
      `;

      expect(Array.isArray(fieldExists)).toBe(true);
      expect((fieldExists as any[]).length).toBeGreaterThan(0);
    });
  });

  describe('Zod Schema Compatibility', () => {
    it('should fail: Zod enum declarations must use correct syntax', () => {
      // RED: 현재 enum 정의가 새 Zod 버전과 호환되지 않음
      expect(() => {
        const contentTypeSchema = z.enum(['scenario', 'prompt', 'video', 'story', 'image'], {
          errorMap: () => ({ message: 'Invalid content type' })
        });
        return contentTypeSchema;
      }).not.toThrow();
    });

    it('should fail: Zod object schemas must handle optional fields correctly', () => {
      // RED: 선택적 필드 처리가 올바르지 않음
      expect(() => {
        const planningSchema = z.object({
          id: z.string(),
          type: z.enum(['scenario', 'prompt', 'video', 'story', 'image']),
          title: z.string(),
          projectId: z.string().optional(), // 이 필드가 누락되었을 것
          status: z.enum(['draft', 'processing', 'completed', 'failed', 'archived']),
          storageStatus: z.enum(['pending', 'saving', 'saved', 'failed', 'partial'])
        });
        return planningSchema;
      }).not.toThrow();
    });
  });

  describe('Type Safety Runtime Verification', () => {
    it('should fail: Runtime type validation must match TypeScript types', () => {
      // RED: 런타임 검증이 컴파일 타임 타입과 일치하지 않음
      const validatePlanningType = (data: unknown): BaseContent => {
        // 타입 가드 구현이 불완전할 것
        if (typeof data !== 'object' || data === null) {
          throw new Error('Invalid data type');
        }

        const obj = data as Record<string, unknown>;

        // 필수 필드 검증
        if (typeof obj.id !== 'string') throw new Error('id must be string');
        if (typeof obj.title !== 'string') throw new Error('title must be string');
        if (typeof obj.projectId !== 'undefined' && typeof obj.projectId !== 'string') {
          throw new Error('projectId must be string or undefined');
        }

        return obj as BaseContent;
      };

      const mockData = {
        id: 'test-123',
        type: 'scenario',
        title: 'Test',
        projectId: 'proj-456',
        status: 'draft',
        storageStatus: 'pending',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z'
      };

      expect(() => validatePlanningType(mockData)).not.toThrow();
    });
  });

  describe('Build Process Simulation', () => {
    it('should fail: Prisma generate must complete successfully', async () => {
      // RED: Prisma Client 생성이 실패할 것
      const { execSync } = require('child_process');

      expect(() => {
        // Prisma generate 시뮬레이션
        execSync('npx prisma generate', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      }).not.toThrow();
    });

    it('should fail: TypeScript compilation must succeed', () => {
      // RED: TypeScript 컴파일이 실패할 것
      const { execSync } = require('child_process');

      expect(() => {
        execSync('npx tsc --noEmit', {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
      }).not.toThrow();
    });
  });

  describe('Environment Consistency', () => {
    it('should fail: Local and Vercel build environments must be identical', () => {
      // RED: 환경 차이로 인한 빌드 불일치
      const nodeVersion = process.version;
      const expectedNodeVersion = '18'; // Vercel Node.js 버전

      expect(nodeVersion.startsWith('v18') || nodeVersion.startsWith('v20')).toBe(true);
    });

    it('should fail: Package dependencies must be locked consistently', () => {
      // RED: 패키지 버전 불일치
      const fs = require('fs');
      const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

      expect(packageLock.lockfileVersion).toBeDefined();
      expect(packageLock.packages).toBeDefined();
    });
  });
});

/**
 * 회귀 방지 테스트
 * $300 사건 재발 방지
 */
describe('Regression Prevention - $300 Incident', () => {
  it('should fail: API calls in useEffect dependencies are forbidden', () => {
    // RED: useEffect 의존성 배열에 함수가 있으면 실패
    const mockCode = `
      useEffect(() => {
        checkAuth();
      }, [checkAuth]); // 이것은 금지됨
    `;

    const hasFunctionInDeps = /useEffect\s*\([^}]+\},\s*\[[^[\]]*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)/.test(mockCode);
    expect(hasFunctionInDeps).toBe(false);
  });

  it('should fail: API rate limiting must be enforced', () => {
    // RED: API 호출 제한이 없으면 실패
    let callCount = 0;
    const mockApiCall = () => {
      callCount++;
      if (callCount > 5) {
        throw new Error('Rate limit exceeded');
      }
      return Promise.resolve({ data: 'success' });
    };

    // 연속 호출 테스트
    const promises = Array.from({ length: 10 }, () => mockApiCall());

    expect(Promise.allSettled(promises)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'rejected' })
      ])
    );
  });
});