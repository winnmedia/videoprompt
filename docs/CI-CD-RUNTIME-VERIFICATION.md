# CI/CD Runtime Verification System

VideoPlanet 프로젝트에 구축된 실제 런타임 문제 감지 및 차단 시스템 가이드

## 개요

기존 CI/CD에서는 Mock 테스트가 통과해도 실제 배포 환경에서 문제가 발생하는 경우가 있었습니다. 이 시스템은 **실제 런타임 환경에서 발생할 수 있는 문제를 사전에 감지하고 차단**합니다.

## 🚀 핵심 개선사항

### 1. Mock vs Reality Gap 해결
- **이전**: Mock 테스트 통과 → 실제 배포 시 실패
- **현재**: 실제 Supabase 연결 테스트 → 런타임 문제 사전 감지

### 2. 환경 일관성 보장
- 개발/스테이징/프로덕션 환경 간 설정 차이 자동 감지
- 빌드 타임과 런타임 환경변수 불일치 차단

### 3. 성능 회귀 실시간 감지
- API 응답시간 기준선 자동 관리
- 배포 전후 성능 비교 분석

## 📋 시스템 구성

### 1. Pre-deployment Smoke Test
**파일**: `.github/workflows/pre-deployment-smoke-test.yml`

```yaml
# 실행 조건
- PR 생성 시: 개발 환경만 빠른 테스트
- main 브랜치 푸시: 모든 환경 포괄적 테스트
- 수동 실행: 사용자 정의 레벨
```

**주요 검증 항목**:
- ✅ 실제 Supabase 연결 (Mock 없음)
- ✅ 환경변수 유효성 실시간 검증
- ✅ API 라우트 구문 및 타입 검증
- ✅ 의존성 보안 감사
- ✅ 성능 기준선 측정
- ✅ 환경별 설정 드리프트 감지

### 2. Real-time Environment Validation
**파일**: `scripts/validate-env-realtime.ts`

실제 서비스 의존성과 연결하여 환경 설정을 검증합니다.

```bash
# 직접 실행
npx ts-node scripts/validate-env-realtime.ts

# CI에서 자동 실행 (ci.yml에 통합됨)
```

**검증 카테고리**:
- 🔧 **Environment**: 필수/선택 환경변수 형식 검증
- 🔌 **Connectivity**: 실제 Supabase 연결 테스트
- 🔒 **Security**: 보안 설정 및 민감정보 노출 검사
- 🔗 **Dependencies**: 외부 서비스 의존성 상태 확인
- ⚡ **Performance**: 환경 로딩 시간 및 메모리 사용량
- 🔄 **Consistency**: 환경별 설정 일관성 검증

### 3. API Health Monitoring
**파일**: `.github/workflows/api-health-monitoring.yml`

배포된 API의 실제 동작 상태를 지속적으로 모니터링합니다.

```yaml
# 실행 스케줄
- 매시간 정각: 프로덕션 모니터링
- PR/Push: 개발환경 검증
- 수동 실행: 사용자 정의 테스트
```

**모니터링 레벨**:
- **Quick**: 기본 연결성만 확인 (PR용)
- **Standard**: 주요 API + 성능 기본 검증
- **Comprehensive**: 전체 API + 보안 + 통합 테스트

### 4. Build Determinism
**파일**: `.github/workflows/build-determinism.yml`

크로스 플랫폼 빌드 일관성과 의존성 무결성을 보장합니다.

**검증 매트릭스**:
- **플랫폼**: Ubuntu, Windows, macOS
- **Node.js 버전**: 18, 20, 22
- **환경**: development, staging, production

**일관성 검증**:
- 빌드 해시 비교 (동일 소스 → 동일 결과)
- 의존성 잠금 파일 무결성
- 크로스 플랫폼 성능 편차 분석

### 5. Post-deployment Verification
**파일**: `.github/workflows/post-deployment-verification.yml`

배포 완료 후 실제 프로덕션 환경에서 자동 검증을 수행합니다.

**즉시 검증** (Critical Path):
- 기본 연결성 (30초 이내)
- Health Check (2분 이내)
- 인증 시스템 (1분 이내)

**포괄적 검증**:
- E2E 사용자 시나리오
- 데이터베이스 연결성
- 외부 의존성 상태
- 보안 헤더 확인

## 🎯 사용 가이드

### 일반 개발 워크플로우

1. **개발 중**:
   ```bash
   # 로컬에서 실시간 환경 검증
   npm run test:env-realtime

   # 실제 환경 연결 테스트
   npm run test:real-env
   ```

2. **PR 생성 시**:
   - 자동으로 빠른 검증 실행
   - 개발 환경에서만 테스트
   - 실패 시 PR 병합 차단

3. **main 브랜치 병합 시**:
   - 전체 환경 포괄적 검증
   - Build Determinism 확인
   - API Health 기준선 업데이트

### 수동 검증 실행

