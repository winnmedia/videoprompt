// Database health check API endpoint
import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, validateDatabaseSchema, checkDatabaseConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 데이터베이스 상태 검사 시작...');
    
    // 초기화 및 전체 상태 검사
    const result = await initializeDatabase();
    
    // 상세 정보 추가 수집
    const detailedResponse = {
      timestamp: new Date().toISOString(),
      status: result.initialized ? 'healthy' : 'unhealthy',
      checks: {
        connection: {
          status: result.connectionStatus ? 'pass' : 'fail',
          details: result.connectionStatus ? '데이터베이스 연결 성공' : '데이터베이스 연결 실패'
        },
        schema: {
          status: result.schemaValid ? 'pass' : 'fail', 
          details: result.schemaValid ? '스키마 검증 완료' : '스키마 검증 실패'
        }
      },
      error: result.error || null,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: process.env.DATABASE_URL ? 
          `${process.env.DATABASE_URL.substring(0, 20)}...` : 'NOT_SET'
      }
    };

    console.log('📊 데이터베이스 상태 검사 결과:', detailedResponse);

    // HTTP 상태 코드 결정
    const httpStatus = result.initialized ? 200 : 503;

    return NextResponse.json(detailedResponse, { status: httpStatus });

  } catch (error) {
    console.error('❌ 데이터베이스 상태 검사 중 오류 발생:', error);
    
    const errorResponse = {
      timestamp: new Date().toISOString(),
      status: 'error',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      checks: {
        connection: { status: 'fail', details: '검사 실패' },
        schema: { status: 'fail', details: '검사 실패' }
      }
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}