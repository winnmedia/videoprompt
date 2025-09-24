# Phase 3.4 영상 생성 워크플로우 아키텍처

## 개요

Phase 3.4는 VideoPlanet의 핵심 기능인 영상 생성 워크플로우를 구현합니다. UserJourneyMap 15-18단계(프롬프트 → 영상 생성 → 로딩바 → 영상 플레이어 → 피드백/재생성)를 포함하며, FSD(Feature-Sliced Design) 아키텍처 원칙을 엄격히 준수합니다.

## 핵심 특징

- **다중 제공업체 지원**: Runway ML, ByteDance Seedance, Stable Video Diffusion
- **견고한 에러 처리**: 자동 재시도, 폴백 전략, Circuit Breaker 패턴
- **비동기 큐 시스템**: 우선순위 기반 작업 스케줄링 및 동시 처리
- **실시간 모니터링**: 진행 상태 추적 및 WebSocket 기반 업데이트
- **비용 안전**: API 호출 제한 및 사용량 모니터링

## FSD 아키텍처 구조

```
src/
├── entities/video/                    # 도메인 모델 (순수 비즈니스 로직)
│   ├── types.ts                      # 도메인 타입 정의
│   ├── model.ts                      # 비즈니스 규칙 및 검증
│   ├── store.ts                      # Redux Toolkit 상태 관리
│   └── index.ts                      # Public API
│
├── features/video-generation/         # 영상 생성 유스케이스
│   ├── hooks/
│   │   ├── use-video-generation.ts   # 영상 생성 훅
│   │   ├── use-video-progress.ts     # 진행 상태 모니터링
│   │   └── use-video-queue.ts        # 큐 관리
│   ├── api/
│   │   ├── video-service.ts          # 서비스 레이어
│   │   └── video-transformers.ts     # 데이터 변환
│   └── index.ts                      # Public API
│
├── widgets/video/                     # UI 컴포넌트
│   ├── VideoGenerationPanel.tsx      # 영상 생성 패널
│   ├── VideoProgressBar.tsx          # 진행 상태 표시
│   ├── VideoPlayer.tsx               # 영상 플레이어
│   ├── VideoQueue.tsx                # 큐 관리 위젯
│   ├── VideoFeedback.tsx             # 피드백/재생성
│   └── index.ts                      # Public API
│
└── shared/lib/                        # 공통 기술 구현
    ├── video-clients/                 # API 클라이언트들
    │   ├── base-client.ts            # 베이스 클라이언트
    │   ├── runway-client.ts          # Runway ML 클라이언트
    │   ├── seedance-client.ts        # Seedance 클라이언트
    │   ├── stable-video-client.ts    # Stable Video 클라이언트
    │   └── index.ts                  # 클라이언트 팩토리
    ├── video-queue.ts                # 비동기 큐 시스템
    └── video-error-handler.ts        # 에러 처리 및 복구
```

## 핵심 컴포넌트

### 1. entities/video - 도메인 모델

#### 주요 타입

```typescript
// 영상 생성 상태
type VideoGenerationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

// 지원 제공업체
type VideoProvider = 'runway' | 'seedance' | 'stable-video';

// 영상 생성 도메인 모델
interface VideoGeneration {
  id: string;
  scenarioId: string;
  projectId: string;
  userId: string;
  status: VideoGenerationStatus;
  provider: VideoProvider;
  inputPrompt: string;
  outputVideoUrl?: string;
  metadata: VideoMetadata;
  // ... 기타 필드
}
```

#### 비즈니스 규칙

- 프롬프트 길이 제한 (최대 1000자)
- 영상 길이 제한 (최대 30초)
- 해상도 검증 (256x256 ~ 2048x2048)
- 상태 전이 규칙 검증
- 재시도 가능 여부 판단

### 2. shared/lib/video-clients - API 추상화

#### 베이스 클라이언트

