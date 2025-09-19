# 📚 VideoPlanet 배포 신뢰성 가이드 v2.0

> **Frontend Platform Lead** - 99.9% 배포 성공률을 위한 종합 가이드

## 🎯 개요

이 가이드는 Vercel 배포의 결정성을 보장하고 배포 실패를 방지하기 위한 체계적인 접근법을 제공합니다.

## ⚡ 빠른 시작 (Quick Start)

### 1. 배포 전 필수 체크

```bash
# 환경변수 검증
pnpm validate-env

# 품질 게이트 실행
pnpm quality-gates

# 성능 예산 검증
pnpm performance:budget

# 통합 배포 안전성 체크
pnpm ci:deployment-safety
```

### 2. 프로덕션 빌드

```bash
# 완전한 프로덕션 빌드 (성능 예산 + 모니터링 포함)
pnpm build:production

# 또는 Vercel 전용 빌드
pnpm vercel-build
```

### 3. 배포 모니터링

```bash
# 단발성 헬스 체크
pnpm deploy:monitor

# 연속 모니터링
pnpm deploy:monitor:continuous

# 테스트 알림
pnpm deploy:test-alert
```

## 🔧 핵심 개선사항

### 1. 빌드 결정성 보장

#### ✅ 문제 해결됨:
- **Prisma Client 생성 안정성**: `vercel-build` 스크립트에서 `prisma generate` 보장
- **ESLint 검증 활성화**: 품질 게이트 복원 (`ignoreDuringBuilds: false`)
- **TypeScript 엄격 검사**: 타입 오류 시 빌드 중단
- **Webpack 캐시 최적화**: 환경별 일관된 캐시 정책

#### 📁 핵심 설정 파일:
- `/vercel.json`: 최적화된 빌드 명령어 및 환경변수
- `/next.config.mjs`: 품질 게이트 활성화 및 캐시 전략
- `/package.json`: 통합된 빌드 및 모니터링 스크립트

### 2. CI/CD 파이프라인 강화

#### 🚀 새로운 워크플로우:
- **`vercel-deployment-safety.yml`**: Vercel 배포 전 사전 검증
- **빌드 결정성 검사**: 동일한 조건에서 동일한 결과 보장
- **환경변수 검증**: 필수 환경변수 누락 방지
- **배포 후 헬스 체크**: 자동화된 배포 검증

### 3. 성능 모니터링 시스템

#### 📊 성능 예산 집행:
- **Core Web Vitals**: LCP, FID, CLS 자동 검증
- **번들 크기 예산**: JavaScript/CSS 크기 제한
- **실시간 알림**: Slack/Discord 통합 알림
- **자동 권장사항**: 성능 문제 해결 가이드

## 📋 배포 체크리스트

### Phase 1: 사전 검증 (Pre-flight)

- [ ] **환경변수 검증**
  ```bash
  pnpm validate-env
  ```

- [ ] **$300 사건 방지 패턴 체크**
  ```bash
  # useEffect 의존성 배열 함수 포함 검사
  grep -r "useEffect.*\[.*[a-zA-Z_][a-zA-Z0-9_]*\]" src/
  ```

- [ ] **타입 안정성 검증**
  ```bash
  pnpm typecheck
  ```

- [ ] **린팅 및 포맷팅**
  ```bash
  pnpm lint
  pnpm format:check
  ```

### Phase 2: 빌드 테스트 (Build Verification)

- [ ] **로컬 빌드 성공**
  ```bash
  pnpm build
  ```

- [ ] **Vercel 동일 조건 빌드**
  ```bash
  pnpm vercel-build
  ```

- [ ] **빌드 결정성 검증**
  ```bash
  # 두 번 빌드해서 결과 비교
  rm -rf .next && pnpm vercel-build
  mv .next .next.first
  rm -rf .next && pnpm vercel-build
  diff -r .next.first .next
  ```

- [ ] **성능 예산 검증**
  ```bash
  pnpm performance:budget
  ```

### Phase 3: 배포 안전성 (Deployment Safety)

