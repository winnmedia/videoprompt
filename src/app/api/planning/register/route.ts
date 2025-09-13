import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PlanningRegistrationRequestSchema, createValidationErrorResponse, createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';

// TypeScript 인터페이스는 Zod 스키마로 대체됨
// PlanningRegistrationRequest 타입은 shared/schemas/api.schema.ts에서 import

/**
 * POST /api/planning/register
 * 생성된 콘텐츠를 planning 시스템에 등록
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Zod를 사용한 요청 데이터 검증
    const validationResult = PlanningRegistrationRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error),
        { status: 400 }
      );
    }
    
    const { type, projectId, source, createdAt, ...contentData } = validationResult.data;

    // 타입별 필수 필드 검사 (비즈니스 로직 검증)
    if (type === 'scenario' && (!contentData.title || !contentData.story)) {
      return NextResponse.json(
        createErrorResponse('MISSING_REQUIRED_FIELDS', '시나리오는 title과 story가 필요합니다.'),
        { status: 400 }
      );
    }

    if (type === 'prompt' && !contentData.finalPrompt) {
      return NextResponse.json(
        createErrorResponse('MISSING_REQUIRED_FIELDS', '프롬프트는 finalPrompt가 필요합니다.'),
        { status: 400 }
      );
    }

    if (type === 'video' && !contentData.videoUrl && contentData.status !== 'processing') {
      return NextResponse.json(
        createErrorResponse('MISSING_REQUIRED_FIELDS', '영상은 videoUrl이나 processing 상태가 필요합니다.'),
        { status: 400 }
      );
    }

    // 고유 ID 생성
    const itemId = `${type}_${projectId}_${Date.now()}`;
    
    // 타입에 따른 데이터 구성
    let registeredItem: any = {
      id: itemId,
      projectId,
      source,
      type,
      createdAt,
      updatedAt: createdAt,
    };

    switch (type) {
      case 'scenario':
        registeredItem = {
          ...registeredItem,
          title: contentData.title,
          version: 'V1',
          author: 'AI Generated',
          updatedAt: createdAt,
          hasFourStep: true,
          hasTwelveShot: false,
          // 추가 메타데이터
          story: contentData.story,
          genre: contentData.genre,
          tone: contentData.tone,
          target: contentData.target,
          format: contentData.format,
          tempo: contentData.tempo,
          developmentMethod: contentData.developmentMethod,
          developmentIntensity: contentData.developmentIntensity,
          durationSec: contentData.durationSec,
        };
        break;

      case 'prompt':
        registeredItem = {
          ...registeredItem,
          scenarioTitle: contentData.scenarioTitle || '프롬프트',
          version: 'V1',
          keywordCount: Array.isArray(contentData.keywords) ? contentData.keywords.length : 0,
          segmentCount: 1,
          updatedAt: createdAt,
          // 추가 메타데이터
          finalPrompt: contentData.finalPrompt,
          keywords: contentData.keywords || [],
          negativePrompt: contentData.negativePrompt,
          visualStyle: contentData.visualStyle,
          mood: contentData.mood,
          quality: contentData.quality,
          directorStyle: contentData.directorStyle,
        };
        break;

      case 'video':
        registeredItem = {
          ...registeredItem,
          title: contentData.title || '생성된 영상',
          prompt: contentData.finalPrompt || '',
          provider: contentData.provider || 'unknown',
          duration: contentData.durationSec || 10,
          aspectRatio: contentData.format || '16:9',
          codec: 'H.264',
          version: 'V1',
          status: contentData.status || 'queued',
          videoUrl: contentData.videoUrl,
          refPromptTitle: contentData.refPromptTitle,
          jobId: contentData.jobId,
          operationId: contentData.operationId,
          completedAt: contentData.status === 'completed' ? createdAt : undefined,
        };
        break;

      default:
        return NextResponse.json(
          createErrorResponse('UNSUPPORTED_CONTENT_TYPE', '지원하지 않는 콘텐츠 타입입니다.'),
          { status: 400 }
        );
    }

    // 데이터베이스 저장 구현
    try {
      // 실제 Prisma를 통한 데이터베이스 저장
      const { prisma: db } = await import('@/lib/db');

      // Project 테이블에 Planning 데이터 저장 (기존 스키마 활용)
      const savedItem = await db.project.create({
        data: {
          id: registeredItem.id,
          title: registeredItem.title,
          description: registeredItem.description || null,
          metadata: registeredItem.data as any, // JSON 필드에 전체 데이터 저장
          status: registeredItem.status,
          userId: 'system-planning', // 시스템 생성 표시
          tags: [registeredItem.contentType], // contentType을 태그로 저장
          scenario: registeredItem.contentType === 'scenario' ? JSON.stringify(registeredItem.data) : null,
          prompt: registeredItem.contentType === 'prompt' ? (registeredItem as any).prompt : null,
        },
      });

      // 성공 응답
      return NextResponse.json(
        createSuccessResponse({
          id: savedItem.id,
          contentType: (savedItem.tags as string[])?.[0] || registeredItem.contentType,
          status: savedItem.status,
          createdAt: savedItem.createdAt,
        }, 'Planning content registered successfully'),
        { status: 201 }
      );

    } catch (dbError) {

      // 데이터베이스 연결 실패 시 친화적 에러 메시지
      if (dbError instanceof Error && dbError.message.includes('connect')) {
        return NextResponse.json(
          createErrorResponse('DATABASE_CONNECTION_ERROR', '데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'),
          { status: 503 }
        );
      }

      return NextResponse.json(
        createErrorResponse('DATABASE_ERROR', '데이터 저장 중 오류가 발생했습니다.'),
        { status: 500 }
      );
    }

  } catch (error) {
    
    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        error instanceof Error ? error.message : '등록 중 서버 오류가 발생했습니다.'
      ),
      { status: 500 }
    );
  }
}