/**
 * Generic API Client Implementation
 * Axios 기반 범용 HTTP 클라이언트
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// 요청 데이터 타입
export type RequestData =
  | Record<string, unknown>
  | FormData
  | string
  | number
  | boolean
  | null;

// API 응답 타입 정의
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  status: number;
}

// API 에러 타입 정의
export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// 요청 설정 타입
export interface RequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  timeout?: number;
}

class ApiClient {
  private instance: AxiosInstance;
  private authToken: string | null = null;

  constructor(baseURL?: string) {
    this.instance = axios.create({
      baseURL: baseURL || '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // 요청 인터셉터: 인증 토큰 자동 추가
    this.instance.interceptors.request.use(
      (config) => {
        if (this.authToken && !config.headers['skipAuth']) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터: 에러 처리 및 데이터 정규화
    this.instance.interceptors.response.use(
      (response: AxiosResponse): AxiosResponse<ApiResponse> => {
        return {
          ...response,
          data: {
            data: response.data,
            status: response.status,
            message: response.data?.message,
          },
        };
      },
      (error) => {
        const apiError: ApiError = {
          message:
            error.response?.data?.message ||
            error.message ||
            '알 수 없는 오류가 발생했습니다',
          status: error.response?.status || 500,
          code: error.response?.data?.code || error.code,
        };

        // 401 에러 시 인증 토큰 초기화
        if (apiError.status === 401) {
          this.clearAuth();
        }

        return Promise.reject(apiError);
      }
    );
  }

  // 인증 토큰 설정
  setAuthToken(token: string) {
    this.authToken = token;
  }

  // 인증 토큰 제거
  clearAuth() {
    this.authToken = null;
  }

  // GET 요청
  async get<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  // POST 요청
  async post<T = unknown>(
    url: string,
    data?: RequestData,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.post<ApiResponse<T>>(
      url,
      data,
      config
    );
    return response.data;
  }

  // PUT 요청
  async put<T = unknown>(
    url: string,
    data?: RequestData,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  // PATCH 요청
  async patch<T = unknown>(
    url: string,
    data?: RequestData,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.patch<ApiResponse<T>>(
      url,
      data,
      config
    );
    return response.data;
  }

  // DELETE 요청
  async delete<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.delete<ApiResponse<T>>(url, config);
    return response.data;
  }

  // 파일 업로드
  async uploadFile<T = unknown>(
    url: string,
    file: File,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.instance.post<ApiResponse<T>>(url, formData, {
      ...config,
      headers: {
        ...config?.headers,
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  // 요청 취소를 위한 AbortController 생성
  createAbortController(): AbortController {
    return new AbortController();
  }

  // 헬스 체크
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// 싱글톤 인스턴스 생성
let apiClientInstance: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient();
  }
  return apiClientInstance;
}

// 새 인스턴스 생성 (테스트용)
export function createApiClient(baseURL?: string): ApiClient {
  return new ApiClient(baseURL);
}

// 편의 함수들
export const api = {
  get: <T = unknown>(url: string, config?: RequestConfig) =>
    getApiClient().get<T>(url, config),
  post: <T = unknown>(
    url: string,
    data?: RequestData,
    config?: RequestConfig
  ) => getApiClient().post<T>(url, data, config),
  put: <T = unknown>(url: string, data?: RequestData, config?: RequestConfig) =>
    getApiClient().put<T>(url, data, config),
  patch: <T = unknown>(
    url: string,
    data?: RequestData,
    config?: RequestConfig
  ) => getApiClient().patch<T>(url, data, config),
  delete: <T = unknown>(url: string, config?: RequestConfig) =>
    getApiClient().delete<T>(url, config),
  uploadFile: <T = unknown>(url: string, file: File, config?: RequestConfig) =>
    getApiClient().uploadFile<T>(url, file, config),
  setAuth: (token: string) => getApiClient().setAuthToken(token),
  clearAuth: () => getApiClient().clearAuth(),
  healthCheck: () => getApiClient().healthCheck(),
};
