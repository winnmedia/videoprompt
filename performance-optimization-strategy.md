# 📈 Performance Vitals Guardian - 아키텍처 성능 최적화 전략

## 🎯 Core Web Vitals 목표 달성 전략

### 현재 목표 vs 실제 성능
- **LCP**: ≤2.5s (목표) → 현재 모니터링 중
- **INP**: ≤200ms (목표) → 현재 모니터링 중
- **CLS**: ≤0.1 (목표) → 현재 모니터링 중

## 🚨 CRITICAL: Redux 스토어 재구성 성능 영향

### 1. Auth Store 최적화 우선순위
```typescript
// 🚨 HIGH RISK: useEffect 의존성 배열 최적화 필요
// /src/app/store/useAuthStore.ts:129
useEffect(() => {
  loadAggregatedStats()
  if (!realtime) return
  const interval = setInterval(loadAggregatedStats, refreshInterval)
  return () => clearInterval(interval)
}, [timeRange, refreshInterval, realtime]) // 🚨 함수 제거됨 - $300 사건 방지
```

**최적화 방안:**
- 함수 의존성 완전 제거
- 캐싱 메커니즘 강화 (5분 → 10분)
- Promise 재사용 패턴 유지

### 2. Performance Store 분할 전략
현재 366줄 단일 파일 → 기능별 분할:
```
entities/performance/
├── core-web-vitals-store.ts     # LCP, INP, CLS
├── api-metrics-store.ts         # API 응답 시간
├── alerts-store.ts              # 성능 알림
└── session-store.ts             # 세션 관리
```

## 📦 번들 크기 최적화 전략

### 현재 번들 분석
```
vendors.js:    456KB ⚠️  (분할 필요)
framework.js:  180KB ✅  (적정)
common.js:     148KB ⚠️  (분할 필요)
polyfills.js:  112KB ✅  (적정)
```

### FSD 레이어별 코드 스플리팅

#### 1. Pages 레이어 (지연 로딩)
```typescript
// next.config.mjs 최적화
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'chart.js',
      'react-chartjs-2'
    ]
  },
  webpack: (config) => {
    config.optimization.splitChunks.cacheGroups = {
      // 페이지별 청크 분할
      pages: {
        test: /[\\/]src[\\/]app[\\/]/,
        name: 'pages',
        chunks: 'all',
        priority: 30
      },
      // 위젯 레이어 분할
      widgets: {
        test: /[\\/]src[\\/]widgets[\\/]/,
        name: 'widgets',
        chunks: 'all',
        priority: 25
      },
      // 기능 레이어 분할
      features: {
        test: /[\\/]src[\\/]features[\\/]/,
        name: 'features',
        chunks: 'all',
        priority: 20
      }
    }
  }
}
```

#### 2. Widgets 레이어 최적화
```typescript
// 성능 위젯 지연 로딩
const PerformanceDashboard = lazy(() =>
  import('@/widgets/performance/PerformanceDashboard')
)
const MonitoringDashboard = lazy(() =>
  import('@/widgets/monitoring-dashboard/ui/MonitoringDashboard')
)
```

#### 3. Features 레이어 트리 쉐이킹
```typescript
// 불필요한 Chart.js 모듈 제거
import {
  Chart as ChartJS,
  CategoryScale,    // 필요한 것만
  LinearScale,      // 필요한 것만
  PointElement,     // 필요한 것만
  LineElement,      // 필요한 것만
  Title,
  Tooltip,
  Legend
} from 'chart.js'

// 전체 registerables 대신 선택적 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)
```

## 🔄 API 호출 패턴 성능 최적화

### 1. API 호출 중복 방지 ($300 사건 재발 방지)
```typescript
// shared/lib/api-optimization.ts
class APICallGuard {
  private static activeRequests = new Map<string, Promise<any>>()
  private static lastCallTime = new Map<string, number>()

  static async guardedCall<T>(
    url: string,
    fetcher: () => Promise<T>,
    cacheTime = 60000 // 1분 캐시
  ): Promise<T> {
    const now = Date.now()
    const lastCall = this.lastCallTime.get(url)

    // 🚨 1분 내 중복 호출 방지
    if (lastCall && now - lastCall < cacheTime) {
      throw new Error(`API call blocked: ${url} called within ${cacheTime}ms`)
    }

    // 🚨 진행 중인 요청 재사용
    if (this.activeRequests.has(url)) {
      return this.activeRequests.get(url)!
    }

    const promise = fetcher()
    this.activeRequests.set(url, promise)
    this.lastCallTime.set(url, now)

    promise.finally(() => {
      this.activeRequests.delete(url)
    })

    return promise
  }
}
```

