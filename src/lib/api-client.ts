import { ApiResponse, ApiError, ApiRequestOptions } from '@/types/api';

class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = { ...this.defaultHeaders, ...options.headers };

    // URL 파라미터 처리
    let finalUrl = url;
    if (options.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      finalUrl = `${url}?${searchParams.toString()}`;
    }

    try {
      const response = await fetch(finalUrl, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // GET 요청
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      params,
    });
  }

  // POST 요청
  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body,
    });
  }

  // PUT 요청
  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body,
    });
  }

  // DELETE 요청
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // PATCH 요청
  async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body,
    });
  }

  // 파일 업로드
  async upload<T>(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          // Content-Type은 자동으로 설정됨
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  // 인증 헤더 설정
  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  // 인증 헤더 제거
  removeAuthToken(): void {
    delete this.defaultHeaders['Authorization'];
  }

  // 커스텀 헤더 설정
  setCustomHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  // 커스텀 헤더 제거
  removeCustomHeader(key: string): void {
    delete this.defaultHeaders[key];
  }
}

// 싱글톤 인스턴스 생성
export const apiClient = new ApiClient();

// API 엔드포인트 상수
export const API_ENDPOINTS = {
  // 인증
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
    PROFILE: '/auth/profile',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },

  // 프로젝트
  PROJECTS: {
    LIST: '/projects',
    CREATE: '/projects',
    DETAIL: (id: string) => `/projects/${id}`,
    UPDATE: (id: string) => `/projects/${id}`,
    DELETE: (id: string) => `/projects/${id}`,
    DUPLICATE: (id: string) => `/projects/${id}/duplicate`,
    EXPORT: (id: string) => `/projects/${id}/export`,
  },

  // 장면
  SCENES: {
    GENERATE: '/scenes/generate',
    ENHANCE: '/scenes/enhance',
    DETAIL: (id: string) => `/scenes/${id}`,
    UPDATE: (id: string) => `/scenes/${id}`,
    DELETE: (id: string) => `/scenes/${id}`,
    DUPLICATE: (id: string) => `/scenes/${id}/duplicate`,
  },

  // 프롬프트
  PROMPTS: {
    LIST: '/prompts',
    CREATE: '/prompts',
    DETAIL: (id: string) => `/prompts/${id}`,
    UPDATE: (id: string) => `/prompts/${id}`,
    DELETE: (id: string) => `/prompts/${id}`,
    FAVORITE: (id: string) => `/prompts/${id}/favorite`,
    FAVORITES: '/prompts/favorites',
  },

  // 프리셋
  PRESETS: {
    LIST: '/presets',
    CREATE: '/presets',
    DETAIL: (id: string) => `/presets/${id}`,
    UPDATE: (id: string) => `/presets/${id}`,
    DELETE: (id: string) => `/presets/${id}`,
    DUPLICATE: (id: string) => `/presets/${id}/duplicate`,
    CATEGORIES: '/presets/categories',
  },

  // 타임라인
  TIMELINES: {
    DETAIL: (id: string) => `/timelines/${id}`,
    UPDATE: (id: string) => `/timelines/${id}`,
    ADD_BEAD: (id: string) => `/timelines/${id}/beads`,
    UPDATE_BEAD: (timelineId: string, beadId: string) => `/timelines/${timelineId}/beads/${beadId}`,
    DELETE_BEAD: (timelineId: string, beadId: string) => `/timelines/${timelineId}/beads/${beadId}`,
    REORDER_BEADS: (id: string) => `/timelines/${id}/beads/reorder`,
  },

  // 추천
  RECOMMEND: {
    SCENES: '/recommend/scenes',
    PROMPTS: '/recommend/prompts',
    THEMES: '/recommend/themes',
    TRENDING: '/recommend/trending',
    PERSONALIZED: '/recommend/personalized',
  },

  // 파일 업로드
  UPLOAD: {
    IMAGE: '/upload/image',
    VIDEO: '/upload/video',
    AUDIO: '/upload/audio',
    DELETE: (id: string) => `/upload/${id}`,
    INFO: (id: string) => `/upload/${id}`,
  },

  // 설정
  SETTINGS: {
    GET: '/settings',
    UPDATE: '/settings',
    PREFERENCES: '/settings/preferences',
    UPDATE_PREFERENCES: '/settings/preferences',
  },

  // 분석
  ANALYTICS: {
    USAGE: '/analytics/usage',
    PROJECTS: '/analytics/projects',
    SCENES: '/analytics/scenes',
    PERFORMANCE: '/analytics/performance',
  },

  // 관리자
  ADMIN: {
    USERS: '/admin/users',
    UPDATE_USER: (id: string) => `/admin/users/${id}`,
    ANALYTICS: '/admin/analytics',
    SYSTEM: '/admin/system',
    MAINTENANCE: '/admin/maintenance',
  },

  // 웹훅
  WEBHOOKS: {
    AI_COMPLETION: '/webhooks/ai-completion',
  },

  // 알림
  NOTIFICATIONS: {
    CREATE: '/notifications',
    LIST: '/notifications',
    MARK_READ: (id: string) => `/notifications/${id}/read`,
  },
} as const;

// API 응답 헬퍼 함수들
export const apiHelpers = {
  // 성공 응답 확인
  isSuccess: <T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true } => {
    return response.success === true;
  },

  // 에러 응답 확인
  isError: <T>(response: ApiResponse<T>): response is ApiResponse<T> & { error: string } => {
    return response.success === false || !!response.error;
  },

  // 데이터 추출 (성공 시에만)
  extractData: <T>(response: ApiResponse<T>): T | undefined => {
    return apiHelpers.isSuccess(response) ? response.data : undefined;
  },

  // 에러 메시지 추출
  extractError: <T>(response: ApiResponse<T>): string => {
    return response.error || response.message || 'Unknown error occurred';
  },
};

export default apiClient;
