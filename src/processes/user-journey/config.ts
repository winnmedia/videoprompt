/**
 * UserJourney Process Configuration
 *
 * FSD processes 레이어 설정
 * CLAUDE.md 준수: 비즈니스 규칙 및 제약 조건 정의
 */

import type {
  UserJourneyStep,
  JourneyPhase,
  StepRequirement,
  NavigationGuard,
  JourneyConfig,
  ValidationRule
} from './types'

/**
 * 전체 UserJourney 단계 정의 (22단계)
 */
export const USER_JOURNEY_STEPS: UserJourneyStep[] = [
  // Phase 1: 인증 (1-2단계)
  'auth-login',
  'auth-verification',

  // Phase 2: 시나리오 (3-7단계)
  'scenario-input',
  'scenario-story-generation',
  'scenario-story-editing',
  'scenario-thumbnail-generation',
  'scenario-completion',

  // Phase 3: 기획 (8-13단계)
  'planning-initialization',
  'planning-story-breakdown',
  'planning-shot-creation',
  'planning-shot-editing',
  'planning-conti-generation',
  'planning-completion',

  // Phase 4: 영상 생성 (14-19단계)
  'video-preparation',
  'video-generation-start',
  'video-generation-progress',
  'video-generation-completion',
  'video-review',
  'video-approval',
  'video-finalization',

  // Phase 5: 피드백 (20-22단계)
  'feedback-setup',
  'feedback-collection',
  'feedback-analysis',
  'project-completion'
] as const

/**
 * Phase별 단계 그룹핑
 */
export const PHASE_MAPPING: Record<JourneyPhase, UserJourneyStep[]> = {
  auth: ['auth-login', 'auth-verification'],
  scenario: [
    'scenario-input',
    'scenario-story-generation',
    'scenario-story-editing',
    'scenario-thumbnail-generation',
    'scenario-completion'
  ],
  planning: [
    'planning-initialization',
    'planning-story-breakdown',
    'planning-shot-creation',
    'planning-shot-editing',
    'planning-conti-generation',
    'planning-completion'
  ],
  video: [
    'video-preparation',
    'video-generation-start',
    'video-generation-progress',
    'video-generation-completion',
    'video-review',
    'video-approval',
    'video-finalization'
  ],
  feedback: [
    'feedback-setup',
    'feedback-collection',
    'feedback-analysis',
    'project-completion'
  ]
}

/**
 * 각 단계별 요구사항 정의
 */
