/**
 * OpenAI 응답 검증 스키마 - Zod 기반 런타임 타입 안전성
 * FSD Architecture - Shared Layer
 *
 * 목적:
 * - OpenAI API 응답의 런타임 검증
 * - 빈 값/누락 필드에 대한 안전한 기본값 제공
 * - JSON 파싱 오류 방지
 */

import { z } from 'zod';

/**
 * OpenAI API 기본 응답 구조
 */
export const OpenAIBaseResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    message: z.object({
      role: z.string(),
      content: z.string().min(1, '응답 내용이 비어있습니다'),
    }),
    finish_reason: z.string(),
  })).min(1, 'choices 배열이 비어있습니다'),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
});

/**
 * 스토리 구조 - Act 단위
 */
const ActSchema = z.object({
  title: z.string()
    .min(1, 'Act 제목이 필요합니다')
    .default('제목 없음'),
  description: z.string()
    .min(1, 'Act 설명이 필요합니다')
    .default('설명 없음'),
  key_elements: z.array(z.string())
    .min(1, '핵심 요소가 필요합니다')
    .default(['요소 없음']),
  emotional_arc: z.string()
    .min(1, '감정 변화 설명이 필요합니다')
    .default('감정 변화 없음'),
});

/**
 * 완전한 4막 구조 스키마
 */
const StoryStructureSchema = z.object({
  structure: z.object({
    act1: ActSchema,
    act2: ActSchema,
    act3: ActSchema,
    act4: ActSchema,
  }),
  visual_style: z.array(z.string()).default(['기본 스타일']),
  mood_palette: z.array(z.string()).default(['기본 분위기']),
  technical_approach: z.array(z.string()).optional().default(['기본 접근']),
  target_audience_insights: z.array(z.string()).optional().default(['일반 시청자']),
});

/**
 * OpenAI 스토리 생성 응답 검증 스키마
 */
export const OpenAIStoryResponseSchema = z.object({
  ok: z.boolean(),
  content: z.string().optional(),
  structure: StoryStructureSchema.optional().nullable(),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
    estimatedCost: z.number(),
  }).optional(),
  error: z.string().optional(),
  model: z.string().optional(),
});

/**
 * 안전한 JSON 파싱 함수
 */
export function safeParseStoryStructure(content: string): {
  success: boolean;
  data?: any;
  error?: string;
} {
  try {
    // JSON 블록 추출 시도
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

    const parsed = JSON.parse(jsonString);

    // Zod 스키마로 검증 및 기본값 적용
    const validationResult = StoryStructureSchema.safeParse(parsed);

    if (validationResult.success) {
      return {
        success: true,
        data: validationResult.data,
      };
    } else {
      return {
        success: false,
        error: `구조 검증 실패: ${validationResult.error.issues.map(issue => issue.message).join(', ')}`,
        data: createFallbackStructure(),
      };
    }
  } catch (parseError) {
    return {
      success: false,
      error: `JSON 파싱 실패: ${(parseError as Error).message}`,
      data: createFallbackStructure(),
    };
  }
}

/**
 * 기본 폴백 구조 생성
 */
export function createFallbackStructure() {
  return {
    structure: {
      act1: {
        title: 'AI 생성 스토리 - 1막',
        description: '스토리가 시작됩니다. 주인공과 상황을 소개합니다.',
        key_elements: ['주인공 등장', '배경 설정', '갈등 암시'],
        emotional_arc: '호기심과 기대감',
      },
      act2: {
        title: 'AI 생성 스토리 - 2막',
        description: '갈등이 심화되고 문제가 복잡해집니다.',
        key_elements: ['갈등 발생', '장애물 등장', '선택의 기로'],
        emotional_arc: '긴장감과 불안',
      },
      act3: {
        title: 'AI 생성 스토리 - 3막',
        description: '절정에 도달하며 모든 갈등이 폭발합니다.',
        key_elements: ['최대 위기', '결단의 순간', '행동'],
        emotional_arc: '극도의 긴장과 몰입',
      },
      act4: {
        title: 'AI 생성 스토리 - 4막',
        description: '갈등이 해결되고 이야기가 마무리됩니다.',
        key_elements: ['갈등 해결', '교훈', '새로운 시작'],
        emotional_arc: '카타르시스와 만족감',
      },
    },
    visual_style: ['감정적', '따뜻함'],
    mood_palette: ['희망적', '감동적'],
    technical_approach: ['클래식한 연출'],
    target_audience_insights: ['보편적 감정 어필'],
  };
}

/**
 * 사용자 친화적 에러 메시지 생성
 */
export function createUserFriendlyErrorMessage(error: any): string {
  const errorMessage = error?.message || String(error);

  // 기술적 세부사항 숨기고 사용자 친화적 메시지로 변환
  if (errorMessage.includes('rate limit')) {
    return 'AI 서비스 사용량이 많습니다. 잠시 후 다시 시도해주세요.';
  }

  if (errorMessage.includes('invalid api key') || errorMessage.includes('unauthorized')) {
    return 'AI 서비스 연결에 문제가 있습니다. 관리자에게 문의해주세요.';
  }

  if (errorMessage.includes('content') && errorMessage.includes('policy')) {
    return '입력하신 내용이 AI 정책에 위배됩니다. 다른 내용으로 시도해주세요.';
  }

  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
  }

  if (errorMessage.includes('500') || errorMessage.includes('Internal server error')) {
    return 'AI 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
  }

  // 기본 에러 메시지 (기술적 세부사항 제거)
  return '스토리 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

/**
 * ScenarioContent용 제목 추출 함수
 */
export function extractScenarioTitle(response: any): string {
  // 다양한 경로에서 제목 추출 시도
  const possibleTitles = [
    response?.structure?.structure?.act1?.title,
    response?.structure?.act1?.title,
    response?.act1?.title,
    response?.title,
  ];

  for (const title of possibleTitles) {
    if (title && typeof title === 'string' && title.trim().length > 0) {
      return title.trim();
    }
  }

  // 모든 시도가 실패한 경우 기본 제목
  return 'AI 생성 스토리';
}

/**
 * 타입 정의
 */
export type OpenAIBaseResponse = z.infer<typeof OpenAIBaseResponseSchema>;
export type OpenAIStoryResponse = z.infer<typeof OpenAIStoryResponseSchema>;
export type StoryStructure = z.infer<typeof StoryStructureSchema>;