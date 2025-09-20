import { NextRequest, NextResponse } from 'next/server';
import { prismaCircuitBreaker, supabaseCircuitBreaker } from '@/shared/lib/circuit-breaker';
import { checkAllRequiredTables } from '@/shared/lib/supabase-schema-sync';
import { logger } from '@/shared/lib/logger';

// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 저장소 모니터링 대시보드 API
 * 듀얼 스토리지 시스템의 상태를 실시간으로 모니터링
 */
export async function GET(req: NextRequest) {
  try {
    logger.info('📊 저장소 모니터링 대시보드 요청');

    // 1. 회로 차단기 상태 조회
    const circuitBreakerStats = {
      prisma: prismaCircuitBreaker.getStats(),
      supabase: supabaseCircuitBreaker.getStats()
    };

    // 2. 테이블 존재 여부 확인
    const tableStatus = await checkAllRequiredTables();

    // 3. Prisma 연결 상태 확인
    let prismaStatus = {
      connected: false,
      responseTime: 0,
      error: null as string | null
    };

    // Prisma 연결 상태 확인 임시 비활성화
    prismaStatus = {
      connected: false,
      responseTime: 0,
      error: 'Prisma temporarily disabled'
    };

    // 4. Supabase 연결 상태 확인
    let supabaseStatus = {
      connected: false,
      responseTime: 0,
      error: null as string | null
    };

    try {
      const startTime = Date.now();
      const client = await getSupabaseClientSafe('admin');

      const { error } = await client.from('users').select('count(*)').limit(1);

      if (!error) {
        supabaseStatus = {
          connected: true,
          responseTime: Date.now() - startTime,
          error: null
        };
      } else {
        throw error;
      }
    } catch (error) {
      supabaseStatus = {
        connected: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    // 5. 데이터 일관성 체크 (최근 생성된 스토리 샘플링)
    let consistencyCheck = {
      checked: false,
      consistent: false,
      prismaCount: 0,
      supabaseCount: 0,
      lastSyncTime: null as string | null
    };

    try {
      // Prisma에서 최근 스토리 수 조회
      const prismaCount = await prisma.story.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 최근 24시간
          }
        }
      });

      // Supabase에서 최근 스토리 수 조회
      let supabaseCount = 0;
      const client = await getSupabaseClientSafe('admin');

      const { count } = await client
        .from('Story')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      supabaseCount = count || 0;

      consistencyCheck = {
        checked: true,
        consistent: Math.abs(prismaCount - supabaseCount) <= 1, // 1개 차이까지 허용
        prismaCount,
        supabaseCount,
        lastSyncTime: new Date().toISOString()
      };
    } catch (error) {
      console.warn('일관성 체크 실패:', error);
    }

    // 6. 시스템 전체 상태 평가
    const overallHealth = {
      status: 'healthy' as 'healthy' | 'degraded' | 'critical',
      components: {
        prisma: prismaStatus.connected && circuitBreakerStats.prisma.state === 'CLOSED',
        supabase: supabaseStatus.connected && circuitBreakerStats.supabase.state === 'CLOSED',
        consistency: consistencyCheck.consistent
      }
    };

    // 상태 평가
    const healthyComponents = Object.values(overallHealth.components).filter(Boolean).length;

    if (healthyComponents === 3) {
      overallHealth.status = 'healthy';
    } else if (healthyComponents >= 2) {
      overallHealth.status = 'degraded';
    } else {
      overallHealth.status = 'critical';
    }

    const responseData = {
      timestamp: new Date().toISOString(),
      overallHealth,
      storage: {
        prisma: {
          status: prismaStatus,
          circuitBreaker: circuitBreakerStats.prisma
        },
        supabase: {
          status: supabaseStatus,
          circuitBreaker: circuitBreakerStats.supabase
        }
      },
      tables: {
        status: tableStatus,
        summary: {
          total: Object.keys(tableStatus).length,
          existing: Object.values(tableStatus).filter(exists => exists).length,
          missing: Object.entries(tableStatus)
            .filter(([_, exists]) => !exists)
            .map(([table]) => table)
        }
      },
      dataConsistency: consistencyCheck,
      recommendations: generateRecommendations(overallHealth, circuitBreakerStats, tableStatus, consistencyCheck)
    };

    logger.info('✅ 저장소 모니터링 완료:', {
      status: overallHealth.status,
      healthyComponents: healthyComponents
    });

    return NextResponse.json(
      createSuccessResponse(responseData),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ 저장소 모니터링 API 오류:', error);

    return NextResponse.json(
      createErrorResponse(
        'MONITORING_ERROR',
        '저장소 모니터링 중 오류가 발생했습니다.',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      ),
      { status: 500 }
    );
  }
}

/**
 * 시스템 상태에 따른 권장사항 생성
 */
function generateRecommendations(
  overallHealth: any,
  circuitBreakerStats: any,
  tableStatus: Record<string, boolean>,
  consistencyCheck: any
): string[] {
  const recommendations: string[] = [];

  // 회로 차단기 권장사항
  if (circuitBreakerStats.prisma.state === 'OPEN') {
    recommendations.push('Prisma 회로 차단기가 열려있습니다. 데이터베이스 연결을 확인해주세요.');
  }

  if (circuitBreakerStats.supabase.state === 'OPEN') {
    recommendations.push('Supabase 회로 차단기가 열려있습니다. API 키와 연결을 확인해주세요.');
  }

  // 테이블 상태 권장사항
  const missingTables = Object.entries(tableStatus)
    .filter(([_, exists]) => !exists)
    .map(([table]) => table);

  if (missingTables.length > 0) {
    recommendations.push(`누락된 테이블이 있습니다: ${missingTables.join(', ')}. 스키마 동기화를 실행해주세요.`);
  }

  // 데이터 일관성 권장사항
  if (consistencyCheck.checked && !consistencyCheck.consistent) {
    const diff = Math.abs(consistencyCheck.prismaCount - consistencyCheck.supabaseCount);
    recommendations.push(`데이터 불일치가 발견되었습니다 (차이: ${diff}개). 데이터 동기화를 확인해주세요.`);
  }

  // 전체 상태 권장사항
  if (overallHealth.status === 'critical') {
    recommendations.push('시스템이 심각한 상태입니다. 즉시 복구 작업이 필요합니다.');
  } else if (overallHealth.status === 'degraded') {
    recommendations.push('시스템이 저하된 상태입니다. 일부 기능에 제한이 있을 수 있습니다.');
  }

  // 가동률 기반 권장사항
  if (circuitBreakerStats.prisma.uptime < 95) {
    recommendations.push(`Prisma 가동률이 낮습니다 (${circuitBreakerStats.prisma.uptime}%). 연결 안정성을 점검해주세요.`);
  }

  if (circuitBreakerStats.supabase.uptime < 95) {
    recommendations.push(`Supabase 가동률이 낮습니다 (${circuitBreakerStats.supabase.uptime}%). 연결 안정성을 점검해주세요.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('모든 시스템이 정상 작동 중입니다.');
  }

  return recommendations;
}