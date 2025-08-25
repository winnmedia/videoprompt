import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Note: Avoid strict typing for the 2nd arg to satisfy Next.js route handler constraints
export async function GET(_req: Request, context: any) {
  const id: string | undefined = context?.params?.id;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 200 });
  
  try {
    // Railway 백엔드로 프록시
    const railwayBackend = 'https://videoprompt-production.up.railway.app';
    
    const res = await fetch(`${railwayBackend}/api/seedance/status/${id}`);
    const data = await res.json();
    
    return NextResponse.json(data, { status: res.status });
    
  } catch (e: any) {
    console.error('DEBUG: Seedance status proxy error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || 'unknown error', 
      jobId: context?.params?.id,
      message: '로컬 Seedance Status API Route가 Railway 백엔드로 프록시되었습니다.',
    }, { status: 200 });
  }
}


