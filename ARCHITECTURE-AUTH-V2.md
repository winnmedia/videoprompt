# 🔐 VideoPlanet 인증 시스템 v2.0 아키텍처 문서

## 📋 개요

본 문서는 VideoPlanet의 FSD 경계를 준수하는 단일 인증 진입점(SSOT) 아키텍처의 완전한 재설계 결과를 기록합니다.

### 🎯 주요 성과

- **중복 제거**: 4개의 중복 인증 모듈을 1개의 단일 진입점으로 통합
- **코드 단순화**: /api/auth/me 라우트 430줄 → 80줄 (81% 감소)
- **FSD 경계 준수**: 모든 아키텍처 위반사항 해결
- **$300 사건 방지**: 무한 루프 차단 및 비용 제한 시스템 내장
- **Contract-First**: 완전한 타입 안전성 및 런타임 검증

## 🏗️ 아키텍처 구조

### 레이어 구조 (FSD 준수)

```
src/
├── shared/
│   ├── contracts/
│   │   └── auth.contract.ts          # 📜 Contract-First 타입 정의
│   └── lib/
│       ├── auth-core.ts              # 🔐 단일 인증 진입점 (SSOT)
│       ├── auth-middleware-v2.ts     # 🛡️ FSD 준수 미들웨어
│       └── environment-validator.ts  # 🔧 환경변수 검증 시스템
├── app/
│   └── api/
│       └── auth/
│           └── me/
│               └── route.ts          # ✨ 단순화된 API 라우트
└── __tests__/
    └── auth/
        ├── auth-core-v2.test.ts      # 🧪 TDD 테스트
        ├── environment-validator.test.ts
        └── auth-middleware-v2.test.ts
```

### 의존성 흐름 (단방향)

```
app/api/auth/me/route.ts
    ↓
shared/lib/auth-middleware-v2.ts
    ↓
shared/lib/auth-core.ts
    ↓
shared/contracts/auth.contract.ts
    ↓
shared/lib/environment-validator.ts
```

## 🔧 핵심 컴포넌트

### 1. Contract-First 타입 시스템

**파일**: `src/shared/contracts/auth.contract.ts`

```typescript
// 핵심 타입 (Discriminated Union)
export type User = AuthenticatedUser | GuestUser;

// 인증 결과 (성공/실패 구분)
export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; error: AuthError };

// 타입 가드
export function isAuthenticatedUser(user: User): user is AuthenticatedUser;
export function isGuestUser(user: User): user is GuestUser;
```

**장점**:
- 컴파일 타임 타입 안전성
- 런타임 Zod 스키마 검증
- 명확한 Contract 정의

### 2. 단일 인증 진입점 (SSOT)

**파일**: `src/shared/lib/auth-core.ts`

```typescript
export async function authenticateRequest(
  req: NextRequest,
  options: Partial<AuthOptions> = {}
): Promise<AuthResult>
```

**인증 우선순위**:
1. **Supabase** (최우선) - 현대적 인증
2. **Legacy JWT** (백업) - 기존 시스템 호환
3. **Guest** (허용 시) - 게스트 모드

**특징**:
- 환경변수 검증 및 Graceful Degradation
- Rate Limiting 및 비용 제한 ($300 사건 방지)
- 통합 로깅 및 추적 (Request ID)

### 3. FSD 준수 미들웨어

**파일**: `src/shared/lib/auth-middleware-v2.ts`

```typescript
// 기본 인증 미들웨어
export function withAuth(handler: AuthenticatedHandler, options?: MiddlewareOptions)

// 특화된 미들웨어들
export function withOptionalAuth(handler)  // 게스트 허용
export function withAdminAuth(handler)     // 관리자 전용
export function withEmailVerified(handler) // 이메일 인증 필요
export function withGuestOnly(handler)     // 게스트 전용
```

**장점**:
- 단일 책임 원칙 준수
- 명확한 에러 처리
- 표준화된 응답 헤더
- 타입 안전성 보장

### 4. 환경변수 검증 시스템

**파일**: `src/shared/lib/environment-validator.ts`

```typescript
export function validateEnvironment(): EnvironmentValidationResult;

// Degradation Mode 자동 결정
type DegradationMode = 'full' | 'degraded' | 'disabled';

// Capabilities 계산
interface Capabilities {
  supabaseAuth: boolean;
  legacyAuth: boolean;
  database: boolean;
  fullAdmin: boolean;
}
```

**Degradation Mode 규칙**:
- **Full**: 모든 환경변수 존재
- **Degraded**: 일부 기능만 가능
- **Disabled**: 필수 환경변수 누락

## 🛡️ $300 사건 방지 시스템

### 무한 루프 차단 메커니즘

1. **Rate Limiting**
   - `/api/auth/refresh`: 분당 3회 제한
   - 일반 API: 분당 60회 제한

2. **HTTP 상태 코드 규칙**
   ```
   400 Bad Request    → 클라이언트가 재시도하지 않음
   401 Unauthorized   → 토큰 갱신 시도
   429 Too Many Req   → 일시적 차단
   ```

3. **ETag 캐싱**
   ```typescript
   // 클라이언트 구현 예시
   const response = await fetch('/api/auth/me', {
     headers: {
       'If-None-Match': localStorage.getItem('user-etag')
     }
   });
   if (response.status === 304) {
     // 캐시된 데이터 사용
   }
   ```

4. **useEffect 안전 패턴**
   ```typescript
   // ✅ 올바른 패턴
   useEffect(() => {
     checkAuth();
   }, []); // 빈 배열 - 마운트 시 1회만

   // ❌ 절대 금지 - $300 폭탄
   useEffect(() => {
     checkAuth();
   }, [checkAuth]);
   ```