### 2. Performance API 최적화
```typescript
// features/performance/use-api-monitoring.ts 개선
export const useAPIMonitoring = () => {
  const addApiMetric = useCallback((metric: APIPerformanceMetric) => {
    // 🚀 배치 처리로 성능 향상
    batchApiMetrics.push(metric)

    if (batchApiMetrics.length >= BATCH_SIZE) {
      flushBatch()
    }
  }, [])

  const flushBatch = useCallback(
    debounce(() => {
      if (batchApiMetrics.length === 0) return

      performanceStore.getState().addApiMetrics(batchApiMetrics.splice(0))
    }, 1000),
    []
  )
}
```

## 📊 성능 모니터링 및 예산 관리

### 1. 강화된 성능 예산
```json
{
  "lcp": 2000,              // 2.5s → 2.0s (더 엄격)
  "inp": 150,               // 200ms → 150ms (더 엄격)
  "cls": 0.05,              // 0.1 → 0.05 (더 엄격)
  "apiResponseTime": 800,   // 1s → 800ms (더 엄격)
  "bundleSize": {
    "total": 800000,        // 1MB → 800KB
    "javascript": 400000,   // 512KB → 400KB
    "css": 51200,           // 100KB → 50KB
    "images": 1048576       // 2MB 유지
  },
  "lighthouse": {
    "performance": 95,      // 90 → 95 (더 엄격)
    "accessibility": 98,    // 95 → 98
    "bestPractices": 95,    // 90 → 95
    "seo": 98              // 95 → 98
  }
}
```

### 2. 실시간 성능 회귀 감지
```typescript
// scripts/performance-regression-detector.ts
export class PerformanceRegressionDetector {
  static detectRegression(
    current: PerformanceMetrics,
    baseline: PerformanceMetrics
  ): RegressionAlert[] {
    const alerts: RegressionAlert[] = []

    // 🚨 LCP 회귀 감지 (10% 이상 악화)
    if (current.lcp > baseline.lcp * 1.1) {
      alerts.push({
        type: 'LCP_REGRESSION',
        severity: 'CRITICAL',
        current: current.lcp,
        baseline: baseline.lcp,
        degradation: ((current.lcp - baseline.lcp) / baseline.lcp) * 100
      })
    }

    // 🚨 번들 크기 회귀 감지 (5% 이상 증가)
    if (current.bundleSize > baseline.bundleSize * 1.05) {
      alerts.push({
        type: 'BUNDLE_SIZE_REGRESSION',
        severity: 'HIGH',
        current: current.bundleSize,
        baseline: baseline.bundleSize,
        increase: current.bundleSize - baseline.bundleSize
      })
    }

    return alerts
  }
}
```

### 3. CI/CD 성능 게이트
```bash
# scripts/performance-budget-enforcer.sh
#!/bin/bash

echo "🔍 Performance Budget Enforcement"

# Lighthouse CI 실행
npx lhci autorun

# 번들 크기 검사
BUNDLE_SIZE=$(du -s .next/static | cut -f1)
MAX_BUNDLE_SIZE=800000

if [ $BUNDLE_SIZE -gt $MAX_BUNDLE_SIZE ]; then
  echo "🚨 BUNDLE SIZE VIOLATION: ${BUNDLE_SIZE}KB > ${MAX_BUNDLE_SIZE}KB"
  exit 1
fi

# API 응답 시간 검사 (smoke test)
RESPONSE_TIME=$(curl -w "%{time_total}" -s -o /dev/null https://videoprompt.vercel.app/api/health)
MAX_RESPONSE_TIME=0.8

if (( $(echo "$RESPONSE_TIME > $MAX_RESPONSE_TIME" | bc -l) )); then
  echo "🚨 API RESPONSE TIME VIOLATION: ${RESPONSE_TIME}s > ${MAX_RESPONSE_TIME}s"
  exit 1
fi

echo "✅ Performance budget compliance verified"
```