export const STEP_REQUIREMENTS: Record<UserJourneyStep, StepRequirement> = {
  // === Phase 1: 인증 ===
  'auth-login': {
    requiredData: [],
    optionalData: ['returnUrl'],
    validations: [],
    dependencies: [],
    estimatedDuration: 30000, // 30초
    canSkip: false
  },
  'auth-verification': {
    requiredData: ['auth.userId', 'auth.accessToken'],
    optionalData: ['auth.refreshToken'],
    validations: [
      {
        field: 'auth.accessToken',
        type: 'required',
        rule: (token) => typeof token === 'string' && token.length > 0,
        message: '유효한 접근 토큰이 필요합니다'
      }
    ],
    dependencies: ['auth-login'],
    estimatedDuration: 5000, // 5초
    canSkip: false
  },

  // === Phase 2: 시나리오 ===
  'scenario-input': {
    requiredData: ['auth.userId'],
    optionalData: ['project.projectId'],
    validations: [
      {
        field: 'auth.userId',
        type: 'required',
        rule: (id) => typeof id === 'string' && id.length > 0,
        message: '인증된 사용자가 필요합니다'
      }
    ],
    dependencies: ['auth-verification'],
    estimatedDuration: 180000, // 3분
    canSkip: false
  },
  'scenario-story-generation': {
    requiredData: ['scenario.title', 'scenario.description'],
    optionalData: [],
    validations: [
      {
        field: 'scenario.title',
        type: 'required',
        rule: (title) => typeof title === 'string' && title.length >= 5,
        message: '시나리오 제목은 5자 이상이어야 합니다'
      }
    ],
    dependencies: ['scenario-input'],
    estimatedDuration: 120000, // 2분
    canSkip: false
  },
  'scenario-story-editing': {
    requiredData: ['scenario.storySteps'],
    optionalData: [],
    validations: [
      {
        field: 'scenario.storySteps',
        type: 'custom',
        rule: (steps) => Array.isArray(steps) && steps.length === 4,
        message: '4단계 스토리가 필요합니다'
      }
    ],
    dependencies: ['scenario-story-generation'],
    estimatedDuration: 300000, // 5분
    canSkip: true,
    skipConditions: ['auto_generated_acceptable']
  },
  'scenario-thumbnail-generation': {
    requiredData: ['scenario.storySteps'],
    optionalData: [],
    validations: [],
    dependencies: ['scenario-story-editing'],
    estimatedDuration: 180000, // 3분
    canSkip: true,
    skipConditions: ['text_only_mode']
  },
  'scenario-completion': {
    requiredData: ['scenario.scenarioId', 'scenario.storySteps'],
    optionalData: ['scenario.thumbnails'],
    validations: [
      {
        field: 'scenario.scenarioId',
        type: 'required',
        rule: (id) => typeof id === 'string' && id.length > 0,
        message: '시나리오 ID가 필요합니다'
      }
    ],
    dependencies: ['scenario-thumbnail-generation'],
    estimatedDuration: 10000, // 10초
    canSkip: false
  },

  // === Phase 3: 기획 ===
  'planning-initialization': {
    requiredData: ['scenario.scenarioId', 'scenario.storySteps'],
    optionalData: ['project.projectId'],
    validations: [],
    dependencies: ['scenario-completion'],
    estimatedDuration: 60000, // 1분
    canSkip: false
  },
  'planning-story-breakdown': {
    requiredData: ['planning.planningProjectId'],
    optionalData: [],
    validations: [],
    dependencies: ['planning-initialization'],
    estimatedDuration: 120000, // 2분
    canSkip: false
  },
  'planning-shot-creation': {
    requiredData: ['planning.storyBreakdown'],
    optionalData: [],
    validations: [
      {
        field: 'planning.shotSequences',
        type: 'custom',
        rule: (shots) => Array.isArray(shots) && shots.length >= 8 && shots.length <= 16,
        message: '8-16개의 숏 시퀀스가 필요합니다'
      }
    ],
    dependencies: ['planning-story-breakdown'],
    estimatedDuration: 240000, // 4분
    canSkip: false
  },
  'planning-shot-editing': {
    requiredData: ['planning.shotSequences'],
    optionalData: [],
    validations: [],
    dependencies: ['planning-shot-creation'],
    estimatedDuration: 420000, // 7분
    canSkip: true,
    skipConditions: ['auto_generated_acceptable', 'time_pressure']
  },
  'planning-conti-generation': {
    requiredData: ['planning.shotSequences'],
    optionalData: [],
    validations: [],
    dependencies: ['planning-shot-editing'],
    estimatedDuration: 300000, // 5분
    canSkip: true,
    skipConditions: ['text_only_mode', 'rapid_prototyping']
  },
  'planning-completion': {
    requiredData: ['planning.planningProjectId', 'planning.shotSequences'],
    optionalData: ['planning.totalDuration'],
    validations: [
      {
        field: 'planning.shotSequences',
        type: 'custom',
        rule: (shots) => Array.isArray(shots) && shots.length > 0,
        message: '최소 1개의 숏 시퀀스가 필요합니다'
      }
    ],
    dependencies: ['planning-conti-generation'],
    estimatedDuration: 30000, // 30초
    canSkip: false
  },

  // === Phase 4: 영상 생성 ===
  'video-preparation': {
    requiredData: ['planning.shotSequences'],
    optionalData: ['planning.totalDuration'],
    validations: [],
    dependencies: ['planning-completion'],
    estimatedDuration: 60000, // 1분
    canSkip: false
  },
  'video-generation-start': {
    requiredData: ['video.generationParams'],
    optionalData: [],
    validations: [],
    dependencies: ['video-preparation'],
    estimatedDuration: 30000, // 30초
    canSkip: false
  },
  'video-generation-progress': {
    requiredData: ['video.jobIds'],
    optionalData: [],
    validations: [],
    dependencies: ['video-generation-start'],
    estimatedDuration: 600000, // 10분 (가변적)
    canSkip: false
  },
  'video-generation-completion': {
    requiredData: ['video.videoGenerations'],
    optionalData: [],
    validations: [
      {
        field: 'video.videoGenerations',
        type: 'custom',
        rule: (videos) => Array.isArray(videos) && videos.length > 0,
        message: '최소 1개의 생성된 영상이 필요합니다'
      }
    ],
    dependencies: ['video-generation-progress'],
    estimatedDuration: 30000, // 30초
    canSkip: false
  },
  'video-review': {
    requiredData: ['video.completedVideos'],
    optionalData: [],
    validations: [],
    dependencies: ['video-generation-completion'],
    estimatedDuration: 300000, // 5분
    canSkip: true,
    skipConditions: ['auto_approval', 'batch_processing']
  },
  'video-approval': {
    requiredData: ['video.completedVideos'],
    optionalData: ['video.reviewComments'],
    validations: [],
    dependencies: ['video-review'],
    estimatedDuration: 120000, // 2분
    canSkip: true,
    skipConditions: ['auto_approval']
  },
  'video-finalization': {
    requiredData: ['video.approvedVideos'],
    optionalData: [],
    validations: [
      {
        field: 'video.approvedVideos',
        type: 'custom',
        rule: (videos) => Array.isArray(videos) && videos.length > 0,
        message: '최소 1개의 승인된 영상이 필요합니다'
      }
    ],
    dependencies: ['video-approval'],
    estimatedDuration: 60000, // 1분
    canSkip: false
  },

  // === Phase 5: 피드백 ===
  'feedback-setup': {
    requiredData: ['video.approvedVideos'],
    optionalData: [],
    validations: [],
    dependencies: ['video-finalization'],
    estimatedDuration: 120000, // 2분
    canSkip: true,
    skipConditions: ['no_feedback_required', 'internal_project']
  },
  'feedback-collection': {
    requiredData: ['feedback.feedbackSessionId'],
    optionalData: [],
    validations: [],
    dependencies: ['feedback-setup'],
    estimatedDuration: 1800000, // 30분 (가변적)
    canSkip: true,
    skipConditions: ['no_feedback_required']
  },
  'feedback-analysis': {
    requiredData: ['feedback.totalFeedback'],
    optionalData: [],
    validations: [],
    dependencies: ['feedback-collection'],
    estimatedDuration: 180000, // 3분
    canSkip: true,
    skipConditions: ['no_feedback_required', 'manual_analysis']
  },
  'project-completion': {
    requiredData: ['project.projectId'],
    optionalData: ['feedback.analysisResults'],
    validations: [
      {
        field: 'project.projectId',
        type: 'required',
        rule: (id) => typeof id === 'string' && id.length > 0,
        message: '프로젝트 ID가 필요합니다'
      }
    ],
    dependencies: ['feedback-analysis'],
    estimatedDuration: 60000, // 1분
    canSkip: false
  }
}

