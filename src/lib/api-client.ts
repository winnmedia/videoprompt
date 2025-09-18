import { getApiConfig, buildApiUrl, getApiTimeout } from './config/api';

// API 클라이언트 설정 (배포 환경 전용)
const apiConfig = getApiConfig();

// 공통 fetch 옵션
const createFetchOptions = (method: string, body?: any, customTimeout?: number) => {
  const timeout = customTimeout || getApiTimeout();

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(timeout),
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return options;
};

// 에러 처리 유틸리티
const handleApiError = (error: any, endpoint: string) => {
  if (error.name === 'TimeoutError') {
    return {
      ok: false,
      error: `API 요청 타임아웃 (${endpoint})`,
      message: '요청이 시간 초과되었습니다. 잠시 후 다시 시도해주세요.',
      timeout: true,
    };
  }

  if (error.name === 'AbortError') {
    return {
      ok: false,
      error: `API 요청 취소됨 (${endpoint})`,
      message: '요청이 취소되었습니다.',
      aborted: true,
    };
  }

  return {
    ok: false,
    error: `API 요청 실패 (${endpoint}): ${error.message}`,
    message: 'API 요청 중 오류가 발생했습니다.',
    details: error.message,
  };
};

// 재시도 로직을 포함한 API 요청 함수
async function apiRequestWithRetry(
  url: string,
  options: RequestInit,
  retryAttempts: number = 3,
  retryDelay: number = 2000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      const response = await fetch(url, options);

      // 성공적인 응답이면 즉시 반환
      if (response.ok) {
        return response;
      }

      // 5xx 서버 오류가 아닌 경우 재시도하지 않음
      if (response.status < 500) {
        return response;
      }

      // 마지막 시도가 아니면 재시도
      if (attempt < retryAttempts) {
        console.log(
          `API 요청 실패 (시도 ${attempt}/${retryAttempts}), ${retryDelay}ms 후 재시도...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // 마지막 시도가 아니면 재시도
      if (attempt < retryAttempts) {
        console.log(
          `API 요청 오류 (시도 ${attempt}/${retryAttempts}), ${retryDelay}ms 후 재시도...`,
          error,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }
    }
  }

  throw lastError || new Error('모든 재시도 시도 실패');
}

// API 요청 함수 (배포 환경 전용)
export const apiRequest = async <T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  customTimeout?: number,
): Promise<T> => {
  try {
    // Supabase 기반 백엔드 상태 확인
    const isBackendHealthy = await checkBackendHealth();
    if (!isBackendHealthy) {
      throw new Error('백엔드 서비스가 사용할 수 없습니다.');
    }

    const url = buildApiUrl(endpoint);
    const options = createFetchOptions(method, body, customTimeout);

    console.log(`DEBUG: API 요청 시작: ${method} ${url}`);

    const response = await apiRequestWithRetry(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;

      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      // 사용자 친화적인 에러 메시지
      let userMessage = '요청을 처리하는 중 오류가 발생했습니다.';

      if (response.status === 503) {
        userMessage = '서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
      } else if (response.status === 502) {
        userMessage = '백엔드 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
      } else if (response.status === 504) {
        userMessage = '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
      } else if (response.status >= 500) {
        userMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      } else if (response.status === 429) {
        userMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
      }

      throw new Error(`API 호출 실패: ${response.status} - ${userMessage}`);
    }

    const data = await response.json();
    console.log(`DEBUG: API 응답 성공: ${endpoint}`, { status: response.status, data });

    return data;
  } catch (error) {
    console.error(`DEBUG: API 요청 실패: ${endpoint}`, error);

    // 에러 처리 및 상세 정보 반환
    const errorResult = handleApiError(error, endpoint);
    throw errorResult;
  }
};

// 편의 함수들
export const apiGet = <T = any>(endpoint: string, timeout?: number) =>
  apiRequest<T>(endpoint, 'GET', undefined, timeout);

export const apiPost = <T = any>(endpoint: string, body: any, timeout?: number) =>
  apiRequest<T>(endpoint, 'POST', body, timeout);

export const apiPut = <T = any>(endpoint: string, body: any, timeout?: number) =>
  apiRequest<T>(endpoint, 'PUT', body, timeout);

export const apiDelete = <T = any>(endpoint: string, timeout?: number) =>
  apiRequest<T>(endpoint, 'DELETE', undefined, timeout);

// Seedance API 전용 함수들 (배포 환경 전용)
export const seedanceApi = {
  create: (payload: any) => apiPost('seedance/create', payload, 60000),
  getStatus: (jobId: string) => apiGet(`seedance/status/${jobId}`, 30000),
  getStatusDebug: (jobId: string) => apiGet(`seedance/status-debug/${jobId}`, 20000),
};

// Imagen API 전용 함수들 (배포 환경 전용)
export const imagenApi = {
  preview: (payload: any) => apiPost('imagen/preview', payload, 40000),
};

// Veo API 전용 함수들 (배포 환경 전용)
export const veoApi = {
  create: (payload: any) => apiPost('veo/create', payload, 60000),
  getStatus: (jobId: string) => apiGet(`veo/status/${jobId}`, 30000),
};

// 백엔드 상태 확인 함수
export const checkBackendHealth = async () => {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';
    const response = await fetch(`${apiBaseUrl}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        ok: true,
        status: 'healthy',
        uptime: data.uptimeSec,
        timestamp: data.timestamp,
      };
    } else {
      return {
        ok: false,
        status: 'unhealthy',
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      status: 'unreachable',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
