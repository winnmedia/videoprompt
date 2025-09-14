import { StoryInput, StoryStep, Shot } from './types';

/**
 * 빈 StoryInput 초기값을 생성합니다.
 * 폼 초기 상태 및 테스트에서 사용됩니다.
 */
export function createInitialStoryInput(): StoryInput {
  return {
    title: '',
    oneLineStory: '',
    toneAndManner: [],
    genre: '',
    target: '',
    duration: '',
    format: '',
    tempo: '',
    developmentMethod: '',
    developmentIntensity: '',
  };
}

/**
 * StoryInput 유효성 검증
 * 모든 필수 필드가 입력되었는지 확인합니다.
 */
export function validateStoryInput(storyInput: StoryInput): boolean {
  return (
    storyInput.title.trim() !== '' &&
    storyInput.oneLineStory.trim() !== '' &&
    storyInput.toneAndManner.length > 0 &&
    storyInput.genre.trim() !== '' &&
    storyInput.target.trim() !== '' &&
    storyInput.duration.trim() !== '' &&
    storyInput.format.trim() !== '' &&
    storyInput.tempo.trim() !== '' &&
    storyInput.developmentMethod.trim() !== '' &&
    storyInput.developmentIntensity.trim() !== ''
  );
}

/**
 * StoryStep 편집 모드 토글
 */
export function toggleStoryStepEditing(steps: StoryStep[], stepId: string): StoryStep[] {
  return steps.map(step =>
    step.id === stepId
      ? { ...step, isEditing: !step.isEditing }
      : step
  );
}

/**
 * StoryStep 필드 업데이트
 */
export function updateStoryStepField(
  steps: StoryStep[],
  stepId: string,
  field: keyof StoryStep,
  value: string
): StoryStep[] {
  return steps.map(step =>
    step.id === stepId
      ? { ...step, [field]: value }
      : step
  );
}

/**
 * Shot 필드 업데이트
 */
export function updateShotField(
  shots: Shot[],
  shotId: string,
  field: keyof Shot,
  value: any
): Shot[] {
  return shots.map(shot =>
    shot.id === shotId
      ? { ...shot, [field]: value }
      : shot
  );
}

/**
 * 워크플로우 단계 정의
 */
export const WORKFLOW_STEPS = {
  STORY_INPUT: 1,
  STORY_REVIEW: 2,
  SHOTS_GENERATION: 3,
  EXPORT: 4,
} as const;

export type WorkflowStep = typeof WORKFLOW_STEPS[keyof typeof WORKFLOW_STEPS];

/**
 * 단계별 제목 및 설명
 */
export const STEP_CONFIG = {
  [WORKFLOW_STEPS.STORY_INPUT]: {
    title: '스토리 입력',
    description: '영상 기획에 필요한 기본 정보를 입력합니다.',
  },
  [WORKFLOW_STEPS.STORY_REVIEW]: {
    title: '스토리 검토',
    description: 'AI가 생성한 4단계 스토리를 검토하고 수정합니다.',
  },
  [WORKFLOW_STEPS.SHOTS_GENERATION]: {
    title: '콘티 생성',
    description: '12개의 숏트와 콘티 이미지를 생성합니다.',
  },
  [WORKFLOW_STEPS.EXPORT]: {
    title: '내보내기',
    description: '완성된 시나리오와 콘티를 저장하고 공유합니다.',
  },
} as const;