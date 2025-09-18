/**
 * 🔄 사용자 동기화 서비스
 * VideoPlanet 프로젝트 - Prisma User ↔ Supabase Auth 동기화
 *
 * 목적:
 * - 결정론적 동기화 (같은 입력 → 같은 출력)
 * - 원자적 연산 (트랜잭션으로 데이터 무결성 보장)
 * - 실패 시 롤백 (안전한 에러 처리)
 */

import { supabase, supabaseAdmin, supabaseConfig } from '@/lib/supabase';
import {
  transformSupabaseUserToPrisma,
  validateUserDataQuality,
  validateUserSyncContract,
  type SupabaseUserDTO,
  type PrismaUserDTO,
  type SyncResult,
  type UserSyncStatus,
  type MigrationOptions,
  SyncResultSchema,
  UserSyncStatusSchema
} from '@/shared/contracts/user-sync.schema';

/**
 * 사용자 동기화 서비스 클래스
 */
export class UserSyncService {
  private static instance: UserSyncService;

  private constructor() {}

  static getInstance(): UserSyncService {
    if (!UserSyncService.instance) {
      UserSyncService.instance = new UserSyncService();
    }
    return UserSyncService.instance;
  }

  /**
   * 단일 사용자 동기화 (Supabase → Prisma)
   */
  async syncUserFromSupabase(
    userId: string,
    options: { createIfNotExists?: boolean; forceUpdate?: boolean } = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const { createIfNotExists = true, forceUpdate = false } = options;

    try {
      console.log(`🔄 Starting user sync for ${userId}`);

      // 1. Supabase에서 사용자 정보 조회
      const supabaseUser = await this.getSupabaseUser(userId);
      if (!supabaseUser) {
        return this.createSyncResult({
          success: false,
          operation: 'error',
          userId,
          errors: ['Supabase에서 사용자를 찾을 수 없습니다'],
          qualityScore: 0,
          executionTime: Date.now() - startTime
        });
      }

      // 2. Prisma에서 기존 사용자 확인
      const { prisma } = await import('@/lib/prisma');
      const existingPrismaUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      // 3. 데이터 품질 검증
      const qualityResult = validateUserDataQuality(supabaseUser);
      if (qualityResult.score < 70) {
        console.warn(`⚠️ 사용자 데이터 품질 낮음 (${qualityResult.score}점):`, qualityResult.issues);
      }

      // 4. DTO 변환
      const prismaUserData = transformSupabaseUserToPrisma(supabaseUser);

      // 5. 동기화 실행 (트랜잭션)
      let operation: 'create' | 'update' | 'skip' = 'skip';
      let changes: Record<string, any> = {};

      const syncedUser = await prisma.$transaction(async (tx) => {
        if (!existingPrismaUser) {
          if (createIfNotExists) {
            operation = 'create';
            changes = { ...prismaUserData };
            console.log(`✨ Creating new user in Prisma: ${userId}`);
            return await tx.user.create({
              data: prismaUserData
            });
          } else {
            throw new Error('사용자가 존재하지 않으며 생성이 허용되지 않았습니다');
          }
        } else {
          // 업데이트 필요성 확인
          const needsUpdate = forceUpdate || this.shouldUpdateUser(existingPrismaUser, prismaUserData);

          if (needsUpdate) {
            operation = 'update';
            changes = this.getChanges(existingPrismaUser, prismaUserData);
            console.log(`🔄 Updating existing user in Prisma: ${userId}`, changes);
            return await tx.user.update({
              where: { id: userId },
              data: {
                ...prismaUserData,
                updatedAt: new Date()
              }
            });
          } else {
            operation = 'skip';
            console.log(`⏭️ No changes needed for user: ${userId}`);
            return existingPrismaUser;
          }
        }
      });

      // 6. 동기화 검증
      const contractValidation = validateUserSyncContract(
        'supabase-to-prisma',
        supabaseUser,
        syncedUser
      );

      if (!contractValidation.isValid) {
        console.error('❌ 동기화 계약 위반:', contractValidation.violations);
        throw new Error(`동기화 검증 실패: ${contractValidation.violations.join(', ')}`);
      }

      // 7. 성공 결과 반환
      const result = this.createSyncResult({
        success: true,
        operation,
        userId,
        changes: Object.keys(changes).length > 0 ? changes : undefined,
        errors: [],
        qualityScore: qualityResult.score,
        recommendations: qualityResult.recommendations,
        executionTime: Date.now() - startTime
      });

      console.log(`✅ User sync completed: ${userId} (${operation}, ${result.qualityScore}점)`);
      return result;

    } catch (error) {
      console.error(`❌ User sync failed for ${userId}:`, error);

      return this.createSyncResult({
        success: false,
        operation: 'error',
        userId,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        qualityScore: 0,
        executionTime: Date.now() - startTime
      });
    }
  }

