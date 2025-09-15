-- Schema Cache 새로고침
-- PostgREST에게 스키마를 다시 로드하도록 지시
NOTIFY pgrst, 'reload schema';

-- 추가 스키마 정보 확인
-- 테이블 목록 확인
SELECT
  table_name,
  table_type,
  is_insertable_into
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'projects', 'stories', 'templates', 'video_assets')
ORDER BY table_name;

-- 권한 확인
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('users', 'projects', 'stories', 'templates', 'video_assets')
ORDER BY table_name, grantee;