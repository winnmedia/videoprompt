import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { logger } from '@/shared/lib/logger';
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
  logger.info(`[Projects ${traceId}] 🚀 프로젝트 생성 요청`);

  try {
    // Check authentication
    const user = await getUser(req);
    if (!user) {
      return failure('UNAUTHORIZED', '로그인이 필요합니다.', 401, undefined, traceId);
    }

    // Parse and validate request
    const body = await req.json();
    const validatedData = CreateProjectSchema.parse(body);

    logger.info(`[Projects ${traceId}] ✅ 입력 데이터 검증 완료`);

    // Create project in Supabase
    const supabase = await getSupabaseClientSafe('admin');

    const projectData = {
      title: validatedData.title,
      description: validatedData.description || null,
      user_id: user.id,
      metadata: {
        scenario: validatedData.scenario ?? null,
        prompt: validatedData.prompt ?? null,
        video: validatedData.video ?? null,
      },
      status: 'draft',
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: project, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select('id, title, description, metadata, status, created_at, updated_at')
      .single();

    if (error || !project) {
      throw new Error(error?.message || 'Project creation failed');
    }

    logger.info(`[Projects ${traceId}] ✅ 프로젝트 생성 완료: ${project.id}`);

    // Transform response to match Prisma format
    const response = {
      id: project.id,
      title: project.title,
      description: project.description,
      metadata: project.metadata,
      status: project.status,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };

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
  logger.info(`[Projects ${traceId}] 📋 프로젝트 목록 조회`);

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

    // Fetch projects with pagination using Supabase
    const supabase = await getSupabaseClientSafe('admin');

    // Get projects with pagination
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, title, description, metadata, status, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (projectsError) {
      throw new Error(projectsError.message);
    }

    // Get total count
    const { count: total, error: countError } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      throw new Error(countError.message);
    }

    logger.info(`[Projects ${traceId}] ✅ ${projects?.length || 0}개 프로젝트 조회 완료`);

    // Transform response to match Prisma format
    const response = {
      projects: (projects || []).map(project => ({
        id: project.id,
        title: project.title,
        description: project.description,
        metadata: project.metadata,
        status: project.status,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      })),
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
      },
    };

    return success(response, 200, traceId);

  } catch (error: any) {
    console.error(`[Projects ${traceId}] ❌ 프로젝트 조회 실패:`, error);
    return failure('INTERNAL_ERROR', '프로젝트 조회 중 오류가 발생했습니다.', 500, undefined, traceId);
  }
}