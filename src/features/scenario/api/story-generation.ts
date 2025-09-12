import { StoryInput, StoryStep } from '@/entities/scenario';
import { safeFetch, withDeduplication } from '@/shared/lib/api-retry';
import { 
  transformApiResponseToStorySteps,
  transformStoryInputToApiRequest,
  transformApiError
} from '@/shared/api/dto-transformers';

interface GenerateStoryStepsParams {
  storyInput: StoryInput;
  onLoadingStart?: (message: string) => void;
  onLoadingEnd?: () => void;
  onError?: (error: string, type: 'client' | 'server' | 'network') => void;
  onSuccess?: (steps: StoryStep[], message: string) => void;
}

// 캐시 저장소
const storyCache = new Map<string, { steps: StoryStep[], timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10분 캐싱

// 현재 진행 중인 요청들
const pendingRequests = new Map<string, Promise<StoryStep[]>>();

// 입력값을 캐시 키로 변환
function getCacheKey(storyInput: StoryInput): string {
  return JSON.stringify({
    title: storyInput.title,
    oneLineStory: storyInput.oneLineStory,
    toneAndManner: storyInput.toneAndManner.sort(), // 순서 무관하게 정렬
    genre: storyInput.genre,
    target: storyInput.target,
    duration: storyInput.duration,
    format: storyInput.format,
    tempo: storyInput.tempo,
    developmentMethod: storyInput.developmentMethod,
    developmentIntensity: storyInput.developmentIntensity
  });
}

// 레거시 함수 - DTO 변환 계층으로 대체됨
// @deprecated - transformApiResponseToStorySteps 사용 권장
function convertStructureToSteps(structure: any): StoryStep[] {
  console.warn('convertStructureToSteps는 deprecated됨. transformApiResponseToStorySteps 사용 권장');
  return transformApiResponseToStorySteps(structure, 'Legacy convertStructureToSteps');
}

export async function generateStorySteps({
  storyInput,
  onLoadingStart,
  onLoadingEnd,
  onError,
  onSuccess
}: GenerateStoryStepsParams): Promise<StoryStep[]> {
  const cacheKey = getCacheKey(storyInput);
  
  // 캐시 확인
  const cached = storyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('💾 캐시된 스토리 사용 - API 호출 절약');
    onSuccess?.(cached.steps, '캐시된 스토리를 불러왔습니다. ⚡');
    return cached.steps;
  }
  
  // 진행 중인 요청 확인 (중복 방지)
  const pendingRequest = pendingRequests.get(cacheKey);
  if (pendingRequest) {
    console.log('⏳ 동일한 요청 진행 중 - 중복 방지');
    return pendingRequest;
  }

  onLoadingStart?.('AI가 스토리를 생성하고 있습니다...');

  const requestPromise = withDeduplication(cacheKey, async () => {
    try {
    const response = await safeFetch('/api/ai/generate-story', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transformStoryInputToApiRequest(storyInput)),
    }, {
      maxRetries: 2, // 최대 2회 재시도
      initialDelay: 2000 // 2초 대기
    });

    const rawData = await response.json();
    
    // DTO 변환 계층을 통한 안전한 데이터 변환
    const steps = transformApiResponseToStorySteps(rawData, 'Story Generation API');
    
    // 최소한의 단계가 생성되었는지 확인
    if (steps.length === 0) {
      const errorMsg = 'AI가 스토리 단계를 생성하지 못했습니다. 다시 시도해주세요.';
      onError?.(errorMsg, 'server');
      throw new Error(errorMsg);
    }
    
    // 캐시에 저장
    storyCache.set(cacheKey, {
      steps,
      timestamp: Date.now()
    });
    
    onSuccess?.(steps, '4단계 스토리가 성공적으로 생성되었습니다!');
    return steps;
  } catch (error) {
    const errorMessage = transformApiError(error, 'Story Generation API');
    console.error('AI API 호출 실패:', errorMessage);
    
    // 네트워크 에러 처리
    if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      const errorMsg = '네트워크 연결을 확인해주세요. 인터넷 연결이 불안정할 수 있습니다.';
      onError?.(errorMsg, 'network');
      throw new Error(errorMsg);
    } else {
      onError?.(errorMessage, 'server');
      throw new Error(errorMessage);
    }
  } finally {
    onLoadingEnd?.();
  }
  });

  // 요청을 pendingRequests에 등록
  pendingRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } finally {
    // 완료된 요청 제거
    pendingRequests.delete(cacheKey);
  }
}