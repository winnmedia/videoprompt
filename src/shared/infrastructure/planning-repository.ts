/**
 * 🗄️ Planning Repository Implementations
 * Infrastructure Layer - 인프라 구현체들
 *
 * 핵심 원칙:
 * - 인프라 의존성 허용 (Supabase 클라이언트 사용)
 * - 도메인 인터페이스 구현
 * - 의존성 주입을 통한 느슨한 결합
 *
 * Note: Prisma 구현체 제거됨 (2024년 Supabase 전환)
 */

import {
  PlanningRepository,
  SupabaseRepository,
  RepositoryFactory,
  StorageHealth,
  StorageStatus
} from '@/entities/planning/model/repository-interfaces';
import { BaseContent } from '@/entities/planning/model/types';
import { logger } from '@/shared/lib/logger';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';

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
      logger.error('🚨 Supabase save failed:', error instanceof Error ? error : new Error(String(error)));
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
      logger.error('🚨 Supabase findById failed:', error instanceof Error ? error : new Error(String(error)));
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
      logger.error('🚨 Supabase findByUserId failed:', error instanceof Error ? error : new Error(String(error)));
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
      logger.error('🚨 Supabase update failed:', error instanceof Error ? error : new Error(String(error)));
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
      logger.error('🚨 Supabase delete failed:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async getStorageHealth(): Promise<StorageHealth> {
    const startTime = performance.now();

    let supabaseStatus: StorageStatus = {
      status: 'unhealthy',
      responseTime: 0,
      errorMessage: undefined,
      lastCheck: new Date(),
      isConnected: false
    };

    try {
      const supabase = await getSupabaseClientSafe('anon');
      const healthStartTime = performance.now();

      // 간단한 health check 쿼리
      const { error } = await supabase
        .from('planning')
        .select('count(*)')
        .limit(1);

      const responseTime = performance.now() - healthStartTime;

      if (!error) {
        supabaseStatus = {
          status: 'healthy',
          responseTime,
          errorMessage: undefined,
          lastCheck: new Date(),
          isConnected: true
        };
      } else {
        throw new Error(error.message);
      }

    } catch (error) {
      logger.error('🚨 Supabase health check failed:', error instanceof Error ? error : new Error(String(error)));
      supabaseStatus = {
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
        isConnected: false
      };
    }

    return {
      overall: supabaseStatus.status,
      supabase: supabaseStatus,
      responseTime: performance.now() - startTime
    };
  }
}

// ============================================================================
// Repository Factory (Supabase only)
// ============================================================================

export class PlanningRepositoryFactory implements RepositoryFactory {
  createSupabaseRepository(): SupabaseRepository {
    return new SupabasePlanningRepository();
  }

  /**
   * 기본 repository는 Supabase 사용
   */
  createDefaultRepository(): PlanningRepository {
    return this.createSupabaseRepository();
  }
}

// ============================================================================
// Singleton Factory Instance
// ============================================================================

export const planningRepositoryFactory = new PlanningRepositoryFactory();