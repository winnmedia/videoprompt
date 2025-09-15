import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createSeedanceVideo,
  type SeedanceCreatePayload
} from '@/lib/providers/seedance';
import {
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse
} from '@/shared/schemas/api.schema';
import { getUserIdFromRequest } from '@/shared/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('DEBUG: SeeDance 영상 생성 요청 수신:', {
      hasPrompt: !!body.prompt,
      promptLength: body.prompt?.length || 0,
      aspectRatio: body.aspect_ratio,
      duration: body.duration_seconds,
      hasImageUrl: !!body.image_url,
    });

    // 입력 데이터 검증
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

    // 사용자 인증 (선택적)
    let userId: string | null = null;
    try {
      const user = await getUserIdFromRequest(request);
      userId = user || null;
    } catch (authError) {
      console.log('DEBUG: SeeDance 인증 실패 (계속 진행):', authError);
      // 인증 실패해도 계속 진행 (익명 사용자 허용)
    }

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

    console.log('DEBUG: SeeDance API 호출 시작:', {
      mode: data.image_url ? 'image-to-video' : 'text-to-video',
      duration: data.duration_seconds,
      aspectRatio: data.aspect_ratio,
      quality: data.quality,
    });

    // SeeDance API 호출
    const result = await createSeedanceVideo(payload);

    if (!result.ok) {
      console.error('DEBUG: SeeDance API 호출 실패:', result.error);
      return NextResponse.json(
        createErrorResponse('SEEDANCE_GENERATION_ERROR', result.error || 'SeeDance 영상 생성에 실패했습니다'),
        { status: 503, headers: corsHeaders }
      );
    }

    console.log('DEBUG: SeeDance API 호출 성공:', {
      jobId: result.jobId,
      status: result.status,
      dashboardUrl: result.dashboardUrl,
    });

    // 성공 응답
    const response = createSuccessResponse({
      jobId: result.jobId,
      status: result.status,
      dashboardUrl: result.dashboardUrl,
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
}

// GET 요청으로 서비스 상태 확인
export async function GET() {
  try {
    // 환경 변수 확인
    const apiKey = process.env.SEEDANCE_API_KEY || process.env.MODELARK_API_KEY;
    const model = process.env.SEEDANCE_MODEL;
    const apiBase = process.env.SEEDANCE_API_BASE;

    const status = {
      service: 'SeeDance Video Generation',
      status: 'operational',
      configuration: {
        hasApiKey: !!apiKey,
        hasModel: !!model,
        hasApiBase: !!apiBase,
        model: model || 'not configured',
        apiBase: apiBase || 'using default',
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
      }
    };

    if (!apiKey) {
      status.status = 'configuration_error';
    }

    return NextResponse.json(status, { headers: corsHeaders });

  } catch (error) {
    console.error('SeeDance 상태 확인 오류:', error);
    return NextResponse.json({
      service: 'SeeDance Video Generation',
      status: 'error',
      error: (error as Error).message,
    }, { status: 500, headers: corsHeaders });
  }
}
