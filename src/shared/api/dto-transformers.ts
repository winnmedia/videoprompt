/**
 * DTO 변환 계층 - API 응답을 View Model로 안전하게 변환
 * CLAUDE.md 데이터 계약 원칙에 따른 중앙화된 변환 로직
 */

import { 
  type StorySuccessResponse, 
  type Act,
  validateStoryResponse,
  StoryContractViolationError 
} from '@/shared/contracts/story.contract';
import { StoryStep, StoryInput } from '@/entities/scenario';

/**
 * API Act DTO를 StoryStep View Model로 변환
 */
export function transformActToStoryStep(
  act: Act, 
  index: number,
  totalActs: number = 4
): StoryStep {
  return {
    id: `step-${index + 1}`,
    title: act.title,
    summary: act.description.length > 100 
      ? act.description.substring(0, 100) + '...'
      : act.description,
    content: act.description,
    goal: act.emotional_arc,
    lengthHint: `전체의 ${Math.round(100 / totalActs)}%`,
    isEditing: false,
  };
}

/**
 * 스토리 구조 DTO를 StoryStep 배열로 변환
 * 타입 안전성과 런타임 검증을 보장
 */
export function transformStoryStructureToSteps(
  response: unknown,
  context: string = 'Story API Response'
): StoryStep[] {
  // 먼저 스키마 검증으로 타입 안전성 보장
  let validatedResponse: StorySuccessResponse;
  try {
    validatedResponse = validateStoryResponse(response, context);
  } catch (error) {
    console.error(`DTO 변환 실패 - ${context}:`, error);
    
    // 검증 실패 시 빈 배열 반환 (graceful degradation)
    return [];
  }

  const { structure } = validatedResponse;
  const acts = [structure.act1, structure.act2, structure.act3, structure.act4];

  return acts.map((act, index) => transformActToStoryStep(act, index, 4));
}

/**
 * Legacy 응답 구조 처리 (하위 호환성)
 * 기존 배열 형태 응답도 처리할 수 있도록 지원
 */
export function transformLegacyArrayToSteps(
  legacyStructure: any[],
  context: string = 'Legacy Structure'
): StoryStep[] {
  if (!Array.isArray(legacyStructure)) {
    console.warn(`Legacy 구조 변환 실패 - 배열이 아님 (${context})`);
    return [];
  }

  return legacyStructure.map((step, index) => ({
    id: `step-${index + 1}`,
    title: step.title || `단계 ${index + 1}`,
    summary: step.summary || step.description || '',
    content: step.content || step.description || '',
    goal: step.goal || step.emotional_arc || '',
    lengthHint: step.lengthHint || `전체의 ${Math.round(100 / 4)}%`,
    isEditing: false,
  }));
}

/**
 * 통합 DTO 변환 함수 - API 응답을 StoryStep으로 안전하게 변환
 * 신규/레거시 구조 모두 처리
 */
export function transformApiResponseToStorySteps(
  apiResponse: unknown,
  context: string = 'API Response'
): StoryStep[] {
  if (!apiResponse || typeof apiResponse !== 'object') {
    console.error(`DTO 변환 실패 - 잘못된 응답 형식 (${context}):`, apiResponse);
    return [];
  }

  const response = apiResponse as Record<string, any>;

  // 새로운 Gemini API 응답 구조 (steps 배열) 처리 우선
  // API 응답이 {success: true, data: {steps: [...]}} 형태인 경우
  const stepsData = response.data?.steps || response.steps;
  if (stepsData && Array.isArray(stepsData)) {
    return stepsData.map((step: any, index: number) => ({
      id: `step-${step.step || index + 1}`,
      title: step.title || `단계 ${index + 1}`,
      summary: step.description && step.description.length > 100
        ? step.description.substring(0, 100) + '...'
        : step.description || '',
      content: step.description || '',
      goal: step.emotionalArc || '',
      lengthHint: step.duration || `전체의 ${Math.round(100 / 4)}%`,
      isEditing: false,
    }));
  }

  // 신규 구조 (structure 객체) 처리
  if (response.structure && typeof response.structure === 'object') {
    return transformStoryStructureToSteps(apiResponse, context);
  }

  // Legacy 배열 구조 처리
  if (Array.isArray(response)) {
    return transformLegacyArrayToSteps(response, context);
  }

  // 직접 배열이 포함된 경우
  if (response.acts && Array.isArray(response.acts)) {
    return transformLegacyArrayToSteps(response.acts, context);
  }

  console.warn(`알 수 없는 응답 구조 (${context}):`, apiResponse);
  return [];
}

/**
 * 에러 응답 변환 유틸리티
 */
export function transformApiError(
  error: unknown,
  context: string = 'API Error'
): string {
  if (error instanceof StoryContractViolationError) {
    return `데이터 형식 오류: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, any>;
    return errorObj.message || errorObj.error || '알 수 없는 오류가 발생했습니다';
  }

  return '예상치 못한 오류가 발생했습니다';
}

/**
 * 요청 DTO 변환 - StoryInput을 API 요청 형식으로 변환
 * API 계약 준수: toneAndManner 배열을 문자열로 안전하게 변환
 */
export function transformStoryInputToApiRequest(storyInput: StoryInput) {
  // toneAndManner 배열을 문자열로 안전하게 변환
  let toneAndMannerString = '일반적';
  if (storyInput.toneAndManner && Array.isArray(storyInput.toneAndManner)) {
    const validTones = storyInput.toneAndManner
      .filter((tone: string) => tone && typeof tone === 'string' && tone.trim())
      .map((tone: string) => tone.trim());

    if (validTones.length > 0) {
      toneAndMannerString = validTones.join(', ');
    }
  }

  return {
    title: storyInput.title?.trim() || '영상 시나리오',
    oneLineStory: storyInput.oneLineStory?.trim() || '영상 시나리오를 만들어주세요',
    genre: storyInput.genre?.trim() || '드라마',
    toneAndManner: toneAndMannerString,
    target: storyInput.target?.trim() || '일반 시청자',
    duration: storyInput.duration?.trim() || '60초',
    format: storyInput.format?.trim() || '16:9',
    tempo: storyInput.tempo?.trim() || '보통',
    developmentMethod: storyInput.developmentMethod?.trim() || '클래식 기승전결',
    developmentIntensity: storyInput.developmentIntensity?.trim() || '보통',
  };
}