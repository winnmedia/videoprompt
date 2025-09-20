/**
 * Planning 도메인 서비스
 * FSD Architecture - Entities Layer
 *
 * 핵심 원칙:
 * - 도메인 로직만 포함 (순수 함수)
 * - 외부 의존성 주입 방식
 * - Supabase 전용 스토리지 (Prisma 완전 제거)
 * - 데이터 일관성 보장
 */

import { logger } from '@/shared/lib/logger';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import {


  PlanningContent,
  ScenarioContent,
  PromptContent,
  VideoContent,
  StorageResult,
  DualStorageConfig,
  StorageStatus,
  PlanningDomainError,
  StorageConsistencyError,
  InvalidContentError,
  DualStorageError} from './types';

// ============================================================================
// 외부 의존성 인터페이스 (의존성 주입)
// ============================================================================

export interface SupabaseRepository {
  saveScenario(data: ScenarioContent): Promise<{ success: boolean; error?: string }>;
  savePrompt(data: PromptContent): Promise<{ success: boolean; error?: string }>;
  saveVideo(data: VideoContent): Promise<{ success: boolean; error?: string }>;
  findById(id: string): Promise<PlanningContent | null>;
  updateStatus(id: string, status: Partial<PlanningContent>): Promise<{ success: boolean; error?: string }>;
}

export interface DualStorageDependencies {
  supabase: SupabaseRepository;
  config: DualStorageConfig;
}

// ============================================================================
// 도메인 서비스 - 컨텐츠 생성 및 저장
// ============================================================================

/**
 * 시나리오 저장 서비스
 */
export async function saveScenario(
  scenarioData: Omit<ScenarioContent, 'id' | 'createdAt' | 'updatedAt' | 'storage' | 'storageStatus'>,
  dependencies: DualStorageDependencies
): Promise<StorageResult> {
  const contentId = generateContentId('scenario', scenarioData.projectId);
  const timestamp = new Date().toISOString();

  // 완전한 시나리오 엔티티 생성
  const scenario: ScenarioContent = {
    ...scenarioData,
    id: contentId,
    type: 'scenario',
    createdAt: timestamp,
    updatedAt: timestamp,
    storageStatus: 'saving',
    storage: {
      prisma: { saved: false },
      supabase: { saved: false }
    }
  };

  // 비즈니스 규칙 검증
  validateScenario(scenario);

  return await performDualStorage(scenario, dependencies, 'saveScenario');
}

/**
 * 프롬프트 저장 서비스
 */
export async function savePrompt(
  promptData: Omit<PromptContent, 'id' | 'createdAt' | 'updatedAt' | 'storage' | 'storageStatus'>,
  dependencies: DualStorageDependencies
): Promise<StorageResult> {
  const contentId = generateContentId('prompt', promptData.projectId);
  const timestamp = new Date().toISOString();

  // 완전한 프롬프트 엔티티 생성
  const prompt: PromptContent = {
    ...promptData,
    id: contentId,
    type: 'prompt',
    createdAt: timestamp,
    updatedAt: timestamp,
    storageStatus: 'saving',
    storage: {
      prisma: { saved: false },
      supabase: { saved: false }
    },
    metadata: {
      ...promptData.metadata,
      keywordCount: promptData.keywords?.length || 0,
      segmentCount: 1,
      promptLength: promptData.finalPrompt.length
    }
  };

  // 비즈니스 규칙 검증
  validatePrompt(prompt);

  return await performDualStorage(prompt, dependencies, 'savePrompt');
}

/**
 * 영상 저장 서비스
 */
export async function saveVideo(
  videoData: Omit<VideoContent, 'id' | 'createdAt' | 'updatedAt' | 'storage' | 'storageStatus'>,
  dependencies: DualStorageDependencies
): Promise<StorageResult> {
  const contentId = generateContentId('video', videoData.projectId);
  const timestamp = new Date().toISOString();

  // 완전한 영상 엔티티 생성
  const video: VideoContent = {
    ...videoData,
    id: contentId,
    type: 'video',
    createdAt: timestamp,
    updatedAt: timestamp,
    storageStatus: 'saving',
    storage: {
      prisma: { saved: false },
      supabase: { saved: false }
    }
  };

  // 비즈니스 규칙 검증
  validateVideo(video);

  return await performDualStorage(video, dependencies, 'saveVideo');
}

// ============================================================================
// 듀얼 스토리지 핵심 로직
// ============================================================================

