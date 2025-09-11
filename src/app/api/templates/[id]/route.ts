import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createResponse, success } from '@/shared/lib/api';
import { prisma } from '@/shared/lib/prisma';

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
  { params }: { params: { id: string } }
) {
  const traceId = crypto.randomUUID();
  
  try {
    const template = await prisma.storyTemplate.findUnique({
      where: { id: params.id },
    });

    if (!template) {
      return createResponse(
        { error: '템플릿을 찾을 수 없습니다' },
        404,
        traceId
      );
    }

    return success({ template }, 200, traceId);
  } catch (error) {
    console.error('[Template API] GET error:', error);
    return createResponse(
      { error: '템플릿 조회에 실패했습니다' },
      500,
      traceId
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const traceId = crypto.randomUUID();
  
  try {
    const body = await req.json();
    const userId = req.headers.get('user-id'); // 인증 구현 후 실제 사용자 ID 사용
    
    const validatedData = UpdateTemplateSchema.parse(body);
    
    // 템플릿 존재 확인 및 권한 체크
    const existingTemplate = await prisma.storyTemplate.findUnique({
      where: { id: params.id },
    });

    if (!existingTemplate) {
      return createResponse(
        { error: '템플릿을 찾을 수 없습니다' },
        404,
        traceId
      );
    }

    // 권한 체크 (공개 템플릿이 아니고, 소유자가 아닌 경우)
    if (!existingTemplate.isPublic && existingTemplate.userId !== userId) {
      return createResponse(
        { error: '이 템플릿을 수정할 권한이 없습니다' },
        403,
        traceId
      );
    }
    
    const template = await prisma.storyTemplate.update({
      where: { id: params.id },
      data: validatedData,
    });

    return success({ template }, 200, traceId);
  } catch (error) {
    console.error('[Template API] PUT error:', error);
    
    if (error instanceof z.ZodError) {
      return createResponse(
        { 
          error: '입력값이 올바르지 않습니다',
          details: error.errors
        },
        400,
        traceId
      );
    }
    
    return createResponse(
      { error: '템플릿 수정에 실패했습니다' },
      500,
      traceId
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const traceId = crypto.randomUUID();
  
  try {
    const userId = req.headers.get('user-id'); // 인증 구현 후 실제 사용자 ID 사용
    
    // 템플릿 존재 확인 및 권한 체크
    const existingTemplate = await prisma.storyTemplate.findUnique({
      where: { id: params.id },
    });

    if (!existingTemplate) {
      return createResponse(
        { error: '템플릿을 찾을 수 없습니다' },
        404,
        traceId
      );
    }

    // 권한 체크 (소유자만 삭제 가능)
    if (existingTemplate.userId !== userId) {
      return createResponse(
        { error: '이 템플릿을 삭제할 권한이 없습니다' },
        403,
        traceId
      );
    }
    
    await prisma.storyTemplate.delete({
      where: { id: params.id },
    });

    return success({ message: '템플릿이 삭제되었습니다' }, 200, traceId);
  } catch (error) {
    console.error('[Template API] DELETE error:', error);
    return createResponse(
      { error: '템플릿 삭제에 실패했습니다' },
      500,
      traceId
    );
  }
}

export async function OPTIONS() {
  return createResponse(null, 200);
}