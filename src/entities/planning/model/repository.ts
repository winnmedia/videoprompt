/**
 * 🗄️ Planning Entity 듀얼 저장 Repository
 * Prisma + Supabase 동시 저장 및 실패 시 자동 Fallback
 *
 * 핵심 원칙:
 * - Dual Write Pattern: Prisma와 Supabase 동시 저장
 * - Circuit Breaker: 연속 실패 시 단일 저장소로 Fallback
 * - Dependency Injection: Repository 인터페이스로 추상화
 * - Error Recovery: 실패한 저장소 자동 복구 시도
 * - FSD 경계 준수: entities 레이어에서 순수 도메인 로직만
 */

import { BaseContent, ScenarioContent, PromptContent, VideoContent, PlanningMetadata } from './types';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { getDegradationMode } from '@/shared/config/env';

// ============================================================================
// Repository Interfaces (Dependency Injection)
// ============================================================================

export interface PlanningRepository {
  save(content: BaseContent): Promise<{ id: string; success: boolean; error?: string }>;
  findById(id: string): Promise<BaseContent | null>;
  findByUserId(userId: string): Promise<BaseContent[]>;
  update(id: string, content: Partial<BaseContent>): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

export interface PrismaRepository extends PlanningRepository {
  name: 'prisma';
}

export interface SupabaseRepository extends PlanningRepository {
  name: 'supabase';
}

// ============================================================================
// Circuit Breaker for Dual Storage
// ============================================================================

interface StorageHealth {
  prisma: { failures: number; lastFailure: number; isHealthy: boolean };
  supabase: { failures: number; lastFailure: number; isHealthy: boolean };
}

const storageHealth: StorageHealth = {
  prisma: { failures: 0, lastFailure: 0, isHealthy: true },
  supabase: { failures: 0, lastFailure: 0, isHealthy: true }
};

const CIRCUIT_CONFIG = {
  FAILURE_THRESHOLD: 3, // 3회 연속 실패 시 차단
  RECOVERY_TIME_MS: 5 * 60 * 1000, // 5분 후 복구 시도
  HEALTH_CHECK_INTERVAL: 60 * 1000 // 1분마다 헬스체크
} as const;

function updateStorageHealth(storage: 'prisma' | 'supabase', success: boolean): void {
  const health = storageHealth[storage];
  const now = Date.now();

  if (success) {
    health.failures = 0;
    health.isHealthy = true;
    console.log(`✅ ${storage} storage recovered`);
  } else {
    health.failures++;
    health.lastFailure = now;

    if (health.failures >= CIRCUIT_CONFIG.FAILURE_THRESHOLD) {
      health.isHealthy = false;
      console.error(`🚨 ${storage} storage circuit opened (${health.failures} failures)`);
    }
  }
}

function canUseStorage(storage: 'prisma' | 'supabase'): boolean {
  const health = storageHealth[storage];
  if (health.isHealthy) return true;

  // 복구 시간이 지났으면 재시도
  const now = Date.now();
  if (now - health.lastFailure > CIRCUIT_CONFIG.RECOVERY_TIME_MS) {
    console.log(`🔄 Attempting ${storage} storage recovery`);
    return true;
  }

  return false;
}

// ============================================================================
// Prisma Repository Implementation
// ============================================================================

class PrismaRepositoryImpl implements PrismaRepository {
  readonly name = 'prisma' as const;

