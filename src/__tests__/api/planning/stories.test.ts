/**
 * Planning Stories API 데이터 품질 및 연결 검증 테스트
 * TDD 방식으로 작성된 데이터 계약 기반 테스트
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/planning/stories/route';
import { vi, beforeEach, describe, it, expect } from 'vitest';

// Mock 환경 설정 - Vitest 스타일
vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    story: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
  checkDatabaseConnection: vi.fn(),
  validateDatabaseSchema: vi.fn(),
}));

vi.mock('@/shared/lib/database-validation', () => ({
  withDatabaseValidation: vi.fn(),
  DTOTransformer: {
    transformProjectToStory: vi.fn(),
    createPaginationMetadata: vi.fn(),
  },
  DatabaseErrorHandler: {
    classifyError: vi.fn(),
    createErrorResponse: vi.fn(),
  },
}));

vi.mock('@/shared/lib/structured-logger', () => ({
  logger: {
    setContext: vi.fn(),
    clearContext: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    apiRequest: vi.fn(),
  },
  LogCategory: {
    API: 'API',
    DATABASE: 'DATABASE',
    VALIDATION: 'VALIDATION',
    TRANSFORMATION: 'TRANSFORMATION',
    SECURITY: 'SECURITY',
  },
  PerformanceTracker: vi.fn(() => ({
    end: vi.fn(() => 100),
  })),
  withPerformanceLogging: vi.fn((name, category, fn) => fn()),
}));

vi.mock('@/shared/lib/auth', () => ({
  getUser: vi.fn(),
}));

// Mock crypto.randomUUID for request ID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-request-id-123'),
  },
  writable: true,
});

describe('Planning Stories API - 데이터베이스 연결 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/planning/stories', () => {
    const createMockRequest = (searchParams: Record<string, string> = {}) => {
      const url = new URL('http://localhost:3000/api/planning/stories');
      Object.entries(searchParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      return new NextRequest(url);
    };

    it('should handle database connection validation', async () => {
      // Arrange - withDatabaseValidation 모킹
      const { withDatabaseValidation } = await import('@/shared/lib/database-validation');
      const mockWithValidation = withDatabaseValidation as any;

      mockWithValidation.mockImplementation(async (client, operation) => {
        return await operation(client);
      });

      const { DTOTransformer } = await import('@/shared/lib/database-validation');
      const mockTransformer = DTOTransformer as any;

      mockTransformer.transformProjectToStory.mockReturnValue({
        id: 'test-id',
        title: 'Test Story',
        oneLineStory: 'Test description',
        genre: 'Drama',
        tone: 'Serious',
        target: 'Adult',
        structure: null,
        userId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      mockTransformer.createPaginationMetadata.mockReturnValue({
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        hasNext: false,
        hasPrev: false,
      });

      const request = createMockRequest();

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert - 기본 응답 구조 확인
      expect(response.status).toBe(200);
      expect(body).toHaveProperty('stories');
      expect(body).toHaveProperty('pagination');
    });

    it('should validate query parameters according to contract', async () => {
      // Arrange - 잘못된 쿼리 파라미터
      const request = createMockRequest({
        page: 'invalid',
        limit: '1000', // 제한값 초과
      });

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert - 입력 검증 실패
      expect(response.status).toBe(400);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should handle database errors with proper classification', async () => {
      // Arrange - 데이터베이스 에러 시뮬레이션
      const { withDatabaseValidation, DatabaseErrorHandler } = await import('@/shared/lib/database-validation');
      const mockWithValidation = withDatabaseValidation as any;
      const mockErrorHandler = DatabaseErrorHandler as any;

      mockWithValidation.mockRejectedValue(new Error('DATABASE_URL connection failed'));

      mockErrorHandler.classifyError.mockReturnValue({
        statusCode: 503,
        errorType: 'CONNECTION_FAILED',
        message: '데이터베이스 연결에 실패했습니다.',
      });

      mockErrorHandler.createErrorResponse.mockReturnValue({
        success: false,
        error: 'DATABASE_ERROR',
        message: '데이터베이스 연결에 실패했습니다.',
        timestamp: '2024-01-01T00:00:00Z',
      });

      const request = createMockRequest();

      // Act
      const response = await GET(request);
      const body = await response.json();

      // Assert - 데이터베이스 연결 실패 응답
      expect(response.status).toBe(503);
      expect(body.error).toBe('DATABASE_ERROR');
    });
  });

  describe('POST /api/planning/stories', () => {
    const createMockPostRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/planning/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    };

    it('should create story with valid data', async () => {
      // Arrange
      const { withDatabaseValidation } = await import('@/shared/lib/database-validation');
      const mockWithValidation = withDatabaseValidation as any;

      const mockCreatedStory = {
        id: 'story-123',
        title: 'Valid Story',
        oneLineStory: 'Valid one line story',
        genre: 'Drama',
        tone: 'Serious',
        target: 'Adult',
        structure: null,
        userId: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      mockWithValidation.mockImplementation(async (client, operation) => {
        return await operation({
          story: {
            create: vi.fn().mockResolvedValue(mockCreatedStory),
          },
        });
      });

      const validStoryData = {
        title: 'Valid Story',
        oneLineStory: 'Valid one line story',
        genre: 'Drama',
        tone: 'Serious',
        target: 'Adult',
      };

      const request = createMockPostRequest(validStoryData);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(body).toHaveProperty('id');
      expect(body.title).toBe(validStoryData.title);
    });

    it('should reject invalid input data', async () => {
      // Arrange - 잘못된 입력 데이터
      const invalidData = {
        title: '', // 빈 제목
        oneLineStory: 'x'.repeat(1001), // 너무 긴 내용
      };

      const request = createMockPostRequest(invalidData);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should handle database constraint violations', async () => {
      // Arrange
      const { withDatabaseValidation, DatabaseErrorHandler } = await import('@/shared/lib/database-validation');
      const mockWithValidation = withDatabaseValidation as any;
      const mockErrorHandler = DatabaseErrorHandler as any;

      mockWithValidation.mockRejectedValue(new Error('Unique constraint failed'));

      mockErrorHandler.classifyError.mockReturnValue({
        statusCode: 409,
        errorType: 'VALIDATION_FAILED',
        message: '중복된 데이터입니다.',
      });

      mockErrorHandler.createErrorResponse.mockReturnValue({
        success: false,
        error: 'DUPLICATE_ERROR',
        message: '중복된 데이터입니다.',
        timestamp: '2024-01-01T00:00:00Z',
      });

      const validData = {
        title: 'Duplicate Story',
        oneLineStory: 'This already exists',
        genre: 'Drama',
        tone: 'Serious',
        target: 'Adult',
      };

      const request = createMockPostRequest(validData);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(409);
      expect(body.error).toBe('DUPLICATE_ERROR');
    });
  });

  describe('데이터 품질 및 결정론적 동작 검증', () => {
    it('should maintain data contract compliance', async () => {
      // Arrange - 일관된 데이터 구조 검증
      const { withDatabaseValidation, DTOTransformer } = await import('@/shared/lib/database-validation');
      const mockWithValidation = withDatabaseValidation as any;
      const mockTransformer = DTOTransformer as any;

      const consistentData = {
        id: 'consistent-id',
        title: 'Consistent Story',
        oneLineStory: 'Same description',
        genre: 'Drama',
        tone: 'Serious',
        target: 'Adult',
        structure: null,
        userId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockWithValidation.mockImplementation(async (client, operation) => {
        return await operation(client);
      });

      mockTransformer.transformProjectToStory.mockReturnValue(consistentData);
      mockTransformer.createPaginationMetadata.mockReturnValue({
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        hasNext: false,
        hasPrev: false,
      });

      const request1 = new NextRequest('http://localhost:3000/api/planning/stories?page=1&limit=10');
      const request2 = new NextRequest('http://localhost:3000/api/planning/stories?page=1&limit=10');

      // Act
      const response1 = await GET(request1);
      const response2 = await GET(request2);

      const body1 = await response1.json();
      const body2 = await response2.json();

      // Assert - 동일한 입력에 대해 동일한 출력 (결정론적)
      expect(body1).toEqual(body2);
      expect(response1.status).toBe(response2.status);
    });
  });
});