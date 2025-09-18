/**
 * 데이터 저장 일관성 트랜잭션 테스트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 목표: Supabase ↔ Seedance 데이터 동기화 일관성 보장
 * - 이중 저장 트랜잭션 원자성 검증
 * - 부분 실패 시 롤백 메커니즘
 * - 데이터 정합성 및 동기화 상태 추적
 * - 분산 트랜잭션 에러 핸들링
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// 트랜잭션 상태 추적 시스템
class TransactionTracker {
  private transactions: Map<string, {
    id: string;
    status: 'pending' | 'committed' | 'failed' | 'rolled_back';
    operations: Array<{
      service: 'supabase' | 'seedance';
      operation: string;
      status: 'pending' | 'success' | 'failed';
      timestamp: number;
      data?: any;
      error?: string;
    }>;
    startTime: number;
    endTime?: number;
    consistency: 'unknown' | 'consistent' | 'inconsistent';
  }> = new Map();

  private dataStates: Map<string, {
    supabase: any;
    seedance: any;
    lastSync: number;
    syncStatus: 'synced' | 'diverged' | 'unknown';
  }> = new Map();

  startTransaction(id: string): void {
    this.transactions.set(id, {
      id,
      status: 'pending',
      operations: [],
      startTime: Date.now(),
      consistency: 'unknown'
    });

    console.log(`🟡 [${id}] 트랜잭션 시작`);
  }

  addOperation(
    transactionId: string,
    service: 'supabase' | 'seedance',
    operation: string,
    data?: any
  ): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      console.error(`❌ 트랜잭션 ${transactionId}를 찾을 수 없음`);
      return;
    }

    transaction.operations.push({
      service,
      operation,
      status: 'pending',
      timestamp: Date.now(),
      data
    });

    console.log(`⚪ [${transactionId}] ${service}.${operation} 시작`);
  }

  markOperationSuccess(
    transactionId: string,
    service: 'supabase' | 'seedance',
    operation: string,
    data?: any
  ): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    const op = transaction.operations.find(
      o => o.service === service && o.operation === operation && o.status === 'pending'
    );

    if (op) {
      op.status = 'success';
      op.data = data;
      console.log(`✅ [${transactionId}] ${service}.${operation} 성공`);
    }
  }

  markOperationFailed(
    transactionId: string,
    service: 'supabase' | 'seedance',
    operation: string,
    error: string
  ): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    const op = transaction.operations.find(
      o => o.service === service && o.operation === operation && o.status === 'pending'
    );

    if (op) {
      op.status = 'failed';
      op.error = error;
      console.log(`❌ [${transactionId}] ${service}.${operation} 실패: ${error}`);
    }

    // 하나라도 실패하면 전체 트랜잭션 실패
    transaction.status = 'failed';
  }

  commitTransaction(transactionId: string): boolean {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return false;

    const hasFailures = transaction.operations.some(op => op.status === 'failed');

    if (hasFailures) {
      transaction.status = 'failed';
      transaction.endTime = Date.now();
      console.log(`❌ [${transactionId}] 트랜잭션 커밋 실패 - 일부 작업 실패`);
      return false;
    }

    transaction.status = 'committed';
    transaction.endTime = Date.now();
    transaction.consistency = this.checkConsistency(transactionId);

    console.log(`✅ [${transactionId}] 트랜잭션 커밋 완료 (${transaction.consistency})`);
    return true;
  }

  rollbackTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    transaction.status = 'rolled_back';
    transaction.endTime = Date.now();

    console.log(`🔄 [${transactionId}] 트랜잭션 롤백 완료`);
  }

  updateDataState(entityId: string, service: 'supabase' | 'seedance', data: any): void {
    const state = this.dataStates.get(entityId) || {
      supabase: null,
      seedance: null,
      lastSync: Date.now(),
      syncStatus: 'unknown'
    };

    state[service] = data;
    state.lastSync = Date.now();

    // 동기화 상태 확인
    if (state.supabase && state.seedance) {
      state.syncStatus = this.deepEqual(state.supabase, state.seedance) ? 'synced' : 'diverged';
    } else {
      state.syncStatus = 'unknown';
    }

    this.dataStates.set(entityId, state);
    console.log(`📊 [${entityId}] ${service} 데이터 업데이트 (${state.syncStatus})`);
  }

  private checkConsistency(transactionId: string): 'consistent' | 'inconsistent' {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return 'inconsistent';

    // 같은 엔티티에 대한 작업들의 일관성 확인
    const entityOperations = new Map<string, Array<any>>();

    for (const op of transaction.operations) {
      if (op.status === 'success' && op.data?.id) {
        const ops = entityOperations.get(op.data.id) || [];
        ops.push(op);
        entityOperations.set(op.data.id, ops);
      }
    }

    for (const [entityId, ops] of entityOperations) {
      const supabaseOp = ops.find(op => op.service === 'supabase');
      const seedanceOp = ops.find(op => op.service === 'seedance');

      if (supabaseOp && seedanceOp) {
        const state = this.dataStates.get(entityId);
        if (state?.syncStatus === 'diverged') {
          return 'inconsistent';
        }
      }
    }

    return 'consistent';
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key) || !this.deepEqual(a[key], b[key])) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  getTransactionStatus(transactionId: string) {
    return this.transactions.get(transactionId);
  }

  getDataConsistency(entityId: string) {
    return this.dataStates.get(entityId);
  }

  getInconsistentEntities(): string[] {
    const inconsistent = [];
    for (const [entityId, state] of this.dataStates) {
      if (state.syncStatus === 'diverged') {
        inconsistent.push(entityId);
      }
    }
    return inconsistent;
  }

  reset() {
    this.transactions.clear();
    this.dataStates.clear();
  }

  getDetailedReport(): string {
    const totalTransactions = this.transactions.size;
    const committed = Array.from(this.transactions.values()).filter(t => t.status === 'committed').length;
    const failed = Array.from(this.transactions.values()).filter(t => t.status === 'failed').length;
    const rolledBack = Array.from(this.transactions.values()).filter(t => t.status === 'rolled_back').length;

    const totalEntities = this.dataStates.size;
    const synced = Array.from(this.dataStates.values()).filter(s => s.syncStatus === 'synced').length;
    const diverged = Array.from(this.dataStates.values()).filter(s => s.syncStatus === 'diverged').length;

    return `📊 트랜잭션 일관성 리포트:
  트랜잭션:
    총 ${totalTransactions}개
    커밋: ${committed}개
    실패: ${failed}개
    롤백: ${rolledBack}개

  데이터 일관성:
    총 엔티티: ${totalEntities}개
    동기화됨: ${synced}개
    불일치: ${diverged}개
    성공률: ${totalEntities > 0 ? ((synced / totalEntities) * 100).toFixed(1) : 0}%`;
  }
}

const transactionTracker = new TransactionTracker();

// MSW 서버 설정 - Supabase와 Seedance 시뮬레이션
const server = setupServer(
  // Supabase - 계획 저장
  http.post('/api/supabase/plans', async ({ request }) => {
    const scenario = request.headers.get('x-test-scenario') || 'default';
    const transactionId = request.headers.get('x-transaction-id') || 'unknown';

    const body = await request.json();
    const planData = body as any;

    transactionTracker.addOperation(transactionId, 'supabase', 'create_plan', planData);

    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, 100));

    switch (scenario) {
      case 'supabase-success':
        const savedPlan = {
          id: planData.id || `supabase-plan-${Date.now()}`,
          title: planData.title,
          description: planData.description,
          status: 'draft',
          createdAt: new Date().toISOString(),
          source: 'supabase'
        };

        transactionTracker.markOperationSuccess(transactionId, 'supabase', 'create_plan', savedPlan);
        transactionTracker.updateDataState(savedPlan.id, 'supabase', savedPlan);

        return HttpResponse.json({
          ok: true,
          data: savedPlan
        });

      case 'supabase-failure':
        transactionTracker.markOperationFailed(transactionId, 'supabase', 'create_plan', 'Database constraint violation');
        return HttpResponse.json({
          ok: false,
          code: 'DATABASE_ERROR',
          error: 'Failed to insert plan into Supabase',
          statusCode: 500
        }, { status: 500 });

      case 'supabase-timeout':
        // 타임아웃 시뮬레이션 (5초 지연)
        await new Promise(resolve => setTimeout(resolve, 5000));
        transactionTracker.markOperationFailed(transactionId, 'supabase', 'create_plan', 'Operation timeout');
        return HttpResponse.json({
          ok: false,
          code: 'TIMEOUT_ERROR',
          error: 'Supabase operation timed out',
          statusCode: 408
        }, { status: 408 });

      default:
        const defaultPlan = {
          id: planData.id || `plan-${Date.now()}`,
          title: planData.title,
          description: planData.description,
          createdAt: new Date().toISOString(),
          source: 'supabase'
        };

        transactionTracker.markOperationSuccess(transactionId, 'supabase', 'create_plan', defaultPlan);
        transactionTracker.updateDataState(defaultPlan.id, 'supabase', defaultPlan);

        return HttpResponse.json({
          ok: true,
          data: defaultPlan
        });
    }
  }),

  // Seedance - 계획 저장
  http.post('/api/seedance/plans', async ({ request }) => {
    const scenario = request.headers.get('x-test-scenario') || 'default';
    const transactionId = request.headers.get('x-transaction-id') || 'unknown';

    const body = await request.json();
    const planData = body as any;

    transactionTracker.addOperation(transactionId, 'seedance', 'create_plan', planData);

    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, 150));

    switch (scenario) {
      case 'seedance-success':
        const seedancePlan = {
          id: planData.id || `seedance-plan-${Date.now()}`,
          title: planData.title,
          description: planData.description,
          status: 'published',
          publishedAt: new Date().toISOString(),
          source: 'seedance'
        };

        transactionTracker.markOperationSuccess(transactionId, 'seedance', 'create_plan', seedancePlan);
        transactionTracker.updateDataState(seedancePlan.id, 'seedance', seedancePlan);

        return HttpResponse.json({
          ok: true,
          data: seedancePlan
        });

      case 'seedance-failure':
        transactionTracker.markOperationFailed(transactionId, 'seedance', 'create_plan', 'Seedance API key invalid');
        return HttpResponse.json({
          ok: false,
          code: 'AUTHENTICATION_ERROR',
          error: 'Invalid Seedance API key',
          statusCode: 401
        }, { status: 401 });

      case 'seedance-rate-limit':
        transactionTracker.markOperationFailed(transactionId, 'seedance', 'create_plan', 'Rate limit exceeded');
        return HttpResponse.json({
          ok: false,
          code: 'RATE_LIMIT_EXCEEDED',
          error: 'Seedance rate limit exceeded',
          statusCode: 429,
          retryAfter: 60
        }, { status: 429 });

      case 'data-inconsistency':
        // 의도적으로 다른 데이터 반환 (일관성 테스트용)
        const inconsistentPlan = {
          id: planData.id,
          title: planData.title + ' [MODIFIED]', // 의도적 차이
          description: planData.description,
          status: 'published',
          extraField: 'inconsistent-data', // 추가 필드
          publishedAt: new Date().toISOString(),
          source: 'seedance'
        };

        transactionTracker.markOperationSuccess(transactionId, 'seedance', 'create_plan', inconsistentPlan);
        transactionTracker.updateDataState(inconsistentPlan.id, 'seedance', inconsistentPlan);

        return HttpResponse.json({
          ok: true,
          data: inconsistentPlan
        });

      default:
        const defaultSeedancePlan = {
          id: planData.id || `plan-${Date.now()}`,
          title: planData.title,
          description: planData.description,
          status: 'published',
          publishedAt: new Date().toISOString(),
          source: 'seedance'
        };

        transactionTracker.markOperationSuccess(transactionId, 'seedance', 'create_plan', defaultSeedancePlan);
        transactionTracker.updateDataState(defaultSeedancePlan.id, 'seedance', defaultSeedancePlan);

        return HttpResponse.json({
          ok: true,
          data: defaultSeedancePlan
        });
    }
  }),

  // 롤백 API - Supabase
  http.delete('/api/supabase/plans/:id', async ({ params, request }) => {
    const planId = params.id as string;
    const transactionId = request.headers.get('x-transaction-id') || 'unknown';

    transactionTracker.addOperation(transactionId, 'supabase', 'delete_plan', { id: planId });

    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, 50));

    transactionTracker.markOperationSuccess(transactionId, 'supabase', 'delete_plan', { id: planId });
    transactionTracker.updateDataState(planId, 'supabase', null);

    return HttpResponse.json({
      ok: true,
      data: { id: planId, deleted: true }
    });
  }),

  // 롤백 API - Seedance
  http.delete('/api/seedance/plans/:id', async ({ params, request }) => {
    const planId = params.id as string;
    const transactionId = request.headers.get('x-transaction-id') || 'unknown';

    transactionTracker.addOperation(transactionId, 'seedance', 'delete_plan', { id: planId });

    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, 75));

    transactionTracker.markOperationSuccess(transactionId, 'seedance', 'delete_plan', { id: planId });
    transactionTracker.updateDataState(planId, 'seedance', null);

    return HttpResponse.json({
      ok: true,
      data: { id: planId, deleted: true }
    });
  }),

  // 동기화 상태 확인 API
  http.get('/api/sync/status/:id', ({ params }) => {
    const entityId = params.id as string;
    const state = transactionTracker.getDataConsistency(entityId);

    return HttpResponse.json({
      ok: true,
      data: {
        entityId,
        syncStatus: state?.syncStatus || 'unknown',
        lastSync: state?.lastSync || null,
        supabaseData: state?.supabase || null,
        seedanceData: state?.seedance || null
      }
    });
  })
);

// 테스트 헬퍼 함수
async function createPlanTransaction(
  planData: any,
  transactionId: string,
  supabaseScenario: string = 'default',
  seedanceScenario: string = 'default'
) {
  transactionTracker.startTransaction(transactionId);

  const headers = {
    'Content-Type': 'application/json',
    'x-transaction-id': transactionId
  };

  // Supabase 저장
  const supabasePromise = fetch('/api/supabase/plans', {
    method: 'POST',
    headers: {
      ...headers,
      'x-test-scenario': supabaseScenario
    },
    body: JSON.stringify(planData)
  });

  // Seedance 저장
  const seedancePromise = fetch('/api/seedance/plans', {
    method: 'POST',
    headers: {
      ...headers,
      'x-test-scenario': seedanceScenario
    },
    body: JSON.stringify(planData)
  });

  try {
    const [supabaseResponse, seedanceResponse] = await Promise.all([
      supabasePromise,
      seedancePromise
    ]);

    const success = transactionTracker.commitTransaction(transactionId);

    return {
      success,
      supabaseResponse,
      seedanceResponse,
      transaction: transactionTracker.getTransactionStatus(transactionId)
    };
  } catch (error) {
    transactionTracker.rollbackTransaction(transactionId);
    throw error;
  }
}

async function rollbackPlan(planId: string, transactionId: string) {
  const headers = {
    'x-transaction-id': transactionId
  };

  const supabaseRollback = fetch(`/api/supabase/plans/${planId}`, {
    method: 'DELETE',
    headers
  });

  const seedanceRollback = fetch(`/api/seedance/plans/${planId}`, {
    method: 'DELETE',
    headers
  });

  const [supabaseResult, seedanceResult] = await Promise.all([
    supabaseRollback,
    seedanceRollback
  ]);

  return { supabaseResult, seedanceResult };
}

beforeEach(() => {
  server.listen({
    onUnhandledRequest: 'error',
    quiet: false
  });

  transactionTracker.reset();

  process.env.FORCE_MSW = 'true';
  process.env.NODE_ENV = 'test';

  // 시간 mock
  let currentTime = 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

  (global as any).advanceTime = (ms: number) => {
    currentTime += ms;
  };

  // fetch mock
  if (!global.fetch) {
    global.fetch = fetch;
  }
});

afterEach(() => {
  server.resetHandlers();
  delete process.env.FORCE_MSW;
  delete (global as any).advanceTime;
  vi.clearAllMocks();
  vi.resetAllMocks();
});

afterAll(() => {
  server.close();
});

describe('🔄 데이터 저장 일관성 트랜잭션 테스트', () => {

  describe('정상적인 이중 저장 트랜잭션', () => {
    test('✅ [GREEN] Supabase + Seedance 동시 저장 성공', async () => {
      // Given: 저장할 계획 데이터
      const planData = {
        id: 'plan-success-001',
        title: 'Test Plan',
        description: 'This is a test plan for dual storage'
      };

      // When: 이중 저장 트랜잭션 실행
      const result = await createPlanTransaction(
        planData,
        'tx-success-001',
        'supabase-success',
        'seedance-success'
      );

      // Then: 두 서비스 모두 성공
      expect(result.success).toBe(true);
      expect(result.supabaseResponse.status).toBe(200);
      expect(result.seedanceResponse.status).toBe(200);

      const supabaseBody = await result.supabaseResponse.json();
      const seedanceBody = await result.seedanceResponse.json();

      expect(supabaseBody.data.id).toBe(planData.id);
      expect(seedanceBody.data.id).toBe(planData.id);

      // 데이터 일관성 확인
      const consistency = transactionTracker.getDataConsistency(planData.id);
      expect(consistency?.syncStatus).toBe('synced');

      console.log(transactionTracker.getDetailedReport());
    });

    test('✅ [GREEN] 대량 트랜잭션 처리 성능', async () => {
      // Given: 10개의 계획 데이터
      const plans = Array.from({ length: 10 }, (_, i) => ({
        id: `plan-bulk-${i + 1}`,
        title: `Bulk Plan ${i + 1}`,
        description: `Description for plan ${i + 1}`
      }));

      const startTime = performance.now();

      // When: 동시에 10개 트랜잭션 실행
      const promises = plans.map((plan, index) =>
        createPlanTransaction(
          plan,
          `tx-bulk-${index + 1}`,
          'supabase-success',
          'seedance-success'
        )
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      // Then: 모든 트랜잭션 성공
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(10);

      // 성능 확인 (전체 처리 시간)
      const totalTime = endTime - startTime;
      console.log(`⚡ 10개 트랜잭션 처리 시간: ${totalTime.toFixed(2)}ms`);
      expect(totalTime).toBeLessThan(3000); // 3초 이내

      // 데이터 일관성 확인
      const syncedEntities = plans.filter(plan => {
        const consistency = transactionTracker.getDataConsistency(plan.id);
        return consistency?.syncStatus === 'synced';
      });

      expect(syncedEntities).toHaveLength(10);

      console.log(transactionTracker.getDetailedReport());
    });
  });

  describe('부분 실패 및 롤백 시나리오', () => {
    test('❌ [RED] Supabase 실패 시 트랜잭션 실패', async () => {
      // Given: Supabase 실패 시나리오
      const planData = {
        id: 'plan-supabase-fail-001',
        title: 'Fail Test Plan',
        description: 'This plan should fail on Supabase'
      };

      // When: Supabase 실패하는 트랜잭션
      const result = await createPlanTransaction(
        planData,
        'tx-fail-001',
        'supabase-failure',
        'seedance-success'
      );

      // Then: 전체 트랜잭션 실패
      expect(result.success).toBe(false);
      expect(result.supabaseResponse.status).toBe(500);
      expect(result.seedanceResponse.status).toBe(200); // Seedance는 성공했지만

      // 트랜잭션 상태 확인
      const transaction = result.transaction;
      expect(transaction?.status).toBe('failed');

      // 실패한 작업과 성공한 작업 구분
      const failedOps = transaction?.operations.filter(op => op.status === 'failed');
      const successOps = transaction?.operations.filter(op => op.status === 'success');

      expect(failedOps).toHaveLength(1);
      expect(successOps).toHaveLength(1);

      console.log(transactionTracker.getDetailedReport());
    });

    test('❌ [RED] Seedance 실패 시 트랜잭션 실패', async () => {
      // Given: Seedance 실패 시나리오
      const planData = {
        id: 'plan-seedance-fail-001',
        title: 'Seedance Fail Test',
        description: 'This plan should fail on Seedance'
      };

      // When: Seedance 실패하는 트랜잭션
      const result = await createPlanTransaction(
        planData,
        'tx-seedance-fail-001',
        'supabase-success',
        'seedance-failure'
      );

      // Then: 전체 트랜잭션 실패
      expect(result.success).toBe(false);
      expect(result.supabaseResponse.status).toBe(200); // Supabase는 성공
      expect(result.seedanceResponse.status).toBe(401); // Seedance 실패

      console.log(transactionTracker.getDetailedReport());
    });

    test('🔄 [ROLLBACK] 부분 실패 후 롤백 실행', async () => {
      // Given: 부분 실패한 트랜잭션
      const planData = {
        id: 'plan-rollback-001',
        title: 'Rollback Test Plan',
        description: 'This plan will be rolled back'
      };

      const result = await createPlanTransaction(
        planData,
        'tx-rollback-001',
        'supabase-success',
        'seedance-failure'
      );

      expect(result.success).toBe(false);

      // When: 성공했던 Supabase 데이터 롤백
      const rollbackResult = await rollbackPlan(planData.id, 'tx-rollback-cleanup');

      // Then: 롤백 성공
      expect(rollbackResult.supabaseResult.status).toBe(200);

      // 데이터 일관성 확인 (모든 데이터 제거)
      const consistency = transactionTracker.getDataConsistency(planData.id);
      expect(consistency?.supabase).toBeNull();

      console.log('🔄 롤백 완료');
      console.log(transactionTracker.getDetailedReport());
    });

    test('⏱️ [TIMEOUT] 타임아웃 시 트랜잭션 실패', async () => {
      // Given: 타임아웃 시나리오
      const planData = {
        id: 'plan-timeout-001',
        title: 'Timeout Test Plan',
        description: 'This plan will timeout'
      };

      // When: 타임아웃 발생하는 트랜잭션 (Promise.race로 3초 제한)
      const startTime = Date.now();

      try {
        const result = await Promise.race([
          createPlanTransaction(
            planData,
            'tx-timeout-001',
            'supabase-timeout',
            'seedance-success'
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Transaction timeout')), 3000)
          )
        ]);

        expect(result.success).toBe(false);
      } catch (error) {
        expect((error as Error).message).toBe('Transaction timeout');
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3100); // 3초 + 여유시간

      console.log(`⏱️ 타임아웃 테스트 완료: ${duration}ms`);
    });
  });

  describe('데이터 일관성 검증', () => {
    test('❌ [RED] 데이터 불일치 감지', async () => {
      // Given: 의도적으로 다른 데이터를 반환하는 시나리오
      const planData = {
        id: 'plan-inconsistent-001',
        title: 'Consistency Test Plan',
        description: 'This plan will have inconsistent data'
      };

      // When: 일관성이 없는 데이터로 저장
      const result = await createPlanTransaction(
        planData,
        'tx-inconsistent-001',
        'supabase-success',
        'data-inconsistency'
      );

      // Then: 트랜잭션은 성공하지만 데이터 불일치
      expect(result.success).toBe(true);

      const consistency = transactionTracker.getDataConsistency(planData.id);
      expect(consistency?.syncStatus).toBe('diverged');

      // 불일치 엔티티 목록 확인
      const inconsistentEntities = transactionTracker.getInconsistentEntities();
      expect(inconsistentEntities).toContain(planData.id);

      console.log('❌ 데이터 불일치 감지:');
      console.log('Supabase:', consistency?.supabase);
      console.log('Seedance:', consistency?.seedance);
    });

    test('🔍 [VERIFICATION] 동기화 상태 API 검증', async () => {
      // Given: 성공적인 트랜잭션 후
      const planData = {
        id: 'plan-sync-check-001',
        title: 'Sync Check Plan',
        description: 'Plan for sync status check'
      };

      await createPlanTransaction(
        planData,
        'tx-sync-check-001',
        'supabase-success',
        'seedance-success'
      );

      // When: 동기화 상태 API 호출
      const syncResponse = await fetch(`/api/sync/status/${planData.id}`);

      // Then: 정확한 동기화 상태 반환
      expect(syncResponse.status).toBe(200);

      const syncData = await syncResponse.json();
      expect(syncData.data.syncStatus).toBe('synced');
      expect(syncData.data.supabaseData).not.toBeNull();
      expect(syncData.data.seedanceData).not.toBeNull();
      expect(syncData.data.lastSync).toBeGreaterThan(0);

      console.log('🔍 동기화 상태 확인:', syncData.data);
    });

    test('📊 [METRICS] 트랜잭션 성공률 및 일관성 메트릭', async () => {
      // Given: 다양한 시나리오의 트랜잭션들
      const scenarios = [
        { id: 'metrics-001', supabase: 'supabase-success', seedance: 'seedance-success' },
        { id: 'metrics-002', supabase: 'supabase-success', seedance: 'seedance-failure' },
        { id: 'metrics-003', supabase: 'supabase-failure', seedance: 'seedance-success' },
        { id: 'metrics-004', supabase: 'supabase-success', seedance: 'data-inconsistency' },
        { id: 'metrics-005', supabase: 'supabase-success', seedance: 'seedance-success' },
      ];

      // When: 모든 시나리오 실행
      const results = await Promise.allSettled(
        scenarios.map((scenario, index) =>
          createPlanTransaction(
            {
              id: `plan-${scenario.id}`,
              title: `Metrics Plan ${index + 1}`,
              description: `Plan for metrics test ${index + 1}`
            },
            `tx-${scenario.id}`,
            scenario.supabase,
            scenario.seedance
          )
        )
      );

      // Then: 메트릭 분석
      const successfulTransactions = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .filter(result => result.value.success);

      const failedTransactions = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .filter(result => !result.value.success);

      const inconsistentEntities = transactionTracker.getInconsistentEntities();

      console.log('📊 트랜잭션 메트릭:');
      console.log(`  성공: ${successfulTransactions.length}/${scenarios.length}`);
      console.log(`  실패: ${failedTransactions.length}/${scenarios.length}`);
      console.log(`  데이터 불일치: ${inconsistentEntities.length}개`);
      console.log(transactionTracker.getDetailedReport());

      expect(successfulTransactions.length).toBe(2); // 완전 성공은 2개
      expect(failedTransactions.length).toBe(2); // 실패는 2개
      expect(inconsistentEntities.length).toBe(1); // 불일치는 1개
    });
  });

  describe('Rate Limiting 및 재시도 로직', () => {
    test('❌ [RED] Seedance Rate Limit 시 트랜잭션 실패', async () => {
      // Given: Rate Limit 상황
      const planData = {
        id: 'plan-rate-limit-001',
        title: 'Rate Limit Test',
        description: 'This will hit rate limit'
      };

      // When: Rate Limit 발생
      const result = await createPlanTransaction(
        planData,
        'tx-rate-limit-001',
        'supabase-success',
        'seedance-rate-limit'
      );

      // Then: 트랜잭션 실패
      expect(result.success).toBe(false);
      expect(result.seedanceResponse.status).toBe(429);

      const seedanceBody = await result.seedanceResponse.json();
      expect(seedanceBody.retryAfter).toBe(60);

      console.log('❌ Rate Limit으로 인한 트랜잭션 실패');
    });

    test('🔄 [RETRY] Rate Limit 후 재시도 성공', async () => {
      // Given: 첫 번째 시도에서 Rate Limit
      const planData = {
        id: 'plan-retry-001',
        title: 'Retry Test Plan',
        description: 'This plan will succeed on retry'
      };

      const firstResult = await createPlanTransaction(
        planData,
        'tx-retry-first-001',
        'supabase-success',
        'seedance-rate-limit'
      );

      expect(firstResult.success).toBe(false);

      // When: 1분 후 재시도 (시간 mock)
      (global as any).advanceTime(61000);

      const retryResult = await createPlanTransaction(
        planData,
        'tx-retry-second-001',
        'supabase-success',
        'seedance-success'
      );

      // Then: 재시도 성공
      expect(retryResult.success).toBe(true);

      console.log('🔄 Rate Limit 후 재시도 성공');
    });
  });

  describe('복구 및 동기화 보정', () => {
    test('🔧 [REPAIR] 불일치 데이터 동기화 보정', async () => {
      // Given: 불일치가 발생한 상황
      const planData = {
        id: 'plan-repair-001',
        title: 'Repair Test Plan',
        description: 'This plan needs repair'
      };

      await createPlanTransaction(
        planData,
        'tx-repair-001',
        'supabase-success',
        'data-inconsistency'
      );

      const initialConsistency = transactionTracker.getDataConsistency(planData.id);
      expect(initialConsistency?.syncStatus).toBe('diverged');

      // When: 동기화 보정 (Seedance 데이터를 Supabase와 일치시킴)
      const correctedData = initialConsistency?.supabase;
      transactionTracker.updateDataState(planData.id, 'seedance', correctedData);

      // Then: 일관성 복구
      const repairedConsistency = transactionTracker.getDataConsistency(planData.id);
      expect(repairedConsistency?.syncStatus).toBe('synced');

      console.log('🔧 데이터 동기화 보정 완료');
    });

    test('📈 [MONITORING] 장기간 일관성 모니터링', async () => {
      // Given: 여러 시점에 걸친 트랜잭션들
      const timePoints = [0, 60000, 120000, 180000]; // 0분, 1분, 2분, 3분

      for (let i = 0; i < timePoints.length; i++) {
        (global as any).advanceTime(timePoints[i]);

        await createPlanTransaction(
          {
            id: `plan-monitoring-${i + 1}`,
            title: `Monitoring Plan ${i + 1}`,
            description: `Plan created at ${timePoints[i]}ms`
          },
          `tx-monitoring-${i + 1}`,
          'supabase-success',
          i === 2 ? 'data-inconsistency' : 'seedance-success' // 3번째만 불일치
        );
      }

      // When: 전체 일관성 상태 확인
      const inconsistentEntities = transactionTracker.getInconsistentEntities();

      // Then: 모니터링 결과
      expect(inconsistentEntities).toHaveLength(1);
      expect(inconsistentEntities[0]).toBe('plan-monitoring-3');

      console.log('📈 장기간 모니터링 결과:');
      console.log(transactionTracker.getDetailedReport());
    });
  });
});