import { NextResponse } from 'next/server'

// DB/Supabase 의존성 없이도 항상 200을 반환하는 헬스체크
export async function GET() {
  return NextResponse.json({
    ok: true,
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    degraded: false,
  })
}


