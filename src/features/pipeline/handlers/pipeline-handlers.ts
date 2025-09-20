/**
 * 🚨 DEPRECATED: 파이프라인 통합 핸들러
 *
 * 이 파일은 더 이상 사용되지 않습니다.
 * 파이프라인 API (/api/pipeline/*)는 이제 Planning API (/api/planning/*)로 프록시됩니다.
 *
 * Migration Path:
 * - /api/pipeline/story → /api/planning/stories
 * - /api/pipeline/scenario → /api/planning/scenario
 * - /api/pipeline/prompt → /api/planning/prompt
 * - /api/pipeline/video → /api/planning/videos
 * - /api/pipeline/status → /api/planning/dashboard
 *
 * 중복 구현 제거 및 단일 진실 원천(Single Source of Truth) 확보 완료
 *
 * @deprecated Use planning API proxies instead
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * DEPRECATED STUB FUNCTIONS
 * 하위 호환성을 위한 빈 함수들
 * 실제 구현은 각 pipeline API 라우트에서 planning API로 프록시됨
 */

export async function handleStorySubmission(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'DEPRECATED: Use /api/pipeline/story (automatically proxied to planning API)'
  }, { status: 410 }); // 410 Gone
}

export async function handleStoryUpdate(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'DEPRECATED: Use /api/pipeline/story (automatically proxied to planning API)'
  }, { status: 410 });
}

export async function handleScenarioGeneration(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'DEPRECATED: Use /api/pipeline/scenario (automatically proxied to planning API)'
  }, { status: 410 });
}

export async function handlePromptGeneration(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'DEPRECATED: Use /api/pipeline/prompt (automatically proxied to planning API)'
  }, { status: 410 });
}

export async function handleVideoGeneration(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'DEPRECATED: Use /api/pipeline/video (automatically proxied to planning API)'
  }, { status: 410 });
}

export async function handlePipelineStatus(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: 'DEPRECATED: Use /api/pipeline/status/[projectId] (automatically proxied to planning API)'
  }, { status: 410 });
}

export async function handleOptions(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}