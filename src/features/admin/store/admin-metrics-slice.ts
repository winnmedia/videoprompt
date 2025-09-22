/**
 * Admin Metrics Slice
 *
 * 관리자 메트릭 상태 관리를 담당하는 Redux slice입니다.
 * RTK 2.0과 async thunk를 사용합니다.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { AdminMetrics, AdminApiResponse } from '../../../entities/admin';
import { adminApi } from '../../../shared/api/admin-api';

/**
 * 메트릭 상태 인터페이스
 */
interface AdminMetricsState {
  /** 메트릭 데이터 */
  metrics: AdminMetrics | null;
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 마지막 업데이트 시간 */
  lastUpdated: Date | null;
  /** 캐시 만료 시간 (5분) */
  cacheExpiry: number;
}

/**
 * 초기 상태
 */
const initialState: AdminMetricsState = {
  metrics: null,
  loading: false,
  error: null,
  lastUpdated: null,
  cacheExpiry: 5 * 60 * 1000 // 5분
};

/**
 * 메트릭 조회 Async Thunk
 * $300 사건 방지: 중복 호출 및 캐시 검증 포함
 */
export const fetchAdminMetrics = createAsyncThunk(
  'adminMetrics/fetchMetrics',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { adminMetrics: AdminMetricsState };
      const { lastUpdated, cacheExpiry } = state.adminMetrics;

      // 캐시 검증: 5분 이내 데이터가 있으면 API 호출 생략
      if (lastUpdated) {
        const now = Date.now();
        const timeSinceUpdate = now - lastUpdated.getTime();

        if (timeSinceUpdate < cacheExpiry) {
          console.log('AdminMetrics: 캐시된 데이터 사용');
          return state.adminMetrics.metrics!;
        }
      }

      console.log('AdminMetrics: API 호출 수행');
      const response: AdminApiResponse<AdminMetrics> = await adminApi.getMetrics();

      if (!response.success) {
        throw new Error(response.message || '메트릭 조회 실패');
      }

      return response.data;
    } catch (error) {
      console.error('AdminMetrics fetch error:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
      );
    }
  },
  {
    // 동시 요청 방지
    condition: (_, { getState }) => {
      const state = getState() as { adminMetrics: AdminMetricsState };
      return !state.adminMetrics.loading;
    }
  }
);

/**
 * Admin Metrics Slice
 */
export const adminMetricsSlice = createSlice({
  name: 'adminMetrics',
  initialState,
  reducers: {
    /**
     * 메트릭 초기화
     */
    clearMetrics: (state) => {
      state.metrics = null;
      state.error = null;
      state.lastUpdated = null;
    },

    /**
     * 에러 초기화
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * 캐시 만료 시간 설정
     */
    setCacheExpiry: (state, action: PayloadAction<number>) => {
      state.cacheExpiry = action.payload;
    },

    /**
     * 부분적 메트릭 업데이트 (실시간 업데이트용)
     */
    updatePartialMetrics: (state, action: PayloadAction<Partial<AdminMetrics>>) => {
      if (state.metrics) {
        state.metrics = { ...state.metrics, ...action.payload };
        state.lastUpdated = new Date();
      }
    },

    /**
     * 수동 메트릭 요청 트리거
     */
    fetchMetrics: () => {
      // 이 액션은 컴포넌트에서 dispatch하여 fetchAdminMetrics thunk를 트리거하는 용도
      // 실제 로직은 extraReducers에서 처리
    }
  },
  extraReducers: (builder) => {
    builder
      // 메트릭 조회 시작
      .addCase(fetchAdminMetrics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      // 메트릭 조회 성공
      .addCase(fetchAdminMetrics.fulfilled, (state, action) => {
        state.loading = false;
        state.metrics = action.payload;
        state.lastUpdated = new Date();
        state.error = null;
      })
      // 메트릭 조회 실패
      .addCase(fetchAdminMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

/**
 * 선택자 (Selectors)
 */
export const selectAdminMetrics = (state: { adminMetrics: AdminMetricsState }) =>
  state.adminMetrics.metrics;

export const selectAdminMetricsLoading = (state: { adminMetrics: AdminMetricsState }) =>
  state.adminMetrics.loading;

export const selectAdminMetricsError = (state: { adminMetrics: AdminMetricsState }) =>
  state.adminMetrics.error;

export const selectMetricsLastUpdated = (state: { adminMetrics: AdminMetricsState }) =>
  state.adminMetrics.lastUpdated;

/**
 * 메트릭 데이터 유효성 검사 선택자
 */
export const selectIsMetricsDataStale = (state: { adminMetrics: AdminMetricsState }) => {
  const { lastUpdated, cacheExpiry } = state.adminMetrics;

  if (!lastUpdated) return true;

  const now = Date.now();
  const timeSinceUpdate = now - lastUpdated.getTime();

  return timeSinceUpdate > cacheExpiry;
};

/**
 * 시스템 건전성 선택자
 */
export const selectSystemHealthScore = (state: { adminMetrics: AdminMetricsState }) => {
  const metrics = state.adminMetrics.metrics;

  if (!metrics) return 0;

  // 간단한 건전성 점수 계산
  const { queueStatus } = metrics.system;
  const totalJobs = Object.values(queueStatus).reduce((sum, count) => sum + count, 0);

  if (totalJobs === 0) return 100;

  const successRate = (queueStatus.completed / totalJobs) * 100;
  const failureRate = (queueStatus.failed / totalJobs) * 100;

  // 성공률 기반 점수 계산
  let score = successRate;

  // 실패율 페널티
  score -= failureRate * 2;

  // 대기 중인 작업 페널티
  const queuedRatio = queueStatus.queued / totalJobs;
  if (queuedRatio > 0.3) {
    score -= (queuedRatio - 0.3) * 50;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

// 액션과 리듀서 export
export const { clearMetrics, clearError, setCacheExpiry, updatePartialMetrics } =
  adminMetricsSlice.actions;

export default adminMetricsSlice.reducer;