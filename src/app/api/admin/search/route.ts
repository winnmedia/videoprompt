import { NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';


export async function GET(req: Request) {
  try {
    // TODO: Supabase 검색 구현 필요
    logger.info('🔍 Admin search - Supabase 구현 대기 중');

    return NextResponse.json({
      videos: [],
      projects: [],
      users: [],
      total: 0,
    });
  } catch (error) {
    logger.error('Admin search error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}