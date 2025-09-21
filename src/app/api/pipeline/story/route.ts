/**
 * 파이프라인 1단계: 스토리 제출 API (Planning API 프록시)
 * POST /api/pipeline/story → /api/planning/stories 리다이렉트
 *
 * 중복 구현 방지를 위해 기존 Planning API로 프록시
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';

/**
 * 스토리 제출 - Planning API로 프록시
 */
export async function POST(request: NextRequest) {
  try {
    // Planning API로 요청 프록시
    const body = await request.json();

    // 파이프라인 계약과 플래닝 API 스키마 간 변환
    const planningRequest = {
      title: body.story?.title || body.title || 'Untitled Story',
      content: body.story?.content || body.content || '',
      genre: body.story?.genre || body.genre || 'General',
      tone: body.story?.tone?.join?.(', ') || body.tone || 'Neutral',
      targetAudience: body.story?.targetAudience || body.targetAudience || 'General'
    };

    // 내부적으로 Planning API 호출
    const planningUrl = new URL('/api/planning/stories', request.url);
    const planningResponse = await fetch(planningUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 인증 헤더 전달
        ...(request.headers.get('authorization') && {
          'authorization': request.headers.get('authorization')!
        }),
        ...(request.headers.get('cookie') && {
          'cookie': request.headers.get('cookie')!
        })
      },
      body: JSON.stringify(planningRequest)
    });

    const planningData = await planningResponse.json();

    // 파이프라인 API 형식으로 응답 변환
    if (planningResponse.ok && planningData.success) {
      return NextResponse.json({
        success: true,
        data: {
          storyId: planningData.data.id,
          projectId: body.projectId || planningData.data.id,
          savedAt: planningData.data.createdAt
        },
        message: '스토리가 성공적으로 저장되었습니다.'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: planningData.message || '스토리 저장에 실패했습니다.'
      }, { status: planningResponse.status });
    }

  } catch (error) {
    logger.error('Pipeline story proxy error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({
      success: false,
      error: '스토리 처리 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

/**
 * 스토리 업데이트 - 향후 구현
 */
export async function PUT(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'Story update not yet implemented'
  }, { status: 501 });
}

/**
 * CORS 헤더
 */
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}