## 🎛️ $300 사건 재발 방지 전략

### 1. useEffect 의존성 배열 엄격 규칙
```typescript
// eslint-rules/performance-safety.js
module.exports = {
  rules: {
    'no-function-deps-in-effect': {
      create(context) {
        return {
          CallExpression(node) {
            if (node.callee.name === 'useEffect') {
              const deps = node.arguments[1]
              if (deps && deps.type === 'ArrayExpression') {
                deps.elements.forEach(dep => {
                  if (dep.type === 'Identifier') {
                    // 🚨 함수인지 확인
                    const binding = context.getScope().set.get(dep.name)
                    if (binding && binding.type === 'function') {
                      context.report({
                        node: dep,
                        message: '🚨 $300 RISK: Function dependency in useEffect can cause infinite loops'
                      })
                    }
                  }
                })
              }
            }
          }
        }
      }
    }
  }
}
```

### 2. API 호출 비용 모니터링
```typescript
// shared/lib/cost-monitoring.ts
export class APICostMonitor {
  private static callCount = new Map<string, number>()
  private static costThreshold = {
    '/api/auth/me': 5,        // 5회/분
    '/api/ai/generate': 2,    // 2회/분 (비용 높음)
    '/api/performance': 10    // 10회/분
  }

  static trackCall(endpoint: string): void {
    const minute = Math.floor(Date.now() / 60000)
    const key = `${endpoint}-${minute}`

    const count = this.callCount.get(key) || 0
    this.callCount.set(key, count + 1)

    const threshold = this.costThreshold[endpoint] || 20

    if (count + 1 > threshold) {
      console.error(`🚨 COST ALERT: ${endpoint} exceeded ${threshold} calls/minute`)

      // Sentry 알림
      if (typeof window !== 'undefined') {
        // 프로덕션에서는 Sentry로 알림
        console.error('Cost threshold exceeded', { endpoint, count: count + 1 })
      }
    }
  }
}
```

## 📈 성능 KPI 및 모니터링

### 1. 핵심 성능 지표
- **Core Web Vitals p75**: LCP ≤2.0s, INP ≤150ms, CLS ≤0.05
- **번들 크기**: Total ≤800KB, JS ≤400KB
- **API 응답 시간**: p95 ≤800ms
- **페이지 로드 시간**: p90 ≤3.0s

### 2. 알림 시스템
```typescript
// Performance Alert 임계값
const ALERT_THRESHOLDS = {
  LCP_WARNING: 2500,      // 2.5s
  LCP_CRITICAL: 3000,     // 3.0s
  INP_WARNING: 200,       // 200ms
  INP_CRITICAL: 300,      // 300ms
  BUNDLE_WARNING: 850000, // 850KB
  BUNDLE_CRITICAL: 1000000 // 1MB
}
```

### 3. 주간 성능 리포트
- Core Web Vitals 트렌드
- 번들 크기 변화
- API 응답 시간 분포
- 성능 예산 준수율

## 🔧 구현 우선순위

### Phase 1: 즉시 구현 (이번 주)
1. ✅ useEffect 의존성 배열 최적화 (Auth Store)
2. ✅ API 호출 중복 방지 가드 구현
3. ✅ 성능 예산 강화

### Phase 2: 단기 구현 (2주 내)
1. Performance Store 분할
2. 번들 크기 최적화 (Chart.js 트리 쉐이킹)
3. FSD 레이어별 코드 스플리팅

### Phase 3: 중기 구현 (1개월 내)
1. 실시간 성능 회귀 감지 시스템
2. CI/CD 성능 게이트 강화
3. 종합 성능 대시보드 구축

---

**Performance Vitals Guardian 서명**
- 날짜: 2025-09-20
- 목표: Core Web Vitals 100% 달성, $300 사건 재발 방지
- 모토: "Every millisecond matters. Zero tolerance for regressions."