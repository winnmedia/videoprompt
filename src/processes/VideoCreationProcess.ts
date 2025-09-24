/**
 * VideoCreationProcess - 영상 생성 프로세스
 * 시나리오 → 스토리보드 → 영상 생성의 전체 워크플로우 관리
 */

import { Storyboard, StoryboardEntity } from '../entities/Storyboard';

export interface VideoCreationStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

export interface VideoCreationState {
  processId: string;
  userId: string;
  currentStep: number;
  steps: VideoCreationStep[];
  metadata: {
    projectTitle: string;
    originalIdea: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

export class VideoCreationProcess {
  private state: VideoCreationState;

  constructor(userId: string, projectTitle: string, originalIdea: string) {
    this.state = {
      processId: this.generateProcessId(),
      userId,
      currentStep: 0,
      steps: [
        { id: 'scenario', name: '시나리오 생성', status: 'pending' },
        { id: 'storyboard', name: '스토리보드 생성', status: 'pending' },
        { id: 'video', name: '영상 생성', status: 'pending' },
      ],
      metadata: {
        projectTitle,
        originalIdea,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  /**
   * 시나리오 생성 단계 실행
   */
  async executeScenarioGeneration(idea: string): Promise<string> {
    try {
      this.updateStepStatus('scenario', 'in_progress');

      // AI 시나리오 생성 로직 (실제로는 외부 API 호출)
      const scenario = await this.generateScenario(idea);

      this.updateStepResult('scenario', scenario);
      this.updateStepStatus('scenario', 'completed');
      this.moveToNextStep();

      return scenario;
    } catch (error) {
      this.updateStepStatus('scenario', 'failed');
      this.updateStepError(
        'scenario',
        error instanceof Error ? error.message : '시나리오 생성 실패'
      );
      throw error;
    }
  }

  /**
   * 스토리보드 생성 단계 실행
   */
  async executeStoryboardGeneration(): Promise<Storyboard[]> {
    try {
      const scenarioStep = this.getStep('scenario');
      if (!scenarioStep || scenarioStep.status !== 'completed') {
        throw new Error('시나리오가 먼저 생성되어야 합니다.');
      }

      this.updateStepStatus('storyboard', 'in_progress');

      const scenario = scenarioStep.result as string;
      const storyboards = await this.generateStoryboard(scenario);

      this.updateStepResult('storyboard', storyboards);
      this.updateStepStatus('storyboard', 'completed');
      this.moveToNextStep();

      return storyboards;
    } catch (error) {
      this.updateStepStatus('storyboard', 'failed');
      this.updateStepError(
        'storyboard',
        error instanceof Error ? error.message : '스토리보드 생성 실패'
      );
      throw error;
    }
  }

  /**
   * 영상 생성 단계 실행
   */
  async executeVideoGeneration(): Promise<string> {
    try {
      const storyboardStep = this.getStep('storyboard');
      if (!storyboardStep || storyboardStep.status !== 'completed') {
        throw new Error('스토리보드가 먼저 생성되어야 합니다.');
      }

      this.updateStepStatus('video', 'in_progress');

      const storyboards = storyboardStep.result as Storyboard[];
      const videoUrl = await this.generateVideo(storyboards);

      this.updateStepResult('video', videoUrl);
      this.updateStepStatus('video', 'completed');

      return videoUrl;
    } catch (error) {
      this.updateStepStatus('video', 'failed');
      this.updateStepError(
        'video',
        error instanceof Error ? error.message : '영상 생성 실패'
      );
      throw error;
    }
  }

  /**
   * 전체 프로세스를 순차적으로 실행
   */
  async executeFullProcess(): Promise<{
    scenario: string;
    storyboards: Storyboard[];
    videoUrl: string;
  }> {
    const scenario = await this.executeScenarioGeneration(
      this.state.metadata.originalIdea
    );
    const storyboards = await this.executeStoryboardGeneration();
    const videoUrl = await this.executeVideoGeneration();

    return { scenario, storyboards, videoUrl };
  }

  /**
   * 현재 프로세스 상태 반환
   */
  getState(): VideoCreationState {
    return { ...this.state };
  }

  /**
   * 진행률 계산 (0-100)
   */
  getProgress(): number {
    const completedSteps = this.state.steps.filter(
      (step) => step.status === 'completed'
    ).length;
    return Math.round((completedSteps / this.state.steps.length) * 100);
  }

  // Private 헬퍼 메서드들

  private generateProcessId(): string {
    return `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateStepStatus(
    stepId: string,
    status: VideoCreationStep['status']
  ): void {
    const step = this.state.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = status;
      this.state.metadata.updatedAt = new Date();
    }
  }

  private updateStepResult(stepId: string, result: unknown): void {
    const step = this.state.steps.find((s) => s.id === stepId);
    if (step) {
      step.result = result;
      this.state.metadata.updatedAt = new Date();
    }
  }

  private updateStepError(stepId: string, error: string): void {
    const step = this.state.steps.find((s) => s.id === stepId);
    if (step) {
      step.error = error;
      this.state.metadata.updatedAt = new Date();
    }
  }

  private getStep(stepId: string): VideoCreationStep | undefined {
    return this.state.steps.find((s) => s.id === stepId);
  }

  private moveToNextStep(): void {
    if (this.state.currentStep < this.state.steps.length - 1) {
      this.state.currentStep++;
    }
  }

  // Mock AI 생성 메서드들 (실제로는 외부 AI API 호출)

  private async generateScenario(idea: string): Promise<string> {
    // 시뮬레이션용 지연
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return `${idea}를 바탕으로 생성된 시나리오입니다. 4단 구조로 구성되어 있습니다.`;
  }

  private async generateStoryboard(scenario: string): Promise<Storyboard[]> {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return [
      new StoryboardEntity(
        '1',
        'Opening Scene',
        scenario.substring(0, 50),
        'mock_image_url_1'
      ),
      new StoryboardEntity(
        '2',
        'Development',
        scenario.substring(50, 100),
        'mock_image_url_2'
      ),
      new StoryboardEntity(
        '3',
        'Climax',
        scenario.substring(100, 150),
        'mock_image_url_3'
      ),
    ];
  }

  private async generateVideo(_storyboards: Storyboard[]): Promise<string> {
    void _storyboards;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return 'https://mock-video-url.com/generated-video.mp4';
  }
}