  async save(content: BaseContent): Promise<{ id: string; success: boolean; error?: string }> {
    try {
      // Prisma 클라이언트는 이미 다른 곳에서 초기화되어 있다고 가정
      const { prisma } = await import('@/lib/db');

      const planningData = {
        id: content.id,
        type: content.type,
        title: content.title || `${content.type} - ${new Date().toISOString()}`,
        content: JSON.stringify(content),
        userId: content.metadata?.userId || null,
        status: content.metadata?.status || 'draft',
        createdAt: new Date(content.metadata?.createdAt || Date.now()),
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

      updateStorageHealth('prisma', true);

      return {
        id: result.id,
        success: true
      };

    } catch (error) {
      updateStorageHealth('prisma', false);

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

      const content = JSON.parse(planning.content as string) as BaseContent;
      updateStorageHealth('prisma', true);

      return content;

    } catch (error) {
      updateStorageHealth('prisma', false);
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

      const contents = plannings.map(p => JSON.parse(p.content as string) as BaseContent);
      updateStorageHealth('prisma', true);

      return contents;

    } catch (error) {
      updateStorageHealth('prisma', false);
      console.error('🚨 Prisma findByUserId failed:', error);
      return [];
    }
  }

  async update(id: string, content: Partial<BaseContent>): Promise<boolean> {
    try {
      const { prisma } = await import('@/lib/db');

      const existing = await prisma.planning.findUnique({ where: { id } });
      if (!existing) return false;

      const existingContent = JSON.parse(existing.content as string) as BaseContent;
      const updatedContent = { ...existingContent, ...content };

      await prisma.planning.update({
        where: { id },
        data: {
          content: JSON.stringify(updatedContent),
          updatedAt: new Date()
        }
      });

      updateStorageHealth('prisma', true);
      return true;

    } catch (error) {
      updateStorageHealth('prisma', false);
      console.error('🚨 Prisma update failed:', error);
      return false;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const { prisma } = await import('@/lib/db');

      await prisma.planning.delete({ where: { id } });
      updateStorageHealth('prisma', true);
      return true;

    } catch (error) {
      updateStorageHealth('prisma', false);
      console.error('🚨 Prisma delete failed:', error);
      return false;
    }
  }
}

// ============================================================================
// Supabase Repository Implementation
// ============================================================================

class SupabaseRepositoryImpl implements SupabaseRepository {
  readonly name = 'supabase' as const;

  async save(content: BaseContent): Promise<{ id: string; success: boolean; error?: string }> {
    try {
      // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
      const supabase = await getSupabaseClientSafe('admin');

      // 새로운 Supabase 테이블 구조에 맞는 필드 매핑 (snake_case)
      const planningData = {
        id: content.id,
        type: content.type,
        title: content.title || `${content.type} - ${new Date().toISOString()}`,
        content: content, // JSONB 필드
        status: content.metadata?.status || 'draft',
        user_id: content.metadata?.userId || null, // snake_case
        version: content.metadata?.version || 1,
        metadata: content.metadata || null, // 추가 메타데이터 JSONB
        created_at: new Date(content.metadata?.createdAt || Date.now()).toISOString(), // snake_case
        updated_at: new Date().toISOString() // snake_case
      };

      const { error } = await supabase
        .from('planning')
        .upsert(planningData, {
          onConflict: 'id'
        });

      if (error) {
        throw new Error(error.message);
      }

      updateStorageHealth('supabase', true);

      return {
        id: content.id,
        success: true
      };

    } catch (error) {
      updateStorageHealth('supabase', false);

      // ServiceConfigError 처리 (안전망 시스템)
      if (error instanceof ServiceConfigError) {
        console.warn('🚨 Supabase service unavailable:', error.message);
        return {
          id: content.id,
          success: false,
          error: `Service unavailable: ${error.message}`
        };
      }

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
      // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
      const supabase = await getSupabaseClientSafe('anon');

      const { data, error } = await supabase
        .from('planning')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        if (error) throw new Error(error.message);
        return null;
      }

      updateStorageHealth('supabase', true);

      // JSONB content 필드에서 BaseContent 추출
      return data.content as BaseContent;

    } catch (error) {
      updateStorageHealth('supabase', false);

      // ServiceConfigError 처리 (안전망 시스템)
      if (error instanceof ServiceConfigError) {
        console.warn('🚨 Supabase service unavailable for read:', error.message);
        return null;
      }

      console.error('🚨 Supabase findById failed:', error);
      return null;
    }
  }

