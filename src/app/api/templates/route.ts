import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { prisma } from '@/lib/db';
import { StoryInput } from '@/entities/scenario';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { withCors } from '@/shared/lib/cors';

const CreateTemplateSchema = z.object({
  name: z.string().min(1, '템플릿 이름을 입력해주세요'),
  description: z.string().min(1, '템플릿 설명을 입력해주세요'),
  category: z.enum(['advertisement', 'vlog', 'tutorial', 'custom']),
  template: z.object({
    title: z.string(),
    oneLineStory: z.string(),
    toneAndManner: z.array(z.string()),
    genre: z.string(),
    target: z.string(),
    duration: z.string(),
    format: z.string(),
    tempo: z.string(),
    developmentMethod: z.string(),
    developmentIntensity: z.string(),
  }),
  thumbnailUrl: z.string().optional(),
  isPublic: z.boolean().default(false),
});

export const GET = withCors(async (req: NextRequest) => {
  const traceId = getTraceId(req);
  
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    
    // 🚨 보안 긴급 수정: 토큰 기반 인증으로 변경 (선택적)
    const userId = getUserIdFromRequest(req);

    const whereClause = {
      AND: [
        category ? { category } : {},
        {
          OR: [
            { isPublic: true },
            userId ? { userId } : { userId: null }
          ]
        }
      ]
    };

    const templates = await prisma.storyTemplate.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates }, { status: 200 });
  } catch (error) {
    console.error('[Templates API] GET error:', error);
    return NextResponse.json(
      { error: '템플릿 조회에 실패했습니다' },
      { status: 500 }
    );
  }
});

export const POST = withCors(async (req: NextRequest) => {
  const traceId = getTraceId(req);
  
  try {
    const body = await req.json();
    
    // 🚨 보안 긴급 수정: 토큰 기반 인증으로 변경
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }
    
    const validatedData = CreateTemplateSchema.parse(body);
    
    const template = await prisma.storyTemplate.create({
      data: {
        ...validatedData,
        userId: userId,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('[Templates API] POST error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: '입력값이 올바르지 않습니다',
          details: error.issues
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: '템플릿 저장에 실패했습니다' },
      { status: 500 }
    );
  }
});

// OPTIONS 요청은 withCors 미들웨어에서 자동 처리됩니다