/**
 * 네비게이션 규칙 및 가드
 */
export const NAVIGATION_RULES: NavigationGuard[] = [
  // 인증 완료 전에는 다른 단계로 이동 불가
  {
    from: 'auth-login',
    to: 'scenario-input',
    condition: (state) => Boolean(state.persistedData.auth.userId),
    errorMessage: '로그인을 완료해야 합니다',
    redirectTo: 'auth-login'
  },

  // 시나리오 없이 기획 단계로 이동 불가
  {
    from: 'scenario-completion',
    to: 'planning-initialization',
    condition: (state) => Boolean(state.persistedData.scenario.scenarioId),
    errorMessage: '시나리오를 완료해야 합니다',
    redirectTo: 'scenario-input'
  },

  // 기획 없이 영상 생성 단계로 이동 불가
  {
    from: 'planning-completion',
    to: 'video-preparation',
    condition: (state) => Boolean(state.persistedData.planning.planningProjectId),
    errorMessage: '기획을 완료해야 합니다',
    redirectTo: 'planning-initialization'
  },

  // 영상 없이 피드백 단계로 이동 불가
  {
    from: 'video-finalization',
    to: 'feedback-setup',
    condition: (state) => Boolean(state.persistedData.video.approvedVideos?.length),
    errorMessage: '영상 생성을 완료해야 합니다',
    redirectTo: 'video-preparation'
  },

  // 역방향 네비게이션 제한 (데이터 손실 방지)
  {
    from: 'video-generation-progress',
    to: 'planning-completion',
    condition: () => false,
    errorMessage: '영상 생성 중에는 이전 단계로 돌아갈 수 없습니다',
    allowSkip: false
  },

  // 프로젝트 완료 후 수정 제한
  {
    from: 'project-completion',
    to: 'feedback-analysis',
    condition: (state) => state.persistedData.project.status !== 'completed',
    errorMessage: '완료된 프로젝트는 수정할 수 없습니다',
    allowSkip: false
  }
]

/**
 * 기본 여정 설정
 */
