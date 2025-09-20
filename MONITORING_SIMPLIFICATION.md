# 모니터링 시스템 단순화 가이드

## 🎯 목표
복잡한 모니터링 시스템을 CLAUDE.md 원칙(YAGNI, 단순성, 통합성)에 맞게 단순화

## 📊 현재 상황 vs 단순화된 시스템

### ❌ 제거할 복잡한 시스템들

1. **과도한 Performance Store (Zustand)**
   - `src/entities/performance/performance-store.ts`
   - 별도 상태 관리 시스템 (Redux와 중복)

2. **복잡한 Quality Monitor**
   - `src/shared/lib/monitoring/quality-monitor.ts`
   - 과도한 메트릭 추적 및 singleton 패턴

3. **다수의 모니터링 위젯들**
   - `src/widgets/monitoring-dashboard/`
   - `src/widgets/performance/RealTimePerformanceMonitor.tsx`
   - `src/widgets/performance/PerformanceAlerts.tsx`
   - `src/widgets/performance/PerformanceDashboard.tsx`

### ✅ 단순화된 시스템

1. **Simple Monitor**
   - `src/shared/lib/monitoring/simple-monitor.ts`
   - 핵심 기능만: $300 사건 방지, API 추적, 기본 메트릭

2. **Simple Performance Hook**
   - `src/shared/hooks/useSimplePerformance.ts`
   - Core Web Vitals, API 성능, 메모리 추적만

3. **Single Monitor Widget**
   - `src/widgets/monitoring/SimpleMonitorWidget.tsx`
   - 개발 환경에서만 동작하는 간단한 모니터

## 🔄 마이그레이션 단계

### Phase 1: 단순화된 시스템 도입 ✅

```typescript
// 기존 복잡한 사용법
import { QualityMonitor } from '@/shared/lib/monitoring/quality-monitor';
import { usePerformanceStore } from '@/entities/performance';

// 새로운 단순한 사용법
import { trackApi, trackMetric } from '@/shared/lib/monitoring/simple-monitor';
import { usePerformanceMonitoring } from '@/shared/hooks/useSimplePerformance';
```

### Phase 2: API 호출 추적 적용

```typescript
// API 호출 전
import { trackApi } from '@/shared/lib/monitoring/simple-monitor';

const handleApiCall = async () => {
  trackApi('/api/auth/me', 0.001); // 비용 추적
  const response = await fetch('/api/auth/me');
  // ...
};
```

### Phase 3: 컴포넌트 성능 추적

```typescript
// 컴포넌트에서
import { usePerformanceMonitoring } from '@/shared/hooks/useSimplePerformance';

function MyComponent() {
  usePerformanceMonitoring('MyComponent'); // 렌더링 추적
  // ...
}
```

### Phase 4: 개발 환경 모니터링 위젯

```typescript
// _app.tsx 또는 layout.tsx에서
import { DevMonitorProvider } from '@/widgets/monitoring/SimpleMonitorWidget';

export default function App({ children }) {
  return (
    <DevMonitorProvider>
      {children}
    </DevMonitorProvider>
  );
}
```

## 📋 제거 대상 파일들

다음 파일들은 안전하게 제거 가능:

```bash
# 복잡한 Performance 시스템
src/entities/performance/performance-store.ts
src/entities/performance/performance-metrics.ts
src/features/performance/use-api-monitoring.ts
src/features/performance/use-web-vitals.ts

# 복잡한 Monitoring 위젯들
src/widgets/monitoring-dashboard/
src/widgets/performance/RealTimePerformanceMonitor.tsx
src/widgets/performance/PerformanceAlerts.tsx
src/widgets/performance/PerformanceDashboard.tsx

# 복잡한 Quality Monitor
src/shared/lib/monitoring/quality-monitor.ts

# 관련 테스트 파일들 (필요시)
src/__tests__/performance/performance-guards.test.ts
src/entities/performance/__tests__/
```

## 🎉 단순화의 이점

### 1. 복잡도 감소
- **Before**: 10+ 파일, 복잡한 클래스, 다수의 상태 관리
- **After**: 3개 파일, 단순한 함수, 통합된 접근

### 2. 메모리 사용량 감소
- 과도한 메트릭 수집 제거
- 필요한 정보만 추적

### 3. 개발자 경험 향상
- 이해하기 쉬운 API
- 개발 환경에서만 동작
- 핵심 목표에 집중 ($300 사건 방지)

### 4. CLAUDE.md 원칙 준수
- ✅ **YAGNI**: 현재 필요한 기능만
- ✅ **단순성**: 이해하기 쉬운 코드
- ✅ **통합성**: 기존 시스템과 조화

## 🚨 주의사항

1. **점진적 마이그레이션**: 한번에 모든 파일을 제거하지 말고 단계적으로 진행
2. **테스트 확인**: 기존 테스트가 단순화된 시스템에서도 동작하는지 확인
3. **프로덕션 영향 없음**: 새로운 모니터링은 개발 환경에서만 동작

## 📈 성과 측정

- [ ] 모니터링 관련 코드 줄 수: ~80% 감소
- [ ] 메모리 사용량: ~50% 감소
- [ ] 개발자 이해도: 현저한 향상
- [ ] $300 사건 방지 기능: 유지 강화