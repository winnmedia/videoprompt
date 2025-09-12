# 성능 모니터링 시스템

VideoPlanet 프로젝트를 위한 포괄적인 성능 모니터링 시스템입니다. 인증 API를 포함한 모든 API의 성능 메트릭과 Core Web Vitals를 실시간으로 수집하고 분석합니다.

## 🎯 주요 기능

### 1. Core Web Vitals 모니터링
- **LCP (Largest Contentful Paint)**: ≤ 2.5초
- **INP (Interaction to Next Paint)**: ≤ 200ms  
- **CLS (Cumulative Layout Shift)**: ≤ 0.1

### 2. API 성능 모니터링
- 응답 시간 추적 (목표: ≤ 100ms)
- 상태 코드별 분석
- 401 오류 특화 모니터링
- 자동 배치 전송

### 3. 실시간 대시보드
- 성능 메트릭 시각화
- 알림 시스템
- 브라우저별/디바이스별 분석

### 4. CI/CD 통합
- 성능 예산 자동 검증
- Lighthouse CI 통합
- 번들 크기 모니터링

## 🚀 설치 및 설정

### 필수 의존성
```bash
pnpm add web-vitals chart.js react-chartjs-2
```

### 기본 설정

1. **애플리케이션 래핑**
```tsx
// app/layout.tsx
import { PerformanceProvider } from '@/shared/lib/performance-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <PerformanceProvider
          config={{
            autoStart: true,
            userId: 'user-123', // 로그인 사용자 ID
            webVitalsConfig: {
              autoSend: true,
              batchSize: 5,
              debug: process.env.NODE_ENV === 'development'
            },
            apiMonitoringConfig: {
              autoSend: true,
              batchSize: 10,
              slowRequestThreshold: 1000
            }
          }}
        >
          {children}
        </PerformanceProvider>
      </body>
    </html>
  )
}
```

2. **개별 페이지에서 사용**
```tsx
// pages/dashboard.tsx
import { useWebVitals, useApiMonitoring } from '@/features/performance'

export default function Dashboard() {
  const webVitals = useWebVitals({
    autoSend: true,
    debug: true
  })
  
  const apiMonitoring = useApiMonitoring({
    includePatterns: ['/api/*'],
    excludePatterns: ['/api/performance/*']
  })

  useEffect(() => {
    webVitals.startSession('dashboard-session')
    apiMonitoring.startMonitoring()
    
    return () => {
      webVitals.stopSession()
      apiMonitoring.stopMonitoring()
    }
  }, [])

  return <div>Dashboard Content</div>
}
```

## 📊 대시보드 사용법

### 성능 대시보드 컴포넌트
```tsx
import { PerformanceDashboard } from '@/widgets/performance'

export default function MonitoringPage() {
  return (
    <PerformanceDashboard
      timeRange="24h"
      refreshInterval={30000}
      realtime={true}
    />
  )
}
```

### 알림 컴포넌트
```tsx
import { PerformanceAlerts } from '@/widgets/performance'

export default function AlertsPage() {
  return (
    <PerformanceAlerts
      maxAlerts={10}
      onAlertClick={(alert) => console.log('Alert clicked:', alert)}
      onAcknowledgeAll={() => console.log('All alerts acknowledged')}
    />
  )
}
```

## 🔧 API 사용법

### 메트릭 전송
```typescript
import { performanceApi } from '@/shared/api/performance-api'

// 개별 메트릭 전송
await performanceApi.sendMetrics(performanceMetrics)

// 배치 전송
await performanceApi.sendBatch([metric1, metric2, metric3])
```

### 통계 조회
```typescript
// 집계 통계
const stats = await performanceApi.getAggregatedStats({
  timeRange: '7d',
  groupBy: 'day'
})

// 예산 위반 내역
const violations = await performanceApi.getBudgetViolations({
  severity: 'high',
  limit: 50
})
```

## 🧪 테스트

### 성능 예산 검사
```bash
# 모든 검사 실행
pnpm run test:performance:all

# 개별 검사
pnpm run test:performance:lighthouse
pnpm run test:performance:bundle
pnpm run test:performance:api
pnpm run test:performance:e2e
```

