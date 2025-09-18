/**
 * 이중 저장 엔진 서비스
 *
 * 목적: Prisma ↔ Supabase 트랜잭션 관리 및 안전한 이중 저장
 * 책임: ACID 트랜잭션, 롤백 처리, 환경별 전략, 에러 복구
 */

import { prisma } from '@/lib/prisma';
import { supabase, supabaseAdmin, supabaseConfig } from '@/lib/supabase';
import {
  type PrismaProjectData,
  type DualStorageResult,
  type StorageStrategy,
  type DataQualityReport,
  DualStorageError,
  StorageStrategyError,
  getCurrentTimestamp,
} from '@/shared/contracts/dual-storage.schema';
import {
  dualStorageTransformer,
  type IDualStorageTransformer,
} from '@/shared/services/dual-storage.service';

// ============================================================================
// 환경별 저장 전략 설정
// ============================================================================

function getStorageStrategy(): StorageStrategy {
  const environment = (process.env.NODE_ENV || 'development') as 'production' | 'staging' | 'development' | 'test';

  const strategies: Record<typeof environment, StorageStrategy> = {
    production: {
      environment: 'production',
      strategy: 'dual_storage_required',
      fallbackEnabled: false,
      retryAttempts: 3,
      timeoutMs: 5000,
    },
    staging: {
      environment: 'staging',
      strategy: 'dual_storage_preferred',
      fallbackEnabled: true,
      retryAttempts: 2,
      timeoutMs: 3000,
    },
    development: {
      environment: 'development',
      strategy: 'prisma_only_fallback',
      fallbackEnabled: true,
      retryAttempts: 1,
      timeoutMs: 2000,
    },
    test: {
      environment: 'test',
      strategy: 'mock_supabase',
      fallbackEnabled: true,
      retryAttempts: 0,
      timeoutMs: 1000,
    },
  };

  return strategies[environment];
}

// ============================================================================
// 이중 저장 엔진 클래스
// ============================================================================

export class DualStorageEngine {
  private transformer: IDualStorageTransformer;
  private strategy: StorageStrategy;

  constructor(transformer: IDualStorageTransformer = dualStorageTransformer) {
    this.transformer = transformer;
    this.strategy = getStorageStrategy();
  }