  /**
   * 사용자 동기화 상태 확인
   */
  async getUserSyncStatus(userId: string): Promise<UserSyncStatus> {
    try {
      // Supabase 확인
      const supabaseUser = await this.getSupabaseUser(userId);
      const supabaseExists = !!supabaseUser;

      // Prisma 확인
      const { prisma } = await import('@/lib/prisma');
      const prismaUser = await prisma.user.findUnique({
        where: { id: userId }
      });
      const prismaExists = !!prismaUser;

      // 동기화 상태 확인
      let isInSync = false;
      let dataQualityScore = 0;
      const syncErrors: string[] = [];
      const recommendations: string[] = [];

      if (supabaseExists && prismaExists && supabaseUser && prismaUser) {
        // 데이터 품질 검증
        const qualityResult = validateUserDataQuality(supabaseUser);
        dataQualityScore = qualityResult.score;

        // 동기화 계약 검증
        const contractValidation = validateUserSyncContract(
          'supabase-to-prisma',
          supabaseUser,
          prismaUser
        );

        isInSync = contractValidation.isValid;
        syncErrors.push(...contractValidation.violations);

        if (!isInSync) {
          recommendations.push('동기화가 필요합니다. syncUserFromSupabase를 실행하세요.');
        }

        recommendations.push(...qualityResult.recommendations);

      } else if (supabaseExists && !prismaExists) {
        syncErrors.push('Prisma에 사용자가 없습니다');
        recommendations.push('syncUserFromSupabase로 사용자를 생성하세요');
      } else if (!supabaseExists && prismaExists) {
        syncErrors.push('Supabase에 사용자가 없습니다');
        recommendations.push('Supabase에서 사용자가 삭제되었을 수 있습니다');
      } else {
        syncErrors.push('양쪽 모두에서 사용자를 찾을 수 없습니다');
        recommendations.push('사용자 ID를 확인하세요');
      }

      const status = {
        userId,
        supabaseExists,
        prismaExists,
        isInSync,
        lastSyncAt: undefined, // TODO: 동기화 기록 테이블에서 조회
        syncErrors,
        dataQualityScore,
        recommendations
      };

      return UserSyncStatusSchema.parse(status);

    } catch (error) {
      console.error(`❌ Failed to get sync status for ${userId}:`, error);

      return UserSyncStatusSchema.parse({
        userId,
        supabaseExists: false,
        prismaExists: false,
        isInSync: false,
        syncErrors: [error instanceof Error ? error.message : 'Unknown error'],
        dataQualityScore: 0,
        recommendations: ['오류로 인해 상태를 확인할 수 없습니다']
      });
    }
  }

