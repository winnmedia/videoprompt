/**
 * 파이프라인 4단계: 영상 생성 API (Planning API 프록시)
 * POST /api/pipeline/video → /api/planning/videos 리다이렉트
 *
 * 중복 구현 방지를 위해 기존 Planning API로 프록시
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';

/**
 * 영상 생성 - Planning API로 프록시
 */
export async function POST(request: NextRequest) {
  try {
    // Planning API로 요청 프록시
    const body = await request.json();

    // 파이프라인 계약과 플래닝 API 스키마 간 변환
    const planningRequest = {
      title: `영상 ${body.projectId || 'Unknown'}`,
      provider: body.video?.provider || 'seedance',
      status: 'queued',
      duration: body.video?.duration || 30,
      prompt: body.promptId ? `Prompt ID: ${body.promptId}` : '',
      metadata: {
        projectId: body.projectId,
        promptId: body.promptId,
        aspectRatio: body.video?.aspectRatio || '16:9',
        resolution: body.video?.resolution || '1080p',
        priority: body.video?.priority || 'normal'
      }
    };

    // 내부적으로 Planning API 호출
    const planningUrl = new URL('/api/planning/videos', request.url);
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
          videoId: planningData.data.id,
          projectId: body.projectId || planningData.data.id,
          savedAt: planningData.data.createdAt,
          jobId: planningData.data.id, // Planning API에서는 별도 jobId가 없으므로 id 사용
          status: 'queued'
        },
        message: '영상 생성 요청이 성공적으로 저장되었습니다.'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: planningData.message || '영상 생성 요청에 실패했습니다.'
      }, { status: planningResponse.status });
    }

  } catch (error) {
    logger.error('Pipeline video proxy error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({
      success: false,
      error: '영상 처리 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
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