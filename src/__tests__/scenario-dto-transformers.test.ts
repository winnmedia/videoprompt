/**
 * 시나리오 기획 DTO 변환기 테스트
 *
 * TDD RED 단계: 실패하는 테스트 먼저 작성
 * - Gemini API 응답 → ScenarioPlanning 도메인 모델 변환
 * - 데이터 품질 검사 로직
 * - 씬 분할 품질 체크 및 중복 제거
 * - Zod 스키마 검증 및 타입 안전성
 */

import { dataTransformers } from '../shared/api/dto-transformers';
import { ValidationError } from '../shared/api/types';
import type { ScenarioPlanning, DataQualityResult } from '../shared/api/dto-transformers';

describe('ScenarioPlanning DTO 변환기', () => {
  const validGeminiResponse = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                title: '혁신적인 제품 광고',
                description: '새로운 스마트워치를 소개하는 매력적인 광고',
                targetAudience: '20-40대 직장인',
                toneAndManner: '친근하고 전문적인',
                estimatedDuration: 30,
                scenes: [
                  {
                    sceneNumber: 1,
                    title: '일상의 시작',
                    description: '평범한 하루를 시작하는 직장인의 모습을 보여주며 스마트워치의 필요성을 자연스럽게 암시하는 장면입니다. 햇살이 스며드는 깔끔한 침실에서 주인공이 기지개를 펴며 하루를 시작하는 모습을 통해 건강하고 활기찬 라이프스타일을 강조합니다.',
                    duration: 8,
                    visualDescription: '햇살이 비치는 침실에서 알람이 울리고 주인공이 일어나는 모습',
                    audioDescription: '부드러운 알람 소리와 함께 차분한 배경음악',
                    transition: {
                      type: 'fade',
                      duration: 1
                    },
                    prompt: {
                      image: '햇살 비치는 침실, 젊은 직장인이 침대에서 일어나는 모습, 자연스러운 조명',
                      negative: '어둡고 우울한 분위기',
                      styleKeywords: ['자연스러운', '밝은', '일상적인']
                    }
                  },
                  {
                    sceneNumber: 2,
                    title: '제품 소개',
                    description: '스마트워치의 주요 기능들을 우아하게 소개하는 핵심 씬입니다. 건강 모니터링, 알림 관리, 운동 추적 등 다양한 기능들을 직관적이고 매력적으로 보여주며, 사용자의 일상생활을 어떻게 개선시킬 수 있는지 구체적인 예시와 함께 설명합니다.',
                    duration: 12,
                    visualDescription: '세련된 스마트워치가 다양한 기능을 보여주는 클로즈업 샷',
                    audioDescription: '현대적이고 기술적인 사운드 이펙트',
                    transition: {
                      type: 'slide',
                      duration: 0.5
                    },
                    prompt: {
                      image: '고급스러운 스마트워치, 화면에 다양한 앱들, 매크로 촬영, 프리미엄 느낌',
                      negative: '저품질, 흐릿한',
                      styleKeywords: ['고급스러운', '기술적인', '세련된']
                    }
                  },
                  {
                    sceneNumber: 3,
                    title: '행동 유도',
                    description: '강력한 행동 유도와 함께 브랜드 메시지를 전달하는 마무리 씬입니다. 제품의 핵심 가치를 간결하게 요약하고, 시청자에게 명확한 다음 단계를 제시하며, 브랜드에 대한 긍정적인 인상을 마지막으로 각인시키는 중요한 순간입니다.',
                    duration: 10,
                    visualDescription: '브랜드 로고와 함께 구매 링크가 나타나는 깔끔한 화면',
                    audioDescription: '강렬하고 기억에 남는 브랜드 징글',
                    transition: {
                      type: 'zoom',
                      duration: 1
                    },
                    prompt: {
                      image: '브랜드 로고, 깔끔한 배경, 구매 버튼, 미니멀한 디자인',
                      negative: '복잡하고 어수선한',
                      styleKeywords: ['미니멀', '깔끔한', '브랜드']
                    }
                  }
                ],
                keywords: ['스마트워치', '혁신', '기술', '라이프스타일'],
                metadata: {
                  generatedAt: '2024-01-15T10:30:00.000Z',
                  modelUsed: 'gemini-pro',
                  promptUsed: '스마트워치 광고 시나리오를 작성해주세요',
                  version: '1.0'
                }
              })
            }
          ]
        },
        finishReason: 'STOP',
        index: 0
      }
    ],
    usageMetadata: {
      promptTokenCount: 150,
      candidatesTokenCount: 800,
      totalTokenCount: 950
    }
  };

  const projectId = 'project-123';
  const userId = 'user-456';
  const originalPrompt = '스마트워치 광고 시나리오를 작성해주세요';

  describe('Gemini API 응답 변환', () => {
    it('유효한 Gemini 응답을 ScenarioPlanning 도메인 모델로 변환해야 한다', () => {
      const result = dataTransformers.scenarioPlanningFromGeminiResponse(
        validGeminiResponse,
        projectId,
        userId,
        originalPrompt
      );

      expect(result).toBeDefined();
      expect(result.projectId).toBe(projectId);
      expect(result.userId).toBe(userId);
      expect(result.title).toBe('혁신적인 제품 광고');
      expect(result.scenes).toHaveLength(3);
      expect(result.scenes[0].sceneNumber).toBe(1);
      expect(result.scenes[0].prompt.image).toContain('햇살 비치는 침실');
      expect(result.metadata.promptUsed).toBe(originalPrompt);
      expect(result.qualityScore).toBeGreaterThan(0);
    });

    it('후보가 없는 Gemini 응답은 ValidationError를 발생시켜야 한다', () => {
      const invalidResponse = {
        candidates: [],
        usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 }
      };

      expect(() => {
        dataTransformers.scenarioPlanningFromGeminiResponse(
          invalidResponse,
          projectId,
          userId,
          originalPrompt
        );
      }).toThrow(ValidationError);
    });

    it('잘못된 JSON 형식의 응답은 ValidationError를 발생시켜야 한다', () => {
      const invalidJsonResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: '잘못된 JSON 형식' }]
            },
            index: 0
          }
        ]
      };

      expect(() => {
        dataTransformers.scenarioPlanningFromGeminiResponse(
          invalidJsonResponse,
          projectId,
          userId,
          originalPrompt
        );
      }).toThrow(ValidationError);
    });

    it('필수 필드가 누락된 응답은 ValidationError를 발생시켜야 한다', () => {
      const incompleteResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    // title 누락
                    scenes: [
                      {
                        sceneNumber: 1,
                        title: '씬 1',
                        description: '설명',
                        duration: 5,
                        visualDescription: '시각적 설명',
                        prompt: {
                          image: '이미지 프롬프트'
                        }
                      }
                    ],
                    metadata: {
                      generatedAt: '2024-01-15T10:30:00.000Z',
                      modelUsed: 'gemini-pro',
                      promptUsed: '테스트'
                    }
                  })
                }
              ]
            },
            index: 0
          }
        ]
      };

      expect(() => {
        dataTransformers.scenarioPlanningFromGeminiResponse(
          incompleteResponse,
          projectId,
          userId,
          originalPrompt
        );
      }).toThrow(ValidationError);
    });
  });

  describe('데이터 품질 검사', () => {
    let validScenarioPlanning: ScenarioPlanning;

    beforeEach(() => {
      validScenarioPlanning = dataTransformers.scenarioPlanningFromGeminiResponse(
        validGeminiResponse,
        projectId,
        userId,
        originalPrompt
      );
    });

    it('유효한 시나리오는 높은 품질 점수를 받아야 한다', () => {
      const qualityResult = dataTransformers.performDataQualityCheck(validScenarioPlanning);

      expect(qualityResult.isValid).toBe(true);
      expect(qualityResult.score).toBeGreaterThan(80);
      expect(qualityResult.errors).toHaveLength(0);
      expect(qualityResult.metrics.sceneCount).toBe(3);
      expect(qualityResult.metrics.wordCount).toBeGreaterThan(50);
    });

    it('씬이 부족한 시나리오는 오류를 발생시켜야 한다', () => {
      const shortScenario: ScenarioPlanning = {
        ...validScenarioPlanning,
        scenes: [validScenarioPlanning.scenes[0]] // 1개 씬만
      };

      const qualityResult = dataTransformers.performDataQualityCheck(shortScenario);

      expect(qualityResult.isValid).toBe(false);
      expect(qualityResult.errors.some(e => e.code === 'INSUFFICIENT_SCENES')).toBe(true);
    });

    it('중복된 씬 제목이 있으면 경고를 발생시켜야 한다', () => {
      const duplicateScenario: ScenarioPlanning = {
        ...validScenarioPlanning,
        scenes: [
          { ...validScenarioPlanning.scenes[0], title: '같은 제목' },
          { ...validScenarioPlanning.scenes[1], title: '같은 제목' },
          { ...validScenarioPlanning.scenes[2], title: '다른 제목' }
        ]
      };

      const qualityResult = dataTransformers.performDataQualityCheck(duplicateScenario);

      expect(qualityResult.warnings.some(w => w.code === 'DUPLICATE_SCENES')).toBe(true);
      expect(qualityResult.metrics.duplicateScenes).toBe(1);
    });

    it('이미지 프롬프트가 누락된 씬은 오류를 발생시켜야 한다', () => {
      const missingPromptScenario: ScenarioPlanning = {
        ...validScenarioPlanning,
        scenes: [
          {
            ...validScenarioPlanning.scenes[0],
            prompt: { ...validScenarioPlanning.scenes[0].prompt, image: '' }
          },
          ...validScenarioPlanning.scenes.slice(1)
        ]
      };

      const qualityResult = dataTransformers.performDataQualityCheck(missingPromptScenario);

      expect(qualityResult.isValid).toBe(false);
      expect(qualityResult.errors.some(e => e.code === 'MISSING_IMAGE_PROMPT')).toBe(true);
      expect(qualityResult.metrics.missingPrompts).toBe(1);
    });

    it('너무 짧은 씬은 경고를 발생시켜야 한다', () => {
      const shortSceneScenario: ScenarioPlanning = {
        ...validScenarioPlanning,
        scenes: [
          { ...validScenarioPlanning.scenes[0], duration: 1 }, // 너무 짧음
          ...validScenarioPlanning.scenes.slice(1)
        ]
      };

      const qualityResult = dataTransformers.performDataQualityCheck(shortSceneScenario);

      expect(qualityResult.warnings.some(w => w.code === 'SCENE_TOO_SHORT')).toBe(true);
    });

    it('씬 순서가 연속적이지 않으면 오류를 발생시켜야 한다', () => {
      const invalidSequenceScenario: ScenarioPlanning = {
        ...validScenarioPlanning,
        scenes: [
          { ...validScenarioPlanning.scenes[0], sceneNumber: 1 },
          { ...validScenarioPlanning.scenes[1], sceneNumber: 3 }, // 2가 누락됨
          { ...validScenarioPlanning.scenes[2], sceneNumber: 4 }
        ]
      };

      const qualityResult = dataTransformers.performDataQualityCheck(invalidSequenceScenario);

      expect(qualityResult.isValid).toBe(false);
      expect(qualityResult.errors.some(e => e.code === 'INVALID_SCENE_SEQUENCE')).toBe(true);
    });

    it('약한 시각적 설명은 경고를 발생시켜야 한다', () => {
      const weakDescriptionScenario: ScenarioPlanning = {
        ...validScenarioPlanning,
        scenes: [
          { ...validScenarioPlanning.scenes[0], visualDescription: '짧음' }, // 너무 짧은 설명
          ...validScenarioPlanning.scenes.slice(1)
        ]
      };

      const qualityResult = dataTransformers.performDataQualityCheck(weakDescriptionScenario);

      expect(qualityResult.warnings.some(w => w.code === 'WEAK_VISUAL_DESCRIPTION')).toBe(true);
    });
  });

  describe('씬 분할 품질 체크', () => {
    it('평균 씬 지속시간을 올바르게 계산해야 한다', () => {
      const qualityResult = dataTransformers.performDataQualityCheck(
        dataTransformers.scenarioPlanningFromGeminiResponse(
          validGeminiResponse,
          projectId,
          userId,
          originalPrompt
        )
      );

      const expectedAverage = (8 + 12 + 10) / 3; // 씬들의 평균 지속시간
      expect(qualityResult.metrics.averageSceneDuration).toBe(expectedAverage);
    });

    it('매우 긴 씬에 대해 경고를 발생시켜야 한다', () => {
      const longSceneResponse = {
        ...validGeminiResponse,
        candidates: [
          {
            ...validGeminiResponse.candidates[0],
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    ...JSON.parse(validGeminiResponse.candidates[0].content.parts[0].text),
                    scenes: [
                      {
                        sceneNumber: 1,
                        title: '매우 긴 씬',
                        description: '이 씬은 매우 긴 지속시간을 가집니다',
                        duration: 45, // 매우 긴 지속시간
                        visualDescription: '긴 시각적 설명',
                        prompt: {
                          image: '이미지 프롬프트'
                        }
                      }
                    ]
                  })
                }
              ]
            }
          }
        ]
      };

      const scenario = dataTransformers.scenarioPlanningFromGeminiResponse(
        longSceneResponse,
        projectId,
        userId,
        originalPrompt
      );

      const qualityResult = dataTransformers.performDataQualityCheck(scenario);

      expect(qualityResult.warnings.some(w => w.code === 'SCENE_TOO_LONG')).toBe(true);
    });
  });

  describe('중복 제거 로직', () => {
    it('중복 키워드를 정확히 식별해야 한다', () => {
      const duplicateKeywordResponse = {
        ...validGeminiResponse,
        candidates: [
          {
            ...validGeminiResponse.candidates[0],
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    ...JSON.parse(validGeminiResponse.candidates[0].content.parts[0].text),
                    keywords: ['기술', '혁신', '기술', '라이프스타일', '혁신'] // 중복 있음
                  })
                }
              ]
            }
          }
        ]
      };

      // 키워드 중복은 현재 검사하지 않지만, 향후 확장 가능
      const scenario = dataTransformers.scenarioPlanningFromGeminiResponse(
        duplicateKeywordResponse,
        projectId,
        userId,
        originalPrompt
      );

      expect(scenario.keywords).toContain('기술');
      expect(scenario.keywords).toContain('혁신');
    });
  });

  describe('타입 안전성 검증', () => {
    it('변환된 객체는 readonly 불변성을 유지해야 한다', () => {
      const scenario = dataTransformers.scenarioPlanningFromGeminiResponse(
        validGeminiResponse,
        projectId,
        userId,
        originalPrompt
      );

      // TypeScript에서 readonly 속성은 컴파일 타임에 검증되므로,
      // 런타임에서는 Object.freeze로 불변성을 확인
      expect(Object.isFrozen(scenario)).toBe(true);
      expect(Object.isFrozen(scenario.scenes)).toBe(true);
      expect(Object.isFrozen(scenario.scenes[0])).toBe(true);
      expect(Object.isFrozen(scenario.metadata)).toBe(true);
    });

    it('ValidationError는 적절한 컨텍스트 정보를 포함해야 한다', () => {
      const invalidResponse = { invalid: 'data' };

      try {
        dataTransformers.scenarioPlanningFromGeminiResponse(
          invalidResponse,
          projectId,
          userId,
          originalPrompt
        );
        fail('ValidationError가 발생해야 합니다');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);

        if (error instanceof ValidationError) {
          expect(error.details).toBeDefined();
          expect(error.details.entityName).toBe('GeminiResponse');
          expect(error.details.receivedData).toBe(invalidResponse);
        }
      }
    });
  });
});

