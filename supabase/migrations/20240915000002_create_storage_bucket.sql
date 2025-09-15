-- Storage bucket 생성 및 설정
-- videos 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,
  52428800,  -- 50MB
  ARRAY['video/mp4', 'video/webm', 'video/mov', 'video/quicktime']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정
-- 1. 공개 읽기 정책
CREATE POLICY IF NOT EXISTS "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'videos');

-- 2. 인증된 사용자 업로드 정책
CREATE POLICY IF NOT EXISTS "Authenticated Upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'videos'
  AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- 3. 소유자 삭제 정책
CREATE POLICY IF NOT EXISTS "Owner Delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'videos'
  AND (auth.uid() = owner OR auth.role() = 'service_role')
);

-- 4. 소유자 업데이트 정책
CREATE POLICY IF NOT EXISTS "Owner Update" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'videos'
  AND (auth.uid() = owner OR auth.role() = 'service_role')
);