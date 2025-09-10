import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/shared/lib/auth';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { z } from 'zod';

export const runtime = 'nodejs';

// Project creation schema
const CreateProjectSchema = z.object({
  title: z.string().min(1).max(200),
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
});

const UpdateProjectSchema = CreateProjectSchema.partial();

// CORS headers
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Create new project
export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  console.log(`[Projects ${traceId}] 🚀 프로젝트 생성 요청`);

  try {
    // Check authentication
    const user = await getUser(req);
    if (!user) {
      return failure('UNAUTHORIZED', '로그인이 필요합니다.', 401, undefined, traceId);
    }

    // Parse and validate request
    const body = await req.json();
    const validatedData = CreateProjectSchema.parse(body);

    console.log(`[Projects ${traceId}] ✅ 입력 데이터 검증 완료`);

    // Create project in database
    const project = await prisma.project.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        userId: user.id,
        metadata: {
          scenario: validatedData.scenario ?? undefined,
          prompt: validatedData.prompt ?? undefined,
          video: validatedData.video ?? undefined,
        },
        status: 'draft',
        tags: [],
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

    console.log(`[Projects ${traceId}] ✅ 프로젝트 생성 완료: ${project.id}`);

    // Prisma automatically handles JSON fields
    const response = project;

    return success(response, 201, traceId);

  } catch (error: any) {
    console.error(`[Projects ${traceId}] ❌ 프로젝트 생성 실패:`, error);

    if (error instanceof z.ZodError) {
      return failure('VALIDATION_ERROR', '입력 데이터가 올바르지 않습니다.', 400, JSON.stringify({ errors: error.issues }), traceId);
    }

    return failure('INTERNAL_ERROR', '프로젝트 생성 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}

// Get user's projects
export async function GET(req: NextRequest) {
  const traceId = getTraceId(req);
  console.log(`[Projects ${traceId}] 📋 프로젝트 목록 조회`);

  try {
    // Check authentication
    const user = await getUser(req);
    if (!user) {
      return failure('UNAUTHORIZED', '로그인이 필요합니다.', 401, undefined, traceId);
    }

    // Get query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Fetch projects with pagination
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          title: true,
          description: true,
          metadata: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.project.count({
        where: { userId: user.id },
      }),
    ]);

    console.log(`[Projects ${traceId}] ✅ ${projects.length}개 프로젝트 조회 완료`);

    // Parse JSON fields
    const response = {
      projects: projects.map(project => ({
        ...project,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return success(response, 200, traceId);

  } catch (error: any) {
    console.error(`[Projects ${traceId}] ❌ 프로젝트 조회 실패:`, error);
    return failure('INTERNAL_ERROR', '프로젝트 조회 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}