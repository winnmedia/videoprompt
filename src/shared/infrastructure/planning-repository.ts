/**
 * 🗄️ Planning Repository Implementations
 * Infrastructure Layer - 인프라 구현체들
 *
 * 핵심 원칙:
 * - 인프라 의존성 허용 (Prisma, Supabase 클라이언트 사용)
 * - 도메인 인터페이스 구현
 * - 의존성 주입을 통한 느슨한 결합
 */

import {
  PlanningRepository,
  PrismaRepository,
  SupabaseRepository,
  DualStorageRepository,
  DualStorageResult,
  RepositoryFactory,
  StorageHealth,
  StorageStatus
} from '@/entities/planning/model/repository-interfaces';
import { BaseContent } from '@/entities/planning/model/types';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';

// ============================================================================
// Prisma Repository Implementation
// ============================================================================

export class PrismaPlanningRepository implements PrismaRepository {
  readonly name = 'prisma' as const;

  async save(content: BaseContent): Promise<{ id: string; success: boolean; error?: string }> {
    try {
      const { prisma } = await import('@/lib/db');

      const planningData = {
        id: content.id,
        type: content.type,
        title: content.title || `${content.type} - ${new Date().toISOString()}`,
        content: JSON.stringify(content),
        userId: (typeof content.metadata?.userId === 'string') ? content.metadata.userId : null,
        status: (typeof content.metadata?.status === 'string') ? content.metadata.status : 'draft',
        createdAt: new Date(
          (typeof content.metadata?.createdAt === 'number') ? content.metadata.createdAt : Date.now()
        ),
        updatedAt: new Date()
      };

      const result = await prisma.planning.upsert({
        where: { id: content.id },
        update: {
          title: planningData.title,
          content: planningData.content,
          status: planningData.status,
          updatedAt: planningData.updatedAt
        },
        create: planningData
      });

      return {
        id: result.id,
        success: true
      };

    } catch (error) {
      console.error('🚨 Prisma save failed:', error);
      return {
        id: content.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown prisma error'
      };
    }
  }

  async findById(id: string): Promise<BaseContent | null> {
    try {
      const { prisma } = await import('@/lib/db');

      const planning = await prisma.planning.findUnique({
        where: { id }
      });

      if (!planning) return null;

      return JSON.parse(planning.content as string) as BaseContent;

    } catch (error) {
      console.error('🚨 Prisma findById failed:', error);
      return null;
    }
  }

  async findByUserId(userId: string): Promise<BaseContent[]> {
    try {
      const { prisma } = await import('@/lib/db');

      const plannings = await prisma.planning.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
      });

      return plannings.map(p => JSON.parse(p.content as string) as BaseContent);

    } catch (error) {
      console.error('🚨 Prisma findByUserId failed:', error);
      return [];
    }
  }

  async update(id: string, content: Partial<BaseContent>): Promise<boolean> {
    try {
      const { prisma } = await import('@/lib/db');

      await prisma.planning.update({
        where: { id },
        data: {
          content: JSON.stringify(content),
          updatedAt: new Date()
        }
      });

      return true;

    } catch (error) {
      console.error('🚨 Prisma update failed:', error);
      return false;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const { prisma } = await import('@/lib/db');

      await prisma.planning.delete({
        where: { id }
      });

      return true;

    } catch (error) {
      console.error('🚨 Prisma delete failed:', error);
      return false;
    }
  }

  async getStorageHealth(): Promise<StorageHealth> {
    const startTime = performance.now();

    let prismaStatus: StorageStatus = {
      status: 'unhealthy'
    };

    let supabaseStatus: StorageStatus = {
      status: 'unhealthy'
    };

    // Prisma 헬스 체크
    try {
      const { prisma } = await import('@/lib/db');
      await prisma.$queryRaw`SELECT 1`;
      const endTime = performance.now();

      prismaStatus = {
        status: 'healthy',
        latency: Math.round(endTime - startTime)
      };
    } catch (error) {
      console.error('🚨 Prisma health check failed:', error);
      prismaStatus = {
        status: 'unhealthy',
        latency: Math.round(performance.now() - startTime)
      };
    }

    // Supabase 헬스 체크 (기본값: unhealthy, Prisma 우선 정책)
    try {
      const supabase = await getSupabaseClientSafe('anon');
      const supabaseStartTime = performance.now();

      const { error } = await supabase
        .from('planning')
        .select('id')
        .limit(1);

      const supabaseEndTime = performance.now();

      if (!error) {
        supabaseStatus = {
          status: 'healthy',
          latency: Math.round(supabaseEndTime - supabaseStartTime)
        };
      }
    } catch (error) {
      console.error('🚨 Supabase health check failed:', error);
      // supabaseStatus는 이미 unhealthy로 초기화됨
    }

    return {
      prisma: prismaStatus,
      supabase: supabaseStatus
    };
  }
}