  async findByUserId(userId: string): Promise<BaseContent[]> {
    try {
      // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
      const supabase = await getSupabaseClientSafe('anon');

      const { data, error } = await supabase
        .from('planning')
        .select('*')
        .eq('user_id', userId) // snake_case 필드명 사용
        .order('updated_at', { ascending: false }); // snake_case 필드명 사용

      if (error) {
        throw new Error(error.message);
      }

      updateStorageHealth('supabase', true);

      // JSONB content 필드에서 BaseContent 배열 추출
      return (data || []).map(item => item.content as BaseContent);

    } catch (error) {
      updateStorageHealth('supabase', false);

      // ServiceConfigError 처리 (안전망 시스템)
      if (error instanceof ServiceConfigError) {
        console.warn('🚨 Supabase service unavailable for list:', error.message);
        return [];
      }

      console.error('🚨 Supabase findByUserId failed:', error);
      return [];
    }
  }

  async update(id: string, content: Partial<BaseContent>): Promise<boolean> {
    try {
      // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
      const supabase = await getSupabaseClientSafe('admin');

      // 기존 데이터 조회
      const { data: existing } = await supabase
        .from('planning')
        .select('content')
        .eq('id', id)
        .single();

      if (!existing) return false;

      const existingContent = existing.content as BaseContent;
      const updatedContent = { ...existingContent, ...content };

      // 새로운 테이블 구조에 맞는 업데이트 (snake_case 필드)
      const { error } = await supabase
        .from('planning')
        .update({
          content: updatedContent, // JSONB 필드
          updated_at: new Date().toISOString(), // snake_case
          // 필요시 title, status도 업데이트
          ...(content.title && { title: content.title }),
          ...(content.metadata?.status && { status: content.metadata.status })
        })
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      updateStorageHealth('supabase', true);
      return true;

    } catch (error) {
      updateStorageHealth('supabase', false);

      // ServiceConfigError 처리 (안전망 시스템)
      if (error instanceof ServiceConfigError) {
        console.warn('🚨 Supabase service unavailable for update:', error.message);
        return false;
      }

      console.error('🚨 Supabase update failed:', error);
      return false;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
      const supabase = await getSupabaseClientSafe('admin');

      const { error } = await supabase
        .from('planning')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      updateStorageHealth('supabase', true);
      return true;

    } catch (error) {
      updateStorageHealth('supabase', false);

      // ServiceConfigError 처리 (안전망 시스템)
      if (error instanceof ServiceConfigError) {
        console.warn('🚨 Supabase service unavailable for delete:', error.message);
        return false;
      }

      console.error('🚨 Supabase delete failed:', error);
      return false;
    }
  }
}

// ============================================================================
// Dual Storage Service (Main Implementation)
// ============================================================================

export class DualPlanningRepository implements PlanningRepository {
  private prismaRepo: PrismaRepository;
  private supabaseRepo: SupabaseRepository;

  constructor() {
    this.prismaRepo = new PrismaRepositoryImpl();
    this.supabaseRepo = new SupabaseRepositoryImpl();
  }

