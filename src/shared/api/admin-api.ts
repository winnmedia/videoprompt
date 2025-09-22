/**
 * Admin API Client
 *
 * 관리자 API 통신을 담당하는 클라이언트입니다.
 * OpenAPI 3.0 명세에 따른 타입 안전성과 에러 처리를 제공합니다.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AdminMetrics,
  AdminUser,
  AdminProject,
  AdminVideoAsset,
  ProviderStatus,
  ErrorLogSummary,
  AdminAction,
  AdminActionType,
  AuditLog,
  TableFilter,
  PaginationInfo,
  AdminApiResponse
} from '../../entities/admin';

/**
 * API 응답 에러 타입
 */
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * 관리자 API 클라이언트 클래스
 */
class AdminApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api/admin',
      timeout: 30000, // 30초 타임아웃
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 요청 인터셉터 (인증 토큰 추가)
    this.client.interceptors.request.use(
      (config) => {
        // $300 사건 방지: 중복 요청 체크
        const now = Date.now();
        const lastRequest = this.getLastRequestTime(config.url || '');

        if (now - lastRequest < 5000) { // 5초 이내 중복 요청 방지
          return Promise.reject(new Error('중복 요청 방지: 5초 후 다시 시도해주세요'));
        }

        this.setLastRequestTime(config.url || '', now);

        // 인증 토큰 추가
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // 관리자 전용 헤더 추가
        config.headers['X-Admin-Request'] = 'true';

        return config;
      },
      (error) => Promise.reject(error)
    );

    // 응답 인터셉터 (에러 처리)
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        // 에러 로깅 (PII 제외)
        this.logError(error);

        // 표준화된 에러 처리
        if (error.response?.status === 401) {
          // 인증 실패 - 로그인 페이지로 리다이렉트
          window.location.href = '/login';
          return Promise.reject(new Error('인증이 필요합니다'));
        }

        if (error.response?.status === 403) {
          return Promise.reject(new Error('관리자 권한이 필요합니다'));
        }

        if (error.response?.status === 429) {
          return Promise.reject(new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요'));
        }

        const apiError = error.response?.data;
        return Promise.reject(new Error(apiError?.message || '서버 오류가 발생했습니다'));
      }
    );
  }

  /**
   * 인증 토큰 가져오기
   */
  private getAuthToken(): string | null {
    // 실제 구현에서는 적절한 토큰 저장소에서 가져오기
    return localStorage.getItem('auth_token');
  }

  /**
   * 마지막 요청 시간 저장/조회 (중복 요청 방지)
   */
  private getLastRequestTime(url: string): number {
    const key = `last_request_${url}`;
    return parseInt(localStorage.getItem(key) || '0', 10);
  }

  private setLastRequestTime(url: string, time: number): void {
    const key = `last_request_${url}`;
    localStorage.setItem(key, time.toString());
  }

  /**
   * 에러 로깅 (PII 제외)
   */
  private logError(error: AxiosError<ApiError>): void {
    const logData = {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    };

    console.error('Admin API Error:', logData);

    // 실제 구현에서는 외부 로깅 서비스로 전송
    // 예: Sentry, DataDog, CloudWatch 등
  }

  /**
   * 대시보드 메트릭 조회
   */
  async getMetrics(): Promise<AdminApiResponse<AdminMetrics>> {
    const response = await this.client.get<AdminApiResponse<AdminMetrics>>('/metrics');
    return response.data;
  }

  /**
   * 사용자 목록 조회
   */
  async getUsers(params: {
    page?: number;
    pageSize?: number;
    filters?: TableFilter;
  }): Promise<AdminApiResponse<AdminUser[]>> {
    const response = await this.client.get<AdminApiResponse<AdminUser[]>>('/users', {
      params: this.buildQueryParams(params)
    });
    return response.data;
  }

  /**
   * 프로젝트 목록 조회
   */
  async getProjects(params: {
    page?: number;
    pageSize?: number;
    filters?: TableFilter;
  }): Promise<AdminApiResponse<AdminProject[]>> {
    const response = await this.client.get<AdminApiResponse<AdminProject[]>>('/projects', {
      params: this.buildQueryParams(params)
    });
    return response.data;
  }

  /**
   * 비디오 에셋 목록 조회
   */
  async getVideoAssets(params: {
    page?: number;
    pageSize?: number;
    filters?: TableFilter;
  }): Promise<AdminApiResponse<AdminVideoAsset[]>> {
    const response = await this.client.get<AdminApiResponse<AdminVideoAsset[]>>('/video-assets', {
      params: this.buildQueryParams(params)
    });
    return response.data;
  }

  /**
   * 제공자 상태 조회
   */
  async getProviderStatus(): Promise<AdminApiResponse<ProviderStatus[]>> {
    const response = await this.client.get<AdminApiResponse<ProviderStatus[]>>('/health/providers');
    return response.data;
  }

  /**
   * 특정 제공자 상태 조회
   */
  async getSingleProviderStatus(providerName: string): Promise<AdminApiResponse<ProviderStatus>> {
    const response = await this.client.get<AdminApiResponse<ProviderStatus>>(`/health/providers/${providerName}`);
    return response.data;
  }

  /**
   * 에러 로그 요약 조회
   */
  async getErrorLogs(params: {
    timeRange?: '1h' | '24h' | '7d' | '30d';
    limit?: number;
  } = {}): Promise<AdminApiResponse<ErrorLogSummary[]>> {
    const response = await this.client.get<AdminApiResponse<ErrorLogSummary[]>>('/logs/errors', {
      params
    });
    return response.data;
  }

  /**
   * 관리자 액션 수행
   */
  async performAction(action: {
    type: AdminActionType;
    targetId: string;
    targetType: string;
    reason?: string;
  }): Promise<AdminApiResponse<AdminAction>> {
    const response = await this.client.post<AdminApiResponse<AdminAction>>('/actions', action);
    return response.data;
  }

  /**
   * 감사 로그 조회
   */
  async getAuditLogs(params: {
    page?: number;
    pageSize?: number;
    filters?: TableFilter;
  }): Promise<AdminApiResponse<AuditLog[]>> {
    const response = await this.client.get<AdminApiResponse<AuditLog[]>>('/audit-logs', {
      params: this.buildQueryParams(params)
    });
    return response.data;
  }

  /**
   * 시스템 건강 상태 조회
   */
  async getSystemHealth(): Promise<AdminApiResponse<{
    status: 'healthy' | 'degraded' | 'down';
    services: Record<string, 'up' | 'down'>;
    latency: Record<string, number>;
    uptime: number;
  }>> {
    const response = await this.client.get('/health');
    return response.data;
  }

  /**
   * 쿼리 파라미터 빌드
   */
  private buildQueryParams(params: {
    page?: number;
    pageSize?: number;
    filters?: TableFilter;
  }): Record<string, any> {
    const queryParams: Record<string, any> = {};

    if (params.page) queryParams.page = params.page;
    if (params.pageSize) queryParams.pageSize = params.pageSize;

    if (params.filters) {
      const { dateRange, status, provider, keyword, sort } = params.filters;

      if (dateRange) {
        queryParams.startDate = dateRange.start.toISOString();
        queryParams.endDate = dateRange.end.toISOString();
      }

      if (status?.length) {
        queryParams.status = status.join(',');
      }

      if (provider?.length) {
        queryParams.provider = provider.join(',');
      }

      if (keyword) {
        queryParams.keyword = keyword;
      }

      if (sort) {
        queryParams.sortBy = sort.field;
        queryParams.sortOrder = sort.direction;
      }
    }

    return queryParams;
  }

  /**
   * 캐시 무효화
   */
  invalidateCache(endpoint?: string): void {
    if (endpoint) {
      // 특정 엔드포인트 캐시만 무효화
      const pattern = `last_request_${endpoint}`;
      Object.keys(localStorage).forEach(key => {
        if (key.includes(pattern)) {
          localStorage.removeItem(key);
        }
      });
    } else {
      // 모든 관리자 API 캐시 무효화
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('last_request_/admin')) {
          localStorage.removeItem(key);
        }
      });
    }
  }
}

// 싱글톤 인스턴스 생성
export const adminApi = new AdminApiClient();

// 타입 내보내기
export type { ApiError };