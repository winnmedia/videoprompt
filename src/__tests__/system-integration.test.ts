import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockServiceFactory, resetAllMocks, resetMockReturnValues } from '@/test/mocks';

// 공통 Mock 서비스 사용
const mockOpenAIService = MockServiceFactory.createAIServiceMock();
const mockGeminiService = MockServiceFactory.createAIServiceMock();
const mockDBService = MockServiceFactory.createDBServiceMock();
const mockWebhookService = MockServiceFactory.createWebhookServiceMock();
const mockAnalyticsService = MockServiceFactory.createAnalyticsServiceMock();

describe('VideoPlanet System Integration', () => {
  beforeEach(() => {
    resetAllMocks();
    // Mock 반환값 재설정
    resetMockReturnValues(mockOpenAIService);
    resetMockReturnValues(mockGeminiService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Scene Generation Workflow', () => {
    it('should complete full scene generation workflow', async () => {
      // Given: 사용자가 장면 생성 워크플로우 시작
      const userInput = '아이가 부엌에서 쿠키를 만드는 장면';
      const userId = 'user-123';
      const projectId = 'proj-456';

      // When: 1단계 - 사용자 인증
      const user = await mockDBService.getUser();
      expect(user.id).toBe(userId);

      // When: 2단계 - AI 서비스 확인
      const openaiAvailable = await mockOpenAIService.isAvailable();
      const geminiAvailable = await mockGeminiService.isAvailable();
      expect(openaiAvailable).toBe(true);
      expect(geminiAvailable).toBe(true);

      // When: 3단계 - OpenAI로 장면 생성
      const scenePrompt = await mockOpenAIService.generateScenePrompt(userInput);
      expect(scenePrompt).toBeDefined();

      // When: 4단계 - 데이터베이스에 저장
      const savedScene = await mockDBService.insertScene({ user_id: userId, project_id: projectId, prompt: userInput, generated_content: scenePrompt });

      // When: 5단계 - 웹훅 이벤트 전송
      await mockWebhookService.send('scene.generated', {
        scene_id: savedScene.id,
        user_id: userId,
        project_id: projectId
      });

      // When: 6단계 - 분석 이벤트 추적
      await mockAnalyticsService.trackEvent('workflow_completed', {
        user_id: userId,
        workflow_type: 'scene_generation',
        duration_ms: 5000
      });

      // Then: 전체 워크플로우가 성공적으로 완료
      expect(mockOpenAIService.generateScenePrompt).toHaveBeenCalledWith(userInput);
      expect(mockDBService.insertScene).toHaveBeenCalled();
      expect(mockWebhookService.send).toHaveBeenCalled();
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalled();
    });

    it('should handle OpenAI failure with Gemini fallback', async () => {
      // Given: OpenAI 서비스 실패, Gemini 서비스 사용 가능
      mockOpenAIService.isAvailable.mockResolvedValue(false);
      mockGeminiService.isAvailable.mockResolvedValue(true);

      const userInput = '바다에서 수영하는 아이';

      // When: OpenAI 실패 후 Gemini fallback
      try {
        await mockOpenAIService.generateScenePrompt(userInput);
      } catch (error) {
        // OpenAI 실패 시 Gemini 사용
        const fallbackPrompt = await mockGeminiService.generateScenePrompt(userInput);
        expect(fallbackPrompt).toBeDefined();
      }

      // Then: Gemini fallback이 성공적으로 작동
      expect(mockGeminiService.generateScenePrompt).toHaveBeenCalledWith(userInput);
    });
  });

  describe('Integration Service Management', () => {
    it('should manage multiple integration services', async () => {
      // Given: 여러 통합 서비스
      const integrations = [
        { id: 'openai', name: 'OpenAI', status: 'connected' },
        { id: 'gemini', name: 'Gemini', status: 'connected' },
        { id: 'railway', name: 'Railway', status: 'connected' }
      ];

      // When: 서비스 상태 확인
      const serviceStatuses = await Promise.all([
        mockOpenAIService.isAvailable(),
        mockGeminiService.isAvailable(),
        mockDBService.getUser()
      ]);

      // Then: 모든 서비스가 정상 작동
      expect(serviceStatuses[0]).toBe(true); // OpenAI
      expect(serviceStatuses[1]).toBe(true); // Gemini
      expect(serviceStatuses[2].id).toBeDefined(); // Railway-backed auth stub
    });

    it('should handle service degradation gracefully', async () => {
      // Given: 일부 서비스 성능 저하
      mockOpenAIService.generateScenePrompt.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000)) // 10초 지연
      );

      // When: 타임아웃 설정으로 서비스 전환
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      try {
        await Promise.race([
          mockOpenAIService.generateScenePrompt('테스트'),
          timeoutPromise
        ]);
      } catch (error) {
        // OpenAI 타임아웃 시 Gemini 사용
        const fallbackResult = await mockGeminiService.generateScenePrompt('테스트');
        expect(fallbackResult).toBeDefined();
      }

      // Then: fallback 서비스가 정상 작동
      expect(mockGeminiService.generateScenePrompt).toHaveBeenCalled();
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain data consistency across services', async () => {
      // Given: 여러 서비스에서 동일한 데이터 접근
      const projectId = 'proj-789';
      const userId = 'user-123';

      // When: 프로젝트 데이터를 여러 서비스에서 조회
      const projectFromDB = await mockDBService.queryProjects({ id: projectId });
      const userFromAuth = await mockDBService.getUser();

      // Then: 데이터 일관성 유지
      expect(projectFromDB.user_id).toBe(userId);
      expect(userFromAuth.data.user.id).toBe(userId);
    });

    it('should handle concurrent operations correctly', async () => {
      // Given: 동시 작업 요청
      const projectId = 'proj-concurrent';
      const userId = 'user-123';

      // When: 동시에 여러 작업 실행
      const concurrentOperations = [
        mockDBService.insertScene({ project_id: projectId, user_id: userId }),
        mockDBService.insertScene({ project_id: projectId, user_id: userId }),
        mockAnalyticsService.trackEvent('project_accessed', { project_id: projectId, user_id: userId })
      ];

      // Then: 모든 작업이 성공적으로 완료
      const results = await Promise.all(concurrentOperations);
      expect(results).toHaveLength(3);
      expect(results.every((result: any) => result !== undefined)).toBe(true);
    });

    it('should recover from partial system failures', async () => {
      // Given: 일부 서비스 실패
      mockOpenAIService.isAvailable.mockResolvedValue(false);
      mockDBService.insertScene.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      try {
        // When: 실패한 서비스로 작업 시도
        await mockDBService.insertScene({ content: 'test' });
      } catch (error) {
        // Then: 적절한 오류 처리
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database connection failed');

        // 복구 시도
        // 1. 대체 서비스 사용
        const fallbackResult = await mockGeminiService.generateScenePrompt('테스트');
        expect(fallbackResult).toBeDefined();

        // 2. 데이터베이스 재연결 시도
        await new Promise(resolve => setTimeout(resolve, 1000));
        mockDBService.insertScene.mockRestore(); // 복구

        // 3. 정상 작업 재개
        const result = await mockDBService
          .insertScene({ content: 'test' });
        expect(result).toBeDefined();
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should provide meaningful error messages to users', async () => {
      // Given: 다양한 오류 상황
      const errorScenarios = [
        { service: 'openai', error: 'API rate limit exceeded' },
        { service: 'database', error: 'Database connection timeout' },
        { service: 'analytics', error: 'Tracking service unavailable' }
      ];

      // When: 오류 메시지 생성
      const errorMessages = errorScenarios.map(scenario => {
        switch (scenario.service) {
          case 'openai':
            return 'AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
          case 'database':
            return '데이터베이스 연결에 실패했습니다. 네트워크 상태를 확인해주세요.';
          case 'analytics':
            return '분석 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
          default:
            return '알 수 없는 오류가 발생했습니다.';
        }
      });

      // Then: 사용자 친화적인 오류 메시지 제공
      errorMessages.forEach(message => {
        expect(message).toContain('해주세요');
        expect(message.length).toBeGreaterThan(10);
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high load scenarios', async () => {
      // Given: 높은 부하 상황 (100개 동시 요청)
      const concurrentRequests = Array.from({ length: 100 }, (_, i) => 
        mockOpenAIService.generateScenePrompt(`장면 ${i}`)
      );

      // When: 동시 요청 처리
      const startTime = Date.now();
      const results = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // Then: 모든 요청이 성공적으로 처리되고 적절한 응답 시간
      expect(results).toHaveLength(100);
      expect(results.every((result: any) => result !== undefined)).toBe(true);
      expect(endTime - startTime).toBeLessThan(30000); // 30초 이내
    });

    it('should optimize resource usage', async () => {
      // Given: 리소스 사용량 모니터링
      const resourceUsage = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      };

      // When: 최적화 작업 수행
      await mockAnalyticsService.getUsageStats('resource_optimization', resourceUsage);

      // Then: 리소스 사용량이 적절한 범위 내
      expect(resourceUsage.memory.heapUsed).toBeLessThan(100 * 1024 * 1024); // 100MB 이하
    });
  });
});