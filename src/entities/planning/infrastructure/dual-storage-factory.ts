/**
 * Dual Storage Factory
 * FSD Architecture - Infrastructure Layer
 *
 * 목적: 듀얼 스토리지 시스템의 의존성 조합 및 설정 관리
 * 패턴: Abstract Factory + Dependency Injection
 */

// Prisma 완전 제거 (2025-09-21) - Supabase 전용으로 전환
// import { PrismaClient } from '@prisma/client';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import { SupabaseClient } from '@supabase/supabase-js';
import type { DualStorageDependencies } from '../model/services';
import type { DualStorageConfig } from '../model/types';
// import { createPrismaRepository } from './prisma-repository'; // Prisma 제거
import { createSupabaseRepository } from './supabase-repository';
import { getEnvironmentCapabilities, getDegradationMode } from '@/shared/config/env';
import { logger } from '@/shared/lib/logger';


interface StorageClients {
  supabase?: SupabaseClient;
}

/**
 * 듀얼 스토리지 시스템 Factory
 */
export class DualStorageFactory {
  private static instance: DualStorageFactory;
  private config: DualStorageConfig;

  private constructor() {
    // 환경 기반 설정 자동 결정
    this.config = this.createConfigFromEnvironment();
  }

  static getInstance(): DualStorageFactory {
    if (!DualStorageFactory.instance) {
      DualStorageFactory.instance = new DualStorageFactory();
    }
    return DualStorageFactory.instance;
  }

  /**
   * 환경 변수를 기반으로 듀얼 스토리지 설정 생성
   */
  private createConfigFromEnvironment(): DualStorageConfig {
    const capabilities = getEnvironmentCapabilities();
    const degradationMode = getDegradationMode();

    logger.info('🔧 듀얼 스토리지 설정 생성:', {
      degradationMode,
      capabilities: {
        supabaseAuth: capabilities.supabaseAuth,
        database: capabilities.database,
        fullAdmin: capabilities.fullAdmin
      }
    });

    switch (degradationMode) {
      case 'full':
        // 모든 기능 활성화
        return {
          prismaEnabled: false, // Prisma 완전 제거
          supabaseEnabled: capabilities.supabaseAuth,
          requireBoth: false, // Supabase 전용
          fallbackToPrisma: false
        };

      case 'degraded':
        // 부분 기능으로 동작
        return {
          prismaEnabled: false, // Prisma 완전 제거
          supabaseEnabled: capabilities.supabaseAuth,
          requireBoth: false, // Supabase 전용
          fallbackToPrisma: false
        };

      case 'disabled':
      default:
        // 최소한의 기능만
        return {
          prismaEnabled: false, // Prisma 완전 제거
          supabaseEnabled: capabilities.supabaseAuth,
          requireBoth: false,
          fallbackToPrisma: false
        };
    }
  }

  /**
   * 듀얼 스토리지 의존성 생성
   */
  createDependencies(clients: StorageClients): DualStorageDependencies {
    const { supabase } = clients;

    // 설정 검증 (Supabase 전용)
    if (this.config.supabaseEnabled && !supabase) {
      console.warn('⚠️ Supabase client is required but not provided, falling back to Prisma only');
      this.config = {
        ...this.config,
        supabaseEnabled: false,
        requireBoth: false
      };
    }

    // Repository 생성 (Supabase 전용)
    // const prismaRepo = prisma ? createPrismaRepository(prisma) : null; // Prisma 제거
    const supabaseRepo = supabase ? createSupabaseRepository(supabase) : null;

    if (!supabaseRepo) {
      throw new Error('Supabase storage client must be provided');
    }

    logger.info('🏗️ Supabase 스토리지 의존성 생성 완료:', {
      supabaseEnabled: !!supabaseRepo,
      config: this.config
    });

    return {
      supabase: supabaseRepo!,
      config: this.config
    } as DualStorageDependencies;
  }

  /**
   * 현재 설정 조회
   */
  getConfig(): DualStorageConfig {
    return { ...this.config };
  }

  /**
   * 설정 업데이트 (런타임)
   */
  updateConfig(newConfig: Partial<DualStorageConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };

    logger.info('🔄 듀얼 스토리지 설정 업데이트:', this.config);
  }

  /**
   * 헬스 체크
   */
  async healthCheck(clients: StorageClients): Promise<{
    prisma: { available: boolean; error?: string };
    supabase: { available: boolean; error?: string };
    overall: 'healthy' | 'degraded' | 'critical';
  }> {
    const result = {
      prisma: { available: false, error: undefined as string | undefined },
      supabase: { available: false, error: undefined as string | undefined },
      overall: 'critical' as 'healthy' | 'degraded' | 'critical'
    };

    // Prisma 완전 제거됨

    // Supabase 헬스 체크
    if (clients.supabase && this.config.supabaseEnabled) {
      try {
        const { error } = await clients.supabase
          .from('scenarios')
          .select('id')
          .limit(1);

        if (!error) {
          result.supabase.available = true;
        } else {
          result.supabase.error = error.message;
        }
      } catch (error) {
        result.supabase.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // 전체 상태 판단 (Supabase 전용)
    const availableCount = result.supabase.available ? 1 : 0;
    const enabledCount = this.config.supabaseEnabled ? 1 : 0;

    if (availableCount === enabledCount && availableCount > 0) {
      result.overall = 'healthy';
    } else if (availableCount > 0) {
      result.overall = 'degraded';
    } else {
      result.overall = 'critical';
    }

    logger.info('🩺 듀얼 스토리지 헬스 체크:', result);
    return result;
  }
}

/**
 * 전역 Factory 인스턴스 접근 헬퍼
 */
export function getDualStorageFactory(): DualStorageFactory {
  return DualStorageFactory.getInstance();
}

/**
 * 간편한 의존성 생성 헬퍼
 */
export function createDualStorageDependencies(clients: StorageClients): DualStorageDependencies {
  const factory = getDualStorageFactory();
  return factory.createDependencies(clients);
}