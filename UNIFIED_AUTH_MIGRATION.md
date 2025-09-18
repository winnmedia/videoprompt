# VideoPlanet 통합 인증 시스템 - 마이그레이션 가이드

## 🎯 개요

VideoPlanet의 인증 시스템을 Supabase + 레거시 JWT 통합으로 설계하여 **$300 사건 재발을 완전히 차단**하고, **Service Role Key optional** 처리로 안정성과 확장성을 확보했습니다.

## 📋 완성된 시스템 구성요소

### 1. Contract-First 설계
- **OpenAPI 스펙**: `/src/shared/api/auth-contracts.yaml`
- **타입 정의**: TypeScript 인터페이스로 계약 보장
- **응답 스키마**: 일관된 에러/성공 응답 형식

### 2. 통합 인증 미들웨어
- **핵심 모듈**: `/src/shared/lib/unified-auth.ts`
- **미들웨어**: `/src/shared/lib/auth-middleware.ts`
- **우선순위**: Supabase → 레거시 JWT → 게스트
- **캐싱**: ETag 기반 조건부 요청 지원

### 3. 무한 루프 방지 시스템
- **모니터링**: `/src/shared/lib/loop-prevention.ts`
- **비용 추적**: $5 경고, $50 위험, $100 긴급차단
- **Rate limiting**: 엔드포인트별 제한
- **패턴 감지**: 10초 내 20회 호출 시 즉시 차단

### 4. HTTP 에러 처리
- **표준화**: `/src/shared/lib/http-error-handler.ts`
- **401/400 구분**: 명확한 에러 분류
- **무한 루프 차단**: MISSING_REFRESH_TOKEN은 반드시 400

### 5. Graceful Degradation
- **Service Role Key Optional**: 없어도 제한된 기능 제공
- **토큰 파싱**: 최소한의 사용자 정보 제공
- **DB 연결 실패**: 토큰 정보만으로 응답

## 🚀 마이그레이션된 API 라우트

### 핵심 라우트 (이미 완료)
1. **`/api/auth/me`** - $300 사건의 원인, 완전 차단
2. **`/api/auth/refresh`** - 무한 루프 방지 강화

### 마이그레이션 대상 (18개 라우트)

#### 현재 getUserIdFromRequest 사용 라우트:
```bash
# API 라우트 목록
- /api/planning/stories
- /api/planning/register
- /api/seedance/create
- /api/ai/generate-story (이미 수정됨)
- /api/queue/list
- /api/queue/retry/[id]
- /api/seedream/create
- /api/planning/videos
- /api/planning/dashboard
- /api/comments
- /api/shares
- /api/planning/prompt
- /api/planning/scenarios
- /api/queue/cancel/[id]
- /api/templates/[id]
- /api/share/create
- /api/planning/scenario
- /api/auth/logout
```

#### 현재 requireSupabaseAuthentication 사용 라우트:
```bash
- /api/queue/list
- /api/queue/retry/[id]
- /api/planning/stories
```

## 📝 마이그레이션 방법

### 기존 코드:
```typescript
// ❌ 기존 방식
import { getUserIdFromRequest } from '@/shared/lib/auth';

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}
```

### 새로운 코드:
```typescript
// ✅ 새로운 통합 방식
import { withAuth } from '@/shared/lib/auth-middleware';
import { withLoopPrevention } from '@/shared/lib/loop-prevention';

export const GET = withLoopPrevention(
  withAuth(async (req, { user, isServiceRoleAvailable, degradationMode }) => {
    // user는 AuthenticatedUser 타입으로 보장됨
    console.log(`인증된 사용자: ${user.id}, 토큰 타입: ${user.tokenType}`);

    // Service mode에 따른 분기 처리
    if (degradationMode) {
      // 제한된 기능 제공
      return NextResponse.json({
        data: getBasicData(user.id),
        serviceMode: 'degraded'
      });
    }

    // 전체 기능 제공
    return NextResponse.json({
      data: await getFullData(user.id),
      serviceMode: 'full'
    });
  }, {
    // 옵션 설정
    gracefulDegradation: true,
    requireEmailVerified: false
  })
);
```

### 특수 케이스:

#### 1. 이메일 인증 필수 API:
```typescript
import { withEmailVerifiedAuth } from '@/shared/lib/auth-middleware';

export const POST = withEmailVerifiedAuth(async (req, { user }) => {
  // 이메일 인증된 사용자만 접근 가능
});
```

#### 2. 관리자 전용 API:
```typescript
import { withServiceRoleAuth } from '@/shared/lib/auth-middleware';

export const DELETE = withServiceRoleAuth(async (req, { user }) => {
  // Service Role Key 필수, 관리자 기능
});
```

#### 3. 게스트 허용 API:
```typescript
export const GET = withAuth(async (req, { user }) => {
  // user는 항상 인증됨 (allowGuest: false가 기본값)
}, { allowGuest: false });
```

#### 4. 하위 호환성 필요 시:
```typescript
import { getUserIdFromRequestV2 } from '@/shared/lib/auth-middleware';

export async function GET(req: NextRequest) {
  // 기존 코드 최소 수정으로 마이그레이션
  const userId = await getUserIdFromRequestV2(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // 기존 로직 유지
}
```

## 🛡️ 무한 루프 방지 규칙

### 클라이언트 개발자 필수 수칙:

