/**
 * Provider Status Slice - Redux Toolkit
 * CLAUDE.md 준수: Redux Toolkit 2.0, 타입 안전성
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ProviderStatus {
  id: string;
  name: string;
  type: 'ai' | 'storage' | 'payment' | 'analytics';
  status: 'healthy' | 'degraded' | 'down';
  lastChecked: string;
  responseTime?: number;
  errorRate?: number;
  uptime?: number;
  metadata?: Record<string, any>;
}

export interface ProviderStatusState {
  providers: ProviderStatus[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: ProviderStatusState = {
  providers: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

export const providerStatusSlice = createSlice({
  name: 'providerStatus',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setProviders: (state, action: PayloadAction<ProviderStatus[]>) => {
      state.providers = action.payload;
      state.lastUpdated = new Date().toISOString();
      state.error = null;
    },
    updateProvider: (state, action: PayloadAction<ProviderStatus>) => {
      const index = state.providers.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.providers[index] = action.payload;
      } else {
        state.providers.push(action.payload);
      }
      state.lastUpdated = new Date().toISOString();
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setLoading,
  setProviders,
  updateProvider,
  setError,
  clearError,
} = providerStatusSlice.actions;

// Selectors
export const selectProviders = (state: { providerStatus: ProviderStatusState }) =>
  state.providerStatus.providers;

export const selectProviderStatusLoading = (state: { providerStatus: ProviderStatusState }) =>
  state.providerStatus.loading;

export const selectProviderStatusError = (state: { providerStatus: ProviderStatusState }) =>
  state.providerStatus.error;

export const selectProviderByType = (type: ProviderStatus['type']) =>
  (state: { providerStatus: ProviderStatusState }) =>
    state.providerStatus.providers.filter(p => p.type === type);

export const selectHealthyProviders = (state: { providerStatus: ProviderStatusState }) =>
  state.providerStatus.providers.filter(p => p.status === 'healthy');

export const selectSystemHealth = (state: { providerStatus: ProviderStatusState }) => {
  const providers = state.providerStatus.providers;
  const total = providers.length;
  const healthy = providers.filter(p => p.status === 'healthy').length;
  const degraded = providers.filter(p => p.status === 'degraded').length;
  const down = providers.filter(p => p.status === 'down').length;

  let status: 'healthy' | 'degraded' | 'down' = 'healthy';
  if (down > 0 || degraded > total / 2) {
    status = 'down';
  } else if (degraded > 0) {
    status = 'degraded';
  }

  return {
    status,
    totalCount: total,
    healthyCount: healthy,
    degradedCount: degraded,
    downCount: down,
    lastUpdated: state.providerStatus.lastUpdated,
  };
};

export default providerStatusSlice.reducer;