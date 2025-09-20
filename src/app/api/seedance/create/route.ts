import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/shared/lib/logger';
import {


  createSeedanceVideo,
  type SeedanceCreatePayload} from '@/lib/providers/seedance';
import { getSeedanceProvider } from '@/lib/providers/mock-seedance';
import { seedanceService, createSeedanceVideoWithFallback } from '@/lib/providers/seedance-service';
import {
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse
} from '@/shared/schemas/api.schema';
import {
  createUserFriendlyError,
  detectErrorContext,
  getCurrentEnvironment,
  getErrorMessage
} from '@/lib/providers/seedance-error-messages';
import { withOptionalAuth } from '@/shared/lib/auth-middleware-v2';
import { withErrorHandling } from '@/shared/lib/api-error-handler';
import { envUtils } from '@/shared/config/env';
import { validateSeedanceConfig, ServiceConfigError } from '@/shared/lib/service-config-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 중복된 키 검증 함수 제거됨 - validateSeedanceConfig()를 사용함

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Zod 스키마 정의
const SeedanceCreateSchema = z.object({
  prompt: z.string()
    .min(1, '프롬프트를 입력해주세요')
    .max(1000, '프롬프트는 1000자 이하로 입력해주세요'),

  // 영상 생성 옵션
  aspect_ratio: z.enum(['16:9', '9:16', '1:1', '4:3', '3:4']).default('16:9'),
  duration_seconds: z.number().int().min(1).max(30).default(8),
  quality: z.enum(['standard', 'pro']).default('standard'),
  seed: z.number().int().optional(),

  // 모델 선택
  model: z.string().optional(),

  // 이미지 to 비디오 변환용
  image_url: z.string().url().optional(),

  // 웹훅 URL (비동기 처리용)
  webhook_url: z.string().url().optional(),

  // 메타데이터
  user_id: z.string().optional(),
  project_id: z.string().uuid().optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

const postHandler = async (request: NextRequest, { user, authContext }: { user: { id: string | null }, authContext: any }) => {
  try {
    // 1. 강화된 계약 기반 Seedance 설정 검증
    let configValidation;
    try {
      configValidation = validateSeedanceConfig();
      logger.info('✅ Seedance 설정 검증 성공:', {
        provider: configValidation.provider,
        environment: configValidation.environment
      });
    } catch (error) {
      if (error instanceof ServiceConfigError) {
        console.error('🚨 Seedance 설정 검증 실패:', {
          code: error.errorCode,
          message: error.message
        });

        // ServiceConfigError를 그대로 응답으로 변환
        return NextResponse.json({
          success: false,
          error: {
            code: error.errorCode,
            message: error.message,
            httpStatus: error.httpStatus,
            setupGuide: error.setupGuide,
            keyAnalysis: error.keyAnalysis,
            timestamp: new Date().toISOString(),
            endpoint: '/api/seedance/create'
          }
        }, {
          status: error.httpStatus,
          headers: corsHeaders
        });
      } else {
        // 예상치 못한 에러
        throw error;
      }
    }

    const body = await request.json();

    logger.info('DEBUG: SeeDance 영상 생성 요청 수신:', {
      hasPrompt: !!body.prompt,
      promptLength: body.prompt?.length || 0,
      aspectRatio: body.aspect_ratio,
      duration: body.duration_seconds,
      hasImageUrl: !!body.image_url,
    });

    // 2. 입력 데이터 검증
    const validationResult = SeedanceCreateSchema.safeParse(body);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));

      const primaryError = errorDetails[0];
      console.error('DEBUG: SeeDance 입력 검증 실패:', errorDetails);
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', primaryError ? primaryError.message : '입력 데이터가 올바르지 않습니다'),
        { status: 400, headers: corsHeaders }
      );
    }

    const data = validationResult.data;

    // 사용자 인증 정보 사용 (옵셔널 인증)
    const userId = user.id;
    logger.info('DEBUG: SeeDance 사용자 정보:', { userId: userId || 'guest' });

    // SeeDance API 호출 준비
    const payload: SeedanceCreatePayload = {
      prompt: data.prompt,
      aspect_ratio: data.aspect_ratio,
      duration_seconds: data.duration_seconds,
      quality: data.quality,
      seed: data.seed,
      model: data.model,
      image_url: data.image_url,
      webhook_url: data.webhook_url,
    };

    logger.info('DEBUG: SeeDance API 호출 시작:', {
      mode: data.image_url ? 'image-to-video' : 'text-to-video',
      duration: data.duration_seconds,
      aspectRatio: data.aspect_ratio,
      quality: data.quality,
    });

    // Graceful Degradation이 적용된 영상 생성
    let result;
    try {
      result = await seedanceService.createVideo(payload);
    } catch (error: any) {
      console.error('❌ Seedance 영상 생성 중 예외 발생:', error);

      // 환경별 맞춤 에러 메시지 생성
      const userFriendlyError = createUserFriendlyError(error);
      const context = detectErrorContext(error);
      const environment = getCurrentEnvironment();

      // API 키 관련 에러는 503으로 처리
      if (context === 'api_key') {
        return NextResponse.json(
          userFriendlyError,
          { status: 503, headers: corsHeaders }
        );
      }

      // 검증 에러는 400으로 처리
      if (context === 'validation') {
        return NextResponse.json(
          userFriendlyError,
          { status: 400, headers: corsHeaders }
        );
      }

      // 할당량 에러는 429로 처리
      if (context === 'quota') {
        return NextResponse.json(
          userFriendlyError,
          { status: 429, headers: corsHeaders }
        );
      }

      // 기타 에러는 500으로 처리
      return NextResponse.json(
        userFriendlyError,
        { status: 500, headers: corsHeaders }
      );
    }

    if (!result.ok) {
      console.error('DEBUG: SeeDance API 호출 실패:', result.error);

      // 결과 에러도 환경별 맞춤 메시지로 처리
      const userFriendlyError = createUserFriendlyError(result.error || 'Unknown error');
      const context = detectErrorContext(result.error || '');

      // 에러 컨텍스트에 따른 상태 코드 결정
      let statusCode = 503; // 기본값
      if (context === 'validation') statusCode = 400;
      else if (context === 'quota') statusCode = 429;
      else if (context === 'api_key') statusCode = 503;
      else if (context === 'model') statusCode = 422;

      return NextResponse.json(
        userFriendlyError,
        { status: statusCode, headers: corsHeaders }
      );
    }

    logger.info('DEBUG: SeeDance API 호출 성공:', {
      jobId: result.jobId,
      status: result.status,
      source: result.source,
      fallbackUsed: !!result.fallbackReason,
      circuitBreakerTriggered: result.circuitBreakerTriggered,
      dashboardUrl: result.dashboardUrl,
    });

    // 폴백 사용 시 사용자에게 알림
    if (result.fallbackReason) {
      console.warn('⚠️ Graceful degradation 작동:', result.fallbackReason);
    }

    // 성공 응답
    const response = createSuccessResponse({
      jobId: result.jobId,
      status: result.status,
      dashboardUrl: result.dashboardUrl,
      serviceInfo: {
        source: result.source,
        fallbackUsed: !!result.fallbackReason,
        fallbackReason: result.fallbackReason,
        circuitBreakerTriggered: result.circuitBreakerTriggered,
        isProductionReady: result.source === 'real',
      },
      metadata: {
        userId,
        projectId: data.project_id,
        prompt: data.prompt,
        duration: data.duration_seconds,
        aspectRatio: data.aspect_ratio,
        quality: data.quality,
        mode: data.image_url ? 'image-to-video' : 'text-to-video',
        requestedAt: new Date().toISOString(),
      }
    });

    return NextResponse.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('DEBUG: SeeDance API 라우트 예상치 못한 오류:', error);
    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'SeeDance 영상 생성 중 서버 오류가 발생했습니다'
      ),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const POST = withErrorHandling(
  withOptionalAuth(postHandler, { endpoint: 'seedance-create' }),
  { endpoint: '/api/seedance/create', requireSupabase: false, serviceName: 'seedance-create' }
);

