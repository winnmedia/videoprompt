import { StoryInput, StoryStep } from '@/entities/scenario';

interface GenerateStoryStepsParams {
  storyInput: StoryInput;
  onLoadingStart?: (message: string) => void;
  onLoadingEnd?: () => void;
  onError?: (error: string, type: 'client' | 'server' | 'network') => void;
  onSuccess?: (steps: StoryStep[], message: string) => void;
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
  onLoadingStart?.('AI가 스토리를 생성하고 있습니다...');

  try {
    const response = await fetch('/api/ai/generate-story', {
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
    });

    if (response.ok) {
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
      
      onSuccess?.(steps, '4단계 스토리가 성공적으로 생성되었습니다!');
      return steps;
    } else {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = null;
      }
      
      const status = response.status;
      
      if (status === 400) {
        const errorMsg = errorData?.message || errorData?.userMessage || 
          '필수 정보가 누락되었습니다. 모든 필드를 입력했는지 확인해주세요.';
        onError?.(errorMsg, 'client');
        throw new Error(errorMsg);
      } else if (status === 401) {
        const errorMsg = '인증이 필요합니다. 로그인 후 다시 시도해주세요.';
        onError?.(errorMsg, 'client');
        throw new Error(errorMsg);
      } else if (status === 503) {
        const errorMsg = errorData?.error || 'AI 서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
        onError?.(errorMsg, 'server');
        throw new Error(errorMsg);
      } else if (status >= 500) {
        const errorMsg = 'AI 서버에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        onError?.(errorMsg, 'server');
        throw new Error(errorMsg);
      } else {
        const errorMsg = `요청 처리 중 오류가 발생했습니다. (오류 코드: ${status})`;
        onError?.(errorMsg, 'server');
        throw new Error(errorMsg);
      }
    }
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
}