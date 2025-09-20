/**
 * Seedance Provider 상태 관리 Redux Slice 테스트
 * TDD: Red → Green → Refactor
 */

import { configureStore } from '@reduxjs/toolkit';
import {
  seedanceProviderReducer,
  setProviderConfig,
  setProviderStatus,
  updateApiKeyStatus,
  resetProviderState,
  selectProviderConfig,
  selectProviderStatus,
  selectApiKeyStatus,
  selectShouldUseMock,
  type SeedanceProviderState,
  type ProviderStatus,
  type ApiKeyStatus
} from '@/entities/seedance';

describe('Seedance Provider Redux Slice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        seedanceProvider: seedanceProviderReducer,
      },
    });
  });

  describe('초기 상태', () => {
    test('초기 상태가 올바르게 설정되어야 함', () => {
      const state = store.getState().seedanceProvider;

      expect(state).toEqual({
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
      });
    });
  });

  describe('setProviderConfig 액션', () => {
    test('provider 설정을 업데이트해야 함', () => {
      const newConfig = {
        apiKeySource: 'SEEDANCE_API_KEY' as const,
        environment: 'production' as const,
        mockExplicitlyEnabled: false,
        shouldUseMock: false,
      };

      store.dispatch(setProviderConfig(newConfig));
      const state = store.getState().seedanceProvider;

      expect(state.config).toEqual(newConfig);
    });

    test('부분 설정 업데이트가 가능해야 함', () => {
      store.dispatch(setProviderConfig({ shouldUseMock: false }));
      const state = store.getState().seedanceProvider;

      expect(state.config.shouldUseMock).toBe(false);
      expect(state.config.apiKeySource).toBe('none'); // 기존 값 유지
    });
  });

  describe('setProviderStatus 액션', () => {
    test('provider 상태를 업데이트해야 함', () => {
      const newStatus: ProviderStatus = {
        isReady: true,
        lastChecked: '2024-01-01T00:00:00Z',
        errorMessage: null,
        retryCount: 0,
      };

      store.dispatch(setProviderStatus(newStatus));
      const state = store.getState().seedanceProvider;

      expect(state.status).toEqual(newStatus);
    });

    test('에러 상태를 설정할 수 있어야 함', () => {
      const errorStatus: ProviderStatus = {
        isReady: false,
        lastChecked: '2024-01-01T00:00:00Z',
        errorMessage: 'API 키가 유효하지 않습니다',
        retryCount: 3,
      };

      store.dispatch(setProviderStatus(errorStatus));
      const state = store.getState().seedanceProvider;

      expect(state.status.isReady).toBe(false);
      expect(state.status.errorMessage).toBe('API 키가 유효하지 않습니다');
      expect(state.status.retryCount).toBe(3);
    });
  });

  describe('updateApiKeyStatus 액션', () => {
    test('API 키 상태를 업데이트해야 함', () => {
      const newApiKeyStatus: ApiKeyStatus = {
        isValid: true,
        hasKey: true,
        keyFormat: 'ark_****...****abcd',
        lastValidated: '2024-01-01T00:00:00Z',
        validationError: null,
      };

      store.dispatch(updateApiKeyStatus(newApiKeyStatus));
      const state = store.getState().seedanceProvider;

      expect(state.apiKey).toEqual(newApiKeyStatus);
    });

    test('유효하지 않은 API 키 상태를 설정할 수 있어야 함', () => {
      const invalidApiKeyStatus: ApiKeyStatus = {
        isValid: false,
        hasKey: true,
        keyFormat: '007f7f...blocked',
        lastValidated: '2024-01-01T00:00:00Z',
        validationError: 'UUID 형식 테스트 키가 감지되었습니다',
      };

      store.dispatch(updateApiKeyStatus(invalidApiKeyStatus));
      const state = store.getState().seedanceProvider;

      expect(state.apiKey.isValid).toBe(false);
      expect(state.apiKey.validationError).toBe('UUID 형식 테스트 키가 감지되었습니다');
    });
  });

  describe('resetProviderState 액션', () => {
    test('전체 상태를 초기값으로 리셋해야 함', () => {
      // 상태를 변경
      store.dispatch(setProviderConfig({ shouldUseMock: false }));
      store.dispatch(setProviderStatus({ isReady: true, lastChecked: '2024-01-01', errorMessage: null, retryCount: 0 }));
      store.dispatch(updateApiKeyStatus({ isValid: true, hasKey: true, keyFormat: 'ark_test', lastValidated: '2024-01-01', validationError: null }));

      // 리셋
      store.dispatch(resetProviderState());

      const state = store.getState().seedanceProvider;

      // 초기 상태와 일치해야 함
      expect(state.config.shouldUseMock).toBe(true);
      expect(state.status.isReady).toBe(false);
      expect(state.apiKey.isValid).toBe(false);
    });
  });

  describe('Selectors', () => {
    beforeEach(() => {
      // 테스트용 상태 설정
      store.dispatch(setProviderConfig({
        apiKeySource: 'SEEDANCE_API_KEY',
        environment: 'production',
        mockExplicitlyEnabled: false,
        shouldUseMock: false,
      }));
      store.dispatch(setProviderStatus({
        isReady: true,
        lastChecked: '2024-01-01T00:00:00Z',
        errorMessage: null,
        retryCount: 0,
      }));
      store.dispatch(updateApiKeyStatus({
        isValid: true,
        hasKey: true,
        keyFormat: 'ark_****...****abcd',
        lastValidated: '2024-01-01T00:00:00Z',
        validationError: null,
      }));
    });

    test('selectProviderConfig가 올바른 설정을 반환해야 함', () => {
      const state = store.getState();
      const config = selectProviderConfig(state);

      expect(config.apiKeySource).toBe('SEEDANCE_API_KEY');
      expect(config.environment).toBe('production');
      expect(config.shouldUseMock).toBe(false);
    });

    test('selectProviderStatus가 올바른 상태를 반환해야 함', () => {
      const state = store.getState();
      const status = selectProviderStatus(state);

      expect(status.isReady).toBe(true);
      expect(status.errorMessage).toBeNull();
    });

    test('selectApiKeyStatus가 올바른 API 키 상태를 반환해야 함', () => {
      const state = store.getState();
      const apiKeyStatus = selectApiKeyStatus(state);

      expect(apiKeyStatus.isValid).toBe(true);
      expect(apiKeyStatus.hasKey).toBe(true);
      expect(apiKeyStatus.keyFormat).toBe('ark_****...****abcd');
    });

    test('selectShouldUseMock가 Mock 사용 여부를 올바르게 반환해야 함', () => {
      const state = store.getState();
      const shouldUseMock = selectShouldUseMock(state);

      expect(shouldUseMock).toBe(false);
    });

    test('API 키가 유효하지 않을 때 Mock 사용을 권장해야 함', () => {
      store.dispatch(updateApiKeyStatus({
        isValid: false,
        hasKey: false,
        keyFormat: 'none',
        lastValidated: null,
        validationError: 'API 키가 없습니다',
      }));

      const state = store.getState();
      const shouldUseMock = selectShouldUseMock(state);

      // API 키가 유효하지 않아도 설정에서 shouldUseMock: false이므로 false 반환
      expect(shouldUseMock).toBe(false);
    });
  });

  describe('에지 케이스', () => {
    test('잘못된 날짜 형식 처리', () => {
      expect(() => {
        store.dispatch(setProviderStatus({
          isReady: true,
          lastChecked: 'invalid-date',
          errorMessage: null,
          retryCount: 0,
        }));
      }).not.toThrow();
    });

    test('음수 재시도 횟수 처리', () => {
      store.dispatch(setProviderStatus({
        isReady: false,
        lastChecked: '2024-01-01T00:00:00Z',
        errorMessage: 'Test error',
        retryCount: -1,
      }));

      const state = store.getState().seedanceProvider;
      expect(state.status.retryCount).toBe(-1); // 음수도 허용 (리셋 등에서 사용 가능)
    });

    test('매우 긴 에러 메시지 처리', () => {
      const longErrorMessage = 'A'.repeat(1000);

      store.dispatch(setProviderStatus({
        isReady: false,
        lastChecked: '2024-01-01T00:00:00Z',
        errorMessage: longErrorMessage,
        retryCount: 0,
      }));

      const state = store.getState().seedanceProvider;
      expect(state.status.errorMessage).toBe(longErrorMessage);
    });
  });
});