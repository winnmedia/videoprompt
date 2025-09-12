/**
 * 스토리 생성 API 단위 테스트
 * TDD 원칙: RED → GREEN → REFACTOR
 */

import { POST } from '@/app/api/ai/generate-story/route';
import { NextRequest } from 'next/server';
import { validateStoryResponse, StoryContractViolationError } from '@/shared/contracts/story.contract';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      update: vi.fn(),
      create: vi.fn()
    }
  }
}));

// Mock getUser
vi.mock('@/shared/lib/auth', () => ({
  getUser: vi.fn().mockResolvedValue({
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser'
  })
}));

// Mock 환경변수
const mockEnv = {
  GOOGLE_GEMINI_API_KEY: 'AIza-test-key-for-unit-tests',
  NODE_ENV: 'test'
};

describe('POST /api/ai/generate-story', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 환경변수 모킹
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // console.error 모킹 (테스트 출력 정리)
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // console 모킹 해제
    vi.restoreAllMocks();
  });

  describe('❌ RED Phase: 실패 테스트 먼저 작성', () => {
    test('빈 요청 바디 시 400 에러 반환 (Zod 검증 실패)', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.message).toContain('스토리를 입력해주세요');
    });

    test('API 키 누락 시 400 에러 반환', async () => {
      // 환경변수 제거
      delete process.env.GOOGLE_GEMINI_API_KEY;

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        body: JSON.stringify({
          story: '테스트 스토리',
          genre: '드라마',
          tone: '진지한',
          target: '일반 시청자'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('AI 서비스가 구성되지 않았습니다');
    });

    test('잘못된 API 키 형식 시 400 에러 반환', async () => {
      process.env.GOOGLE_GEMINI_API_KEY = 'invalid-key-format';

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        body: JSON.stringify({
          story: '테스트 스토리',
          genre: '드라마',
          tone: '진지한',
          target: '일반 시청자'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('AI 서비스 구성 오류');
    });
  });

  describe('✅ GREEN Phase: 최소 구현으로 테스트 통과', () => {
    test('유효한 요청에 대해 기본값 적용', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        body: JSON.stringify({
          story: 'A'  // 최소 1자 (Zod 스키마 통과)
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      // fetch 모킹 (외부 API 호출 대신)
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  structure: {
                    act1: {
                      title: '시작',
                      description: '테스트 설명',
                      key_elements: ['요소1'],
                      emotional_arc: '감정 변화'
                    },
                    act2: {
                      title: '전개',
                      description: '테스트 설명',
                      key_elements: ['요소1'],
                      emotional_arc: '감정 변화'
                    },
                    act3: {
                      title: '절정',
                      description: '테스트 설명',
                      key_elements: ['요소1'],
                      emotional_arc: '감정 변화'
                    },
                    act4: {
                      title: '결말',
                      description: '테스트 설명',
                      key_elements: ['요소1'],
                      emotional_arc: '감정 변화'
                    }
                  },
                  visual_style: ['테스트'],
                  mood_palette: ['테스트'],
                  technical_approach: ['테스트'],
                  target_audience_insights: ['테스트']
                })
              }]
            },
            finishReason: 'STOP'
          }]
        })
      });

      global.fetch = mockFetch;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.structure).toBeDefined();
      expect(data.structure.act1).toBeDefined();
      expect(data.structure.act4).toBeDefined();
    });

    test('Zod 스키마 기본값이 올바르게 적용됨', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        body: JSON.stringify({
          story: '최소 스토리',
          // 다른 필드들 생략 - 기본값 적용되어야 함
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  structure: {
                    act1: { title: '시작', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
                    act2: { title: '전개', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
                    act3: { title: '절정', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
                    act4: { title: '결말', description: '설명', key_elements: ['요소'], emotional_arc: '감정' }
                  },
                  visual_style: ['기본'], mood_palette: ['기본'], 
                  technical_approach: ['기본'], target_audience_insights: ['기본']
                })
              }]
            }
          }]
        })
      });

      global.fetch = mockFetch;

      const response = await POST(request);

      // 실제 fetch 호출 시 기본값이 적용되었는지 확인
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          body: expect.stringContaining('"genre":"드라마"') && // 기본값
                expect.stringContaining('"tone":"일반적"') &&   // 기본값
                expect.stringContaining('"target":"일반 시청자"') // 기본값
        })
      );

      expect(response.status).toBe(200);
    });
  });

  describe('🔧 REFACTOR Phase: 계약 검증 및 에러 처리', () => {
    test('응답 스키마 검증이 올바르게 작동함', () => {
      const validResponse = {
        structure: {
          act1: { title: '시작', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
          act2: { title: '전개', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
          act3: { title: '절정', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
          act4: { title: '결말', description: '설명', key_elements: ['요소'], emotional_arc: '감정' }
        },
        visual_style: ['기본'],
        mood_palette: ['기본'],
        technical_approach: ['기본'],
        target_audience_insights: ['기본']
      };

      expect(() => validateStoryResponse(validResponse)).not.toThrow();
    });

    test('잘못된 응답 구조 시 계약 위반 에러 발생', () => {
      const invalidResponse = {
        structure: {
          act1: { title: '시작' }, // key_elements, description, emotional_arc 누락
          // act2, act3, act4 누락
        }
      };

      expect(() => validateStoryResponse(invalidResponse))
        .toThrow(StoryContractViolationError);
    });
  });

  describe('🌐 실제 시나리오 테스트', () => {
    test('빈 tone 배열 조인 시 기본값 적용', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        body: JSON.stringify({
          story: '테스트 스토리',
          tone: '', // 빈 문자열 (toneAndManner 배열 조인 결과)
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  structure: {
                    act1: { title: '시작', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
                    act2: { title: '전개', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
                    act3: { title: '절정', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
                    act4: { title: '결말', description: '설명', key_elements: ['요소'], emotional_arc: '감정' }
                  },
                  visual_style: ['기본'], mood_palette: ['기본'], 
                  technical_approach: ['기본'], target_audience_insights: ['기본']
                })
              }]
            }
          }]
        })
      });

      global.fetch = mockFetch;

      const response = await POST(request);

      expect(response.status).toBe(200);
      // 기본값 '일반적'이 적용되었는지 확인
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"tone":"일반적"')
        })
      );
    });
  });
});