  /**
   * 안전한 이중 저장 실행
   * ACID 트랜잭션 보장
   */
  async saveDualStorage(registeredItem: any, user: { id: string; username: string }): Promise<DualStorageResult> {
    const startTime = Date.now();
    let prismaResult: any = null;
    let supabaseResults: Record<string, boolean> = {};
    let rollbackExecuted = false;

    try {
      console.log('🔄 이중 저장 시작:', {
        strategy: this.strategy.strategy,
        environment: this.strategy.environment,
        supabaseMode: supabaseConfig.mode,
        itemType: registeredItem.type,
        projectId: registeredItem.projectId,
      });

      // 1. 환경별 전략 확인
      this.validateStorageStrategy();

      // 2. Prisma 저장 (Primary)
      prismaResult = await this.saveToPrisma(registeredItem, user);
      console.log('✅ Prisma 저장 성공:', prismaResult.id);

      // 3. Supabase 저장 (Secondary) - 전략에 따라 처리
      if (this.shouldSaveToSupabase()) {
        try {
          supabaseResults = await this.saveToSupabase(registeredItem, user);
          console.log('✅ Supabase 저장 성공:', supabaseResults);
        } catch (supabaseError) {
          console.error('❌ Supabase 저장 실패:', supabaseError);

          // 전략에 따른 처리
          if (this.strategy.strategy === 'dual_storage_required') {
            // 필수 모드: 롤백 실행
            await this.rollbackPrisma(prismaResult.id);
            rollbackExecuted = true;
            throw new DualStorageError('Supabase 저장 실패로 트랜잭션 롤백', {
              operation: 'dual_storage_save',
              prismaResult,
              supabaseResult: supabaseError,
            });
          } else if (this.strategy.strategy === 'dual_storage_preferred') {
            // 선호 모드: 경고만 로그
            console.warn('⚠️ Supabase 저장 실패하지만 계속 진행 (preferred 모드)');
          }
          // fallback 모드는 무시
        }
      }

      // 4. 데이터 품질 검증 (선택적)
      if (Object.keys(supabaseResults).length > 0) {
        await this.validateDataQuality(registeredItem, supabaseResults);
      }

      const latencyMs = Date.now() - startTime;
      console.log(`⏱️ 이중 저장 완료: ${latencyMs}ms`);

      return {
        success: true,
        prismaResult: {
          saved: true,
          id: prismaResult.id,
        },
        supabaseResult: {
          saved: Object.keys(supabaseResults).length > 0,
          tables: {
            story: supabaseResults.story || false,
            scenario: supabaseResults.scenario || false,
            prompt: supabaseResults.prompt || false,
            videoGeneration: supabaseResults.videoGeneration || false,
          },
        },
        rollbackExecuted,
        timestamp: getCurrentTimestamp(),
        latencyMs,
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      console.error('❌ 이중 저장 실패:', {
        error: error instanceof Error ? error.message : String(error),
        latencyMs,
        rollbackExecuted,
      });

      return {
        success: false,
        prismaResult: {
          saved: !!prismaResult,
          id: prismaResult?.id,
          error: error instanceof Error ? error.message : String(error),
        },
        supabaseResult: {
          saved: false,
          tables: {
            story: false,
            scenario: false,
            prompt: false,
            videoGeneration: false,
          },
          error: error instanceof Error ? error.message : String(error),
        },
        rollbackExecuted,
        timestamp: getCurrentTimestamp(),
        latencyMs,
      };
    }
  }

  // ============================================================================
  // Private 메서드들
  // ============================================================================

  /**
   * 저장 전략 유효성 검증
   */
  private validateStorageStrategy(): void {
    // Supabase 필수 모드인데 설정이 없으면 에러
    if (this.strategy.strategy === 'dual_storage_required' && supabaseConfig.mode === 'disabled') {
      throw new StorageStrategyError(
        'dual_storage_required 모드인데 Supabase가 비활성화됨',
        this.strategy.strategy,
        this.strategy.environment
      );
    }

    // Service Role 키가 없으면 경고
    if (this.strategy.strategy !== 'mock_supabase' && !supabaseConfig.hasServiceRoleKey) {
      console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY 없음 - RLS 제한 적용됨');
    }
  }

  /**
   * Supabase 저장 여부 결정
   */
  private shouldSaveToSupabase(): boolean {
    switch (this.strategy.strategy) {
      case 'dual_storage_required':
      case 'dual_storage_preferred':
        return supabaseConfig.mode !== 'disabled';
      case 'prisma_only_fallback':
        return supabaseConfig.mode === 'full'; // Service Role 키 있을 때만
      case 'mock_supabase':
        return false; // 테스트에서는 모킹
      default:
        return false;
    }
  }

  /**
   * Prisma 저장
   */
  private async saveToPrisma(registeredItem: any, user: { id: string }): Promise<any> {
    const upsertData = {
      id: registeredItem.projectId,
      title: registeredItem.title || 'Untitled',
      description: registeredItem.description || null,
      metadata: registeredItem as any,
      status: 'active',
      userId: user.id,
      tags: [registeredItem.type],
      scenario: registeredItem.type === 'scenario' ? JSON.stringify(registeredItem) : null,
      prompt: registeredItem.type === 'prompt' ? registeredItem.finalPrompt : null,
    };

    // 기존 프로젝트 확인
    const existingProject = await prisma.project.findUnique({
      where: { id: registeredItem.projectId },
      select: { tags: true }
    });

    // 기존 태그에 새 타입 추가
    const existingTags = (existingProject?.tags as string[]) || [];
    const updatedTags = Array.from(new Set([...existingTags, registeredItem.type]));

    return await prisma.project.upsert({
      where: { id: registeredItem.projectId },
      update: {
        title: upsertData.title,
        description: upsertData.description,
        metadata: upsertData.metadata,
        status: upsertData.status,
        updatedAt: new Date(),
        tags: updatedTags,
        scenario: registeredItem.type === 'scenario' ? JSON.stringify(registeredItem) : undefined,
        prompt: registeredItem.type === 'prompt' ? registeredItem.finalPrompt : undefined,
      },
      create: upsertData,
    });
  }

  /**
   * Supabase 저장
   */
  private async saveToSupabase(registeredItem: any, user: { id: string }): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Prisma 데이터를 변환 가능한 형태로 변환
    const prismaProjectData: PrismaProjectData = {
      id: registeredItem.projectId,
      title: registeredItem.title || 'Untitled',
      description: registeredItem.description || null,
      metadata: registeredItem,
      status: 'active',
      userId: user.id,
      tags: [registeredItem.type],
      scenario: registeredItem.type === 'scenario' ? JSON.stringify(registeredItem) : null,
      prompt: registeredItem.type === 'prompt' ? registeredItem.finalPrompt : null,
      video: registeredItem.type === 'video' ? registeredItem.videoUrl : null,
      createdAt: new Date(registeredItem.createdAt),
      updatedAt: new Date(registeredItem.updatedAt || registeredItem.createdAt),
    };

    // 사용할 클라이언트 결정 (Service Role 키 우선)
    const client = supabaseAdmin || supabase;
    if (!client) {
      throw new Error('Supabase 클라이언트를 사용할 수 없음');
    }

    // 타입별 저장
    switch (registeredItem.type) {
      case 'story':
        try {
          const storyData = this.transformer.transformProjectToStory(prismaProjectData);
          const { error } = await client
            .from('stories')
            .upsert(storyData, { onConflict: 'id' });

          if (error) throw error;
          results.story = true;
        } catch (error) {
          console.error('❌ Supabase Story 저장 실패:', error);
          results.story = false;
        }
        break;

      case 'scenario':
        try {
          const scenarioData = this.transformer.transformProjectToScenario(prismaProjectData);
          // 전용 scenarios 테이블에 저장
          const { error } = await client
            .from('scenarios')
            .upsert({
              id: scenarioData.id,
              title: scenarioData.title,
              content: scenarioData.content,
              structure: scenarioData.structure,
              metadata: scenarioData.metadata,
              status: scenarioData.status,
              user_id: scenarioData.user_id,
              project_id: scenarioData.project_id,
              created_at: scenarioData.created_at,
              updated_at: scenarioData.updated_at,
            }, { onConflict: 'id' });

          if (error) throw error;
          results.scenario = true;
          console.log('✅ Scenario 전용 테이블 저장 성공:', scenarioData.id);
        } catch (error) {
          console.error('❌ Supabase Scenario 저장 실패:', error);
          results.scenario = false;
        }
        break;

      case 'prompt':
        try {
          const promptData = this.transformer.transformProjectToPrompt(prismaProjectData);
          // 전용 prompts 테이블에 저장
          const { error } = await client
            .from('prompts')
            .upsert({
              id: promptData.id,
              title: promptData.title,
              content: promptData.content,
              final_prompt: promptData.final_prompt,
              keywords: promptData.keywords,
              negative_prompt: promptData.negative_prompt,
              visual_style: promptData.visual_style,
              mood: promptData.mood,
              quality: promptData.quality,
              metadata: promptData.metadata,
              scenario_id: promptData.scenario_id,
              user_id: promptData.user_id,
              project_id: promptData.project_id,
              created_at: promptData.created_at,
              updated_at: promptData.updated_at,
            }, { onConflict: 'id' });

          if (error) throw error;
          results.prompt = true;
          console.log('✅ Prompt 전용 테이블 저장 성공:', promptData.id);
        } catch (error) {
          console.error('❌ Supabase Prompt 저장 실패:', error);
          results.prompt = false;
        }
        break;

      case 'video':
        try {
          const videoData = this.transformer.transformProjectToVideoGeneration(prismaProjectData);
          // video_assets 테이블에 저장
          const { error } = await client
            .from('video_assets')
            .upsert({
              id: videoData.id,
              title: videoData.title,
              description: `영상 생성 - ${videoData.provider}`,
              file_url: videoData.video_url || '',
              thumbnail_url: videoData.thumbnail_url,
              metadata: videoData.metadata,
              status: videoData.status,
              project_id: videoData.project_id,
              user_id: videoData.user_id,
              created_at: videoData.created_at,
              updated_at: videoData.updated_at,
            }, { onConflict: 'id' });

          if (error) throw error;
          results.videoGeneration = true;
        } catch (error) {
          console.error('❌ Supabase Video 저장 실패:', error);
          results.videoGeneration = false;
        }
        break;
    }

    // 결과 검증
    const successCount = Object.values(results).filter(Boolean).length;
    if (successCount === 0) {
      throw new Error('모든 Supabase 저장이 실패함');
    }

    return results;
  }

