/**
 * 파이프라인 3단계: 프롬프트 생성 API (Planning API 프록시)
 * POST /api/pipeline/prompt → /api/planning/prompt 리다이렉트
 *
 * 중복 구현 방지를 위해 기존 Planning API로 프록시
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';

/**
 * 프롬프트 생성 - Planning API로 프록시
 */
export async function POST(request: NextRequest) {
  try {
    // Planning API로 요청 프록시
    const body = await request.json();

    // 파이프라인 계약과 플래닝 API 스키마 간 변환
    const planningRequest = {
      scenarioTitle: `프롬프트 ${body.projectId || 'Unknown'}`,
      finalPrompt: `Visual Style: ${body.prompt?.visualStyle || 'cinematic'}, Mood: ${body.prompt?.mood || 'neutral'}, Quality: ${body.prompt?.quality || 'standard'}`,
      keywords: body.prompt?.keywords || [],
      visualStyle: body.prompt?.visualStyle || 'cinematic',
      mood: body.prompt?.mood || 'neutral',
      directorStyle: body.prompt?.directorStyle || '',
      projectId: body.projectId,
      metadata: {
        scenarioId: body.scenarioId,
        quality: body.prompt?.quality || 'standard',
        lighting: body.prompt?.lighting || '',
        cameraAngle: body.prompt?.cameraAngle || '',
        movement: body.prompt?.movement || ''
      }
    };

    // 내부적으로 Planning API 호출
    const planningUrl = new URL('/api/planning/prompt', request.url);
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
          promptId: planningData.data.id,
          projectId: body.projectId || planningData.data.id,
          savedAt: planningData.data.createdAt,
          finalPrompt: planningData.data.finalPrompt,
          enhancedKeywords: planningData.data.keywords || []
        },
        message: '프롬프트가 성공적으로 생성되었습니다.'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: planningData.message || '프롬프트 생성에 실패했습니다.'
      }, { status: planningResponse.status });
    }

  } catch (error) {
    logger.error('Pipeline prompt proxy error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({
      success: false,
      error: '프롬프트 처리 중 오류가 발생했습니다.'
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