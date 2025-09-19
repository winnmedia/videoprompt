/**
 * Prisma Repository Adapter
 * FSD Architecture - Infrastructure Layer
 *
 * 목적: Prisma ORM을 통한 데이터 저장 구현
 * 패턴: Repository Pattern + Dependency Injection
 * 저장소: Planning 통합 테이블 활용 (Type-safe)
 *
 * Contract Verification: Planning 모델 기반 저장으로 타입 안전성 보장
 * Error Handling: 필드 매핑 실패 시 명확한 에러 메시지 제공
 */

import { PrismaClient } from '@prisma/client';
import type { PrismaRepository } from '../model/services';
import type {
  ScenarioContent,
  PromptContent,
  VideoContent,
  PlanningContent
} from '../model/types';
import type { ContentType, ContentStatus, StorageStatus } from '../model/types';

interface PrismaRepositoryDependencies {
  prisma: PrismaClient;
}

/**
 * Prisma Repository 구현체
 */
export class PrismaRepositoryImpl implements PrismaRepository {
  constructor(private dependencies: PrismaRepositoryDependencies) {}

  async saveScenario(data: ScenarioContent): Promise<{ success: boolean; error?: string }> {
    try {
      const { prisma } = this.dependencies;

      // Type-safe 필드 매핑: Planning 테이블 활용
      const planningData = this.mapScenarioToPlanning(data);

      await prisma.planning.create({
        data: planningData
      });

      console.log(`✅ Prisma: 시나리오 저장 성공 - ${data.id}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Prisma error';
      console.error(`❌ Prisma: 시나리오 저장 실패 - ${data.id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async savePrompt(data: PromptContent): Promise<{ success: boolean; error?: string }> {
    try {
      const { prisma } = this.dependencies;

      // Type-safe 필드 매핑: Planning 테이블 활용
      const planningData = this.mapPromptToPlanning(data);

      await prisma.planning.create({
        data: planningData
      });

      console.log(`✅ Prisma: 프롬프트 저장 성공 - ${data.id}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Prisma error';
      console.error(`❌ Prisma: 프롬프트 저장 실패 - ${data.id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async saveVideo(data: VideoContent): Promise<{ success: boolean; error?: string }> {
    try {
      const { prisma } = this.dependencies;

      // Type-safe 필드 매핑: Planning 테이블 활용
      const planningData = this.mapVideoToPlanning(data);

      await prisma.planning.create({
        data: planningData
      });

      console.log(`✅ Prisma: 영상 저장 성공 - ${data.id}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Prisma error';
      console.error(`❌ Prisma: 영상 저장 실패 - ${data.id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async findById(id: string): Promise<PlanningContent | null> {
    try {
      const { prisma } = this.dependencies;

      // Planning 테이블에서 통합 검색
      const planning = await prisma.planning.findUnique({ where: { id } });

      if (!planning) {
        return null;
      }

      // Type-safe 역변환: Planning -> Domain Content
      return this.mapPlanningToContent(planning);

    } catch (error) {
      console.error(`❌ Prisma: ID로 조회 실패 - ${id}:`, error);
      return null;
    }
  }

  async updateStatus(id: string, status: Partial<PlanningContent>): Promise<{ success: boolean; error?: string }> {
    try {
      const { prisma } = this.dependencies;

      // Planning 테이블에서 직접 업데이트
      const updateData: any = {
        updatedAt: new Date()
      };

      // Type-safe 상태 업데이트
      if (status.status) {
        updateData.status = this.mapContentStatusToPrisma(status.status);
      }

      if (status.storageStatus) {
        updateData.storageStatus = this.mapStorageStatusToPrisma(status.storageStatus);
      }

      // 메타데이터 업데이트 (기존 데이터와 병합)
      if (status.metadata) {
        const existing = await prisma.planning.findUnique({ where: { id } });
        if (existing) {
          const existingMetadata = existing.metadata as any || {};
          updateData.metadata = {
            ...existingMetadata,
            ...status.metadata
          };
        } else {
          updateData.metadata = status.metadata;
        }
      }

      // 저장소 상태 업데이트 (별도 필드)
      if (status.storage) {
        updateData.storage = status.storage;
      }

      await prisma.planning.update({
        where: { id },
        data: updateData
      });

      console.log(`✅ Prisma: 상태 업데이트 성공 - ${id}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Prisma error';
      console.error(`❌ Prisma: 상태 업데이트 실패 - ${id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Type-safe 매핑 메서드들
   * Contract Verification: 도메인 모델과 DB 스키마 간 안전한 변환
   */
  private mapScenarioToPlanning(data: ScenarioContent) {
    return {
      id: data.id,
      type: 'scenario' as const,
      title: data.title,
      content: {
        // 시나리오 핵심 데이터
        story: data.story,
        genre: data.genre,
        tone: data.tone,
        target: data.target,
        format: data.format,
        tempo: data.tempo,
        developmentMethod: data.developmentMethod,
        developmentIntensity: data.developmentIntensity,
        durationSec: data.durationSec
      },
      status: this.mapContentStatusToPrisma(data.status),
      userId: data.userId || null,
      projectId: data.projectId || null, // 새로운 필드 지원
      version: 1,
      metadata: data.metadata || {},
      storage: data.storage || { prisma: { saved: false }, supabase: { saved: false } },
      source: data.source || 'user',
      storageStatus: this.mapStorageStatusToPrisma(data.storageStatus)
    };
  }

  private mapPromptToPlanning(data: PromptContent) {
    return {
      id: data.id,
      type: 'prompt' as const,
      title: data.scenarioTitle || data.title || `Prompt ${data.id}`,
      content: {
        // 프롬프트 핵심 데이터
        finalPrompt: data.finalPrompt,
        keywords: data.keywords || [],
        scenarioTitle: data.scenarioTitle
      },
      status: this.mapContentStatusToPrisma(data.status),
      userId: data.userId || null,
      projectId: data.projectId || null, // 새로운 필드 지원
      version: 1,
      metadata: data.metadata || {},
      storage: data.storage || { prisma: { saved: false }, supabase: { saved: false } },
      source: data.source || 'user',
      storageStatus: this.mapStorageStatusToPrisma(data.storageStatus)
    };
  }

  private mapVideoToPlanning(data: VideoContent) {
    return {
      id: data.id,
      type: 'video' as const,
      title: data.title || `Video ${data.id}`,
      content: {
        // 영상 핵심 데이터
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        processingJobId: data.processingJobId
      },
      status: this.mapContentStatusToPrisma(data.status),
      userId: data.userId || null,
      projectId: data.projectId || null, // 새로운 필드 지원
      version: 1,
      metadata: data.metadata || {},
      storage: data.storage || { prisma: { saved: false }, supabase: { saved: false } },
      source: data.source || 'user',
      storageStatus: this.mapStorageStatusToPrisma(data.storageStatus)
    };
  }

  private mapPlanningToContent(planning: any): PlanningContent {
    const content = planning.content as any;
    const metadata = planning.metadata as any;
    const storage = planning.storage || { prisma: { saved: true }, supabase: { saved: false } };

    const baseFields = {
      id: planning.id,
      title: planning.title,
      userId: planning.userId,
      projectId: planning.projectId,
      status: this.mapPrismaStatusToContent(planning.status),
      source: planning.source,
      storageStatus: this.mapPrismaStorageStatusToContent(planning.storageStatus),
      createdAt: planning.createdAt.toISOString(),
      updatedAt: planning.updatedAt.toISOString(),
      metadata: metadata || {},
      storage
    };

    switch (planning.type) {
      case 'scenario':
        return {
          ...baseFields,
          type: 'scenario' as const,
          story: content.story,
          genre: content.genre,
          tone: content.tone,
          target: content.target,
          format: content.format,
          tempo: content.tempo,
          developmentMethod: content.developmentMethod,
          developmentIntensity: content.developmentIntensity,
          durationSec: content.durationSec
        } as ScenarioContent;

      case 'prompt':
        return {
          ...baseFields,
          type: 'prompt' as const,
          finalPrompt: content.finalPrompt,
          keywords: content.keywords || [],
          scenarioTitle: content.scenarioTitle
        } as PromptContent;

      case 'video':
        return {
          ...baseFields,
          type: 'video' as const,
          videoUrl: content.videoUrl,
          thumbnailUrl: content.thumbnailUrl,
          processingJobId: content.processingJobId
        } as VideoContent;

      default:
        throw new Error(`Unsupported planning type: ${planning.type}`);
    }
  }

  private mapContentStatusToPrisma(status: ContentStatus): string {
    // ContentStatus -> Prisma status 매핑 (완전 매핑)
    return status;
  }

  private mapPrismaStatusToContent(status: string): ContentStatus {
    // Prisma status -> ContentStatus 매핑 (타입 안전성 보장)
    const validStatuses: ContentStatus[] = ['draft', 'active', 'processing', 'completed', 'failed', 'archived'];
    return validStatuses.includes(status as ContentStatus)
      ? (status as ContentStatus)
      : 'draft';
  }

  private mapStorageStatusToPrisma(storageStatus: StorageStatus): string {
    // StorageStatus -> Prisma storageStatus 매핑
    return storageStatus;
  }

  private mapPrismaStorageStatusToContent(storageStatus: string): StorageStatus {
    // Prisma storageStatus -> StorageStatus 매핑 (타입 안전성 보장)
    const validStorageStatuses: StorageStatus[] = ['pending', 'saving', 'saved', 'failed', 'partial'];
    return validStorageStatuses.includes(storageStatus as StorageStatus)
      ? (storageStatus as StorageStatus)
      : 'pending';
  }
}

/**
 * Factory function for creating Prisma repository
 */
export function createPrismaRepository(prisma: PrismaClient): PrismaRepository {
  return new PrismaRepositoryImpl({ prisma });
}