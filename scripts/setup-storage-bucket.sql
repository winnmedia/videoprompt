-- Supabase Storage 버킷 및 RLS 정책 설정
-- 영상 업로드 시스템을 위한 Storage 설정

-- 1. 'video-uploads' 버킷 생성 (public 접근 허용)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-uploads',
  'video-uploads',
  true,
  104857600, -- 100MB
  ARRAY['video/mp4', 'video/webm', 'video/mov', 'video/quicktime', 'video/avi', 'video/x-msvideo']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. 인증된 사용자만 업로드 허용하는 RLS 정책
CREATE POLICY "Authenticated users can upload videos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'video-uploads'
    AND auth.role() = 'authenticated'
  );

-- 3. 모든 사용자가 비디오 읽기 허용 (public 버킷)
CREATE POLICY "Anyone can view videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'video-uploads');

-- 4. 업로드한 사용자만 자신의 파일 삭제 허용
CREATE POLICY "Users can delete their own videos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'video-uploads'
    AND auth.uid() = owner
  );

-- 5. 업로드한 사용자만 자신의 파일 업데이트 허용
CREATE POLICY "Users can update their own videos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'video-uploads'
    AND auth.uid() = owner
  );

-- RLS 활성화 확인
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;