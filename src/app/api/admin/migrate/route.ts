import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Auth 테이블 생성 SQL
const AUTH_TABLES_SQL = `
-- 1. User table - Core authentication entity
CREATE TABLE IF NOT EXISTS "User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  role TEXT NOT NULL,
  avatar_url TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RefreshToken table - JWT refresh token management
CREATE TABLE IF NOT EXISTS "RefreshToken" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  device_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EmailVerification table - Email verification flow
CREATE TABLE IF NOT EXISTS "EmailVerification" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  code TEXT,
  user_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PasswordReset table - Password reset flow
CREATE TABLE IF NOT EXISTS "PasswordReset" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const INDEXES_SQL = `
-- User table indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_user_username ON "User"(username);
CREATE INDEX IF NOT EXISTS idx_user_created_at ON "User"(created_at);

-- RefreshToken table indexes
CREATE INDEX IF NOT EXISTS idx_refresh_token_user ON "RefreshToken"(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_token ON "RefreshToken"(token);
CREATE INDEX IF NOT EXISTS idx_refresh_token_expires ON "RefreshToken"(expires_at);

-- EmailVerification table indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_email ON "EmailVerification"(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_token ON "EmailVerification"(token);

-- PasswordReset table indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON "PasswordReset"(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON "PasswordReset"(token);
`;

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Auth 테이블 마이그레이션 시작...');

    // Step 1: 테이블 생성
    console.log('📋 테이블 생성 중...');
    const { error: tablesError } = await supabase.rpc('exec_sql', {
      sql: AUTH_TABLES_SQL
    });

    if (tablesError) {
      console.error('❌ 테이블 생성 실패:', tablesError);
      return NextResponse.json({
        success: false,
        error: `테이블 생성 실패: ${tablesError.message}`,
        step: 'tables'
      }, { status: 500 });
    }

    console.log('✅ 테이블 생성 완료');

    // Step 2: 인덱스 생성
    console.log('🔍 인덱스 생성 중...');
    const { error: indexesError } = await supabase.rpc('exec_sql', {
      sql: INDEXES_SQL
    });

    if (indexesError) {
      console.error('⚠️ 인덱스 생성 실패 (테이블은 생성됨):', indexesError);
      return NextResponse.json({
        success: true,
        warning: `인덱스 생성 실패: ${indexesError.message}`,
        step: 'indexes',
        message: '테이블은 정상적으로 생성되었지만 일부 인덱스 생성 실패'
      });
    }

    console.log('✅ 인덱스 생성 완료');

    // Step 3: 테이블 목록 확인
    console.log('🔍 생성된 테이블 확인 중...');
    const { data: tables, error: listError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['User', 'RefreshToken', 'EmailVerification', 'PasswordReset']);

    if (listError) {
      console.warn('⚠️ 테이블 목록 조회 실패:', listError);
    }

    console.log('🎉 Auth 테이블 마이그레이션 완료!');

    return NextResponse.json({
      success: true,
      message: 'Auth 테이블 마이그레이션이 성공적으로 완료되었습니다',
      tables: tables?.map(t => t.table_name) || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 마이그레이션 실행 중 오류:', error);
    return NextResponse.json({
      success: false,
      error: `마이그레이션 실행 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // 현재 테이블 상태 확인
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (error) {
      return NextResponse.json({
        error: `테이블 목록 조회 실패: ${error.message}`
      }, { status: 500 });
    }

    const authTables = ['User', 'RefreshToken', 'EmailVerification', 'PasswordReset'];
    const existingAuthTables = tables?.filter(t => authTables.includes(t.table_name)).map(t => t.table_name) || [];
    const missingAuthTables = authTables.filter(table => !existingAuthTables.includes(table));

    return NextResponse.json({
      status: missingAuthTables.length === 0 ? 'complete' : 'incomplete',
      existingTables: existingAuthTables,
      missingTables: missingAuthTables,
      allTables: tables?.map(t => t.table_name) || [],
      needsMigration: missingAuthTables.length > 0
    });

  } catch (error) {
    return NextResponse.json({
      error: `상태 확인 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    }, { status: 500 });
  }
}