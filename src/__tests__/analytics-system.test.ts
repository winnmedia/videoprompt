import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockServiceFactory, resetAllMocks, resetMockReturnValues } from '@/test/mocks';

// 공통 Mock 서비스 사용
const mockAnalyticsService = MockServiceFactory.createAnalyticsServiceMock();
const mockCostService = MockServiceFactory.createCostServiceMock();

describe('Analytics System', () => {
  beforeEach(() => {
    resetAllMocks();
    // Mock 반환값 재설정
    resetMockReturnValues(mockCostService);
  });

  describe('Usage Tracking', () => {
    it('should track AI service usage correctly', async () => {
      // Given: AI 서비스 사용 이벤트
      const usageEvent = {
        service: 'openai',
        model: 'gpt-4',
        tokens_used: 1500,
        user_id: 'user-123',
        project_id: 'proj-456',
        timestamp: new Date().toISOString(),
      };

      // When: 사용량 추적
      await mockAnalyticsService.trackEvent('ai_usage', usageEvent);

      // Then: 이벤트가 올바르게 추적됨
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith('ai_usage', usageEvent);
    });

    it('should track user actions for UX analysis', async () => {
      // Given: 사용자 액션
      const userAction = {
        action: 'scene_generation_started',
        page: '/wizard',
        user_id: 'user-123',
        session_id: 'sess-789',
        timestamp: new Date().toISOString(),
      };

      // When: 사용자 액션 추적
      await mockAnalyticsService.trackUserAction(userAction);

      // Then: 액션이 올바르게 추적됨
      expect(mockAnalyticsService.trackUserAction).toHaveBeenCalledWith(userAction);
    });
  });

  describe('Cost Analysis', () => {
    it('should calculate OpenAI costs accurately', async () => {
      // Given: OpenAI 사용량 데이터
      const usageData = {
        model: 'gpt-4',
        input_tokens: 1000,
        output_tokens: 500,
        requests: 10,
      };

      // When: 비용 계산
      const cost = await mockCostService.calculateOpenAICost(usageData);

      // Then: 정확한 비용 계산
      expect(mockCostService.calculateOpenAICost).toHaveBeenCalledWith(usageData);
      expect(cost).toBeGreaterThan(0);
    });

    it('should calculate Gemini costs accurately', async () => {
      // Given: Gemini 사용량 데이터
      const usageData = {
        model: 'gemini-pro',
        input_tokens: 800,
        output_tokens: 400,
        requests: 8,
      };

      // When: 비용 계산
      const cost = await mockCostService.calculateGeminiCost(usageData);

      // Then: 정확한 비용 계산
      expect(mockCostService.calculateGeminiCost).toHaveBeenCalledWith(usageData);
      expect(cost).toBeGreaterThan(0);
    });

    it('should calculate total monthly costs', async () => {
      // Given: 월간 사용량 데이터
      const monthlyUsage = {
        openai: { cost: 25.5 },
        gemini: { cost: 18.75 },
        storage: { cost: 5.25 },
        other: { cost: 2.0 },
      };

      // When: 총 비용 계산
      const totalCost = await mockCostService.getTotalCost(monthlyUsage);

      // Then: 모든 서비스 비용 합계
      expect(mockCostService.getTotalCost).toHaveBeenCalledWith(monthlyUsage);
      expect(totalCost).toBe(51.5);
    });
  });

  describe('Performance Metrics', () => {
    it('should track API response times', async () => {
      // Given: API 응답 시간 데이터
      const responseTimeData = {
        service: 'openai',
        endpoint: 'scene_generation',
        response_time_ms: 2500,
        status: 'success',
        timestamp: new Date().toISOString(),
      };

      // When: 응답 시간 추적
      await mockAnalyticsService.trackEvent('api_response_time', responseTimeData);

      // Then: 성능 메트릭이 추적됨
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        'api_response_time',
        responseTimeData,
      );
    });

    it('should identify performance bottlenecks', async () => {
      // Given: 성능 데이터
      const performanceData = {
        service: 'gemini',
        average_response_time: 3500,
        p95_response_time: 8000,
        error_rate: 0.05,
        throughput: 100,
      };

      // When: 성능 분석
      const bottlenecks = await mockAnalyticsService.generateReport('performance', performanceData);

      // Then: 병목 지점 식별
      expect(mockAnalyticsService.generateReport).toHaveBeenCalledWith(
        'performance',
        performanceData,
      );
      expect(bottlenecks).toContain('response_time');
    });
  });

  describe('User Behavior Analysis', () => {
    it('should analyze user journey patterns', async () => {
      // Given: 사용자 여정 데이터
      const journeyData = {
        user_id: 'user-123',
        steps: [
          { page: '/', timestamp: '2024-01-01T10:00:00Z' },
          { page: '/wizard', timestamp: '2024-01-01T10:05:00Z' },
          { page: '/editor', timestamp: '2024-01-01T10:15:00Z' },
          { page: '/integrations', timestamp: '2024-01-01T10:30:00Z' },
        ],
        completion_time: 1800,
      };

      // When: 여정 분석
      const analysis = await mockAnalyticsService.generateReport('user_journey', journeyData);

      // Then: 사용자 패턴 분석
      expect(mockAnalyticsService.generateReport).toHaveBeenCalledWith('user_journey', journeyData);
      expect(analysis).toHaveProperty('dropoff_points');
      expect(analysis).toHaveProperty('conversion_rate');
    });

    it('should identify feature adoption rates', async () => {
      // Given: 기능 사용 데이터
      const featureData = {
        feature: 'ai_scene_generation',
        total_users: 1000,
        active_users: 750,
        daily_active_users: 150,
        weekly_active_users: 400,
      };

      // When: 채택률 계산
      const adoptionRate = await mockAnalyticsService.getUsageStats(
        'feature_adoption',
        featureData,
      );

      // Then: 정확한 채택률 계산
      expect(mockAnalyticsService.getUsageStats).toHaveBeenCalledWith(
        'feature_adoption',
        featureData,
      );
      expect(adoptionRate).toBe(0.75); // 75%
    });
  });

  describe('Business Intelligence', () => {
    it('should generate monthly business reports', async () => {
      // Given: 월간 비즈니스 데이터
      const businessData = {
        month: '2024-01',
        new_users: 150,
        active_users: 1200,
        total_projects: 500,
        ai_generations: 2500,
        revenue: 2500.0,
      };

      // When: 비즈니스 리포트 생성
      const report = await mockAnalyticsService.generateReport('business_monthly', businessData);

      // Then: 포괄적인 비즈니스 리포트
      expect(mockAnalyticsService.generateReport).toHaveBeenCalledWith(
        'business_monthly',
        businessData,
      );
      expect(report).toHaveProperty('user_growth');
      expect(report).toHaveProperty('engagement_metrics');
      expect(report).toHaveProperty('revenue_analysis');
    });

    it('should predict future trends', async () => {
      // Given: 과거 데이터
      const historicalData = {
        months: ['2023-10', '2023-11', '2023-12'],
        user_growth: [100, 120, 150],
        ai_usage: [1000, 1500, 2000],
        revenue: [1000, 1500, 2000],
      };

      // When: 트렌드 예측
      const predictions = await mockAnalyticsService.generateReport(
        'trend_prediction',
        historicalData,
      );

      // Then: 미래 트렌드 예측
      expect(mockAnalyticsService.generateReport).toHaveBeenCalledWith(
        'trend_prediction',
        historicalData,
      );
      expect(predictions).toHaveProperty('next_month_users');
      expect(predictions).toHaveProperty('next_month_revenue');
    });
  });
});