### E2E 성능 테스트
```bash
# 인증 성능 테스트
pnpm run test:performance:e2e
```

### Lighthouse CI
```bash
# Lighthouse 실행
npx lhci autorun

# 결과 분석
node scripts/performance-budget-check.js --lighthouse
```

## 📈 CI/CD 통합

### GitHub Actions 설정
성능 예산 검증이 자동으로 실행됩니다:

- **Pull Request**: 성능 회귀 검증
- **Main Branch**: 전체 성능 검사
- **Release**: 프로덕션 성능 검증

### 성능 예산 설정
```javascript
// lighthouserc.js
const PERFORMANCE_BUDGET = {
  lighthouse: {
    performance: 90,
    accessibility: 95,
    bestPractices: 90,
    seo: 90
  },
  coreWebVitals: {
    lcp: 2500,
    inp: 200,
    cls: 0.1
  },
  bundleSize: {
    javascript: 1024 * 1024, // 1MB
    css: 256 * 1024,         // 256KB
    total: 2 * 1024 * 1024   // 2MB
  }
}
```

## 🏗️ 아키텍처

### 파일 구조
```
src/
├── entities/performance/           # 성능 도메인 모델
│   ├── performance-metrics.ts      # 타입 정의 및 검증
│   ├── performance-store.ts        # Zustand 스토어
│   └── index.ts
├── features/performance/           # 성능 기능
│   ├── use-web-vitals.ts          # Web Vitals 훅
│   ├── use-api-monitoring.ts      # API 모니터링 훅
│   └── index.ts
├── widgets/performance/            # 성능 UI 컴포넌트
│   ├── PerformanceDashboard.tsx   # 대시보드
│   ├── PerformanceAlerts.tsx      # 알림
│   └── index.ts
├── shared/
│   ├── api/performance-api.ts     # API 클라이언트
│   └── lib/performance-provider.tsx # 프로바이더
└── tests/performance/             # E2E 테스트
    └── auth-performance.spec.ts
```

### 데이터 흐름
1. **수집**: Web Vitals + API Interceptor
2. **저장**: Zustand Store (클라이언트)
3. **전송**: 배치 API 전송
4. **분석**: 서버 집계 + 대시보드 표시
5. **알림**: 예산 위반 시 자동 알림

## 🔍 모니터링 항목

### Core Web Vitals
- **LCP**: 가장 큰 콘텐츠 로딩 시간
- **INP**: 상호작용 응답 시간 (FID 대체)
- **CLS**: 누적 레이아웃 시프트

### API 성능
- **응답 시간**: 평균, P75, P95
- **에러율**: 상태 코드별 분석
- **처리량**: 초당 요청 수
- **401 오류**: 인증 실패 패턴 분석

### 리소스 성능
- **번들 크기**: JS, CSS 개별 및 총합
- **이미지 최적화**: 형식, 압축률
- **폰트 로딩**: 웹폰트 성능

### 사용자 경험
- **디바이스별 분석**: 모바일, 데스크톱
- **브라우저별 분석**: Chrome, Safari, Firefox
- **네트워크별 분석**: 3G, 4G, WiFi

## 🚨 알림 시스템

### 예산 위반 알림
- LCP > 2.5초
- INP > 200ms
- CLS > 0.1
- API 응답 시간 > 100ms

### 에러 급증 알림
- 401 에러율 > 5%
- 5xx 에러율 > 1%
- 응답 시간 급증 (평균 대비 200% 이상)

## 📝 Best Practices

### 1. 성능 예산 준수
- CI/CD에서 자동 검증
- 회귀 방지를 위한 엄격한 기준
- 점진적 개선을 위한 단계적 목표

### 2. 모니터링 최적화
- 배치 전송으로 오버헤드 최소화
- 중요하지 않은 API 제외
- 프로덕션에서만 실시간 전송

### 3. 데이터 관리
- 민감 정보 로깅 금지
- 세션별 데이터 격리
- 적절한 보관 정책

### 4. 사용자 영향 최소화
- 모니터링 로직의 성능 최적화
- 에러 발생 시 graceful degradation
- 옵트아웃 옵션 제공

---

**📞 문의사항**
성능 모니터링 관련 문의는 William (Performance & Web Vitals Lead)에게 연락해주세요.