  async save(content: BaseContent): Promise<{ id: string; success: boolean; error?: string }> {
    const degradationMode = getDegradationMode();
    const canUsePrisma = canUseStorage('prisma');
    const canUseSupabase = canUseStorage('supabase') && degradationMode !== 'disabled';

    console.log(`🗄️ Dual save attempt`, {
      id: content.id,
      type: content.type,
      degradationMode,
      canUsePrisma,
      canUseSupabase
    });

    // 둘 다 사용 불가능한 경우
    if (!canUsePrisma && !canUseSupabase) {
      return {
        id: content.id,
        success: false,
        error: 'Both storage systems are unavailable'
      };
    }

    // 단일 저장소만 사용 가능한 경우
    if (canUsePrisma && !canUseSupabase) {
      console.log(`📦 Using Prisma only (Supabase unavailable)`);
      return await this.prismaRepo.save(content);
    }

    if (!canUsePrisma && canUseSupabase) {
      console.log(`☁️ Using Supabase only (Prisma unavailable)`);
      return await this.supabaseRepo.save(content);
    }

    // 듀얼 저장 시도
    console.log(`🔄 Attempting dual save`);

    const [prismaResult, supabaseResult] = await Promise.allSettled([
      this.prismaRepo.save(content),
      this.supabaseRepo.save(content)
    ]);

    const prismaSuccess = prismaResult.status === 'fulfilled' && prismaResult.value.success;
    const supabaseSuccess = supabaseResult.status === 'fulfilled' && supabaseResult.value.success;

    console.log(`🗄️ Dual save results`, {
      prismaSuccess,
      supabaseSuccess,
      prismaError: prismaResult.status === 'rejected' ? prismaResult.reason :
                   (prismaResult.status === 'fulfilled' ? prismaResult.value.error : null),
      supabaseError: supabaseResult.status === 'rejected' ? supabaseResult.reason :
                     (supabaseResult.status === 'fulfilled' ? supabaseResult.value.error : null)
    });

    // 최소 하나라도 성공하면 OK
    if (prismaSuccess || supabaseSuccess) {
      return {
        id: content.id,
        success: true,
        error: (!prismaSuccess || !supabaseSuccess) ? 'Partial save (one storage failed)' : undefined
      };
    }

    // 둘 다 실패
    const errors = [
      prismaResult.status === 'rejected' ? prismaResult.reason :
        (prismaResult.status === 'fulfilled' ? prismaResult.value.error : null),
      supabaseResult.status === 'rejected' ? supabaseResult.reason :
        (supabaseResult.status === 'fulfilled' ? supabaseResult.value.error : null)
    ].filter(Boolean);

    return {
      id: content.id,
      success: false,
      error: `Both storages failed: ${errors.join(', ')}`
    };
  }

  async findById(id: string): Promise<BaseContent | null> {
    const degradationMode = getDegradationMode();
    const canUsePrisma = canUseStorage('prisma');
    const canUseSupabase = canUseStorage('supabase') && degradationMode !== 'disabled';

    // Prisma 우선 시도 (더 빠르고 안정적)
    if (canUsePrisma) {
      const result = await this.prismaRepo.findById(id);
      if (result) {
        console.log(`📦 Found in Prisma: ${id}`);
        return result;
      }
    }

    // Prisma에서 찾지 못했거나 사용 불가능하면 Supabase 시도
    if (canUseSupabase) {
      const result = await this.supabaseRepo.findById(id);
      if (result) {
        console.log(`☁️ Found in Supabase: ${id}`);

        // Prisma가 사용 가능하면 동기화 시도 (백그라운드)
        if (canUsePrisma) {
          this.prismaRepo.save(result).catch(error => {
            console.warn(`🔄 Background sync to Prisma failed for ${id}:`, error);
          });
        }

        return result;
      }
    }

    console.log(`❌ Not found in any storage: ${id}`);
    return null;
  }

  async findByUserId(userId: string): Promise<BaseContent[]> {
    const degradationMode = getDegradationMode();
    const canUsePrisma = canUseStorage('prisma');
    const canUseSupabase = canUseStorage('supabase') && degradationMode !== 'disabled';

    const results: BaseContent[] = [];
    const foundIds = new Set<string>();

    // Prisma에서 조회
    if (canUsePrisma) {
      try {
        const prismaResults = await this.prismaRepo.findByUserId(userId);
        for (const result of prismaResults) {
          results.push(result);
          foundIds.add(result.id);
        }
        console.log(`📦 Found ${prismaResults.length} items in Prisma for user ${userId}`);
      } catch (error) {
        console.warn(`📦 Prisma findByUserId failed for ${userId}:`, error);
      }
    }

    // Supabase에서 조회 (중복 제거)
    if (canUseSupabase) {
      try {
        const supabaseResults = await this.supabaseRepo.findByUserId(userId);
        const newResults = supabaseResults.filter(result => !foundIds.has(result.id));
        results.push(...newResults);
        console.log(`☁️ Found ${supabaseResults.length} items in Supabase for user ${userId} (${newResults.length} new)`);
      } catch (error) {
        console.warn(`☁️ Supabase findByUserId failed for ${userId}:`, error);
      }
    }

    // 결과 정렬 (최신순)
    results.sort((a, b) => {
      const aTime = a.metadata?.updatedAt || a.metadata?.createdAt || 0;
      const bTime = b.metadata?.updatedAt || b.metadata?.createdAt || 0;
      return bTime - aTime;
    });

    console.log(`🗄️ Dual findByUserId result: ${results.length} items for user ${userId}`);
    return results;
  }

