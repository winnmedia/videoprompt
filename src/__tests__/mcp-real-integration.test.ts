/**
 * 실제 MCP 서버들과 연동하는 통합 테스트
 * 
 * 이 테스트는 실제 MCP 서버들을 사용하여:
 * - Playwright MCP: 실제 브라우저 자동화 테스트
 * - Context7 MCP: 실제 컨텍스트 관리
 * - Sequential Thinking MCP: 실제 순차적 사고 프로세스
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testManager } from '@/lib/mcp-servers/test-utils';

// 실제 MCP 서버 연결을 위한 설정
const MCP_CONFIG = {
  playwright: {
    enabled: true,
    baseUrl: 'http://localhost:3000'
  },
  context7: {
    enabled: true
  },
  sequentialThinking: {
    enabled: true
  }
};

describe('MCP Real Integration - 실제 MCP 서버 연동 테스트', () => {
  beforeAll(async () => {
    // MCP 서버들이 정상 작동하는지 확인
    console.log('🔍 MCP 서버 상태 확인 중...');
    
    try {
      const { checkAllMCPServers } = await import('@/lib/mcp-servers');
      const serverStatus = await checkAllMCPServers();
      
      console.log('📊 MCP 서버 상태:', serverStatus);
      
      // 모든 서버가 정상 작동해야 함
      Object.entries(serverStatus).forEach(([server, status]) => {
        if (!status) {
          console.warn(`⚠️  ${server} MCP 서버가 비정상 상태입니다.`);
        }
      });
      
    } catch (error) {
      console.error('❌ MCP 서버 상태 확인 실패:', error);
    }
  });

  afterAll(async () => {
    // 테스트 정리
    console.log('🧹 MCP 테스트 정리 중...');
  });

  describe('Playwright MCP - 실제 브라우저 자동화', () => {
    it('웹페이지 접근성 및 성능을 실제로 테스트할 수 있다', async () => {
      if (!MCP_CONFIG.playwright.enabled) {
        console.log('⏭️  Playwright MCP 테스트 건너뛰기');
        return;
      }

      console.log('🌐 Playwright MCP를 통한 실제 브라우저 테스트 시작...');
      
      try {
        const testSteps = [
          {
            type: 'accessibility' as const,
            name: '메인 페이지 접근성 테스트',
            config: { includePerformance: true }
          }
        ];
        
        const result = await testManager.runComprehensiveTest(
          'playwright-real-test',
          MCP_CONFIG.playwright.baseUrl,
          testSteps
        );
        
        expect(result.success).toBe(true);
        expect(result.context.steps).toHaveLength(1);
        expect(result.context.steps[0].status).toBe('completed');
        
        console.log('✅ Playwright MCP 테스트 성공');
        
      } catch (error) {
        console.error('❌ Playwright MCP 테스트 실패:', error);
        throw error;
      }
    }, 60000); // 60초 타임아웃

    it('반응형 디자인을 다양한 뷰포트에서 실제로 테스트할 수 있다', async () => {
      if (!MCP_CONFIG.playwright.enabled) {
        console.log('⏭️  Playwright MCP 반응형 테스트 건너뛰기');
        return;
      }

      console.log('📱 반응형 디자인 테스트 시작...');
      
      try {
        const testSteps = [
          {
            type: 'responsive' as const,
            name: '반응형 디자인 테스트',
            config: {
              viewports: [
                { width: 1920, height: 1080 }, // 데스크톱
                { width: 768, height: 1024 },  // 태블릿
                { width: 375, height: 667 }    // 모바일
              ]
            }
          }
        ];
        
        const result = await testManager.runComprehensiveTest(
          'responsive-design-test',
          MCP_CONFIG.playwright.baseUrl,
          testSteps
        );
        
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(1);
        
        console.log('✅ 반응형 디자인 테스트 성공');
        
      } catch (error) {
        console.error('❌ 반응형 디자인 테스트 실패:', error);
        throw error;
      }
    }, 90000); // 90초 타임아웃
  });

  describe('Context7 MCP - 실제 컨텍스트 관리', () => {
    it('장기 실행 테스트에서 컨텍스트를 효율적으로 관리할 수 있다', async () => {
      if (!MCP_CONFIG.context7.enabled) {
        console.log('⏭️  Context7 MCP 테스트 건너뛰기');
        return;
      }

      console.log('🧠 Context7 MCP를 통한 컨텍스트 관리 테스트 시작...');
      
      try {
        // 여러 단계를 가진 복잡한 테스트 시나리오
        const testSteps = [
          {
            type: 'accessibility' as const,
            name: '1단계: 초기 접근성 검사',
            config: { includePerformance: true }
          },
          {
            type: 'custom' as const,
            name: '2단계: 컨텍스트 압축 테스트',
            config: { 
              contextCompression: true,
              memoryOptimization: true
            }
          },
          {
            type: 'custom' as const,
            name: '3단계: 장기 세션 유지 테스트',
            config: { 
              longSession: true,
              contextRetention: true
            }
          }
        ];
        
        const result = await testManager.runComprehensiveTest(
          'context7-long-session-test',
          MCP_CONFIG.playwright.baseUrl,
          testSteps
        );
        
        expect(result.success).toBe(true);
        expect(result.context.steps).toHaveLength(3);
        
        // 컨텍스트가 효율적으로 관리되었는지 확인
        const context = result.context;
        expect(context.metadata.url).toBe(MCP_CONFIG.playwright.baseUrl);
        expect(context.metadata.testSteps).toHaveLength(3);
        
        console.log('✅ Context7 MCP 컨텍스트 관리 테스트 성공');
        
      } catch (error) {
        console.error('❌ Context7 MCP 컨텍스트 관리 테스트 실패:', error);
        throw error;
      }
    }, 120000); // 120초 타임아웃

    it('메모리 사용량을 최적화하면서 테스트를 실행할 수 있다', async () => {
      if (!MCP_CONFIG.context7.enabled) {
        console.log('⏭️  Context7 MCP 메모리 최적화 테스트 건너뛰기');
        return;
      }

      console.log('💾 메모리 최적화 테스트 시작...');
      
      try {
        // 메모리 사용량을 모니터링하는 테스트
        const initialMemory = process.memoryUsage();
        
        const testSteps = [
          {
            type: 'custom' as const,
            name: '메모리 최적화 테스트',
            config: { 
              memoryMonitoring: true,
              contextCompression: true
            }
          }
        ];
        
        const result = await testManager.runComprehensiveTest(
          'memory-optimization-test',
          MCP_CONFIG.playwright.baseUrl,
          testSteps
        );
        
        expect(result.success).toBe(true);
        
        const finalMemory = process.memoryUsage();
        
        // 메모리 사용량이 크게 증가하지 않았는지 확인
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        console.log(`📊 메모리 사용량 변화: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
        
        // 메모리 증가가 100MB 이하여야 함 (테스트 환경 기준)
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
        
        console.log('✅ 메모리 최적화 테스트 성공');
        
      } catch (error) {
        console.error('❌ 메모리 최적화 테스트 실패:', error);
        throw error;
      }
    }, 60000);
  });

  describe('Sequential Thinking MCP - 실제 순차적 사고', () => {
    it('복잡한 테스트 시나리오를 단계별로 분해하고 실행할 수 있다', async () => {
      if (!MCP_CONFIG.sequentialThinking.enabled) {
        console.log('⏭️  Sequential Thinking MCP 테스트 건너뛰기');
        return;
      }

      console.log('🧩 Sequential Thinking MCP를 통한 복잡한 시나리오 테스트 시작...');
      
      try {
        // 복잡한 사용자 여정을 시뮬레이션하는 테스트
        const testSteps = [
          {
            type: 'accessibility' as const,
            name: '1단계: 홈페이지 접근성 검사',
            config: { includePerformance: true }
          },
          {
            type: 'custom' as const,
            name: '2단계: 사용자 인증 플로우',
            config: { 
              userFlow: 'authentication',
              dependencies: ['1단계: 홈페이지 접근성 검사']
            }
          },
          {
            type: 'custom' as const,
            name: '3단계: 메인 기능 테스트',
            config: { 
              userFlow: 'main-features',
              dependencies: ['2단계: 사용자 인증 플로우']
            }
          },
          {
            type: 'custom' as const,
            name: '4단계: 데이터 검증',
            config: { 
              userFlow: 'data-validation',
              dependencies: ['3단계: 메인 기능 테스트']
            }
          }
        ];
        
        const result = await testManager.runComprehensiveTest(
          'sequential-thinking-complex-scenario',
          MCP_CONFIG.playwright.baseUrl,
          testSteps
        );
        
        expect(result.success).toBe(true);
        expect(result.context.steps).toHaveLength(4);
        
        // 모든 단계가 순차적으로 완료되었는지 확인
        const completedSteps = result.context.steps.filter(s => s.status === 'completed');
        expect(completedSteps).toHaveLength(4);
        
        // 단계별 의존성이 올바르게 처리되었는지 확인
        for (let i = 1; i < result.context.steps.length; i++) {
          const currentStep = result.context.steps[i];
          const previousStep = result.context.steps[i - 1];
          
          // 이전 단계가 완료된 후 현재 단계가 실행되었는지 확인
          if (currentStep.startTime && previousStep.endTime) {
            expect(currentStep.startTime).toBeGreaterThanOrEqual(previousStep.endTime);
          }
        }
        
        console.log('✅ Sequential Thinking MCP 복잡한 시나리오 테스트 성공');
        
      } catch (error) {
        console.error('❌ Sequential Thinking MCP 복잡한 시나리오 테스트 실패:', error);
        throw error;
      }
    }, 180000); // 180초 타임아웃

    it('의존성 기반 테스트 실행 순서를 올바르게 관리할 수 있다', async () => {
      if (!MCP_CONFIG.sequentialThinking.enabled) {
        console.log('⏭️  Sequential Thinking MCP 의존성 테스트 건너뛰기');
        return;
      }

      console.log('🔗 의존성 기반 테스트 실행 순서 테스트 시작...');
      
      try {
        // 의존성이 있는 테스트 단계들
        const testSteps = [
          {
            type: 'custom' as const,
            name: 'A: 데이터베이스 초기화',
            config: { 
              stepType: 'setup',
              dependencies: []
            }
          },
          {
            type: 'custom' as const,
            name: 'B: 사용자 데이터 생성',
            config: { 
              stepType: 'data-creation',
              dependencies: ['A: 데이터베이스 초기화']
            }
          },
          {
            type: 'custom' as const,
            name: 'C: 데이터 검증',
            config: { 
              stepType: 'validation',
              dependencies: ['B: 사용자 데이터 생성']
            }
          },
          {
            type: 'custom' as const,
            name: 'D: 정리 작업',
            config: { 
              stepType: 'cleanup',
              dependencies: ['C: 데이터 검증']
            }
          }
        ];
        
        const result = await testManager.runComprehensiveTest(
          'dependency-based-execution',
          MCP_CONFIG.playwright.baseUrl,
          testSteps
        );
        
        expect(result.success).toBe(true);
        
        // 실행 순서가 의존성에 맞게 진행되었는지 확인
        const executionOrder = result.context.steps
          .filter(s => s.status === 'completed')
          .map(s => s.name);
        
        console.log('📋 실제 실행 순서:', executionOrder);
        
        // 의존성 순서가 올바른지 확인
        expect(executionOrder.indexOf('A: 데이터베이스 초기화')).toBeLessThan(
          executionOrder.indexOf('B: 사용자 데이터 생성')
        );
        expect(executionOrder.indexOf('B: 사용자 데이터 생성')).toBeLessThan(
          executionOrder.indexOf('C: 데이터 검증')
        );
        expect(executionOrder.indexOf('C: 데이터 검증')).toBeLessThan(
          executionOrder.indexOf('D: 정리 작업')
        );
        
        console.log('✅ 의존성 기반 테스트 실행 순서 테스트 성공');
        
      } catch (error) {
        console.error('❌ 의존성 기반 테스트 실행 순서 테스트 실패:', error);
        throw error;
      }
    }, 120000);
  });

  describe('통합 MCP 서버 성능 테스트', () => {
    it('모든 MCP 서버를 동시에 사용하여 고성능 테스트를 실행할 수 있다', async () => {
      console.log('🚀 통합 MCP 서버 고성능 테스트 시작...');
      
      try {
        const startTime = Date.now();
        
        // 여러 테스트를 병렬로 실행
        const testPromises = [
          testManager.runComprehensiveTest(
            'parallel-test-1',
            MCP_CONFIG.playwright.baseUrl,
            [{ type: 'accessibility' as const, name: '접근성 테스트 1' }]
          ),
          testManager.runComprehensiveTest(
            'parallel-test-2',
            MCP_CONFIG.playwright.baseUrl,
            [{ type: 'accessibility' as const, name: '접근성 테스트 2' }]
          ),
          testManager.runComprehensiveTest(
            'parallel-test-3',
            MCP_CONFIG.playwright.baseUrl,
            [{ type: 'accessibility' as const, name: '접근성 테스트 3' }]
          )
        ];
        
        const results = await Promise.all(testPromises);
        const endTime = Date.now();
        
        const totalDuration = endTime - startTime;
        console.log(`⏱️  병렬 테스트 총 소요 시간: ${totalDuration}ms`);
        
        // 모든 테스트가 성공했는지 확인
        results.forEach((result, index) => {
          expect(result.success).toBe(true);
          console.log(`✅ 병렬 테스트 ${index + 1} 성공`);
        });
        
        // 성능 요약
        const summary = testManager.getTestSummary();
        console.log('📊 테스트 성능 요약:', summary);
        
        expect(summary.totalTests).toBeGreaterThanOrEqual(3);
        expect(summary.passedTests).toBeGreaterThanOrEqual(3);
        
        console.log('✅ 통합 MCP 서버 고성능 테스트 성공');
        
      } catch (error) {
        console.error('❌ 통합 MCP 서버 고성능 테스트 실패:', error);
        throw error;
      }
    }, 300000); // 5분 타임아웃
  });
});

