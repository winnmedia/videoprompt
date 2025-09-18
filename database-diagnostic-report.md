# 데이터 저장 불일치 문제 진단 보고서

## 🚨 **근본 원인 발견**

### 1. 핵심 문제: Prisma ↔ Supabase 스키마 불일치

**Prisma Schema (schema.prisma)**
```prisma
model User {
  id                 String              @id @default(uuid())
  email              String              @unique
  username           String              @unique
  passwordHash       String              @map("password_hash")
  emailVerified      Boolean             @default(false) @map("email_verified")
  // ... Prisma 전용 필드들
}
```

**Supabase Schema (supabase-migration.sql)**
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  -- password_hash 필드 없음!
  -- emailVerified 필드 없음!
)
```

### 2. DATABASE_URL 연결 문제

**현재 상태:**
- `.env.vercel`: Railway PostgreSQL URL
- Supabase Auth는 별도 인스턴스
- Prisma는 Railway 연결 시도 → "Tenant or user not found" 에러

### 3. 데이터 저장 시나리오 분석

**Register API 동작 방식:**
1. `signUpWithSupabase()` → Supabase Auth에만 저장 ✅
2. Prisma 기반 users 테이블 저장 → 실패 ❌
3. Mock 응답만 반환 → 실제 저장 안됨 ❌

## 🔍 **상세 진단 결과**

### A. 환경 변수 상태
- `DATABASE_URL`: Railway PostgreSQL (Prisma용)
- `SUPABASE_*`: 별도 Supabase 인스턴스 (Auth용)
- **결과**: 이중 저장소 설정, 동기화 없음

### B. 스키마 매핑 불일치
| 기능 | Prisma Model | Supabase Table | 상태 |
|------|-------------|----------------|------|
| User 저장 | ✅ password_hash 필드 | ❌ 필드 없음 | 불일치 |
| Email 검증 | ✅ emailVerified | ❌ 필드 다름 | 불일치 |
| 관계 설정 | ✅ 외래키 정의 | ❌ 일부 누락 | 불일치 |

### C. 데이터 흐름 단절점
```mermaid
Register API
    ↓
Supabase Auth (성공) → 사용자 생성 ✅
    ↓
Prisma DB 저장 (실패) → 스키마 불일치 ❌
    ↓
Mock 응답 반환 → 실제 저장 안됨 ❌
```

## ⚡ **긴급 수정 방안**

### 1단계: 즉시 수정 (Hot Fix)
Register API에서 실제 Supabase 테이블에 저장하도록 수정

### 2단계: 스키마 통합
Prisma 스키마를 Supabase 스키마와 완전 동기화

### 3단계: 데이터 계약 검증
TDD 기반으로 실제 저장 검증 테스트 구현

## 🛠 **구현 예정 사항**

1. **데이터 저장 수정**: Supabase 직접 저장으로 변경
2. **스키마 동기화**: Prisma ↔ Supabase 완전 매핑
3. **계약 검증**: end-to-end 실제 저장 테스트
4. **모니터링**: 실시간 데이터 무결성 검증

---
**생성 시간**: ${new Date().toISOString()}
**진단자**: Daniel (Data Lead)