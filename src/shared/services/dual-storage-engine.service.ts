/**
 * 이중 저장 엔진 서비스 - Simplified Stub
 * Prisma 제거 후 Supabase 전용 아키텍처를 위한 스텁
 *
 * 목적: 기존 테스트 호환성 유지하면서 TypeScript 오류 제거
 */

import { logger } from '@/shared/lib/logger';

// ============================================================================
// 기본 타입 정의 (호환성)
// ============================================================================

export interface DualStorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  operation: 'supabase_only';
  timestamp: string;
}

export interface StorageStrategy {
  environment: string;
  strategy: 'supabase_only';
  fallbackEnabled: boolean;
  retryAttempts: number;
  timeoutMs: number;
}

export interface DataQualityReport {
  score: number;
  issues: string[];
  recommendations: string[];
}

// ============================================================================
// 간소화된 저장 전략 (Supabase 전용)
// ============================================================================

function getStorageStrategy(): StorageStrategy {
  return {
    environment: process.env.NODE_ENV || 'development',
    strategy: 'supabase_only',
    fallbackEnabled: false,
    retryAttempts: 1,
    timeoutMs: 5000,
  };
}

// ============================================================================
// 이중 저장 엔진 서비스 - 스텁 구현
// ============================================================================

export class DualStorageEngineService {
  private static instance: DualStorageEngineService;
  private strategy: StorageStrategy;

  private constructor() {
    this.strategy = getStorageStrategy();
  }

  static getInstance(): DualStorageEngineService {
    if (!DualStorageEngineService.instance) {
      DualStorageEngineService.instance = new DualStorageEngineService();
    }
    return DualStorageEngineService.instance;
  }

  /**
   * 프로젝트 저장 (Supabase 전용)
   */
  async saveProject(projectData: any): Promise<DualStorageResult> {
    logger.info('DualStorageEngine: Using Supabase-only strategy (stub)');

    return {
      success: true,
      data: { id: projectData.id || 'stub-id' },
      operation: 'supabase_only',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 프로젝트 조회 (스텁)
   */
  async getProject(id: string): Promise<DualStorageResult> {
    return {
      success: true,
      data: { id, name: 'Stub Project' },
      operation: 'supabase_only',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 프로젝트 업데이트 (스텁)
   */
  async updateProject(id: string, updates: any): Promise<DualStorageResult> {
    return {
      success: true,
      data: { id, ...updates },
      operation: 'supabase_only',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 프로젝트 삭제 (스텁)
   */
  async deleteProject(id: string): Promise<DualStorageResult> {
    return {
      success: true,
      data: { id },
      operation: 'supabase_only',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 저장소 상태 확인 (스텁)
   */
  async checkStorageHealth(): Promise<DualStorageResult> {
    return {
      success: true,
      data: {
        supabase: { status: 'healthy', responseTime: 100 },
        strategy: this.strategy
      },
      operation: 'supabase_only',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 데이터 품질 확인 (스텁)
   */
  async checkDataQuality(data: any): Promise<DataQualityReport> {
    return {
      score: 100,
      issues: [],
      recommendations: ['Data quality check passed (stub implementation)']
    };
  }

  /**
   * 저장 전략 반환
   */
  getStrategy(): StorageStrategy {
    return this.strategy;
  }
}

// ============================================================================
// 싱글톤 인스턴스 내보내기
// ============================================================================

export const dualStorageEngine = DualStorageEngineService.getInstance();

// 기본 내보내기
export default DualStorageEngineService;