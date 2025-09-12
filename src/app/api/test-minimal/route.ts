import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  // 🔒 프로덕션 환경에서 테스트 엔드포인트 차단
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_ENDPOINTS) {
    return NextResponse.json({
      error: 'Test endpoints are not available in production'
    }, { status: 404 });
  }

  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
}
