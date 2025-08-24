import { vi } from 'vitest';

// 공통 Mock 서비스 팩토리
export class MockServiceFactory {
  // AI 서비스 Mock 생성
  static createAIServiceMock() {
    return {
      generateScenePrompt: vi.fn().mockResolvedValue({
        enhancedPrompt: '테스트 장면 프롬프트',
        suggestions: ['테스트', '장면', '프롬프트'],
        metadata: { duration: 30, theme: '테스트' }
      }),
      isAvailable: vi.fn().mockResolvedValue(true)
    };
  }

  // 비용 계산 서비스 Mock 생성
  static createCostServiceMock() {
    return {
      calculateOpenAICost: vi.fn().mockResolvedValue(15.75),
      calculateGeminiCost: vi.fn().mockResolvedValue(12.50),
      calculateStorageCost: vi.fn().mockResolvedValue(5.25),
      getTotalCost: vi.fn().mockResolvedValue(51.50)
    };
  }

  // 분석 서비스 Mock 생성
  static createAnalyticsServiceMock() {
    return {
      trackEvent: vi.fn().mockResolvedValue(true),
      trackUserAction: vi.fn().mockResolvedValue(true),
      getUsageStats: vi.fn().mockResolvedValue(0.75),
      generateReport: vi.fn().mockResolvedValue({
        bottlenecks: ['response_time', 'throughput'],
        user_growth: 0.15,
        engagement_metrics: { daily_active: 1200, monthly_active: 8500 },
        revenue_analysis: { current_month: 12500, growth_rate: 0.08 }
      })
    };
  }

  // 웹훅 서비스 Mock 생성
  static createWebhookServiceMock() {
    return {
      send: vi.fn().mockResolvedValue(true),
      handleEvent: vi.fn().mockResolvedValue(true)
    };
  }

  // 알림 서비스 Mock 생성
  static createNotificationServiceMock() {
    return {
      send: vi.fn().mockResolvedValue(true),
      sendToUser: vi.fn().mockResolvedValue(true),
      sendToChannel: vi.fn().mockResolvedValue(true)
    };
  }

  // 데이터베이스 서비스 Mock 생성
  static createDBServiceMock() {
    return {
      getUser: vi.fn().mockResolvedValue({ 
        id: 'user-123', 
        data: { user: { id: 'user-123' } } 
      }),
      insertScene: vi.fn().mockResolvedValue({ 
        id: 'scene-789', 
        user_id: 'user-123', 
        project_id: 'proj-456' 
      }),
      queryProjects: vi.fn().mockResolvedValue([
        { id: 'proj-456', user_id: 'user-123' }
      ])
    };
  }

  // 웹훅 핸들러 Mock 생성
  static createWebhookHandlersMock(notificationService: any) {
    return {
      'integration.connected': vi.fn().mockImplementation(async (data: any) => {
        await notificationService.sendToUser(data.user_id, 'OpenAI 서비스가 성공적으로 연결되었습니다.');
      }),
      'integration.disconnected': vi.fn().mockImplementation(async (data: any) => {
        await notificationService.sendToUser(data.user_id, 'Gemini 서비스 연결이 해제되었습니다. API 키를 확인해주세요.');
      }),
      'project.created': vi.fn().mockImplementation(async (data: any) => {
        await notificationService.sendToUser(data.user_id, '새로운 영상 프로젝트가 생성되었습니다!');
      }),
      'scene.generated': vi.fn().mockImplementation(async (data: any) => {
        await notificationService.sendToUser(data.user_id, `장면 생성이 완료되었습니다! (${data.generation_time / 1000}초 소요)`);
      })
    };
  }
}

// Mock 응답 생성 유틸리티
export const createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(JSON.stringify(data))
});

export const createMockError = (message: string, status = 500) => ({
  ok: false,
  status,
  json: vi.fn().mockRejectedValue(new Error(message)),
  text: vi.fn().mockRejectedValue(new Error(message))
});

// Mock 초기화 유틸리티
export const resetAllMocks = () => {
  vi.clearAllMocks();
};

// Mock 반환값 재설정 유틸리티
export const resetMockReturnValues = (mockService: any) => {
  if (mockService.generateScenePrompt) {
    mockService.generateScenePrompt.mockResolvedValue({
      enhancedPrompt: '테스트 장면 프롬프트',
      suggestions: ['테스트', '장면', '프롬프트'],
      metadata: { duration: 30, theme: '테스트' }
    });
  }
  
  if (mockService.calculateOpenAICost) {
    mockService.calculateOpenAICost.mockResolvedValue(15.75);
  }
  
  if (mockService.calculateGeminiCost) {
    mockService.calculateGeminiCost.mockResolvedValue(12.50);
  }
};
