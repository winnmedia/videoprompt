import { NextResponse } from 'next/server';

export async function GET() {
  // 개발/테스트 환경에서는 외부 호출 없이 정적 상태를 반환
  // 프로덕션에서는 추후 실제 핑/지연/실패율 연동
  return NextResponse.json({
    ok: true,
    providers: [
      { name: 'Seedance', key: 'seedance', healthy: true, latencyMs: 0, failureRate: 0 },
      { name: 'Veo3', key: 'veo3', healthy: true, latencyMs: 0, failureRate: 0 },
      { name: 'Imagen', key: 'imagen', healthy: true, latencyMs: 0, failureRate: 0 },
    ],
  });
}