#### Pre-deployment Smoke Test
```bash
# GitHub Actions에서 수동 실행
# Repository → Actions → Pre-Deployment Smoke Test → Run workflow

# 옵션:
# - Test Depth: quick/standard/comprehensive
# - Environment: local/staging/production/both
```

#### API Health Monitoring
```bash
# Repository → Actions → API Health Monitoring → Run workflow

# 옵션:
# - Monitoring Level: quick/standard/comprehensive/stress-test
# - Performance Baseline: measure-only/compare/update-baseline
```

#### Build Determinism Check
```bash
# Repository → Actions → Build Determinism → Run workflow

# 옵션:
# - Check Level: basic/standard/comprehensive
# - Force Dependency Update: true/false
```

#### Post-deployment Verification
```bash
# Repository → Actions → Post-Deployment Verification → Run workflow

# 필수 입력:
# - Deployment URL: 검증할 배포 URL
# - Environment: staging/production
# - Verification Level: smoke-test/standard/comprehensive
# - Auto-rollback: true/false
```

## 🚨 알림 및 대응

### Slack 알림 채널
- `#deployment-alerts`: 크리티컬 배포 문제
- `#api-alerts`: API 장애 감지
- `#performance-alerts`: 성능 회귀 감지
- `#build-alerts`: 빌드 일관성 문제
- `#deployment-success`: 성공적인 배포 알림

### 실패 시 대응 절차

#### 1. 크리티컬 실패 (즉시 대응 필요)
```
🚨 CRITICAL: 인증 시스템 장애
🚨 CRITICAL: 데이터베이스 연결 실패
🚨 CRITICAL: 보안 취약점 감지
```
→ **즉시 롤백 고려** / **긴급 수정**

#### 2. 경고 레벨 (모니터링 필요)
```
⚠️ WARNING: 성능 저하 감지
⚠️ WARNING: 비필수 API 응답 지연
⚠️ WARNING: 의존성 보안 권고사항
```
→ **다음 배포 시 수정** / **지속 모니터링**

## 📊 메트릭 및 리포트

### 자동 생성 리포트
1. **환경 검증 리포트**: `env-validation-results.json`
2. **실제 환경 테스트 리포트**: `real-env-test-results.json`
3. **API 헬스 리포트**: `health-check-results-*.json`
4. **빌드 일관성 리포트**: `determinism-report.md`
5. **배포 검증 리포트**: GitHub Step Summary

### 성능 추적
- API 응답시간 트렌드
- 빌드 시간 변화
- 메모리 사용량 패턴
- 의존성 크기 증가

## 🔧 설정 및 커스터마이징

### 환경별 임계값 설정
**파일**: `quality-gates.config.js`

```javascript
// API 응답 시간 임계값
apiResponseTime: {
  p95: 500,      // 95 퍼센타일 500ms 이하
  p99: 1000,     // 99 퍼센타일 1초 이하
  average: 200   // 평균 200ms 이하
}

// 성능 예산
performance: {
  testExecution: {
    unit: 30000,        // 단위 테스트: 30초 이하
    integration: 120000, // 통합 테스트: 2분 이하
    e2e: 600000         // E2E 테스트: 10분 이하
  }
}
```

### Secrets 설정 (GitHub Repository Settings)
```
STAGING_URL=https://staging.videoplanet.com
PRODUCTION_URL=https://videoplanet.com
STAGING_SUPABASE_URL=https://staging-project.supabase.co
STAGING_SUPABASE_ANON_KEY=eyJ...
PROD_SUPABASE_URL=https://prod-project.supabase.co
PROD_SUPABASE_ANON_KEY=eyJ...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## 🎨 Best Practices

### 1. 환경변수 관리
```bash
# ✅ 좋은 예
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ 나쁜 예
SUPABASE_URL=localhost:3000  # 프로덕션에서 위험
SUPABASE_ANON_KEY=test123    # 잘못된 형식
```

### 2. API 엔드포인트 설계
```typescript
// ✅ Health Check 엔드포인트 구현 예
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: {
      status: await checkDatabaseConnection() ? "connected" : "disconnected"
    },
    supabase: {
      status: await checkSupabaseConnection() ? "connected" : "disconnected"
    }
  })
}
```

### 3. 테스트 분리
```
단위 테스트    → Mock 사용 (빠른 피드백)
통합 테스트    → 일부 실제 연결 (신뢰성)
E2E 테스트     → 전체 실제 환경 (실제 사용자 시나리오)
```

## 🔮 향후 개선 계획

### 1. 성능 기준선 자동 관리
- 과거 성능 데이터 저장소 구축
- 자동 임계값 조정 알고리즘
- 성능 회귀 예측 모델

### 2. 지능형 롤백 시스템
- Vercel API 연동 자동 롤백
- 트래픽 기반 점진적 배포
- A/B 테스트 자동화

### 3. 비용 최적화
- 테스트 실행 조건 최적화
- 캐시 전략 개선
- 병렬 실행 효율성 향상

---

**이 시스템을 통해 Mock 테스트와 실제 런타임 간의 차이를 완전히 해소하고, 배포 전에 모든 문제를 감지할 수 있습니다.**