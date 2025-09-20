/**
 * Supabase Repository Adapter
 * FSD Architecture - Infrastructure Layer
 *
 * 목적: Supabase를 통한 데이터 저장 구현
 * 패턴: Repository Pattern + Dependency Injection
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseRepository } from '../model/services';
import { logger } from '@/shared/lib/logger';
import type {
  ScenarioContent,
  PromptContent,
  VideoContent,
  PlanningContent
} from '../model/types';

interface SupabaseRepositoryDependencies {
  supabase: SupabaseClient;
}

/**
 * Supabase Repository 구현체
 */
export class SupabaseRepositoryImpl implements SupabaseRepository {
  constructor(private dependencies: SupabaseRepositoryDependencies) {}

  async saveScenario(data: ScenarioContent): Promise<{ success: boolean; error?: string }> {
    try {
      const { supabase } = this.dependencies;

      const { error } = await supabase
        .from('scenarios')
        .insert({
          id: data.id,
          project_id: data.projectId,
          title: data.title,
          story: data.story,
          genre: data.genre,
          tone: data.tone,
          target: data.target,
          format: data.format,
          tempo: data.tempo,
          development_method: data.developmentMethod,
          development_intensity: data.developmentIntensity,
          duration_sec: data.durationSec,
          source: data.source,
          status: data.status,
          storage_status: data.storageStatus,
          created_at: data.createdAt,
          updated_at: data.updatedAt,
          metadata: data.metadata,
          storage: data.storage,
        });

      if (error) {
        throw error;
      }

      logger.info(`✅ Supabase: 시나리오 저장 성공 - ${data.id}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Supabase error';
      console.error(`❌ Supabase: 시나리오 저장 실패 - ${data.id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async savePrompt(data: PromptContent): Promise<{ success: boolean; error?: string }> {
    try {
      const { supabase } = this.dependencies;

      const { error } = await supabase
        .from('prompts')
        .insert({
          id: data.id,
          project_id: data.projectId,
          scenario_title: data.scenarioTitle,
          final_prompt: data.finalPrompt,
          keywords: data.keywords,
          source: data.source,
          status: data.status,
          storage_status: data.storageStatus,
          created_at: data.createdAt,
          updated_at: data.updatedAt,
          metadata: data.metadata,
          storage: data.storage,
        });

      if (error) {
        throw error;
      }

      logger.info(`✅ Supabase: 프롬프트 저장 성공 - ${data.id}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Supabase error';
      console.error(`❌ Supabase: 프롬프트 저장 실패 - ${data.id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async saveVideo(data: VideoContent): Promise<{ success: boolean; error?: string }> {
    try {
      const { supabase } = this.dependencies;

      const { error } = await supabase
        .from('videos')
        .insert({
          id: data.id,
          project_id: data.projectId,
          video_url: data.videoUrl,
          thumbnail_url: data.thumbnailUrl,
          processing_job_id: data.processingJobId,
          source: data.source,
          status: data.status,
          storage_status: data.storageStatus,
          created_at: data.createdAt,
          updated_at: data.updatedAt,
          metadata: data.metadata,
          storage: data.storage,
        });

      if (error) {
        throw error;
      }

      logger.info(`✅ Supabase: 영상 저장 성공 - ${data.id}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Supabase error';
      console.error(`❌ Supabase: 영상 저장 실패 - ${data.id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async findById(id: string): Promise<PlanningContent | null> {
    try {
      const { supabase } = this.dependencies;

      // 시나리오 검색
      const { data: scenario, error: scenarioError } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', id)
        .single();

      if (!scenarioError && scenario) {
        return {
          id: scenario.id,
          projectId: scenario.project_id,
          type: 'scenario' as const,
          title: scenario.title,
          story: scenario.story,
          genre: scenario.genre,
          tone: scenario.tone,
          target: scenario.target,
          format: scenario.format,
          tempo: scenario.tempo,
          developmentMethod: scenario.development_method,
          developmentIntensity: scenario.development_intensity,
          durationSec: scenario.duration_sec,
          source: scenario.source,
          status: scenario.status,
          storageStatus: scenario.storage_status,
          createdAt: scenario.created_at,
          updatedAt: scenario.updated_at,
          metadata: scenario.metadata || {},
          storage: scenario.storage || { prisma: { saved: false }, supabase: { saved: false } },
        };
      }

      // 프롬프트 검색
      const { data: prompt, error: promptError } = await supabase
        .from('prompts')
        .select('*')
        .eq('id', id)
        .single();

      if (!promptError && prompt) {
        return {
          id: prompt.id,
          projectId: prompt.project_id,
          type: 'prompt' as const,
          title: prompt.scenario_title || `Prompt ${prompt.id}`,
          scenarioTitle: prompt.scenario_title,
          finalPrompt: prompt.final_prompt,
          keywords: prompt.keywords || [],
          source: prompt.source,
          status: prompt.status,
          storageStatus: prompt.storage_status,
          createdAt: prompt.created_at,
          updatedAt: prompt.updated_at,
          metadata: prompt.metadata || {},
          storage: prompt.storage || { prisma: { saved: false }, supabase: { saved: false } },
        } as PromptContent;
      }

      // 영상 검색
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single();

      if (!videoError && video) {
        return {
          id: video.id,
          projectId: video.project_id,
          type: 'video' as const,
          title: `Video ${video.id.slice(0, 8)}`,
          videoUrl: video.video_url,
          thumbnailUrl: video.thumbnail_url,
          processingJobId: video.processing_job_id,
          source: video.source,
          status: video.status,
          storageStatus: video.storage_status,
          createdAt: video.created_at,
          updatedAt: video.updated_at,
          metadata: video.metadata || {},
          storage: video.storage || { prisma: { saved: false }, supabase: { saved: false } },
        } as VideoContent;
      }

      return null;

    } catch (error) {
      console.error(`❌ Supabase: ID로 조회 실패 - ${id}:`, error);
      return null;
    }
  }

  async updateStatus(id: string, status: Partial<PlanningContent>): Promise<{ success: boolean; error?: string }> {
    try {
      const { supabase } = this.dependencies;

      // 먼저 어떤 테이블의 데이터인지 확인
      const existing = await this.findById(id);
      if (!existing) {
        return { success: false, error: 'Content not found' };
      }

      const updateData: any = {
        ...(status.status && { status: status.status }),
        ...(status.storageStatus && { storage_status: status.storageStatus }),
        ...(status.storage && { storage: status.storage }),
        updated_at: new Date().toISOString(),
      };

      let table: string;
      switch (existing.type) {
        case 'scenario':
          table = 'scenarios';
          break;
        case 'prompt':
          table = 'prompts';
          break;
        case 'video':
          table = 'videos';
          break;
        default:
          return { success: false, error: 'Unknown content type' };
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', id);

      if (error) {
        throw error;
      }

      logger.info(`✅ Supabase: 상태 업데이트 성공 - ${id}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Supabase error';
      console.error(`❌ Supabase: 상태 업데이트 실패 - ${id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}

/**
 * Factory function for creating Supabase repository
 */
export function createSupabaseRepository(supabase: SupabaseClient): SupabaseRepository {
  return new SupabaseRepositoryImpl({ supabase });
}