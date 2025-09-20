# RTK Query API 스키마 검증 및 타입 안전성 시스템 v2.0

이 문서는 VideoPlanet 프로젝트의 강화된 RTK Query API 시스템 사용법을 설명합니다.

## 🎯 주요 기능

- ✅ **Zod 기반 런타임 스키마 검증**
- ✅ **타입 안전한 DTO → Domain Model 변환**
- ✅ **성능 최적화된 캐싱 시스템**
- ✅ **자동 에러 처리 및 복구**
- ✅ **실시간 성능 모니터링**
- ✅ **포괄적인 테스트 커버리지**

## 📂 파일 구조

```
src/shared/api/
├── api-slice.ts              # RTK Query API 정의 (v2.0)
├── schema-validation.ts      # 스키마 검증 시스템
├── dto-transformers.ts       # DTO 변환 레이어 (v2.0)
├── error-handling.ts         # 타입 안전한 에러 처리
├── performance-optimizer.ts  # 성능 최적화 시스템
└── README.md                # 사용 가이드 (이 파일)

src/shared/schemas/
└── api-schemas.ts           # Zod 스키마 정의

src/__tests__/api/
├── schema-validation.test.ts    # 스키마 검증 테스트
└── performance-optimizer.test.ts # 성능 최적화 테스트
```

## 🚀 빠른 시작

### 1. 기본 API 호출

```typescript
import { useGenerateStoryMutation } from '@/shared/api/api-slice';
import { StoryInputSchema } from '@/shared/schemas/api-schemas';

function StoryGenerator() {
  const [generateStory, { data, error, isLoading }] = useGenerateStoryMutation();

  const handleGenerate = async () => {
    try {
      // 입력 데이터 검증
      const validatedInput = StoryInputSchema.parse({
        title: '새로운 스토리',
        description: '흥미진진한 이야기',
        duration: 120,
        genre: 'Drama',
        target: 'General Audience',
        format: '16:9',
        toneAndManner: ['Emotional', 'Dramatic'],
      });

      // API 호출 (자동 스키마 검증 및 에러 처리)
      const result = await generateStory(validatedInput).unwrap();
      console.log('생성된 스토리:', result);

    } catch (err) {
      console.error('스토리 생성 실패:', err);
    }
  };

  return (
    <button onClick={handleGenerate} disabled={isLoading}>
      {isLoading ? '생성 중...' : '스토리 생성'}
    </button>
  );
}
```

### 2. 안전한 데이터 변환 사용

```typescript
import { transformStoryGenerationResponse } from '@/shared/api/dto-transformers';

// API 응답을 안전하게 변환
const apiResponse = await fetch('/api/ai/generate-story').then(r => r.json());
const transformedSteps = transformStoryGenerationResponse(apiResponse, 'Story Generation');

// 변환된 데이터는 타입 안전함
transformedSteps.forEach(step => {
  console.log(step.title); // TypeScript가 타입을 보장
});
```

### 3. 에러 처리

```typescript
import { useApiErrorHandler } from '@/shared/api/error-handling';

function ComponentWithErrorHandling() {
  const { handleError, getUserMessage, isRetryable } = useApiErrorHandler();

  const [generateStory] = useGenerateStoryMutation();

  const handleStoryGeneration = async () => {
    try {
      const result = await generateStory(inputData).unwrap();
      // 성공 처리
    } catch (error) {
      const processedError = handleError(error, 'generateStory');

      // 사용자 친화적 메시지 표시
      toast.error(getUserMessage(processedError));

      // 재시도 가능한 에러인지 확인
      if (isRetryable(processedError)) {
        // 재시도 로직
      }
    }
  };
}
```

## 🔧 고급 사용법

### 성능 모니터링

```typescript
import { PerformanceUtils } from '@/shared/api/performance-optimizer';

// 개발 환경에서 성능 디버깅
if (process.env.NODE_ENV === 'development') {
  PerformanceUtils.debugPerformance();

  // 성능 리포트 확인
  const report = PerformanceUtils.getPerformanceReport();
  console.log('성능 리포트:', report);
}
```

### 커스텀 스키마 검증

```typescript
import { validateSchema } from '@/shared/schemas/api-schemas';
import { z } from 'zod';

// 커스텀 스키마 정의
const CustomDataSchema = z.object({
  customField: z.string(),
  optionalField: z.number().optional(),
});

// 안전한 검증
const validationResult = validateSchema(CustomDataSchema, unknownData, 'Custom Data');

if (validationResult.success) {
  // 검증된 데이터 사용
  console.log(validationResult.data.customField);
} else {
  // 에러 처리
  console.error('검증 실패:', validationResult.error?.message);
}
```

### 캐시 관리

```typescript
import { RTKQueryUtils } from '@/shared/api/api-slice';
import { useAppDispatch } from '@/shared/store';

function CacheManagement() {
  const dispatch = useAppDispatch();

  const handleClearCache = () => {
    // 전체 캐시 리셋
    RTKQueryUtils.resetApiState(dispatch);
  };

  const handleInvalidateProject = (projectId: string) => {
    // 특정 프로젝트 관련 캐시만 무효화
    RTKQueryUtils.invalidateProjectData(dispatch, projectId);
  };

  const handleUserLogout = () => {
    // 사용자 관련 모든 캐시 무효화
    RTKQueryUtils.invalidateUserData(dispatch);
  };
}
```

## 🧪 테스트 작성

### 단위 테스트

```typescript
import { StoryInputSchema } from '@/shared/schemas/api-schemas';

describe('Story Input Validation', () => {
  it('should validate correct story input', () => {
    const validInput = {
      title: 'Test Story',
      description: 'Test description',
      duration: 60,
      genre: 'Drama',
      target: 'General',
      format: '16:9',
      toneAndManner: ['Serious'],
    };

    const result = StoryInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid input', () => {
    const invalidInput = {
      title: '', // 빈 문자열
      duration: -10, // 음수
      toneAndManner: [], // 빈 배열
    };

    const result = StoryInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });
});
```

