/**
 * 스토리 생성 API 데이터 계약 정의
 * CLAUDE.md 데이터 계약 원칙에 따른 스키마 검증
 */

import { z } from 'zod';

// Act 구조 스키마 (4단계 스토리 구조)
export const ActContract = z.object({
  title: z.string().min(1, 'Act 제목은 필수입니다'),
  description: z.string().min(1, 'Act 설명은 필수입니다'),
  key_elements: z.array(z.string()).min(1, '핵심 요소는 최소 1개 이상이어야 합니다'),
  emotional_arc: z.string().min(1, '감정 아크는 필수입니다'),
  // 확장된 필드들 (선택사항)
  visual_moments: z.array(z.string()).optional(),
  dialogue_sample: z.string().optional()
});

// 스토리 구조 스키마
export const StoryStructureContract = z.object({
  act1: ActContract,
  act2: ActContract, 
  act3: ActContract,
  act4: ActContract
});

// 스토리 응답 메타데이터
export const StoryMetadataContract = z.object({
  visual_style: z.array(z.string()).min(1, '비주얼 스타일은 최소 1개 이상이어야 합니다'),
  mood_palette: z.array(z.string()).min(1, '무드 팔레트는 최소 1개 이상이어야 합니다'),
  technical_approach: z.array(z.string()).min(1, '기술적 접근법은 최소 1개 이상이어야 합니다'),
  target_audience_insights: z.array(z.string()).min(1, '타겟 청중 인사이트는 최소 1개 이상이어야 합니다'),
  // 확장된 필드들 (선택사항)
  core_themes: z.array(z.string()).optional(),
  signature_elements: z.array(z.string()).optional()
});

// 프로젝트 정보 (저장 시 반환)
export const ProjectInfoContract = z.object({
  id: z.string().min(1, '프로젝트 ID는 필수입니다'),
  title: z.string().min(1, '프로젝트 제목은 필수입니다'),
  saved: z.literal(true)
});

// 스토리 생성 성공 응답
export const StorySuccessResponseContract = z.object({
  structure: StoryStructureContract,
  visual_style: z.array(z.string()),
  mood_palette: z.array(z.string()), 
  technical_approach: z.array(z.string()),
  target_audience_insights: z.array(z.string()),
  // 확장된 필드들 (선택사항)
  core_themes: z.array(z.string()).optional(),
  signature_elements: z.array(z.string()).optional(),
  // null과 undefined 모두 허용 - Railway API에서 null 반환 시 호환성 보장
  project: ProjectInfoContract.nullable().optional()
});

// 스토리 생성 에러 응답
export const StoryErrorResponseContract = z.object({
  error: z.string().min(1, '에러 메시지는 필수입니다'),
  userMessage: z.string().optional(),
  details: z.unknown().optional()
});

// 스토리 생성 요청 스키마
export const StoryRequestContract = z.object({
  story: z.string().min(1, '스토리 내용은 필수입니다'),
  genre: z.string().min(1, '장르는 필수입니다'),
  tone: z.string().min(1, '톤앤매너는 필수입니다'),
  target: z.string().min(1, '타겟 관객은 필수입니다'),
  duration: z.string().optional(),
  format: z.string().optional(),
  tempo: z.string().optional(), 
  developmentMethod: z.string().optional(),
  developmentIntensity: z.string().optional(),
  projectId: z.string().uuid().optional(),
  saveAsProject: z.boolean().optional(),
  projectTitle: z.string().optional()
});

// 타입 정의
export type Act = z.infer<typeof ActContract>;
export type StoryStructure = z.infer<typeof StoryStructureContract>;
export type StoryMetadata = z.infer<typeof StoryMetadataContract>;
export type ProjectInfo = z.infer<typeof ProjectInfoContract>;
export type StorySuccessResponse = z.infer<typeof StorySuccessResponseContract>;
export type StoryErrorResponse = z.infer<typeof StoryErrorResponseContract>;
export type StoryRequest = z.infer<typeof StoryRequestContract>;

// 통합 스토리 응답 타입 (성공/실패 union)
export type StoryResponse = StorySuccessResponse | StoryErrorResponse;

// 계약 위반 에러 클래스
export class StoryContractViolationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    public readonly context?: string
  ) {
    super(message);
    this.name = 'StoryContractViolationError';
  }
}

// 스키마 검증 유틸리티
export function validateStoryResponse(
  response: unknown,
  context?: string
): StorySuccessResponse {
  try {
    return StorySuccessResponseContract.parse(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((err: any) =>
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');

      console.error(`스토리 응답 스키마 검증 실패 ${context ? `(${context})` : ''}:`, {
        errors: error.issues,
        received: response
      });

      throw new StoryContractViolationError(
        `스토리 API 응답이 계약을 위반했습니다: ${fieldErrors}`,
        error.issues[0]?.path.join('.'),
        response,
        context
      );
    }

    throw new StoryContractViolationError(
      `예상치 못한 검증 오류: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      response,
      context
    );
  }
}

// 요청 검증 유틸리티
export function validateStoryRequest(
  request: unknown,
  context?: string
): StoryRequest {
  try {
    return StoryRequestContract.parse(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((err: any) =>
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');

      throw new StoryContractViolationError(
        `스토리 요청이 계약을 위반했습니다: ${fieldErrors}`,
        error.issues[0]?.path.join('.'),
        request,
        context
      );
    }

    throw new StoryContractViolationError(
      `예상치 못한 검증 오류: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      request,
      context
    );
  }
}