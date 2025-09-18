-- Story 테이블 생성 (Prisma 스키마와 일치)
-- 이미 dual-storage-service에서 참조되고 있으나 테이블 부재로 실패 중

CREATE TABLE IF NOT EXISTS "Story" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  one_line_story TEXT NOT NULL,
  genre TEXT NOT NULL,
  tone TEXT,
  target TEXT,
  structure JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_story_user_id ON "Story"(user_id);
CREATE INDEX IF NOT EXISTS idx_story_genre ON "Story"(genre);
CREATE INDEX IF NOT EXISTS idx_story_created_at ON "Story"(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_search ON "Story" USING gin(to_tsvector('english', title || ' ' || one_line_story));

-- RLS 정책 설정 (보안)
ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;

-- 자신의 스토리만 조회 가능
CREATE POLICY "Users can view their own stories" ON "Story"
  FOR SELECT USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

-- 자신의 스토리만 생성 가능
CREATE POLICY "Users can create their own stories" ON "Story"
  FOR INSERT WITH CHECK (
    user_id IS NULL OR
    user_id = auth.uid()
  );

-- 자신의 스토리만 수정 가능
CREATE POLICY "Users can update their own stories" ON "Story"
  FOR UPDATE USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

-- 자신의 스토리만 삭제 가능
CREATE POLICY "Users can delete their own stories" ON "Story"
  FOR DELETE USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

-- 업데이트 트리거 설정
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_story_updated_at
  BEFORE UPDATE ON "Story"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE "Story" IS '스토리 정보 - Prisma와 동기화됨 (dual-storage)';