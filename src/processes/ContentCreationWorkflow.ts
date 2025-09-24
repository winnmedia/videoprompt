/**
 * Content Creation Workflow Process
 * UserJourneyMap에 정의된 전체 콘텐츠 생성 워크플로우를 관리하는 프로세스
 */

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  current: boolean;
  required: boolean;
}

export interface ContentCreationState {
  currentStep: number;
  totalSteps: number;
  steps: WorkflowStep[];
  projectId?: string;
  scenarioId?: string;
  storyId?: string;
  shotsId?: string;
  promptId?: string;
  storyboardId?: string;
  videoId?: string;
}

export interface StepTransition {
  from: number;
  to: number;
  condition?: () => boolean;
  onTransition?: () => void;
}

/**
 * 콘텐츠 생성 워크플로우 프로세스 클래스
 * UserJourneyMap의 1-22단계 전체 워크플로우를 관리
 */
export class ContentCreationWorkflow {
  private state: ContentCreationState;
  private readonly steps: WorkflowStep[] = [
    {
      id: 'auth',
      name: '인증',
      description: '로그인, 비밀번호 찾기, 회원가입',
      completed: false,
      current: false,
      required: true,
    },
    {
      id: 'landing',
      name: '랜딩페이지',
      description: '랜딩페이지 접속, 시나리오 만들기 버튼으로 진입',
      completed: false,
      current: false,
      required: true,
    },
    {
      id: 'scenario-input',
      name: '시나리오 입력',
      description: '시나리오 제목, 내용, 드롭다운 메뉴를 통한 요소 선택',
      completed: false,
      current: false,
      required: true,
    },
    {
      id: 'scenario-settings',
      name: '시나리오 설정',
      description: '시나리오 스토리 전개 방식 선택, 전개 강도 선택',
      completed: false,
      current: false,
      required: true,
    },
    {
      id: 'story-generation',
      name: '4단계 스토리 생성',
      description: 'LLM이 입력된 내용을 바탕으로 4단계 스토리 생성',
      completed: false,
      current: false,
      required: true,
    },
    {
      id: 'story-editing',
      name: '4단계 스토리 편집',
      description: '4단계 스토리 편집 및 대표 썸네일(콘티) 생성',
      completed: false,
      current: false,
      required: true,
    },
    {
      id: 'shots-generation',
      name: '12단계 숏트 생성',
      description: '4단계 스토리를 각 3개씩 총 12개 숏트로 확장',
      completed: false,
      current: false,
      required: true,
    },
    {
      id: 'shots-editing',
      name: '12단계 숏트 편집',
      description: '12단계 숏트 제목, 내용 수정 및 개별 콘티 생성',
      completed: false,
      current: false,
      required: true,
    },
    {
      id: 'storyboard-download',
      name: '기획안 다운로드',
      description: '완성된 12단계 숏트를 가로형 기획안으로 다운로드',
      completed: false,
      current: false,
      required: false,
    },
    {
      id: 'content-management',
      name: '콘텐츠 관리',
      description: '생성된 모든 스토리, 콘티를 콘텐츠 관리 탭에서 확인',
      completed: false,
      current: false,
      required: false,
    },
    {
      id: 'prompt-generation',
      name: '프롬프트 생성',
      description: '12개 숏트의 스토리와 콘티 이미지를 기반으로 프롬프트 생성',
      completed: false,
      current: false,
      required: false,
    },
    {
      id: 'video-generation',
      name: 'AI 영상 생성',
      description: '프롬프트와 콘티 이미지를 기반으로 AI 영상 생성',
      completed: false,
      current: false,
      required: false,
    },
    {
      id: 'video-feedback',
      name: '영상 피드백',
      description: 'v1, v2, v3 슬롯을 활용한 영상 업로드 및 피드백 시스템',
      completed: false,
      current: false,
      required: false,
    },
    {
      id: 'feedback-sharing',
      name: '피드백 공유',
      description: '링크를 통한 다른 사용자 피드백 참여',
      completed: false,
      current: false,
      required: false,
    },
    {
      id: 'timecode-feedback',
      name: '타임코드 피드백',
      description: '타임코드 기반 시점 피드백 댓글 작성',
      completed: false,
      current: false,
      required: false,
    },
    {
      id: 'feedback-management',
      name: '피드백 관리',
      description: '스크린샷 생성, URL 공유, 영상 교체 등 보조 기능',
      completed: false,
      current: false,
      required: false,
    },
    {
      id: 'data-management',
      name: '데이터 관리',
      description: '생성된 모든 콘텐츠를 대시보드에서 통합 관리',
      completed: false,
      current: false,
      required: false,
    },
  ];