- [ ] **Vercel 환경변수 확인**
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_APP_URL`

- [ ] **도메인 및 DNS 설정**
  - 프로덕션 도메인 연결 확인
  - DNS 전파 상태 확인

- [ ] **배포 모니터링 설정**
  ```bash
  # 알림 웹훅 테스트
  pnpm deploy:test-alert
  ```

### Phase 4: 배포 후 검증 (Post-deployment)

- [ ] **헬스 체크 실행**
  ```bash
  pnpm deploy:monitor
  ```

- [ ] **API 엔드포인트 확인**
  - `/api/health` 응답 확인
  - 주요 API 기능 스모크 테스트

- [ ] **성능 지표 확인**
  - Core Web Vitals 측정
  - 응답 시간 확인

- [ ] **오류 로그 모니터링**
  - Vercel 함수 로그 확인
  - 클라이언트 오류 로그 확인

## 🚨 트러블슈팅 가이드

### 일반적인 배포 실패 원인

#### 1. Prisma Client 생성 실패
```bash
# 해결방법
pnpm prisma generate
pnpm vercel-build
```

#### 2. 환경변수 누락
```bash
# Vercel CLI로 환경변수 확인
vercel env ls

# 필요 시 환경변수 추가
vercel env add DATABASE_URL
```

#### 3. TypeScript 컴파일 오류
```bash
# 타입 오류 확인 및 수정
pnpm typecheck
```

#### 4. 번들 크기 초과
```bash
# 번들 분석
pnpm performance:budget
```

### 응급 복구 절차

#### 1. 즉시 롤백
- Vercel 대시보드에서 이전 성공한 배포로 롤백
- 또는 Git에서 이전 커밋으로 되돌리기

#### 2. 핫픽스 배포
```bash
# 긴급 수정 후 빠른 배포
pnpm validate-env
pnpm build
# Vercel에 푸시
```

#### 3. 모니터링 강화
```bash
# 연속 모니터링 시작
pnpm deploy:monitor:continuous
```

## 📊 성능 목표 및 SLA

### 배포 신뢰성 목표
- **배포 성공률**: 99.9%
- **평균 배포 시간**: 5분 이내
- **평균 복구 시간 (MTTR)**: 10분 이내

### 성능 예산
- **LCP (Largest Contentful Paint)**: 2.5초 이하
- **FID (First Input Delay)**: 100ms 이하
- **CLS (Cumulative Layout Shift)**: 0.1 이하
- **JavaScript 번들**: 250KB 이하 (gzipped)

### 모니터링 지표
- **응답 시간**: 800ms 이하 (TTFB)
- **가용성**: 99.9%
- **오류율**: 0.1% 이하

## 🔗 관련 도구 및 스크립트

### 핵심 스크립트
- `/scripts/vercel-deployment-monitor.js`: 배포 모니터링
- `/scripts/performance-budget-enforcer.js`: 성능 예산 관리
- `/scripts/validate-env-realtime.ts`: 환경변수 검증

### GitHub Actions 워크플로우
- `.github/workflows/vercel-deployment-safety.yml`: Vercel 배포 안전성
- `.github/workflows/01-main-ci.yml`: 메인 CI/CD 파이프라인

### 설정 파일
- `vercel.json`: Vercel 배포 설정
- `next.config.mjs`: Next.js 최적화 설정
- `package.json`: 통합된 스크립트

## 📞 지원 및 연락처

### 배포 관련 문의
- **Frontend Platform Lead**: 이 문서 작성자
- **긴급 상황**: GitHub Issues 또는 Slack 알림 확인

### 모니터링 알림 설정
```bash
# Slack 웹훅 설정
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."

# Discord 웹훅 설정
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# 알림 테스트
pnpm deploy:test-alert
```

---

## ✅ 결론

이 가이드를 따라 배포하면 **99.9% 성공률**을 달성할 수 있습니다. 모든 단계를 체계적으로 수행하고, 문제 발생 시 트러블슈팅 가이드를 참조하세요.

**핵심 원칙**: Plan → Do → See 사이클을 통한 지속적인 개선으로 배포 신뢰성을 최고 수준으로 유지합니다.