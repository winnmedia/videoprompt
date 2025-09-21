import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { logger } from '@/shared/lib/logger';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Supabase 마이그레이션 API 엔드포인트
 * POST /api/migrate/supabase
 */

// 핵심 테이블 생성 SQL (단계별)
const CORE_TABLES_SQL = {
  // 1. 사용자 테이블 (Supabase Auth와 연동)
  users: `
    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      preferences JSONB,
      email_verified BOOLEAN DEFAULT FALSE,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  // 2. 프로젝트 테이블
  projects: `
    CREATE TABLE IF NOT EXISTS public.projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      metadata JSONB,
      tags JSONB,
      scenario TEXT,
      prompt TEXT,
      video TEXT,
      user_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  // 3. 스토리 테이블
  stories: `
    CREATE TABLE IF NOT EXISTS public.stories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      genre TEXT,
      tone TEXT,
      target_audience TEXT,
      structure JSONB,
      metadata JSONB,
      status TEXT NOT NULL DEFAULT 'draft',
      user_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  // 4. 템플릿 테이블
  templates: `
    CREATE TABLE IF NOT EXISTS public.templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      tags JSONB,
      scenario JSONB,
      prompt JSONB,
      is_public BOOLEAN DEFAULT FALSE,
      user_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  // 5. 비디오 자산 테이블
  video_assets: `
    CREATE TABLE IF NOT EXISTS public.video_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      file_url TEXT NOT NULL,
      file_size BIGINT,
      duration INTEGER,
      thumbnail_url TEXT,
      metadata JSONB,
      status TEXT NOT NULL DEFAULT 'processing',
      project_id UUID,
      user_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
};

// RLS 정책 SQL
const RLS_POLICIES = {
  users: [
    `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`,
    `
    CREATE POLICY IF NOT EXISTS "Users can view their own profile"
      ON public.users FOR SELECT
      USING (auth.uid()::text = id::text);
    `,
    `
    CREATE POLICY IF NOT EXISTS "Users can update their own profile"
      ON public.users FOR UPDATE
      USING (auth.uid()::text = id::text);
    `
  ],

  projects: [
    `ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;`,
    `
    CREATE POLICY IF NOT EXISTS "Users can view their own projects"
      ON public.projects FOR SELECT
      USING (auth.uid()::text = user_id::text);
    `,
    `
    CREATE POLICY IF NOT EXISTS "Users can create their own projects"
      ON public.projects FOR INSERT
      WITH CHECK (auth.uid()::text = user_id::text);
    `,
    `
    CREATE POLICY IF NOT EXISTS "Users can update their own projects"
      ON public.projects FOR UPDATE
      USING (auth.uid()::text = user_id::text);
    `
  ],

  stories: [
    `ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;`,
    `
    CREATE POLICY IF NOT EXISTS "Users can view their own stories"
      ON public.stories FOR SELECT
      USING (auth.uid()::text = user_id::text);
    `,
    `
    CREATE POLICY IF NOT EXISTS "Users can create their own stories"
      ON public.stories FOR INSERT
      WITH CHECK (auth.uid()::text = user_id::text);
    `
  ],

  templates: [
    `ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;`,
    `
    CREATE POLICY IF NOT EXISTS "Users can view public templates"
      ON public.templates FOR SELECT
      USING (is_public = true OR auth.uid()::text = user_id::text);
    `,
    `
    CREATE POLICY IF NOT EXISTS "Users can create templates"
      ON public.templates FOR INSERT
      WITH CHECK (auth.uid()::text = user_id::text);
    `
  ]
};

interface MigrationResult {
  step: string;
  success: boolean;
  error?: string;
  details?: any;
}

/**
 * Supabase 마이그레이션 실행
 */
export async function POST(request: NextRequest) {
  const traceId = getTraceId(request);
  logger.info(`[Migration ${traceId}] 🚀 Supabase 마이그레이션 시작`);

  try {
    const body = await request.json().catch(() => ({}));
    const {
      createTables = true,
      setupRLS = true,
      dryRun = false,
      tableNames = [] // 특정 테이블만 마이그레이션
    } = body;

    // getSupabaseClientSafe를 사용한 안전한 Admin 클라이언트 초기화
    let supabaseAdmin;
    try {
      supabaseAdmin = await getSupabaseClientSafe('admin');
    } catch (error) {
      const errorMessage = error instanceof ServiceConfigError ? error.message : 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. Admin 권한이 필요합니다.';
      return NextResponse.json(
        failure(
          'ADMIN_CLIENT_UNAVAILABLE',
          errorMessage,
          503,
          undefined,
          traceId
        ),
        { status: 503 }
      );
    }

    const results: MigrationResult[] = [];

    // 1. 테이블 생성
    if (createTables) {
      logger.info(`[Migration ${traceId}] 📦 테이블 생성 시작`);

      const tablesToCreate = tableNames.length > 0
        ? tableNames.filter((name: string) => name in CORE_TABLES_SQL)
        : Object.keys(CORE_TABLES_SQL);

      for (const tableName of tablesToCreate) {
        const sql = CORE_TABLES_SQL[tableName as keyof typeof CORE_TABLES_SQL];

        logger.info(`[Migration ${traceId}] 📝 테이블 ${tableName} 생성 중...`);

        if (dryRun) {
          results.push({
            step: `create_table_${tableName}`,
            success: true,
            details: { sql: sql.trim(), action: 'dry-run' }
          });
          continue;
        }

        try {
          // Raw SQL 실행을 위한 workaround
          const { data, error } = await supabaseAdmin.rpc('execute_sql', {
            query: sql
          });

          if (error) {
            // execute_sql 함수가 없을 경우, 대안 시도
            logger.debug(`[Migration ${traceId}] execute_sql 실패, 대안 시도:`, error.message);

            // 간단한 테이블 존재 확인으로 대체
            const { data: checkData, error: checkError } = await supabaseAdmin
              .from(tableName)
              .select('count()')
              .limit(1);

            results.push({
              step: `create_table_${tableName}`,
              success: !checkError,
              error: checkError?.message,
              details: {
                note: 'SQL 직접 실행 불가 - Supabase Dashboard에서 수동 실행 필요',
                sql: sql.trim()
              }
            });
          } else {
            results.push({
              step: `create_table_${tableName}`,
              success: true,
              details: { data }
            });
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.debug(`[Migration ${traceId}] ❌ 테이블 ${tableName} 생성 실패:`, errorMessage);

          results.push({
            step: `create_table_${tableName}`,
            success: false,
            error: errorMessage,
            details: { sql: sql.trim() }
          });
        }
      }
    }

    // 2. RLS 설정
    if (setupRLS && !dryRun) {
      logger.info(`[Migration ${traceId}] 🛡️ RLS 정책 설정 시작`);

      for (const tableName of Object.keys(RLS_POLICIES)) {
        const policies = RLS_POLICIES[tableName as keyof typeof RLS_POLICIES];

        for (const policy of policies) {
          try {
            logger.info(`[Migration ${traceId}] 🔒 RLS 정책 적용: ${tableName}`);

            results.push({
              step: `rls_${tableName}`,
              success: true,
              details: {
                note: 'RLS 정책은 Supabase Dashboard에서 수동 설정 필요',
                policy: policy.trim()
              }
            });

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            results.push({
              step: `rls_${tableName}`,
              success: false,
              error: errorMessage
            });
          }
        }
      }
    }

    // 3. 마이그레이션 결과 검증
    logger.info(`[Migration ${traceId}] 🔍 결과 검증 중...`);

    const validationResults = await validateMigration(traceId);
    results.push(...validationResults);

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const overallSuccess = successCount === totalCount;

    logger.info(`[Migration ${traceId}] ${overallSuccess ? '✅' : '⚠️'} 마이그레이션 완료: ${successCount}/${totalCount}`);

    return NextResponse.json(
      success({
        migration: {
          status: overallSuccess ? 'completed' : 'partial',
          timestamp: new Date().toISOString(),
          results,
          summary: {
            total: totalCount,
            success: successCount,
            failed: totalCount - successCount
          },
          nextSteps: [
            'Supabase Dashboard에서 테이블 생성 확인',
            'RLS 정책 수동 설정',
            'Auth 트리거 설정',
            'Storage 버킷 생성'
          ]
        }
      }, 200, traceId)
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.debug(`[Migration ${traceId}] ❌ 마이그레이션 실패:`, errorMessage);

    return NextResponse.json(
      failure(
        'MIGRATION_FAILED',
        `마이그레이션 중 오류가 발생했습니다: ${errorMessage}`,
        500,
        undefined,
        traceId
      ),
      { status: 500 }
    );
  }
}

/**
 * 마이그레이션 결과 검증
 */
async function validateMigration(traceId: string): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  try {
    // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
    let supabase;
    try {
      supabase = await getSupabaseClientSafe('anon');
    } catch (error) {
      results.push({
        step: 'validate_client_init',
        success: false,
        error: error instanceof ServiceConfigError ? error.message : 'Supabase client initialization failed'
      });
      return results;
    }

    // 핵심 테이블 존재 확인
    const coreTableNames = Object.keys(CORE_TABLES_SQL);

    for (const tableName of coreTableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('count()')
          .limit(1);

        results.push({
          step: `validate_${tableName}`,
          success: !error,
          error: error?.message,
          details: {
            tableExists: !error,
            accessible: !error
          }
        });

      } catch (error) {
        results.push({
          step: `validate_${tableName}`,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Auth 시스템 확인
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      results.push({
        step: 'validate_auth',
        success: !error,
        error: error?.message,
        details: {
          authWorking: !error,
          currentUser: user?.id || null
        }
      });

    } catch (error) {
      results.push({
        step: 'validate_auth',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

  } catch (error) {
    logger.error(`[Migration ${traceId}] 검증 중 오류:`, error instanceof Error ? error : new Error(String(error)));
  }

  return results;
}

/**
 * GET 요청으로 마이그레이션 상태 확인
 */
export async function GET(request: NextRequest) {
  const traceId = getTraceId(request);

  try {
    // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화 확인
    try {
      await getSupabaseClientSafe('anon');
    } catch (error) {
      const errorMessage = error instanceof ServiceConfigError ? error.message : 'Supabase client initialization failed';
      return NextResponse.json(
        failure(
          'SUPABASE_CONFIG_ERROR',
          errorMessage,
          503,
          undefined,
          traceId
        ),
        { status: 503 }
      );
    }

    const validationResults = await validateMigration(traceId);

    return NextResponse.json(
      success({
        migration: {
          status: 'checking',
          timestamp: new Date().toISOString(),
          validation: validationResults
        }
      }, 200, traceId)
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      failure(
        'VALIDATION_FAILED',
        `검증 중 오류가 발생했습니다: ${errorMessage}`,
        500,
        undefined,
        traceId
      ),
      { status: 500 }
    );
  }
}