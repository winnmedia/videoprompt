/**
 * Seedance Provider 상태 관리 훅
 * Redux state와 실제 Provider 로직을 연동
 */

import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/store';
import {
  setProviderConfig,
  setApiKeyValid,
  setApiKeyInvalid,
  enableMockMode,
  setProviderReady,
  setProviderError,
  selectProviderConfig,
  selectProviderStatus,
  selectApiKeyStatus,
  selectProviderSummary,
  selectIsProviderAvailable,
} from '../store/seedance-provider-slice';
import {
  getApiKeyStatus,
  shouldUseMockProvider,
  getApiKeyFromEnv,
  isValidSeedanceApiKey,
} from '@/lib/providers/seedance-validators';

/**
 * Seedance Provider 상태 관리 훅
 */
export function useSeedanceProvider() {
  const dispatch = useAppDispatch();

  // Redux state selectors
  const config = useAppSelector(selectProviderConfig);
  const status = useAppSelector(selectProviderStatus);
  const apiKeyStatus = useAppSelector(selectApiKeyStatus);
  const summary = useAppSelector(selectProviderSummary);
  const isAvailable = useAppSelector(selectIsProviderAvailable);

  /**
   * Provider 상태 초기화 및 검증
   */
  const initializeProvider = useCallback(async () => {
    try {
      console.log('🔧 Seedance Provider 초기화 시작');

      // 1. 환경변수 및 API 키 상태 확인
      const apiKeyInfo = getApiKeyStatus();

      // 2. Redux state 업데이트
      dispatch(setProviderConfig({
        apiKeySource: apiKeyInfo.keySource as any,
        environment: apiKeyInfo.environment as any,
        mockExplicitlyEnabled: apiKeyInfo.mockExplicitlyEnabled,
        shouldUseMock: apiKeyInfo.shouldUseMock,
      }));

      // 3. API 키 검증 결과에 따른 상태 설정
      if (apiKeyInfo.hasApiKey && apiKeyInfo.isValid) {
        dispatch(setApiKeyValid({
          keyFormat: apiKeyInfo.keyFormat,
          source: apiKeyInfo.keySource as any,
        }));

        dispatch(setProviderReady());
        console.log('✅ Seedance Provider 준비 완료 (실제 API)');
      } else if (apiKeyInfo.shouldUseMock) {
        dispatch(enableMockMode({
          reason: apiKeyInfo.hasApiKey
            ? '유효하지 않은 API 키로 인한 Mock 모드 활성화'
            : 'API 키 없음으로 인한 Mock 모드 활성화'
        }));
        console.log('🎭 Seedance Provider Mock 모드 활성화');
      } else {
        // 프로덕션에서 유효하지 않은 키
        dispatch(setApiKeyInvalid({
          error: '프로덕션 환경에서 유효하지 않은 API 키',
          keyFormat: apiKeyInfo.keyFormat,
        }));

        dispatch(setProviderError({
          message: 'Seedance API 키가 설정되지 않았거나 유효하지 않습니다',
          increaseRetryCount: false,
        }));
        console.error('❌ Seedance Provider 초기화 실패');
      }

    } catch (error) {
      console.error('❌ Seedance Provider 초기화 중 오류:', error);
      dispatch(setProviderError({
        message: `초기화 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
        increaseRetryCount: false,
      }));
    }
  }, [dispatch]);

  /**
   * API 키 재검증
   */
  const validateApiKey = useCallback(async () => {
    try {
      const apiKey = getApiKeyFromEnv();

      if (!apiKey) {
        dispatch(setApiKeyInvalid({
          error: 'API 키가 설정되지 않았습니다',
          keyFormat: 'none',
        }));
        return false;
      }

      const isValid = isValidSeedanceApiKey(apiKey);

      if (isValid) {
        const keyFormat = `${apiKey.slice(0, 8)}...${apiKey.slice(-8)}`;
        const source = process.env.SEEDANCE_API_KEY ? 'SEEDANCE_API_KEY' : 'MODELARK_API_KEY';

        dispatch(setApiKeyValid({
          keyFormat,
          source: source as any,
        }));

        dispatch(setProviderReady());
        return true;
      } else {
        dispatch(setApiKeyInvalid({
          error: 'API 키 형식이 올바르지 않습니다',
          keyFormat: `${apiKey.slice(0, 8)}...invalid`,
        }));
        return false;
      }
    } catch (error) {
      dispatch(setApiKeyInvalid({
        error: `검증 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
      return false;
    }
  }, [dispatch]);

  /**
   * Mock 모드 강제 활성화
   */
  const enableMock = useCallback((reason: string = '사용자 요청') => {
    dispatch(enableMockMode({ reason }));
  }, [dispatch]);

  /**
   * Provider 재시도
   */
  const retryProvider = useCallback(async () => {
    dispatch(setProviderError({
      message: 'Provider 재연결 중...',
      increaseRetryCount: true,
    }));

    await initializeProvider();
  }, [dispatch, initializeProvider]);

  // 컴포넌트 마운트 시 자동 초기화
  useEffect(() => {
    initializeProvider();
  }, [initializeProvider]);

  return {
    // 상태
    config,
    status,
    apiKeyStatus,
    summary,
    isAvailable,

    // 액션
    initializeProvider,
    validateApiKey,
    enableMock,
    retryProvider,

    // 편의 속성
    isReady: status.isReady,
    isMockMode: config.shouldUseMock,
    hasValidKey: apiKeyStatus.isValid,
    lastError: status.errorMessage,
    retryCount: status.retryCount,
  };
}

/**
 * Seedance Provider 상태만 가져오는 경량 훅
 */
export function useSeedanceProviderStatus() {
  const summary = useAppSelector(selectProviderSummary);
  const isAvailable = useAppSelector(selectIsProviderAvailable);

  return {
    ...summary,
    isAvailable,
  };
}