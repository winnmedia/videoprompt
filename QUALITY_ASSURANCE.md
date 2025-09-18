# VideoPlanet 품질 보증 전략 📋

## 🚨 $300 사건 재발 방지 시스템

이 문서는 Header.tsx:17 useEffect 무한 루프로 인한 $300 AWS 비용 폭탄 사건의 재발을 방지하기 위한 완전한 품질 보증 전략을 설명합니다.

## 📊 개요

**목표**: 100% 프로덕션 안정성 보장, 0% 플래키 테스트, 무한 루프 감지 및 차단

**핵심 원칙**:
- TDD (Test-Driven Development) 강제
- 결정론적 테스트 환경
- API 호출 모니터링 및 비용 안전 장치
- 자동화된 품질 게이트

## 🏗️ 아키텍처

### 1. 테스트 피라미드
```
     🔺 E2E Tests (Critical paths only)
    -------- Integration Tests --------
   ------------ Unit Tests ------------
```

- **Unit Tests**: entities, shared/lib (빠른 실행, 높은 커버리지)
- **Integration Tests**: API 인증, 컴포넌트 상호작용
- **E2E Tests**: 핵심 사용자 여정만

### 2. Supabase 모킹 전략

**완전한 모킹 구현**:
- `src/shared/lib/mocks/supabase-mock.ts`: 결정론적 Supabase 클라이언트 모킹
- 모든 인증 시나리오 커버 (성공, 실패, 에러, 타임아웃)
- 무한 루프 감지 및 차단

**테스트 사용자**:
```typescript
TEST_USERS = {
  VALID_USER: { id: 'valid-id', email: 'valid@example.com' },
  UNVERIFIED_USER: { id: 'unverified-id', email_confirmed_at: null },
  INVALID_TOKEN_USER: null,
  EXPIRED_TOKEN_USER: null
}
```

### 3. 무한 루프 감지 시스템

**감지 패턴**:
- **rapid_succession**: 1초 내 동일 엔드포인트 10회+ 호출
- **auth_polling**: auth/me 연속 호출 (5회+)
- **retry_storm**: 실패한 요청의 과도한 재시도
- **parallel_redundancy**: 동일 데이터 중복 병렬 요청

**자동 차단**:
```typescript
// $300 사건 방지 - 무한 루프 감지 시 즉시 에러
if (recentCalls.length > 10) {
  throw new Error('INFINITE_LOOP_DETECTED: This would cost $300+');
}
```

## 🧪 테스트 구조

### 인증 시스템 테스트

#### 1. Supabase 인증 시나리오 테스트
`src/__tests__/auth/supabase-auth-scenarios.test.ts`

**커버리지**: 100% 필수
- ✅ 유효하지 않은 토큰 → 401 에러
- ✅ 만료된 토큰 → 401 에러
- ✅ Authorization 헤더 없음 → 401 에러
- ✅ 이메일 미인증 사용자 차단
- ✅ Supabase 서비스 장애 처리
- ✅ 레거시 JWT 백업 인증
- ✅ 게스트 모드 허용

#### 2. 무한 루프 감지 테스트
`src/__tests__/auth/infinite-loop-detection.test.ts`

**$300 사건 재현 및 차단**:
- ✅ useEffect 의존성 배열 실수 감지
- ✅ API 라우트 무한 호출 차단
- ✅ 컴포넌트 리렌더링 폭증 감지
- ✅ 정상 사용 패턴 허용
- ✅ 메모리 누수 방지

#### 3. API 통합 테스트
`src/__tests__/integration/api-auth-integration.test.ts`

**실제 API 라우트 검증**:
- ✅ `/api/auth/me` 인증 실패/성공 시나리오
- ✅ `/api/ai/generate-story` 인증 검증
- ✅ `/api/planning/stories` 인증 검증
- ✅ 동시 다발적 요청 처리
- ✅ 에러 복구 능력

### API 모니터링 시스템

#### API 호출 추적
`src/shared/lib/test-utils/api-monitoring.ts`

**기능**:
- 실시간 API 호출 패턴 분석
- 플래키 테스트 감지
- 성능 회귀 감지
- 비용 위험도 계산

**사용법**:
```typescript
// 테스트 시작
apiMonitoring.startTest('test-name');

// API 호출 수행...

// 테스트 종료 및 분석
const stats = apiMonitoring.endTest();
console.log(apiMonitoring.generateReport());
```

## 🛡️ 품질 게이트

### 로컬 실행
```bash
# 전체 품질 게이트 실행
pnpm run quality-gates

# 개별 테스트 실행
pnpm run test:auth              # 인증 시스템 테스트
pnpm run test:infinite-loop     # 무한 루프 감지 테스트
pnpm run test:api-monitoring    # API 모니터링 테스트
```

### CI/CD 파이프라인
`.github/workflows/quality-gates.yml`

**5단계 검증**:

1. **🚀 빠른 검증 (2분)**
   - 타입 검사
   - 린팅
   - $300 사건 방지 패턴 검사

