import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  // 🔒 프로덕션 환경에서 테스트 엔드포인트 차단
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_ENDPOINTS) {
    return NextResponse.json({
      error: 'Test endpoints are not available in production'
    }, { status: 404 });
  }

  try {
    // 환경변수 체크
    const envCheck = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
    };
    
    // 데이터베이스 연결 테스트
    let dbStatus = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (dbError) {
      console.error('Database connection test failed:', dbError);
      dbStatus = 'error: ' + (dbError instanceof Error ? dbError.message : 'unknown error');
    }
    
    return NextResponse.json({
      ok: true,
      message: 'Test API is working',
      timestamp: new Date().toISOString(),
      method: 'GET',
      environment: envCheck,
      database: dbStatus
    });
  } catch (error) {
    console.error('Test API Error:', error);
    return NextResponse.json({
      ok: false,
      message: 'Test API failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      method: 'GET'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // 🔒 프로덕션 환경에서 테스트 엔드포인트 차단
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_ENDPOINTS) {
    return NextResponse.json({
      error: 'Test endpoints are not available in production'
    }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  
  return NextResponse.json({
    ok: true,
    message: 'Test API POST is working',
    timestamp: new Date().toISOString(),
    method: 'POST',
    body
  });
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