## 📊 성능 최적화

### 코드 사이즈 감소

| 컴포넌트 | Before | After | 개선율 |
|----------|--------|-------|--------|
| /api/auth/me | 430줄 | 80줄 | -81% |
| 인증 모듈 수 | 4개 | 1개 | -75% |
| 중복 로직 | 다수 | 0개 | -100% |

### 메모리 및 성능

- **환경변수 캐싱**: 초기화 후 메모리 캐시
- **ETag 지원**: 클라이언트 캐싱으로 불필요한 요청 방지
- **Graceful Degradation**: DB 장애 시에도 기본 기능 유지

## 🧪 테스트 전략 (TDD)

### 테스트 커버리지

1. **auth-core-v2.test.ts** (단위 테스트)
   - 환경변수 검증
   - 인증 우선순위
   - Contract 준수
   - Rate Limiting

2. **environment-validator.test.ts** (단위 테스트)
   - 스키마 검증
   - Degradation Mode 결정
   - Capabilities 계산
   - 보안 마스킹

3. **auth-middleware-v2.test.ts** (통합 테스트)
   - 미들웨어 옵션 동작
   - 에러 처리
   - 응답 헤더
   - 타입 안전성

### 테스트 원칙

- **Red-Green-Refactor**: TDD 원칙 준수
- **Contract 기반**: 런타임 스키마 검증
- **Mock 최소화**: 실제 구현에 가까운 테스트
- **Edge Case**: 에러 상황 및 경계 조건 테스트

## 🔄 마이그레이션 가이드

### 기존 코드에서 새 아키텍처로

#### Before (레거시)
```typescript
// 🚨 FSD 위반 및 중복 로직
import { withAuth } from '@/shared/lib/auth-middleware';
import { requireSupabaseAuthentication } from '@/shared/lib/supabase-auth';
import { getUserIdFromRequest } from '@/shared/lib/auth';

export const GET = withAuth(async (req, { user }) => {
  // 복잡한 토큰 검증 로직...
  const actualToken = await getActualAccessToken(req, user);
  // 400줄의 복잡한 코드...
});
```

#### After (v2.0)
```typescript
// ✅ FSD 준수 및 단순화
import { withOptionalAuth } from '@/shared/lib/auth-middleware-v2';

export const GET = withOptionalAuth(async (req, { user, authContext }) => {
  // 단순하고 명확한 로직
  const responseData = {
    id: user.id,
    email: user.email,
    isAuthenticated: isAuthenticatedUser(user)
  };
  return success(responseData, 200, traceId);
}, {
  endpoint: '/api/auth/me'
});
```

### 단계별 마이그레이션

1. **Contract 도입**: 기존 타입을 Contract로 교체
2. **Core 교체**: auth-core.ts로 인증 로직 통합
3. **미들웨어 교체**: v2 미들웨어로 업그레이드
4. **테스트 추가**: TDD 테스트 작성
5. **레거시 제거**: 기존 중복 파일 삭제

## 🔐 보안 강화

### 환경변수 보안

```typescript
// 민감 정보 마스킹
function maskKey(key?: string): string {
  if (!key) return 'not set';
  return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`;
}
```

### 토큰 검증 강화

- **JWT 형식 검증**: 기본 형식 체크
- **Supabase 토큰**: iss 필드로 검증
- **만료 시간**: 자동 만료 처리
- **Rate Limiting**: 무한 요청 방지

## 📈 모니터링 및 로깅

### 구조화된 로깅

```typescript
console.log(`🔐 Auth request started`, {
  requestId,
  url: req.url,
  options: validatedOptions
});

console.log(`✅ Authentication successful`, {
  requestId,
  userId: authResult.context.user.id,
  tokenType: authResult.context.user.tokenType,
  degradationMode: authResult.context.degradationMode,
  duration: Date.now() - startTime
});
```

### 추적 가능한 요청

- **Request ID**: 모든 요청에 고유 ID 할당
- **Performance Timing**: 응답 시간 측정
- **Error Context**: 에러 발생 시 충분한 컨텍스트 제공

## 🚀 배포 및 운영

### 환경별 설정

| 환경 | Degradation Mode | 필수 검증 | 특징 |
|------|------------------|-----------|------|
| Production | Full/Degraded | 엄격 | 모든 에러 추적 |
| Development | Any | 관대 | 디버그 정보 출력 |
| Test | Any | 최소 | Mock 친화적 |

### 장애 대응

1. **Graceful Degradation**: DB 장애 시 토큰 기반 응답
2. **Circuit Breaker**: 외부 서비스 장애 시 격리
3. **Fallback**: Supabase 장애 시 Legacy JWT 사용

## 🎯 결론

### 달성된 목표

✅ **FSD 경계 준수**: 모든 아키텍처 위반사항 해결
✅ **단일 진입점**: 중복 로직 완전 제거
✅ **Contract-First**: 타입 안전성 및 런타임 검증
✅ **$300 사건 방지**: 무한 루프 차단 시스템
✅ **TDD 적용**: 포괄적인 테스트 커버리지
✅ **성능 최적화**: 81% 코드 감소

### 향후 발전 방향

1. **Redis 통합**: 분산 Rate Limiting
2. **Metrics 수집**: Prometheus/Grafana 연동
3. **A/B 테스팅**: 인증 플로우 최적화
4. **PWA 지원**: 오프라인 인증 처리

이 아키텍처는 확장 가능하고 유지보수하기 쉬우며, VideoPlanet의 장기적인 성장을 지원할 수 있는 견고한 기반을 제공합니다.