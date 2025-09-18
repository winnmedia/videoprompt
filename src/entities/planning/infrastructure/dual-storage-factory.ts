/**
 * Dual Storage Factory
 * FSD Architecture - Infrastructure Layer
 *
 * 목적: 듀얼 스토리지 시스템의 의존성 조합 및 설정 관리
 * 패턴: Abstract Factory + Dependency Injection
 */

import { PrismaClient } from '@prisma/client';
import { SupabaseClient } from '@supabase/supabase-js';
import type { DualStorageDependencies, DualStorageConfig } from '../model/services';
import { createPrismaRepository } from './prisma-repository';
import { createSupabaseRepository } from './supabase-repository';
import { getEnvironmentCapabilities, getDegradationMode } from '@/shared/config/env';

interface StorageClients {
  prisma?: PrismaClient;
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

    console.log('🔧 듀얼 스토리지 설정 생성:', {
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
          prismaEnabled: capabilities.database,
          supabaseEnabled: capabilities.supabaseAuth,
          requireBoth: true, // 완전 일관성 요구
          fallbackToPrisma: true
        };

      case 'degraded':
        // 부분 기능으로 동작
        return {
          prismaEnabled: capabilities.database,
          supabaseEnabled: capabilities.supabaseAuth,
          requireBoth: false, // 부분 성공 허용
          fallbackToPrisma: capabilities.database
        };

      case 'disabled':
      default:
        // 최소한의 기능만
        return {
          prismaEnabled: capabilities.database,
          supabaseEnabled: false,
          requireBoth: false,
          fallbackToPrisma: true
        };
    }
  }

  /**
   * 듀얼 스토리지 의존성 생성
   */
  createDependencies(clients: StorageClients): DualStorageDependencies {
    const { prisma, supabase } = clients;

    // 설정 검증
    if (this.config.prismaEnabled && !prisma) {
      throw new Error('Prisma client is required but not provided');
    }

    if (this.config.supabaseEnabled && !supabase) {
      console.warn('⚠️ Supabase client is required but not provided, falling back to Prisma only');
      this.config = {
        ...this.config,
        supabaseEnabled: false,
        requireBoth: false
      };
    }

    // Repository 생성
    const prismaRepo = prisma ? createPrismaRepository(prisma) : null;
    const supabaseRepo = supabase ? createSupabaseRepository(supabase) : null;

    if (!prismaRepo && !supabaseRepo) {
      throw new Error('At least one storage client must be provided');
    }

    console.log('🏗️ 듀얼 스토리지 의존성 생성 완료:', {
      prismaEnabled: !!prismaRepo,
      supabaseEnabled: !!supabaseRepo,
      config: this.config
    });

    return {
      prisma: prismaRepo!,
      supabase: supabaseRepo!,
      config: this.config
    };
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

    console.log('🔄 듀얼 스토리지 설정 업데이트:', this.config);
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

    // Prisma 헬스 체크
    if (clients.prisma && this.config.prismaEnabled) {
      try {
        await clients.prisma.$queryRaw`SELECT 1`;
        result.prisma.available = true;
      } catch (error) {
        result.prisma.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

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

    // 전체 상태 판단
    const availableCount = [result.prisma.available, result.supabase.available].filter(Boolean).length;
    const enabledCount = [this.config.prismaEnabled, this.config.supabaseEnabled].filter(Boolean).length;

    if (availableCount === enabledCount && availableCount > 0) {
      result.overall = 'healthy';
    } else if (availableCount > 0) {
      result.overall = 'degraded';
    } else {
      result.overall = 'critical';
    }

    console.log('🩺 듀얼 스토리지 헬스 체크:', result);
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