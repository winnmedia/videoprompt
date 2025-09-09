# 🧪 VideoPlanet 프로덕션 API 테스트 시스템

이 문서는 Mock 기반 테스트를 실제 프로덕션 API 테스트로 전환한 새로운 테스트 시스템에 대한 가이드입니다.

## 🎯 목표

기존의 Mock 기반 테스트의 한계를 극복하고, 실제 프로덕션 환경에서 발생하는 오류를 조기에 탐지할 수 있는 견고한 테스트 시스템을 구축합니다.

## 📋 주요 변경사항

### ❌ 기존 시스템 (Mock 기반)
- `global.fetch = vi.fn()` 사용
- 가짜 응답 데이터로 테스트
- 실제 네트워크 요청 없음
- 프로덕션 오류 탐지 불가

### ✅ 새로운 시스템 (실제 API)
- 실제 HTTP 클라이언트 사용
- 진짜 데이터베이스 연동
- 네트워크 요청 및 응답 검증
- 프로덕션 환경 실시간 모니터링

## 🏗️ 아키텍처

### 핵심 컴포넌트

1. **ApiClient** (`src/test/api-client.ts`)
   - 실제 HTTP 요청 처리
   - 타임아웃 및 재시도 로직
   - 인증 토큰 관리
   - 다중 환경 지원

2. **TestUserManager** (`src/test/utils.ts`)
   - 테스트 사용자 생성/관리
   - 자동 데이터 정리
   - 이메일 인증 자동화
   - 보안 정책 준수

3. **PerformanceMonitor** (`src/test/utils.ts`)
   - 응답 시간 측정
   - 성능 임계값 검증
   - 부하 테스트 지원

## 🧪 테스트 스위트

### 1. 인증 API 통합 테스트
**파일:** `src/__tests__/auth-api-integration.test.ts`

**커버리지:**
- ✅ 사용자 등록 (실제 DB 저장)
- ✅ 이메일 인증 (실제 코드 생성/검증)
- ✅ 로그인/로그아웃 (실제 세션 관리)
- ✅ 토큰 검증 (실제 JWT 처리)
- ✅ 에러 케이스 (실제 검증 로직)

**실행:**
```bash
pnpm test:integration
```

### 2. 프로덕션 헬스 모니터링
**파일:** `src/__tests__/production-health-monitor.test.ts`

**모니터링 항목:**
- 🏥 서버 가용성 확인
- 📈 응답 시간 측정
- 🔗 엔드포인트 접근성
- 🗄️ 데이터베이스 연결성
- 🔒 보안 헤더 검증
- 🌐 CORS 정책 확인
- ⚡ 성능 벤치마킹
- 📊 부하 테스트

**실행:**
```bash
pnpm test:health
```

## 🌍 다중 환경 테스트

### 로컬 환경 테스트
```bash
pnpm test:production:local
```

### 프로덕션 환경 테스트
```bash
pnpm test:production:remote
```

### 전체 환경 테스트
```bash
pnpm test:production
```

## ⚙️ 환경 설정

### 테스트 환경 변수 (`.env.test`)

```env
# 테스트 데이터베이스
DATABASE_URL=postgresql://postgres:***@centerbeam.proxy.rlwy.net:25527/railway_test

# API 엔드포인트
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PRODUCTION_API_BASE=https://www.vridge.kr

# 테스트 사용자 관리
TEST_USER_PREFIX=integration_test_
TEST_CLEANUP_ENABLED=true
TEST_USER_RETENTION_HOURS=1

# 성능 임계값
HEALTH_CHECK_TIMEOUT=30000
MAX_RESPONSE_TIME=5000
LOAD_TEST_CONCURRENCY=10
```

## 🤖 CI/CD 파이프라인

### GitHub Actions 워크플로우
**파일:** `.github/workflows/production-api-tests.yml`

**트리거:**
- 🔄 메인 브랜치 푸시
- 📝 Pull Request
- ⏰ 매일 오전 9시 (자동)
- 🎯 수동 실행

**기능:**
- 환경별 매트릭스 테스트
- 성능 지표 수집
- 실패 시 Slack 알림
- 테스트 결과 아티팩트

**실행 단계:**
1. 환경 설정 및 준비
2. 로컬 서버 시작 (필요시)
3. 헬스 체크 테스트
4. 인증 통합 테스트
5. 테스트 데이터 정리
6. 결과 요약 및 알림

## 🧹 테스트 데이터 관리

