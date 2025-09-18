/**
 * Planning Storage Redux Slice
 *
 * 목적: 이중 저장 시스템의 상태 관리
 * 책임: 저장 요청, 진행 상태, 결과 추적, 에러 처리
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type {
  DualStorageResult,
  PlanningStorageState,
  StorageRequest,
  StorageStatus,
} from '../types/planning-storage.types';

// ============================================================================
// 초기 상태 정의
// ============================================================================

const initialState: PlanningStorageState = {
  // 저장 요청 상태
  status: 'idle',
  activeRequests: new Map(),

  // 저장 결과 추적
  results: {
    successful: [],
    failed: [],
    total: 0,
  },

  // 성능 메트릭
  metrics: {
    averageLatency: 0,
    successRate: 100,
    prismaSuccessRate: 100,
    supabaseSuccessRate: 100,
    rollbackCount: 0,
  },

  // 에러 상태
  lastError: null,
  retryQueue: [],
};

// ============================================================================
// Async Thunks (API 호출)
// ============================================================================

/**
 * 이중 저장 요청 처리
 */
export const submitDualStorage = createAsyncThunk<
  DualStorageResult,
  StorageRequest,
  { rejectValue: string }
>(
  'planningStorage/submitDualStorage',
  async (request, { rejectWithValue }) => {
    try {
      console.log('🚀 이중 저장 요청 시작:', {
        type: request.type,
        projectId: request.projectId,
        timestamp: new Date().toISOString(),
      });

      const response = await fetch('/api/planning/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();

      console.log('✅ 이중 저장 완료:', {
        projectId: result.data?.id,
        success: result.success,
        dualStorage: result.data?.dualStorage,
      });

      return result.data.dualStorage as DualStorageResult;
    } catch (error) {
      console.error('❌ 이중 저장 실패:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : '알 수 없는 오류'
      );
    }
  }
);

/**
 * 실패한 요청 재시도
 */
export const retryFailedStorage = createAsyncThunk<
  DualStorageResult[],
  void,
  { rejectValue: string }
>(
  'planningStorage/retryFailedStorage',
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as { planningStorage: PlanningStorageState };
      const { retryQueue } = state.planningStorage;

      if (retryQueue.length === 0) {
        return [];
      }

      console.log(`🔄 ${retryQueue.length}개 요청 재시도 시작`);

      const retryPromises = retryQueue.map(request =>
        dispatch(submitDualStorage(request)).unwrap()
      );

      const results = await Promise.allSettled(retryPromises);
      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<DualStorageResult> =>
          result.status === 'fulfilled'
        )
        .map(result => result.value);

      console.log(`✅ 재시도 완료: ${successfulResults.length}/${retryQueue.length} 성공`);

      return successfulResults;
    } catch (error) {
      console.error('❌ 재시도 실패:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : '재시도 실패'
      );
    }
  }
);

// ============================================================================
// Redux Slice 정의
// ============================================================================

