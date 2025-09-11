import { StoryInput, StoryStep } from '@/entities/scenario';
import { safeFetch, withDeduplication } from '@/shared/lib/api-retry';

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

// 구조를 스텝으로 변환하는 헬퍼 함수 - API 응답 구조 변경에 대응
function convertStructureToSteps(structure: any): StoryStep[] {
  // API가 객체 {act1, act2, act3, act4} 형태로 반환하는 경우
  if (structure && typeof structure === 'object' && !Array.isArray(structure)) {
    const acts = ['act1', 'act2', 'act3', 'act4'];
    return acts.map((actKey, index) => {
      const act = structure[actKey];
      if (!act) {
        return {
          id: `step-${index + 1}`,
          title: `단계 ${index + 1}`,
          summary: '내용이 생성되지 않았습니다.',
          content: '내용이 생성되지 않았습니다.',
          goal: '목표가 설정되지 않았습니다.',
          lengthHint: `전체의 ${Math.round(100 / 4)}%`,
          isEditing: false,
        };
      }
      
      return {
        id: `step-${index + 1}`,
        title: act.title || `단계 ${index + 1}`,
        summary: act.description ? (act.description.length > 100 
          ? act.description.substring(0, 100) + '...' 
          : act.description) : `${index + 1}단계 내용`,
        content: act.description || '내용이 생성되지 않았습니다.',
        goal: act.emotional_arc || '목표가 설정되지 않았습니다.',
        lengthHint: `전체의 ${Math.round(100 / 4)}%`,
        isEditing: false,
      };
    });
  }
  
  // 기존 배열 형태 처리 (하위 호환성)
  if (Array.isArray(structure)) {
    return structure.map((step, index) => ({
      id: `step-${index + 1}`,
      title: step.title || `단계 ${index + 1}`,
      summary: step.summary || step.description || '',
      content: step.content || step.description || '',
      goal: step.goal || step.emotional_arc || '',
      lengthHint: step.lengthHint || `전체의 ${Math.round(100 / 4)}%`,
      isEditing: false,
    }));
  }
  
  // 빈 배열 반환 (fallback)
  return [];
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

  const requestPromise = withDeduplication(cacheKey, async (): Promise<StoryStep[]> => {
    try {
    const response = await safeFetch('/api/ai/generate-story', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        story: storyInput.oneLineStory || '',
        genre: storyInput.genre || '드라마',
        tone: storyInput.toneAndManner && storyInput.toneAndManner.length > 0 
          ? storyInput.toneAndManner.join(', ')
          : '일반적',
        target: storyInput.target || '일반 시청자',
        duration: storyInput.duration || '30',
        format: storyInput.format || 'video',
        tempo: storyInput.tempo || 'moderate',
        developmentMethod: storyInput.developmentMethod || 'traditional',
        developmentIntensity: storyInput.developmentIntensity || 'moderate',
      }),
    }, {
      maxRetries: 2, // 최대 2회 재시도
      initialDelay: 2000 // 2초 대기
    });

    const data = await response.json();
    
    // 구조 검증
    if (!data || !data.structure) {
      const errorMsg = 'AI가 올바른 응답을 생성하지 못했습니다. 다시 시도해주세요.';
      onError?.(errorMsg, 'server');
      throw new Error(errorMsg);
    }
    
    const steps = convertStructureToSteps(data.structure);
    
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
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
    console.error('AI API 호출 실패:', errorMessage);
    
    // 네트워크 에러 처리
    if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      const errorMsg = '네트워크 연결을 확인해주세요. 인터넷 연결이 불안정할 수 있습니다.';
      onError?.(errorMsg, 'network');
      throw new Error(errorMsg);
    } else {
      const errorMsg = 'AI 서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
      onError?.(errorMsg, 'server');
      throw new Error(errorMsg);
    }
  } finally {
    onLoadingEnd?.();
  }
  })();

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