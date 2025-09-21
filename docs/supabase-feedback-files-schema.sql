-- =================================================================
-- Supabase Schema: Feedback Files System
-- 피드백 파일 업로드 시스템을 위한 테이블 스키마
-- =================================================================

-- Create feedback_files table for storing file metadata
CREATE TABLE IF NOT EXISTS public.feedback_files (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys and relationships
    feedback_id VARCHAR(255) NOT NULL, -- 피드백 ID (비디오 버전 ID 등)

    -- File information
    filename VARCHAR(255) NOT NULL, -- 저장된 파일명 (UUID 기반)
    original_name VARCHAR(255) NOT NULL, -- 원본 파일명
    storage_path TEXT NOT NULL, -- Supabase Storage 경로
    public_url TEXT NOT NULL, -- 공개 접근 URL

    -- File metadata
    mime_type VARCHAR(100) NOT NULL, -- MIME 타입
    file_size BIGINT NOT NULL, -- 파일 크기 (bytes)
    file_category VARCHAR(50) NOT NULL CHECK (file_category IN ('video', 'image', 'document')), -- 파일 카테고리

    -- Upload status and tracking
    upload_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'completed', 'error')),
    uploaded_by VARCHAR(255), -- 업로드한 사용자 (nickname 등)

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_feedback_files_feedback_id ON public.feedback_files(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_files_category ON public.feedback_files(file_category);
CREATE INDEX IF NOT EXISTS idx_feedback_files_status ON public.feedback_files(upload_status);
CREATE INDEX IF NOT EXISTS idx_feedback_files_created_at ON public.feedback_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_files_uploaded_by ON public.feedback_files(uploaded_by);

-- Create compound index for common queries
CREATE INDEX IF NOT EXISTS idx_feedback_files_feedback_status ON public.feedback_files(feedback_id, upload_status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_feedback_files_updated_at ON public.feedback_files;
CREATE TRIGGER trigger_update_feedback_files_updated_at
    BEFORE UPDATE ON public.feedback_files
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_files_updated_at();

-- Row Level Security (RLS) policies
ALTER TABLE public.feedback_files ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read feedback files (for public sharing)
CREATE POLICY "Anyone can read feedback files" ON public.feedback_files
    FOR SELECT USING (true);

-- Policy: Allow insert for authenticated users or users with valid token
CREATE POLICY "Allow insert feedback files" ON public.feedback_files
    FOR INSERT WITH CHECK (true); -- 현재는 모든 삽입 허용, 추후 인증 로직 추가 가능

-- Policy: Allow update for file owners or admin
CREATE POLICY "Allow update own feedback files" ON public.feedback_files
    FOR UPDATE USING (
        uploaded_by = current_setting('request.jwt.claims', true)::json->>'nickname'
        OR auth.role() = 'service_role'
    );

-- Policy: Allow delete for file owners or admin
CREATE POLICY "Allow delete own feedback files" ON public.feedback_files
    FOR DELETE USING (
        uploaded_by = current_setting('request.jwt.claims', true)::json->>'nickname'
        OR auth.role() = 'service_role'
    );

-- Create storage bucket if not exists (run this manually in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-uploads', 'feedback-uploads', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for feedback-uploads bucket
-- Note: These need to be created in Supabase dashboard or via SQL in the storage schema

-- Allow anyone to read files (for public sharing)
-- CREATE POLICY "Anyone can read feedback files" ON storage.objects FOR SELECT USING (bucket_id = 'feedback-uploads');

-- Allow authenticated users to upload files
-- CREATE POLICY "Authenticated users can upload feedback files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'feedback-uploads');

-- Allow users to delete their own files
-- CREATE POLICY "Users can delete own feedback files" ON storage.objects FOR DELETE USING (bucket_id = 'feedback-uploads');

-- =================================================================
-- Helper Views and Functions
-- =================================================================

-- Create view for file statistics by feedback
CREATE OR REPLACE VIEW feedback_file_stats AS
SELECT
    feedback_id,
    COUNT(*) as total_files,
    SUM(CASE WHEN file_category = 'video' THEN 1 ELSE 0 END) as video_count,
    SUM(CASE WHEN file_category = 'image' THEN 1 ELSE 0 END) as image_count,
    SUM(CASE WHEN file_category = 'document' THEN 1 ELSE 0 END) as document_count,
    SUM(file_size) as total_size,
    COUNT(CASE WHEN upload_status = 'completed' THEN 1 END) as completed_files,
    COUNT(CASE WHEN upload_status = 'error' THEN 1 END) as failed_files,
    MAX(created_at) as last_upload_at
FROM public.feedback_files
GROUP BY feedback_id;

-- Create function to get formatted file size
CREATE OR REPLACE FUNCTION format_file_size(size_bytes BIGINT)
RETURNS TEXT AS $$
BEGIN
    IF size_bytes < 1024 THEN
        RETURN size_bytes || ' Bytes';
    ELSIF size_bytes < 1024 * 1024 THEN
        RETURN ROUND(size_bytes::NUMERIC / 1024, 2) || ' KB';
    ELSIF size_bytes < 1024 * 1024 * 1024 THEN
        RETURN ROUND(size_bytes::NUMERIC / (1024 * 1024), 2) || ' MB';
    ELSE
        RETURN ROUND(size_bytes::NUMERIC / (1024 * 1024 * 1024), 2) || ' GB';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to clean up old failed uploads (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_failed_uploads(older_than_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.feedback_files
    WHERE upload_status = 'error'
    AND created_at < NOW() - INTERVAL '1 day' * older_than_days;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- Sample Data (for testing - remove in production)
-- =================================================================

-- Insert sample feedback file (for testing only)
-- INSERT INTO public.feedback_files (
--     feedback_id, filename, original_name, storage_path, public_url,
--     mime_type, file_size, file_category, upload_status, uploaded_by
-- ) VALUES (
--     'sample-feedback-v1',
--     'uuid-sample-file.mp4',
--     'sample-video.mp4',
--     'feedback/sample-feedback-v1/video/2024/01/uuid-sample-file.mp4',
--     'https://your-project.supabase.co/storage/v1/object/public/feedback-uploads/feedback/sample-feedback-v1/video/2024/01/uuid-sample-file.mp4',
--     'video/mp4',
--     15728640, -- 15MB
--     'video',
--     'completed',
--     'test-user'
-- );

-- =================================================================
-- Verification Queries (run these to verify the schema)
-- =================================================================

-- Check table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'feedback_files'
-- ORDER BY ordinal_position;

-- Check indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'feedback_files';

-- Check RLS policies
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'feedback_files';

-- Test file stats view
-- SELECT * FROM feedback_file_stats;

-- Test file size formatting function
-- SELECT format_file_size(1024), format_file_size(1048576), format_file_size(1073741824);

COMMENT ON TABLE public.feedback_files IS '피드백 시스템의 파일 메타데이터를 저장하는 테이블';
COMMENT ON COLUMN public.feedback_files.feedback_id IS '피드백 ID (비디오 버전 ID 등과 연결)';
COMMENT ON COLUMN public.feedback_files.storage_path IS 'Supabase Storage 내 파일 경로';
COMMENT ON COLUMN public.feedback_files.file_category IS '파일 카테고리: video, image, document';
COMMENT ON COLUMN public.feedback_files.upload_status IS '업로드 상태: pending, uploading, completed, error';