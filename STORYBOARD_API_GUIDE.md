# Storyboard API Guide

스토리보드 이미지 생성을 위한 API 엔드포인트 가이드입니다.

## 개요

- **ByteDance-Seedream API 연동**: 고품질 스토리보드 이미지 생성
- **참조 이미지 기반 일관성 유지**: 시리즈 전체의 스타일 통일성 보장
- **비용 안전 미들웨어**: $300 사건 방지를 위한 엄격한 호출 제한
- **실시간 진행률 업데이트**: 배치 생성의 현재 상태 모니터링

## API 엔드포인트

### 1. 개별 스토리보드 프레임 생성

**`POST /api/storyboard/generate`**

단일 스토리보드 프레임을 생성합니다.

```typescript
// 요청 예시
const response = await fetch('/api/storyboard/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    storyboardId: '123e4567-e89b-12d3-a456-426614174000',
    frame: {
      sceneId: '123e4567-e89b-12d3-a456-426614174001',
      sceneDescription: 'A person walking in the park during sunset',
      additionalPrompt: 'cinematic lighting, warm colors',
      priority: 'normal',
      config: {
        style: 'cinematic',
        quality: 'hd'
      },
      consistencyRefs: ['ref-uuid-1', 'ref-uuid-2']
    },
    forceRegenerate: false,
    useConsistencyGuide: true
  })
});

// 응답 예시
{
  "success": true,
  "data": {
    "frameId": "frame-uuid",
    "storyboardId": "storyboard-uuid",
    "imageUrl": "https://storage.example.com/generated-image.png",
    "thumbnailUrl": "https://storage.example.com/thumbnail.png",
    "status": "completed",
    "model": "seedream-4.0",
    "processingTime": 25.4,
    "cost": 0.05,
    "consistencyScore": 0.85
  }
}
```

### 2. 배치 생성 (12개 숏트 일괄 생성)

**`POST /api/storyboard/batch`**

여러 프레임을 순차적으로 생성합니다.

```typescript
// 배치 생성 시작
const batchResponse = await fetch('/api/storyboard/batch', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    storyboardId: '123e4567-e89b-12d3-a456-426614174000',
    frames: [
      {
        sceneId: 'scene-1-uuid',
        sceneDescription: 'Opening scene: sunrise over the city',
        priority: 'high'
      },
      {
        sceneId: 'scene-2-uuid',
        sceneDescription: 'Character introduction in the coffee shop',
        additionalPrompt: 'warm interior lighting'
      }
      // ... 최대 12개 프레임
    ],
    batchSettings: {
      maxConcurrent: 1,
      delayBetweenRequests: 12000,
      stopOnError: false,
      useConsistencyChain: true
    },
    consistencyBaseImage: 'https://example.com/reference-style.png'
  })
});

// 즉시 응답 (배치 시작됨)
{
  "success": true,
  "data": {
    "batchId": "batch-uuid",
    "storyboardId": "storyboard-uuid",
    "status": "initiated",
    "progress": {
      "totalFrames": 12,
      "completedFrames": 0,
      "progress": 0,
      "estimatedTimeRemaining": 360
    }
  }
}
```

**`GET /api/storyboard/batch?batchId=batch-uuid`**

배치 진행 상태를 조회합니다.

```typescript
// 진행 상태 조회
const progressResponse = await fetch('/api/storyboard/batch?batchId=batch-uuid', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

// 진행 중 응답
{
  "success": true,
  "data": {
    "batchId": "batch-uuid",
    "status": "in_progress",
    "progress": {
      "totalFrames": 12,
      "completedFrames": 5,
      "failedFrames": 1,
      "progress": 0.5,
      "currentFrame": {
        "frameId": "current-frame-uuid",
        "status": "generating",
        "currentStep": "프레임 6/12 생성 중"
      },
      "estimatedTimeRemaining": 210
    },
    "results": [
      // 완성된 프레임들의 결과
    ],
    "totalCost": 0.25
  }
}
```

### 3. 일관성 분석

**`POST /api/storyboard/consistency`**

이미지의 스타일과 특성을 분석하여 일관성 참조 데이터를 생성합니다.

```typescript
const analysisResponse = await fetch('/api/storyboard/consistency', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    imageUrl: 'https://example.com/reference-image.png',
    analysisType: 'full', // 'character' | 'location' | 'style' | 'full'
    extractFeatures: true
  })
});

// 응답
{
  "success": true,
  "data": {
    "imageUrl": "https://example.com/reference-image.png",
    "analysisType": "full",
    "features": {
      "dominantColors": ["#2C3E50", "#E74C3C", "#3498DB"],
      "styleAttributes": ["cinematic", "high-contrast", "professional-lighting"],
      "compositionElements": ["rule-of-thirds", "depth-of-field", "dynamic-angle"],
      "characterFeatures": ["consistent-face", "clothing-style", "pose-variation"],
      "locationFeatures": ["architectural-style", "lighting-mood", "environmental-details"]
    },
    "consistencyMetadata": {
      "promptSuggestions": [
        "in the style of cinematic",
        "with #2C3E50 color palette",
        "featuring rule-of-thirds composition"
      ],
      "styleModifiers": ["professional", "2C3E50-toned", "well-composed"],
      "technicalSpecs": ["16:9 aspect ratio", "HD quality", "professional lighting"]
    },
    "confidenceScore": 0.89,
    "analyzedAt": "2024-01-15T10:30:00Z"
  }
}
```

