import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';

// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { getUser } from '@/shared/lib/auth';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { z } from 'zod';

export const runtime = 'nodejs';

// Update project schema
const UpdateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  scenario: z.object({
    title: z.string().optional(),
    story: z.string().optional(),
    genre: z.string().optional(),
    tone: z.union([z.string(), z.array(z.string())]).optional(),
    target: z.string().optional(),
    structure: z.array(z.string()).optional(),
    format: z.string().optional(),
    tempo: z.string().optional(),
    developmentMethod: z.string().optional(),
    developmentIntensity: z.string().optional(),
    durationSec: z.number().optional(),
  }).optional(),
  prompt: z.object({
    finalPrompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    visualStyle: z.string().optional(),
    mood: z.string().optional(),
    quality: z.string().optional(),
    directorStyle: z.string().optional(),
  }).optional(),
  video: z.object({
    provider: z.enum(['seedance', 'veo3', 'mock']).optional(),
    jobId: z.string().optional(),
    operationId: z.string().optional(),
    videoUrl: z.string().optional(),
    status: z.enum(['queued', 'processing', 'pending', 'succeeded', 'failed']).optional(),
  }).optional(),
  status: z.enum(['draft', 'processing', 'completed', 'failed']).optional(),
});

// CORS headers
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Get single project
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const traceId = getTraceId(req);
  const { id } = await params;
  logger.info(`[Project ${traceId}] 📋 프로젝트 상세 조회: ${id}`);

  try {
    // Check authentication
    const user = await getUser(req);
    if (!user) {
      return failure('UNAUTHORIZED', '로그인이 필요합니다.', 401, undefined, traceId);
    }

    // Find project
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        metadata: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!project) {
      return failure('NOT_FOUND', '프로젝트를 찾을 수 없습니다.', 404, undefined, traceId);
    }

    logger.info(`[Project ${traceId}] ✅ 프로젝트 조회 완료`);

    // Prisma automatically handles JSON fields
    const response = project;

    return success(response, 200, traceId);

  } catch (error: any) {
    console.error(`[Project ${traceId}] ❌ 프로젝트 조회 실패:`, error);
    return failure('INTERNAL_ERROR', '프로젝트 조회 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}

// Update project
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const traceId = getTraceId(req);
  const { id } = await params;
  logger.info(`[Project ${traceId}] 🔄 프로젝트 수정: ${id}`);

  try {
    // Check authentication
    const user = await getUser(req);
    if (!user) {
      return failure('UNAUTHORIZED', '로그인이 필요합니다.', 401, undefined, traceId);
    }

    // Parse and validate request
    const body = await req.json();
    const validatedData = UpdateProjectSchema.parse(body);

    logger.info(`[Project ${traceId}] ✅ 입력 데이터 검증 완료`);

    // Check if project exists and belongs to user
    const existingProject = await prisma.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingProject) {
      return failure('NOT_FOUND', '프로젝트를 찾을 수 없습니다.', 404, undefined, traceId);
    }

    // Update project
    const updateData: any = {};
    
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.scenario !== undefined) updateData.scenario = JSON.stringify(validatedData.scenario);
    if (validatedData.prompt !== undefined) updateData.prompt = JSON.stringify(validatedData.prompt);
    if (validatedData.video !== undefined) updateData.video = JSON.stringify(validatedData.video);
    if (validatedData.status !== undefined) updateData.status = validatedData.status;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        description: true,
        metadata: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info(`[Project ${traceId}] ✅ 프로젝트 수정 완료`);

    // Prisma automatically handles JSON fields
    const response = project;

    return success(response, 200, traceId);

  } catch (error: any) {
    console.error(`[Project ${traceId}] ❌ 프로젝트 수정 실패:`, error);

    if (error instanceof z.ZodError) {
      return failure('VALIDATION_ERROR', '입력 데이터가 올바르지 않습니다.', 400, JSON.stringify({ errors: error.issues }), traceId);
    }

    return failure('INTERNAL_ERROR', '프로젝트 수정 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}

// Delete project
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const traceId = getTraceId(req);
  const { id } = await params;
  logger.info(`[Project ${traceId}] 🗑️ 프로젝트 삭제: ${id}`);

  try {
    // Check authentication
    const user = await getUser(req);
    if (!user) {
      return failure('UNAUTHORIZED', '로그인이 필요합니다.', 401, undefined, traceId);
    }

    // Check if project exists and belongs to user
    const existingProject = await prisma.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingProject) {
      return failure('NOT_FOUND', '프로젝트를 찾을 수 없습니다.', 404, undefined, traceId);
    }

    // Delete project
    await prisma.project.delete({
      where: { id },
    });

    logger.info(`[Project ${traceId}] ✅ 프로젝트 삭제 완료`);

    return success({ message: '프로젝트가 삭제되었습니다.' }, 200, traceId);

  } catch (error: any) {
    console.error(`[Project ${traceId}] ❌ 프로젝트 삭제 실패:`, error);
    return failure('INTERNAL_ERROR', '프로젝트 삭제 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}