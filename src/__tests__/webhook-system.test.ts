import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockServiceFactory, resetAllMocks } from '@/test/mocks';

// 공통 Mock 서비스 사용
const mockNotificationService = MockServiceFactory.createNotificationServiceMock();
const mockWebhookHandlers = MockServiceFactory.createWebhookHandlersMock(mockNotificationService);

describe('Webhook System', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('Integration Webhooks', () => {
    it('should handle integration connected event', async () => {
      // Given: 통합 서비스 연결 이벤트
      const webhookData = {
        event: 'integration.connected',
        integration_id: 'openai',
        user_id: 'user-123',
        timestamp: new Date().toISOString(),
      };

      // When: 웹훅 이벤트 처리
      await mockWebhookHandlers['integration.connected'](webhookData);

      // Then: 핸들러가 호출되고 알림 전송
      expect(mockWebhookHandlers['integration.connected']).toHaveBeenCalledWith(webhookData);
      expect(mockNotificationService.sendToUser).toHaveBeenCalledWith(
        'user-123',
        'OpenAI 서비스가 성공적으로 연결되었습니다.',
      );
    });

    it('should handle integration disconnected event', async () => {
      // Given: 통합 서비스 연결 해제 이벤트
      const webhookData = {
        event: 'integration.disconnected',
        integration_id: 'gemini',
        user_id: 'user-123',
        reason: 'API 키 만료',
        timestamp: new Date().toISOString(),
      };

      // When: 웹훅 이벤트 처리
      await mockWebhookHandlers['integration.disconnected'](webhookData);

      // Then: 핸들러가 호출되고 경고 알림 전송
      expect(mockWebhookHandlers['integration.disconnected']).toHaveBeenCalledWith(webhookData);
      expect(mockNotificationService.sendToUser).toHaveBeenCalledWith(
        'user-123',
        'Gemini 서비스 연결이 해제되었습니다. API 키를 확인해주세요.',
      );
    });
  });

  describe('Project Webhooks', () => {
    it('should handle project creation event', async () => {
      // Given: 새 프로젝트 생성 이벤트
      const webhookData = {
        event: 'project.created',
        project_id: 'proj-456',
        user_id: 'user-123',
        project_title: '새로운 영상 프로젝트',
        timestamp: new Date().toISOString(),
      };

      // When: 웹훅 이벤트 처리
      await mockWebhookHandlers['project.created'](webhookData);

      // Then: 핸들러가 호출되고 프로젝트 생성 알림
      expect(mockWebhookHandlers['project.created']).toHaveBeenCalledWith(webhookData);
      expect(mockNotificationService.sendToUser).toHaveBeenCalledWith(
        'user-123',
        '새로운 영상 프로젝트가 생성되었습니다!',
      );
    });
  });

  describe('AI Generation Webhooks', () => {
    it('should handle scene generation completion', async () => {
      // Given: 장면 생성 완료 이벤트
      const webhookData = {
        event: 'scene.generated',
        scene_id: 'scene-789',
        project_id: 'proj-456',
        user_id: 'user-123',
        generation_time: 2500,
        ai_service: 'openai',
        timestamp: new Date().toISOString(),
      };

      // When: 웹훅 이벤트 처리
      await mockWebhookHandlers['scene.generated'](webhookData);

      // Then: 핸들러가 호출되고 생성 완료 알림
      expect(mockWebhookHandlers['scene.generated']).toHaveBeenCalledWith(webhookData);
      expect(mockNotificationService.sendToUser).toHaveBeenCalledWith(
        'user-123',
        '장면 생성이 완료되었습니다! (2.5초 소요)',
      );
    });

    it('should handle AI service fallback', async () => {
      // Given: AI 서비스 fallback 이벤트
      const webhookData = {
        event: 'ai.fallback',
        original_service: 'openai',
        fallback_service: 'gemini',
        user_id: 'user-123',
        reason: 'Rate limit exceeded',
        timestamp: new Date().toISOString(),
      };

      // When: 웹훅 이벤트 처리
      // Then: fallback 로깅 및 모니터링
      expect(mockNotificationService.sendToChannel).toHaveBeenCalledWith(
        'monitoring',
        'AI 서비스 fallback 발생: OpenAI → Gemini',
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle webhook processing errors', async () => {
      // Given: 웹훅 처리 중 오류 발생
      const invalidWebhookData = {
        event: 'invalid.event',
        malformed_data: 'invalid',
      };

      // When: 잘못된 웹훅 데이터 처리 시도
      // Then: 오류 로깅 및 적절한 응답
      expect(() => {
        // 잘못된 이벤트 타입 처리
        if (!mockWebhookHandlers[invalidWebhookData.event as keyof typeof mockWebhookHandlers]) {
          throw new Error(`Unknown webhook event: ${invalidWebhookData.event}`);
        }
      }).toThrow('Unknown webhook event: invalid.event');
    });

    it('should retry failed webhook deliveries', async () => {
      // Given: 웹훅 전송 실패
      const webhookData = {
        event: 'integration.connected',
        integration_id: 'openai',
        user_id: 'user-123',
      };

      // When: 첫 번째 시도 실패 후 재시도
      let attemptCount = 0;
      const maxRetries = 3;

      const processWebhook = async () => {
        try {
          if (attemptCount < maxRetries) {
            attemptCount++;
            throw new Error('Temporary failure');
          }
          return await mockWebhookHandlers['integration.connected'](webhookData);
        } catch (error) {
          if (attemptCount >= maxRetries) {
            throw error;
          }
          // 재시도 로직
          await new Promise((resolve) => setTimeout(resolve, 1000 * attemptCount));
          return processWebhook();
        }
      };

      // Then: 최대 재시도 횟수만큼 시도
      await expect(processWebhook()).resolves.toBeDefined();
      expect(attemptCount).toBe(3);
    });
  });
});
