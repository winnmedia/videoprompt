/**
 * Scenarios API Tests
 *
 * TDD 원칙에 따른 /api/planning/scenarios 엔드포인트 테스트
 * CLAUDE.md 준수: Supabase RLS 테스트, 비용 안전 검증, 결정론적 테스트
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/planning/scenarios/route';
import { supabaseClient } from '@/shared/api/supabase-client';
import { GeminiClient } from '@/shared/lib/gemini-client';
import * as planningUtils from '@/shared/api/planning-utils';

// 모킹
jest.mock('@/shared/api/supabase-client');
jest.mock('@/shared/lib/gemini-client');
jest.mock('@/shared/api/planning-utils');
jest.mock('@/shared/lib/structured-logger');

const mockSupabaseClient = supabaseClient as jest.Mocked<typeof supabaseClient>;
// GeminiClient 인스턴스 모킹
const mockGeminiInstance = {
  generateScenarios: jest.fn(),
  generateStorySteps: jest.fn(),
  getUsageStats: jest.fn(),
};

(GeminiClient as jest.MockedClass<typeof GeminiClient>).mockImplementation(() => mockGeminiInstance as any);
const mockPlanningUtils = planningUtils as jest.Mocked<typeof planningUtils>;

describe('/api/planning/scenarios', () => {
  const mockUser = {
    userId: 'test-user-id',
    email: 'test@example.com',
    role: 'user',
    iat: Date.now(),
    exp: Date.now() + 3600000,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // 기본 모킹 설정
    mockPlanningUtils.withApiHandler.mockImplementation((handler, options) => {
      return async (request: NextRequest, context: any = {}) => {
        return handler(request, { ...context, user: mockUser });
      };
    });

    mockPlanningUtils.createSuccessResponse.mockImplementation((data) => {
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as any;
    });

    mockPlanningUtils.createPaginatedResponse.mockImplementation((data, pagination) => {
      return new Response(
        JSON.stringify({
          success: true,
          data,
          pagination: {
            ...pagination,
            totalPages: Math.ceil(pagination.total / pagination.limit),
            hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
            hasPrev: pagination.page > 1,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      ) as any;
    });

    // Supabase 클라이언트 모킹
    mockSupabaseClient.safeQuery.mockImplementation(async (queryFn, userId, operation) => {
      // 기본적으로 성공 응답 반환
      return { data: [], error: null, count: 0 };
    });
  });

  describe('GET /api/planning/scenarios', () => {
    it('시나리오 목록 조회 성공', async () => {
      // Arrange
      const mockScenarios = [
        {
          id: 'scenario-1',
          title: '테스트 시나리오 1',
          description: '첫 번째 테스트 시나리오',
          genre: '교육',
          target_duration: 300,
          status: 'draft',
          story_outline: '테스트 스토리 개요',
          keywords: ['테스트', '교육'],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          user_id: mockUser.userId,
          project_id: null,
          scenes: [
            { id: 'scene-1', duration: 30 },
            { id: 'scene-2', duration: 60 },
          ],
        },
        {
          id: 'scenario-2',
          title: '테스트 시나리오 2',
          description: '두 번째 테스트 시나리오',
          genre: '엔터테인먼트',
          target_duration: 600,
          status: 'completed',
          story_outline: '두 번째 스토리 개요',
          keywords: ['엔터테인먼트', '완료'],
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          user_id: mockUser.userId,
          project_id: 'project-1',
          scenes: [],
        },
      ];

      mockSupabaseClient.safeQuery.mockResolvedValue({
        data: mockScenarios,
        error: null,
        count: 2,
      });

      mockPlanningUtils.validateQueryParams.mockReturnValue({
        limit: 20,
        offset: 0,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/planning/scenarios?limit=20&offset=0',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid-jwt-token',
          },
        }
      );

      // Act
      const response = await GET(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toHaveLength(2);
      expect(responseData.data[0]).toMatchObject({
        id: 'scenario-1',
        title: '테스트 시나리오 1',
        scenesCount: 2,
        totalDuration: 90,
      });
      expect(responseData.pagination.total).toBe(2);

      // Supabase RLS 확인 - user_id 필터링
      expect(mockSupabaseClient.safeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        mockUser.userId,
        'get_scenarios'
      );
    });

    it('검색 필터가 올바르게 적용되는지 확인', async () => {
      // Arrange
      mockPlanningUtils.validateQueryParams.mockReturnValue({
        query: '교육',
        status: 'draft',
        genre: '교육',
        limit: 10,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/planning/scenarios?query=교육&status=draft&genre=교육',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid-jwt-token',
          },
        }
      );

      // Act
      await GET(request, { params: {} });

      // Assert
      expect(mockPlanningUtils.validateQueryParams).toHaveBeenCalledWith(
        request,
        expect.any(Object) // PlanningSearchFilterSchema
      );
    });

    it('Supabase 에러 시 적절한 에러 처리', async () => {
      // Arrange
      const supabaseError = new Error('Database connection failed');
      mockSupabaseClient.safeQuery.mockResolvedValue({
        data: null,
        error: supabaseError,
        count: 0,
      });

      mockPlanningUtils.withApiHandler.mockImplementation((handler) => {
        return async (request: NextRequest, context: any = {}) => {
          try {
            return await handler(request, { ...context, user: mockUser });
          } catch (error) {
            return new Response(
              JSON.stringify({
                success: false,
                error: {
                  code: 'DATABASE_ERROR',
                  message: 'Database connection failed',
                },
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }
            ) as any;
          }
        };
      });

      const request = new NextRequest('http://localhost:3000/api/planning/scenarios', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
      });

      // Act
      const response = await GET(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('DATABASE_ERROR');
    });
  });

  describe('POST /api/planning/scenarios', () => {
    it('AI 스토리 생성과 함께 시나리오 생성 성공', async () => {
      // Arrange
      const requestData = {
        title: '새 시나리오',
        description: 'AI 생성 시나리오 테스트',
        genre: '교육',
        targetDuration: 300,
        storyPrompt: '교육용 비디오 스토리를 만들어주세요',
        generateStory: true,
      };

      const mockStoryResponse = {
        storyOutline: 'AI 생성 스토리 개요',
        scenes: [
          {
            order: 1,
            type: 'dialogue' as const,
            title: '오프닝',
            description: '인사 및 소개',
            duration: 30,
            location: '스튜디오',
            characters: ['진행자'],
            visualElements: [],
          },
        ],
        suggestedKeywords: ['교육', '비디오'],
        estimatedDuration: 300,
      };

      const mockScenario = {
        id: 'new-scenario-id',
        user_id: mockUser.userId,
        title: requestData.title,
        description: requestData.description,
        genre: requestData.genre,
        target_duration: requestData.targetDuration,
        status: 'draft',
        story_outline: mockStoryResponse.storyOutline,
        keywords: mockStoryResponse.suggestedKeywords,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        project_id: null,
      };

      mockPlanningUtils.validateRequest.mockResolvedValue(requestData);
      mockGeminiInstance.generateStory.mockResolvedValue(mockStoryResponse);

      // Supabase 호출 시퀀스 모킹
      let callCount = 0;
      mockSupabaseClient.safeQuery.mockImplementation(async (queryFn, userId, operation) => {
        callCount++;

        if (operation === 'create_scenario') {
          return { data: mockScenario, error: null };
        } else if (operation === 'create_scenes') {
          return { data: null, error: null };
        } else if (operation === 'get_scenario_with_scenes') {
          return {
            data: {
              ...mockScenario,
              scenes: [
                {
                  id: 'scene-1',
                  order: 1,
                  type: 'dialogue',
                  title: '오프닝',
                  description: '인사 및 소개',
                  duration: 30,
                  location: '스튜디오',
                  characters: ['진행자'],
                  dialogue: null,
                  action_description: null,
                  notes: null,
                  visual_elements: [],
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z',
                },
              ],
            },
            error: null,
          };
        }

        return { data: null, error: null };
      });

      const request = new NextRequest('http://localhost:3000/api/planning/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify(requestData),
      });

      // Act
      const response = await POST(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        id: mockScenario.id,
        title: mockScenario.title,
        storyOutline: mockStoryResponse.storyOutline,
        keywords: mockStoryResponse.suggestedKeywords,
        scenes: expect.arrayContaining([
          expect.objectContaining({
            title: '오프닝',
            type: 'dialogue',
          }),
        ]),
      });

      // AI 스토리 생성 호출 확인
      expect(mockGeminiInstance.generateStory).toHaveBeenCalledWith({
        prompt: requestData.storyPrompt,
        genre: requestData.genre,
        targetDuration: requestData.targetDuration,
        style: 'professional',
        tone: 'informative',
      });

      // Supabase 호출 확인
      expect(mockSupabaseClient.safeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        mockUser.userId,
        'create_scenario'
      );
    });

    it('AI 생성 없이 기본 시나리오 생성', async () => {
      // Arrange
      const requestData = {
        title: '수동 시나리오',
        description: '수동으로 만든 시나리오',
        genre: '엔터테인먼트',
        targetDuration: 600,
        storyPrompt: '기본 프롬프트',
        generateStory: false,
      };

      const mockScenario = {
        id: 'manual-scenario-id',
        user_id: mockUser.userId,
        title: requestData.title,
        description: requestData.description,
        genre: requestData.genre,
        target_duration: requestData.targetDuration,
        status: 'draft',
        story_outline: '',
        keywords: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        project_id: null,
      };

      mockPlanningUtils.validateRequest.mockResolvedValue(requestData);
      mockSupabaseClient.safeQuery.mockResolvedValue({
        data: { ...mockScenario, scenes: [] },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/planning/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify(requestData),
      });

      // Act
      const response = await POST(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.title).toBe(requestData.title);
      expect(responseData.data.scenes).toEqual([]);

      // AI 스토리 생성이 호출되지 않았는지 확인
      expect(mockGeminiInstance.generateStory).not.toHaveBeenCalled();
    });

    it('잘못된 요청 데이터로 검증 실패', async () => {
      // Arrange
      mockPlanningUtils.validateRequest.mockRejectedValue(
        new planningUtils.ValidationError('요청 데이터 검증 실패', {
          errors: [
            {
              field: 'title',
              message: '시나리오 제목은 필수입니다.',
              code: 'required',
            },
          ],
        })
      );

      mockPlanningUtils.withApiHandler.mockImplementation((handler) => {
        return async (request: NextRequest, context: any = {}) => {
          try {
            return await handler(request, { ...context, user: mockUser });
          } catch (error) {
            return new Response(
              JSON.stringify({
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: '요청 데이터 검증 실패',
                  details: {
                    errors: [
                      {
                        field: 'title',
                        message: '시나리오 제목은 필수입니다.',
                        code: 'required',
                      },
                    ],
                  },
                },
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            ) as any;
          }
        };
      });

      const request = new NextRequest('http://localhost:3000/api/planning/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          description: '제목 없는 시나리오',
        }),
      });

      // Act
      const response = await POST(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('VALIDATION_ERROR');
      expect(responseData.error.details.errors[0].field).toBe('title');
    });

    it('Gemini API 실패 시 기본 시나리오는 생성되는지 확인', async () => {
      // Arrange
      const requestData = {
        title: '실패 테스트 시나리오',
        description: 'AI 실패 상황 테스트',
        genre: '교육',
        targetDuration: 300,
        storyPrompt: '실패할 프롬프트',
        generateStory: true,
      };

      const mockScenario = {
        id: 'failed-ai-scenario-id',
        user_id: mockUser.userId,
        title: requestData.title,
        description: requestData.description,
        genre: requestData.genre,
        target_duration: requestData.targetDuration,
        status: 'draft',
        story_outline: '',
        keywords: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        project_id: null,
      };

      mockPlanningUtils.validateRequest.mockResolvedValue(requestData);
      mockGeminiInstance.generateStory.mockRejectedValue(new Error('Gemini API 실패'));

      // 시나리오 생성은 성공하도록 모킹
      let callCount = 0;
      mockSupabaseClient.safeQuery.mockImplementation(async (queryFn, userId, operation) => {
        callCount++;

        if (operation === 'create_scenario') {
          return { data: mockScenario, error: null };
        } else if (operation === 'get_scenario_with_scenes') {
          return {
            data: { ...mockScenario, scenes: [] },
            error: null,
          };
        }

        return { data: null, error: null };
      });

      const request = new NextRequest('http://localhost:3000/api/planning/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify(requestData),
      });

      // Act
      const response = await POST(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.id).toBe(mockScenario.id);
      expect(responseData.data.scenes).toEqual([]);

      // 기본 시나리오는 생성되었는지 확인
      expect(mockSupabaseClient.safeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        mockUser.userId,
        'create_scenario'
      );
    });
  });

  describe('비용 안전 및 보안 검증', () => {
    it('JWT 인증이 필요한지 확인', async () => {
      const request = new NextRequest('http://localhost:3000/api/planning/scenarios');

      await GET(request, { params: {} });

      expect(mockPlanningUtils.withApiHandler).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          requireAuth: true,
        })
      );
    });

    it('비용 안전 미들웨어가 적용되는지 확인', async () => {
      const request = new NextRequest('http://localhost:3000/api/planning/scenarios');

      await GET(request, { params: {} });

      expect(mockPlanningUtils.withApiHandler).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          costSafety: true,
        })
      );
    });

    it('사용자별 데이터 격리가 올바르게 작동하는지 확인 (RLS)', async () => {
      // 다른 사용자의 시나리오가 조회되지 않는지 확인
      const request = new NextRequest('http://localhost:3000/api/planning/scenarios');

      await GET(request, { params: {} });

      // safeQuery 호출 시 현재 사용자 ID가 전달되는지 확인
      expect(mockSupabaseClient.safeQuery).toHaveBeenCalledWith(
        expect.any(Function),
        mockUser.userId,
        expect.any(String)
      );
    });
  });
});