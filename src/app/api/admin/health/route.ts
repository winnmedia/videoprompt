/**
 * Admin Health Check API Route
 *
 * 시스템 상태 모니터링 엔드포인트
 * CLAUDE.md 준수: 외부 제공자 상태 확인, 캐싱, 타임아웃 제어
 */

import { NextRequest } from 'next/server';
import {
  withAdminHandler,
  createAdminSuccessResponse,
  AdminApiError,
} from '@/shared/api/admin-utils';
import {
  HealthCheckQuerySchema,
  type HealthCheckQuery,
} from '@/shared/api/admin-schemas';
import { validateQueryParams } from '@/shared/api/planning-utils';
import logger from '@/shared/lib/structured-logger';
import type { ProviderStatus } from '@/entities/admin';

// ===========================================
// 외부 제공자 설정
// ===========================================

const PROVIDERS = {
  seedance: {
    name: 'Seedance',
    healthUrl: process.env.SEEDANCE_HEALTH_URL || 'https://api.seedance.com/health',
    apiKey: process.env.SEEDANCE_API_KEY,
  },
  veo: {
    name: 'Veo',
    healthUrl: process.env.VEO_HEALTH_URL || 'https://api.veo.com/v1/health',
    apiKey: process.env.VEO_API_KEY,
  },
  imagen: {
    name: 'Imagen',
    healthUrl: process.env.IMAGEN_HEALTH_URL || 'https://imagen.googleapis.com/v1/health',
    apiKey: process.env.IMAGEN_API_KEY,
  },
  runway: {
    name: 'Runway',
    healthUrl: process.env.RUNWAY_HEALTH_URL || 'https://api.runwayml.com/v1/health',
    apiKey: process.env.RUNWAY_API_KEY,
  },
} as const;

// ===========================================
// 캐시 설정
// ===========================================

const HEALTH_CACHE_TTL = 30 * 1000; // 30초
const healthCache = new Map<string, { data: any; timestamp: number }>();

function getCachedHealth(key: string): ProviderStatus | null {
  const cached = healthCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > HEALTH_CACHE_TTL) {
    healthCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedHealth(key: string, data: ProviderStatus): void {
  healthCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// ===========================================
// 단일 제공자 Health Check
// ===========================================

async function checkProviderHealth(
  provider: keyof typeof PROVIDERS,
  timeout: number = 5000
): Promise<ProviderStatus> {
  const cacheKey = `health:${provider}`;

  // 캐시 확인
  const cached = getCachedHealth(cacheKey);
  if (cached) {
    return cached;
  }

  const config = PROVIDERS[provider];
  const startTime = Date.now();

  try {
    // HTTP 요청 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'VideoPlanet-Admin/1.0',
    };

    // API 키 추가 (제공자별 헤더 형식)
    if (config.apiKey) {
      switch (provider) {
        case 'seedance':
          headers['X-API-Key'] = config.apiKey;
          break;
        case 'veo':
          headers['Authorization'] = `Bearer ${config.apiKey}`;
          break;
        case 'imagen':
          headers['Authorization'] = `Bearer ${config.apiKey}`;
          break;
        case 'runway':
          headers['Authorization'] = `Bearer ${config.apiKey}`;
          break;
      }
    }

    // Health Check 요청
    const response = await fetch(config.healthUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;
    let status: ProviderStatus['status'] = 'unknown';
    let successRate = 0;
    let errorMessage: string | undefined;

    // 응답 상태 분석
    if (response.ok) {
      status = 'healthy';
      successRate = 100;

      // 응답 내용 확인 (옵션)
      try {
        const data = await response.json();
        if (data.status === 'degraded') {
          status = 'degraded';
          successRate = 75;
        }
      } catch {
        // JSON 파싱 실패는 무시 (상태만 확인)
      }
    } else {
      status = response.status >= 500 ? 'down' : 'degraded';
      successRate = response.status >= 500 ? 0 : 50;
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }

    const result: ProviderStatus = {
      name: provider,
      status,
      averageLatency: latency,
      successRate,
      lastCheckedAt: new Date(),
      errorMessage,
    };

    // 캐시에 저장
    setCachedHealth(cacheKey, result);

    return result;

  } catch (error) {
    const latency = Date.now() - startTime;
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = `Timeout after ${timeout}ms`;
      } else {
        errorMessage = error.message;
      }
    }

    const result: ProviderStatus = {
      name: provider,
      status: 'down',
      averageLatency: latency,
      successRate: 0,
      lastCheckedAt: new Date(),
      errorMessage,
    };

    // 실패한 결과도 캐시 (짧은 시간)
    setCachedHealth(cacheKey, result);

    logger.warn(`제공자 ${provider} Health Check 실패`, {
      component: 'AdminHealth',
      metadata: {
        provider,
        error: errorMessage,
        latency,
      },
    });

    return result;
  }
}

