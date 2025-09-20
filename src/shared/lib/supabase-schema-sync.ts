/**
 * Supabase 스키마 동기화 유틸리티
 * Prisma 스키마와 Supabase 테이블을 동기화
 */

import { getSupabaseClientSafe } from './supabase-safe';
import { logger } from './logger';


export interface SchemaSyncResult {
  success: boolean;
  tablesCreated: string[];
  errors: string[];
}

/**
 * 필수 테이블들을 Supabase에 생성
 */
export async function createMissingTables(): Promise<SchemaSyncResult> {
  const result: SchemaSyncResult = {
    success: true,
    tablesCreated: [],
    errors: []
  };

  try {
    const supabase = await getSupabaseClientSafe('admin');

    // Story 테이블 생성 SQL
  const storyTableSQL = `
    -- Story 테이블 생성 (dual-storage에서 이미 사용 중)
    CREATE TABLE IF NOT EXISTS "Story" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      one_line_story TEXT NOT NULL,
      genre TEXT NOT NULL,
      tone TEXT,
      target TEXT,
      structure JSONB,
      user_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 인덱스 생성
    CREATE INDEX IF NOT EXISTS idx_story_user_id ON "Story"(user_id);
    CREATE INDEX IF NOT EXISTS idx_story_genre ON "Story"(genre);
    CREATE INDEX IF NOT EXISTS idx_story_created_at ON "Story"(created_at DESC);

    -- RLS 활성화
    ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;

    -- 정책: 사용자는 자신의 스토리 조회 가능
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'Story' AND policyname = 'Users can view their own stories'
      ) THEN
        CREATE POLICY "Users can view their own stories" ON "Story"
          FOR SELECT USING (
            user_id IS NULL OR
            user_id::text = auth.uid()::text
          );
      END IF;
    END
    $$;

    -- 정책: 사용자는 자신의 스토리 생성 가능
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'Story' AND policyname = 'Users can create their own stories'
      ) THEN
        CREATE POLICY "Users can create their own stories" ON "Story"
          FOR INSERT WITH CHECK (
            user_id IS NULL OR
            user_id::text = auth.uid()::text
          );
      END IF;
    END
    $$;
  `;

  // Scenario 테이블 생성 SQL
  const scenarioTableSQL = `
    -- Scenario 테이블 생성
    CREATE TABLE IF NOT EXISTS "Scenario" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      logline TEXT,
      structure4 JSONB,
      shots12 JSONB,
      pdf_url TEXT,
      version INTEGER DEFAULT 1,
      created_by TEXT,
      user_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_scenario_user_id ON "Scenario"(user_id);
    CREATE INDEX IF NOT EXISTS idx_scenario_created_at ON "Scenario"(created_at DESC);

    ALTER TABLE "Scenario" ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'Scenario' AND policyname = 'Users can view their own scenarios'
      ) THEN
        CREATE POLICY "Users can view their own scenarios" ON "Scenario"
          FOR SELECT USING (
            user_id IS NULL OR
            user_id::text = auth.uid()::text
          );
      END IF;
    END
    $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'Scenario' AND policyname = 'Users can create their own scenarios'
      ) THEN
        CREATE POLICY "Users can create their own scenarios" ON "Scenario"
          FOR INSERT WITH CHECK (
            user_id IS NULL OR
            user_id::text = auth.uid()::text
          );
      END IF;
    END
    $$;
  `;

  // 트리거 함수 생성 (한 번만)
  const triggerFunctionSQL = `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `;

    // 1. 트리거 함수 생성
    logger.info('🔧 업데이트 트리거 함수 생성 중...');
    const { error: triggerError } = await supabase.rpc('exec_sql', {
      sql: triggerFunctionSQL
    });

    if (triggerError) {
      console.warn('⚠️ 트리거 함수 생성 실패 (이미 존재할 수 있음):', triggerError.message);
    } else {
      logger.info('✅ 트리거 함수 생성 성공');
    }

    // 2. Story 테이블 생성
    logger.info('📦 Story 테이블 생성 중...');
    const { error: storyError } = await supabase.rpc('exec_sql', {
      sql: storyTableSQL
    });

    if (storyError) {
      result.errors.push(`Story 테이블 생성 실패: ${storyError.message}`);
      console.error('❌ Story 테이블 생성 실패:', storyError);
    } else {
      result.tablesCreated.push('Story');
      logger.info('✅ Story 테이블 생성 성공');

      // Story 업데이트 트리거 생성
      const storyTriggerSQL = `
        DROP TRIGGER IF EXISTS update_story_updated_at ON "Story";
        CREATE TRIGGER update_story_updated_at
          BEFORE UPDATE ON "Story"
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `;

      const { error: storyTriggerError } = await supabase.rpc('exec_sql', {
        sql: storyTriggerSQL
      });

      if (storyTriggerError) {
        console.warn('⚠️ Story 트리거 생성 실패:', storyTriggerError.message);
      } else {
        logger.info('✅ Story 트리거 생성 성공');
      }
    }

    // 3. Scenario 테이블 생성
    logger.info('📦 Scenario 테이블 생성 중...');
    const { error: scenarioError } = await supabase.rpc('exec_sql', {
      sql: scenarioTableSQL
    });

    if (scenarioError) {
      result.errors.push(`Scenario 테이블 생성 실패: ${scenarioError.message}`);
      console.error('❌ Scenario 테이블 생성 실패:', scenarioError);
    } else {
      result.tablesCreated.push('Scenario');
      logger.info('✅ Scenario 테이블 생성 성공');

      // Scenario 업데이트 트리거 생성
      const scenarioTriggerSQL = `
        DROP TRIGGER IF EXISTS update_scenario_updated_at ON "Scenario";
        CREATE TRIGGER update_scenario_updated_at
          BEFORE UPDATE ON "Scenario"
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `;

      const { error: scenarioTriggerError } = await supabase.rpc('exec_sql', {
        sql: scenarioTriggerSQL
      });

      if (scenarioTriggerError) {
        console.warn('⚠️ Scenario 트리거 생성 실패:', scenarioTriggerError.message);
      } else {
        logger.info('✅ Scenario 트리거 생성 성공');
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors.push(`스키마 동기화 중 예외 발생: ${errorMessage}`);
    console.error('❌ 스키마 동기화 예외:', error);
  }

  // 최종 결과
  if (result.errors.length > 0) {
    result.success = false;
  }

  logger.info('🎯 스키마 동기화 완료:', {
    success: result.success,
    tablesCreated: result.tablesCreated,
    errorCount: result.errors.length
  });

  return result;
}

/**
 * 테이블 존재 여부 확인
 */
export async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const supabase = await getSupabaseClientSafe('admin');
    const { data, error: queryError } = await supabase
      .from(tableName)
      .select('count(*)')
      .limit(1);

    return !queryError;
  } catch {
    return false;
  }
}

/**
 * 필수 테이블들의 존재 여부 일괄 확인
 */
export async function checkAllRequiredTables(): Promise<Record<string, boolean>> {
  const requiredTables = ['Story', 'Scenario', 'Prompt', 'VideoAsset'];
  const results: Record<string, boolean> = {};

  for (const table of requiredTables) {
    results[table] = await checkTableExists(table);
  }

  return results;
}