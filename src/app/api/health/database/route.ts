// Database health check API endpoint
import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, checkDatabaseConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // 데이터베이스 비활성화로 인한 기능 비활성화
    const detailedResponse = {
      timestamp: new Date().toISOString(),
      status: 'disabled',
      checks: {
        connection: {
          status: 'disabled',
          details: '데이터베이스 기능이 비활성화되었습니다.'
        },
        schema: {
          status: 'disabled',
          details: '스키마 검증이 비활성화되었습니다.'
        }
      },
      error: null,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: 'DISABLED'
      }
    };

    // HTTP 상태 코드 결정
    const httpStatus = 503;

    return NextResponse.json(detailedResponse, { status: httpStatus });

  } catch (error) {
    
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