// ===========================================
// 시스템 전체 Health Check
// ===========================================

async function checkSystemHealth(
  providers: Array<keyof typeof PROVIDERS> = ['seedance', 'veo', 'imagen', 'runway'],
  timeout: number = 5000
): Promise<ProviderStatus[]> {
  // 병렬로 모든 제공자 확인
  const healthChecks = providers.map(provider =>
    checkProviderHealth(provider, timeout)
  );

  const results = await Promise.allSettled(healthChecks);

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Promise가 실패한 경우
      const provider = providers[index];
      logger.error(`제공자 ${provider} Health Check Promise 실패`, result.reason, {
        component: 'AdminHealth',
        metadata: { provider },
      });

      return {
        name: provider,
        status: 'down' as const,
        averageLatency: timeout,
        successRate: 0,
        lastCheckedAt: new Date(),
        errorMessage: 'Health check promise failed',
      };
    }
  });
}

// ===========================================
// 추가 시스템 메트릭
// ===========================================

async function getSystemMetrics() {
  try {
    // 데이터베이스 연결 확인
    const dbHealthStart = Date.now();
    const dbHealth = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health/database`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const dbLatency = Date.now() - dbHealthStart;

    // 메모리 사용량 (Node.js 환경에서만)
    const memoryUsage = process.memoryUsage?.() || {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
    };

    return {
      database: {
        status: dbHealth.ok ? 'healthy' : 'degraded',
        latency: dbLatency,
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      },
      uptime: process.uptime?.() || 0,
    };
  } catch (error) {
    logger.warn('시스템 메트릭 조회 실패', {
      component: 'AdminHealth',
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });

    return {
      database: { status: 'unknown', latency: -1 },
      memory: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 },
      uptime: 0,
    };
  }
}

// ===========================================
// GET: Health Check 조회
// ===========================================

export const GET = withAdminHandler(
  async (request: NextRequest, { admin, createAuditLog }) => {
    // 1. 쿼리 파라미터 검증
    const query = validateQueryParams(request, HealthCheckQuerySchema);

    await createAuditLog(
      'data_access',
      'system_health_checked',
      { type: 'health', id: 'system' },
      {
        providers: query.providers || 'all',
        includeMetrics: query.includeMetrics,
        timeout: query.timeout,
      }
    );

    logger.info('시스템 Health Check 요청', {
      component: 'AdminHealth',
      metadata: {
        adminId: admin.userId,
        providers: query.providers || 'all',
        timeout: query.timeout,
      },
    });

    try {
      // 2. 제공자 상태 확인
      const providersToCheck = query.providers || ['seedance', 'veo', 'imagen', 'runway'];
      const providerHealthPromise = checkSystemHealth(providersToCheck, query.timeout);

      // 3. 시스템 메트릭 조회 (병렬)
      const systemMetricsPromise = query.includeMetrics ? getSystemMetrics() : Promise.resolve(null);

      const [providerHealth, systemMetrics] = await Promise.all([
        providerHealthPromise,
        systemMetricsPromise,
      ]);

      // 4. 전체 시스템 상태 계산
      const healthyProviders = providerHealth.filter(p => p.status === 'healthy').length;
      const totalProviders = providerHealth.length;
      const overallStatus =
        healthyProviders === totalProviders ? 'healthy' :
        healthyProviders > totalProviders / 2 ? 'degraded' : 'down';

      // 5. 응답 구성
      const response = {
        overall: {
          status: overallStatus,
          healthyProviders,
          totalProviders,
          lastCheckedAt: new Date(),
        },
        providers: providerHealth,
        ...(systemMetrics && { system: systemMetrics }),
      };

      logger.info('Health Check 완료', {
        component: 'AdminHealth',
        metadata: {
          adminId: admin.userId,
          overallStatus,
          healthyProviders,
          totalProviders,
          averageLatency: Math.round(
            providerHealth.reduce((sum, p) => sum + p.averageLatency, 0) / providerHealth.length
          ),
        },
      });

      return createAdminSuccessResponse(response, {
        message: 'Health Check가 완료되었습니다.',
      });

    } catch (error) {
      await createAuditLog(
        'security_event',
        'health_check_error',
        { type: 'health', id: 'system' },
        {
          error: error instanceof Error ? error.message : String(error),
          providers: query.providers || 'all',
        }
      );

      throw new AdminApiError(
        'Health Check 중 오류가 발생했습니다.',
        'HEALTH_CHECK_ERROR',
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  },
  {
    endpoint: '/api/admin/health',
    permissions: ['admin.health.read'],
  }
);

// ===========================================
// OPTIONS: CORS 지원
// ===========================================

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}