// GET 요청으로 서비스 상태 확인 (통합된 환경변수 검증 사용)
export const GET = withErrorHandling(async () => {
  try {
    // 통합된 환경변수 시스템 사용
    const apiKey = envUtils.optional('SEEDANCE_API_KEY');
    const model = envUtils.optional('SEEDANCE_MODEL', 'default-model');
    const apiBase = envUtils.optional('SEEDANCE_API_BASE', 'https://ark.ap-southeast.bytepluses.com');

    const status = {
      service: 'SeeDance Video Generation',
      status: apiKey ? 'operational' : 'configuration_error',
      configuration: {
        hasApiKey: !!apiKey,
        keyLength: apiKey ? apiKey.length : 0,
        hasModel: !!model,
        hasApiBase: !!apiBase,
        model: model || 'not configured',
        apiBase: apiBase || 'using default',
        environmentValidation: {
          passed: !!apiKey && apiKey.length >= 40,
          minimumKeyLength: 40,
          currentKeyLength: apiKey ? apiKey.length : 0
        }
      },
      capabilities: {
        textToVideo: true,
        imageToVideo: true,
        customDuration: true,
        customAspectRatio: true,
        qualityControl: true,
        webhookSupport: true,
        maxDuration: 30,
        supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
        supportedQualities: ['standard', 'pro'],
      },
      pricing: {
        standard: '$0.05 per second',
        pro: '$0.10 per second',
        freeQuota: '100 seconds for new users',
      },
      setup: !apiKey ? {
        step: '환경설정 필요',
        requiredEnvVars: ['SEEDANCE_API_KEY'],
        detailed_instructions: {
          'step_1_get_key': {
            title: '🔑 API 키 발급받기',
            steps: [
              'BytePlus ModelArk 콘솔 접속: https://console.volcengine.com/ark',
              '계정 생성/로그인 → API Key 메뉴로 이동',
              '"Create API Key" 버튼 클릭',
              '생성된 키는 "ark_" 로 시작하는 40자 이상의 문자열입니다'
            ]
          },
          'step_2_set_env': {
            title: '⚙️ 환경변수 설정',
            platforms: {
              vercel: 'Vercel → Settings → Environment Variables → SEEDANCE_API_KEY 추가',
              railway: 'Railway → Variables → New Variable → SEEDANCE_API_KEY 추가',
              local: '.env.local 파일에 SEEDANCE_API_KEY=ark_your_key_here 추가'
            }
          }
        },
        helpUrl: 'https://docs.bytedance.com/modelark'
      } : undefined
    };

    return NextResponse.json(status, { headers: corsHeaders });

  } catch (error) {
    console.error('SeeDance 상태 확인 오류:', error);
    return NextResponse.json({
      service: 'SeeDance Video Generation',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500, headers: corsHeaders });
  }
}, { endpoint: '/api/seedance/create', requireSupabase: false, serviceName: 'seedance-status' });
