import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createValidationErrorResponse,
  createErrorResponse
} from '@/shared/schemas/api.schema';
import {
  createSuccessResponse,
  createErrorResponse as createPlanningErrorResponse,
  DualStorageResult
} from '@/shared/schemas/planning-response.schema';
import { withOptionalAuth } from '@/shared/lib/auth-middleware-v2';
import { getPlanningRepository } from '@/entities/planning';
import { type VideoContent } from '@/entities/planning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VideoRequestSchema = z.object({
  title: z.string().min(1),
  provider: z.enum(['seedance', 'veo3', 'mock']).or(z.string()),
  status: z.enum(['queued', 'processing', 'completed', 'failed']).or(z.string()),
  url: z.string().url().nullable().optional(),
  codec: z.string().nullable().optional(),
  duration: z.number().int().nullable().optional(),
  prompt: z.string().optional(),
});

const getHandler = async (req: NextRequest, { user }: { user: { id: string | null } }) => {
  try {
    // Repository 호출
    const repository = getPlanningRepository();
    const allContent = await repository.findByUserId(user.id || 'guest');

    // video 타입만 필터링
    const videos = allContent
      .filter(content => content.type === 'video')
      .map(content => {
        const video = content as VideoContent;
        return {
          id: video.id,
          title: video.title || 'Untitled Video',
          provider: (video as any).provider || 'unknown',
          status: (video as any).status || 'queued',
          url: video.videoUrl || null,
          codec: (video as any).codec || null,
          duration: (video as any).duration || null,
          prompt: (video as any).prompt || '',
          createdAt: (video as any).createdAt,
          updatedAt: (video as any).updatedAt
        };
      });

    const healthStatus = await repository.getStorageHealth();
    const dualStorageResult: DualStorageResult = {
      id: 'videos-query',
      success: true,
      prismaSuccess: healthStatus.prisma.status === 'healthy',
      supabaseSuccess: healthStatus.supabase.status === 'healthy'
    };

    return NextResponse.json(
      createSuccessResponse({ videos }, dualStorageResult)
    );

  } catch (error) {
    const dualStorageResult: DualStorageResult = {
      id: 'videos-query-error',
      success: false,
      error: error instanceof Error ? error.message : '비디오 조회 중 오류 발생'
    };

    return NextResponse.json(
      createPlanningErrorResponse('비디오 조회 중 오류가 발생했습니다.', dualStorageResult),
      { status: 500 }
    );
  }
};

const postHandler = async (req: NextRequest, { user }: { user: { id: string | null } }) => {
  try {
    // 입력 검증
    const body = await req.json();
    const validationResult = VideoRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error),
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // VideoContent로 변환
    const videoContent: VideoContent = {
      id: crypto.randomUUID(),
      type: 'video',
      status: 'draft',
      storageStatus: 'pending',
      title: validatedData.title,
      videoUrl: validatedData.url || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        version: 1,
        author: user.id || 'guest'
      }
    };

    // Repository 호출
    const repository = getPlanningRepository();
    const result = await repository.save(videoContent);

    if (!result.success) {
      const dualStorageResult: DualStorageResult = {
        id: videoContent.id,
        success: false,
        error: result.error
      };

      return NextResponse.json(
        createPlanningErrorResponse('비디오 생성 중 오류가 발생했습니다.', dualStorageResult),
        { status: 500 }
      );
    }

    const healthStatus = await repository.getStorageHealth();
    const dualStorageResult: DualStorageResult = {
      id: result.id,
      success: true,
      prismaSuccess: healthStatus.prisma.status === 'healthy',
      supabaseSuccess: healthStatus.supabase.status === 'healthy'
    };

    const responseData = {
      id: result.id,
      title: videoContent.title,
      provider: (videoContent as any).provider,
      status: (videoContent as any).status,
      url: videoContent.videoUrl
    };

    return NextResponse.json(
      createSuccessResponse(responseData, dualStorageResult),
      { status: 201 }
    );

  } catch (error) {
    const dualStorageResult: DualStorageResult = {
      id: 'unknown-video',
      success: false,
      error: error instanceof Error ? error.message : '비디오 생성 중 오류 발생'
    };

    return NextResponse.json(
      createPlanningErrorResponse('비디오 생성 중 오류가 발생했습니다.', dualStorageResult),
      { status: 500 }
    );
  }
};

export const GET = withOptionalAuth(getHandler, { endpoint: 'planning-videos-get', allowGuest: true });
export const POST = withOptionalAuth(postHandler, { endpoint: 'planning-videos-post', allowGuest: false });

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
