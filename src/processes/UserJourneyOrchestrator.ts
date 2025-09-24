/**
 * User Journey Orchestrator
 * 사용자 여정의 상태와 전환을 관리하는 오케스트레이터
 */

import { ContentCreationWorkflow, ContentCreationState, WorkflowStep } from './ContentCreationWorkflow';

export interface JourneyContext {
  userId: string;
  sessionId: string;
  projectId?: string;
  currentWorkflow: ContentCreationWorkflow;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface JourneyEvent {
  type: string;
  stepId: string;
  timestamp: Date;
  data?: any;
}

export interface NavigationRule {
  fromStep: string;
  toStep: string;
  condition?: (context: JourneyContext) => boolean;
  validator?: (context: JourneyContext) => boolean;
}

/**
 * 사용자 여정 오케스트레이터 클래스
 * 복잡한 사용자 여정의 상태와 전환을 중앙에서 관리
 */
export class UserJourneyOrchestrator {
  private context: JourneyContext;
  private events: JourneyEvent[] = [];
  private navigationRules: NavigationRule[] = [];

  constructor(userId: string, sessionId: string, projectId?: string) {
    this.context = {
      userId,
      sessionId,
      projectId,
      currentWorkflow: new ContentCreationWorkflow(),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.initializeNavigationRules();
  }

  /**
   * 네비게이션 규칙 초기화
   */
  private initializeNavigationRules(): void {
    this.navigationRules = [
      // 인증 후 랜딩페이지로
      {
        fromStep: 'auth',
        toStep: 'landing',
        condition: (context) => !!context.userId,
      },
      // 랜딩페이지에서 시나리오 입력으로
      {
        fromStep: 'landing',
        toStep: 'scenario-input',
      },
      // 시나리오 입력 후 설정으로
      {
        fromStep: 'scenario-input',
        toStep: 'scenario-settings',
        validator: (context) => !!context.metadata.scenarioTitle && !!context.metadata.scenarioContent,
      },
      // 시나리오 설정 후 스토리 생성으로
      {
        fromStep: 'scenario-settings',
        toStep: 'story-generation',
        validator: (context) => !!context.metadata.storyStructure && !!context.metadata.intensity,
      },
      // 스토리 생성 후 편집으로
      {
        fromStep: 'story-generation',
        toStep: 'story-editing',
        condition: (context) => !!context.metadata.generatedStory,
      },
      // 스토리 편집 후 숏트 생성으로
      {
        fromStep: 'story-editing',
        toStep: 'shots-generation',
        validator: (context) => !!context.metadata.finalizedStory,
      },
      // 숏트 생성 후 편집으로
      {
        fromStep: 'shots-generation',
        toStep: 'shots-editing',
        condition: (context) => !!context.metadata.generatedShots,
      },
      // 숏트 편집에서 여러 경로로 분기
      {
        fromStep: 'shots-editing',
        toStep: 'storyboard-download',
      },
      {
        fromStep: 'shots-editing',
        toStep: 'prompt-generation',
      },
      {
        fromStep: 'shots-editing',
        toStep: 'content-management',
      },
      // 프롬프트 생성 후 영상 생성으로
      {
        fromStep: 'prompt-generation',
        toStep: 'video-generation',
        validator: (context) => !!context.metadata.generatedPrompts,
      },
      // 영상 생성 후 피드백으로
      {
        fromStep: 'video-generation',
        toStep: 'video-feedback',
        condition: (context) => !!context.metadata.generatedVideo,
      },
      // 피드백 관련 단계들 간 전환
      {
        fromStep: 'video-feedback',
        toStep: 'feedback-sharing',
      },
      {
        fromStep: 'feedback-sharing',
        toStep: 'timecode-feedback',
      },
      {
        fromStep: 'timecode-feedback',
        toStep: 'feedback-management',
      },
      // 데이터 관리는 언제든 접근 가능
      {
        fromStep: 'content-management',
        toStep: 'data-management',
      },
    ];
  }

  /**
   * 현재 컨텍스트 조회
   */
  getContext(): JourneyContext {
    return { ...this.context };
  }

  /**
   * 현재 워크플로우 상태 조회
   */
  getWorkflowState(): ContentCreationState {
    return this.context.currentWorkflow.getState();
  }

  /**
   * 현재 단계 조회
   */
  getCurrentStep(): WorkflowStep | null {
    return this.context.currentWorkflow.getCurrentStep();
  }

  /**
   * 다음 단계로 진행
   */
  async moveToNextStep(): Promise<boolean> {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return false;

    // 현재 단계의 네비게이션 규칙 확인
    const applicableRules = this.navigationRules.filter(
      rule => rule.fromStep === currentStep.id
    );

    for (const rule of applicableRules) {
      // 조건 확인
      if (rule.condition && !rule.condition(this.context)) {
        continue;
      }

      // 검증 확인
      if (rule.validator && !rule.validator(this.context)) {
        continue;
      }

      // 다음 단계로 이동
      const moved = this.context.currentWorkflow.nextStep();
      if (moved) {
        await this.recordEvent('step_transition', currentStep.id, {
          fromStep: currentStep.id,
          toStep: rule.toStep,
        });
        this.updateContext();
        return true;
      }
    }

    return false;
  }

  /**
   * 특정 단계로 직접 이동
   */
  async jumpToStep(stepId: string): Promise<boolean> {
    const steps = this.context.currentWorkflow.getState().steps;
    const targetIndex = steps.findIndex(step => step.id === stepId);

    if (targetIndex === -1) return false;

    const jumped = this.context.currentWorkflow.jumpToStep(targetIndex);
    if (jumped) {
      await this.recordEvent('step_jump', stepId, { targetStep: stepId });
      this.updateContext();
      return true;
    }

    return false;
  }

  /**
   * 메타데이터 업데이트
   */
  updateMetadata(key: string, value: any): void {
    this.context.metadata[key] = value;
    this.updateContext();
  }

  /**
   * 여러 메타데이터 일괄 업데이트
   */
  updateMetadataBatch(data: Record<string, any>): void {
    Object.assign(this.context.metadata, data);
    this.updateContext();
  }

  /**
   * 프로젝트 ID 설정
   */
  setProjectId(projectId: string): void {
    this.context.projectId = projectId;
    this.context.currentWorkflow.setProjectId(projectId);
    this.updateContext();
  }

  /**
   * 단계 완료 처리
   */
  async completeStep(stepId: string, resultData?: any): Promise<boolean> {
    const completed = this.context.currentWorkflow.completeStep(stepId);

    if (completed) {
      await this.recordEvent('step_completed', stepId, resultData);

      // 결과 데이터가 있으면 메타데이터에 저장
      if (resultData) {
        this.updateMetadata(`${stepId}_result`, resultData);
      }

      this.updateContext();
      return true;
    }

    return false;
  }

  /**
   * 단계별 결과물 설정
   */
  setStepResult(stepId: string, resultId: string): void {
    this.context.currentWorkflow.setStepResult(stepId, resultId);
    this.updateContext();
  }

  /**
   * 진행률 조회
   */
  getProgress(): number {
    return this.context.currentWorkflow.getProgress();
  }

  /**
   * 다음 가능한 단계들 조회
   */
  getNextAvailableSteps(): WorkflowStep[] {
    return this.context.currentWorkflow.getNextAvailableSteps();
  }

  /**
   * 이벤트 기록
   */
  private async recordEvent(type: string, stepId: string, data?: any): Promise<void> {
    const event: JourneyEvent = {
      type,
      stepId,
      timestamp: new Date(),
      data,
    };

    this.events.push(event);

    // 여기서 외부 분석 시스템에 이벤트 전송 가능
    // await this.analyticsService.trackEvent(event);
  }

  /**
   * 컨텍스트 업데이트 (updatedAt 갱신)
   */
  private updateContext(): void {
    this.context.updatedAt = new Date();
  }

  /**
   * 여정 이벤트 히스토리 조회
   */
  getEventHistory(): JourneyEvent[] {
    return [...this.events];
  }

  /**
   * 여정 재시작
   */
  async resetJourney(): Promise<void> {
    this.context.currentWorkflow.reset();
    this.context.metadata = {};
    this.events = [];

    await this.recordEvent('journey_reset', 'auth');
    this.updateContext();
  }

  /**
   * 여정 상태 직렬화 (저장용)
   */
  serialize(): string {
    return JSON.stringify({
      context: this.context,
      events: this.events,
    });
  }

  /**
   * 여정 상태 역직렬화 (복원용)
   */
  static deserialize(data: string, userId: string, sessionId: string): UserJourneyOrchestrator {
    const parsed = JSON.parse(data);
    const orchestrator = new UserJourneyOrchestrator(userId, sessionId);

    // 컨텍스트 복원
    orchestrator.context = {
      ...parsed.context,
      createdAt: new Date(parsed.context.createdAt),
      updatedAt: new Date(parsed.context.updatedAt),
    };

    // 이벤트 히스토리 복원
    orchestrator.events = parsed.events.map((event: any) => ({
      ...event,
      timestamp: new Date(event.timestamp),
    }));

    return orchestrator;
  }

  /**
   * 여정 통계 조회
   */
  getJourneyStats(): {
    totalSteps: number;
    completedSteps: number;
    currentStepIndex: number;
    timeSpent: number;
    eventsCount: number;
  } {
    const state = this.getWorkflowState();
    const completedSteps = state.steps.filter(step => step.completed).length;
    const timeSpent = this.context.updatedAt.getTime() - this.context.createdAt.getTime();

    return {
      totalSteps: state.totalSteps,
      completedSteps,
      currentStepIndex: state.currentStep,
      timeSpent: Math.round(timeSpent / 1000), // 초 단위
      eventsCount: this.events.length,
    };
  }
}