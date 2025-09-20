import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { z } from 'zod';
// import { prisma } from '@/lib/db'; // Prisma 임시 비활성화
import { getUserIdFromRequest } from '@/shared/lib/auth';

const UpdateTemplateSchema = z.object({
  name: z.string().min(1, '템플릿 이름을 입력해주세요').optional(),
  description: z.string().min(1, '템플릿 설명을 입력해주세요').optional(),
  category: z.enum(['advertisement', 'vlog', 'tutorial', 'custom']).optional(),
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
  }).optional(),
  thumbnailUrl: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // PRISMA_DISABLED: const template = awaitprisma.storyTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: '템플릿을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template }, { status: 200 });
  } catch (error) {
    console.error('[Template API] GET error:', error);
    return NextResponse.json(
      { error: '템플릿 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // 🚨 보안 긴급 수정: 토큰 기반 인증으로 변경
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }
    
    const validatedData = UpdateTemplateSchema.parse(body);

    // 권한 확인: 사용자가 소유한 템플릿만 수정 가능
    // PRISMA_DISABLED: const existingTemplate = awaitprisma.storyTemplate.findFirst({
      where: {
        id,
        userId: userId,
      },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: '권한이 없거나 템플릿을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // PRISMA_DISABLED: const template = awaitprisma.storyTemplate.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json({ template }, { status: 200 });
  } catch (error) {
    console.error('[Template API] PUT error:', error);
    
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
      { error: '템플릿 업데이트에 실패했습니다' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 🚨 보안 긴급 수정: 토큰 기반 인증으로 변경
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 권한 확인: 사용자가 소유한 템플릿만 삭제 가능
    // PRISMA_DISABLED: const existingTemplate = awaitprisma.storyTemplate.findFirst({
      where: {
        id,
        userId: userId,
      },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: '권한이 없거나 템플릿을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // PRISMA_DISABLED: awaitprisma.storyTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ message: '템플릿이 삭제되었습니다' }, { status: 200 });
  } catch (error) {
    console.error('[Template API] DELETE error:', error);
    return NextResponse.json(
      { error: '템플릿 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json(null, { status: 200 });
}