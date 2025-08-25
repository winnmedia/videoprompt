import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // Railway 백엔드로 프록시
  const railwayBackend = 'https://videoprompt-production.up.railway.app';
  
  try {
    const res = await fetch(`${railwayBackend}/api/seedance/diagnose`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e?.message || 'Railway backend proxy failed',
      message: '로컬 API Route가 Railway 백엔드로 프록시되었습니다.',
    }, { status: 200 });
  }
}


