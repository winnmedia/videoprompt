/**
 * Planning Entity Model
 *
 * 영상 기획 위저드의 비즈니스 로직 및 검증
 * CLAUDE.md 준수: 도메인 순수성, 외부 의존성 없음
 */

import type {
  PlanningProject,
  PlanningInputData,
  StoryStep,
  ShotSequence,
  WizardStep,
  WizardProgress,
  PlanningValidationResult,
  PlanningError,
  SessionRestoreData,
  PLANNING_BUSINESS_RULES,
} from './types'

/**
 * 입력 데이터 검증
 */
export function validatePlanningInput(input: PlanningInputData): PlanningValidationResult {
  const errors: PlanningError[] = []
  const warnings: string[] = []

  // 필수 필드 검증
  if (!input.title.trim()) {
    errors.push({
      code: 'TITLE_REQUIRED',
      message: '제목을 입력해주세요',
      step: 'input',
    })
  }

  if (input.title.length > PLANNING_BUSINESS_RULES.MAX_TITLE_LENGTH) {
    errors.push({
      code: 'TITLE_TOO_LONG',
      message: `제목은 ${PLANNING_BUSINESS_RULES.MAX_TITLE_LENGTH}자를 초과할 수 없습니다`,
      step: 'input',
    })
  }

  if (!input.logline.trim()) {
    errors.push({
      code: 'LOGLINE_REQUIRED',
      message: '로그라인을 입력해주세요',
      step: 'input',
    })
  }

  if (input.logline.length > PLANNING_BUSINESS_RULES.MAX_LOGLINE_LENGTH) {
    errors.push({
      code: 'LOGLINE_TOO_LONG',
      message: `로그라인은 ${PLANNING_BUSINESS_RULES.MAX_LOGLINE_LENGTH}자를 초과할 수 없습니다`,
      step: 'input',
    })
  }

  // 목표 시간 검증
  if (input.targetDuration && input.targetDuration <= 0) {
    errors.push({
      code: 'INVALID_DURATION',
      message: '목표 시간은 양수여야 합니다',
      step: 'input',
    })
  }

  if (input.targetDuration && input.targetDuration > 600) {
    warnings.push('10분을 초과하는 영상은 제작 복잡도가 높을 수 있습니다')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * 스토리 스텝 검증
 */
export function validateStorySteps(steps: StoryStep[]): PlanningValidationResult {
  const errors: PlanningError[] = []
  const warnings: string[] = []

  // 스텝 개수 검증
  if (steps.length !== PLANNING_BUSINESS_RULES.MAX_STORY_STEPS) {
    errors.push({
      code: 'INVALID_STORY_STEPS_COUNT',
      message: `스토리는 정확히 ${PLANNING_BUSINESS_RULES.MAX_STORY_STEPS}단계여야 합니다`,
      step: 'story',
    })
  }

  // 각 스텝 검증
  steps.forEach((step, index) => {
    if (!step.title.trim()) {
      errors.push({
        code: 'STORY_STEP_TITLE_REQUIRED',
        message: `${index + 1}단계 제목을 입력해주세요`,
        step: 'story',
      })
    }

    if (!step.description.trim()) {
      errors.push({
        code: 'STORY_STEP_DESCRIPTION_REQUIRED',
        message: `${index + 1}단계 설명을 입력해주세요`,
        step: 'story',
      })
    }

    if (step.order !== index + 1) {
      errors.push({
        code: 'STORY_STEP_ORDER_MISMATCH',
        message: `${index + 1}단계 순서가 올바르지 않습니다`,
        step: 'story',
      })
    }

    if (step.duration && step.duration <= 0) {
      errors.push({
        code: 'INVALID_STORY_STEP_DURATION',
        message: `${index + 1}단계 시간은 양수여야 합니다`,
        step: 'story',
      })
    }
  })

  // 전체 시간 분포 체크
  const totalDuration = steps.reduce((sum, step) => sum + (step.duration || 0), 0)
  if (totalDuration > 0) {
    const durations = steps.map(step => step.duration || 0)
    const maxDuration = Math.max(...durations)
    const minDuration = Math.min(...durations.filter(d => d > 0))

    if (maxDuration > minDuration * 3) {
      warnings.push('스텝별 시간 분배가 불균등합니다. 균형잡힌 구성을 고려해보세요')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * 숏 시퀀스 검증
 */
export function validateShotSequences(
  sequences: ShotSequence[],
  storySteps: StoryStep[]
): PlanningValidationResult {
  const errors: PlanningError[] = []
  const warnings: string[] = []

  // 숏 개수 검증
  if (sequences.length < PLANNING_BUSINESS_RULES.MIN_SHOT_SEQUENCES) {
    errors.push({
      code: 'INSUFFICIENT_SHOTS',
      message: `최소 ${PLANNING_BUSINESS_RULES.MIN_SHOT_SEQUENCES}개의 숏이 필요합니다`,
      step: 'shots',
    })
  }

  if (sequences.length > PLANNING_BUSINESS_RULES.MAX_SHOT_SEQUENCES) {
    errors.push({
      code: 'TOO_MANY_SHOTS',
      message: `최대 ${PLANNING_BUSINESS_RULES.MAX_SHOT_SEQUENCES}개의 숏만 허용됩니다`,
      step: 'shots',
    })
  }

  // 각 숏 검증
  sequences.forEach((shot, index) => {
    if (!shot.title.trim()) {
      errors.push({
        code: 'SHOT_TITLE_REQUIRED',
        message: `${index + 1}번 숏의 제목을 입력해주세요`,
        step: 'shots',
      })
    }

    if (!shot.description.trim()) {
      errors.push({
        code: 'SHOT_DESCRIPTION_REQUIRED',
        message: `${index + 1}번 숏의 설명을 입력해주세요`,
        step: 'shots',
      })
    }

    if (!shot.contiDescription.trim()) {
      errors.push({
        code: 'SHOT_CONTI_DESCRIPTION_REQUIRED',
        message: `${index + 1}번 숏의 콘티 설명을 입력해주세요`,
        step: 'shots',
      })
    }

    if (shot.duration < PLANNING_BUSINESS_RULES.MIN_SHOT_DURATION) {
      errors.push({
        code: 'SHOT_DURATION_TOO_SHORT',
        message: `${index + 1}번 숏은 최소 ${PLANNING_BUSINESS_RULES.MIN_SHOT_DURATION}초 이상이어야 합니다`,
        step: 'shots',
      })
    }

    if (shot.duration > PLANNING_BUSINESS_RULES.MAX_SHOT_DURATION) {
      errors.push({
        code: 'SHOT_DURATION_TOO_LONG',
        message: `${index + 1}번 숏은 최대 ${PLANNING_BUSINESS_RULES.MAX_SHOT_DURATION}초를 초과할 수 없습니다`,
        step: 'shots',
      })
    }

    if (shot.order !== index + 1) {
      errors.push({
        code: 'SHOT_ORDER_MISMATCH',
        message: `${index + 1}번 숏의 순서가 올바르지 않습니다`,
        step: 'shots',
      })
    }

    // 스토리 스텝 연결 검증
    const linkedStep = storySteps.find(step => step.id === shot.storyStepId)
    if (!linkedStep) {
      errors.push({
        code: 'SHOT_STORY_STEP_NOT_FOUND',
        message: `${index + 1}번 숏이 연결된 스토리 스텝을 찾을 수 없습니다`,
        step: 'shots',
      })
    }
  })

  // 스토리 스텝별 숏 분배 체크
  const storyStepCounts = new Map<string, number>()
  sequences.forEach(shot => {
    const count = storyStepCounts.get(shot.storyStepId) || 0
    storyStepCounts.set(shot.storyStepId, count + 1)
  })

  storySteps.forEach(step => {
    const shotCount = storyStepCounts.get(step.id) || 0
    if (shotCount === 0) {
      warnings.push(`"${step.title}" 스텝에 할당된 숏이 없습니다`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * 위저드 진행 상태 계산
 */
export function calculateWizardProgress(project: PlanningProject): WizardProgress {
  const { inputData, storySteps, shotSequences } = project

  // 입력 완료율 계산
  let inputCompletion = 0
  if (inputData.title.trim()) inputCompletion += 25
  if (inputData.logline.trim()) inputCompletion += 25
  if (inputData.toneAndManner) inputCompletion += 25
  if (inputData.development) inputCompletion += 25

  // 스토리 완료율 계산
  let storyCompletion = 0
  if (storySteps.length === PLANNING_BUSINESS_RULES.MAX_STORY_STEPS) {
    const completedSteps = storySteps.filter(
      step => step.title.trim() && step.description.trim()
    ).length
    storyCompletion = (completedSteps / PLANNING_BUSINESS_RULES.MAX_STORY_STEPS) * 100
  }

  // 숏 완료율 계산
  let shotsCompletion = 0
  if (shotSequences.length >= PLANNING_BUSINESS_RULES.MIN_SHOT_SEQUENCES) {
    const completedShots = shotSequences.filter(
      shot => shot.title.trim() && shot.description.trim() && shot.contiDescription.trim()
    ).length
    shotsCompletion = (completedShots / shotSequences.length) * 100
  }

  // 완료된 단계 결정
  const completedSteps: WizardStep[] = []
  if (inputCompletion === 100) completedSteps.push('input')
  if (storyCompletion === 100) completedSteps.push('story')
  if (shotsCompletion === 100) completedSteps.push('shots')

  // 현재 단계 결정
  let currentStep: WizardStep = 'input'
  if (inputCompletion === 100 && storyCompletion < 100) currentStep = 'story'
  if (storyCompletion === 100 && shotsCompletion < 100) currentStep = 'shots'
  if (shotsCompletion === 100) currentStep = 'shots'

  return {
    currentStep: project.currentStep || currentStep,
    completedSteps,
    isGenerating: project.metadata.status === 'generating',
    lastSavedAt: project.metadata.updatedAt,
    inputCompletion,
    storyCompletion,
    shotsCompletion,
  }
}

/**
 * 전체 프로젝트 완료율 계산
 */
export function calculateCompletionPercentage(project: PlanningProject): number {
  const progress = calculateWizardProgress(project)
  return Math.round(
    (progress.inputCompletion + progress.storyCompletion + progress.shotsCompletion) / 3
  )
}

/**
 * 총 예상 시간 계산
 */
export function calculateTotalDuration(project: PlanningProject): number {
  const { storySteps, shotSequences } = project

  // 스토리 스텝에서 계산
  const storyDuration = storySteps.reduce((sum, step) => sum + (step.duration || 0), 0)

  // 숏 시퀀스에서 계산 (더 정확함)
  const shotDuration = shotSequences.reduce((sum, shot) => sum + shot.duration, 0)

  // 숏 데이터가 있으면 숏 기준, 없으면 스토리 기준
  return shotDuration > 0 ? shotDuration : storyDuration
}

/**
 * 세션 복원 가능 여부 확인
 */
export function canRestoreSession(restoreData: SessionRestoreData): boolean {
  const now = new Date()
  const timeout = PLANNING_BUSINESS_RULES.SESSION_RESTORE_TIMEOUT
  const elapsed = now.getTime() - restoreData.lastActivity.getTime()

  return elapsed < timeout
}

/**
 * 스토리 스텝 순서 재정렬
 */
export function reorderStorySteps(steps: StoryStep[]): StoryStep[] {
  return steps
    .sort((a, b) => a.order - b.order)
    .map((step, index) => ({
      ...step,
      order: index + 1,
    }))
}

/**
 * 숏 시퀀스 순서 재정렬
 */
export function reorderShotSequences(sequences: ShotSequence[]): ShotSequence[] {
  return sequences
    .sort((a, b) => a.order - b.order)
    .map((shot, index) => ({
      ...shot,
      order: index + 1,
    }))
}

/**
 * 기본 스토리 스텝 생성
 */
export function createDefaultStorySteps(): Omit<StoryStep, 'id'>[] {
  return [
    {
      order: 1,
      title: '도입부',
      description: '시청자의 관심을 끌고 주제를 소개합니다',
      duration: 30,
      keyPoints: ['문제 제기', '호기심 유발'],
    },
    {
      order: 2,
      title: '전개부',
      description: '핵심 내용을 설명하고 근거를 제시합니다',
      duration: 60,
      keyPoints: ['핵심 설명', '구체적 사례'],
    },
    {
      order: 3,
      title: '심화부',
      description: '세부 내용을 다루고 실용적 정보를 제공합니다',
      duration: 45,
      keyPoints: ['세부 정보', '실용 팁'],
    },
    {
      order: 4,
      title: '마무리',
      description: '핵심 내용을 정리하고 행동을 유도합니다',
      duration: 25,
      keyPoints: ['요약 정리', '행동 유도'],
    },
  ]
}

/**
 * 기본 숏 시퀀스 생성
 */
export function createDefaultShotSequences(storySteps: StoryStep[]): Omit<ShotSequence, 'id'>[] {
  const shotsPerStep = Math.floor(PLANNING_BUSINESS_RULES.DEFAULT_SHOT_COUNT / storySteps.length)
  const shots: Omit<ShotSequence, 'id'>[] = []

  storySteps.forEach((step, stepIndex) => {
    const stepShotCount = stepIndex === storySteps.length - 1
      ? PLANNING_BUSINESS_RULES.DEFAULT_SHOT_COUNT - shots.length // 마지막 스텝에서 나머지 할당
      : shotsPerStep

    const stepDuration = step.duration || 30
    const shotDuration = Math.round(stepDuration / stepShotCount)

    for (let i = 0; i < stepShotCount; i++) {
      shots.push({
        order: shots.length + 1,
        title: `${step.title} - 숏 ${i + 1}`,
        description: `${step.title}의 ${i + 1}번째 숏`,
        duration: shotDuration,
        contiDescription: '이 숏의 구성과 연출을 설명해주세요',
        contiStyle: 'rough',
        storyStepId: step.id,
        shotType: 'medium',
        cameraMovement: 'static',
        visualElements: [],
        transitionType: 'cut',
      })
    }
  })

  return shots
}

/**
 * 데이터 무결성 검증
 */
export function validateDataIntegrity(project: PlanningProject): PlanningValidationResult {
  const errors: PlanningError[] = []

  // 스토리 스텝 ID 중복 검사
  const stepIds = project.storySteps.map(step => step.id)
  const uniqueStepIds = new Set(stepIds)
  if (stepIds.length !== uniqueStepIds.size) {
    errors.push({
      code: 'DUPLICATE_STORY_STEP_IDS',
      message: '스토리 스텝 ID가 중복됩니다',
    })
  }

  // 숏 시퀀스 ID 중복 검사
  const shotIds = project.shotSequences.map(shot => shot.id)
  const uniqueShotIds = new Set(shotIds)
  if (shotIds.length !== uniqueShotIds.size) {
    errors.push({
      code: 'DUPLICATE_SHOT_IDS',
      message: '숏 시퀀스 ID가 중복됩니다',
    })
  }

  // 숏-스토리 연결 무결성 검사
  const validStepIds = new Set(stepIds)
  project.shotSequences.forEach(shot => {
    if (!validStepIds.has(shot.storyStepId)) {
      errors.push({
        code: 'ORPHANED_SHOT',
        message: `숏 "${shot.title}"이 존재하지 않는 스토리 스텝을 참조합니다`,
      })
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
  }
}