export const DEFAULT_JOURNEY_CONFIG: JourneyConfig = {
  autoSave: {
    enabled: true,
    interval: 30000, // 30초마다 자동 저장
    maxVersions: 10
  },

  session: {
    timeout: 7200000, // 2시간
    keepAlive: true,
    persistBetweenSessions: true
  },

  recovery: {
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    autoRecovery: true
  },

  analytics: {
    enabled: true,
    realTime: true,
    bufferSize: 100
  },

  performance: {
    maxStepDuration: {
      'auth-login': 60000,
      'auth-verification': 10000,
      'scenario-input': 300000,
      'scenario-story-generation': 180000,
      'scenario-story-editing': 600000,
      'scenario-thumbnail-generation': 300000,
      'scenario-completion': 30000,
      'planning-initialization': 120000,
      'planning-story-breakdown': 180000,
      'planning-shot-creation': 360000,
      'planning-shot-editing': 600000,
      'planning-conti-generation': 480000,
      'planning-completion': 60000,
      'video-preparation': 120000,
      'video-generation-start': 60000,
      'video-generation-progress': 1800000, // 30분
      'video-generation-completion': 60000,
      'video-review': 600000,
      'video-approval': 180000,
      'video-finalization': 120000,
      'feedback-setup': 180000,
      'feedback-collection': 3600000, // 1시간
      'feedback-analysis': 300000,
      'project-completion': 120000
    },

    maxApiCalls: {
      'auth': 10,
      'scenario': 50,
      'planning': 100,
      'video': 200,
      'feedback': 300
    },

    errorThresholds: {
      'auth-login': 0.05, // 5%
      'auth-verification': 0.02, // 2%
      'scenario-input': 0.1, // 10%
      'scenario-story-generation': 0.15, // 15%
      'scenario-story-editing': 0.1,
      'scenario-thumbnail-generation': 0.2, // 20%
      'scenario-completion': 0.05,
      'planning-initialization': 0.1,
      'planning-story-breakdown': 0.15,
      'planning-shot-creation': 0.2,
      'planning-shot-editing': 0.15,
      'planning-conti-generation': 0.25, // 25%
      'planning-completion': 0.05,
      'video-preparation': 0.1,
      'video-generation-start': 0.1,
      'video-generation-progress': 0.3, // 30%
      'video-generation-completion': 0.1,
      'video-review': 0.05,
      'video-approval': 0.05,
      'video-finalization': 0.05,
      'feedback-setup': 0.1,
      'feedback-collection': 0.05,
      'feedback-analysis': 0.1,
      'project-completion': 0.02
    }
  }
}

/**
 * 단계별 예상 완료 시간 (총합)
 */
export const ESTIMATED_TOTAL_DURATION = Object.values(STEP_REQUIREMENTS)
  .reduce((total, req) => total + req.estimatedDuration, 0)

/**
 * Phase별 예상 완료 시간
 */
export const PHASE_DURATIONS: Record<JourneyPhase, number> = {
  auth: PHASE_MAPPING.auth.reduce((sum, step) => sum + STEP_REQUIREMENTS[step].estimatedDuration, 0),
  scenario: PHASE_MAPPING.scenario.reduce((sum, step) => sum + STEP_REQUIREMENTS[step].estimatedDuration, 0),
  planning: PHASE_MAPPING.planning.reduce((sum, step) => sum + STEP_REQUIREMENTS[step].estimatedDuration, 0),
  video: PHASE_MAPPING.video.reduce((sum, step) => sum + STEP_REQUIREMENTS[step].estimatedDuration, 0),
  feedback: PHASE_MAPPING.feedback.reduce((sum, step) => sum + STEP_REQUIREMENTS[step].estimatedDuration, 0)
}

/**
 * 건너뛸 수 있는 단계들
 */
export const SKIPPABLE_STEPS = Object.entries(STEP_REQUIREMENTS)
  .filter(([_, req]) => req.canSkip)
  .map(([step, _]) => step as UserJourneyStep)

/**
 * 필수 단계들 (건너뛸 수 없음)
 */
export const REQUIRED_STEPS = Object.entries(STEP_REQUIREMENTS)
  .filter(([_, req]) => !req.canSkip)
  .map(([step, _]) => step as UserJourneyStep)

/**
 * 단계별 권장 스킵 조건
 */
export const SKIP_CONDITIONS: Record<string, string> = {
  auto_generated_acceptable: 'AI 생성 결과가 만족스러운 경우',
  time_pressure: '시간이 부족한 경우',
  text_only_mode: '텍스트만 사용하는 모드',
  rapid_prototyping: '빠른 프로토타이핑 모드',
  auto_approval: '자동 승인 설정된 경우',
  batch_processing: '일괄 처리 모드',
  no_feedback_required: '피드백이 필요 없는 경우',
  internal_project: '내부 프로젝트인 경우',
  manual_analysis: '수동 분석을 선호하는 경우'
}