```typescript
abstract class BaseVideoClient {
  abstract generateVideo(params: VideoApiParams): Promise<VideoApiJob>;
  abstract getJobStatus(jobId: string): Promise<VideoApiJob>;
  abstract cancelJob(jobId: string): Promise<void>;

  // 공통 기능
  protected withRetry<T>(operation: () => Promise<T>): Promise<T>;
  protected makeRequest<T>(endpoint: string, method: string): Promise<T>;
  protected validateParams(params: VideoApiParams): void;
}
```

#### 제공업체별 특징

- **Runway ML**: 최대 30초, 고품질, 카메라 컨트롤 지원
- **Seedance**: 최대 10초, 빠른 생성, 스타일 컨트롤
- **Stable Video**: 최대 4초, 이미지 필수, 오픈소스

### 3. shared/lib/video-queue - 비동기 큐 시스템

#### 핵심 기능

```typescript
class VideoQueue {
  async enqueue(item: VideoQueueItem): Promise<void>;
  async dequeue(itemId: string): Promise<boolean>;

  // 상태 관리
  pause(): void;
  resume(): Promise<void>;
  getStatus(): QueueStatus;

  // 이벤트 시스템
  on(eventType: QueueEventType, listener: Function): () => void;
}
```

#### 큐 관리 특징

- 우선순위 기반 스케줄링
- 동시 처리 제한 (기본 3개)
- 자동 재시도 (지수 백오프)
- 처리 타임아웃 관리
- 이벤트 기반 모니터링

### 4. shared/lib/video-error-handler - 에러 처리

#### 에러 분류 및 전략

```typescript
enum ErrorCategory {
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  QUOTA_EXCEEDED = 'quota',
  NETWORK = 'network',
  SERVER_ERROR = 'server',
  // ...
}

enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK_PROVIDER = 'fallback',
  QUEUE_DELAY = 'queue_delay',
  USER_NOTIFICATION = 'notify_user',
  // ...
}
```

#### 자동 복구 메커니즘

- 네트워크 오류 → 자동 재시도
- 제공업체 오류 → 다른 제공업체로 폴백
- 요청 제한 → 큐 지연 추가
- 할당량 초과 → 사용자 알림

## 비용 안전 규칙

### API 호출 제한

```typescript
// useEffect 의존성에 함수 절대 금지
useEffect(() => {
  generateVideo(); // ✅ 올바름
}, []); // 빈 배열로 1회만 실행

// ❌ 금지: useEffect에 함수 의존성
useEffect(() => {
  generateVideo();
}, [generateVideo]); // 무한 호출 위험
```

### 요청 간격 제한

- Runway: 최소 5초 간격
- Seedance: 최소 3초 간격
- Stable Video: 최소 10초 간격
- 중복 요청 방지 체크

### 사용량 모니터링

- 일일 생성 한도 추적
- 사용자 등급별 제한
- 실시간 비용 추적

## 사용 예시

### 1. 영상 생성 요청

```typescript
import { useVideoGeneration } from 'features/video-generation'

function VideoCreationForm() {
  const { generateVideo, isGenerating, error } = useVideoGeneration()

  const handleSubmit = async (formData) => {
    await generateVideo({
      scenarioId: 'scenario-123',
      projectId: 'project-456',
      provider: 'runway',
      params: {
        prompt: formData.prompt,
        duration: 5,
        aspectRatio: '16:9'
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* 폼 필드들 */}
      <button disabled={isGenerating}>
        {isGenerating ? '생성 중...' : '영상 생성'}
      </button>
      {error && <ErrorMessage error={error} />}
    </form>
  )
}
```

### 2. 진행 상태 모니터링

```typescript
import { useVideoProgress } from 'features/video-generation'

function VideoProgressTracker({ videoId }) {
  const { status, progress, estimatedTime } = useVideoProgress(videoId)

  return (
    <div className="progress-tracker">
      <ProgressBar value={progress} />
      <StatusBadge status={status} />
      {estimatedTime && (
        <TimeRemaining seconds={estimatedTime} />
      )}
    </div>
  )
}
```

