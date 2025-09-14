import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUser } from '@/shared/lib/auth';
import {
  createValidationErrorResponse,
  createErrorResponse
} from '@/shared/schemas/api.schema';
import { withCors } from '@/shared/lib/cors';
import { getGeminiClient } from '@/shared/lib/gemini-client';
import { buildStoryPrompt, type StoryPromptConfig } from '@/shared/lib/prompts/story-prompt-templates';

// Zod 스키마 정의 - 400 에러 방지를 위해 관대한 검증 + 기본값 제공
const StoryRequestSchema = z.object({
  story: z.string()
    .transform(val => val?.trim() || '')
    .refine(val => val.length >= 1, {
      message: '스토리를 입력해주세요 (최소 1자)'
    })
    .default('영상 시나리오를 만들어주세요'),
  genre: z.string()
    .transform(val => val?.trim() || '드라마')
    .default('드라마'),
  tone: z.string()
    .transform(val => {
      const cleanVal = val?.trim();
      // 빈 문자열이나 null/undefined 처리 강화
      return (!cleanVal || cleanVal === '') ? '일반적' : cleanVal;
    })
    .default('일반적'),
  target: z.string()
    .transform(val => val?.trim() || '일반 시청자')
    .default('일반 시청자'),
  duration: z.string().optional().default('60초'),
  format: z.string().optional().default('16:9'),
  tempo: z.string().optional().default('보통'),
  developmentMethod: z.string().optional().default('클래식 기승전결'),
  developmentIntensity: z.string().optional().default('보통'),
  projectId: z.string().uuid().optional(),
  saveAsProject: z.boolean().optional().default(false),
  projectTitle: z.string().optional(),
});

type StoryRequest = z.infer<typeof StoryRequestSchema>;

interface StoryStructure {
  act1: {
    title: string;
    description: string;
    key_elements: string[];
    emotional_arc: string;
  };
  act2: {
    title: string;
    description: string;
    key_elements: string[];
    emotional_arc: string;
  };
  act3: {
    title: string;
    description: string;
    key_elements: string[];
    emotional_arc: string;
  };
  act4: {
    title: string;
    description: string;
    key_elements: string[];
    emotional_arc: string;
  };
}

interface StoryResponse {
  structure: StoryStructure;
  visual_style: string[];
  mood_palette: string[];
  technical_approach: string[];
  target_audience_insights: string[];
}

