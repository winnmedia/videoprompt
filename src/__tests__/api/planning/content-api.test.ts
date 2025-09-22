/**
 * Content Management API Tests
 *
 * 콘텐츠 관리 대시보드 API TDD 테스트
 * CLAUDE.md 준수: Red -> Green -> Refactor 사이클
 * $300 사건 방지: API 호출 제한 테스트 포함
 */

import { NextRequest, NextResponse } from 'next/server';
import { GET as getContentList } from '@/app/api/planning/content/route';
import { GET as getContentDetail, PATCH as updateContent, DELETE as deleteContent } from '@/app/api/planning/content/[id]/route';
import { GET as getDashboardStats } from '@/app/api/planning/dashboard/stats/route';
import { POST as batchOperation } from '@/app/api/planning/content/batch/route';
import { supabaseClient } from '@/shared/api/supabase-client';
// JWT는 테스트용 모킹 토큰 사용

// Mock Supabase client
jest.mock('@/shared/api/supabase-client', () => ({
  supabaseClient: {
    safeQuery: jest.fn(),
    raw: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(),
              limit: jest.fn(),
              range: jest.fn(),
              or: jest.fn(),
              gte: jest.fn(),
              lte: jest.fn(),
              ilike: jest.fn(),
              not: jest.fn(),
              order: jest.fn(),
            })),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(),
              })),
            })),
          })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(),
            })),
          })),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
    },
  },
}));

// Mock JWT
const mockJwt = {
  verify: jest.fn(),
};
jest.mock('jsonwebtoken', () => mockJwt);

// Mock Logger
jest.mock('@/shared/lib/structured-logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    logBusinessEvent: jest.fn(),
    logApiRequest: jest.fn(),
  },
}));

// Mock Cost Safety Middleware
jest.mock('@/shared/lib/cost-safety-middleware', () => ({
  CostSafetyMiddleware: jest.fn().mockImplementation(() => ({
    checkApiCallLimit: jest.fn().mockResolvedValue({ allowed: true, remainingCalls: 29 }),
    reportCost: jest.fn(),
    setCachedResponse: jest.fn(),
    getStatus: jest.fn().mockReturnValue({
      emergencyShutdownActive: false,
      totalCallsToday: 10,
      totalCostToday: 0.5,
    }),
  })),
}));