### 3. 큐 관리

```typescript
import { useVideoQueue } from 'features/video-generation'

function QueueManager() {
  const { queue, processing, pause, resume, cancel } = useVideoQueue()

  return (
    <div className="queue-manager">
      <QueueControls onPause={pause} onResume={resume} />
      <QueueList
        items={queue}
        processing={processing}
        onCancel={cancel}
      />
    </div>
  )
}
```

## 테스트 전략

### 1. 단위 테스트 (entities)

```typescript
// entities/video/model.test.ts
describe('VideoGenerationDomain', () => {
  it('should validate generation request', () => {
    const request = createMockRequest();
    const result = VideoGenerationDomain.validateGenerationRequest(request);
    expect(result.isValid).toBe(true);
  });
});
```

### 2. 통합 테스트 (features)

```typescript
// features/video-generation/hooks/use-video-generation.test.ts
describe('useVideoGeneration', () => {
  it('should handle generation flow', async () => {
    const { result } = renderHook(() => useVideoGeneration());
    await act(async () => {
      await result.current.generateVideo(mockParams);
    });
    expect(result.current.isGenerating).toBe(false);
  });
});
```

### 3. E2E 테스트 (workflows)

```typescript
// cypress/e2e/video-generation.cy.ts
describe('Video Generation Workflow', () => {
  it('should complete full generation process', () => {
    cy.visit('/scenario/123');
    cy.fillVideoForm();
    cy.clickGenerate();
    cy.waitForVideoCompletion();
    cy.verifyVideoPlayer();
  });
});
```

## 성능 최적화

### 1. 코드 스플리팅

```typescript
// Lazy loading으로 번들 크기 최적화
const VideoGenerationPanel = lazy(
  () => import('widgets/video/VideoGenerationPanel')
);
```

### 2. 메모이제이션

```typescript
// 비싼 계산 캐싱
const processedVideos = useMemo(
  () => videos.filter((v) => v.status === 'completed'),
  [videos]
);
```

### 3. 가상화

```typescript
// 대량 목록 가상화
import { VirtualList } from 'shared/lib/virtual-list'

<VirtualList
  items={videos}
  renderItem={VideoItem}
  itemHeight={100}
/>
```

## 모니터링 및 알림

### 1. 핵심 지표

- 생성 성공률 (제공업체별)
- 평균 처리 시간
- 큐 대기 시간
- 에러 발생률
- 비용 사용량

### 2. 알림 설정

- 에러율 임계값 초과 시 즉시 알림
- 큐 적체 상황 모니터링
- 비용 예산 초과 경고
- 제공업체 장애 감지

## 배포 고려사항

### 1. 환경변수

```bash
# API 키들
RUNWAY_API_KEY=your_runway_key
SEEDANCE_API_KEY=your_seedance_key
STABILITY_API_KEY=your_stability_key

# 큐 설정
VIDEO_QUEUE_MAX_CONCURRENT=3
VIDEO_QUEUE_RETRY_DELAY=30000

# 모니터링
SENTRY_DSN=your_sentry_dsn
```

### 2. 인프라 요구사항

- Redis (큐 상태 지속성)
- WebSocket 지원 (실시간 업데이트)
- 모니터링 시스템 (Sentry, DataDog)
- 로드 밸런서 (다중 인스턴스)

## 향후 확장 계획

### 1. 추가 제공업체

- OpenAI Sora
- Meta Make-A-Video
- Google Imagen Video

### 2. 고급 기능

- 배치 처리
- 워크플로우 자동화
- A/B 테스트 지원
- 커스텀 모델 지원

### 3. 최적화

- 엣지 캐싱
- CDN 통합
- 압축 최적화
- 스트리밍 지원

이 아키텍처는 확장 가능하고 유지보수가 용이하며, FSD 원칙을 준수하여 장기적인 시스템 안정성을 보장합니다.
