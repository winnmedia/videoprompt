/// <reference types="cypress" />

/**
 * Cypress 커스텀 커맨드 타입 정의
 * CLAUDE.md 준수: TypeScript 엄격성, 예측 가능성
 */

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * 인증 관련 커맨드
       */
      preserveAuthCookies(): Chainable<void>;
      clearAuthCookies(): Chainable<void>;
      login(email?: string, password?: string): Chainable<unknown>;
      logout(): Chainable<unknown>;
      register(userData?: any): Chainable<unknown>;
      checkAuthStatus(): Chainable<boolean>;
      createTestUser(): Chainable<unknown>;

      /**
       * 비용 안전 커맨드 ($300 사건 방지)
       */
      preventInfiniteLoop(operationName: string): Chainable<void>;
      monitorApiCalls(maxCalls?: number): Chainable<void>;
      verifyCostSafety(operation: string): Chainable<void>;
      blockExpensiveOperations(): Chainable<void>;
      initCostSafety(): Chainable<void>;
      resetApiLimits(): Chainable<void>;
      checkCostSafety(): Chainable<void>;
      safeApiCall(apiCall: () => Cypress.Chainable<unknown>): Cypress.Chainable<unknown>;
      showCostDashboard(): Chainable<void>;

      /**
       * 피드백 및 파일 관리 커맨드
       */
      shareVideoUrl(videoId: string, shareOptions?: ShareOptions): Chainable<string>;
      replaceVideo(
        oldVideoId: string,
        newVideoFile: string,
        options?: ReplaceVideoOptions
      ): Chainable<string>;
      deleteVideo(videoId: string, confirmDeletion?: boolean): Chainable<void>;
      uploadTestVideo(filePath: string, metadata?: VideoMetadata): Chainable<string>;
      verifyDownload(fileName: string, timeout?: number): Chainable<void>;
      uploadVideo(filePath: string, slot?: number): Chainable<string>;
      shareFeedbackLink(): Chainable<string>;
      addTimecodeComment(timecode: number, comment: string): Chainable<void>;
      addEmotionReaction(timecode: number, emotion: 'like' | 'dislike' | 'confused'): Chainable<void>;
      takeScreenshot(timecode: number): Chainable<string>;

      /**
       * 접근성 테스트 커맨드
       */
      checkA11y(
        context?: string | Node,
        options?: AxeOptions,
        violationCallback?: (violations: any[]) => void
      ): Chainable<void>;

      /**
       * 페이지 성능 검증 커맨드
       */
      measurePageLoad(pageName: string): Chainable<PerformanceMetrics>;
      checkCoreWebVitals(thresholds?: WebVitalsThresholds): Chainable<void>;

      /**
       * API 테스트 커맨드
       */
      apiRequest<T = any>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        url: string,
        options?: ApiRequestOptions
      ): Chainable<Cypress.Response<T>>;

      /**
       * 데이터 검증 커맨드
       */
      verifyDataIntegrity(entityType: string, entityId: string): Chainable<void>;
      validateApiResponse(response: any, schema: object): Chainable<void>;

      /**
       * UI 상호작용 커맨드
       */
      fillForm(formData: Record<string, any>): Chainable<void>;
      waitForStableDOM(timeout?: number): Chainable<void>;

      /**
       * 스크린샷 및 비교 커맨드
       */
      compareScreenshot(name: string, options?: ScreenshotOptions): Chainable<void>;

      /**
       * 테스트 데이터 관리 커맨드
       */
      seedTestData(dataType: string, data: any): Chainable<void>;
      cleanupTestData(dataType?: string): Chainable<void>;

      /**
       * 시나리오 관련 커맨드
       */
      createScenario(scenarioData?: any): Chainable<unknown>;
      generateStory(scenarioId?: string): Chainable<unknown>;
      editStoryStep(stepNumber: number, newContent: string): Chainable<unknown>;
      generateThumbnails(): Chainable<unknown>;
      generate12Shots(): Chainable<unknown>;
      editShot(shotNumber: number, title: string, content: string): Chainable<unknown>;
      generateConti(shotNumber: number): Chainable<unknown>;
      downloadPlan(): Chainable<unknown>;

      /**
       * 사용성 테스트 커맨드 (UserJourneyMap 22단계)
       */
      startUserJourneyMetrics(sessionId?: string): Chainable<void>;
      measureStepCompletion(stepNumber: number, stepName: string, testFunction: () => void): Chainable<void>;
      finishUserJourneyMetrics(): Chainable<void>;
      simulateRealUserBehavior(options?: {
        readingDelay?: number;
        thinkingDelay?: number;
        typingSpeed?: number;
      }): Chainable<unknown>;
      humanLikeType(selector: string, text: string, options?: {
        delay?: number;
        mistakes?: boolean;
      }): Chainable<void>;
      validateUserJourneyStep(
        step: 'login' | 'scenario' | 'planning' | 'video-generation' | 'feedback',
        requirements?: any
      ): Chainable<void>;
      checkStepTransition(
        fromStep: string,
        toStep: string,
        transitionMethod?: 'navigation' | 'button' | 'auto'
      ): Chainable<void>;
      testDragAndDrop(sourceSelector: string, targetSelector: string): Chainable<void>;
      testFileUpload(inputSelector: string, fileName: string, fileType?: string): Chainable<void>;
      testDownload(downloadButton: string, expectedFileName: string): Chainable<void>;
      measureInteractionPerformance(actionName: string, action: () => void): Chainable<void>;
      validateAccessibilityInStep(stepName: string): Chainable<void>;
      simulateNetworkError(apiEndpoint: string, errorType: 'timeout' | 'server-error' | 'network-error'): Chainable<void>;
      testErrorRecovery(errorSelector: string, retryAction: () => void): Chainable<void>;
    }
  }
}

/**
 * 타입 정의들
 */
export interface ShareOptions {
  expiresIn?: string;
  allowComments?: boolean;
  allowDownload?: boolean;
  password?: string;
}

export interface ReplaceVideoOptions {
  preserveMetadata?: boolean;
  updateTitle?: boolean;
  notifySubscribers?: boolean;
}

export interface VideoMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
}

export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
}

export interface WebVitalsThresholds {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
}

export interface ApiRequestOptions {
  body?: any;
  headers?: Record<string, string>;
  failOnStatusCode?: boolean;
  timeout?: number;
}

export interface ScreenshotOptions {
  threshold?: number;
  thresholdType?: 'pixel' | 'percent';
  includeJS?: boolean;
}

/**
 * Axe 접근성 테스트 옵션 (축약된 버전)
 */
export interface AxeOptions {
  rules?: Record<string, { enabled: boolean }>;
  tags?: string[];
  include?: string[][];
  exclude?: string[][];
}

// Cypress 네임스페이스 확장 (외부 모듈에서 사용)
export {};