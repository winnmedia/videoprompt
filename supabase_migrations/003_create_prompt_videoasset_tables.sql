-- Prompt 테이블 생성 (Prisma 스키마와 일치)
CREATE TABLE IF NOT EXISTS "Prompt" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES "Scenario"(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL,
  timeline JSONB NOT NULL,
  negative JSONB,
  version INTEGER DEFAULT 1,
  user_id UUID REFERENCES auth.users(id),
  ai_analysis JSONB,
  cinegenius_version TEXT,
  generation_control JSONB,
  project_config JSONB,
  project_id UUID,
  user_input JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VideoAsset 테이블 생성 (Prisma 스키마와 일치)
CREATE TABLE IF NOT EXISTS "VideoAsset" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES "Prompt"(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  url TEXT,
  codec TEXT,
  duration INTEGER,
  version INTEGER DEFAULT 1,
  user_id UUID REFERENCES auth.users(id),
  generation_metadata JSONB DEFAULT '{}',
  quality_score DECIMAL(3,2) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt 인덱스
CREATE INDEX IF NOT EXISTS idx_prompt_scenario_id ON "Prompt"(scenario_id);
CREATE INDEX IF NOT EXISTS idx_prompt_user_id ON "Prompt"(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_created_at ON "Prompt"(created_at DESC);

-- VideoAsset 인덱스
CREATE INDEX IF NOT EXISTS idx_videoasset_prompt_id ON "VideoAsset"(prompt_id);
CREATE INDEX IF NOT EXISTS idx_videoasset_status_provider ON "VideoAsset"(status, provider);
CREATE INDEX IF NOT EXISTS idx_videoasset_user_id ON "VideoAsset"(user_id);
CREATE INDEX IF NOT EXISTS idx_videoasset_created_at ON "VideoAsset"(created_at DESC);

-- RLS 정책 - Prompt
ALTER TABLE "Prompt" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prompts" ON "Prompt"
  FOR SELECT USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can create their own prompts" ON "Prompt"
  FOR INSERT WITH CHECK (
    user_id IS NULL OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can update their own prompts" ON "Prompt"
  FOR UPDATE USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own prompts" ON "Prompt"
  FOR DELETE USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

-- RLS 정책 - VideoAsset
ALTER TABLE "VideoAsset" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own video assets" ON "VideoAsset"
  FOR SELECT USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can create their own video assets" ON "VideoAsset"
  FOR INSERT WITH CHECK (
    user_id IS NULL OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can update their own video assets" ON "VideoAsset"
  FOR UPDATE USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own video assets" ON "VideoAsset"
  FOR DELETE USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

-- 업데이트 트리거
CREATE TRIGGER update_prompt_updated_at
  BEFORE UPDATE ON "Prompt"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videoasset_updated_at
  BEFORE UPDATE ON "VideoAsset"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE "Prompt" IS '프롬프트 정보 - planning/prompt API 사용';
COMMENT ON TABLE "VideoAsset" IS '비디오 에셋 정보 - planning/video-assets API 사용';