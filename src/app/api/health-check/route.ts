import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/shared/lib/supabase-client';
import { logger } from '@/shared/lib/logger';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  details?: string;
  latency?: number;
  timestamp: string;
}

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: HealthCheckResult[];
  environment: string;
  version?: string;
}

async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // 안전한 Supabase 클라이언트 가져오기
    logger.info('🔍 Supabase 데이터베이스 연결 테스트 시작...');

    const supabaseResult = await getSupabaseClient({
      throwOnError: false,
      useCircuitBreaker: true,
      serviceName: 'health-check'
    });

    if (!supabaseResult.client || !supabaseResult.canProceed) {
      const latency = Date.now() - startTime;
      logger.debug('⚠️ Supabase 클라이언트 생성 실패:', supabaseResult.error);

      return {
        service: 'database',
        status: 'warning',
        details: `Supabase unavailable: ${supabaseResult.error} (degradation mode: ${supabaseResult.degradationMode})`,
        latency,
        timestamp: new Date().toISOString()
      };
    }

    const supabase = supabaseResult.client;

    // Auth 테이블 존재 여부 확인
    const authTables = ['User', 'RefreshToken', 'EmailVerification', 'PasswordReset'];
    let existingTables = 0;

    for (const tableName of authTables) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);

        if (!error) {
          existingTables++;
        }
      } catch (tableError) {
        logger.debug(`⚠️ 테이블 ${tableName} 확인 실패:`, tableError);
      }
    }

    const latency = Date.now() - startTime;

    if (existingTables === authTables.length) {
      logger.info(`✅ Supabase 연결 성공 - 모든 Auth 테이블 확인됨 (${latency}ms)`);
      return {
        service: 'database',
        status: 'healthy',
        details: `Supabase connection successful - ${existingTables}/${authTables.length} auth tables found`,
        latency,
        timestamp: new Date().toISOString()
      };
    } else if (existingTables > 0) {
      logger.info(`⚠️ Supabase 연결됨 - 일부 테이블 누락 (${existingTables}/${authTables.length})`);
      return {
        service: 'database',
        status: 'warning',
        details: `Supabase connected but incomplete schema - ${existingTables}/${authTables.length} auth tables found`,
        latency,
        timestamp: new Date().toISOString()
      };
    } else {
      logger.info(`❌ Supabase 연결됨 - Auth 테이블 없음 (${latency}ms)`);
      return {
        service: 'database',
        status: 'warning',
        details: 'Supabase connected but no auth tables found - migration required',
        latency,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.error('❌ Supabase 연결 실패:', error instanceof Error ? error : new Error(String(error)));

    return {
      service: 'database',
      status: 'warning',
      details: `Supabase connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latency,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkEnvironmentVariables(): Promise<HealthCheckResult> {
  const requiredVars = [
    'GOOGLE_GEMINI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];

  const optionalVars = [
    'DATABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  const missingOptionalVars = optionalVars.filter(varName => !process.env[varName]);

  if (missingVars.length === 0) {
    let details = 'All required environment variables are set (Supabase + AI)';
    if (missingOptionalVars.length > 0) {
      details += ` (optional missing: ${missingOptionalVars.join(', ')})`;
    }

    return {
      service: 'environment',
      status: 'healthy',
      details,
      timestamp: new Date().toISOString()
    };
  } else {
    return {
      service: 'environment',
      status: 'unhealthy',
      details: `Missing required variables: ${missingVars.join(', ')}`,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkAIServices(): Promise<HealthCheckResult> {
  const hasGeminiKey = !!(process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  if (hasGeminiKey || hasOpenAIKey) {
    const details = [];
    if (hasGeminiKey) details.push('Gemini API key configured');
    if (hasOpenAIKey) details.push('OpenAI API key configured');

    return {
      service: 'ai_services',
      status: 'healthy',
      details: details.join(', '),
      timestamp: new Date().toISOString()
    };
  } else {
    return {
      service: 'ai_services',
      status: 'unhealthy',
      details: 'No AI API keys configured',
      timestamp: new Date().toISOString()
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // 모든 헬스체크 병렬 실행
    const [databaseHealth, envHealth, aiHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkEnvironmentVariables(),
      checkAIServices()
    ]);

    const services = [databaseHealth, envHealth, aiHealth];

    // 전체 상태 결정
    const hasUnhealthy = services.some(s => s.status === 'unhealthy');
    const hasWarning = services.some(s => s.status === 'warning');

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasWarning) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'unknown'
    };

    const statusCode = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: [{
        service: 'health_check',
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString()
      }],
      environment: process.env.NODE_ENV || 'unknown'
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}