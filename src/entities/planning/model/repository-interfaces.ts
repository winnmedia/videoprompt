/**
 * 🗄️ Planning Repository Interfaces
 * Clean Architecture - Domain Layer (Pure)
 *
 * 핵심 원칙:
 * - 도메인 순수성: 인프라 의존성 없음
 * - Dependency Inversion: 구현체는 외부에서 주입
 * - FSD 경계 준수: entities 레이어에서 순수 인터페이스만
 */

import { BaseContent, ScenarioContent, PromptContent, VideoContent, PlanningMetadata } from './types';

// ============================================================================
// Storage Health Types
// ============================================================================

/**
 * 개별 스토리지 상태
 */
export interface StorageStatus {
  status: 'healthy' | 'unhealthy';
  latency?: number;
}

/**
 * 전체 스토리지 헬스 체크 결과
 */
export interface StorageHealth {
  prisma: StorageStatus;
  supabase: StorageStatus;
}

// ============================================================================
// Repository Interfaces (Pure Domain)
// ============================================================================

/**
 * 기본 Planning Repository 인터페이스
 */
export interface PlanningRepository {
  readonly name: string;
  save(content: BaseContent): Promise<{ id: string; success: boolean; error?: string }>;
  findById(id: string): Promise<BaseContent | null>;
  findByUserId(userId: string): Promise<BaseContent[]>;
  update(id: string, content: Partial<BaseContent>): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  getStorageHealth(): Promise<StorageHealth>;
}

/**
 * Supabase Repository 전용 인터페이스
 */
export interface SupabaseRepository extends PlanningRepository {
  readonly name: 'supabase';
}

/**
 * 듀얼 스토리지 결과 타입
 */
export interface DualStorageResult {
  id: string;
  success: boolean;
  primarySuccess: boolean;
  fallbackSuccess: boolean;
  primaryError?: string;
  fallbackError?: string;
  source: 'primary' | 'fallback' | 'both';
}

/**
 * 듀얼 스토리지 Repository 인터페이스
 */
export interface DualStorageRepository {
  readonly name: 'dual-storage';
  save(content: BaseContent): Promise<DualStorageResult>;
  findById(id: string): Promise<BaseContent | null>;
  findByUserId(userId: string): Promise<BaseContent[]>;
  update(id: string, content: Partial<BaseContent>): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  getStorageHealth(): Promise<StorageHealth>;
}

// ============================================================================
// Repository Factory Interface
// ============================================================================

/**
 * Repository 생성 팩토리 인터페이스
 */
export interface RepositoryFactory {
  createSupabaseRepository(): SupabaseRepository;
  createDualStorageRepository(
    primary: PlanningRepository,
    fallback: PlanningRepository
  ): DualStorageRepository;
}