### 자동 정리 시스템
- ⏰ 1시간 후 자동 삭제
- 🏷️ 테스트 전용 이메일 패턴 (`integration_test_*`)
- 🛡️ 프로덕션 보호 (테스트 모드 확인)
- 🔄 CI/CD 후 즉시 정리

### 정리 API 엔드포인트
**파일:** `src/app/api/test/cleanup-user/route.ts`

```bash
# 정리 대상 조회
curl -X GET "http://localhost:3000/api/test/cleanup-user" \
  -H "X-Test-Mode: 1"

# 특정 사용자 정리
curl -X DELETE "http://localhost:3000/api/test/cleanup-user" \
  -H "X-Test-Mode: 1" \
  -H "X-User-Email: test@example.com"
```

## 📊 성능 및 품질 지표

### 응답 시간 임계값
- ✅ 우수: < 1초
- 🟡 양호: 1-3초
- 🟠 보통: 3-5초
- 🔴 나쁨: > 5초

### 가용성 기준
- 🎯 프로덕션: ≥ 99% (강제)
- 📝 로컬: ≥ 80% (권장)

### 성공률 기준
- 🎯 인증 플로우: ≥ 95%
- 📊 부하 테스트: ≥ 80%
- 🔄 재시도 로직: 3회

## 🚨 모니터링 및 알림

### 실패 시 액션
1. 🔍 자동 재시도 (최대 3회)
2. 📝 상세 로그 생성
3. 📧 Slack 알림 발송
4. 🚫 배포 차단 (심각한 오류)

### 대시보드 지표
- 📈 응답 시간 트렌드
- 📊 성공률 추이
- 🚨 오류 발생 빈도
- 🌍 환경별 상태

## 🛠️ 개발자 가이드

### 새로운 API 테스트 추가

1. **테스트 파일 생성**
```typescript
// src/__tests__/my-new-api.test.ts
import { getApiClient } from '@/test/api-client';
import { TestUserManager } from '@/test/utils';

describe('My New API Integration', () => {
  let apiClient = getApiClient();
  let testUserManager = new TestUserManager(apiClient);
  
  test('should work correctly', async () => {
    const response = await apiClient.get('/api/my-endpoint');
    expect(response.ok).toBe(true);
  });
});
```

2. **package.json 스크립트 추가**
```json
{
  "scripts": {
    "test:my-api": "vitest run src/__tests__/my-new-api.test.ts"
  }
}
```

3. **CI/CD 파이프라인 업데이트**
```yaml
- name: Run My New API Tests
  run: pnpm test:my-api
```

### 디버깅 팁

1. **로컬 테스트 실행**
```bash
# 상세 로그와 함께 실행
DEBUG=1 pnpm test:integration

# 특정 테스트만 실행
pnpm test -- --grep "회원가입 성공"
```

2. **네트워크 문제 해결**
```bash
# 서버 상태 확인
curl -v http://localhost:3000/api/health

# DNS 해결 확인
nslookup www.vridge.kr
```

3. **데이터베이스 연결 확인**
```bash
# 환경변수 확인
echo $DATABASE_URL

# 직접 연결 테스트
psql $DATABASE_URL -c "SELECT 1;"
```

## 🎯 마이그레이션 가이드

### 기존 Mock 테스트에서 전환하기

1. **Mock 제거**
```typescript
// ❌ 기존
global.fetch = vi.fn();
(global.fetch as any).mockResolvedValueOnce({...});

// ✅ 신규
import { getApiClient } from '@/test/api-client';
const apiClient = getApiClient();
const response = await apiClient.post('/api/auth/register', data);
```

2. **실제 데이터 사용**
```typescript
// ❌ 기존
const testUser = { email: 'test@example.com' };

// ✅ 신규
import { TestUserManager } from '@/test/utils';
const testUserManager = new TestUserManager(apiClient);
const testUser = await testUserManager.createTestUser();
```

3. **정리 로직 추가**
```typescript
// ✅ 신규
afterEach(async () => {
  await testUserManager.cleanupAllUsers();
});
```

## 📚 참고 자료

- [Vitest 공식 문서](https://vitest.dev/)
- [GitHub Actions 워크플로우](https://docs.github.com/en/actions)
- [HTTP 상태 코드](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [PostgreSQL 테스트 전략](https://www.postgresql.org/docs/current/regress.html)

---

**⚠️ 중요 사항:**
- 프로덕션 환경에서 테스트 실행 시 주의
- 테스트 데이터는 자동 정리되지만 수동 확인 권장
- 성능 테스트는 트래픽이 적은 시간에 실행
- API 키 및 민감 정보는 환경변수로 관리