describe('Content Management API Tests', () => {
  const mockUserId = 'test-user-id';
  const mockJwtPayload = {
    userId: mockUserId,
    email: 'test@example.com',
    role: 'user',
    iat: Date.now(),
    exp: Date.now() + 3600000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockJwt.verify.mockReturnValue(mockJwtPayload);
  });

  describe('GET /api/planning/content - 콘텐츠 목록 조회', () => {
    // RED: 실패하는 테스트 먼저 작성
    test('인증되지 않은 사용자는 403 에러를 받아야 함', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const request = new NextRequest('http://localhost/api/planning/content');
      const response = await getContentList(request, {});

      expect(response.status).toBe(401);
    });

    test('유효한 인증으로 콘텐츠 목록을 조회할 수 있어야 함', async () => {
      // GREEN: 최소 구현으로 테스트 통과
      const mockPlanningProjects = [
        {
          id: 'project-1',
          title: 'Test Project',
          description: 'Test Description',
          status: 'draft',
          user_id: mockUserId,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          is_deleted: false,
        }
      ];

      const mockStorySteps = [
        {
          id: 'step-1',
          title: 'Test Step',
          description: 'Test Step Description',
          order: 1,
          planning_project_id: 'project-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          planning_projects: {
            user_id: mockUserId,
            title: 'Test Project',
            project_id: 'project-1',
          },
        }
      ];

      (supabaseClient.safeQuery as jest.Mock)
        .mockResolvedValueOnce({ data: mockPlanningProjects, error: null, count: 1 })
        .mockResolvedValueOnce({ data: mockStorySteps, error: null, count: 1 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 });

      const request = new NextRequest('http://localhost/api/planning/content?limit=20&page=1');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await getContentList(request, {});
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toHaveLength(2);
      expect(responseData.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    test('페이지네이션이 올바르게 작동해야 함', async () => {
      const mockData = Array.from({ length: 25 }, (_, i) => ({
        id: `item-${i}`,
        title: `Item ${i}`,
        type: 'planning_project',
        user_id: mockUserId,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_deleted: false,
      }));

      (supabaseClient.safeQuery as jest.Mock)
        .mockResolvedValueOnce({ data: mockData, error: null, count: 25 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 });

      const request = new NextRequest('http://localhost/api/planning/content?limit=10&page=2');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await getContentList(request, {});
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data).toHaveLength(10);
      expect(responseData.pagination.page).toBe(2);
      expect(responseData.pagination.hasNext).toBe(true);
      expect(responseData.pagination.hasPrev).toBe(true);
    });

    test('검색 필터가 올바르게 적용되어야 함', async () => {
      const mockSearchResults = [
        {
          id: 'search-result-1',
          title: 'Searched Project',
          description: 'Contains search term',
          user_id: mockUserId,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          is_deleted: false,
        }
      ];

      (supabaseClient.safeQuery as jest.Mock)
        .mockResolvedValueOnce({ data: mockSearchResults, error: null, count: 1 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 });

      const request = new NextRequest('http://localhost/api/planning/content?search=searched');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await getContentList(request, {});
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.data[0].title).toContain('Searched');
    });
  });

  describe('GET /api/planning/content/[id] - 콘텐츠 상세 조회', () => {
    test('존재하지 않는 콘텐츠는 404 에러를 반환해야 함', async () => {
      (supabaseClient.safeQuery as jest.Mock).mockResolvedValue({ data: null, error: null });

      const request = new NextRequest('http://localhost/api/planning/content/non-existent-id');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await getContentDetail(request, { params: { id: 'non-existent-id' } });

      expect(response.status).toBe(404);
    });

    test('유효한 콘텐츠 ID로 상세 정보를 조회할 수 있어야 함', async () => {
      const mockContent = {
        id: 'content-1',
        title: 'Test Content',
        description: 'Test Description',
        status: 'draft',
        user_id: mockUserId,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_deleted: false,
      };

      (supabaseClient.safeQuery as jest.Mock).mockResolvedValueOnce({ data: mockContent, error: null });

      const request = new NextRequest('http://localhost/api/planning/content/content-1');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await getContentDetail(request, { params: { id: 'content-1' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.id).toBe('content-1');
      expect(responseData.data.type).toBe('planning_project');
    });
  });

  describe('PATCH /api/planning/content/[id] - 콘텐츠 수정', () => {
    test('잘못된 요청 데이터는 400 에러를 반환해야 함', async () => {
      const request = new NextRequest('http://localhost/api/planning/content/content-1', {
        method: 'PATCH',
        body: JSON.stringify({ invalid_field: 'invalid_value' }),
        headers: { 'authorization': 'Bearer valid-token' },
      });

      const response = await updateContent(request, { params: { id: 'content-1' } });

      expect(response.status).toBe(400);
    });

    test('유효한 데이터로 콘텐츠를 수정할 수 있어야 함', async () => {
      const mockExistingContent = {
        id: 'content-1',
        title: 'Original Title',
        description: 'Original Description',
        status: 'draft',
        user_id: mockUserId,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_deleted: false,
      };

      const mockUpdatedContent = {
        ...mockExistingContent,
        title: 'Updated Title',
        description: 'Updated Description',
        updated_at: '2024-01-02T00:00:00Z',
      };

      (supabaseClient.safeQuery as jest.Mock)
        .mockResolvedValueOnce({ data: mockExistingContent, error: null })
        .mockResolvedValueOnce({ data: mockUpdatedContent, error: null });

      const request = new NextRequest('http://localhost/api/planning/content/content-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Updated Title',
          description: 'Updated Description',
        }),
        headers: { 'authorization': 'Bearer valid-token' },
      });

      const response = await updateContent(request, { params: { id: 'content-1' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.title).toBe('Updated Title');
    });
  });

  describe('DELETE /api/planning/content/[id] - 콘텐츠 삭제', () => {
    test('권한이 없는 콘텐츠는 삭제할 수 없어야 함', async () => {
      (supabaseClient.safeQuery as jest.Mock).mockResolvedValue({ data: null, error: null });

      const request = new NextRequest('http://localhost/api/planning/content/other-user-content');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await deleteContent(request, { params: { id: 'other-user-content' } });

      expect(response.status).toBe(404);
    });

    test('유효한 콘텐츠를 삭제할 수 있어야 함', async () => {
      const mockContent = {
        id: 'content-1',
        title: 'Test Content',
        description: 'Test Description',
        status: 'draft',
        user_id: mockUserId,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_deleted: false,
      };

      (supabaseClient.safeQuery as jest.Mock)
        .mockResolvedValueOnce({ data: mockContent, error: null })
        .mockResolvedValueOnce({ data: { id: 'content-1' }, error: null });

      const request = new NextRequest('http://localhost/api/planning/content/content-1');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await deleteContent(request, { params: { id: 'content-1' } });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.deleted).toBe(true);
      expect(responseData.data.contentId).toBe('content-1');
    });
  });

  describe('GET /api/planning/dashboard/stats - 대시보드 통계', () => {
    test('사용자의 콘텐츠 통계를 조회할 수 있어야 함', async () => {
      const mockStats = {
        planning_projects: [{ id: '1' }, { id: '2' }],
        story_steps: [{ id: '1' }],
        conti_generations: [{ id: '1', status: 'completed', image_url: 'url' }],
        video_generations: [{ id: '1', status: 'completed', output_video_url: 'url' }],
      };

      (supabaseClient.safeQuery as jest.Mock)
        .mockResolvedValueOnce({ data: mockStats.planning_projects, error: null, count: 2 })
        .mockResolvedValueOnce({ data: mockStats.story_steps, error: null, count: 1 })
        .mockResolvedValueOnce({ data: mockStats.conti_generations, error: null, count: 1 })
        .mockResolvedValueOnce({ data: mockStats.video_generations, error: null, count: 1 })
        .mockResolvedValueOnce({ data: [], error: null }) // recent activity
        .mockResolvedValueOnce({ data: [], error: null }) // week
        .mockResolvedValueOnce({ data: [], error: null }) // month
        .mockResolvedValueOnce({ data: [], error: null }) // tags
        .mockResolvedValueOnce({ data: [], error: null }); // tags

      const request = new NextRequest('http://localhost/api/planning/dashboard/stats');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await getDashboardStats(request, {});
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.total_count).toBe(5);
      expect(responseData.data.count_by_type.planning_project).toBe(2);
      expect(responseData.data.count_by_type.prompt).toBe(1);
    });
  });

  describe('POST /api/planning/content/batch - 배치 작업', () => {
    test('잘못된 배치 작업 타입은 400 에러를 반환해야 함', async () => {
      const request = new NextRequest('http://localhost/api/planning/content/batch', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'invalid_operation',
          content_ids: ['id1', 'id2'],
        }),
        headers: { 'authorization': 'Bearer valid-token' },
      });

      const response = await batchOperation(request, {});

      expect(response.status).toBe(400);
    });

    test('100개 초과 항목 배치 작업은 거부되어야 함', async () => {
      const contentIds = Array.from({ length: 101 }, (_, i) => `id-${i}`);

      const request = new NextRequest('http://localhost/api/planning/content/batch', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'delete',
          content_ids: contentIds,
        }),
        headers: { 'authorization': 'Bearer valid-token' },
      });

      const response = await batchOperation(request, {});

      expect(response.status).toBe(400);
    });

    test('유효한 배치 삭제 작업을 수행할 수 있어야 함', async () => {
      (supabaseClient.safeQuery as jest.Mock)
        .mockResolvedValueOnce({ data: [{ id: 'id1' }], error: null })
        .mockResolvedValueOnce({ data: [{ id: 'id2' }], error: null });

      const request = new NextRequest('http://localhost/api/planning/content/batch', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'delete',
          content_ids: ['id1', 'id2'],
        }),
        headers: { 'authorization': 'Bearer valid-token' },
      });

      const response = await batchOperation(request, {});
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.operation).toBe('delete');
      expect(responseData.data.total_count).toBe(2);
      expect(responseData.data.success_count).toBe(2);
      expect(responseData.data.failed_count).toBe(0);
    });
  });

  describe('비용 안전 테스트 ($300 사건 방지)', () => {
    test('API 호출 제한이 작동해야 함', async () => {
      // Mock cost safety middleware to reject calls
      const mockCostSafety = require('@/shared/lib/cost-safety-middleware').CostSafetyMiddleware;
      const mockInstance = new mockCostSafety();
      mockInstance.checkApiCallLimit.mockResolvedValue({
        allowed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
      });

      const request = new NextRequest('http://localhost/api/planning/content');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await getContentList(request, {});

      expect(response.status).toBe(429);
    });

    test('무한 호출 방지가 작동해야 함', async () => {
      // 동일한 요청을 연속으로 빠르게 호출
      const requests = Array.from({ length: 5 }, () => {
        const req = new NextRequest('http://localhost/api/planning/content');
        req.headers.set('authorization', 'Bearer valid-token');
        return getContentList(req, {});
      });

      const responses = await Promise.all(requests);

      // 적어도 일부 요청은 제한되어야 함
      const rateLimitedResponses = responses.filter(response => response.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('에러 처리 테스트', () => {
    test('데이터베이스 연결 실패 시 500 에러를 반환해야 함', async () => {
      (supabaseClient.safeQuery as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/planning/content');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await getContentList(request, {});

      expect(response.status).toBe(500);
    });

    test('잘못된 JSON 요청은 400 에러를 반환해야 함', async () => {
      const request = new NextRequest('http://localhost/api/planning/content/batch', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'authorization': 'Bearer valid-token' },
      });

      const response = await batchOperation(request, {});

      expect(response.status).toBe(400);
    });
  });

  describe('성능 테스트', () => {
    test('대량 데이터 조회 시 응답 시간이 합리적이어야 함', async () => {
      const largeMockData = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        title: `Item ${i}`,
        user_id: mockUserId,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_deleted: false,
      }));

      (supabaseClient.safeQuery as jest.Mock)
        .mockResolvedValueOnce({ data: largeMockData, error: null, count: 1000 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 })
        .mockResolvedValueOnce({ data: [], error: null, count: 0 });

      const startTime = Date.now();

      const request = new NextRequest('http://localhost/api/planning/content?limit=100&page=1');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await getContentList(request, {});
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(5000); // 5초 이내
    });
  });
});