export const planningStorageSlice = createSlice({
  name: 'planningStorage',
  initialState,
  reducers: {
    // 저장 상태 초기화
    resetStorageState: (state) => {
      state.status = 'idle';
      state.activeRequests.clear();
      state.lastError = null;
    },

    // 에러 상태 지우기
    clearLastError: (state) => {
      state.lastError = null;
    },

    // 재시도 큐에서 특정 요청 제거
    removeFromRetryQueue: (state, action: PayloadAction<string>) => {
      const projectId = action.payload;
      state.retryQueue = state.retryQueue.filter(
        req => req.projectId !== projectId
      );
    },

    // 재시도 큐 전체 초기화
    clearRetryQueue: (state) => {
      state.retryQueue = [];
    },

    // 메트릭 초기화
    resetMetrics: (state) => {
      state.metrics = {
        averageLatency: 0,
        successRate: 100,
        prismaSuccessRate: 100,
        supabaseSuccessRate: 100,
        rollbackCount: 0,
      };
      state.results = {
        successful: [],
        failed: [],
        total: 0,
      };
    },
  },
  extraReducers: (builder) => {
    // ========================================================================
    // submitDualStorage 처리
    // ========================================================================
    builder
      .addCase(submitDualStorage.pending, (state, action) => {
        state.status = 'loading';

        // 활성 요청 추가
        const requestId = `${action.meta.arg.projectId}-${Date.now()}`;
        state.activeRequests.set(requestId, {
          ...action.meta.arg,
          status: 'pending',
          startTime: Date.now(),
        });

        state.lastError = null;
      })
      .addCase(submitDualStorage.fulfilled, (state, action) => {
        const result = action.payload;
        const request = action.meta.arg;

        // 성공 결과 추가
        state.results.successful.push({
          ...result,
          request,
          timestamp: new Date().toISOString(),
        });
        state.results.total += 1;

        // 메트릭 업데이트
        updateMetrics(state, result);

        // 활성 요청에서 제거
        removeActiveRequest(state, request.projectId);

        // 재시도 큐에서 제거 (성공했으므로)
        state.retryQueue = state.retryQueue.filter(
          req => req.projectId !== request.projectId
        );

        // 상태 업데이트
        state.status = state.activeRequests.size > 0 ? 'loading' : 'idle';

        console.log('✅ Redux: 이중 저장 성공 처리 완료', {
          projectId: request.projectId,
          totalSuccessful: state.results.successful.length,
          successRate: state.metrics.successRate,
        });
      })
      .addCase(submitDualStorage.rejected, (state, action) => {
        const request = action.meta.arg;
        const error = action.payload || '알 수 없는 오류';

        // 실패 결과 추가
        state.results.failed.push({
          request,
          error,
          timestamp: new Date().toISOString(),
        });
        state.results.total += 1;

        // 메트릭 업데이트 (실패)
        updateMetricsForFailure(state);

        // 재시도 큐에 추가 (중복 방지)
        const isAlreadyInQueue = state.retryQueue.some(
          req => req.projectId === request.projectId
        );
        if (!isAlreadyInQueue) {
          state.retryQueue.push(request);
        }

        // 활성 요청에서 제거
        removeActiveRequest(state, request.projectId);

        // 에러 상태 업데이트
        state.lastError = error;
        state.status = state.activeRequests.size > 0 ? 'loading' : 'error';

        console.error('❌ Redux: 이중 저장 실패 처리 완료', {
          projectId: request.projectId,
          error,
          retryQueueSize: state.retryQueue.length,
        });
      });

    // ========================================================================
    // retryFailedStorage 처리
    // ========================================================================
    builder
      .addCase(retryFailedStorage.pending, (state) => {
        state.status = 'loading';
        state.lastError = null;
      })
      .addCase(retryFailedStorage.fulfilled, (state, action) => {
        const successfulResults = action.payload;

        // 성공한 재시도 결과 추가
        successfulResults.forEach(result => {
          state.results.successful.push({
            ...result,
            request: undefined, // 재시도에서는 원본 요청 정보가 없을 수 있음
            timestamp: new Date().toISOString(),
          });
          updateMetrics(state, result);
        });

        // 재시도 큐 초기화
        state.retryQueue = [];
        state.status = 'idle';

        console.log('✅ Redux: 재시도 완료', {
          successfulCount: successfulResults.length,
          newSuccessRate: state.metrics.successRate,
        });
      })
      .addCase(retryFailedStorage.rejected, (state, action) => {
        state.lastError = action.payload || '재시도 실패';
        state.status = 'error';

        console.error('❌ Redux: 재시도 실패', action.payload);
      });
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 메트릭 업데이트 (성공 케이스)
 */
function updateMetrics(state: PlanningStorageState, result: DualStorageResult): void {
  const { metrics, results } = state;

  // 평균 레이턴시 계산
  const currentLatencies = [
    ...results.successful.map(r => r.latencyMs || 0),
    result.latencyMs || 0,
  ];
  metrics.averageLatency = currentLatencies.reduce((a, b) => a + b, 0) / currentLatencies.length;

  // 성공률 계산
  const totalRequests = results.total;
  const successfulRequests = results.successful.length + 1; // +1 for current
  metrics.successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;

  // Prisma/Supabase 개별 성공률
  const prismaSuccesses = results.successful.filter(r => r.prismaResult?.saved).length +
    (result.prismaResult?.saved ? 1 : 0);
  const supabaseSuccesses = results.successful.filter(r => r.supabaseResult?.saved).length +
    (result.supabaseResult?.saved ? 1 : 0);

  metrics.prismaSuccessRate = totalRequests > 0 ? (prismaSuccesses / totalRequests) * 100 : 100;
  metrics.supabaseSuccessRate = totalRequests > 0 ? (supabaseSuccesses / totalRequests) * 100 : 100;

  // 롤백 카운트
  if (result.rollbackExecuted) {
    metrics.rollbackCount += 1;
  }
}

/**
 * 메트릭 업데이트 (실패 케이스)
 */
function updateMetricsForFailure(state: PlanningStorageState): void {
  const { metrics, results } = state;

  // 성공률 재계산
  const totalRequests = results.total;
  const successfulRequests = results.successful.length;
  metrics.successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;

  // Prisma/Supabase 성공률 재계산
  const prismaSuccesses = results.successful.filter(r => r.prismaResult?.saved).length;
  const supabaseSuccesses = results.successful.filter(r => r.supabaseResult?.saved).length;

  metrics.prismaSuccessRate = totalRequests > 0 ? (prismaSuccesses / totalRequests) * 100 : 100;
  metrics.supabaseSuccessRate = totalRequests > 0 ? (supabaseSuccesses / totalRequests) * 100 : 100;
}

/**
 * 활성 요청에서 제거
 */
function removeActiveRequest(state: PlanningStorageState, projectId: string): void {
  for (const [key, request] of state.activeRequests.entries()) {
    if (request.projectId === projectId) {
      state.activeRequests.delete(key);
      break;
    }
  }
}

// ============================================================================
// Actions Export
// ============================================================================

export const {
  resetStorageState,
  clearLastError,
  removeFromRetryQueue,
  clearRetryQueue,
  resetMetrics,
} = planningStorageSlice.actions;

export default planningStorageSlice.reducer;