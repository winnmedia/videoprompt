/**
 * useEffect Violation Detection API
 * $300 사건의 원인이었던 useEffect 의존성 문제 감지
 */

import { NextRequest, NextResponse } from 'next/server';

interface UseEffectViolation {
  component: string;
  line: number;
  dependency: string;
  violation: 'function-in-dependency-array' | 'missing-dependency' | 'unnecessary-dependency';
}

export async function POST(request: NextRequest) {
  try {
    const violationData: UseEffectViolation = await request.json();

    // useEffect 의존성 위반 검사
    if (violationData.violation === 'function-in-dependency-array') {
      console.warn(`🚨 useEffect 위반 감지: ${violationData.component}:${violationData.line}`);
      console.warn(`의존성 배열에 함수 발견: ${violationData.dependency}`);
      console.warn('이는 $300 사건과 같은 무한 호출을 야기할 수 있습니다!');

      return NextResponse.json({
        success: false,
        error: {
          message: 'useEffect 의존성 배열에 함수가 포함되어 있습니다',
          details: {
            component: violationData.component,
            line: violationData.line,
            dependency: violationData.dependency,
            suggestion: '함수를 의존성 배열에서 제거하거나 useCallback으로 메모이제이션하세요'
          }
        }
      }, { status: 400 });
    }

    if (violationData.violation === 'missing-dependency') {
      return NextResponse.json({
        success: false,
        error: {
          message: '누락된 의존성이 감지되었습니다',
          details: violationData
        }
      }, { status: 400 });
    }

    if (violationData.violation === 'unnecessary-dependency') {
      return NextResponse.json({
        success: false,
        error: {
          message: '불필요한 의존성이 감지되었습니다',
          details: violationData
        }
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: { message: 'useEffect가 올바르게 작성되었습니다' }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to validate useEffect' }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      message: 'useEffect violation detection API',
      violations: [
        'function-in-dependency-array',
        'missing-dependency',
        'unnecessary-dependency'
      ]
    }
  });
}