2. **🔐 인증 시스템 테스트 (5분)**
   - 100% 커버리지 필수
   - 모든 실패 시나리오 검증
   - Supabase 모킹 정확성 확인

3. **📊 API 안전성 검사 (8분)**
   - 플래키 테스트 감지 (3회 실행)
   - 성능 회귀 검사
   - 메모리 누수 검사

4. **🛡️ 보안 및 아키텍처 검증 (10분)**
   - 민감 정보 노출 검사
   - FSD 아키텍처 규칙 검증
   - 의존성 취약점 스캔

5. **🔄 전체 통합 테스트 (15분)**
   - 85% 이상 전체 커버리지
   - 프로덕션 빌드 검증
   - 번들 크기 검사

## 📋 커버리지 요구사항

### 크리티컬 파일 (100% 커버리지 필수)
- `src/shared/lib/supabase-auth.ts`
- `src/shared/lib/auth-supabase.ts`
- `src/app/api/auth/*/route.ts`

### 전체 코드베이스
- **Lines**: 85% 이상
- **Functions**: 90% 이상
- **Branches**: 80% 이상
- **Statements**: 85% 이상

### API 라우트
- **Threshold**: 95% 이상
- **Pattern**: `src/app/api/**/route.ts`

## 🚨 비용 안전 장치

### API 호출 제한
- **1초 내 동일 엔드포인트**: 최대 5회
- **테스트당 최대 API 호출**: 50회
- **금지 패턴**: rapid_succession, auth_polling

### 자동 차단 시스템
```bash
# useEffect 무한 루프 패턴 검사
if grep -r "useEffect.*\[.*[a-zA-Z].*\]" src/; then
  echo "❌ 위험: useEffect 의존성 배열에 함수 포함!"
  exit 1
fi
```

## 📊 모니터링 및 알림

### Slack 알림
- **#alerts-critical**: 크리티컬 실패 (즉시 대응 필요)
- **#alerts-warning**: 경고 레벨 (확인 필요)
- **#ci-success**: 성공 알림

### 품질 대시보드
- 실시간 커버리지 추적
- API 호출 패턴 분석
- 플래키 테스트 감지 이력
- 성능 회귀 추세

## 🔧 트러블슈팅

### 자주 발생하는 문제

#### 1. "INFINITE_LOOP_DETECTED" 에러
```typescript
// ❌ 잘못된 패턴
useEffect(() => {
  checkAuth();
}, [checkAuth]); // 함수가 의존성 배열에 있음

// ✅ 올바른 패턴
useEffect(() => {
  checkAuth();
}, []); // 빈 배열 또는 primitive 값만
```

#### 2. Supabase 모킹 실패
```typescript
// 테스트 시작 전 모킹 상태 리셋
beforeEach(() => {
  supabaseMockHelpers.reset();
  vi.clearAllMocks();
});
```

#### 3. 플래키 테스트
- MSW 핸들러 확인
- 비동기 처리 올바른지 검증
- 타이머 사용 시 Jest fake timers 활용

### 성능 최적화

#### 테스트 실행 속도
- 병렬 실행 활용: `vitest --threads`
- 캐시 활용: 의존성, 타입 검사 결과
- 변경된 파일만 테스트: `--changed`

#### 메모리 사용량 최적화
- 테스트 후 정리: `afterEach(() => vi.clearAllMocks())`
- 큰 객체 참조 해제
- Garbage Collection 강제 실행

## 📚 참고 자료

### 관련 파일
- `src/shared/lib/mocks/supabase-mock.ts`: Supabase 모킹
- `src/shared/lib/test-utils/api-monitoring.ts`: API 모니터링
- `quality-gates.config.js`: 품질 게이트 설정
- `scripts/run-quality-gates.sh`: 로컬 실행 스크립트

### 명령어 치트시트
```bash
# 개발 중 자주 사용하는 명령어
pnpm run test:auth:watch        # 인증 테스트 watch 모드
pnpm run test:infinite-loop     # 무한 루프 감지 테스트
pnpm run type-check            # 타입 검사만
pnpm run quality-gates         # 전체 품질 게이트

# CI와 동일한 환경으로 테스트
INTEGRATION_TEST=true pnpm test
```

## 🎯 성공 기준

### 단기 목표 (1개월)
- ✅ 인증 시스템 100% 테스트 커버리지
- ✅ $300 사건 재발 방지 시스템 구축
- ✅ 플래키 테스트 0% 달성

### 중기 목표 (3개월)
- 전체 코드베이스 90% 커버리지
- 평균 API 응답시간 200ms 이하
- 메모리 누수 0건

### 장기 목표 (6개월)
- 완전 자동화된 품질 게이트
- 실시간 성능 모니터링
- 예측적 품질 관리

---

> 💡 **기억하세요**: 품질은 개발 속도를 늦추는 것이 아니라, 장기적으로 개발 속도를 높이는 투자입니다. $300 사건은 다시 일어나지 않습니다!