### 통합 테스트

```typescript
import { validateEndpointResponse } from '@/shared/api/schema-validation';

describe('API Integration', () => {
  it('should handle complete story generation workflow', () => {
    const mockApiResponse = {
      success: true,
      data: {
        steps: [
          {
            id: 'step-1',
            title: '1막',
            description: '시작',
            duration: 30,
            sequence: 1,
            keyElements: ['intro'],
          },
        ],
      },
    };

    const result = validateEndpointResponse('generateStory', mockApiResponse);
    expect(result.success).toBe(true);
    expect(result.data!.data.steps).toHaveLength(1);
  });
});
```

## 📊 성능 최적화 가이드

### 1. 캐시 전략

```typescript
// 엔드포인트별 캐시 설정
const apiSlice = createApi({
  endpoints: (builder) => ({
    generateStory: builder.mutation({
      // AI 생성은 시간이 오래 걸리므로 재시도 비활성화
      extraOptions: { maxRetries: 0 },
    }),
    loadStory: builder.query({
      // 스토리 데이터는 자주 변경되지 않으므로 긴 캐시
      keepUnusedDataFor: 900, // 15분
    }),
    getSavedStories: builder.query({
      // 목록 데이터는 자주 업데이트되므로 짧은 캐시
      keepUnusedDataFor: 300, // 5분
    }),
  }),
});
```

### 2. 메모리 관리

```typescript
import { cleanupMemory, getMemoryUsage } from '@/shared/api/performance-optimizer';

// 주기적 메모리 정리
setInterval(() => {
  const memUsage = getMemoryUsage();
  if (memUsage.cacheMemory > 50 * 1024 * 1024) { // 50MB 임계치
    cleanupMemory();
  }
}, 5 * 60 * 1000); // 5분마다 확인
```

### 3. 성능 모니터링

```typescript
// 개발 환경에서만 활성화
if (process.env.NODE_ENV === 'development') {
  // 성능 메트릭 주기적 출력
  setInterval(() => {
    const report = PerformanceUtils.getPerformanceReport();
    if (report.recommendations.length > 0) {
      console.warn('성능 최적화 권장사항:', report.recommendations);
    }
  }, 30 * 1000); // 30초마다
}
```

## 🛠️ 마이그레이션 가이드

### 기존 코드에서 v2.0으로 업그레이드

1. **타입 임포트 변경**

```typescript
// Before
import { StoryInput } from '@/shared/api/api-slice';

// After
import { StoryInput } from '@/shared/schemas/api-schemas';
```

2. **에러 처리 개선**

```typescript
// Before
catch (error) {
  console.error(error);
}

// After
import { useApiErrorHandler } from '@/shared/api/error-handling';

const { handleError, getUserMessage } = useApiErrorHandler();

catch (error) {
  const processedError = handleError(error, 'endpointName');
  toast.error(getUserMessage(processedError));
}
```

3. **데이터 변환 사용**

```typescript
// Before
const steps = apiResponse.data.steps;

// After
import { transformStoryGenerationResponse } from '@/shared/api/dto-transformers';

const steps = transformStoryGenerationResponse(apiResponse, 'Story Generation');
```

## 🔍 디버깅 도구

### 개발 환경 디버깅

```typescript
// 브라우저 콘솔에서 사용 가능한 디버깅 명령어
window.__RTK_DEBUG__ = {
  cache: () => PerformanceUtils.getCacheStats(),
  performance: () => PerformanceUtils.getPerformanceReport(),
  health: () => validateSchemaHealth(),
  memory: () => getMemoryUsage(),
};
```

### 성능 프로파일링

```typescript
// 성능 이슈 추적
const profileEndpoint = (endpointName: string) => {
  const monitor = PerformanceUtils.getMonitor();
  const metrics = monitor.getEndpointMetrics(endpointName);

  console.log(`${endpointName} 성능 메트릭:`, {
    평균응답시간: `${metrics?.avgResponseTime}ms`,
    에러율: `${(metrics?.errorRate || 0) * 100}%`,
    총요청수: metrics?.totalRequests,
  });
};
```

## 📈 Best Practices

1. **항상 스키마 검증 사용**: 모든 외부 데이터는 스키마 검증을 거쳐야 합니다.

2. **에러 처리 표준화**: `useApiErrorHandler` 훅을 사용하여 일관된 에러 처리를 구현하세요.

3. **성능 모니터링**: 개발 환경에서 정기적으로 성능 리포트를 확인하세요.

4. **테스트 커버리지**: 모든 API 엔드포인트에 대한 테스트를 작성하세요.

5. **메모리 관리**: 장시간 실행되는 애플리케이션에서는 주기적 메모리 정리를 구현하세요.

## 🚨 주의사항

- **$300 사건 방지**: useEffect 의존성 배열에 함수를 넣지 마세요.
- **API 호출 제한**: 동일한 API를 1분 내에 반복 호출하지 마세요.
- **캐시 의존**: 중요한 데이터는 캐시에만 의존하지 말고 검증을 거치세요.
- **타입 안전성**: `any` 타입 사용을 피하고 스키마 검증을 활용하세요.

## 📞 지원

- 이슈 발견 시: GitHub Issues에서 버그 리포트 작성
- 성능 문제: 성능 리포트와 함께 상세 설명 제공
- 새로운 기능 요청: RFC 문서 작성 후 논의

---

**이 시스템으로 VideoPlanet의 API 데이터 품질과 타입 안전성이 크게 향상되었습니다!** 🎉