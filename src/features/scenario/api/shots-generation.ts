import { StoryInput, StoryStep, Shot, StoryboardShot } from '@/entities/scenario';
import { logger } from '@/shared/lib/logger';
import { extractSceneComponents } from '@/shared/lib';

interface GenerateShotsParams {
  storyInput: StoryInput;
  storySteps: StoryStep[];
  onLoadingStart?: (message: string) => void;
  onLoadingEnd?: () => void;
  onError?: (error: string, type: 'client' | 'server' | 'network') => void;
  onSuccess?: (shots: Shot[], message: string) => void;
}

export async function generateShots({
  storyInput,
  storySteps,
  onLoadingStart,
  onLoadingEnd,
  onError,
  onSuccess
}: GenerateShotsParams): Promise<Shot[]> {
  onLoadingStart?.('숏트를 생성하고 있습니다...');

  try {
    const components = await extractSceneComponents({
      scenario: storyInput.oneLineStory || storyInput.title || '',
      theme: storyInput.title,
      style: storyInput.toneAndManner?.[0] || 'cinematic',
      aspectRatio: storyInput.format || '16:9',
      durationSec: parseInt(storyInput.duration) || 8,
      mood: storyInput.tempo || 'normal',
      camera: 'wide',
      weather: 'clear',
    });

    const generatedShots: Shot[] = [];
    let shotId = 1;

    // 더 구체적인 description 생성 헬퍼 함수
    const generateShotDescription = (step: StoryStep, beatIndex: number, beat: any) => {
      if (beat?.action && beat.action.trim() !== '') {
        return beat.action;
      }
      
      // beat이 없거나 action이 없을 때 step.content를 활용해서 구체적인 내용 생성
      const stepContent = step.content || step.summary || '';
      const shotType = ['와이드샷으로', '클로즈업으로', '미디엄샷으로'][beatIndex % 3];
      
      if (stepContent.length > 30) {
        // step의 내용을 3등분하여 각 샷에 배분
        const contentParts = stepContent.split('.').filter((s: string) => s.trim());
        const partIndex = beatIndex % Math.max(contentParts.length, 1);
        const relevantPart = contentParts[partIndex] || contentParts[0] || stepContent;
        return `${shotType} ${relevantPart.trim()}을 보여주는 장면`;
      } else {
        return `${shotType} ${stepContent}을 시각적으로 표현하는 장면`;
      }
    };

    storySteps.forEach((step) => {
      const shotsPerStep = 3; // 각 단계당 3개 숏트
      for (let i = 0; i < shotsPerStep; i++) {
        const beat = components.timelineBeats?.[Math.min(shotId - 1, components.timelineBeats.length - 1)];
        
        const shotData = {
          id: `shot-${shotId}`,
          stepId: step.id,
          title: `${step.title} - 숏트 ${i + 1}`,
          description: generateShotDescription(step, i, beat),
          shotType: '와이드',
          camera: '정적',
          composition: '중앙 정렬',
          length: storyInput.tempo === '빠르게' ? 4 : storyInput.tempo === '느리게' ? 10 : 6,
          dialogue: '',
          subtitle: beat?.audio || '',
          transition: '컷',
          insertShots: [],
        };
        
        generatedShots.push(shotData);
        shotId++;
      }
    });

    onSuccess?.(generatedShots, `${generatedShots.length}개의 숏트가 성공적으로 생성되었습니다!`);
    return generatedShots;
  } catch (e) {
    logger.debug(e);
    const errorMessage = '숏트 생성 중 오류가 발생했습니다.';
    onError?.(errorMessage, 'server');
    throw new Error(errorMessage);
  } finally {
    onLoadingEnd?.();
  }
}