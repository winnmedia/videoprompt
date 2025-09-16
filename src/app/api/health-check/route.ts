import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

async function checkSupabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // 간단한 Supabase 연결 테스트
    const { data, error } = await supabase
      .from('_health_check')
      .select('count(*)')
      .limit(1);

    const latency = Date.now() - startTime;

    if (error && error.code !== 'PGRST116') {
      // PGRST116은 테이블이 존재하지 않음을 의미하지만 연결은 정상
      throw error;
    }

    return {
      service: 'supabase',
      status: 'healthy',
      details: 'Database connection successful',
      latency,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: 'supabase',
      status: 'unhealthy',
      details: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkEnvironmentVariables(): Promise<HealthCheckResult> {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
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
    const [supabaseHealth, envHealth, aiHealth] = await Promise.all([
      checkSupabaseHealth(),
      checkEnvironmentVariables(),
      checkAIServices()
    ]);

    const services = [supabaseHealth, envHealth, aiHealth];

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