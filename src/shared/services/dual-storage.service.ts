/**
 * 이중 저장 시스템 서비스
 *
 * 목적: Prisma ↔ Supabase 간 안전한 데이터 변환 및 동기화
 * 책임: 트랜잭션 관리, 데이터 품질 보장, 에러 처리
 */

import {
  type PrismaProjectData,
  type SupabaseStoryData,
  type SupabaseScenarioData,
  type SupabasePromptData,
  type SupabaseVideoGenerationData,
  type DualStorageResult,
  type DataQualityReport,
  type StorageStrategy,
  PrismaProjectSchema,
  SupabaseStorySchema,
  SupabaseScenarioSchema,
  SupabasePromptSchema,
  SupabaseVideoGenerationSchema,
  DataQualityReportSchema,
  DualStorageError,
  DataConsistencyError,
  generateSupabaseId,
  getCurrentTimestamp,
  detectProjectType,
  calculateQualityScore,
} from '@/shared/contracts/dual-storage.schema';

// ============================================================================
// DualStorageTransformer 인터페이스
// ============================================================================

export interface IDualStorageTransformer {
  transformProjectToStory(project: PrismaProjectData): SupabaseStoryData;
  transformProjectToScenario(project: PrismaProjectData): SupabaseScenarioData;
  transformProjectToPrompt(project: PrismaProjectData): SupabasePromptData;
  transformProjectToVideoGeneration(project: PrismaProjectData): SupabaseVideoGenerationData;
  validateDualStorageConsistency(
    prismaData: PrismaProjectData,
    supabaseData: {
      story?: SupabaseStoryData;
      scenario?: SupabaseScenarioData;
      prompt?: SupabasePromptData;
      videoGeneration?: SupabaseVideoGenerationData;
    }
  ): DataQualityReport;
}

// ============================================================================
// DualStorageTransformer 구현
// ============================================================================

export class DualStorageTransformer implements IDualStorageTransformer {
  /**
   * Prisma Project를 Supabase Story로 변환
   */
  transformProjectToStory(project: PrismaProjectData): SupabaseStoryData {
    // 1. 입력 데이터 검증
    const validatedProject = PrismaProjectSchema.parse(project);
    const metadata = validatedProject.metadata || {};

    // 2. Story 데이터 변환
    const storyData: SupabaseStoryData = {
      id: generateSupabaseId(),
      title: validatedProject.title,
      content: metadata.story || metadata.oneLineStory || validatedProject.description || validatedProject.title,
      genre: metadata.genre || 'general',
      tone: metadata.tone || metadata.toneAndManner || undefined,
      target_audience: metadata.target || metadata.targetAudience || undefined,
      structure: {
        acts: metadata.structure || {},
        developmentMethod: metadata.developmentMethod,
        developmentIntensity: metadata.developmentIntensity,
        durationSec: metadata.durationSec,
        format: metadata.format,
        tempo: metadata.tempo,
      },
      metadata: {
        originalProjectId: validatedProject.id,
        source: 'planning_register',
        projectType: 'story',
        transformedAt: getCurrentTimestamp(),
      },
      status: this.mapPrismaStatusToSupabase(validatedProject.status),
      user_id: validatedProject.userId, // 🔄 UUID 변환 필요할 수 있음
      created_at: validatedProject.createdAt.toISOString(),
      updated_at: validatedProject.updatedAt.toISOString(),
    };

    // 3. 변환 결과 검증
    const validatedStory = SupabaseStorySchema.parse(storyData);
    return validatedStory;
  }

  /**
   * Prisma Project를 Supabase Scenario로 변환
   */
  transformProjectToScenario(project: PrismaProjectData): SupabaseScenarioData {
    const validatedProject = PrismaProjectSchema.parse(project);
    const metadata = validatedProject.metadata || {};

    const scenarioData: SupabaseScenarioData = {
      id: generateSupabaseId(),
      title: validatedProject.title,
      content: validatedProject.scenario || metadata.story || validatedProject.description || '',
      structure: {
        hasFourStep: metadata.hasFourStep || true,
        hasTwelveShot: metadata.hasTwelveShot || false,
        version: metadata.version || 'V1',
        author: metadata.author || 'AI Generated',
        // 시나리오 구조 데이터
        story: metadata.story,
        genre: metadata.genre,
        tone: metadata.tone,
        target: metadata.target,
        format: metadata.format,
        tempo: metadata.tempo,
        developmentMethod: metadata.developmentMethod,
        developmentIntensity: metadata.developmentIntensity,
        durationSec: metadata.durationSec,
      },
      metadata: {
        originalProjectId: validatedProject.id,
        source: 'planning_register',
        projectType: 'scenario',
        transformedAt: getCurrentTimestamp(),
      },
      status: this.mapPrismaStatusToSupabase(validatedProject.status),
      user_id: validatedProject.userId,
      project_id: validatedProject.id, // 🔄 UUID 변환 필요할 수 있음
      created_at: validatedProject.createdAt.toISOString(),
      updated_at: validatedProject.updatedAt.toISOString(),
    };

    return SupabaseScenarioSchema.parse(scenarioData);
  }