// ============================================================================
// Supabase Repository Implementation
// ============================================================================

export class SupabasePlanningRepository implements SupabaseRepository {
  readonly name = 'supabase' as const;

  async save(content: BaseContent): Promise<{ id: string; success: boolean; error?: string }> {
    try {
      const supabase = await getSupabaseClientSafe('anon');

      const planningData = {
        id: content.id,
        type: content.type,
        title: content.title || `${content.type} - ${new Date().toISOString()}`,
        content: content as any, // JSONB field
        user_id: content.metadata?.userId || null,
        status: content.metadata?.status || 'draft',
        created_at: new Date(
          (typeof content.metadata?.createdAt === 'number')
            ? content.metadata.createdAt
            : (typeof content.metadata?.createdAt === 'string')
            ? new Date(content.metadata.createdAt).getTime()
            : Date.now()
        ).toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('planning')
        .upsert(planningData, {
          onConflict: 'id'
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      return {
        id: data.id,
        success: true
      };

    } catch (error) {
      console.error('🚨 Supabase save failed:', error);
      return {
        id: content.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown supabase error'
      };
    }
  }

  async findById(id: string): Promise<BaseContent | null> {
    try {
      const supabase = await getSupabaseClientSafe('anon');

      const { data, error } = await supabase
        .from('planning')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;

      return data.content as BaseContent;

    } catch (error) {
      console.error('🚨 Supabase findById failed:', error);
      return null;
    }
  }

  async findByUserId(userId: string): Promise<BaseContent[]> {
    try {
      const supabase = await getSupabaseClientSafe('anon');

      const { data, error } = await supabase
        .from('planning')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map(item => item.content as BaseContent);

    } catch (error) {
      console.error('🚨 Supabase findByUserId failed:', error);
      return [];
    }
  }

  async update(id: string, content: Partial<BaseContent>): Promise<boolean> {
    try {
      const supabase = await getSupabaseClientSafe('anon');

      const { error } = await supabase
        .from('planning')
        .update({
          content: content as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw new Error(error.message);
      return true;

    } catch (error) {
      console.error('🚨 Supabase update failed:', error);
      return false;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await getSupabaseClientSafe('anon');

      const { error } = await supabase
        .from('planning')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      return true;

    } catch (error) {
      console.error('🚨 Supabase delete failed:', error);
      return false;
    }
  }

  async getStorageHealth(): Promise<StorageHealth> {
    const startTime = performance.now();

    let prismaStatus: StorageStatus = {
      status: 'unhealthy'
    };

    let supabaseStatus: StorageStatus = {
      status: 'unhealthy'
    };

    // Supabase 헬스 체크 (주 스토리지)
    try {
      const supabase = await getSupabaseClientSafe('anon');
      const supabaseStartTime = performance.now();

      const { error } = await supabase
        .from('planning')
        .select('id')
        .limit(1);

      const supabaseEndTime = performance.now();

      if (!error) {
        supabaseStatus = {
          status: 'healthy',
          latency: Math.round(supabaseEndTime - supabaseStartTime)
        };
      }
    } catch (error) {
      console.error('🚨 Supabase health check failed:', error);
      supabaseStatus = {
        status: 'unhealthy',
        latency: Math.round(performance.now() - startTime)
      };
    }

    // Prisma 헬스 체크 (백업 스토리지로 간주)
    try {
      const { prisma } = await import('@/lib/db');
      const prismaStartTime = performance.now();

      await prisma.$queryRaw`SELECT 1`;
      const prismaEndTime = performance.now();

      prismaStatus = {
        status: 'healthy',
        latency: Math.round(prismaEndTime - prismaStartTime)
      };
    } catch (error) {
      console.error('🚨 Prisma health check failed:', error);
      // prismaStatus는 이미 unhealthy로 초기화됨
    }

    return {
      prisma: prismaStatus,
      supabase: supabaseStatus
    };
  }
}

// ============================================================================
// Repository Factory Implementation
// ============================================================================

export class PlanningRepositoryFactory implements RepositoryFactory {
  createPrismaRepository(): PrismaRepository {
    return new PrismaPlanningRepository();
  }

  createSupabaseRepository(): SupabaseRepository {
    return new SupabasePlanningRepository();
  }

  createDualStorageRepository(
    primary: PlanningRepository,
    fallback: PlanningRepository
  ): DualStorageRepository {
    // TODO: 듀얼 스토리지 구현은 복잡도 감소 후 재검토
    throw new Error('DualStorage implementation moved to separate module');
  }
}

// ============================================================================
// Singleton Factory Instance
// ============================================================================

export const planningRepositoryFactory = new PlanningRepositoryFactory();