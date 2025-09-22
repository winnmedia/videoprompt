/**
 * AI Story Generation API Tests
 *
 * TDD 원칙에 따른 /api/ai/generate-story 엔드포인트 테스트
 * CLAUDE.md 준수: 비용 안전 검증, JWT 토큰 테스트, 결정론적 테스트
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/ai/generate-story/route';
import { GeminiClient } from '@/shared/lib/gemini-client';
import * as planningUtils from '@/shared/api/planning-utils';

// 모킹
jest.mock('@/shared/lib/gemini-client');
jest.mock('@/shared/api/planning-utils');
jest.mock('@/shared/lib/structured-logger');

// GeminiClient 인스턴스 모킹
const mockGeminiInstance = {
  generateStory: jest.fn(),
  getUsageStats: jest.fn(),
};

(GeminiClient as jest.MockedClass<typeof GeminiClient>).mockImplementation(() => mockGeminiInstance as any);
const mockPlanningUtils = planningUtils as jest.Mocked<typeof planningUtils>;

describe('/api/ai/generate-story', () => {
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
        // JWT 검증을 통과한 것으로 모킹
        return handler(request, { ...context, user: mockUser });
      };
    });

    mockPlanningUtils.validateRequest.mockResolvedValue({
      prompt: '테스트 비디오 스토리',
      genre: '교육',
      targetDuration: 300,
      style: 'professional',
      tone: 'informative',
    });

    mockPlanningUtils.createSuccessResponse.mockImplementation((data) => {
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as any;
    });

    mockPlanningUtils.reportApiCost.mockImplementation(() => {});
  });

  describe('POST /api/ai/generate-story', () => {
    it('유효한 요청으로 스토리 생성 성공', async () => {
      // Arrange
      const mockStoryResponse = {
        storyOutline: '교육용 비디오 스토리 개요',
        scenes: [
          {
            order: 1,
            type: 'dialogue' as const,
            title: '오프닝',
            description: '인사 및 소개',
            duration: 30,
            location: '스튜디오',
            characters: ['진행자'],
            dialogue: '안녕하세요, 오늘은...',
            actionDescription: '카메라를 향해 인사',
            notes: '친근한 톤으로',
            visualElements: [],
          },
          {
            order: 2,
            type: 'action' as const,
            title: '메인 콘텐츠',
            description: '주요 내용 설명',
            duration: 240,
            location: '스튜디오',
            characters: ['진행자'],
            actionDescription: '차트를 보여주며 설명',
            notes: '시각 자료 활용',
            visualElements: [],
          },
        ],
        suggestedKeywords: ['교육', '비디오', '스토리'],
        estimatedDuration: 300,
      };

      mockGeminiInstance.generateStory.mockResolvedValue(mockStoryResponse);

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          prompt: '테스트 비디오 스토리',
          genre: '교육',
          targetDuration: 300,
          style: 'professional',
          tone: 'informative',
        }),
      });

      // Act
      const response = await POST(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(mockStoryResponse);
      expect(mockGeminiInstance.generateStory).toHaveBeenCalledWith({
        prompt: '테스트 비디오 스토리',
        genre: '교육',
        targetDuration: 300,
        style: 'professional',
        tone: 'informative',
      });
      expect(mockPlanningUtils.reportApiCost).toHaveBeenCalledWith(0.02);
    });

    it('Gemini API 호출 실패 시 에러 처리', async () => {
      // Arrange
      const geminiError = new Error('Gemini API 오류: 429 Too Many Requests');
      mockGeminiInstance.generateStory.mockRejectedValue(geminiError);

      // withApiHandler가 에러를 처리하도록 모킹
      mockPlanningUtils.withApiHandler.mockImplementation((handler) => {
        return async (request: NextRequest, context: any = {}) => {
          try {
            return await handler(request, { ...context, user: mockUser });
          } catch (error) {
            return new Response(
              JSON.stringify({
                success: false,
                error: {
                  code: 'GEMINI_API_ERROR',
                  message: 'AI 스토리 생성 실패',
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

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          prompt: '테스트 스토리',
          targetDuration: 300,
        }),
      });

      // Act
      const response = await POST(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('GEMINI_API_ERROR');
      expect(mockGeminiInstance.generateStory).toHaveBeenCalled();
    });

    it('비용 안전 미들웨어가 적용되는지 확인', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          prompt: '테스트 스토리',
          targetDuration: 300,
        }),
      });

      // Act
      await POST(request, { params: {} });

      // Assert
      expect(mockPlanningUtils.withApiHandler).toHaveBeenCalledWith(
        expect.any(Function),
        {
          requireAuth: true,
          costSafety: true,
          endpoint: '/api/ai/generate-story',
        }
      );
    });

    it('JWT 토큰 없이 요청 시 인증 에러', async () => {
      // Arrange
      mockPlanningUtils.withApiHandler.mockImplementation((handler) => {
        return async (request: NextRequest, context: any = {}) => {
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'AUTH_ERROR',
                message: '인증이 필요합니다.',
              },
            }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }
          ) as any;
        };
      });

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: '테스트 스토리',
        }),
      });

      // Act
      const response = await POST(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('AUTH_ERROR');
    });

    it('잘못된 요청 데이터로 검증 실패', async () => {
      // Arrange
      mockPlanningUtils.validateRequest.mockRejectedValue(
        new planningUtils.ValidationError('요청 데이터 검증 실패', {
          errors: [
            {
              field: 'prompt',
              message: '프롬프트는 최소 10자 이상이어야 합니다.',
              code: 'too_small',
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
                        field: 'prompt',
                        message: '프롬프트는 최소 10자 이상이어야 합니다.',
                        code: 'too_small',
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

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          prompt: 'short', // 너무 짧은 프롬프트
        }),
      });

      // Act
      const response = await POST(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('VALIDATION_ERROR');
      expect(responseData.error.details.errors[0].field).toBe('prompt');
    });
  });

  describe('GET /api/ai/generate-story', () => {
    it('사용 통계 조회 성공', async () => {
      // Arrange
      const mockStats = {
        totalCalls: 10,
        lastCallTime: Date.now(),
        recentCalls: 3,
      };

      mockGeminiInstance.getUsageStats.mockReturnValue(mockStats);

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
      });

      // Act
      const response = await GET(request, { params: {} });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(mockStats);
      expect(mockGeminiInstance.getUsageStats).toHaveBeenCalled();
    });

    it('통계 조회는 비용 안전 체크를 제외하는지 확인', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
      });

      // Act
      await GET(request, { params: {} });

      // Assert
      expect(mockPlanningUtils.withApiHandler).toHaveBeenCalledWith(
        expect.any(Function),
        {
          requireAuth: true,
          costSafety: false, // 통계 조회는 비용 안전 체크 제외
          endpoint: '/api/ai/generate-story/stats',
        }
      );
    });
  });

  describe('$300 사건 방지 규칙 검증', () => {
    it('분당 30회 제한 확인', async () => {
      // withApiHandler의 costSafety 옵션이 true로 설정되는지 확인
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          prompt: '테스트 스토리',
          targetDuration: 300,
        }),
      });

      await POST(request, { params: {} });

      expect(mockPlanningUtils.withApiHandler).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          costSafety: true,
        })
      );
    });

    it('API 비용 보고가 정확히 이루어지는지 확인', async () => {
      // Arrange
      mockGeminiInstance.generateStory.mockResolvedValue({
        storyOutline: '테스트 스토리',
        scenes: [],
        suggestedKeywords: [],
        estimatedDuration: 300,
      });

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          prompt: '테스트 스토리',
          targetDuration: 300,
        }),
      });

      // Act
      await POST(request, { params: {} });

      // Assert
      expect(mockPlanningUtils.reportApiCost).toHaveBeenCalledWith(0.02);
    });
  });
});