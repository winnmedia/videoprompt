import { StoryInput, StoryStep } from '@/entities/scenario';

interface GenerateStoryStepsParams {
  storyInput: StoryInput;
  onLoadingStart?: (message: string) => void;
  onLoadingEnd?: () => void;
  onError?: (error: string, type: 'client' | 'server' | 'network') => void;
  onSuccess?: (steps: StoryStep[], message: string) => void;
}

// 구조를 스텝으로 변환하는 헬퍼 함수 (기존 convertStructureToSteps)
function convertStructureToSteps(structure: any[]): StoryStep[] {
  return structure.map((step, index) => ({
    id: `step-${index + 1}`,
    title: step.title || `단계 ${index + 1}`,
    summary: step.summary || '',
    content: step.content || step.description || '',
    goal: step.goal || '',
    lengthHint: step.lengthHint || '',
    isEditing: false,
  }));
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
        story: storyInput.oneLineStory,
        genre: storyInput.genre,
        tone: storyInput.toneAndManner.join(', '),
        target: storyInput.target,
        duration: storyInput.duration,
        format: storyInput.format,
        tempo: storyInput.tempo,
        developmentMethod: storyInput.developmentMethod,
        developmentIntensity: storyInput.developmentIntensity,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const steps = convertStructureToSteps(data.structure);
      onSuccess?.(steps, '4단계 스토리가 성공적으로 생성되었습니다!');
      return steps;
    } else {
      const status = response.status;
      if (status === 400) {
        const errorMsg = '필수 정보가 누락되었습니다. 모든 필드를 입력했는지 확인해주세요.';
        onError?.(errorMsg, 'client');
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