describe('환경변수 의존성 테스트', () => {
  let originalGlobal: any;

  beforeEach(() => {
    originalGlobal = (globalThis as any).SCENARIO_CONFIG;

    // 테스트용 설정 주입
    (globalThis as any).SCENARIO_CONFIG = {
      STORY_QUALITY_THRESHOLDS: {
        MIN_WORD_COUNT: 30,
        MAX_WORD_COUNT: 1000,
        MIN_SCENES: 2,
        MAX_SCENES: 20,
        MIN_SCENE_DURATION: 3,
        MAX_SCENE_DURATION: 25,
      }
    };
  });

  afterEach(() => {
    (globalThis as any).SCENARIO_CONFIG = originalGlobal;
  });

  it('커스텀 임계값으로 품질 검사를 수행해야 한다', () => {
    // 기존 유효한 시나리오를 기반으로 직접 ScenarioPlanning 객체 생성
    const shortScenario: ScenarioPlanning = {
      projectId: 'project-1',
      userId: 'user-1',
      title: '짧은 스토리',
      description: '테스트용 짧은 스토리',
      scenes: [
        {
          sceneNumber: 1,
          title: '씬 1',
          description: '매우 짧은 설명', // 30자 미만
          duration: 5,
          visualDescription: '시각적 설명',
          audioDescription: '오디오 설명',
          prompt: {
            image: '이미지 프롬프트',
            negative: '',
            styleKeywords: []
          }
        }
      ], // 1개 씬만 (MIN_SCENES: 2 위반)
      keywords: [],
      metadata: {
        generatedAt: new Date('2024-01-15T10:30:00.000Z'),
        modelUsed: 'gemini-pro',
        promptUsed: '테스트 프롬프트',
        version: '1.0'
      }
    };

    const qualityResult = dataTransformers.performDataQualityCheck(shortScenario);

    // 커스텀 임계값(MIN_WORD_COUNT: 30)에 따라 오류 발생
    expect(qualityResult.errors.some(e => e.code === 'CONTENT_TOO_SHORT')).toBe(true);
    // 커스텀 임계값(MIN_SCENES: 2)에 따라 오류 발생
    expect(qualityResult.errors.some(e => e.code === 'INSUFFICIENT_SCENES')).toBe(true);
  });
});