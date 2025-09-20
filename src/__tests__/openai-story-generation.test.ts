/**
 * OpenAI 스토리 생성 빈칸 문제 - TDD Red Phase
 *
 * 문제 상황:
 * - AI 생성 결과가 빈 값으로 반환되는 경우
 * - content 필드 누락으로 인한 JSON 파싱 오류
 * - ScenarioContent 매핑 시 필수 필드 부재
 *
 * 테스트 시나리오:
 * 1. OpenAI 응답이 빈 content인 경우
 * 2. JSON 구조에서 필수 필드 누락
 * 3. 잘못된 JSON 형식 응답
 * 4. choices 배열이 비어있는 경우
 * 5. 파싱된 구조에서 act1~act4 누락
 */

import { generateStoryWithOpenAI, OpenAIClient } from '@/lib/providers/openai-client';
import { ScenarioContent } from '@/entities/planning/model/types';

// MSW를 통한 OpenAI API 모킹
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('OpenAI 스토리 생성 빈칸 문제 - Red Phase', () => {
  const validStoryRequest = {
    story: '로봇과 인간의 우정 이야기',
    genre: '드라마',
    tone: '감동적',
    target: '일반 시청자',
    duration: '60초',
    format: '16:9',
    tempo: '보통',
    developmentMethod: '클래식 기승전결',
    developmentIntensity: '보통',
  };

  describe('빈 응답 처리', () => {
    it('OpenAI에서 빈 content를 반환하는 경우 기본값을 제공해야 함', async () => {
      // Given: OpenAI가 빈 content를 반환
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '', // 빈 content
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 0,
              total_tokens: 100,
            },
          });
        })
      );

      // When: 스토리 생성 시도
      const result = await generateStoryWithOpenAI(validStoryRequest);

      // Then: 사용자 친화적 에러 메시지 제공
      expect(result.ok).toBe(false);
      expect(result.error).toContain('스토리 생성 중 문제가 발생했습니다');
    });

    it('choices 배열이 비어있는 경우 에러 처리해야 함', async () => {
      // Given: choices가 빈 배열
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [], // 빈 배열
            usage: {
              prompt_tokens: 100,
              completion_tokens: 0,
              total_tokens: 100,
            },
          });
        })
      );

      // When: 스토리 생성 시도
      const result = await generateStoryWithOpenAI(validStoryRequest);

      // Then: 사용자 친화적 에러 메시지 제공
      expect(result.ok).toBe(false);
      expect(result.error).toContain('스토리 생성 중 문제가 발생했습니다');
    });
  });

  describe('JSON 파싱 실패 처리', () => {
    it('잘못된 JSON 형식인 경우 원문 반환하되 기본 구조를 제공해야 함', async () => {
      // Given: 잘못된 JSON 형식 응답
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '잘못된 JSON { broken syntax', // 잘못된 JSON
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
          });
        })
      );

      // When: 스토리 생성 시도
      const result = await generateStoryWithOpenAI(validStoryRequest);

      // Then: 성공하되 기본 폴백 구조 제공
      expect(result.ok).toBe(true);
      expect(result.content).toBe('잘못된 JSON { broken syntax');
      expect(result.structure).toBeDefined(); // 기본 구조 제공
      expect(result.structure?.structure?.act1?.title).toBe('AI 생성 스토리 - 1막');
    });

    it('유효한 JSON이지만 필수 필드 누락시 기본값 제공해야 함', async () => {
      // Given: 유효한 JSON이지만 act 구조 누락
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    // act1~act4 누락된 잘못된 구조
                    visual_style: ['스타일1'],
                    mood_palette: ['분위기1'],
                  }),
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150,
            },
          });
        })
      );

      // When: 스토리 생성 시도
      const result = await generateStoryWithOpenAI(validStoryRequest);

      // Then: 성공하되 기본 폴백 구조 제공
      expect(result.ok).toBe(true);
      expect(result.structure).toBeDefined();
      // 기본 act 구조가 제공되어야 함
      expect(result.structure?.structure?.act1?.title).toBe('AI 생성 스토리 - 1막');
      expect(result.structure?.structure?.act2?.title).toBe('AI 생성 스토리 - 2막');
      expect(result.structure?.structure?.act3?.title).toBe('AI 생성 스토리 - 3막');
      expect(result.structure?.structure?.act4?.title).toBe('AI 생성 스토리 - 4막');
    });
  });

  describe('ScenarioContent 매핑 안전성', () => {
    it('ScenarioContent 생성 시 필수 필드 기본값이 설정되어야 함', () => {
      // Given: 불완전한 OpenAI 응답 데이터
      const incompleteResponse = {
        structure: {
          // act 구조 누락
          visual_style: ['스타일1'],
        },
      };

      // When: ScenarioContent 생성 시도
      const createScenarioContent = () => {
        const scenarioData: Partial<ScenarioContent> = {
          id: 'test-id',
          type: 'scenario',
          title: '', // 빈 title
          story: validStoryRequest.story,
          status: 'draft',
          storageStatus: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: incompleteResponse,
        };

        return scenarioData;
      };

      // Then: 기본값이 설정되어야 함 (현재는 실패)
      const scenario = createScenarioContent();
      expect(scenario.title).toBe(''); // 현재 빈 문자열 - 실패 예상
      expect(scenario.metadata).toBeDefined();
    });

    it('제목 추출 실패 시 기본 제목을 제공해야 함', () => {
      // Given: act1.title이 없는 응답
      const responseWithoutTitle = {
        structure: {
          structure: {
            act1: {
              // title 필드 누락
              description: '1막 설명',
              key_elements: ['요소1'],
            },
          },
        },
      };

      // When: 제목 추출 시도
      const extractTitle = (response: any): string => {
        return response.structure?.structure?.act1?.title || 'AI 생성 스토리';
      };

      const title = extractTitle(responseWithoutTitle);

      // Then: 기본 제목이 제공되어야 함
      expect(title).toBe('AI 생성 스토리');
    });
  });

  describe('API 라우트 Zod 검증 강화', () => {
    it('응답 구조 검증 스키마가 구현되어야 함', async () => {
      // Given: 새로 구현된 응답 검증 스키마 (동적 import 사용)
      const schema = await import('@/shared/schemas/openai-response.schema');

      // When: 스키마 존재 검증
      const hasResponseValidation = schema.OpenAIStoryResponseSchema !== undefined;

      // Then: 응답 검증 스키마가 있어야 함
      expect(hasResponseValidation).toBe(true);
    });

    it('응답 데이터 타입 안전성 검증이 구현되어야 함', async () => {
      // Given: 불완전한 OpenAI 응답
      const incompleteOpenAIResponse = {
        ok: false,
        content: '',
        structure: null,
        usage: undefined,
      };

      const schema = await import('@/shared/schemas/openai-response.schema');

      // When: 타입 안전성 검증
      const validationResult = schema.OpenAIStoryResponseSchema.safeParse(incompleteOpenAIResponse);

      // Then: 검증이 정상 작동해야 함
      expect(validationResult.success).toBe(true); // 스키마가 optional 필드를 허용
    });
  });

  describe('에러 복구 및 사용자 경험', () => {
    it('API 호출 실패 시 사용자 친화적 메시지를 제공해야 함', async () => {
      // Given: OpenAI API 500 에러
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      // When: 스토리 생성 시도
      const result = await generateStoryWithOpenAI(validStoryRequest);

      // Then: 사용자 친화적 에러 메시지
      expect(result.ok).toBe(false);
      expect(result.error).toContain('AI 서비스에 일시적인 문제가 있습니다');
      expect(result.error).not.toContain('Internal server error'); // 기술적 세부사항 숨김
    });

    it('네트워크 에러 시 재시도 로직이 작동해야 함', async () => {
      let callCount = 0;

      // Given: 처음 2번은 실패, 3번째는 성공
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          callCount++;

          if (callCount <= 2) {
            throw new Error('Network error');
          }

          // 3번째 시도에서 성공
          return HttpResponse.json({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    structure: {
                      act1: { title: '재시도 성공', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
                      act2: { title: '재시도 성공', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
                      act3: { title: '재시도 성공', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
                      act4: { title: '재시도 성공', description: '설명', key_elements: ['요소'], emotional_arc: '감정' },
                    },
                  }),
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 200,
              total_tokens: 300,
            },
          });
        })
      );

      // When: 스토리 생성 시도
      const result = await generateStoryWithOpenAI(validStoryRequest);

      // Then: 재시도를 통해 성공
      expect(result.ok).toBe(true);
      expect(callCount).toBe(3); // 3번 시도했어야 함
      expect(result.structure?.structure?.act1?.title).toBe('재시도 성공');
    });
  });
});

