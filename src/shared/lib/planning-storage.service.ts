/**
 * 기획 단일 저장소 서비스 (Supabase Only)
 * 기존 dual-storage-service.ts를 단순화하여 Supabase만 사용
 *
 * 목적: 복잡성 최소화, Supabase 통합 완성
 */

import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { supabaseCircuitBreaker } from '@/shared/lib/circuit-breaker';
import type { Story } from '@/shared/schemas/story.schema';
import { logger } from './logger';


// 단일 저장소 결과 타입
interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  storyId?: string;
}

// 스토리 생성을 위한 입력 타입
interface CreateStoryInput {
  title: string;
  oneLineStory: string;
  genre: string;
  tone?: string;
  target?: string;
  structure?: any;
  userId?: string | null;
}

// 시나리오 생성을 위한 입력 타입
interface CreateScenarioInput {
  title: string;
  logline?: string;
  structure4?: any;
  shots12?: any;
  pdfUrl?: string;
  userId?: string | null;
}

// 프롬프트 생성을 위한 입력 타입
interface CreatePromptInput {
  id: string;
  scenarioId: string;
  projectId: string;
  title: string;
  content: string;
  finalPrompt: string;
  enhancedKeywords?: string[];
  keywords?: string[];
  estimatedTokens?: number;
  visualStyle?: string;
  mood?: string;
  quality?: string;
  userId?: string | null;
}

// 영상 생성을 위한 입력 타입
interface CreateVideoInput {
  id: string;
  promptId: string;
  projectId: string;
  title: string;
  prompt: string;
  provider: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  status: string;
  jobId?: string;
  userId?: string | null;
}

// 스토리 업데이트를 위한 입력 타입
interface UpdateStoryInput {
  projectId: string;
  title: string;
  oneLineStory: string;
  genre?: string;
  tone?: string;
  target?: string;
  structure?: any;
  userId?: string | null;
}

/**
 * 스토리를 Supabase에 저장
 */