describe('계약 검증 유틸리티 테스트', () => {
  describe('validateStoryResponse', () => {
    test('완전한 응답 구조 검증 성공', () => {
      const completeResponse = {
        structure: {
          act1: {
            title: '시작',
            description: '스토리의 시작 부분입니다.',
            key_elements: ['주인공 소개', '상황 설정'],
            emotional_arc: '호기심 → 관심'
          },
          act2: {
            title: '전개',
            description: '갈등이 시작됩니다.',
            key_elements: ['갈등 도입', '긴장감 조성'],
            emotional_arc: '관심 → 긴장'
          },
          act3: {
            title: '절정',
            description: '최고조에 달합니다.',
            key_elements: ['클라이막스', '결정적 순간'],
            emotional_arc: '긴장 → 절정'
          },
          act4: {
            title: '결말',
            description: '모든 것이 해결됩니다.',
            key_elements: ['해결', '결말'],
            emotional_arc: '절정 → 안도'
          }
        },
        visual_style: ['영화적', '사실적'],
        mood_palette: ['따뜻함', '희망'],
        technical_approach: ['동적 카메라', '감정적 조명'],
        target_audience_insights: ['감동적 스토리', '보편적 호소력']
      };

      const result = validateStoryResponse(completeResponse);
      expect(result).toEqual(completeResponse);
    });

    test('필수 필드 누락 시 검증 실패', () => {
      const incompleteResponse = {
        structure: {
          act1: {
            title: '시작',
            // description 누락
            key_elements: ['요소1'],
            emotional_arc: '감정'
          }
        }
      };

      expect(() => validateStoryResponse(incompleteResponse))
        .toThrow(StoryContractViolationError);
    });

    test('빈 배열 필드 시 검증 실패', () => {
      const responseWithEmptyArray = {
        structure: {
          act1: { title: '시작', description: '설명', key_elements: [], emotional_arc: '감정' }, // 빈 배열
          act2: { title: '전개', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
          act3: { title: '절정', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
          act4: { title: '결말', description: '설명', key_elements: ['요소'], emotional_arc: '감정' }
        },
        visual_style: ['기본'],
        mood_palette: ['기본'],
        technical_approach: ['기본'],
        target_audience_insights: ['기본']
      };

      expect(() => validateStoryResponse(responseWithEmptyArray))
        .toThrow(StoryContractViolationError);
    });
  });
});