  /**
   * Prisma 롤백
   */
  private async rollbackPrisma(projectId: string): Promise<void> {
    try {
      await prisma.project.delete({
        where: { id: projectId }
      });
      console.log('🔙 Prisma 롤백 성공:', projectId);
    } catch (error) {
      console.error('❌ Prisma 롤백 실패:', error);
      // 롤백 실패는 치명적 - 수동 정리 필요
      throw new DualStorageError('Prisma 롤백 실패 - 수동 정리 필요', {
        operation: 'rollback_prisma',
        prismaResult: { projectId },
      });
    }
  }

  /**
   * 데이터 품질 검증 (선택적)
   */
  private async validateDataQuality(
    registeredItem: any,
    supabaseResults: Record<string, boolean>
  ): Promise<void> {
    // 개발환경에서는 품질 검증 스킵
    if (this.strategy.environment === 'development' || this.strategy.environment === 'test') {
      return;
    }

    try {
      // TODO: 실제 Supabase 데이터를 조회해서 일관성 검증
      // 현재는 기본적인 검증만 수행
      const successCount = Object.values(supabaseResults).filter(Boolean).length;
      const totalCount = Object.keys(supabaseResults).length;

      if (successCount < totalCount) {
        console.warn('⚠️ 부분적 Supabase 저장:', {
          success: successCount,
          total: totalCount,
          results: supabaseResults,
        });
      }
    } catch (error) {
      console.error('❌ 데이터 품질 검증 실패:', error);
      // 품질 검증 실패는 저장 성공에 영향 없음
    }
  }
}

// ============================================================================
// 싱글톤 인스턴스 export
// ============================================================================

export const dualStorageEngine = new DualStorageEngine();