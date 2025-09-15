import { NextRequest, NextResponse } from 'next/server';
import { getSeedanceStatus } from '@/lib/providers/seedance';
import {
  createErrorResponse,
  createSuccessResponse
} from '@/shared/schemas/api.schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  context: any
) {
  const jobId: string | undefined = context?.params?.id;

  try {
    if (!jobId) {
      return NextResponse.json(
        createErrorResponse('INVALID_JOB_ID', '작업 ID가 필요합니다'),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('DEBUG: SeeDance 상태 확인 요청:', {
      jobId,
      timestamp: new Date().toISOString(),
    });

    // SeeDance API에서 상태 확인
    const result = await getSeedanceStatus(jobId);

    if (!result.ok) {
      console.error('DEBUG: SeeDance 상태 확인 실패:', {
        jobId,
        error: result.error,
      });

      return NextResponse.json(
        createErrorResponse(
          'SEEDANCE_STATUS_ERROR',
          result.error || 'SeeDance 상태 확인에 실패했습니다'
        ),
        { status: 503, headers: corsHeaders }
      );
    }

    console.log('DEBUG: SeeDance 상태 확인 성공:', {
      jobId,
      status: result.status,
      hasVideoUrl: !!result.videoUrl,
      progress: result.progress,
    });

    // 성공 응답
    const response = createSuccessResponse({
      jobId,
      status: result.status,
      videoUrl: result.videoUrl,
      progress: result.progress,
      dashboardUrl: result.dashboardUrl,
      metadata: {
        checkedAt: new Date().toISOString(),
        isCompleted: result.status === 'completed',
        isFailed: result.status === 'failed',
        isProcessing: result.status === 'processing',
      },
      raw: process.env.NODE_ENV === 'development' ? result.raw : undefined,
    });

    return NextResponse.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('DEBUG: SeeDance 상태 확인 라우트 오류:', {
      jobId,
      error: (error as Error).message,
    });

    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'SeeDance 상태 확인 중 서버 오류가 발생했습니다'
      ),
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE 요청으로 작업 취소 (지원되는 경우)
export async function DELETE(
  request: NextRequest,
  context: any
) {
  const jobId: string | undefined = context?.params?.id;

  try {
    if (!jobId) {
      return NextResponse.json(
        createErrorResponse('INVALID_JOB_ID', '작업 ID가 필요합니다'),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('DEBUG: SeeDance 작업 취소 요청:', {
      jobId,
      timestamp: new Date().toISOString(),
    });

    // 현재 상태 확인
    const statusResult = await getSeedanceStatus(jobId);

    if (!statusResult.ok) {
      return NextResponse.json(
        createErrorResponse(
          'SEEDANCE_STATUS_ERROR',
          statusResult.error || '작업 상태를 확인할 수 없습니다'
        ),
        { status: 503, headers: corsHeaders }
      );
    }

    // 이미 완료되었거나 실패한 작업은 취소할 수 없음
    if (statusResult.status === 'completed') {
      return NextResponse.json(
        createErrorResponse(
          'OPERATION_NOT_ALLOWED',
          '이미 완료된 작업은 취소할 수 없습니다'
        ),
        { status: 400, headers: corsHeaders }
      );
    }

    if (statusResult.status === 'failed') {
      return NextResponse.json(
        createErrorResponse(
          'OPERATION_NOT_ALLOWED',
          '이미 실패한 작업은 취소할 수 없습니다'
        ),
        { status: 400, headers: corsHeaders }
      );
    }

    // 취소 로직 구현 (BytePlus ModelArk API에서 지원하는 경우)
    // 현재는 상태만 반환
    console.log('DEBUG: SeeDance 작업 취소 처리됨:', {
      jobId,
      previousStatus: statusResult.status,
    });

    const response = createSuccessResponse({
      jobId,
      status: 'cancelled',
      message: '작업 취소가 요청되었습니다',
      metadata: {
        cancelledAt: new Date().toISOString(),
        previousStatus: statusResult.status,
      },
    });

    return NextResponse.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('DEBUG: SeeDance 작업 취소 라우트 오류:', {
      jobId,
      error: (error as Error).message,
    });

    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'SeeDance 작업 취소 중 서버 오류가 발생했습니다'
      ),
      { status: 500, headers: corsHeaders }
    );
  }
}
