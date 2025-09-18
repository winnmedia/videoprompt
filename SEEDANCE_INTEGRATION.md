# Seedance API 통합 가이드

이 문서는 VideoPlanet 프로젝트에서 Seedance (BytePlus ModelArk) API 통합 시스템에 대한 완전한 가이드입니다.

## 🎯 개요

### 주요 기능
- ✅ **완전한 API 키 검증**: 하드코딩된 테스트 키 제거 및 안전한 검증
- ✅ **Redux 상태 관리**: Provider 상태의 중앙 집중식 관리
- ✅ **Graceful Degradation**: API 장애 시 자동 Mock 폴백
- ✅ **Circuit Breaker 패턴**: 연속 실패 시 자동 복구 시스템
- ✅ **환경별 에러 메시지**: 개발/프로덕션/테스트 환경 맞춤 메시지
- ✅ **MSW 완전 모킹**: 결정론적 테스트 환경

### 아키텍처 원칙
- **TDD 기반 개발**: 모든 기능이 테스트 우선으로 구현됨
- **FSD 준수**: Feature-Sliced Design 아키텍처 경계 준수
- **Type Safety**: 100% TypeScript 타입 안전성
- **Zero Network Calls**: 테스트 시 실제 네트워크 호출 차단

## 🚀 빠른 시작

### 1. 개발 환경 설정

```bash
# 프로젝트 루트에 환경변수 파일 생성
touch .env.local

# API 키 설정 (선택사항)
echo "SEEDANCE_API_KEY=ark_your_actual_key_here" >> .env.local

# 또는 Mock 모드 강제 활성화
echo "NEXT_PUBLIC_ENABLE_MOCK_API=true" >> .env.local
```

### 2. 기본 사용법

```typescript
import { useSeedanceProvider } from '@/entities/seedance/hooks/use-seedance-provider';

function VideoCreator() {
  const {
    isAvailable,
    isMockMode,
    hasValidKey,
    initializeProvider,
    validateApiKey
  } = useSeedanceProvider();

  if (!isAvailable) {
    return <div>영상 생성 서비스를 준비 중입니다...</div>;
  }

  return (
    <div>
      <p>모드: {isMockMode ? 'Mock' : '실제 API'}</p>
      <p>API 키: {hasValidKey ? '유효' : '없음'}</p>
      {/* 영상 생성 UI */}
    </div>
  );
}
```

## 📚 API 사용법

### 영상 생성

```typescript
import { seedanceService } from '@/lib/providers/seedance-service';

// Graceful Degradation이 적용된 영상 생성
const result = await seedanceService.createVideo({
  prompt: 'A beautiful sunset over mountains',
  aspect_ratio: '16:9',
  duration_seconds: 8,
  quality: 'standard'
});

if (result.ok) {
  console.log('작업 ID:', result.jobId);
  console.log('사용된 서비스:', result.source); // 'real' | 'mock'

  if (result.fallbackReason) {
    console.warn('폴백 사용:', result.fallbackReason);
  }
}
```

### 상태 확인

```typescript
// 작업 상태 확인
const status = await seedanceService.getStatus(jobId);

if (status.ok) {
  console.log('상태:', status.status);
  console.log('진행률:', status.progress);

  if (status.status === 'completed') {
    console.log('영상 URL:', status.videoUrl);
  }
}
```

### 서비스 헬스체크

```typescript
// 서비스 상태 진단
const health = await seedanceService.runHealthCheck();

console.log('서비스 상태:', health.isHealthy);
console.log('연속 실패 횟수:', health.consecutiveFailures);
console.log('신뢰도:', health.capabilities.estimatedReliability);
```

## 🔧 환경별 설정

### 개발 환경 (Development)

```bash
# .env.local
NODE_ENV=development

# 옵션 1: 실제 API 키 사용
SEEDANCE_API_KEY=ark_your_development_key

# 옵션 2: Mock 모드 (권장)
NEXT_PUBLIC_ENABLE_MOCK_API=true
```

**특징:**
- API 키 없으면 자동으로 Mock 모드 활성화
- 상세한 디버깅 정보 제공
- 에러 시 개발자용 해결방법 안내

### 프로덕션 환경 (Production)

```bash
# Vercel/Railway 환경변수
NODE_ENV=production
SEEDANCE_API_KEY=ark_your_production_key_here

# 선택적 설정
SEEDANCE_MODEL=seedance-1-0-pro-250528
SEEDANCE_API_BASE=https://ark.ap-southeast.bytepluses.com
```

