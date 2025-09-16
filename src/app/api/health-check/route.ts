import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseConnection, prisma } from '@/lib/db';

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
    // Prisma 데이터베이스 연결 테스트
    const result = await checkDatabaseConnection(prisma);

    if (result.success) {
      return {
        service: 'database',
        status: 'healthy',
        details: 'Railway PostgreSQL connection successful',
        latency: result.latency,
        timestamp: new Date().toISOString()
      };
    } else {
      throw new Error(result.error || 'Database connection failed');
    }
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      details: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkEnvironmentVariables(): Promise<HealthCheckResult> {
  const requiredVars = [
    'DATABASE_URL',
    'GOOGLE_GEMINI_API_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length === 0) {
    return {
      service: 'environment',
      status: 'healthy',
      details: 'All required environment variables are set',
      timestamp: new Date().toISOString()
    };
  } else {
    return {
      service: 'environment',
      status: 'unhealthy',
      details: `Missing variables: ${missingVars.join(', ')}`,
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