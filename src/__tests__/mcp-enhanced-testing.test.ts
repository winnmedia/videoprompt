/**
 * MCP 서버들을 활용한 개선된 테스트
 * 
 * 이 테스트는 다음 MCP 서버들의 기능을 활용합니다:
 * - Playwright MCP: 브라우저 자동화 및 접근성 테스트
 * - Context7 MCP: 테스트 컨텍스트 관리 및 메모리 최적화
 * - Sequential Thinking MCP: 복잡한 테스트 시나리오 분해
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  testManager, 
  TestContextManager, 
  BrowserTestManager, 
  SequentialTestManager,
  type TestContext,
  type SequentialTestPlan
} from '@/lib/mcp-servers/test-utils';

// Mock fetch globally
global.fetch = vi.fn();

describe('MCP Enhanced Testing - 통합 테스트 매니저', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 테스트 컨텍스트 정리
    testManager['contextManager'].cleanup();
  });

  afterAll(() => {
    // 모든 테스트 완료 후 전체 컨텍스트 정리
    testManager.clearAllContexts();
  });

  describe('TestContextManager - Context7 MCP 활용', () => {
    it('테스트 컨텍스트를 생성하고 관리할 수 있다', () => {
      const contextManager = new TestContextManager();
      
      // 컨텍스트 생성
      const context = contextManager.createContext('test-001', { 
        environment: 'development',
        browser: 'chrome'
      });
      
      expect(context.testId).toBe('test-001');
      expect(context.metadata.environment).toBe('development');
      expect(context.steps).toHaveLength(0);
    });

    it('테스트 단계를 순차적으로 관리할 수 있다', () => {
      const contextManager = new TestContextManager();
      contextManager.createContext('test-002');
      
      // 단계 추가
      contextManager.addStep('setup', { timeout: 5000 });
      contextManager.addStep('execution', { retryCount: 3 });
      contextManager.addStep('cleanup');
      
      const context = contextManager.getCurrentContext();
      expect(context?.steps).toHaveLength(3);
      expect(context?.steps[0].name).toBe('setup');
      expect(context?.steps[1].metadata?.retryCount).toBe(3);
    });

    it('테스트 단계의 상태를 추적할 수 있다', () => {
      const contextManager = new TestContextManager();
      contextManager.createContext('test-003');
      contextManager.addStep('test_step');
      
      // 단계 시작
      contextManager.startStep('test_step');
      let context = contextManager.getCurrentContext();
      expect(context?.steps[0].status).toBe('running');
      expect(context?.steps[0].startTime).toBeDefined();
      
      // 단계 완료
      contextManager.completeStep('test_step', { result: 'success' });
      context = contextManager.getCurrentContext();
      expect(context?.steps[0].status).toBe('completed');
      expect(context?.steps[0].endTime).toBeDefined();
      expect(context?.steps[0].metadata?.result).toBe('success');
    });

    it('실패한 단계를 적절히 처리할 수 있다', () => {
      const contextManager = new TestContextManager();
      contextManager.createContext('test-004');
      contextManager.addStep('failing_step');
      
      contextManager.startStep('failing_step');
      contextManager.failStep('failing_step', 'API timeout error');
      
      const context = contextManager.getCurrentContext();
      expect(context?.steps[0].status).toBe('failed');
      expect(context?.steps[0].error).toBe('API timeout error');
    });
  });

  describe('BrowserTestManager - Playwright MCP 활용', () => {
    it('웹페이지 접근성을 테스트할 수 있다', async () => {
      const browserManager = new BrowserTestManager();
      
      const result = await browserManager.testPageAccessibility('http://localhost:3000');
      
      expect(result.url).toBe('http://localhost:3000');
      expect(result.accessibilitySnapshot).toBeDefined();
      expect(result.performanceMetrics).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('폼 자동화 테스트를 수행할 수 있다', async () => {
      const browserManager = new BrowserTestManager();
      
      const formData = {
        username: 'testuser',
        email: 'test@example.com',
        message: 'Test message'
      };
      
      const result = await browserManager.testFormAutomation(
        'http://localhost:3000/contact',
        formData
      );
      
      expect(result).toBe(true);
    });

    it('반응형 디자인을 다양한 뷰포트에서 테스트할 수 있다', async () => {
      const browserManager = new BrowserTestManager();
      
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
        { width: 375, height: 667 }
      ];
      
      const results = await browserManager.testResponsiveDesign(
        'http://localhost:3000',
        viewports
      );
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.viewport).toEqual(viewports[index]);
        expect(result.timestamp).toBeDefined();
      });
    });
  });

  describe('SequentialTestManager - Sequential Thinking MCP 활용', () => {
    it('복잡한 테스트 시나리오를 단계별로 분해할 수 있다', () => {
      const sequentialManager = new SequentialTestManager();
      
      // 테스트 계획 생성
      const plan = sequentialManager.createTestPlan(
        'user-registration-flow',
        '사용자 등록부터 로그인까지의 전체 플로우 테스트'
      );
      
      // 단계 추가
      sequentialManager.addTestStep(
        'user-registration-flow',
        'setup_database',
        '테스트 데이터베이스 설정',
        [],
        10000
      );
      
      sequentialManager.addTestStep(
        'user-registration-flow',
        'create_user',
        '새 사용자 생성',
        ['setup_database'],
        15000
      );
      
      sequentialManager.addTestStep(
        'user-registration-flow',
        'verify_user_creation',
        '사용자 생성 검증',
        ['create_user'],
        5000
      );
      
      // 예상 결과 추가
      sequentialManager.addExpectedOutcome(
        'user-registration-flow',
        '사용자가 데이터베이스에 성공적으로 저장됨'
      );
      
      const retrievedPlan = sequentialManager.getTestPlan('user-registration-flow');
      expect(retrievedPlan?.steps).toHaveLength(3);
      expect(retrievedPlan?.expectedOutcomes).toHaveLength(1);
      expect(retrievedPlan?.steps[1].dependencies).toContain('setup_database');
    });

    it('의존성이 있는 테스트 단계를 올바른 순서로 실행할 수 있다', async () => {
      const sequentialManager = new SequentialTestManager();
      const contextManager = new TestContextManager();
      
      // 테스트 계획 생성
      sequentialManager.createTestPlan('dependency-test', '의존성 테스트');
      sequentialManager.addTestStep('dependency-test', 'step1', '첫 번째 단계');
      sequentialManager.addTestStep('dependency-test', 'step2', '두 번째 단계', ['step1']);
      sequentialManager.addTestStep('dependency-test', 'step3', '세 번째 단계', ['step2']);
      
      const result = await sequentialManager.executeTestPlan('dependency-test', contextManager);
      
      expect(result).toBe(true);
      
      const context = contextManager.getCurrentContext();
      expect(context?.steps).toHaveLength(3);
      expect(context?.steps.every(s => s.status === 'completed')).toBe(true);
    });

    it('의존성이 충족되지 않은 단계는 실행하지 않는다', async () => {
      const sequentialManager = new SequentialTestManager();
      const contextManager = new TestContextManager();
      
      // 잘못된 의존성을 가진 테스트 계획
      sequentialManager.createTestPlan('invalid-dependency', '잘못된 의존성 테스트');
      sequentialManager.addTestStep('invalid-dependency', 'step1', '첫 번째 단계');
      sequentialManager.addTestStep('invalid-dependency', 'step2', '두 번째 단계', ['nonexistent_step']);
      
      const result = await sequentialManager.executeTestPlan('invalid-dependency', contextManager);
      
      expect(result).toBe(false);
      
      const context = contextManager.getCurrentContext();
      expect(context?.steps[0].status).toBe('completed');
      expect(context?.steps[1].status).toBe('failed');
      expect(context?.steps[1].error).toContain('Dependencies not met');
    });
  });

  describe('IntegratedTestManager - 통합 테스트', () => {
    it('종합적인 웹서비스 테스트를 실행할 수 있다', async () => {
      const testSteps = [
        {
          type: 'accessibility' as const,
          name: '접근성 테스트',
          config: { includePerformance: true }
        },
        {
          type: 'form' as const,
          name: '폼 자동화 테스트',
          config: { 
            formData: { 
              username: 'testuser', 
              email: 'test@example.com' 
            } 
          }
        },
        {
          type: 'responsive' as const,
          name: '반응형 디자인 테스트',
          config: {
            viewports: [
              { width: 1920, height: 1080 },
              { width: 768, height: 1024 }
            ]
          }
        }
      ];
      
      const result = await testManager.runComprehensiveTest(
        'comprehensive-website-test',
        'http://localhost:3000',
        testSteps
      );
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.context.testId).toBe('comprehensive-website-test');
      expect(result.context.steps).toHaveLength(3);
      expect(result.context.steps.every(s => s.status === 'completed')).toBe(true);
    });

    it('테스트 실패 시 적절한 에러 처리를 수행한다', async () => {
      // BrowserTestManager를 모킹하여 실패 시나리오 시뮬레이션
      const originalTestPageAccessibility = testManager['browserManager'].testPageAccessibility;
      testManager['browserManager'].testPageAccessibility = vi.fn().mockRejectedValue(
        new Error('Network timeout')
      );
      
      const testSteps = [
        {
          type: 'accessibility' as const,
          name: '접근성 테스트'
        }
      ];
      
      const result = await testManager.runComprehensiveTest(
        'failing-test',
        'http://localhost:3000',
        testSteps
      );
      
      expect(result.success).toBe(false);
      expect(result.context.steps[0].status).toBe('failed');
      expect(result.context.steps[0].error).toContain('Network timeout');
      
      // 원본 메서드 복원
      testManager['browserManager'].testPageAccessibility = originalTestPageAccessibility;
    });

    it('테스트 결과 요약을 제공할 수 있다', async () => {
      // 테스트 전 컨텍스트 정리
      testManager.clearAllContexts();
      
      // 단일 테스트 실행
      const testSteps = [
        { type: 'accessibility' as const, name: 'Test 1' }
      ];
      
      await testManager.runComprehensiveTest('test-1', 'http://localhost:3000', testSteps);
      
      const summary = testManager.getTestSummary();
      
      expect(summary.totalTests).toBe(1);
      expect(summary.passedTests).toBe(1);
      expect(summary.failedTests).toBe(0);
      expect(summary.averageDuration).toBeGreaterThanOrEqual(0);
      
      // 테스트 후 정리
      testManager.clearAllContexts();
    });
  });

  describe('실제 MCP 서버 연동 테스트', () => {
    it('MCP 서버들이 정상적으로 작동하는지 확인할 수 있다', async () => {
      // MCP 서버 상태 확인
      const { checkAllMCPServers } = await import('@/lib/mcp-servers');
      const serverStatus = await checkAllMCPServers();
      
      // 모든 MCP 서버가 정상 작동해야 함
      Object.values(serverStatus).forEach(status => {
        expect(status).toBe(true);
      });
    });

    it('MCP 서버 정보를 올바르게 가져올 수 있다', async () => {
      const { getMCPServerInfo, getAvailableMCPServers } = await import('@/lib/mcp-servers');
      
      const availableServers = getAvailableMCPServers();
      expect(availableServers).toContain('playwright');
      expect(availableServers).toContain('context7');
      expect(availableServers).toContain('sequential-thinking');
      
      const playwrightInfo = getMCPServerInfo('playwright');
      expect(playwrightInfo?.name).toBe('Playwright MCP');
      expect(playwrightInfo?.capabilities).toContain('browser_control');
      
      const context7Info = getMCPServerInfo('context7');
      expect(context7Info?.name).toBe('Context7 MCP');
      expect(context7Info?.capabilities).toContain('context_compression');
    });
  });
});
