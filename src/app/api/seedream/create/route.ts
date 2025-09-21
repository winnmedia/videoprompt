import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/shared/lib/logger';
import {


  createSeedreamImage,
  generateSingleImage,
  generateBatchImages,
  editImage,
  type SeedreamCreatePayload} from '@/lib/providers/seedream';
import {
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse
} from '@/shared/schemas/api.schema';
import { getUserIdFromRequest } from '@/shared/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Zod 스키마 정의
const SeedreamCreateSchema = z.object({
  prompt: z.string()
    .min(1, '프롬프트를 입력해주세요')
    .max(1000, '프롬프트는 1000자 이하로 입력해주세요'),

  // 이미지 편집용
  image_url: z.string().url().optional(),
  strength: z.number().min(0).max(1).optional(),

  // 생성 옵션
  batch_size: z.number().int().min(1).max(9).default(1),
  aspect_ratio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']).default('1:1'),
  style: z.string().optional(),
  seed: z.number().int().optional(),

  // 참조 이미지들 (최대 6개)
  reference_images: z.array(z.string().url()).max(6).optional(),

  // 메타데이터
  user_id: z.string().optional(),
  project_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    logger.info('DEBUG: SeeDream 이미지 생성 요청 수신:', {
      hasPrompt: !!body.prompt,
      promptLength: body.prompt?.length || 0,
      batchSize: body.batch_size || 1,
      hasImageUrl: !!body.image_url,
      referenceCount: body.reference_images?.length || 0,
    });

    // 입력 데이터 검증
    const validationResult = SeedreamCreateSchema.safeParse(body);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));

      const primaryError = errorDetails[0];
      logger.debug('DEBUG: SeeDream 입력 검증 실패:', errorDetails);
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', primaryError ? primaryError.message : '입력 데이터가 올바르지 않습니다'),
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 사용자 인증 (선택적)
    let userId: string | null = null;
    try {
      const user = await getUserIdFromRequest(request);
      userId = user || null;
    } catch (authError) {
      logger.info('DEBUG: SeeDream 인증 실패 (계속 진행):', authError);
      // 인증 실패해도 계속 진행 (익명 사용자 허용)
    }

    // SeeDream API 호출 준비
    const payload: SeedreamCreatePayload = {
      prompt: data.prompt,
      image_url: data.image_url,
      strength: data.strength,
      batch_size: data.batch_size,
      aspect_ratio: data.aspect_ratio,
      style: data.style,
      seed: data.seed,
      reference_images: data.reference_images,
    };

    logger.info('DEBUG: SeeDream API 호출 시작:', {
      mode: data.image_url ? 'edit' : 'generate',
      batchSize: data.batch_size,
      aspectRatio: data.aspect_ratio,
    });

    // SeeDream API 호출
    let result;
    if (data.image_url) {
      // 이미지 편집 모드
      result = await editImage(
        data.prompt,
        data.image_url,
        data.strength || 0.5,
        payload
      );
    } else if (data.batch_size > 1) {
      // 배치 생성 모드
      result = await generateBatchImages(
        data.prompt,
        data.batch_size,
        payload
      );
    } else {
      // 단일 이미지 생성 모드
      result = await generateSingleImage(data.prompt, payload);
    }

    if (!result.ok) {
      logger.debug('DEBUG: SeeDream API 호출 실패:', result.error);
      return NextResponse.json(
        createErrorResponse('SEEDREAM_GENERATION_ERROR', result.error || 'SeeDream 이미지 생성에 실패했습니다'),
        { status: 503 }
      );
    }

    logger.info('DEBUG: SeeDream API 호출 성공:', {
      jobId: result.jobId,
      status: result.status,
      imageCount: result.images?.length || 0,
    });

    // 성공 응답
    const response = createSuccessResponse({
      jobId: result.jobId,
      status: result.status,
      images: result.images,
      dashboardUrl: result.dashboardUrl,
      metadata: {
        userId,
        projectId: data.project_id,
        prompt: data.prompt,
        batchSize: data.batch_size,
        aspectRatio: data.aspect_ratio,
        mode: data.image_url ? 'edit' : 'generate',
        requestedAt: new Date().toISOString(),
      }
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('DEBUG: SeeDream API 라우트 예상치 못한 오류:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'SeeDream 이미지 생성 중 서버 오류가 발생했습니다'
      ),
      { status: 500 }
    );
  }
}

// GET 요청으로 서비스 상태 확인
export async function GET() {
  try {
    // 환경 변수 확인
    const apiKey = process.env.SEEDREAM_API_KEY || process.env.MODELARK_API_KEY;
    const model = process.env.SEEDREAM_MODEL;
    const apiBase = process.env.SEEDREAM_API_BASE;

    const status = {
      service: 'SeeDream 4.0 Image Generation',
      status: 'operational',
      configuration: {
        hasApiKey: !!apiKey,
        hasModel: !!model,
        hasApiBase: !!apiBase,
        model: model || 'not configured',
        apiBase: apiBase || 'using default',
      },
      capabilities: {
        singleImageGeneration: true,
        batchGeneration: true,
        imageEditing: true,
        referenceImages: true,
        maxBatchSize: 9,
        maxReferenceImages: 6,
        supportedAspectRatios: ['1:1', '16:9', '9:16', '3:4', '4:3'],
      },
      pricing: {
        costPerImage: '$0.03',
        freeQuota: '200 images for new users',
      }
    };

    if (!apiKey) {
      status.status = 'configuration_error';
    }

    return NextResponse.json(status);

  } catch (error) {
    logger.error('SeeDream 상태 확인 오류:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({
      service: 'SeeDream 4.0 Image Generation',
      status: 'error',
      error: (error as Error).message,
    }, { status: 500 });
  }
}