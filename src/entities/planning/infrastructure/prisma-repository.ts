/**
 * Prisma Repository Adapter
 * FSD Architecture - Infrastructure Layer
 *
 * 목적: Prisma ORM을 통한 데이터 저장 구현
 * 패턴: Repository Pattern + Dependency Injection
 */

import { PrismaClient } from '@prisma/client';
import type {
  PrismaRepository,
  ScenarioContent,
  PromptContent,
  VideoContent,
  PlanningContent
} from '../model/services';

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

      await prisma.scenario.create({
        data: {
          id: data.id,
          projectId: data.projectId,
          title: data.title,
          story: data.story,
          genre: data.genre,
          tone: data.tone,
          target: data.target,
          format: data.format,
          tempo: data.tempo,
          developmentMethod: data.developmentMethod,
          developmentIntensity: data.developmentIntensity,
          durationSec: data.durationSec,
          source: data.source,
          status: data.status,
          storageStatus: data.storageStatus,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          storage: data.storage ? JSON.stringify(data.storage) : null,
        },
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

      await prisma.prompt.create({
        data: {
          id: data.id,
          projectId: data.projectId,
          scenarioTitle: data.scenarioTitle,
          finalPrompt: data.finalPrompt,
          keywords: data.keywords ? JSON.stringify(data.keywords) : null,
          source: data.source,
          status: data.status,
          storageStatus: data.storageStatus,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          storage: data.storage ? JSON.stringify(data.storage) : null,
        },
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

      await prisma.video.create({
        data: {
          id: data.id,
          projectId: data.projectId,
          videoUrl: data.videoUrl,
          thumbnailUrl: data.thumbnailUrl,
          processingJobId: data.processingJobId,
          source: data.source,
          status: data.status,
          storageStatus: data.storageStatus,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          storage: data.storage ? JSON.stringify(data.storage) : null,
        },
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

      // 시나리오 검색
      const scenario = await prisma.scenario.findUnique({ where: { id } });
      if (scenario) {
        return {
          ...scenario,
          type: 'scenario' as const,
          metadata: scenario.metadata ? JSON.parse(scenario.metadata) : {},
          storage: scenario.storage ? JSON.parse(scenario.storage) : { prisma: { saved: false }, supabase: { saved: false } },
          createdAt: scenario.createdAt.toISOString(),
          updatedAt: scenario.updatedAt.toISOString(),
        };
      }

      // 프롬프트 검색
      const prompt = await prisma.prompt.findUnique({ where: { id } });
      if (prompt) {
        return {
          ...prompt,
          type: 'prompt' as const,
          keywords: prompt.keywords ? JSON.parse(prompt.keywords) : [],
          metadata: prompt.metadata ? JSON.parse(prompt.metadata) : {},
          storage: prompt.storage ? JSON.parse(prompt.storage) : { prisma: { saved: false }, supabase: { saved: false } },
          createdAt: prompt.createdAt.toISOString(),
          updatedAt: prompt.updatedAt.toISOString(),
        };
      }

      // 영상 검색
      const video = await prisma.video.findUnique({ where: { id } });
      if (video) {
        return {
          ...video,
          type: 'video' as const,
          metadata: video.metadata ? JSON.parse(video.metadata) : {},
          storage: video.storage ? JSON.parse(video.storage) : { prisma: { saved: false }, supabase: { saved: false } },
          createdAt: video.createdAt.toISOString(),
          updatedAt: video.updatedAt.toISOString(),
        };
      }

      return null;

    } catch (error) {
      console.error(`❌ Prisma: ID로 조회 실패 - ${id}:`, error);
      return null;
    }
  }

  async updateStatus(id: string, status: Partial<PlanningContent>): Promise<{ success: boolean; error?: string }> {
    try {
      const { prisma } = this.dependencies;

      // 먼저 어떤 테이블의 데이터인지 확인
      const existing = await this.findById(id);
      if (!existing) {
        return { success: false, error: 'Content not found' };
      }

      const updateData = {
        ...(status.status && { status: status.status }),
        ...(status.storageStatus && { storageStatus: status.storageStatus }),
        ...(status.storage && { storage: JSON.stringify(status.storage) }),
        updatedAt: new Date(),
      };

      switch (existing.type) {
        case 'scenario':
          await prisma.scenario.update({ where: { id }, data: updateData });
          break;
        case 'prompt':
          await prisma.prompt.update({ where: { id }, data: updateData });
          break;
        case 'video':
          await prisma.video.update({ where: { id }, data: updateData });
          break;
      }

      console.log(`✅ Prisma: 상태 업데이트 성공 - ${id}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Prisma error';
      console.error(`❌ Prisma: 상태 업데이트 실패 - ${id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}

/**
 * Factory function for creating Prisma repository
 */
export function createPrismaRepository(prisma: PrismaClient): PrismaRepository {
  return new PrismaRepositoryImpl({ prisma });
}