/**
 * 테스트 사용자 정리 API - 테스트 환경에서만 사용
 * 통합 테스트 후 생성된 테스트 데이터를 안전하게 정리
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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

    // Supabase 클라이언트 생성 (직접 DB 액세스)
    const supabase = createServerClient();
    
    // 사용자 관련 데이터 정리 (순서 중요 - 외래키 제약 고려)
    const cleanupOperations = [
      // 1. 사용자의 세션 정리
      () => supabase
        .from('user_sessions')
        .delete()
        .eq('user_email', userEmail),
      
      // 2. 인증 관련 데이터 정리
      () => supabase
        .from('email_verifications')
        .delete()
        .eq('email', userEmail),
      
      // 3. 사용자 계정 정리
      () => supabase
        .from('users')
        .delete()
        .eq('email', userEmail),
    ];

    // 순차적으로 정리 작업 수행
    const results = [];
    for (const operation of cleanupOperations) {
      try {
        const result = await operation();
        results.push({
          operation: operation.name || 'unknown',
          success: !result.error,
          error: result.error?.message,
          count: result.count || 0,
        });
      } catch (error) {
        results.push({
          operation: operation.name || 'unknown',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          count: 0,
        });
      }
    }

    const totalCleaned = results.reduce((sum, result) => sum + (result.count || 0), 0);
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

    const supabase = createServerClient();
    
    // 테스트 사용자 패턴으로 조회
    const { data: testUsers, error } = await supabase
      .from('users')
      .select('id, email, username, created_at, email_verified')
      .or('email.ilike.%integration_test_%,email.ilike.%test_%')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    // 생성 시간이 오래된 사용자들 필터링 (1시간 이상)
    const now = new Date();
    const retentionHours = Number(process.env.TEST_USER_RETENTION_HOURS) || 1;
    const cutoffTime = new Date(now.getTime() - (retentionHours * 60 * 60 * 1000));
    
    const oldTestUsers = testUsers?.filter(user => 
      new Date(user.created_at) < cutoffTime
    ) || [];

    return NextResponse.json({
      ok: true,
      data: {
        totalTestUsers: testUsers?.length || 0,
        cleanupCandidates: oldTestUsers.length,
        retentionHours,
        users: oldTestUsers.map(user => ({
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.created_at,
          emailVerified: user.email_verified,
          ageHours: Math.floor((now.getTime() - new Date(user.created_at).getTime()) / (60 * 60 * 1000)),
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