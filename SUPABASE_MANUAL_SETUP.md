# 📋 Supabase 수동 설정 가이드

마이그레이션 완료 후 필요한 수동 작업들을 단계별로 안내합니다.

## 🎯 목표
1. ✅ **Schema Cache 새로고침** - 테이블 접근 활성화
2. ✅ **Storage Bucket 생성** - 비디오 업로드 활성화
3. ✅ **RLS 정책 조정** - 시드 데이터 삽입 가능

---

## 🔧 **1단계: Supabase 대시보드 접속**

### 1.1 대시보드 로그인
```bash
# 현재 프로젝트의 Supabase URL 확인
echo "NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

1. 브라우저에서 [https://supabase.com/dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 목록에서 현재 프로젝트 선택
3. 왼쪽 메뉴에서 작업할 섹션 선택

---

## 📊 **2단계: Schema Cache 새로고침**

### 2.1 문제 확인
현재 상태: 일부 API에서 "schema cache" 오류 발생
```bash
curl -s "http://localhost:3001/api/planning/stories" | grep "schema cache"
```

### 2.2 해결 방법

#### 옵션 A: API 스키마 새로고침 (권장)
1. **대시보드 → API 섹션**
2. **"API Docs" 탭** 클릭
3. **우측 상단 "Refresh Schema" 버튼** 클릭
4. 완료 후 2-3분 대기

#### 옵션 B: 데이터베이스 직접 접근
1. **대시보드 → SQL Editor**
2. 다음 명령어 실행:
```sql
-- Schema cache 강제 새로고침
NOTIFY pgrst, 'reload schema';

-- 테이블 존재 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'projects', 'stories', 'templates', 'video_assets');
```

### 2.3 검증
```bash
# 테이블 접근 테스트
curl -s "http://localhost:3001/api/test/supabase-tables" | jq
```

---

## 🗄️ **3단계: Storage Bucket 생성**

### 3.1 현재 상태 확인
```bash
# Storage 상태 확인
curl -s "http://localhost:3001/api/upload/video" | jq '.storageHealth'
```

### 3.2 Bucket 생성 단계

#### A. Storage 섹션 접속
1. **대시보드 → Storage** 클릭
2. **"New bucket" 버튼** 클릭

#### B. Bucket 설정
```
Bucket 이름: videos
공개 접근: ✅ Public bucket (체크)
파일 크기 제한: 50MB
허용된 MIME 타입: video/mp4, video/webm, video/mov, video/quicktime
```

#### C. 정책 설정 (선택사항)
```sql
-- Storage Policy 생성 (필요시)
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Authenticated Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');
```

### 3.3 검증
```bash
# Storage 상태 재확인
curl -s "http://localhost:3001/api/upload/video" | jq '.storageHealth'

# 업로드 테스트 (작은 비디오 파일로)
# curl -X POST "http://localhost:3001/api/upload/video" -F "video=@test.mp4"
```

---

## 🔐 **4단계: RLS 정책 조정**

### 4.1 현재 문제
Templates 시드 데이터 삽입이 RLS로 차단됨

### 4.2 임시 정책 생성

#### A. SQL Editor에서 실행
1. **대시보드 → SQL Editor**
2. 다음 SQL 실행:

```sql
-- Templates 테이블 시드 데이터 삽입을 위한 임시 정책
CREATE POLICY "Allow seed data insert" ON public.templates
FOR INSERT
WITH CHECK (true);

-- 또는 기존 정책 임시 비활성화
ALTER TABLE public.templates DISABLE ROW LEVEL SECURITY;
```

### 4.3 시드 데이터 삽입
```bash
# 시드 데이터 삽입 API 호출
curl -X POST "http://localhost:3001/api/templates/seed"
```

### 4.4 정책 복원
```sql
-- 보안 정책 다시 활성화
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- 적절한 정책으로 교체
DROP POLICY IF EXISTS "Allow seed data insert" ON public.templates;

CREATE POLICY "Public templates read" ON public.templates
FOR SELECT USING (is_public = true);

CREATE POLICY "User templates full access" ON public.templates
FOR ALL USING (auth.uid() = user_id);
```

---

## ✅ **5단계: 최종 검증**

### 5.1 통합 테스트 실행
```bash
# 전체 시스템 상태 확인
curl -s "http://localhost:3001/api/test/supabase-integration" | jq
```

### 5.2 개별 기능 테스트
```bash
# 1. 템플릿 API
curl -s "http://localhost:3001/api/templates" | jq '.success'

# 2. 인증 API
curl -s "http://localhost:3001/api/auth/me" | jq '.error'  # 401 정상

# 3. 업로드 API
curl -s "http://localhost:3001/api/upload/video" | jq '.status'

# 4. 큐 API
curl -s "http://localhost:3001/api/queue/list" | jq '.error'  # 401 정상
```

### 5.3 성공 기준
- ✅ Schema cache 오류 해결
- ✅ Storage bucket 생성 완료
- ✅ Templates API에서 실제 데이터 반환
- ✅ 모든 테이블 접근 가능

---

## 🚨 **문제해결**

### 문제 1: Schema Cache 지속
```bash
# PostgREST 재시작 (최후 수단)
# Supabase 대시보드 → Settings → API → Restart Services
```

### 문제 2: Storage 접근 불가
```bash
# Storage 정책 확인
SELECT * FROM storage.buckets WHERE name = 'videos';
SELECT * FROM storage.policies WHERE bucket_id = 'videos';
```

### 문제 3: RLS 오류 지속
```sql
-- 테이블별 RLS 상태 확인
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

---

## 📞 **지원**

작업 중 문제가 발생하면:
1. 각 단계의 검증 명령어로 상태 확인
2. 에러 메시지를 정확히 복사
3. 필요시 Supabase 대시보드 스크린샷 제공

**모든 수동 작업 완료 후 다시 통합 테스트를 실행하여 100% 성공 확인을 권장합니다!** 🎯