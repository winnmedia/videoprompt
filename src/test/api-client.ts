/**
 * 실제 프로덕션 API 테스트를 위한 HTTP 클라이언트
 * Mock 대신 실제 네트워크 요청을 수행하여 프로덕션 오류를 탐지
 */

interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  headers?: Record<string, string>;
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(baseUrl: string, options: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      timeout: options.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
  }

  /**
   * HTTP GET 요청
   */
  async get<T = any>(
    endpoint: string,
    options: { params?: Record<string, string>; headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers = { ...this.config.headers, ...options.headers };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        data = { error: 'Invalid JSON response' };
      }
      
      return {
        ok: response.ok,
        data: response.ok ? data : undefined,
        message: !response.ok ? (data?.message || `HTTP ${response.status}`) : undefined,
        error: !response.ok ? (data?.error || data?.message) : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.config.timeout}ms`);
        }
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * HTTP POST 요청
   */
  async post<T = any>(
    endpoint: string,
    body?: any,
    options: { headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = { ...this.config.headers, ...options.headers };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        data = { error: 'Invalid JSON response' };
      }
      
      return {
        ok: response.ok,
        data: response.ok ? data : undefined,
        message: !response.ok ? (data?.message || `HTTP ${response.status}`) : undefined,
        error: !response.ok ? (data?.error || data?.message) : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.config.timeout}ms`);
        }
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * HTTP PUT 요청
   */
  async put<T = any>(
    endpoint: string,
    body?: any,
    options: { headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = { ...this.config.headers, ...options.headers };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        data = { error: 'Invalid JSON response' };
      }
      
      return {
        ok: response.ok,
        data: response.ok ? data : undefined,
        message: !response.ok ? (data?.message || `HTTP ${response.status}`) : undefined,
        error: !response.ok ? (data?.error || data?.message) : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.config.timeout}ms`);
        }
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * HTTP DELETE 요청
   */
  async delete<T = any>(
    endpoint: string,
    options: { headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = { ...this.config.headers, ...options.headers };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        data = { error: 'Invalid JSON response' };
      }
      
      return {
        ok: response.ok,
        data: response.ok ? data : undefined,
        message: !response.ok ? (data?.message || `HTTP ${response.status}`) : undefined,
        error: !response.ok ? (data?.error || data?.message) : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.config.timeout}ms`);
        }
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Health Check - 서버 상태 확인
   */
  async healthCheck(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const response = await this.get('/api/health');
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: response.ok,
        responseTime,
        error: !response.ok ? response.message || response.error : undefined,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 인증 토큰 설정
   */
  setAuthToken(token: string): void {
    this.config.headers = {
      ...this.config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * 인증 토큰 제거
   */
  clearAuthToken(): void {
    const { Authorization, ...headers } = this.config.headers || {};
    this.config.headers = headers;
  }

  /**
   * 쿠키 설정
   */
  setCookie(cookie: string): void {
    this.config.headers = {
      ...this.config.headers,
      Cookie: cookie,
    };
  }

  /**
   * 베이스 URL 변경 (다중 환경 테스트용)
   */
  setBaseUrl(baseUrl: string): void {
    this.config.baseUrl = baseUrl.replace(/\/$/, '');
  }
}

// 테스트용 API 클라이언트 인스턴스들
export const localApiClient = new ApiClient('http://localhost:3001', {
  timeout: 30000,
});

export const productionApiClient = new ApiClient('https://www.vridge.kr', {
  timeout: 30000,
});

// 환경별 클라이언트 선택 헬퍼
export function getApiClient(environment: 'local' | 'production' = 'local'): ApiClient {
  return environment === 'production' ? productionApiClient : localApiClient;
}