import { getApiConfig, buildApiUrl, getApiTimeout, checkRailwayBackend } from './config/api';

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

// API 요청 함수 (배포 환경 전용)
export const apiRequest = async <T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  customTimeout?: number
): Promise<T> => {
  try {
    // Railway 백엔드 상태 확인
    const isBackendHealthy = await checkRailwayBackend();
    if (!isBackendHealthy) {
      throw new Error('Railway 백엔드 서비스가 사용할 수 없습니다.');
    }
    
    const url = buildApiUrl(endpoint);
    const options = createFetchOptions(method, body, customTimeout);
    
    console.log(`DEBUG: API 요청 시작: ${method} ${url}`);
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText.slice(0, 200)}`);
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

// Railway 백엔드 상태 확인 함수
export const checkBackendHealth = async () => {
  try {
    const response = await fetch('https://videoprompt-production.up.railway.app/api/health', {
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        ok: true,
        status: 'healthy',
        uptime: data.uptimeSec,
        timestamp: data.timestamp
      };
    } else {
      return {
        ok: false,
        status: 'unhealthy',
        error: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    return {
      ok: false,
      status: 'unreachable',
      error: error instanceof Error ? error.message : String(error)
    };
  }
};