**특징:**
- 반드시 유효한 API 키 필요
- Mock 모드 비활성화
- 사용자 친화적 에러 메시지
- 자동 모니터링 및 알림

### 테스트 환경 (Test)

```bash
# CI/CD 환경변수
NODE_ENV=test
NEXT_PUBLIC_ENABLE_MOCK_API=true

# 선택적: 실제 API 테스트용
TEST_SEEDANCE_API_KEY=ark_your_test_key
```

**특징:**
- 기본적으로 Mock 모드 사용
- MSW 핸들러로 완전한 API 모킹
- 결정론적 테스트 실행
- 실제 네트워크 호출 차단

## 🛠 설정 진단 도구

### 자동 진단

```typescript
import { diagnoseCurrentSetup, getSetupSummary } from '@/lib/providers/seedance-setup-guide';

// 상세 진단
const diagnosis = diagnoseCurrentSetup();
console.log('환경:', diagnosis.environment);
console.log('전체 상태:', diagnosis.overallStatus);
console.log('추천사항:', diagnosis.recommendations);

// 요약 정보
const summary = getSetupSummary();
console.log('완료된 단계:', `${summary.completedSteps}/${summary.totalSteps}`);
console.log('심각한 문제:', summary.criticalIssues);
```

### 설정 상태 페이지 (개발용)

```typescript
// pages/dev/seedance-status.tsx
import { diagnoseCurrentSetup } from '@/lib/providers/seedance-setup-guide';

export default function SeedanceStatusPage() {
  const diagnosis = diagnoseCurrentSetup();

  return (
    <div>
      <h1>Seedance 설정 상태</h1>
      <div className={`status-${diagnosis.overallStatus}`}>
        상태: {diagnosis.overallStatus}
      </div>

      <h2>설정 단계</h2>
      {diagnosis.steps.map(step => (
        <div key={step.id} className={`step-${step.status}`}>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
          <ul>
            {step.actions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

## 🧪 테스트 작성법

### 단위 테스트

```typescript
import { setupMSW, mswTestUtils } from '@/tests/setup/msw-setup';
import { seedanceService } from '@/lib/providers/seedance-service';

// MSW 설정
setupMSW();

describe('Seedance 테스트', () => {
  test('영상 생성 성공', async () => {
    const result = await seedanceService.createVideo({
      prompt: 'Test video',
      aspect_ratio: '16:9',
      duration_seconds: 5
    });

    expect(result.ok).toBe(true);
    expect(result.source).toBe('mock');
  });

  test('네트워크 에러 시 폴백', async () => {
    // 네트워크 에러 시뮬레이션
    mswTestUtils.simulateNetworkError();

    const result = await seedanceService.createVideo({
      prompt: 'Test during network error',
      aspect_ratio: '16:9',
      duration_seconds: 5
    });

    expect(result.ok).toBe(true);
    expect(result.fallbackReason).toBeDefined();
  });
});
```

### 통합 테스트

```typescript
import { POST } from '@/app/api/seedance/create/route';
import { NextRequest } from 'next/server';

test('API 라우트 통합 테스트', async () => {
  const request = new NextRequest('http://localhost/api/seedance/create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Integration test video',
      aspect_ratio: '16:9',
      duration_seconds: 5
    })
  });

  const response = await POST(request, { user: { id: 'test-user' } });
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.success).toBe(true);
  expect(data.data.jobId).toBeDefined();
});
```

## 🔍 에러 처리

### 에러 컨텍스트 자동 감지

시스템은 에러 메시지를 분석하여 자동으로 적절한 컨텍스트와 해결방법을 제공합니다:

- **api_key**: API 키 관련 문제
- **network**: 네트워크 연결 문제
- **quota**: 사용량 한도 초과
- **model**: 모델 활성화 문제
- **validation**: 입력 데이터 검증 문제
- **unknown**: 기타 알 수 없는 문제

### 환경별 에러 메시지

```typescript
// 개발환경: 상세한 디버깅 정보
{
  "error": {
    "message": "개발 환경에서 API 키가 설정되지 않았습니다. Mock 모드로 자동 전환되었습니다.",
    "severity": "low",
    "developmentInfo": {
      "detailedMessage": "SEEDANCE_API_KEY 환경변수가 없거나 유효하지 않습니다...",
      "actionRequired": ["실제 API를 테스트하려면 .env.local에 SEEDANCE_API_KEY 추가", ...],
      "helpUrl": "https://www.volcengine.com/docs/6348/74419",
      "estimatedFixTime": "5-10분"
    }
  }
}

