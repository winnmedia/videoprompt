import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/shared/lib/supabase-client';
import { logger } from '@/shared/lib/logger';


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
    logger.info('🚀 Auth 테이블 마이그레이션 시작...');

    // 안전한 Supabase Admin 클라이언트 가져오기
    const supabaseResult = await getSupabaseAdminClient({
      throwOnError: false,
      useCircuitBreaker: true,
      serviceName: 'admin-migrate'
    });

    if (!supabaseResult.client || !supabaseResult.canProceed) {
      console.error('❌ Supabase Admin 클라이언트 생성 실패:', supabaseResult.error);

      return NextResponse.json({
        success: false,
        error: `Supabase 서비스를 사용할 수 없습니다: ${supabaseResult.error}`,
        degradationMode: supabaseResult.degradationMode,
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }

    const supabase = supabaseResult.client;

    // SQL 실행은 현재 제한적이므로 테이블별로 개별 생성 시도
    logger.info('📋 테이블 생성 중...');
    const createdTables: string[] = [];
    const errors: string[] = [];

    // 개별 테이블 생성 시도 (Supabase JS로는 제한적)
    // 대신 테이블 존재 여부만 확인하고 안내 메시지 제공
    const authTables = ['User', 'RefreshToken', 'EmailVerification', 'PasswordReset'];

    for (const tableName of authTables) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('id')
          .limit(0);

        if (!error) {
          createdTables.push(tableName);
        } else {
          errors.push(`${tableName}: 테이블이 존재하지 않음`);
        }
      } catch (tableError) {
        errors.push(`${tableName}: ${tableError instanceof Error ? tableError.message : '확인 불가'}`);
      }
    }

    if (createdTables.length === authTables.length) {
      logger.info('✅ 모든 Auth 테이블이 이미 존재합니다');
      return NextResponse.json({
        success: true,
        message: '모든 Auth 테이블이 이미 존재합니다',
        existingTables: createdTables,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.info('⚠️ 일부 테이블이 누락됨, 수동 마이그레이션 필요');
      return NextResponse.json({
        success: false,
        error: 'Supabase JS 클라이언트로는 직접 DDL 실행이 제한됩니다. Supabase Dashboard에서 수동으로 SQL을 실행해주세요.',
        sqlFile: '/supabase/migrations/001_create_auth_tables.sql',
        existingTables: createdTables,
        missingTables: authTables.filter(t => !createdTables.includes(t)),
        manualSteps: [
          '1. Supabase Dashboard > SQL Editor 접속',
          '2. 프로젝트 파일의 /supabase/migrations/001_create_auth_tables.sql 내용 복사',
          '3. SQL Editor에 붙여넣기 후 실행',
          '4. 완료 후 이 엔드포인트를 다시 호출하여 확인'
        ],
        timestamp: new Date().toISOString()
      }, { status: 422 });
    }


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
    // 안전한 Supabase Admin 클라이언트 가져오기
    const supabaseResult = await getSupabaseAdminClient({
      throwOnError: false,
      useCircuitBreaker: true,
      serviceName: 'admin-migrate-get'
    });

    if (!supabaseResult.client || !supabaseResult.canProceed) {
      return NextResponse.json({
        error: `Supabase 서비스를 사용할 수 없습니다: ${supabaseResult.error}`,
        degradationMode: supabaseResult.degradationMode
      }, { status: 503 });
    }

    const supabase = supabaseResult.client;

    // 각 테이블 존재 여부를 직접 확인하는 방식
    const authTables = ['User', 'RefreshToken', 'EmailVerification', 'PasswordReset'];
    const existingTables: string[] = [];
    const errors: string[] = [];

    for (const tableName of authTables) {
      try {
        // 각 테이블에 대해 limit 0 쿼리를 실행하여 존재 여부 확인
        const { error } = await supabase
          .from(tableName)
          .select('id')
          .limit(0);

        if (!error) {
          existingTables.push(tableName);
        } else {
          errors.push(`${tableName}: ${error.message}`);
        }
      } catch (tableError) {
        errors.push(`${tableName}: ${tableError instanceof Error ? tableError.message : '알 수 없는 오류'}`);
      }
    }

    const missingTables = authTables.filter(table => !existingTables.includes(table));

    return NextResponse.json({
      status: missingTables.length === 0 ? 'complete' : 'incomplete',
      existingTables,
      missingTables,
      needsMigration: missingTables.length > 0,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    return NextResponse.json({
      error: `상태 확인 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    }, { status: 500 });
  }
}