#!/usr/bin/env tsx

import { supabase, supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/db';

/**
 * Prisma 스키마를 Supabase로 마이그레이션하는 스크립트
 *
 * 단계:
 * 1. Supabase에 테이블 생성 (SQL)
 * 2. Row Level Security (RLS) 정책 설정
 * 3. 기존 Prisma 데이터 마이그레이션 (선택적)
 * 4. 연결 테스트
 */

// Supabase 테이블 생성 SQL
const SUPABASE_SCHEMA_SQL = `
-- =============================================
-- VideoPlanet Database Schema for Supabase
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User 테이블 (Supabase Auth와 연동)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Project 테이블
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB,
  tags JSONB,
  scenario TEXT,
  prompt TEXT,
  video TEXT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scene 테이블
CREATE TABLE IF NOT EXISTS public.scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  scene_data JSONB,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Story 테이블
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  genre TEXT,
  tone TEXT,
  target_audience TEXT,
  structure JSONB,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template 테이블
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags JSONB,
  scenario JSONB,
  prompt JSONB,
  is_public BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VideoAsset 테이블
CREATE TABLE IF NOT EXISTS public.video_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  duration INTEGER,
  thumbnail_url TEXT,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'processing',
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Share Token 테이블
CREATE TABLE IF NOT EXISTS public.share_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment 테이블
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Verification 테이블
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

-- users 테이블 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- projects 테이블 RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- stories 테이블 RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stories"
  ON public.stories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stories"
  ON public.stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stories"
  ON public.stories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories"
  ON public.stories FOR DELETE
  USING (auth.uid() = user_id);

-- video_assets 테이블 RLS
ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own video assets"
  ON public.video_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own video assets"
  ON public.video_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video assets"
  ON public.video_assets FOR UPDATE
  USING (auth.uid() = user_id);

-- templates 테이블 RLS
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public templates"
  ON public.templates FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create templates"
  ON public.templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON public.templates FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at);

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_status ON public.stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON public.stories(created_at);

CREATE INDEX IF NOT EXISTS idx_video_assets_user_id ON public.video_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_project_id ON public.video_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_status ON public.video_assets(status);

CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON public.share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_project_id ON public.share_tokens(project_id);

-- =============================================
-- Functions and Triggers
-- =============================================

-- Updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Updated_at 트리거 생성
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at BEFORE UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_assets_updated_at BEFORE UPDATE ON public.video_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

interface MigrationOptions {
  createTables: boolean;
  setupRLS: boolean;
  migrateData: boolean;
  dryRun: boolean;
}

class SupabaseMigrator {
  private options: MigrationOptions;

  constructor(options: Partial<MigrationOptions> = {}) {
    this.options = {
      createTables: true,
      setupRLS: true,
      migrateData: false,
      dryRun: false,
      ...options
    };
  }

  /**
   * 마이그레이션 실행
   */
  async migrate(): Promise<void> {
    console.log('🚀 Supabase 마이그레이션 시작');
    console.log('📋 옵션:', this.options);

    try {
      // 1. Admin 클라이언트 확인
      if (!supabaseAdmin) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. Admin 작업을 위해 필요합니다.');
      }

      // 2. 테이블 생성
      if (this.options.createTables) {
        await this.createTables();
      }

      // 3. 데이터 마이그레이션 (선택적)
      if (this.options.migrateData) {
        await this.migrateData();
      }

      // 4. 마이그레이션 검증
      await this.validateMigration();

      console.log('✅ Supabase 마이그레이션 완료');

    } catch (error) {
      console.error('❌ 마이그레이션 실패:', error);
      throw error;
    }
  }

  /**
   * Supabase 테이블 생성
   */
  private async createTables(): Promise<void> {
    console.log('📦 Supabase 테이블 생성 중...');

    if (this.options.dryRun) {
      console.log('🔍 DRY RUN - 실제 실행되지 않음');
      console.log('실행될 SQL:');
      console.log(SUPABASE_SCHEMA_SQL);
      return;
    }

    try {
      // SQL 스크립트를 여러 부분으로 나누어 실행
      const sqlStatements = SUPABASE_SCHEMA_SQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of sqlStatements) {
        if (statement.trim()) {
          console.log('📝 실행 중:', statement.substring(0, 50) + '...');

          const { error } = await supabaseAdmin!.rpc('exec_sql', {
            sql_query: statement
          });

          if (error && !error.message.includes('already exists')) {
            console.warn('⚠️ SQL 실행 경고:', error.message);
          }
        }
      }

      console.log('✅ 테이블 생성 완료');

    } catch (error) {
      console.error('❌ 테이블 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 기존 Prisma 데이터를 Supabase로 마이그레이션
   */
  private async migrateData(): Promise<void> {
    console.log('📊 데이터 마이그레이션 시작...');

    if (this.options.dryRun) {
      console.log('🔍 DRY RUN - 데이터 마이그레이션 시뮬레이션');
      return;
    }

    try {
      // 사용자 데이터 마이그레이션
      console.log('👥 사용자 데이터 마이그레이션...');
      const prismaUsers = await prisma.user.findMany();

      for (const user of prismaUsers) {
        const { error } = await supabaseAdmin!
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            username: user.username,
            avatar_url: user.avatarUrl,
            role: user.role,
            preferences: user.preferences,
            email_verified: user.emailVerified,
            verified_at: user.verifiedAt,
            created_at: user.createdAt,
            updated_at: user.updatedAt
          });

        if (error) {
          console.warn(`⚠️ 사용자 ${user.email} 마이그레이션 실패:`, error.message);
        }
      }

      // 프로젝트 데이터 마이그레이션
      console.log('📁 프로젝트 데이터 마이그레이션...');
      const prismaProjects = await prisma.project.findMany();

      for (const project of prismaProjects) {
        const { error } = await supabaseAdmin!
          .from('projects')
          .upsert({
            id: project.id,
            title: project.title,
            description: project.description,
            thumbnail_url: project.thumbnailUrl,
            status: project.status,
            metadata: project.metadata,
            tags: project.tags,
            scenario: project.scenario,
            prompt: project.prompt,
            video: project.video,
            user_id: project.userId,
            created_at: project.createdAt,
            updated_at: project.updatedAt
          });

        if (error) {
          console.warn(`⚠️ 프로젝트 ${project.title} 마이그레이션 실패:`, error.message);
        }
      }

      console.log('✅ 데이터 마이그레이션 완료');

    } catch (error) {
      console.error('❌ 데이터 마이그레이션 실패:', error);
      throw error;
    }
  }

  /**
   * 마이그레이션 결과 검증
   */
  private async validateMigration(): Promise<void> {
    console.log('🔍 마이그레이션 검증 중...');

    try {
      // 테이블 존재 확인
      const { data: tables, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

      if (error) {
        console.log('📊 Supabase 테이블 상태 확인 (직접 쿼리)...');

        // 각 핵심 테이블 확인
        const coreTables = ['users', 'projects', 'stories', 'templates', 'video_assets'];

        for (const tableName of coreTables) {
          try {
            const { data, error: tableError } = await supabase
              .from(tableName)
              .select('count(*)')
              .limit(1);

            if (tableError) {
              console.error(`❌ 테이블 ${tableName} 확인 실패:`, tableError.message);
            } else {
              console.log(`✅ 테이블 ${tableName} 존재 확인`);
            }
          } catch (err) {
            console.warn(`⚠️ 테이블 ${tableName} 접근 불가`);
          }
        }
      } else {
        console.log(`✅ ${tables?.length || 0}개 테이블 확인됨`);
      }

      console.log('✅ 마이그레이션 검증 완료');

    } catch (error) {
      console.warn('⚠️ 검증 중 경고:', error);
    }
  }
}

// CLI 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipData = args.includes('--skip-data');

  const migrator = new SupabaseMigrator({
    createTables: true,
    setupRLS: true,
    migrateData: !skipData,
    dryRun
  });

  migrator.migrate()
    .then(() => {
      console.log('🎉 마이그레이션 성공');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 마이그레이션 실패:', error);
      process.exit(1);
    });
}

export { SupabaseMigrator };