# Environment Setup Guide

## 필수 환경변수 설정

### 1. Supabase 설정

1. [Supabase 대시보드](https://supabase.com/dashboard)에서 프로젝트 생성
2. Settings > API 에서 다음 값 복사:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`

3. SQL Editor에서 `/docs/supabase-schema.sql` 파일 내용 실행

### 2. Gemini API 설정

1. [Google AI Studio](https://makersuite.google.com/app/apikey)에서 API 키 생성
2. `GEMINI_API_KEY`에 생성된 키 입력

### 3. .env.local 파일 생성

```bash
cp .env.example .env.local
```

그 후 실제 값으로 교체:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=AIzaSyC...
```

## 데이터베이스 스키마 실행

Supabase SQL Editor에서 다음 파일 실행:
- `/docs/supabase-schema.sql`

## 검증

환경변수 설정 후 다음 명령으로 확인:

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000`에 접속하여 다음 확인:
- 로그인/회원가입 기능
- 시나리오 생성 기능
- 스토리 생성 기능
- 숏트 생성 기능

## 트러블슈팅

### Supabase 연결 실패
- URL과 키가 정확한지 확인
- RLS 정책이 올바르게 설정되었는지 확인

### Gemini API 오류
- API 키가 유효한지 확인
- 요청 한도 초과 여부 확인

### 개발 서버 오류
- TypeScript 컴파일 오류 해결 필요
- 종속성 설치: `pnpm install`