  async update(id: string, content: Partial<BaseContent>): Promise<boolean> {
    const degradationMode = getDegradationMode();
    const canUsePrisma = canUseStorage('prisma');
    const canUseSupabase = canUseStorage('supabase') && degradationMode !== 'disabled';

    if (!canUsePrisma && !canUseSupabase) {
      return false;
    }

    const promises: Promise<boolean>[] = [];

    if (canUsePrisma) {
      promises.push(this.prismaRepo.update(id, content));
    }

    if (canUseSupabase) {
      promises.push(this.supabaseRepo.update(id, content));
    }

    const results = await Promise.allSettled(promises);
    const successes = results.filter(r => r.status === 'fulfilled' && r.value === true);

    console.log(`🗄️ Dual update result: ${successes.length}/${results.length} storages updated for ${id}`);

    // 최소 하나라도 성공하면 OK
    return successes.length > 0;
  }

  async delete(id: string): Promise<boolean> {
    const degradationMode = getDegradationMode();
    const canUsePrisma = canUseStorage('prisma');
    const canUseSupabase = canUseStorage('supabase') && degradationMode !== 'disabled';

    if (!canUsePrisma && !canUseSupabase) {
      return false;
    }

    const promises: Promise<boolean>[] = [];

    if (canUsePrisma) {
      promises.push(this.prismaRepo.delete(id));
    }

    if (canUseSupabase) {
      promises.push(this.supabaseRepo.delete(id));
    }

    const results = await Promise.allSettled(promises);
    const successes = results.filter(r => r.status === 'fulfilled' && r.value === true);

    console.log(`🗄️ Dual delete result: ${successes.length}/${results.length} storages deleted for ${id}`);

    // 최소 하나라도 성공하면 OK
    return successes.length > 0;
  }

  // ========================================================================
  // Health Monitoring
  // ========================================================================

  getStorageHealth(): StorageHealth {
    return { ...storageHealth };
  }

  // ========================================================================
  // Data Consistency Validation
  // ========================================================================