async function performDualStorage<T extends PlanningContent>(
  content: T,
  dependencies: DualStorageDependencies,
  operation: 'saveScenario' | 'savePrompt' | 'saveVideo'
): Promise<StorageResult> {
  const { supabase, config } = dependencies;
  const results = {
    supabase: { success: false, error: undefined as string | undefined }
  };

  logger.info(`💾 Starting Supabase storage for ${content.type}: ${content.id}`, {
    supabaseEnabled: config.supabaseEnabled
  });

  // Prisma 완전 제거됨

  // Supabase 저장 시도
  if (config.supabaseEnabled) {
    try {
      const supabaseResult = await (supabase[operation] as any)(content);
      results.supabase = supabaseResult;

      if (supabaseResult.success) {
        logger.info(`✅ Supabase save successful for ${content.id}`);
      } else {
        console.error(`❌ Supabase save failed for ${content.id}:`, supabaseResult.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Supabase error';
      results.supabase = { success: false, error: errorMessage };
      console.error(`❌ Supabase save exception for ${content.id}:`, errorMessage);
    }
  }

  // 결과 분석 및 일관성 결정
  return analyzeStorageResults(content.id, results, config);
}

/**
 * 저장 결과 분석 및 일관성 상태 결정
 */
function analyzeStorageResults(
  contentId: string,
  results: {
    supabase: { success: boolean; error?: string };
  },
  config: DualStorageConfig
): StorageResult {
  const { supabase } = results;

  // Supabase 전용 성공 처리
  if (supabase.success) {
    logger.info(`✅ Supabase save successful for ${contentId}`);
    return {
      success: true,
      contentId,
      storage: results,
      message: 'Content saved successfully to Supabase',
      consistency: 'full'
    };
  }

  // Supabase 실패 처리
  // PRISMA_DISABLED: if (prisma.success || supabase.success) {
  //   const successfulStorage = prisma.success ? 'Prisma' : 'Supabase';
  //   const failedStorage = !prisma.success ? 'Prisma' : 'Supabase';
  //
  //   if (config.requireBoth) {
  //     console.error(`❌ Partial storage not acceptable for ${contentId} (requireBoth=true)`);
  //     return {
  //       success: false,
  //       contentId,
  //       storage: results,
  //       message: `Partial storage failure: ${failedStorage} failed, ${successfulStorage} succeeded`,
  //       consistency: 'failed'
  //     };
  //   }
  //
  //   // Prisma 우선 정책 적용
  //   if (config.fallbackToPrisma && prisma.success) {
  //     console.warn(`⚠️ Partial consistency for ${contentId}: Prisma saved, Supabase failed`);
  //     return {
  //       success: true,
  //       contentId,
  //       storage: results,
  //       message: `Content saved to ${successfulStorage}. ${failedStorage} failed but fallback policy applied.`,
  //       consistency: 'partial'
  //     };
  //   }
  //
  //   if (supabase.success && !prisma.success) {
  //     console.warn(`⚠️ Partial consistency for ${contentId}: Supabase saved, Prisma failed`);
  //     return {
  //       success: true,
  //       contentId,
  //       storage: results,
  //       message: `Content saved to Supabase only. Prisma failed.`,
  //       consistency: 'partial'
  //     };
  //   }
  // }

  // Supabase 실패
  console.error(`❌ Supabase storage failure for ${contentId}:`, supabase.error);
  return {
    success: false,
    contentId,
    storage: results,
    message: `Supabase save failed: ${supabase.error || 'Unknown error'}`,
    consistency: 'failed'
  };
}

// ============================================================================
// 도메인 검증 로직
// ============================================================================

function validateScenario(scenario: ScenarioContent): void {
  if (!scenario.title || scenario.title.trim().length === 0) {
    throw new InvalidContentError('Scenario title is required');
  }

  if (!scenario.story || scenario.story.trim().length === 0) {
    throw new InvalidContentError('Scenario story is required');
  }

  if (scenario.title.length > 200) {
    throw new InvalidContentError('Scenario title too long (max 200 characters)');
  }

  if (scenario.story.length > 5000) {
    throw new InvalidContentError('Scenario story too long (max 5000 characters)');
  }
}

function validatePrompt(prompt: PromptContent): void {
  if (!prompt.finalPrompt || prompt.finalPrompt.trim().length === 0) {
    throw new InvalidContentError('Final prompt is required');
  }

  if (prompt.finalPrompt.length > 2000) {
    throw new InvalidContentError('Final prompt too long (max 2000 characters)');
  }

  if (prompt.keywords && prompt.keywords.length > 20) {
    throw new InvalidContentError('Too many keywords (max 20)');
  }
}

function validateVideo(video: VideoContent): void {
  if (video.status === 'completed' && !video.videoUrl) {
    throw new InvalidContentError('Video URL is required for completed videos');
  }

  if (video.videoUrl && !isValidUrl(video.videoUrl)) {
    throw new InvalidContentError('Invalid video URL format');
  }

  if (video.thumbnailUrl && !isValidUrl(video.thumbnailUrl)) {
    throw new InvalidContentError('Invalid thumbnail URL format');
  }
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

function generateContentId(type: string, projectId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const safeProjectId = projectId || 'default';
  return `${type}_${safeProjectId}_${timestamp}_${random}`;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Public API (FSD 원칙에 따른 명시적 export)
// ============================================================================

// Note: 함수들은 이미 개별적으로 export되어 있음
// 타입들은 types.ts에서 re-export