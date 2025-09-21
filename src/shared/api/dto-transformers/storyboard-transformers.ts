/**
 * 스토리보드 관련 DTO 변환 계층
 * API 응답 ↔ 도메인 모델 간 안전한 데이터 변환
 * FSD shared 레이어 - Anti-Corruption Layer 역할
 */

import { Shot, StoryboardShot, InsertShot } from '@/entities/scenario';
import { logger } from '@/shared/lib/logger';
import { z } from 'zod';

// API 요청/응답 타입 정의
export interface ApiShotRequest {
  id?: string;
  stepId: string;
  title: string;
  description: string;
  shotType: string;
  camera: string;
  composition?: string;
  length: number;
  dialogue?: string;
  subtitle?: string;
  transition?: string;
}

export interface ApiShotResponse {
  id: string;
  stepId: string;
  title: string;
  description: string;
  shotType: string;
  camera: string;
  composition?: string;
  length: number;
  dialogue?: string;
  subtitle?: string;
  transition?: string;
  contiImage?: string;
  insertShots?: ApiInsertShotResponse[];
  metadata?: {
    aiGenerated: boolean;
    generatedAt: string;
    model?: string;
    prompt?: string;
  };
}

export interface ApiInsertShotResponse {
  id: string;
  purpose: string;
  description: string;
  framing: string;
  duration?: number;
}

export interface ApiStoryboardShotRequest {
  shotId: string;
  title: string;
  description?: string;
  shotType?: string;
  camera?: string;
  duration?: number;
  style?: string;
}

export interface ApiStoryboardShotResponse {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  prompt?: string;
  shotType?: string;
  camera?: string;
  duration?: number;
  index: number;
  metadata?: {
    generatedAt: string;
    model?: string;
    style?: string;
    seed?: number;
    iterations?: number;
  };
}

export interface ApiShotsGenerationResponse {
  success: boolean;
  data?: {
    shots: ApiShotResponse[];
    metadata?: {
      totalShots: number;
      aiModel: string;
      generatedAt: string;
      processingTime: number;
    };
  };
  message: string;
}

export interface ApiStoryboardGenerationResponse {
  success: boolean;
  data?: {
    storyboardShots: ApiStoryboardShotResponse[];
    metadata?: {
      totalImages: number;
      aiModel: string;
      generatedAt: string;
      processingTime: number;
      style: string;
    };
  };
  message: string;
}

// 런타임 검증 스키마
const ApiShotResponseSchema = z.object({
  id: z.string().uuid(),
  stepId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  shotType: z.string().min(1),
  camera: z.string().min(1),
  composition: z.string().optional(),
  length: z.number().positive(),
  dialogue: z.string().optional(),
  subtitle: z.string().optional(),
  transition: z.string().optional(),
  contiImage: z.string().url().optional(),
  insertShots: z.array(z.object({
    id: z.string().uuid(),
    purpose: z.string().min(1),
    description: z.string().min(1),
    framing: z.string().min(1),
    duration: z.number().optional(),
  })).optional(),
  metadata: z.object({
    aiGenerated: z.boolean(),
    generatedAt: z.string(),
    model: z.string().optional(),
    prompt: z.string().optional(),
  }).optional(),
});

const ApiStoryboardShotResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  prompt: z.string().optional(),
  shotType: z.string().optional(),
  camera: z.string().optional(),
  duration: z.number().optional(),
  index: z.number().int().min(0),
  metadata: z.object({
    generatedAt: z.string(),
    model: z.string().optional(),
    style: z.string().optional(),
    seed: z.number().optional(),
    iterations: z.number().optional(),
  }).optional(),
});

const ApiShotsGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    shots: z.array(ApiShotResponseSchema),
    metadata: z.object({
      totalShots: z.number(),
      aiModel: z.string(),
      generatedAt: z.string(),
      processingTime: z.number(),
    }).optional(),
  }).optional(),
  message: z.string(),
});

const ApiStoryboardGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    storyboardShots: z.array(ApiStoryboardShotResponseSchema),
    metadata: z.object({
      totalImages: z.number(),
      aiModel: z.string(),
      generatedAt: z.string(),
      processingTime: z.number(),
      style: z.string(),
    }).optional(),
  }).optional(),
  message: z.string(),
});