  /**
   * 두 저장소 간 데이터 일관성 검증
   */
  async validateDataConsistency(id: string): Promise<{
    consistent: boolean;
    differences: string[];
    recommendations: string[];
    prismaData?: BaseContent;
    supabaseData?: BaseContent;
  }> {
    const differences: string[] = [];
    const recommendations: string[] = [];

    try {
      // 각 저장소에서 데이터 조회
      const [prismaData, supabaseData] = await Promise.allSettled([
        this.prismaRepo.findById(id),
        this.supabaseRepo.findById(id)
      ]);

      const prismaContent = prismaData.status === 'fulfilled' ? prismaData.value : null;
      const supabaseContent = supabaseData.status === 'fulfilled' ? supabaseData.value : null;

      // 에러 발생 확인
      const prismaError = prismaData.status === 'rejected' ? prismaData.reason : null;
      const supabaseError = supabaseData.status === 'rejected' ? supabaseData.reason : null;

      if (prismaError || supabaseError) {
        const errorMessage = prismaError?.message || supabaseError?.message || '알 수 없는 오류';
        differences.push(`일관성 검증 실패: ${errorMessage}`);
        recommendations.push('수동 데이터 검증 필요');

        return {
          consistent: false,
          differences,
          recommendations
        };
      }

      // 데이터 존재 여부 확인
      if (!prismaContent && !supabaseContent) {
        return {
          consistent: true,
          differences: [],
          recommendations: []
        };
      }

      if (!prismaContent || !supabaseContent) {
        differences.push('한쪽 저장소에만 데이터 존재');
        recommendations.push('누락된 저장소에 데이터 동기화 필요');

        return {
          consistent: false,
          differences,
          recommendations,
          prismaData: prismaContent || undefined,
          supabaseData: supabaseContent || undefined
        };
      }

      // 기본 필드 비교
      const fieldsToCheck = ['id', 'type', 'title'];
      for (const field of fieldsToCheck) {
        if (prismaContent[field as keyof BaseContent] !== supabaseContent[field as keyof BaseContent]) {
          differences.push(`${field} 불일치: Prisma(${prismaContent[field as keyof BaseContent]}) vs Supabase(${supabaseContent[field as keyof BaseContent]})`);
        }
      }

      // 메타데이터 비교
      if (prismaContent.metadata && supabaseContent.metadata) {
        if (prismaContent.metadata.userId !== supabaseContent.metadata.userId) {
          differences.push(`userId 불일치: Prisma(${prismaContent.metadata.userId}) vs Supabase(${supabaseContent.metadata.userId})`);
        }

        if (prismaContent.metadata.status !== supabaseContent.metadata.status) {
          differences.push(`status 불일치: Prisma(${prismaContent.metadata.status}) vs Supabase(${supabaseContent.metadata.status})`);
        }

        // 업데이트 시간 비교 (5초 이내 차이는 허용)
        const prismaTime = prismaContent.metadata.updatedAt || 0;
        const supabaseTime = supabaseContent.metadata.updatedAt || 0;
        const timeDiff = Math.abs(prismaTime - supabaseTime);

        if (timeDiff > 5000) { // 5초 초과
          differences.push(`업데이트 시간 불일치: ${timeDiff}ms 차이`);
          recommendations.push('최신 데이터로 동기화 필요');
        }
      }

      // 권장사항 생성
      if (differences.length > 0) {
        recommendations.push('데이터 일관성 복구를 위한 동기화 실행 권장');
      }

      const consistent = differences.length === 0;

      console.log(`🔍 데이터 일관성 검증 완료 (${id}):`, {
        consistent,
        differencesCount: differences.length,
        recommendationsCount: recommendations.length
      });

      return {
        consistent,
        differences,
        recommendations,
        prismaData: prismaContent,
        supabaseData: supabaseContent
      };

    } catch (error) {
      console.error(`❌ 데이터 일관성 검증 실패 (${id}):`, error);

      return {
        consistent: false,
        differences: [`일관성 검증 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`],
        recommendations: ['수동 데이터 검증 필요']
      };
    }
  }

