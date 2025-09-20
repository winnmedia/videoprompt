/**
 * 파이프라인 상태 조회 API (Planning Dashboard API 프록시)
 * GET /api/pipeline/status/[projectId] → /api/planning/dashboard 리다이렉트
 *
 * 중복 구현 방지를 위해 기존 Planning Dashboard API로 프록시
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * 파이프라인 상태 조회 - Planning Dashboard API로 프록시
 */
export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const projectId = params.projectId;

    // 내부적으로 Planning Dashboard API 호출
    const dashboardUrl = new URL('/api/planning/dashboard', request.url);
    const dashboardResponse = await fetch(dashboardUrl, {
      method: 'GET',
      headers: {
        // 인증 헤더 전달
        ...(request.headers.get('authorization') && {
          'authorization': request.headers.get('authorization')!
        }),
        ...(request.headers.get('cookie') && {
          'cookie': request.headers.get('cookie')!
        })
      }
    });

    const dashboardData = await dashboardResponse.json();

    if (dashboardResponse.ok && dashboardData.success) {
      // 특정 프로젝트 ID와 관련된 데이터 필터링
      const scenarios = dashboardData.data.scenarios.filter((s: any) => s.id === projectId);
      const prompts = dashboardData.data.prompts.filter((p: any) => p.id === projectId);
      const videos = dashboardData.data.videos.filter((v: any) => v.id === projectId);

      // 파이프라인 상태로 변환
      const pipelineStatus = {
        projectId,
        story: {
          id: scenarios[0]?.id || null,
          completed: scenarios.length > 0,
          data: scenarios[0] || null
        },
        scenario: {
          id: scenarios[0]?.id || null,
          completed: scenarios.length > 0,
          data: scenarios[0] || null
        },
        prompt: {
          id: prompts[0]?.id || null,
          completed: prompts.length > 0,
          data: prompts[0] || null
        },
        video: {
          id: videos[0]?.id || null,
          completed: videos.length > 0,
          data: videos[0] || null
        },
        overallProgress: {
          completedSteps: [scenarios.length > 0, prompts.length > 0, videos.length > 0].filter(Boolean).length,
          totalSteps: 4,
          percentage: Math.round(([scenarios.length > 0, prompts.length > 0, videos.length > 0].filter(Boolean).length / 4) * 100)
        }
      };

      return NextResponse.json({
        success: true,
        data: pipelineStatus,
        message: '파이프라인 상태 조회 성공'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: dashboardData.message || '파이프라인 상태 조회에 실패했습니다.'
      }, { status: dashboardResponse.status });
    }

  } catch (error) {
    console.error('Pipeline status proxy error:', error);
    return NextResponse.json({
      success: false,
      error: '파이프라인 상태 조회 중 오류가 발생했습니다.'
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