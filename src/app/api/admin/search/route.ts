import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    // TODO: Supabase 검색 구현 필요
    console.log('🔍 Admin search - Supabase 구현 대기 중');

    return NextResponse.json({
      videos: [],
      projects: [],
      users: [],
      total: 0,
    });
  } catch (error) {
    console.error('Admin search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}