export const POST = withCors(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // 데이터베이스 사용 가능 여부 런타임 체크
    const hasDatabaseUrl = !!process.env.DATABASE_URL;

    // 입력 데이터 검증
    const validationResult = StoryRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues.map((issue: any) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));

      // 첫 번째 에러 메시지를 우선으로 표시
      const primaryError = errorDetails[0];
      const userMessage = primaryError ? primaryError.message : '필수 정보가 누락되었습니다. 모든 필드를 입력했는지 확인해주세요.';

      return NextResponse.json({
        error: 'VALIDATION_ERROR',
        message: userMessage,
        details: errorDetails,
        userMessage
      }, { status: 400 });
    }

    const { story, genre, tone, target, duration, format, tempo, developmentMethod, developmentIntensity, projectId, saveAsProject, projectTitle } = validationResult.data;

    if (process.env.NODE_ENV === 'development') {
      console.log('[Story Generator] ========== 시작 ==========');
      console.log('[Story Generator] Gemini 2.0 Flash Preview 사용');
      console.log(`[Story Generator] 스토리: ${story.substring(0, 100)}...`);
      console.log(`[Story Generator] 장르: ${genre}, 톤: ${tone}, 전개: ${developmentMethod}`);
    }

    try {
      // Gemini 2.0 클라이언트 초기화
      const geminiClient = getGeminiClient();

      // 프롬프트 구성 설정
      const promptConfig: StoryPromptConfig = {
        story,
        genre,
        tone,
        target,
        duration,
        format,
        tempo,
        developmentMethod,
        developmentIntensity
      };

      // 구조화된 프롬프트 생성
      const prompt = buildStoryPrompt(promptConfig);

      if (process.env.NODE_ENV === 'development') {
        console.log('[Story Generator] 구조화된 프롬프트 생성 완료');
        console.log(`[Story Generator] 프롬프트 길이: ${prompt.length} 문자`);
      }

      // Gemini 2.0으로 JSON 응답 생성
      const parsedResponse = await geminiClient.generateJSON({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192
        }
      }, {
        rateLimitKey: 'story-generation',
        maxRetries: 3,
        enableLogging: process.env.NODE_ENV === 'development'
      });

      // 응답 구조 검증
      if (!parsedResponse.structure ||
          !parsedResponse.structure.act1 ||
          !parsedResponse.structure.act2 ||
          !parsedResponse.structure.act3 ||
          !parsedResponse.structure.act4) {
        throw new Error('Invalid response structure from Gemini');
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[Story Generator] ✅ 스토리 생성 및 검증 완료');
        console.log(`[Story Generator] Act1 제목: ${parsedResponse.structure.act1.title}`);
      }

      // Save to database if requested
      let savedProject = null;
      if (saveAsProject || projectId) {
        try {
          // 보안 강화: 인증된 사용자만 DB 저장 허용
          let user = null;
          try {
            user = await getUser(request);
          } catch (authError) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[Story Generator] 인증 실패 - DB 저장 거부:', authError);
            }
          }

          if (!user) {
            console.warn('[Story Generator] 🚨 미인증 사용자 - DB 저장 거부');
            // 인증되지 않은 사용자는 DB 저장 없이 AI 결과만 반환
          } else if (hasDatabaseUrl) {
            const scenarioData = {
              title: projectTitle || parsedResponse.structure.act1.title,
              story,
              genre,
              tone,
              target,
              duration,
              format,
              tempo,
              developmentMethod,
              developmentIntensity,
              structure: parsedResponse,
              geminiModel: 'gemini-2.0-flash-exp' // 모델 버전 기록
            };

            if (projectId) {
              // Update existing project
              savedProject = await prisma.project.update({
                where: {
                  id: projectId,
                  userId: user.id // Ensure user owns the project
                },
                data: {
                  metadata: scenarioData,
                  status: 'processing',
                  updatedAt: new Date()
                }
              });
              if (process.env.NODE_ENV === 'development') {
                console.log(`[Story Generator] 기존 프로젝트 업데이트: ${projectId}`);
              }
            } else {
              // Create new project
              savedProject = await prisma.project.create({
                data: {
                  title: projectTitle || `${genre} 스토리: ${parsedResponse.structure.act1.title}`,
                  description: `AI 생성 스토리 (Gemini 2.0) - ${tone} 톤앤매너`,
                  userId: user.id,
                  metadata: scenarioData,
                  status: 'draft',
                  tags: JSON.stringify([genre, tone, target])
                }
              });
              if (process.env.NODE_ENV === 'development') {
                console.log(`[Story Generator] 새 프로젝트 생성: ${savedProject.id}`);
              }
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('[Story Generator] ⚠️ DATABASE_URL 없음 - 프로젝트 저장 건너뜀');
            }
          }
        } catch (dbError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Story Generator] ❌ 데이터베이스 저장 실패:', dbError);
          }
          // Continue without failing the whole request
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[Story Generator] ========== 완료 ==========');
      }

      // Return response with project info if saved
      const response = {
        ...parsedResponse,
        project: savedProject ? {
          id: savedProject.id,
          title: savedProject.title,
          saved: true as const
        } : undefined,
        meta: {
          model: 'gemini-2.0-flash-exp',
          generatedAt: new Date().toISOString(),
          promptConfig
        }
      };

      return NextResponse.json(response);

    } catch (geminiError: any) {
      console.error('[Story Generator] Gemini API 오류:', geminiError);

      // Gemini 에러를 사용자 친화적으로 변환
      let userMessage = 'AI 스토리 생성에 실패했습니다. 잠시 후 다시 시도해주세요.';
      let statusCode = 503;

      if (geminiError.code === 'RATE_LIMIT_EXCEEDED') {
        userMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        statusCode = 429;
      } else if (geminiError.code === 'CONTENT_BLOCKED') {
        userMessage = '입력하신 내용이 안전 정책에 위배됩니다. 다른 내용으로 시도해주세요.';
        statusCode = 400;
      } else if (geminiError.code === 'BAD_REQUEST') {
        userMessage = '요청 형식이 올바르지 않습니다. 입력 내용을 확인해주세요.';
        statusCode = 400;
      }

      return NextResponse.json({
        error: geminiError.code || 'AI_GENERATION_ERROR',
        message: userMessage,
        details: process.env.NODE_ENV === 'development' ? geminiError.message : undefined
      }, { status: statusCode });
    }

  } catch (error) {
    console.error('[Story Generator] ❌ 예상치 못한 오류:', error);
    return NextResponse.json({
      error: 'INTERNAL_ERROR',
      message: '스토리 생성 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
});

// 기본 구조 생성 함수는 제거됨 (LLM 강제화)
// 아래 함수는 더 이상 사용되지 않지만, 타입 체크를 위해 남겨둠
// @deprecated
function generateDefaultStructure(
  story: string,
  genre: string,
  tone: string,
  target: string,
  developmentMethod?: string,
): StoryResponse {
  // 장르별 기본 구조 템플릿
  const genreTemplates = {
    drama: {
      act1: {
        title: '도입',
        description: '주인공과 기본 상황 소개',
        emotional_arc: '평온 → 호기심',
      },
      act2: { title: '전개', description: '갈등과 문제 상황 발생', emotional_arc: '혼란 → 고민' },
      act3: { title: '위기', description: '최대 위기 상황 도달', emotional_arc: '절망 → 각오' },
      act4: { title: '해결', description: '문제 해결과 성장', emotional_arc: '희망 → 성취' },
    },
    comedy: {
      act1: {
        title: '도입',
        description: '유쾌한 상황과 캐릭터 소개',
        emotional_arc: '평온 → 즐거움',
      },
      act2: { title: '전개', description: '재미있는 사건들 발생', emotional_arc: '즐거움 → 웃음' },
      act3: { title: '위기', description: '웃픈 위기 상황', emotional_arc: '당황 → 재미' },
      act4: { title: '해결', description: '해피엔딩과 웃음', emotional_arc: '기쁨 → 만족' },
    },
    action: {
      act1: { title: '도입', description: '액션 영웅과 배경 소개', emotional_arc: '평온 → 긴장' },
      act2: { title: '전개', description: '첫 번째 액션과 갈등', emotional_arc: '긴장 → 흥분' },
      act3: { title: '위기', description: '최고조 액션과 위기', emotional_arc: '흥분 → 절박' },
      act4: { title: '해결', description: '최종 승리와 해결', emotional_arc: '절박 → 승리' },
    },
    romance: {
      act1: { title: '도입', description: '만남과 첫 인상', emotional_arc: '무관심 → 호기심' },
      act2: { title: '전개', description: '서로를 알아가는 과정', emotional_arc: '호기심 → 호감' },
      act3: { title: '위기', description: '오해와 갈등 발생', emotional_arc: '호감 → 고민' },
      act4: { title: '해결', description: '화해와 사랑의 승리', emotional_arc: '고민 → 사랑' },
    },
    mystery: {
      act1: { title: '도입', description: '수수께끼와 의문 상황', emotional_arc: '평온 → 호기심' },
      act2: { title: '전개', description: '단서 발견과 추리', emotional_arc: '호기심 → 집중' },
      act3: { title: '위기', description: '위험과 절박한 상황', emotional_arc: '집중 → 공포' },
      act4: { title: '해결', description: '진실 발견과 해결', emotional_arc: '공포 → 안도' },
    },
  };

  // 전개 방식별 구조 생성
  let structure;
  
  switch (developmentMethod) {
    case '훅-몰입-반전-떡밥':
      structure = {
        act1: {
          title: '훅 (강한 시작)',
          description: '시청자의 관심을 즉시 끄는 강렬한 오프닝으로 시작',
          key_elements: ['강렬한 첫 장면', '즉시 몰입되는 상황', '호기심 유발 요소'],
          emotional_arc: '평온 → 강한 관심',
        },
        act2: {
          title: '몰입 (빠른 전개)',
          description: '빠른 템포로 스토리 몰입도 극대화',
          key_elements: ['핵심 갈등 제시', '캐릭터 동기 명확화', '빠른 전개'],
          emotional_arc: '관심 → 몰입',
        },
        act3: {
          title: '반전 (예상 밖 전개)',
          description: '예상과 다른 방향으로 스토리 전개',
          key_elements: ['예상 밖 전개', '충격적 반전', '새로운 관점'],
          emotional_arc: '몰입 → 충격',
        },
        act4: {
          title: '떡밥 (후속 기대)',
          description: '다음 이야기에 대한 기대감 조성',
          key_elements: ['미해결 요소', '다음 에피소드 힌트', '지속적 관심 유발'],
          emotional_arc: '충격 → 기대',
        },
      };
      break;
      
    case '귀납법':
      structure = {
        act1: {
          title: '사례 1',
          description: '첫 번째 구체적인 사례를 제시',
          key_elements: ['구체적 사례', '상황 설정', '관심 유발'],
          emotional_arc: '무관심 → 관심',
        },
        act2: {
          title: '사례 2',
          description: '두 번째 사례로 패턴을 강화',
          key_elements: ['유사한 사례', '패턴 인식', '연관성 발견'],
          emotional_arc: '관심 → 이해',
        },
        act3: {
          title: '사례 3',
          description: '세 번째 사례로 결론을 준비',
          key_elements: ['마지막 사례', '패턴 완성', '결론 준비'],
          emotional_arc: '이해 → 확신',
        },
        act4: {
          title: '결론',
          description: '사례들을 종합한 일반적 결론',
          key_elements: ['종합 분석', '일반화', '메시지 전달'],
          emotional_arc: '확신 → 깨달음',
        },
      };
      break;
      
    case '연역법':
      structure = {
        act1: {
          title: '결론 제시',
          description: '먼저 결론이나 주장을 명확히 제시',
          key_elements: ['명확한 주장', '방향성 제시', '관심 집중'],
          emotional_arc: '무관심 → 관심',
        },
        act2: {
          title: '근거 1',
          description: '첫 번째 근거와 논리적 설명',
          key_elements: ['첫 번째 근거', '논리적 설명', '신뢰성 구축'],
          emotional_arc: '관심 → 신뢰',
        },
        act3: {
          title: '근거 2',
          description: '두 번째 근거와 추가 설명',
          key_elements: ['두 번째 근거', '추가 설명', '설득력 강화'],
          emotional_arc: '신뢰 → 확신',
        },
        act4: {
          title: '재확인',
          description: '결론 재강조와 마무리',
          key_elements: ['결론 재강조', '종합 정리', '메시지 강화'],
          emotional_arc: '확신 → 확고함',
        },
      };
      break;
      
    case '다큐(인터뷰식)':
      structure = {
        act1: {
          title: '도입부',
          description: '주제 소개와 인터뷰 대상자 소개',
          key_elements: ['주제 소개', '인터뷰 대상자', '배경 설명'],
          emotional_arc: '무관심 → 관심',
        },
        act2: {
          title: '인터뷰 1',
          description: '첫 번째 핵심 인터뷰',
          key_elements: ['주요 인물 인터뷰', '경험담', '신뢰성 확보'],
          emotional_arc: '관심 → 몰입',
        },
        act3: {
          title: '인터뷰 2',
          description: '두 번째 관점의 인터뷰',
          key_elements: ['다른 관점', '균형 잡힌 시각', '객관성 확보'],
          emotional_arc: '몰입 → 이해',
        },
        act4: {
          title: '마무리',
          description: '내레이션과 결론',
          key_elements: ['내레이션', '종합 결론', '여운 남기기'],
          emotional_arc: '이해 → 깨달음',
        },
      };
      break;
      
    case '픽사스토리':
      structure = {
        act1: {
          title: '옛날 옛적에',
          description: '평범한 일상의 소개',
          key_elements: ['평범한 일상', '주인공 소개', '공감대 형성'],
          emotional_arc: '무관심 → 공감',
        },
        act2: {
          title: '매일',
          description: '반복되는 일상의 패턴',
          key_elements: ['일상적 패턴', '캐릭터 성격', '안정감'],
          emotional_arc: '공감 → 친근함',
        },
        act3: {
          title: '그러던 어느 날',
          description: '일상을 바꾸는 사건 발생',
          key_elements: ['특별한 사건', '전환점', '갈등 시작'],
          emotional_arc: '친근함 → 긴장',
        },
        act4: {
          title: '때문에',
          description: '사건의 결과와 변화',
          key_elements: ['변화와 성장', '해결', '새로운 일상'],
          emotional_arc: '긴장 → 만족',
        },
      };
      break;
      
    default:
      // 기본 기승전결 구조
      const template = genreTemplates[genre as keyof typeof genreTemplates] || genreTemplates.drama;
      structure = {
        act1: {
          ...template.act1,
          key_elements: ['상황 설정', '캐릭터 소개', '기본 배경'],
        },
        act2: {
          ...template.act2,
          key_elements: ['갈등 시작', '문제 심화', '긴장감 조성'],
        },
        act3: {
          ...template.act3,
          key_elements: ['절정 상황', '최대 위기', '해결 실마리'],
        },
        act4: {
          ...template.act4,
          key_elements: ['갈등 해결', '성장과 변화', '만족스러운 마무리'],
        },
      };
  }

  return {
    structure,
    visual_style: ['Cinematic', 'Photorealistic'],
    mood_palette: [tone, 'Immersive'],
    technical_approach: ['Dynamic Camera', 'Emotional Lighting'],
    target_audience_insights: [`${target}에게 어필하는 요소`, '감정적 몰입도'],
  };
}