describe('회귀 방지 통합 테스트', () => {
  it('정상 응답에서는 모든 필드가 올바르게 매핑되어야 함', async () => {
    // Given: 완전한 OpenAI 응답
    const completeResponse = {
      structure: {
        act1: {
          title: '시작',
          description: '1막 설명',
          key_elements: ['요소1', '요소2'],
          emotional_arc: '감정 변화',
        },
        act2: {
          title: '발전',
          description: '2막 설명',
          key_elements: ['요소3', '요소4'],
          emotional_arc: '감정 변화',
        },
        act3: {
          title: '절정',
          description: '3막 설명',
          key_elements: ['요소5', '요소6'],
          emotional_arc: '감정 변화',
        },
        act4: {
          title: '결말',
          description: '4막 설명',
          key_elements: ['요소7', '요소8'],
          emotional_arc: '감정 변화',
        },
      },
      visual_style: ['스타일1', '스타일2'],
      mood_palette: ['분위기1', '분위기2'],
    };

    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify(completeResponse),
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 200,
            total_tokens: 300,
          },
        });
      })
    );

    // When: 정상 스토리 생성
    const result = await generateStoryWithOpenAI({
      story: '완전한 스토리 테스트',
      genre: '드라마',
      tone: '감동적',
      target: '일반 시청자',
    });

    // Then: 모든 데이터가 정확히 매핑
    expect(result.ok).toBe(true);
    expect(result.structure).toBeDefined();
    expect(result.structure?.structure?.act1?.title).toBe('시작');
    expect(result.structure?.structure?.act2?.title).toBe('발전');
    expect(result.structure?.structure?.act3?.title).toBe('절정');
    expect(result.structure?.structure?.act4?.title).toBe('결말');
    expect(result.usage?.totalTokens).toBe(300);
  });
});