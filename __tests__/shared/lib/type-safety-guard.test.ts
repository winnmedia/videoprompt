/**
 * 타입 안전성 가드 테스트
 * TDD Red-Green-Refactor 적용
 *
 * QA Lead Grace - 무관용 타입 안전성 정책
 */

import { describe, it, expect } from '@jest/globals';
import {
  isBaseContent,
  isPlanningContent,
  validateBaseContent,
  validatePlanningContent,
  validatePrismaCompatibility,
  assertBaseContent,
  assertPlanningContent,
  ContentTypeSchema,
  ContentStatusSchema,
  StorageStatusSchema,
  BaseContentSchema,
  PlanningContentSchema
} from '@/shared/lib/type-safety-guard';
import type { BaseContent, ScenarioContent, PromptContent, VideoContent } from '@/entities/planning/model/types';

describe('Type Safety Guard', () => {
  describe('Zod Schema Validation', () => {
    describe('ContentType Schema', () => {
      it('should validate valid content types', () => {
        expect(ContentTypeSchema.parse('scenario')).toBe('scenario');
        expect(ContentTypeSchema.parse('prompt')).toBe('prompt');
        expect(ContentTypeSchema.parse('video')).toBe('video');
        expect(ContentTypeSchema.parse('story')).toBe('story');
        expect(ContentTypeSchema.parse('image')).toBe('image');
      });

      it('should reject invalid content types', () => {
        expect(() => ContentTypeSchema.parse('invalid')).toThrow();
        expect(() => ContentTypeSchema.parse('')).toThrow();
        expect(() => ContentTypeSchema.parse(null)).toThrow();
        expect(() => ContentTypeSchema.parse(undefined)).toThrow();
      });
    });

    describe('ContentStatus Schema', () => {
      it('should validate valid statuses', () => {
        expect(ContentStatusSchema.parse('draft')).toBe('draft');
        expect(ContentStatusSchema.parse('active')).toBe('active');
        expect(ContentStatusSchema.parse('processing')).toBe('processing');
        expect(ContentStatusSchema.parse('completed')).toBe('completed');
        expect(ContentStatusSchema.parse('failed')).toBe('failed');
        expect(ContentStatusSchema.parse('archived')).toBe('archived');
      });

      it('should reject invalid statuses', () => {
        expect(() => ContentStatusSchema.parse('invalid')).toThrow();
        expect(() => ContentStatusSchema.parse('in-progress')).toThrow(); // 하이픈 포함 거부
      });
    });

    describe('StorageStatus Schema', () => {
      it('should validate valid storage statuses', () => {
        expect(StorageStatusSchema.parse('pending')).toBe('pending');
        expect(StorageStatusSchema.parse('saving')).toBe('saving');
        expect(StorageStatusSchema.parse('saved')).toBe('saved');
        expect(StorageStatusSchema.parse('failed')).toBe('failed');
        expect(StorageStatusSchema.parse('partial')).toBe('partial');
      });

      it('should reject invalid storage statuses', () => {
        expect(() => StorageStatusSchema.parse('unknown')).toThrow();
        expect(() => StorageStatusSchema.parse('')).toThrow();
      });
    });
  });

  describe('BaseContent Validation', () => {
    const validBaseContent: BaseContent = {
      id: 'test-id-123',
      type: 'scenario',
      title: 'Test Content',
      userId: 'user-456',
      projectId: 'project-789', // 중요: projectId 필드 포함
      status: 'draft',
      source: 'test',
      storageStatus: 'pending',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      metadata: { test: true },
      storage: {
        prisma: { saved: false },
        supabase: { saved: false }
      }
    };

    it('should validate valid BaseContent', () => {
      expect(isBaseContent(validBaseContent)).toBe(true);

      const result = validateBaseContent(validBaseContent);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validBaseContent);
      expect(result.error).toBeUndefined();
    });

    it('should validate BaseContent with optional fields', () => {
      const minimalContent: BaseContent = {
        id: 'minimal-id',
        type: 'video',
        title: 'Minimal Content',
        status: 'draft',
        storageStatus: 'pending',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z'
      };

      expect(isBaseContent(minimalContent)).toBe(true);

      const result = validateBaseContent(minimalContent);
      expect(result.success).toBe(true);
    });

    it('should validate projectId field specifically', () => {
      const contentWithProjectId = {
        ...validBaseContent,
        projectId: 'project-specific-id'
      };

      const result = validateBaseContent(contentWithProjectId);
      expect(result.success).toBe(true);
      expect(result.data?.projectId).toBe('project-specific-id');
    });

    it('should reject invalid BaseContent', () => {
      const invalidContent = {
        id: '', // 빈 ID
        type: 'invalid-type',
        title: '',
        status: 'invalid-status',
        storageStatus: 'invalid-storage',
        createdAt: 'invalid-date',
        updatedAt: 'invalid-date'
      };

      expect(isBaseContent(invalidContent)).toBe(false);

      const result = validateBaseContent(invalidContent);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.details).toBeDefined();
    });

    it('should reject BaseContent with wrong projectId type', () => {
      const invalidContent = {
        ...validBaseContent,
        projectId: 123 // 숫자는 허용되지 않음
      };

      const result = validateBaseContent(invalidContent);
      expect(result.success).toBe(false);
      expect(result.error).toContain('projectId');
    });
  });

  describe('PlanningContent Validation', () => {
    const validScenarioContent: ScenarioContent = {
      id: 'scenario-123',
      type: 'scenario',
      title: 'Test Scenario',
      userId: 'user-456',
      projectId: 'project-789',
      status: 'draft',
      storageStatus: 'pending',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      story: 'A compelling story about...',
      genre: 'drama',
      tone: 'serious',
      metadata: {
        hasFourStep: true,
        hasTwelveShot: false,
        wordCount: 500
      }
    };

    const validPromptContent: PromptContent = {
      id: 'prompt-123',
      type: 'prompt',
      title: 'Test Prompt',
      userId: 'user-456',
      projectId: 'project-789',
      status: 'completed',
      storageStatus: 'saved',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      scenarioTitle: 'Related Scenario',
      finalPrompt: 'Create a video showing...',
      keywords: ['action', 'drama', 'suspense'],
      metadata: {
        keywordCount: 3,
        segmentCount: 5,
        promptLength: 150
      }
    };

    const validVideoContent: VideoContent = {
      id: 'video-123',
      type: 'video',
      title: 'Test Video',
      userId: 'user-456',
      projectId: 'project-789',
      status: 'processing',
      storageStatus: 'saving',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      processingJobId: 'job-456',
      metadata: {
        duration: 30,
        resolution: '1920x1080',
        fileSize: 1024000,
        provider: 'seedance'
      }
    };

    it('should validate ScenarioContent', () => {
      expect(isPlanningContent(validScenarioContent)).toBe(true);

      const result = validatePlanningContent(validScenarioContent);
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('scenario');
    });

    it('should validate PromptContent', () => {
      expect(isPlanningContent(validPromptContent)).toBe(true);

      const result = validatePlanningContent(validPromptContent);
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('prompt');
    });

    it('should validate VideoContent', () => {
      expect(isPlanningContent(validVideoContent)).toBe(true);

      const result = validatePlanningContent(validVideoContent);
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('video');
    });

    it('should reject content with mismatched type', () => {
      const mismatchedContent = {
        ...validScenarioContent,
        type: 'video' // type은 video인데 story 필드가 있음
      };

      const result = validatePlanningContent(mismatchedContent);
      expect(result.success).toBe(false);
    });
  });

  describe('Prisma Compatibility Validation', () => {
    it('should validate Prisma-compatible data', () => {
      const prismaData = {
        id: 'prisma-123',
        type: 'scenario',
        title: 'Prisma Test',
        content: { story: 'test story' },
        status: 'draft',
        projectId: 'project-456', // Prisma 필드
        version: 1,
        metadata: {},
        storage: {},
        storageStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = validatePrismaCompatibility(prismaData);
      expect(result.success).toBe(true);
    });

    it('should reject data missing required Prisma fields', () => {
      const incompleteData = {
        id: 'incomplete-123',
        title: 'Missing fields'
        // type, content, status 누락
      };

      const result = validatePrismaCompatibility(incompleteData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required Prisma fields');
    });

    it('should validate projectId field compatibility', () => {
      const dataWithProjectId = {
        id: 'test-123',
        type: 'scenario',
        title: 'Test',
        content: {},
        status: 'draft',
        projectId: 'valid-project-id'
      };

      const result = validatePrismaCompatibility(dataWithProjectId);
      expect(result.success).toBe(true);
    });

    it('should reject invalid projectId type', () => {
      const invalidProjectIdData = {
        id: 'test-123',
        type: 'scenario',
        title: 'Test',
        content: {},
        status: 'draft',
        projectId: 123 // 숫자는 허용되지 않음
      };

      const result = validatePrismaCompatibility(invalidProjectIdData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('projectId must be string or null');
    });
  });

  describe('Assertion Functions', () => {
    const validContent: BaseContent = {
      id: 'assertion-test',
      type: 'scenario',
      title: 'Assertion Test',
      status: 'draft',
      storageStatus: 'pending',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    };

    it('should pass assertion for valid BaseContent', () => {
      expect(() => assertBaseContent(validContent)).not.toThrow();
    });

    it('should throw for invalid BaseContent', () => {
      const invalidContent = { id: '', type: 'invalid' };

      expect(() => assertBaseContent(invalidContent)).toThrow(TypeError);
      expect(() => assertBaseContent(invalidContent, 'test context')).toThrow(/test context/);
    });

    it('should pass assertion for valid PlanningContent', () => {
      const validPlanningContent = {
        ...validContent,
        story: 'Test story content'
      };

      expect(() => assertPlanningContent(validPlanningContent)).not.toThrow();
    });

    it('should throw for invalid PlanningContent', () => {
      const invalidContent = { type: 'scenario' }; // 필수 필드 누락

      expect(() => assertPlanningContent(invalidContent)).toThrow(TypeError);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs', () => {
      expect(isBaseContent(null)).toBe(false);
      expect(isBaseContent(undefined)).toBe(false);
      expect(isPlanningContent(null)).toBe(false);
      expect(isPlanningContent(undefined)).toBe(false);
    });

    it('should handle non-object inputs', () => {
      expect(isBaseContent('string')).toBe(false);
      expect(isBaseContent(123)).toBe(false);
      expect(isBaseContent([])).toBe(false);
      expect(isPlanningContent(true)).toBe(false);
    });

    it('should provide detailed error messages', () => {
      const invalidContent = {
        id: '',
        type: 'invalid',
        title: '',
        status: 'wrong',
        storageStatus: 'bad',
        createdAt: 'not-a-date',
        updatedAt: 'also-not-a-date'
      };

      const result = validateBaseContent(invalidContent);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.details?.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large validation sets efficiently', () => {
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `perf-test-${i}`,
        type: 'scenario' as const,
        title: `Performance Test ${i}`,
        status: 'draft' as const,
        storageStatus: 'pending' as const,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        story: `Story content for test ${i}`
      }));

      const startTime = performance.now();

      largeDataSet.forEach(item => {
        validatePlanningContent(item);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 1000개 항목을 100ms 이내에 처리해야 함
      expect(duration).toBeLessThan(100);
    });
  });
});