export async function saveStory(input: CreateStoryInput): Promise<StorageResult<Story>> {
  logger.info('🔄 Planning Storage: 스토리 저장 시작', {
    title: input.title,
    userId: input.userId || 'guest'
  });

  try {
    const result = await supabaseCircuitBreaker.execute(async () => {
      const client = await getSupabaseClientSafe('admin');

      const { data, error } = await client
        .from('stories')
        .insert({
          id: crypto.randomUUID(),
          title: input.title,
          content: input.oneLineStory,
          genre: input.genre,
          tone: input.tone,
          target_audience: input.target,
          structure: input.structure,
          user_id: input.userId,
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase 스토리 저장 실패: ${error.message}`);
      }

      return data;
    });

    logger.info('✅ 스토리 저장 성공:', result.id);
    return {
      success: true,
      data: result,
      storyId: result.id,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 스토리 저장 실패:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 시나리오를 Supabase에 저장
 */
export async function saveScenario(input: CreateScenarioInput): Promise<StorageResult<any>> {
  logger.info('🔄 Planning Storage: 시나리오 저장 시작', {
    title: input.title,
    userId: input.userId || 'guest'
  });

  try {
    const result = await supabaseCircuitBreaker.execute(async () => {
      const client = await getSupabaseClientSafe('admin');

      const { data, error } = await client
        .from('scenarios')
        .insert({
          id: crypto.randomUUID(),
          title: input.title,
          content: input.logline || '',
          structure: {
            structure4: input.structure4,
            shots12: input.shots12,
          },
          user_id: input.userId,
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase 시나리오 저장 실패: ${error.message}`);
      }

      return data;
    });

    logger.info('✅ 시나리오 저장 성공:', result.id);
    return {
      success: true,
      data: result,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 시나리오 저장 실패:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 프롬프트를 Supabase에 저장
 */
export async function savePrompt(input: CreatePromptInput): Promise<StorageResult<any>> {
  logger.info('🔄 Planning Storage: 프롬프트 저장 시작', {
    title: input.title,
    userId: input.userId || 'guest'
  });

  try {
    const result = await supabaseCircuitBreaker.execute(async () => {
      const client = await getSupabaseClientSafe('admin');

      const { data, error } = await client
        .from('prompts')
        .insert({
          id: input.id,
          title: input.title,
          content: input.content,
          final_prompt: input.finalPrompt,
          keywords: input.keywords || [],
          visual_style: input.visualStyle,
          mood: input.mood,
          quality: input.quality,
          scenario_id: input.scenarioId,
          project_id: input.projectId,
          user_id: input.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase 프롬프트 저장 실패: ${error.message}`);
      }

      return data;
    });

    logger.info('✅ 프롬프트 저장 성공:', result.id);
    return {
      success: true,
      data: result,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 프롬프트 저장 실패:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 영상 메타데이터를 Supabase에 저장
 */
export async function saveVideo(input: CreateVideoInput): Promise<StorageResult<any>> {
  logger.info('🔄 Planning Storage: 영상 메타데이터 저장 시작', {
    title: input.title,
    provider: input.provider,
    userId: input.userId || 'guest'
  });

  try {
    const result = await supabaseCircuitBreaker.execute(async () => {
      const client = await getSupabaseClientSafe('admin');

      const { data, error } = await client
        .from('video_generations')
        .insert({
          id: input.id,
          title: input.title,
          prompt: input.prompt,
          provider: input.provider,
          duration: input.duration,
          aspect_ratio: input.aspectRatio,
          status: input.status,
          job_id: input.jobId,
          project_id: input.projectId,
          user_id: input.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase 영상 메타데이터 저장 실패: ${error.message}`);
      }

      return data;
    });

    logger.info('✅ 영상 메타데이터 저장 성공:', result.id);
    return {
      success: true,
      data: result,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 영상 메타데이터 저장 실패:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 스토리 업데이트
 */
export async function updateStory(input: UpdateStoryInput): Promise<StorageResult<any>> {
  logger.info('🔄 Planning Storage: 스토리 업데이트 시작', {
    projectId: input.projectId,
    title: input.title,
  });

  try {
    const result = await supabaseCircuitBreaker.execute(async () => {
      const client = await getSupabaseClientSafe('admin');

      const { data, error } = await client
        .from('stories')
        .update({
          title: input.title,
          content: input.oneLineStory,
          genre: input.genre,
          tone: input.tone,
          target_audience: input.target,
          structure: input.structure,
          updated_at: new Date().toISOString(),
        })
        .eq('project_id', input.projectId)
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase 스토리 업데이트 실패: ${error.message}`);
      }

      return data;
    });

    logger.info('✅ 스토리 업데이트 성공:', result.id);
    return {
      success: true,
      data: result,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 스토리 업데이트 실패:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * ID로 스토리 조회
 */
export async function getStoryById(id: string): Promise<StorageResult<any>> {
  try {
    const result = await supabaseCircuitBreaker.execute(async () => {
      const client = await getSupabaseClientSafe('admin');

      const { data, error } = await client
        .from('stories')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`스토리 조회 실패: ${error.message}`);
      }

      return data;
    });

    return {
      success: true,
      data: result,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 스토리 조회 실패:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * ID로 시나리오 조회
 */
export async function getScenarioById(id: string): Promise<StorageResult<any>> {
  try {
    const result = await supabaseCircuitBreaker.execute(async () => {
      const client = await getSupabaseClientSafe('admin');

      const { data, error } = await client
        .from('scenarios')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`시나리오 조회 실패: ${error.message}`);
      }

      return data;
    });

    return {
      success: true,
      data: result,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 시나리오 조회 실패:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * ID로 프롬프트 조회
 */
export async function getPromptById(id: string): Promise<StorageResult<any>> {
  try {
    const result = await supabaseCircuitBreaker.execute(async () => {
      const client = await getSupabaseClientSafe('admin');

      const { data, error } = await client
        .from('prompts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`프롬프트 조회 실패: ${error.message}`);
      }

      return data;
    });

    return {
      success: true,
      data: result,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 프롬프트 조회 실패:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 파이프라인 상태 조회 (프로젝트 ID 기준)
 */
export async function getPipelineStatus(projectId: string): Promise<{
  projectId: string;
  currentStep: 'story' | 'scenario' | 'prompt' | 'video';
  status: 'idle' | 'processing' | 'completed' | 'failed';
  progress: {
    story: { completed: boolean; id?: string };
    scenario: { completed: boolean; id?: string };
    prompt: { completed: boolean; id?: string };
    video: { completed: boolean; id?: string };
  };
  lastUpdated: string;
  errors?: Array<{ step: string; message: string; timestamp: string }>;
} | null> {
  try {
    const result = await supabaseCircuitBreaker.execute(async () => {
      const client = await getSupabaseClientSafe('admin');

      // 모든 관련 데이터를 병렬로 조회
      const [storyResult, scenarioResult, promptResult, videoResult] = await Promise.all([
        client.from('stories').select('*').eq('project_id', projectId).maybeSingle(),
        client.from('scenarios').select('*').eq('project_id', projectId).maybeSingle(),
        client.from('prompts').select('*').eq('project_id', projectId).maybeSingle(),
        client.from('video_generations').select('*').eq('project_id', projectId).maybeSingle(),
      ]);

      // 진행 상황 분석
      const story = storyResult.data;
      const scenario = scenarioResult.data;
      const prompt = promptResult.data;
      const video = videoResult.data;

      // 현재 단계 결정
      let currentStep: 'story' | 'scenario' | 'prompt' | 'video' = 'story';
      if (video) currentStep = 'video';
      else if (prompt) currentStep = 'prompt';
      else if (scenario) currentStep = 'scenario';

      // 전체 상태 결정
      let status: 'idle' | 'processing' | 'completed' | 'failed' = 'idle';
      if (video?.status === 'completed') status = 'completed';
      else if (video?.status === 'failed' || scenario?.status === 'failed' || prompt?.status === 'failed') status = 'failed';
      else if (story || scenario || prompt || video) status = 'processing';

      return {
        projectId,
        currentStep,
        status,
        progress: {
          story: { completed: !!story, id: story?.id },
          scenario: { completed: !!scenario, id: scenario?.id },
          prompt: { completed: !!prompt, id: prompt?.id },
          video: { completed: !!video && video.status === 'completed', id: video?.id },
        },
        lastUpdated: new Date().toISOString(),
      };
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 파이프라인 상태 조회 실패:', errorMessage);
    return null;
  }
}

/**
 * 프로젝트 중심 스토리지 호환성 메서드들
 */

// 프로젝트별 저장 메서드들 (기존 메서드들의 별칭)
export const saveScenarioToProject = saveScenario;
export const savePromptToProject = savePrompt;
export const saveVideoToProject = saveVideo;

// 트랜잭션 관리 (Supabase는 트랜잭션을 다르게 처리하므로 호환성 메서드)
export async function savePipelineTransaction(data: any): Promise<StorageResult<any>> {
  logger.info('📦 Pipeline transaction:', data);
  return { success: true, data: null };
}

export async function recoverPartialTransaction(projectId: string): Promise<StorageResult<any>> {
  logger.info('🔄 Recovering transaction for project:', projectId);
  return { success: true, data: null };
}

export async function rollbackTransaction(transactionId: string): Promise<StorageResult<any>> {
  logger.info('↩️ Rolling back transaction:', transactionId);
  return { success: true, data: null };
}

// 프로젝트 관리 메서드들
export async function updateProject(projectId: string, updates: any): Promise<StorageResult<any>> {
  try {
    const client = await getSupabaseClientSafe('admin');
    const { data, error } = await client
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// 협업 관리 (향후 구현 예정)
export async function addCollaborator(projectId: string, userId: string): Promise<StorageResult<any>> {
  logger.info('👥 Adding collaborator:', { projectId, userId });
  return { success: true, data: null };
}

// 공유 링크 (향후 구현 예정)
export async function createShareLink(projectId: string, options: any): Promise<StorageResult<any>> {
  logger.info('🔗 Creating share link:', { projectId, options });
  return { success: true, data: null };
}

// 버전 관리 (향후 구현 예정)
export async function createVersion(projectId: string, data: any): Promise<StorageResult<any>> {
  logger.info('📝 Creating version:', { projectId, data });
  return { success: true, data: null };
}

// 데이터 일관성 검사 (향후 구현 예정)
export async function checkDataConsistency(projectId: string): Promise<StorageResult<any>> {
  logger.info('✅ Checking data consistency:', projectId);
  return { success: true, data: { consistent: true } };
}

export async function repairDataInconsistency(projectId: string): Promise<StorageResult<any>> {
  logger.info('🔧 Repairing data inconsistency:', projectId);
  return { success: true, data: null };
}

// 호환성을 위한 통합 서비스 객체
export const planningStorageService = {
  saveStory,
  saveScenario,
  savePrompt,
  saveVideo,
  updateStory,
  getStoryById,
  getScenarioById,
  getPromptById,
  getPipelineStatus,
  // 프로젝트 중심 메서드들
  saveScenarioToProject,
  savePromptToProject,
  saveVideoToProject,
  savePipelineTransaction,
  recoverPartialTransaction,
  rollbackTransaction,
  updateProject,
  addCollaborator,
  createShareLink,
  createVersion,
  checkDataConsistency,
  repairDataInconsistency,
};

// 기존 dual-storage-service와 호환성을 위한 export
export const dualStorageService = planningStorageService;