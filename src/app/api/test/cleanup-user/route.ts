/**
 * 테스트 사용자 정리 API - 테스트 환경에서만 사용
 * 통합 테스트 후 생성된 테스트 데이터를 안전하게 정리
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    // 테스트 모드 확인
    const testMode = request.headers.get('X-Test-Mode');
    if (!testMode || testMode !== '1') {
      return NextResponse.json(
        { ok: false, error: 'This endpoint is only available in test mode' },
        { status: 403 }
      );
    }

    // 환경 확인
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_CLEANUP) {
      return NextResponse.json(
        { ok: false, error: 'Test user cleanup is not allowed in production' },
        { status: 403 }
      );
    }

    const userEmail = request.headers.get('X-User-Email');
    if (!userEmail) {
      return NextResponse.json(
        { ok: false, error: 'User email is required' },
        { status: 400 }
      );
    }

    // 테스트 사용자인지 확인 (이메일 패턴으로)
    if (!userEmail.includes('integration_test_') && !userEmail.includes('test_')) {
      return NextResponse.json(
        { ok: false, error: 'Only test users can be cleaned up through this endpoint' },
        { status: 400 }
      );
    }

    // Prisma를 사용하여 테스트 사용자 데이터 정리
    const results = [];
    let totalCleaned = 0;

    try {
      // 사용자 찾기
      const user = await prisma.user.findUnique({
        where: { email: userEmail }
      });

      if (!user) {
        return NextResponse.json({
          ok: true,
          message: `Test user not found: ${userEmail}`,
          data: { email: userEmail, totalRecordsCleaned: 0, operations: [] }
        });
      }

      // 사용자 삭제 (관련 데이터는 Prisma의 cascade 설정에 따라 자동 삭제)
      const deleteResult = await prisma.user.delete({
        where: { email: userEmail }
      });

      results.push({
        operation: 'delete_user',
        success: true,
        error: null,
        count: 1,
      });
      totalCleaned = 1;

    } catch (error) {
      results.push({
        operation: 'delete_user',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        count: 0,
      });
    }

    const hasErrors = results.some(result => !result.success);

    return NextResponse.json({
      ok: !hasErrors,
      message: hasErrors 
        ? 'Some cleanup operations failed'
        : `Successfully cleaned up test user: ${userEmail}`,
      data: {
        email: userEmail,
        totalRecordsCleaned: totalCleaned,
        operations: results,
      },
    });

  } catch (error) {
    console.error('Test user cleanup error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Failed to cleanup test user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET 메서드로 정리 대상 테스트 사용자 목록 조회
export async function GET(request: NextRequest) {
  try {
    // 테스트 모드 확인
    const testMode = request.headers.get('X-Test-Mode');
    if (!testMode || testMode !== '1') {
      return NextResponse.json(
        { ok: false, error: 'This endpoint is only available in test mode' },
        { status: 403 }
      );
    }

    // Prisma를 사용하여 테스트 사용자 조회
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'integration_test_' } },
          { email: { contains: 'test_' } }
        ]
      },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
        emailVerified: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // 생성 시간이 오래된 사용자들 필터링 (1시간 이상)
    const now = new Date();
    const retentionHours = Number(process.env.TEST_USER_RETENTION_HOURS) || 1;
    const cutoffTime = new Date(now.getTime() - (retentionHours * 60 * 60 * 1000));
    
    const oldTestUsers = testUsers.filter(user => 
      new Date(user.createdAt) < cutoffTime
    );

    return NextResponse.json({
      ok: true,
      data: {
        totalTestUsers: testUsers.length,
        cleanupCandidates: oldTestUsers.length,
        retentionHours,
        users: oldTestUsers.map(user => ({
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt,
          emailVerified: user.emailVerified,
          ageHours: Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (60 * 60 * 1000)),
        })),
      },
    });

  } catch (error) {
    console.error('Test user list error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Failed to list test users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// OPTIONS 메서드 지원 (CORS)
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, {
    headers: {
      'Allow': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Test-Mode, X-User-Email',
    },
  });
}