#### 1. useEffect 안전 패턴:
```javascript
// ❌ 절대 금지 - $300 폭탄
useEffect(() => {
  checkAuth();
}, [checkAuth]); // 함수 의존성으로 무한 루프

// ✅ 올바른 패턴
useEffect(() => {
  checkAuth();
}, []); // 빈 배열 - 마운트 시 1회만

// ✅ 또는 useCallback 사용
const checkAuth = useCallback(() => {
  // 인증 로직
}, []);
```

#### 2. 캐싱 필수:
```javascript
// ✅ ETag 기반 캐싱
const response = await fetch('/api/auth/me', {
  headers: {
    'If-None-Match': lastETag
  }
});

if (response.status === 304) {
  // 캐시된 데이터 사용
  return cachedUserData;
}
```

#### 3. 에러 처리:
```javascript
// ✅ 올바른 에러 처리
try {
  const response = await fetch('/api/auth/me');

  if (response.status === 401) {
    // 토큰 갱신 시도
    const refreshResult = await refreshToken();

    if (refreshResult.status === 400) {
      // 즉시 로그아웃, 재시도 하지 않음
      logout();
      return;
    }
  }
} catch (error) {
  // 네트워크 에러 등 처리
}
```

## 📊 모니터링 및 알림

### 비용 모니터링:
- **$5 경고**: 로그 기록
- **$50 위험**: 관리자 알림
- **$100 긴급**: 모든 API 차단

### Rate Limiting:
- **auth/me**: 분당 10회
- **auth/refresh**: 분당 3회
- **ai/generate-story**: 분당 5회

### 대시보드 접근:
```javascript
import { getLoopPreventionStats } from '@/shared/lib/loop-prevention';

// 실시간 통계 조회
const stats = getLoopPreventionStats();
console.log('현재 비용:', stats.totalCost);
console.log('차단된 IP:', stats.blockedIPs);
```

## 🔧 환경 설정

### 필수 환경 변수:
```bash
# Supabase 설정 (필수)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...

# Service Role Key (옵션, 없어도 동작)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 레거시 JWT (옵션)
JWT_SECRET=your-jwt-secret

# 관리자 키 (긴급 시 시스템 리셋용)
ADMIN_EMERGENCY_KEY=emergency-reset-key
```

### Graceful Degradation 모드:
- **Service Role Key 있음**: 전체 기능
- **Service Role Key 없음**: 제한된 기능 (토큰 파싱만)
- **모든 설정 없음**: 503 에러

## 🚨 긴급 상황 대응

### $300 사건 재발 시:
```bash
# 관리자 콘솔에서 긴급 리셋
curl -X POST /api/admin/emergency-reset \
  -H "Authorization: Bearer $ADMIN_EMERGENCY_KEY"

# 또는 코드로 직접 리셋
import { adminReset } from '@/shared/lib/loop-prevention';
adminReset(process.env.ADMIN_EMERGENCY_KEY);
```

### IP/사용자 차단 해제:
```bash
# IP 차단 해제
curl -X POST /api/admin/unblock \
  -d '{"type": "ip", "value": "192.168.1.1"}' \
  -H "Authorization: Bearer $ADMIN_EMERGENCY_KEY"
```

## 📈 성능 최적화

### 캐싱 전략:
- **인증 결과**: 1분 캐싱
- **ETag 지원**: 304 Not Modified
- **메모리 캐시**: 최대 1000개 엔트리

### 응답 시간 목표:
- **auth/me**: < 50ms
- **auth/refresh**: < 100ms
- **기타 API**: < 200ms

## 🧪 테스트 검증

### Contract Verification:
```bash
# OpenAPI 스펙 검증
pnpm test -- unified-auth-contract-verification

# 무한 루프 방지 검증
pnpm test -- loop-prevention

# 통합 테스트
pnpm test -- auth/
```

### 수동 검증:
```bash
# 정상 케이스
curl -H "x-user-id: test" http://localhost:3000/api/auth/me

# 에러 케이스
curl http://localhost:3000/api/auth/refresh  # 400 반환 확인

# Rate limiting 테스트
for i in {1..15}; do curl http://localhost:3000/api/auth/me; done
```

## 🎯 마이그레이션 체크리스트

### 개발자별 작업:

#### Backend 개발자:
- [ ] 담당 API 라우트를 `withAuth`로 변경
- [ ] 에러 처리를 `createXXXError` 함수로 표준화
- [ ] Service Role Key optional 대응 로직 추가
- [ ] Rate limiting 설정 검토

#### Frontend 개발자:
- [ ] useEffect 의존성 배열 점검 (함수 제거)
- [ ] API 호출에 캐싱 헤더 추가
- [ ] 401/400 에러 구분 처리
- [ ] 무한 재시도 방지 로직 추가

#### DevOps:
- [ ] Vercel 환경 변수 설정
- [ ] 모니터링 대시보드 구성
- [ ] 알림 시스템 연동
- [ ] 백업 및 복구 절차 수립

### 배포 전 검증:
- [ ] 모든 Contract 테스트 통과
- [ ] 무한 루프 방지 시뮬레이션
- [ ] Graceful degradation 시나리오 검증
- [ ] 성능 벤치마크 확인

## 📞 지원 및 문의

- **기술 문의**: Backend Lead (Benjamin)
- **긴급 상황**: Admin Emergency Key 보유자
- **모니터링**: 실시간 대시보드 확인

---

**이 시스템으로 $300 사건은 더 이상 발생하지 않습니다. 🛡️**