  /**
   * Prisma Project를 Supabase Prompt로 변환
   */
  transformProjectToPrompt(project: PrismaProjectData): SupabasePromptData {
    const validatedProject = PrismaProjectSchema.parse(project);
    const metadata = validatedProject.metadata || {};

    const promptData: SupabasePromptData = {
      id: generateSupabaseId(),
      title: String(metadata.scenarioTitle || validatedProject.title || '프롬프트'),
      content: String(validatedProject.prompt || metadata.finalPrompt || ''),
      final_prompt: String(metadata.finalPrompt || validatedProject.prompt || ''),
      keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
      negative_prompt: String(metadata.negativePrompt || undefined),
      visual_style: String(metadata.visualStyle || undefined),
      mood: String(metadata.mood || undefined),
      quality: String(metadata.quality || undefined),
      metadata: {
        originalProjectId: validatedProject.id,
        source: 'planning_register',
        projectType: 'prompt',
        transformedAt: getCurrentTimestamp(),
        // 프롬프트 관련 메타데이터
        keywordCount: Array.isArray(metadata.keywords) ? metadata.keywords.length : 0,
        segmentCount: metadata.segmentCount || 1,
        version: metadata.version || 'V1',
        directorStyle: metadata.directorStyle,
      },
      scenario_id: undefined, // 연결된 시나리오가 있다면 별도 처리
      user_id: String(validatedProject.userId || undefined),
      project_id: String(validatedProject.id),
      created_at: validatedProject.createdAt.toISOString(),
      updated_at: validatedProject.updatedAt.toISOString(),
    };

    return SupabasePromptSchema.parse(promptData);
  }

  /**
   * Prisma Project를 Supabase Video Generation으로 변환
   */
  transformProjectToVideoGeneration(project: PrismaProjectData): SupabaseVideoGenerationData {
    const validatedProject = PrismaProjectSchema.parse(project);
    const metadata = validatedProject.metadata || {};

    const videoData: SupabaseVideoGenerationData = {
      id: generateSupabaseId(),
      title: String(metadata.title || validatedProject.title || '생성된 영상'),
      prompt: String(metadata.finalPrompt || validatedProject.prompt || ''),
      provider: this.normalizeProvider(String(metadata.provider || 'unknown')),
      duration: Number(metadata.durationSec || metadata.duration || undefined) || undefined,
      aspect_ratio: String(metadata.format || metadata.aspectRatio || undefined) || undefined,
      codec: String(metadata.codec || 'H.264'),
      status: this.mapVideoStatus(metadata.status || validatedProject.status),
      video_url: metadata.videoUrl || validatedProject.video || undefined,
      thumbnail_url: metadata.thumbnailUrl || undefined,
      ref_prompt_title: metadata.refPromptTitle,
      job_id: metadata.jobId,
      operation_id: metadata.operationId,
      completed_at: metadata.status === 'completed' ? validatedProject.updatedAt.toISOString() : undefined,
      metadata: {
        originalProjectId: validatedProject.id,
        source: 'planning_register',
        projectType: 'video',
        transformedAt: getCurrentTimestamp(),
        // 영상 관련 메타데이터
        version: metadata.version || 'V1',
      },
      user_id: String(validatedProject.userId || undefined),
      project_id: String(validatedProject.id),
      created_at: validatedProject.createdAt.toISOString(),
      updated_at: validatedProject.updatedAt.toISOString(),
    };

    return SupabaseVideoGenerationSchema.parse(videoData);
  }