### 4. 스토리보드 CRUD

**`GET /api/storyboard`**

스토리보드 목록을 조회합니다.

```typescript
const listResponse = await fetch('/api/storyboard?limit=20&status=in_progress', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});
```

**`POST /api/storyboard`**

새 스토리보드를 생성합니다.

```typescript
const createResponse = await fetch('/api/storyboard', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    scenarioId: 'scenario-uuid',
    title: 'My Storyboard',
    description: 'Cinematic storyboard for the opening sequence',
    config: {
      model: 'seedream-4.0',
      aspectRatio: '16:9',
      quality: 'hd',
      style: 'cinematic'
    },
    autoGenerate: false
  })
});
```

**`GET /api/storyboard/[id]`**

개별 스토리보드를 조회합니다.

**`PUT /api/storyboard/[id]`**

스토리보드를 수정합니다.

**`DELETE /api/storyboard/[id]`**

스토리보드를 삭제합니다 (소프트 삭제).

## 비용 안전 규칙

### 개별 생성 제한
- 시나리오 설명: 최대 1,000자
- 추가 프롬프트: 최대 500자
- 일관성 참조: 최대 5개
- 최소 호출 간격: 12초

### 배치 생성 제한
- 최대 프레임 수: 12개
- 최대 동시 처리: 3개
- 최소 요청 간격: 5초
- 시간당 최대 호출: 720회

### 비용 추정
- 프레임당 예상 비용: $0.05
- 12프레임 배치: 약 $0.60
- 시간당 최대 비용: 약 $36 (안전 범위 내)

## 에러 처리

```typescript
// 에러 응답 예시
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "API 호출 제한을 초과했습니다.",
    "details": {
      "remainingTime": 45,
      "maxCalls": 30
    }
  },
  "metadata": {
    "requestId": "req-uuid",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 주요 에러 코드
- `RATE_LIMIT_ERROR`: 호출 제한 초과
- `VALIDATION_ERROR`: 요청 데이터 검증 실패
- `AUTH_ERROR`: 인증 오류
- `STORYBOARD_NOT_FOUND`: 스토리보드를 찾을 수 없음
- `GENERATION_FAILED`: 이미지 생성 실패

## 사용 예시 워크플로우

### 1. 기본 워크플로우
```typescript
// 1. 스토리보드 생성
const storyboard = await createStoryboard(scenarioId, config);

// 2. 첫 번째 프레임 생성 (참조 이미지용)
const firstFrame = await generateFrame(storyboard.id, scenes[0]);

// 3. 일관성 분석
const consistency = await analyzeConsistency(firstFrame.imageUrl);

// 4. 나머지 프레임들을 배치로 생성
const batch = await startBatchGeneration(storyboard.id, remainingScenes, {
  consistencyBaseImage: firstFrame.imageUrl
});

// 5. 진행 상태 모니터링
const monitor = setInterval(async () => {
  const progress = await getBatchProgress(batch.batchId);
  if (progress.status === 'completed') {
    clearInterval(monitor);
    console.log('배치 생성 완료!');
  }
}, 5000);
```

### 2. 오류 복구 워크플로우
```typescript
// 실패한 프레임들만 재생성
const failedFrames = storyboard.frames.filter(f => f.status === 'failed');
for (const frame of failedFrames) {
  try {
    await generateFrame(storyboard.id, frame, { forceRegenerate: true });
  } catch (error) {
    console.error(`프레임 ${frame.id} 재생성 실패:`, error);
  }
}
```

## 성능 최적화 팁

1. **일관성 참조 활용**: 첫 번째 이미지를 참조로 사용하여 스타일 통일성 향상
2. **배치 처리 활용**: 개별 호출보다 배치 처리가 더 효율적
3. **적절한 지연 시간**: 서버 부하를 고려하여 충분한 간격 유지
4. **진행 상태 모니터링**: 실시간 업데이트로 사용자 경험 향상

## 문제 해결

### 자주 발생하는 문제들

1. **Rate Limit 에러**
   - 원인: 너무 빠른 연속 호출
   - 해결: 최소 12초 간격 유지

2. **이미지 생성 실패**
   - 원인: 부적절한 프롬프트 또는 서버 오류
   - 해결: 프롬프트 재검토 또는 재시도

3. **일관성 부족**
   - 원인: 참조 이미지 미사용
   - 해결: 첫 번째 이미지를 참조로 활용

4. **배치 처리 중단**
   - 원인: 네트워크 오류 또는 서버 문제
   - 해결: 진행 상태 확인 후 실패 프레임만 재생성