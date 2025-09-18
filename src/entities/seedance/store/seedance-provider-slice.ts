/**
 * Seedance Provider 상태 관리 Redux Slice
 * TDD로 구현된 안전한 상태 관리
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Provider 설정 타입
export interface ProviderConfig {
  apiKeySource: 'SEEDANCE_API_KEY' | 'MODELARK_API_KEY' | 'none';
  environment: 'development' | 'production' | 'test';
  mockExplicitlyEnabled: boolean;
  shouldUseMock: boolean;
}

// Provider 상태 타입
export interface ProviderStatus {
  isReady: boolean;
  lastChecked: string | null;
  errorMessage: string | null;
  retryCount: number;
}

// API 키 상태 타입
export interface ApiKeyStatus {
  isValid: boolean;
  hasKey: boolean;
  keyFormat: string;
  lastValidated: string | null;
  validationError: string | null;
}

// 전체 Seedance Provider 상태
export interface SeedanceProviderState {
  config: ProviderConfig;
  status: ProviderStatus;
  apiKey: ApiKeyStatus;
}

// 초기 상태
const initialState: SeedanceProviderState = {
  config: {
    apiKeySource: 'none',
    environment: 'development',
    mockExplicitlyEnabled: false,
    shouldUseMock: true,
  },
  status: {
    isReady: false,
    lastChecked: null,
    errorMessage: null,
    retryCount: 0,
  },
  apiKey: {
    isValid: false,
    hasKey: false,
    keyFormat: 'none',
    lastValidated: null,
    validationError: null,
  },
};

// Redux Slice 생성
const seedanceProviderSlice = createSlice({
  name: 'seedanceProvider',
  initialState,
  reducers: {
    // Provider 설정 업데이트
    setProviderConfig: (state, action: PayloadAction<Partial<ProviderConfig>>) => {
      state.config = { ...state.config, ...action.payload };
    },

    // Provider 상태 업데이트
    setProviderStatus: (state, action: PayloadAction<ProviderStatus>) => {
      state.status = action.payload;
    },

    // API 키 상태 업데이트
    updateApiKeyStatus: (state, action: PayloadAction<ApiKeyStatus>) => {
      state.apiKey = action.payload;
    },

    // 전체 상태 리셋
    resetProviderState: () => {
      return initialState;
    },

    // Provider 에러 설정 (편의 액션)
    setProviderError: (state, action: PayloadAction<{ message: string; increaseRetryCount?: boolean }>) => {
      state.status.isReady = false;
      state.status.errorMessage = action.payload.message;
      state.status.lastChecked = new Date().toISOString();

      if (action.payload.increaseRetryCount) {
        state.status.retryCount += 1;
      }
    },

    // Provider 준비 완료 설정 (편의 액션)
    setProviderReady: (state) => {
      state.status.isReady = true;
      state.status.errorMessage = null;
      state.status.lastChecked = new Date().toISOString();
    },

    // API 키 검증 실패 설정 (편의 액션)
    setApiKeyInvalid: (state, action: PayloadAction<{ error: string; keyFormat?: string }>) => {
      state.apiKey.isValid = false;
      state.apiKey.validationError = action.payload.error;
      state.apiKey.lastValidated = new Date().toISOString();

      if (action.payload.keyFormat) {
        state.apiKey.keyFormat = action.payload.keyFormat;
      }

      // API 키가 유효하지 않으면 Provider도 준비되지 않은 상태로 설정
      state.status.isReady = false;
      state.status.errorMessage = `API 키 검증 실패: ${action.payload.error}`;
    },

    // API 키 검증 성공 설정 (편의 액션)
    setApiKeyValid: (state, action: PayloadAction<{ keyFormat: string; source: ProviderConfig['apiKeySource'] }>) => {
      state.apiKey.isValid = true;
      state.apiKey.hasKey = true;
      state.apiKey.keyFormat = action.payload.keyFormat;
      state.apiKey.lastValidated = new Date().toISOString();
      state.apiKey.validationError = null;

      // 설정도 함께 업데이트
      state.config.apiKeySource = action.payload.source;
      state.config.shouldUseMock = false; // 유효한 키가 있으면 Mock 비활성화
    },

    // Mock 모드 전환 (편의 액션)
    enableMockMode: (state, action: PayloadAction<{ reason: string }>) => {
      state.config.shouldUseMock = true;
      state.status.isReady = true;
      state.status.errorMessage = null;
      state.status.lastChecked = new Date().toISOString();

      console.log(`🎭 Mock mode enabled: ${action.payload.reason}`);
    },
  },
});

// 액션 익스포트
export const {
  setProviderConfig,
  setProviderStatus,
  updateApiKeyStatus,
  resetProviderState,
  setProviderError,
  setProviderReady,
  setApiKeyInvalid,
  setApiKeyValid,
  enableMockMode,
} = seedanceProviderSlice.actions;

// Selectors
export const selectProviderConfig = (state: { seedanceProvider: SeedanceProviderState }) =>
  state.seedanceProvider.config;

export const selectProviderStatus = (state: { seedanceProvider: SeedanceProviderState }) =>
  state.seedanceProvider.status;

export const selectApiKeyStatus = (state: { seedanceProvider: SeedanceProviderState }) =>
  state.seedanceProvider.apiKey;

export const selectShouldUseMock = (state: { seedanceProvider: SeedanceProviderState }) =>
  state.seedanceProvider.config.shouldUseMock;

export const selectIsProviderReady = (state: { seedanceProvider: SeedanceProviderState }) =>
  state.seedanceProvider.status.isReady;

export const selectProviderError = (state: { seedanceProvider: SeedanceProviderState }) =>
  state.seedanceProvider.status.errorMessage;

// 복합 Selector - Provider가 사용 가능한지 확인
export const selectIsProviderAvailable = (state: { seedanceProvider: SeedanceProviderState }) => {
  const { config, status, apiKey } = state.seedanceProvider;

  // Mock 모드이거나, 유효한 API 키가 있고 Ready 상태인 경우
  return (config.shouldUseMock && status.isReady) ||
         (!config.shouldUseMock && apiKey.isValid && status.isReady);
};

// 복합 Selector - Provider 상태 요약
export const selectProviderSummary = (state: { seedanceProvider: SeedanceProviderState }) => {
  const { config, status, apiKey } = state.seedanceProvider;

  return {
    mode: config.shouldUseMock ? 'mock' : 'real',
    isAvailable: selectIsProviderAvailable(state),
    hasValidKey: apiKey.isValid,
    lastError: status.errorMessage,
    retryCount: status.retryCount,
    environment: config.environment,
  };
};

// Reducer 익스포트 (기본)
export default seedanceProviderSlice;