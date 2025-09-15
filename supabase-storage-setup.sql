-- VideoPlanet Storage 버킷 설정
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. videos 버킷 생성/업데이트 (600MB 제한)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('videos', 'videos', true, 629145600) -- 600MB limit
ON CONFLICT (id) DO UPDATE SET file_size_limit = 629145600;

-- 2. images 버킷 생성 (스토리보드용, 10MB 제한)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('images', 'images', true, 10485760) -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- 3. documents 버킷 생성 (PDF용, 10MB 제한)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', true, 10485760) -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- 4. 업로드 정책 설정
CREATE POLICY "Videos upload policy" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Videos public access" ON storage.objects
FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Images upload policy" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'images');

CREATE POLICY "Images public access" ON storage.objects
FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Documents upload policy" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Documents public access" ON storage.objects
FOR SELECT USING (bucket_id = 'documents');

-- 5. 확인 쿼리
SELECT name, public, file_size_limit
FROM storage.buckets
WHERE name IN ('videos', 'images', 'documents');
