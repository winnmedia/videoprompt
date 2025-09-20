/**
 * 사용자 동기화 서비스 - Simplified Stub
 * Prisma 제거 후 최소한의 호환성 유지
 */

import { logger } from './logger';

export interface SyncResult {
  success: boolean;
  operation: 'create' | 'update' | 'skip' | 'error';
  userId: string;
  errors: string[];
  qualityScore: number;
  executionTime: number;
  changes?: Record<string, any>;
  recommendations?: string[];
}

/**
 * 사용자 동기화 서비스 - 스텁 구현
 * Prisma 제거로 인해 실제 동기화는 불필요하지만 기존 코드 호환성 유지
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
   * 단일 사용자 동기화 (스텁 - 항상 성공 반환)
   */
  async syncUserFromSupabase(
    userId: string,
    options: { createIfNotExists?: boolean; forceUpdate?: boolean } = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();

    logger.info(`User sync requested for ${userId} (stub implementation)`);

    // Prisma가 제거되었으므로 동기화가 불필요 - 성공 반환
    return {
      success: true,
      operation: 'skip',
      userId,
      errors: [],
      qualityScore: 100,
      executionTime: Date.now() - startTime,
      recommendations: ['Prisma removed - sync no longer needed']
    };
  }

  /**
   * 사용자 동기화 상태 확인 (스텁)
   */
  async checkSyncStatus(userId: string): Promise<{ inSync: boolean; lastSync?: Date }> {
    return {
      inSync: true,
      lastSync: new Date()
    };
  }

  /**
   * 대량 사용자 동기화 (스텁)
   */
  async bulkSyncUsers(userIds: string[]): Promise<SyncResult[]> {
    return userIds.map(userId => ({
      success: true,
      operation: 'skip' as const,
      userId,
      errors: [],
      qualityScore: 100,
      executionTime: 0
    }));
  }
}

// 싱글톤 인스턴스 내보내기
export const userSyncService = UserSyncService.getInstance();

// 기본 내보내기
export default UserSyncService;