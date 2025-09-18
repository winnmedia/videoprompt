-- Scenario 테이블 생성 (Prisma 스키마와 일치)
-- planning/scenario API에서 사용

CREATE TABLE IF NOT EXISTS "Scenario" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  logline TEXT,
  structure4 JSONB,
  shots12 JSONB,
  pdf_url TEXT,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_scenario_user_id ON "Scenario"(user_id);
CREATE INDEX IF NOT EXISTS idx_scenario_created_at ON "Scenario"(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenario_title ON "Scenario"(title);

-- RLS 정책 설정
ALTER TABLE "Scenario" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scenarios" ON "Scenario"
  FOR SELECT USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can create their own scenarios" ON "Scenario"
  FOR INSERT WITH CHECK (
    user_id IS NULL OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can update their own scenarios" ON "Scenario"
  FOR UPDATE USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own scenarios" ON "Scenario"
  FOR DELETE USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

-- 업데이트 트리거
CREATE TRIGGER update_scenario_updated_at
  BEFORE UPDATE ON "Scenario"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE "Scenario" IS '시나리오 정보 - planning/scenario API 사용';