  /**
   * 배치 동기화
   */
  async batchSyncUsers(options: MigrationOptions): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    results: SyncResult[];
    summary: string;
  }> {
    const { batchSize, skipErrors, qualityThreshold } = options;

    console.log(`🚀 Starting batch sync with options:`, options);

    // Supabase에서 모든 사용자 조회
    const supabaseUsers = await this.getAllSupabaseUsers();
    const total = supabaseUsers.length;

    console.log(`📊 Found ${total} users in Supabase`);

    const results: SyncResult[] = [];
    let successful = 0;
    let failed = 0;

    // 배치 단위로 처리
    for (let i = 0; i < total; i += batchSize) {
      const batch = supabaseUsers.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(total/batchSize)} (${batch.length} users)`);

      // 배치 내 병렬 처리
      const batchPromises = batch.map(async (user) => {
        try {
          const result = await this.syncUserFromSupabase(user.id, {
            createIfNotExists: true,
            forceUpdate: false
          });

          // 품질 임계값 확인
          if (result.qualityScore < qualityThreshold) {
            console.warn(`⚠️ Quality threshold not met for ${user.id}: ${result.qualityScore} < ${qualityThreshold}`);

            if (!skipErrors) {
              result.success = false;
              result.errors.push(`품질 점수가 임계값 미달 (${result.qualityScore} < ${qualityThreshold})`);
            }
          }

          return result;
        } catch (error) {
          console.error(`❌ Batch sync error for ${user.id}:`, error);

          return this.createSyncResult({
            success: false,
            operation: 'error',
            userId: user.id,
            errors: [error instanceof Error ? error.message : 'Unknown batch error'],
            qualityScore: 0,
            executionTime: 0
          });
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 통계 업데이트
      batchResults.forEach(result => {
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      });

      // 배치 간 잠시 대기 (부하 조절)
      if (i + batchSize < total) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const summary = `배치 동기화 완료: 전체 ${total}명 중 성공 ${successful}명, 실패 ${failed}명 (성공률 ${Math.round(successful/total*100)}%)`;
    console.log(`✅ ${summary}`);

    return {
      totalProcessed: total,
      successful,
      failed,
      results,
      summary
    };
  }

  /**
   * Supabase에서 사용자 조회
   */
  private async getSupabaseUser(userId: string): Promise<SupabaseUserDTO | null> {
    try {
      if (!supabaseAdmin) {
        console.warn('⚠️ Supabase Admin not available, using regular client');

        if (!supabase) {
          throw new Error('Supabase client not available');
        }

        // 일반 클라이언트로는 다른 사용자 정보 조회 불가
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id === userId ? user as SupabaseUserDTO : null;
      }

      const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);

      if (error) {
        console.warn(`⚠️ Failed to get user from Supabase: ${error.message}`);
        return null;
      }

      return user as SupabaseUserDTO;

    } catch (error) {
      console.error(`❌ Error getting Supabase user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Supabase에서 모든 사용자 조회 (관리자 전용)
   */
  private async getAllSupabaseUsers(): Promise<SupabaseUserDTO[]> {
    if (!supabaseAdmin) {
      throw new Error('Admin access required for batch operations');
    }

    try {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();

      if (error) {
        throw new Error(`Failed to list users: ${error.message}`);
      }

      return data.users as SupabaseUserDTO[];

    } catch (error) {
      console.error('❌ Error getting all Supabase users:', error);
      throw error;
    }
  }

  /**
   * 업데이트 필요성 확인
   */
  private shouldUpdateUser(existing: any, updated: PrismaUserDTO): boolean {
    const fieldsToCheck = ['email', 'username', 'fullName', 'avatarUrl', 'role', 'isEmailVerified'];

    return fieldsToCheck.some(field => {
      const existingValue = existing[field];
      const updatedValue = updated[field as keyof PrismaUserDTO];

      // null/undefined 값 정규화
      const normalizedExisting = existingValue ?? null;
      const normalizedUpdated = updatedValue ?? null;

      return normalizedExisting !== normalizedUpdated;
    });
  }

  /**
   * 변경사항 추출
   */
  private getChanges(existing: any, updated: PrismaUserDTO): Record<string, any> {
    const changes: Record<string, any> = {};
    const fieldsToCheck = ['email', 'username', 'fullName', 'avatarUrl', 'role', 'isEmailVerified'];

    fieldsToCheck.forEach(field => {
      const existingValue = existing[field];
      const updatedValue = updated[field as keyof PrismaUserDTO];

      if (existingValue !== updatedValue) {
        changes[field] = {
          from: existingValue,
          to: updatedValue
        };
      }
    });

    return changes;
  }

  /**
   * SyncResult 생성 헬퍼
   */
  private createSyncResult(data: {
    success: boolean;
    operation: 'create' | 'update' | 'skip' | 'error';
    userId: string;
    changes?: Record<string, any>;
    errors?: string[];
    qualityScore: number;
    recommendations?: string[];
    executionTime: number;
  }): SyncResult {
    const result = {
      success: data.success,
      operation: data.operation,
      userId: data.userId,
      changes: data.changes,
      errors: data.errors || [],
      qualityScore: data.qualityScore,
      recommendations: data.recommendations || [],
      executionTime: data.executionTime,
      timestamp: new Date()
    };

    return SyncResultSchema.parse(result);
  }
}

// 싱글톤 인스턴스 export
export const userSyncService = UserSyncService.getInstance();

// 편의 함수들
export async function syncUser(userId: string, options?: { createIfNotExists?: boolean; forceUpdate?: boolean }) {
  return userSyncService.syncUserFromSupabase(userId, options);
}

export async function getUserSyncStatus(userId: string) {
  return userSyncService.getUserSyncStatus(userId);
}

export async function batchSyncUsers(options: MigrationOptions) {
  return userSyncService.batchSyncUsers(options);
}