// 프로덕션환경: 사용자 친화적 메시지
{
  "error": {
    "message": "영상 생성 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
    "severity": "critical"
  }
}
```

## 📊 모니터링 및 알림

### Circuit Breaker 상태

```typescript
const healthStatus = seedanceService.getHealthStatus();

// 모니터링 대시보드에 전송
if (healthStatus.consecutiveFailures > 2) {
  // 알림 시스템에 경고 전송
  sendAlert('Seedance service degraded', {
    failures: healthStatus.consecutiveFailures,
    reliability: healthStatus.capabilities.estimatedReliability
  });
}
```

### 성능 메트릭

```typescript
// API 응답 시간 측정
const startTime = Date.now();
const result = await seedanceService.createVideo(payload);
const responseTime = Date.now() - startTime;

// 메트릭 수집
metrics.histogram('seedance.create_video.duration', responseTime, {
  source: result.source,
  success: result.ok
});
```

## 🔐 보안 고려사항

### API 키 보안

- ✅ 환경변수로만 관리
- ✅ 하드코딩된 키 자동 차단
- ✅ 로그에서 키 마스킹
- ✅ 프론트엔드 노출 방지

### 검증 패턴

```typescript
// 유효한 키 형식
✅ ark_AbCdEf123456789...  (ark_ 접두사)
✅ VeryLongApiKeyOver50Characters... (50자 이상)

// 차단되는 키 형식
❌ 007f7ffe-84c3-4cdc-b0af-4e00dafdc81c  (UUID 형식)
❌ test-key-123  (테스트 키 패턴)
❌ short  (너무 짧은 키)
```

## 🚀 배포 체크리스트

### 개발 → 스테이징

- [ ] API 키 검증 로직 테스트
- [ ] Mock 모드 정상 동작 확인
- [ ] 에러 시나리오 테스트
- [ ] Circuit Breaker 동작 확인

### 스테이징 → 프로덕션

- [ ] 프로덕션 API 키 설정
- [ ] 환경변수 보안 검토
- [ ] 모니터링 시스템 연동
- [ ] 알림 시스템 설정
- [ ] 백업 계획 수립

## 📝 문제 해결

### 자주 발생하는 문제

#### 1. "Mock 모드가 계속 활성화됨"

```bash
# 원인: API 키 형식이 올바르지 않음
# 해결: 키 형식 확인
echo $SEEDANCE_API_KEY | wc -c  # 50자 이상이어야 함

# 또는 강제로 실제 API 테스트
unset NEXT_PUBLIC_ENABLE_MOCK_API
```

#### 2. "프로덕션에서 503 에러 발생"

```bash
# 원인: API 키가 설정되지 않음
# 해결: 환경변수 확인
echo $SEEDANCE_API_KEY

# Vercel에서 확인
vercel env ls
```

#### 3. "테스트가 간헐적으로 실패함"

```typescript
// 원인: MSW 핸들러 리셋 누락
// 해결: 올바른 MSW 설정
import { setupMSW } from '@/tests/setup/msw-setup';
setupMSW(); // 각 테스트 파일에서 호출
```

### 디버깅 도구

```typescript
// 상세 로깅 활성화 (개발환경)
localStorage.setItem('seedance-debug', 'true');

// 설정 상태 확인
console.log(getSetupSummary());

// Circuit Breaker 상태 확인
console.log(seedanceService.getHealthStatus());
```

## 🤝 기여하기

### 새로운 기능 추가

1. TDD 방식으로 테스트 먼저 작성
2. 실패 테스트 확인
3. 최소 구현으로 테스트 통과
4. 리팩토링 및 최적화

### 에러 시나리오 추가

```typescript
// 새로운 에러 컨텍스트 추가
// src/lib/providers/seedance-error-messages.ts 수정
export function detectErrorContext(error: string): ErrorContext {
  // 새로운 패턴 추가
  if (lowerError.includes('your_new_pattern')) {
    return 'your_new_context';
  }
  // ...
}
```

---

**문의사항이나 문제가 있으시면 개발팀에 연락해주세요.**

📧 Email: dev-team@videoplanet.com
💬 Slack: #video-generation-support
📖 Docs: https://docs.videoplanet.com/seedance