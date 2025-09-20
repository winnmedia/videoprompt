/**
 * 파이프라인 2단계: 시나리오 생성 API (Planning API 프록시)
 * POST /api/pipeline/scenario → /api/planning/scenario 리다이렉트
 *
 * 중복 구현 방지를 위해 기존 Planning API로 프록시
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * 시나리오 생성 - Planning API로 프록시
 */
export async function POST(request: NextRequest) {
  try {
    // Planning API로 요청 프록시
    const body = await request.json();

    // 파이프라인 계약과 플래닝 API 스키마 간 변환
    const planningRequest = {
      title: `시나리오 ${body.projectId || 'Unknown'}`,
      logline: body.storyId ? `Story ID: ${body.storyId}` : undefined,
      structure4: {
        genre: body.scenario?.genre || 'General',
        tone: body.scenario?.tone || 'Neutral',
        target: body.scenario?.target || 'General Audience',
        structure: body.scenario?.structure || ['Beginning', 'Middle', 'End']
      }
    };

    // 내부적으로 Planning API 호출
    const planningUrl = new URL('/api/planning/scenario', request.url);
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
    if (planningResponse.ok && planningData.ok) {
      return NextResponse.json({
        success: true,
        data: {
          scenarioId: planningData.data.id,
          projectId: body.projectId || planningData.data.id,
          savedAt: planningData.data.createdAt,
          generatedScenario: planningData.data
        },
        message: '시나리오가 성공적으로 생성되었습니다.'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: planningData.error || '시나리오 생성에 실패했습니다.'
      }, { status: planningResponse.status });
    }

  } catch (error) {
    console.error('Pipeline scenario proxy error:', error);
    return NextResponse.json({
      success: false,
      error: '시나리오 처리 중 오류가 발생했습니다.'
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