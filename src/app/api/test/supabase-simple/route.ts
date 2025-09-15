import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 간단한 Supabase 연결 테스트
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 간단한 Supabase 연결 테스트 시작');

    // 1. 기본 테이블 목록 조회 시도
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);

    console.log('📋 테이블 조회 결과:', { data: tables, error: tablesError });

    // 2. 현재 사용자 정보 확인
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    console.log('👤 사용자 정보:', { user: user?.id || 'none', error: userError });

    const result = {
      timestamp: new Date().toISOString(),
      status: 'success',
      supabase: {
        connected: true,
        tablesFound: tables?.length || 0,
        tableNames: tables?.map(t => t.table_name) || [],
        user: user?.id || null,
        errors: {
          tables: tablesError?.message || null,
          user: userError?.message || null
        }
      }
    };

    console.log('✅ 테스트 완료:', result);

    return NextResponse.json(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Supabase 테스트 실패:', errorMessage);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'error',
      error: errorMessage,
      supabase: {
        connected: false
      }
    }, { status: 500 });
  }
}