  constructor(initialState?: Partial<ContentCreationState>) {
    this.state = {
      currentStep: 0,
      totalSteps: this.steps.length,
      steps: [...this.steps],
      ...initialState,
    };

    // 첫 번째 단계를 현재 단계로 설정
    if (this.state.steps.length > 0) {
      this.state.steps[0].current = true;
    }
  }

  /**
   * 현재 워크플로우 상태 조회
   */
  getState(): ContentCreationState {
    return { ...this.state };
  }

  /**
   * 현재 단계 조회
   */
  getCurrentStep(): WorkflowStep | null {
    return this.state.steps[this.state.currentStep] || null;
  }

  /**
   * 다음 단계로 진행
   */
  nextStep(): boolean {
    if (this.state.currentStep < this.state.totalSteps - 1) {
      // 현재 단계 완료 처리
      this.state.steps[this.state.currentStep].completed = true;
      this.state.steps[this.state.currentStep].current = false;

      // 다음 단계로 이동
      this.state.currentStep++;
      this.state.steps[this.state.currentStep].current = true;

      return true;
    }
    return false;
  }

  /**
   * 이전 단계로 돌아가기
   */
  previousStep(): boolean {
    if (this.state.currentStep > 0) {
      // 현재 단계 초기화
      this.state.steps[this.state.currentStep].current = false;
      this.state.steps[this.state.currentStep].completed = false;

      // 이전 단계로 이동
      this.state.currentStep--;
      this.state.steps[this.state.currentStep].current = true;
      this.state.steps[this.state.currentStep].completed = false;

      return true;
    }
    return false;
  }

  /**
   * 특정 단계로 점프 (완료된 단계에만 가능)
   */
  jumpToStep(stepIndex: number): boolean {
    if (stepIndex < 0 || stepIndex >= this.state.totalSteps) {
      return false;
    }

    // 필수 단계들이 완료되었는지 확인
    for (let i = 0; i < stepIndex; i++) {
      if (this.state.steps[i].required && !this.state.steps[i].completed) {
        return false;
      }
    }

    // 현재 단계 초기화
    this.state.steps[this.state.currentStep].current = false;

    // 새 단계로 이동
    this.state.currentStep = stepIndex;
    this.state.steps[stepIndex].current = true;

    return true;
  }

  /**
   * 특정 단계 완료 처리
   */
  completeStep(stepId: string): boolean {
    const step = this.state.steps.find(s => s.id === stepId);
    if (step) {
      step.completed = true;
      return true;
    }
    return false;
  }

  /**
   * 워크플로우 진행률 계산 (0-100%)
   */
  getProgress(): number {
    const completedSteps = this.state.steps.filter(step => step.completed).length;
    return Math.round((completedSteps / this.state.totalSteps) * 100);
  }

  /**
   * 다음 가능한 단계들 조회
   */
  getNextAvailableSteps(): WorkflowStep[] {
    return this.state.steps.filter((step, index) => {
      if (index <= this.state.currentStep) return false;

      // 이전 필수 단계들이 완료되었는지 확인
      for (let i = 0; i < index; i++) {
        if (this.state.steps[i].required && !this.state.steps[i].completed) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 워크플로우 재시작
   */
  reset(): void {
    this.state.currentStep = 0;
    this.state.steps = this.steps.map((step, index) => ({
      ...step,
      completed: false,
      current: index === 0,
    }));
  }

  /**
   * 프로젝트 ID 연결
   */
  setProjectId(projectId: string): void {
    this.state.projectId = projectId;
  }

  /**
   * 각 단계별 결과물 ID 설정
   */
  setStepResult(stepId: string, resultId: string): void {
    switch (stepId) {
      case 'scenario-input':
      case 'scenario-settings':
        this.state.scenarioId = resultId;
        break;
      case 'story-generation':
      case 'story-editing':
        this.state.storyId = resultId;
        break;
      case 'shots-generation':
      case 'shots-editing':
        this.state.shotsId = resultId;
        break;
      case 'prompt-generation':
        this.state.promptId = resultId;
        break;
      case 'storyboard-download':
        this.state.storyboardId = resultId;
        break;
      case 'video-generation':
        this.state.videoId = resultId;
        break;
    }
  }

  /**
   * 특정 단계의 결과물 ID 조회
   */
  getStepResult(stepId: string): string | undefined {
    switch (stepId) {
      case 'scenario-input':
      case 'scenario-settings':
        return this.state.scenarioId;
      case 'story-generation':
      case 'story-editing':
        return this.state.storyId;
      case 'shots-generation':
      case 'shots-editing':
        return this.state.shotsId;
      case 'prompt-generation':
        return this.state.promptId;
      case 'storyboard-download':
        return this.state.storyboardId;
      case 'video-generation':
        return this.state.videoId;
      default:
        return undefined;
    }
  }
}