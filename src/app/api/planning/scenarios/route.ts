import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';
import type { ScenarioMetadata } from '@/shared/types/metadata';

export const dynamic = 'force-dynamic';

/**
 * GET /api/planning/scenarios
 * 저장된 시나리오 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // Prisma 클라이언트 임포트 및 연결 검증
    const { prisma, checkDatabaseConnection } = await import('@/lib/prisma');

    // 데이터베이스 연결 상태 검증
    const connectionStatus = await checkDatabaseConnection(2);
    if (!connectionStatus.success) {
      console.error('❌ Database connection failed:', connectionStatus.error);
      return NextResponse.json(
        createErrorResponse('DATABASE_CONNECTION_ERROR', '데이터베이스 연결에 실패했습니다.'),
        { status: 503 }
      );
    }

    // 시나리오 타입으로 필터링된 프로젝트 조회
    const projects = await prisma.project.findMany({
      where: {
        tags: {
          array_contains: 'scenario'
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        description: true,
        metadata: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        scenario: true,
        tags: true,
        user: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    });

    // 시나리오 형식으로 변환
    const scenarios = projects.map(project => {
      const metadata = project.metadata as ScenarioMetadata | null;

      return {
        id: project.id,
        title: project.title,
        version: metadata?.version || 'V1',
        author: project.user?.username || metadata?.author || 'AI Generated',
        updatedAt: project.updatedAt,
        createdAt: project.createdAt,
        hasFourStep: metadata?.hasFourStep || false,
        hasTwelveShot: metadata?.hasTwelveShot || false,
        story: metadata?.story || '',
        genre: metadata?.genre || '',
        tone: metadata?.tone || '',
        target: metadata?.target || '',
        format: metadata?.format || '16:9',
        tempo: metadata?.tempo || '보통',
        developmentMethod: metadata?.developmentMethod || '',
        developmentIntensity: metadata?.developmentIntensity || '',
        durationSec: metadata?.durationSec || 10,
        pdfUrl: null, // PDF 생성 기능은 별도 구현 필요
      };
    });

    return NextResponse.json(
      createSuccessResponse({
        scenarios,
        total: scenarios.length,
        timestamp: new Date().toISOString()
      }, '시나리오 목록을 성공적으로 조회했습니다.'),
      { status: 200 }
    );

  } catch (error) {
    console.error('시나리오 조회 오류:', error);

    return NextResponse.json(
      createErrorResponse(
        'SCENARIO_FETCH_ERROR',
        error instanceof Error ? error.message : '시나리오 조회 중 오류가 발생했습니다.'
      ),
      { status: 500 }
    );
  }
}