/**
 * Shot[] → API 요청 변환
 */
export function transformShotsToApiRequest(shots: Shot[]): ApiShotRequest[] {
  try {
    if (!Array.isArray(shots) || shots.length === 0) {
      throw new Error('변환할 샷 데이터가 없습니다');
    }

    return shots.map((shot, index) => {
      if (!shot.id?.trim()) {
        throw new Error(`${index + 1}번째 샷의 ID가 유효하지 않습니다`);
      }

      if (!shot.title?.trim()) {
        throw new Error(`${index + 1}번째 샷의 제목이 필요합니다`);
      }

      if (!shot.description?.trim()) {
        throw new Error(`${index + 1}번째 샷의 설명이 필요합니다`);
      }

      if (shot.length <= 0) {
        throw new Error(`${index + 1}번째 샷의 길이는 0보다 커야 합니다`);
      }

      return {
        id: shot.id,
        stepId: shot.stepId,
        title: shot.title.trim(),
        description: shot.description.trim(),
        shotType: shot.shotType || 'Medium Shot',
        camera: shot.camera || 'Static',
        composition: shot.composition?.trim() || '',
        length: shot.length,
        dialogue: shot.dialogue?.trim() || '',
        subtitle: shot.subtitle?.trim() || '',
        transition: shot.transition?.trim() || 'Cut',
      };
    });
  } catch (error) {
    throw new Error(`샷 데이터 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * API 응답 → Shot[] 변환
 */
export function transformApiResponseToShots(
  apiResponse: unknown,
  context: string = 'Shots API Response'
): Shot[] {
  try {
    const validatedResponse = ApiShotsGenerationResponseSchema.parse(apiResponse);

    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '샷 생성 요청이 실패했습니다');
    }

    if (!validatedResponse.data?.shots) {
      throw new Error('API 응답에 샷 데이터가 없습니다');
    }

    const shots: Shot[] = validatedResponse.data.shots.map((apiShot): Shot => ({
      id: apiShot.id,
      stepId: apiShot.stepId,
      title: apiShot.title,
      description: apiShot.description,
      shotType: apiShot.shotType,
      camera: apiShot.camera,
      composition: apiShot.composition || '',
      length: apiShot.length,
      dialogue: apiShot.dialogue || '',
      subtitle: apiShot.subtitle || '',
      transition: apiShot.transition || 'Cut',
      contiImage: apiShot.contiImage,
      insertShots: apiShot.insertShots?.map((insertShot): InsertShot => ({
        id: insertShot.id,
        purpose: insertShot.purpose,
        description: insertShot.description,
        framing: insertShot.framing,
      })) || [],
    }));

    // 권장 샷 수 검증 (12샷)
    if (shots.length !== 12) {
      logger.debug(`권장되는 12샷과 다른 ${shots.length}개 샷이 생성되었습니다`);
    }

    return shots;

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`${context} 데이터 검증 실패: ${errorDetails}`);
    }

    throw new Error(`${context} 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * StoryboardShot[] → API 요청 변환
 */
export function transformStoryboardShotsToApiRequest(
  storyboardShots: StoryboardShot[]
): ApiStoryboardShotRequest[] {
  try {
    if (!Array.isArray(storyboardShots) || storyboardShots.length === 0) {
      throw new Error('변환할 스토리보드 데이터가 없습니다');
    }

    return storyboardShots.map((shot, index) => {
      if (!shot.id?.trim()) {
        throw new Error(`${index + 1}번째 스토리보드 샷의 ID가 유효하지 않습니다`);
      }

      if (!shot.title?.trim()) {
        throw new Error(`${index + 1}번째 스토리보드 샷의 제목이 필요합니다`);
      }

      return {
        shotId: shot.id,
        title: shot.title.trim(),
        description: shot.description?.trim() || '',
        shotType: shot.shotType || 'Medium Shot',
        camera: shot.camera || 'Static',
        duration: shot.duration || 3,
        style: 'cinematic', // 기본 스타일
      };
    });
  } catch (error) {
    throw new Error(`스토리보드 데이터 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * API 응답 → StoryboardShot[] 변환
 */
export function transformApiResponseToStoryboardShots(
  apiResponse: unknown,
  context: string = 'Storyboard API Response'
): StoryboardShot[] {
  try {
    const validatedResponse = ApiStoryboardGenerationResponseSchema.parse(apiResponse);

    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '스토리보드 생성 요청이 실패했습니다');
    }

    if (!validatedResponse.data?.storyboardShots) {
      throw new Error('API 응답에 스토리보드 데이터가 없습니다');
    }

    const storyboardShots: StoryboardShot[] = validatedResponse.data.storyboardShots.map((apiShot): StoryboardShot => ({
      id: apiShot.id,
      title: apiShot.title,
      description: apiShot.description,
      imageUrl: apiShot.imageUrl,
      prompt: apiShot.prompt,
      shotType: apiShot.shotType,
      camera: apiShot.camera,
      duration: apiShot.duration,
      index: apiShot.index,
    }));

    // 인덱스 순으로 정렬
    storyboardShots.sort((a, b) => a.index - b.index);

    return storyboardShots;

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`${context} 데이터 검증 실패: ${errorDetails}`);
    }

    throw new Error(`${context} 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * 샷 타입 정규화 (표준 용어로 변환)
 */
export function normalizeShotType(shotType: string): string {
  const normalizedTypes: Record<string, string> = {
    'extreme close up': 'Extreme Close-up',
    'extreme close-up': 'Extreme Close-up',
    'ecu': 'Extreme Close-up',
    'close up': 'Close-up',
    'close-up': 'Close-up',
    'cu': 'Close-up',
    'medium close up': 'Medium Close-up',
    'medium close-up': 'Medium Close-up',
    'mcu': 'Medium Close-up',
    'medium shot': 'Medium Shot',
    'ms': 'Medium Shot',
    'medium long shot': 'Medium Long Shot',
    'mls': 'Medium Long Shot',
    'long shot': 'Long Shot',
    'ls': 'Long Shot',
    'extreme long shot': 'Extreme Long Shot',
    'els': 'Extreme Long Shot',
    'wide shot': 'Wide Shot',
    'ws': 'Wide Shot',
    'establishing shot': 'Establishing Shot',
    'master shot': 'Master Shot',
  };

  const lowercaseType = shotType.toLowerCase().trim();
  return normalizedTypes[lowercaseType] || shotType;
}

/**
 * 카메라 움직임 정규화
 */
export function normalizeCameraMovement(camera: string): string {
  const normalizedMovements: Record<string, string> = {
    'static': 'Static',
    'pan left': 'Pan Left',
    'pan right': 'Pan Right',
    'tilt up': 'Tilt Up',
    'tilt down': 'Tilt Down',
    'zoom in': 'Zoom In',
    'zoom out': 'Zoom Out',
    'dolly in': 'Dolly In',
    'dolly out': 'Dolly Out',
    'dolly left': 'Dolly Left',
    'dolly right': 'Dolly Right',
    'crane up': 'Crane Up',
    'crane down': 'Crane Down',
    'handheld': 'Handheld',
    'steadicam': 'Steadicam',
    'tracking': 'Tracking',
    'arc': 'Arc',
  };

  const lowercaseMovement = camera.toLowerCase().trim();
  return normalizedMovements[lowercaseMovement] || camera;
}

/**
 * 샷 데이터 정규화
 */
export function normalizeShots(shots: Shot[]): Shot[] {
  return shots.map((shot) => ({
    ...shot,
    title: shot.title?.trim() || '제목 없음',
    description: shot.description?.trim() || '',
    shotType: normalizeShotType(shot.shotType || 'Medium Shot'),
    camera: normalizeCameraMovement(shot.camera || 'Static'),
    composition: shot.composition?.trim() || '',
    dialogue: shot.dialogue?.trim() || '',
    subtitle: shot.subtitle?.trim() || '',
    transition: shot.transition?.trim() || 'Cut',
    length: Math.max(0.5, shot.length || 3), // 최소 0.5초
    insertShots: shot.insertShots?.map(insertShot => ({
      ...insertShot,
      purpose: insertShot.purpose?.trim() || '',
      description: insertShot.description?.trim() || '',
      framing: insertShot.framing?.trim() || '',
    })) || [],
  }));
}

/**
 * 스토리보드 샷 데이터 정규화
 */
export function normalizeStoryboardShots(storyboardShots: StoryboardShot[]): StoryboardShot[] {
  return storyboardShots.map((shot, index) => ({
    ...shot,
    title: shot.title?.trim() || `샷 ${index + 1}`,
    description: shot.description?.trim() || '',
    shotType: shot.shotType ? normalizeShotType(shot.shotType) : undefined,
    camera: shot.camera ? normalizeCameraMovement(shot.camera) : undefined,
    duration: Math.max(0.5, shot.duration || 3),
    index: shot.index >= 0 ? shot.index : index,
  }));
}

/**
 * 샷 길이 검증 및 조정
 */
export function validateAndAdjustShotDurations(
  shots: Shot[],
  targetTotalDuration: number = 60 // 기본 1분
): Shot[] {
  const currentTotalDuration = shots.reduce((sum, shot) => sum + shot.length, 0);

  if (Math.abs(currentTotalDuration - targetTotalDuration) <= 2) {
    // 2초 이내 차이는 허용
    return shots;
  }

  // 비례적으로 조정
  const scaleFactor = targetTotalDuration / currentTotalDuration;

  return shots.map(shot => ({
    ...shot,
    length: Math.max(0.5, Math.round(shot.length * scaleFactor * 10) / 10) // 0.1초 단위로 반올림
  }));
}

/**
 * 스토리보드 에러 변환
 */
export function transformStoryboardApiError(error: unknown, context: string = 'Storyboard API'): string {
  if (error instanceof Error) {
    if (error.message.includes('generation_quota_exceeded')) {
      return `${context} - 일일 생성 할당량이 초과되었습니다. 내일 다시 시도해주세요`;
    }

    if (error.message.includes('inappropriate_content')) {
      return `${context} - 부적절한 내용이 감지되어 생성이 중단되었습니다`;
    }

    if (error.message.includes('processing_timeout')) {
      return `${context} - 이미지 생성 시간이 초과되었습니다. 더 간단한 설명으로 다시 시도해주세요`;
    }

    return `${context} - ${error.message}`;
  }

  return `${context} - 알 수 없는 오류가 발생했습니다`;
}

/**
 * 스토리보드 데이터 검증
 */
export function validateStoryboardData(data: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    if (!data || typeof data !== 'object') {
      errors.push('유효하지 않은 데이터 형식입니다');
      return { isValid: false, errors };
    }

    const obj = data as Record<string, unknown>;

    if (!obj.success && !obj.data) {
      errors.push('API 응답 구조가 올바르지 않습니다');
    }

    if (obj.data && typeof obj.data === 'object') {
      const dataObj = obj.data as Record<string, unknown>;

      // 샷 데이터 검증
      if (dataObj.shots && Array.isArray(dataObj.shots)) {
        dataObj.shots.forEach((shot, index) => {
          if (!shot || typeof shot !== 'object') {
            errors.push(`${index + 1}번째 샷 데이터가 유효하지 않습니다`);
            return;
          }

          const shotObj = shot as Record<string, unknown>;

          if (!shotObj.id || typeof shotObj.id !== 'string') {
            errors.push(`${index + 1}번째 샷의 ID가 유효하지 않습니다`);
          }

          if (typeof shotObj.length === 'number' && shotObj.length <= 0) {
            errors.push(`${index + 1}번째 샷의 길이는 0보다 커야 합니다`);
          }
        });
      }

      // 스토리보드 이미지 데이터 검증
      if (dataObj.storyboardShots && Array.isArray(dataObj.storyboardShots)) {
        dataObj.storyboardShots.forEach((shot, index) => {
          if (!shot || typeof shot !== 'object') {
            errors.push(`${index + 1}번째 스토리보드 샷 데이터가 유효하지 않습니다`);
            return;
          }

          const shotObj = shot as Record<string, unknown>;

          if (!shotObj.id || typeof shotObj.id !== 'string') {
            errors.push(`${index + 1}번째 스토리보드 샷의 ID가 유효하지 않습니다`);
          }

          if (typeof shotObj.index === 'number' && shotObj.index < 0) {
            errors.push(`${index + 1}번째 스토리보드 샷의 인덱스가 유효하지 않습니다`);
          }
        });
      }
    }

    return { isValid: errors.length === 0, errors };

  } catch (error) {
    errors.push(`데이터 검증 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    return { isValid: false, errors };
  }
}