  /**
   * 이중 저장 데이터 일관성 검증
   */
  validateDualStorageConsistency(
    prismaData: PrismaProjectData,
    supabaseData: {
      story?: SupabaseStoryData;
      scenario?: SupabaseScenarioData;
      prompt?: SupabasePromptData;
      videoGeneration?: SupabaseVideoGenerationData;
    }
  ): DataQualityReport {
    const violations: Array<{
      field: string;
      issue: string;
      severity: 'critical' | 'warning' | 'info';
      prismaValue?: any;
      supabaseValue?: any;
    }> = [];

    // 1. 프로젝트 타입별 필수 데이터 존재 여부 검증
    const projectType = detectProjectType(prismaData);
    switch (projectType) {
      case 'story':
        if (!supabaseData.story) {
          violations.push({
            field: 'story',
            issue: 'Story 타입 프로젝트인데 Supabase Story 데이터가 없음',
            severity: 'critical',
            prismaValue: projectType,
            supabaseValue: null,
          });
        }
        break;
      case 'scenario':
        if (!supabaseData.scenario) {
          violations.push({
            field: 'scenario',
            issue: 'Scenario 타입 프로젝트인데 Supabase Scenario 데이터가 없음',
            severity: 'critical',
            prismaValue: projectType,
            supabaseValue: null,
          });
        }
        break;
      case 'prompt':
        if (!supabaseData.prompt) {
          violations.push({
            field: 'prompt',
            issue: 'Prompt 타입 프로젝트인데 Supabase Prompt 데이터가 없음',
            severity: 'critical',
            prismaValue: projectType,
            supabaseValue: null,
          });
        }
        break;
      case 'video':
        if (!supabaseData.videoGeneration) {
          violations.push({
            field: 'videoGeneration',
            issue: 'Video 타입 프로젝트인데 Supabase VideoGeneration 데이터가 없음',
            severity: 'critical',
            prismaValue: projectType,
            supabaseValue: null,
          });
        }
        break;
    }

    // 2. 공통 필드 일관성 검증
    Object.entries(supabaseData).forEach(([key, data]) => {
      if (!data) return;

      // 제목 일관성
      if (data.title !== prismaData.title) {
        violations.push({
          field: `${key}.title`,
          issue: 'Prisma와 Supabase 제목이 다름',
          severity: 'warning',
          prismaValue: prismaData.title,
          supabaseValue: data.title,
        });
      }

      // 사용자 ID 일관성
      if (data.user_id !== prismaData.userId) {
        violations.push({
          field: `${key}.user_id`,
          issue: 'Prisma와 Supabase 사용자 ID가 다름',
          severity: 'critical',
          prismaValue: prismaData.userId,
          supabaseValue: data.user_id,
        });
      }

      // 상태 일관성 (매핑 고려) - status 속성이 있는 경우만 검증
      if ('status' in data && 'status' in prismaData) {
        const mappedStatus = this.mapPrismaStatusToSupabase(prismaData.status);
        if (data.status !== mappedStatus) {
          violations.push({
            field: `${key}.status`,
            issue: 'Prisma와 Supabase 상태가 다름',
            severity: 'warning',
            prismaValue: prismaData.status,
            supabaseValue: data.status,
          });
        }
      }
    });

    // 3. 타입별 특수 검증
    if (supabaseData.prompt) {
      const metadata = prismaData.metadata || {};
      if (metadata.finalPrompt && supabaseData.prompt.final_prompt !== metadata.finalPrompt) {
        violations.push({
          field: 'prompt.final_prompt',
          issue: 'Prisma metadata와 Supabase final_prompt가 다름',
          severity: 'warning',
          prismaValue: metadata.finalPrompt,
          supabaseValue: supabaseData.prompt.final_prompt,
        });
      }
    }

    if (supabaseData.videoGeneration) {
      const metadata = prismaData.metadata || {};
      if (metadata.videoUrl && supabaseData.videoGeneration.video_url !== metadata.videoUrl) {
        violations.push({
          field: 'videoGeneration.video_url',
          issue: 'Prisma metadata와 Supabase video_url이 다름',
          severity: 'critical',
          prismaValue: metadata.videoUrl,
          supabaseValue: supabaseData.videoGeneration.video_url,
        });
      }
    }

    // 4. 품질 점수 계산
    const qualityScore = calculateQualityScore(violations);
    const metrics = {
      consistency: violations.filter(v => v.field.includes('title') || v.field.includes('user_id')).length === 0 ? 100 : 70,
      completeness: Object.keys(supabaseData).length > 0 ? 90 : 0,
      accuracy: violations.filter(v => v.severity === 'critical').length === 0 ? 95 : 60,
      timeliness: 85, // 동기화 지연 가정
    };

    const report: DataQualityReport = {
      isConsistent: violations.filter(v => v.severity === 'critical').length === 0,
      score: qualityScore,
      violations,
      metrics,
      timestamp: getCurrentTimestamp(),
    };

    return DataQualityReportSchema.parse(report);
  }

  // ============================================================================
  // 헬퍼 메서드들
  // ============================================================================

  /**
   * Prisma status를 Supabase status로 매핑
   */
  private mapPrismaStatusToSupabase(status: string): 'draft' | 'active' | 'completed' | 'archived' {
    switch (status) {
      case 'draft': return 'draft';
      case 'active': return 'active';
      case 'completed': return 'completed';
      case 'archived':
      case 'failed': return 'archived';
      default: return 'draft';
    }
  }

  /**
   * 영상 생성 상태 매핑
   */
  private mapVideoStatus(status: string): 'queued' | 'processing' | 'completed' | 'failed' {
    switch (status?.toLowerCase()) {
      case 'queued':
      case 'pending': return 'queued';
      case 'processing':
      case 'active': return 'processing';
      case 'completed': return 'completed';
      case 'failed':
      case 'error': return 'failed';
      default: return 'queued';
    }
  }

  /**
   * 영상 제공업체 정규화
   */
  private normalizeProvider(provider: string): 'seedance' | 'openai' | 'runways' | 'luma' | 'stable_video' {
    switch (provider?.toLowerCase()) {
      case 'seedance': return 'seedance';
      case 'openai':
      case 'sora': return 'openai';
      case 'runways':
      case 'runway': return 'runways';
      case 'luma': return 'luma';
      case 'stable_video':
      case 'stable': return 'stable_video';
      default: return 'seedance'; // 기본값
    }
  }
}

// ============================================================================
// 싱글톤 인스턴스 export
// ============================================================================

export const dualStorageTransformer = new DualStorageTransformer();