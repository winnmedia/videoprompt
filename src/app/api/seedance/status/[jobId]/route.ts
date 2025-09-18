import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { seedanceService } from '@/lib/providers/seedance-service';
import {
  createErrorResponse,
  createSuccessResponse
} from '@/shared/schemas/api.schema';
import {
  createUserFriendlyError,
  detectErrorContext,
} from '@/lib/providers/seedance-error-messages';
import { enforceProductionKeyValidation } from '@/lib/providers/production-key-enforcer';
import { withOptionalAuth } from '@/shared/lib/auth-middleware-v2';
import { validateSeedanceConfig, ServiceConfigError } from '@/shared/lib/service-config-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Job ID 검증 스키마
const JobIdSchema = z.string()
  .min(1, 'Job ID가 필요합니다')
  .max(100, 'Job ID가 너무 깁니다')
  .regex(/^[a-zA-Z0-9\-_]+$/, 'Job ID 형식이 올바르지 않습니다');

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

const getHandler = async (
  request: NextRequest,
  { user, degradationMode, adminAccess, isServiceRoleAvailable }: any
) => {
  try {
    // URL에서 jobId 추출
    const url = new URL(request.url);
    const jobId = url.pathname.split('/').pop();
    // 1. 강화된 계약 기반 Seedance 설정 검증
    let configValidation;
    try {
      configValidation = validateSeedanceConfig();
      console.log('✅ Seedance 설정 검증 성공 (Status API):', {
        provider: configValidation.provider,
        environment: configValidation.environment
      });
    } catch (error) {
      if (error instanceof ServiceConfigError) {
        console.error('🚨 Seedance 설정 검증 실패 (Status API):', {
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
            endpoint: '/api/seedance/status'
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

    console.log('DEBUG: Seedance 상태 확인 요청:', {
      jobId,
      userId: user.id || 'guest',
    });

    // Job ID 검증
    const validationResult = JobIdSchema.safeParse(jobId);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues[0];
      console.error('DEBUG: Job ID 검증 실패:', errorDetails);

      return NextResponse.json(
        createErrorResponse('INVALID_JOB_ID', errorDetails.message),
        { status: 400, headers: corsHeaders }
      );
    }

    const validatedJobId = validationResult.data;

    // Graceful Degradation이 적용된 상태 확인
    const result = await seedanceService.getStatus(validatedJobId);

    if (!result.ok) {
      console.error('DEBUG: Seedance 상태 확인 실패:', result.error);

      // 환경별 맞춤 에러 메시지 생성
      const userFriendlyError = createUserFriendlyError(result.error || 'Status check failed');
      const context = detectErrorContext(result.error || '');

      // 에러 컨텍스트에 따른 상태 코드 결정
      let statusCode = 404; // 기본값 (작업을 찾을 수 없음)
      if (context === 'api_key') statusCode = 503;
      else if (context === 'network') statusCode = 502;
      else if (context === 'quota') statusCode = 429;

      return NextResponse.json(
        userFriendlyError,
        { status: statusCode, headers: corsHeaders }
      );
    }

    console.log('DEBUG: Seedance 상태 확인 성공:', {
      jobId: result.jobId,
      status: result.status,
      progress: result.progress,
      source: result.source,
      fallbackUsed: !!result.fallbackReason,
      hasVideoUrl: !!result.videoUrl,
    });

    // 폴백 사용 시 로그
    if (result.fallbackReason) {
      console.warn('⚠️ Graceful degradation으로 상태 확인:', result.fallbackReason);
    }

    // 성공 응답
    const response = createSuccessResponse({
      jobId: result.jobId,
      status: result.status,
      progress: result.progress,
      videoUrl: result.videoUrl,
      dashboardUrl: result.dashboardUrl,
      serviceInfo: {
        source: result.source,
        fallbackUsed: !!result.fallbackReason,
        fallbackReason: result.fallbackReason,
        isProductionReady: result.source === 'real',
      },
      metadata: {
        userId: user.id,
        checkedAt: new Date().toISOString(),
      }
    });

    return NextResponse.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('DEBUG: Seedance 상태 확인 API 예상치 못한 오류:', error);
    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'Seedance 상태 확인 중 서버 오류가 발생했습니다'
      ),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const GET = withOptionalAuth(getHandler, { endpoint: 'seedance-status' });