  /**
   * 사용자별 데이터 일관성 일괄 검증
   */
  async validateUserDataConsistency(userId: string): Promise<{
    overallConsistent: boolean;
    totalItems: number;
    consistentItems: number;
    inconsistentItems: Array<{
      id: string;
      type: string;
      differences: string[];
      recommendations: string[];
    }>;
    summary: {
      healthyItems: number;
      missingInPrisma: number;
      missingInSupabase: number;
      dataConflicts: number;
    };
  }> {
    console.log(`🔍 사용자 데이터 일관성 일괄 검증 시작: ${userId}`);

    try {
      // 각 저장소에서 사용자 데이터 조회
      const [prismaItems, supabaseItems] = await Promise.allSettled([
        this.prismaRepo.findByUserId(userId),
        this.supabaseRepo.findByUserId(userId)
      ]);

      const prismaContent = prismaItems.status === 'fulfilled' ? prismaItems.value : [];
      const supabaseContent = supabaseItems.status === 'fulfilled' ? supabaseItems.value : [];

      // 모든 고유 ID 수집
      const allIds = new Set([
        ...prismaContent.map(item => item.id),
        ...supabaseContent.map(item => item.id)
      ]);

      const inconsistentItems: Array<{
        id: string;
        type: string;
        differences: string[];
        recommendations: string[];
      }> = [];

      const summary = {
        healthyItems: 0,
        missingInPrisma: 0,
        missingInSupabase: 0,
        dataConflicts: 0
      };

      // 각 항목별 일관성 검증
      for (const id of allIds) {
        const prismaItem = prismaContent.find(item => item.id === id);
        const supabaseItem = supabaseContent.find(item => item.id === id);

        if (!prismaItem && supabaseItem) {
          summary.missingInPrisma++;
          inconsistentItems.push({
            id,
            type: supabaseItem.type,
            differences: ['Prisma에 데이터 없음'],
            recommendations: ['Prisma에 데이터 동기화 필요']
          });
        } else if (prismaItem && !supabaseItem) {
          summary.missingInSupabase++;
          inconsistentItems.push({
            id,
            type: prismaItem.type,
            differences: ['Supabase에 데이터 없음'],
            recommendations: ['Supabase에 데이터 동기화 필요']
          });
        } else if (prismaItem && supabaseItem) {
          const validation = await this.validateDataConsistency(id);

          if (!validation.consistent) {
            summary.dataConflicts++;
            inconsistentItems.push({
              id,
              type: prismaItem.type,
              differences: validation.differences,
              recommendations: validation.recommendations
            });
          } else {
            summary.healthyItems++;
          }
        }
      }

      const totalItems = allIds.size;
      const consistentItems = summary.healthyItems;
      const overallConsistent = inconsistentItems.length === 0;

      console.log(`✅ 사용자 데이터 일관성 검증 완료 (${userId}):`, {
        totalItems,
        consistentItems,
        inconsistentCount: inconsistentItems.length,
        overallConsistent
      });

      return {
        overallConsistent,
        totalItems,
        consistentItems,
        inconsistentItems,
        summary
      };

    } catch (error) {
      console.error(`❌ 사용자 데이터 일관성 검증 실패 (${userId}):`, error);

      return {
        overallConsistent: false,
        totalItems: 0,
        consistentItems: 0,
        inconsistentItems: [],
        summary: {
          healthyItems: 0,
          missingInPrisma: 0,
          missingInSupabase: 0,
          dataConflicts: 0
        }
      };
    }
  }

  async performHealthCheck(): Promise<{
    prisma: { healthy: boolean; error?: string };
    supabase: { healthy: boolean; error?: string };
  }> {
    const testContent: BaseContent = {
      id: `health-check-${Date.now()}`,
      type: 'scenario',
      title: 'Health Check',
      status: 'draft',
      storageStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        userId: 'health-check',
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };

    const results = {
      prisma: { healthy: false, error: undefined as string | undefined },
      supabase: { healthy: false, error: undefined as string | undefined }
    };

    // Prisma 헬스체크
    try {
      const prismaResult = await this.prismaRepo.save(testContent);
      results.prisma.healthy = prismaResult.success;
      if (!prismaResult.success) {
        results.prisma.error = prismaResult.error;
      } else {
        // 테스트 데이터 정리
        await this.prismaRepo.delete(testContent.id);
      }
    } catch (error) {
      results.prisma.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Supabase 헬스체크
    try {
      const supabaseResult = await this.supabaseRepo.save(testContent);
      results.supabase.healthy = supabaseResult.success;
      if (!supabaseResult.success) {
        results.supabase.error = supabaseResult.error;
      } else {
        // 테스트 데이터 정리
        await this.supabaseRepo.delete(testContent.id);
      }
    } catch (error) {
      results.supabase.error = error instanceof Error ? error.message : 'Unknown error';
    }

    console.log(`🏥 Health check completed`, results);
    return results;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let globalRepository: DualPlanningRepository | null = null;

/**
 * Planning Repository 싱글톤 팩토리
 */
export function getPlanningRepository(): DualPlanningRepository {
  if (!globalRepository) {
    globalRepository = new DualPlanningRepository();
  }
  return globalRepository;
}