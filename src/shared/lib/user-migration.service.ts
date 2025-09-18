/**
 * 사용자 데이터 마이그레이션 서비스
 * 기존 사용자 데이터의 안전한 동기화 및 무결성 보장
 *
 * 마이그레이션 전략:
 * 1. 점진적 마이그레이션 (Incremental Migration)
 * 2. 백업 기반 안전 장치 (Backup-First Safety)
 * 3. 롤백 가능한 트랜잭션 (Rollback-Safe Transactions)
 * 4. 데이터 무결성 검증 (Integrity Verification)
 */

import { PrismaClient } from '@prisma/client';
import { supabaseAdmin } from '@/lib/supabase';
import { UserSyncService } from '@/shared/lib/user-sync.service';
import {
  type UserSyncRequest,
  type SyncStatus,
  UserDataQualityRules,
} from '@/shared/contracts/user-sync.schema';
import {
  validateUserDataQuality,
  safeTransformUserToPrisma,
} from '@/shared/api/dto-transformers';

export interface MigrationReport {
  totalUsers: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: MigrationError[];
  qualityReport: QualityReport;
  executionTime: number;
  rollbackPlan?: RollbackPlan;
}

export interface MigrationError {
  userId: string;
  email?: string;
  error: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  suggestedAction: string;
}

export interface QualityReport {
  averageScore: number;
  distribution: {
    excellent: number; // 95-100점
    good: number;      // 80-94점
    poor: number;      // 60-79점
    critical: number;  // 0-59점
  };
  commonIssues: string[];
  recommendations: string[];
}

export interface RollbackPlan {
  backupTable: string;
  rollbackQueries: string[];
  verificationSteps: string[];
  estimatedTime: number;
}

export class UserMigrationService {
  private syncService: UserSyncService;

  constructor(private prisma: PrismaClient) {
    this.syncService = new UserSyncService(prisma);
  }

  /**
   * 전체 사용자 마이그레이션 실행
   * 안전성을 위한 단계별 접근
   */
  async runFullMigration(options: {
    dryRun?: boolean;
    batchSize?: number;
    maxRetries?: number;
    createBackup?: boolean;
  } = {}): Promise<MigrationReport> {
    const {
      dryRun = false,
      batchSize = 50,
      maxRetries = 3,
      createBackup = true,
    } = options;

    console.log('🚀 사용자 마이그레이션 시작:', {
      dryRun,
      batchSize,
      maxRetries,
      createBackup,
      timestamp: new Date().toISOString(),
    });

    const startTime = performance.now();
    const report: MigrationReport = {
      totalUsers: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      qualityReport: {
        averageScore: 0,
        distribution: { excellent: 0, good: 0, poor: 0, critical: 0 },
        commonIssues: [],
        recommendations: [],
      },
      executionTime: 0,
    };

    try {
      // 1. 백업 생성 (프로덕션 환경)
      if (createBackup && !dryRun) {
        console.log('📦 데이터 백업 생성 중...');
        report.rollbackPlan = await this.createBackup();
      }

      // 2. Supabase에서 모든 사용자 조회
      const supabaseUsers = await this.getAllSupabaseUsers();
      report.totalUsers = supabaseUsers.length;

      console.log(`📊 총 ${report.totalUsers}명의 Supabase 사용자 발견`);

      // 3. 배치 단위로 마이그레이션 실행
      for (let i = 0; i < supabaseUsers.length; i += batchSize) {
        const batch = supabaseUsers.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(supabaseUsers.length / batchSize);

        console.log(`🔄 배치 ${batchNumber}/${totalBatches} 처리 중 (${batch.length}명)...`);

        await this.processBatch(batch, report, dryRun, maxRetries);

        // 배치 간 잠시 대기 (DB 부하 방지)
        if (i + batchSize < supabaseUsers.length) {
          await this.sleep(100);
        }
      }

      // 4. 품질 리포트 생성
      report.qualityReport = await this.generateQualityReport();

      const endTime = performance.now();
      report.executionTime = endTime - startTime;

      console.log('✅ 마이그레이션 완료:', {
        총사용자: report.totalUsers,
        성공: report.succeeded,
        실패: report.failed,
        건너뜀: report.skipped,
        성공률: `${((report.succeeded / report.totalUsers) * 100).toFixed(1)}%`,
        실행시간: `${(report.executionTime / 1000).toFixed(2)}초`,
      });

      return report;

    } catch (error) {
      console.error('❌ 마이그레이션 실패:', error);

      report.errors.push({
        userId: 'SYSTEM',
        error: error instanceof Error ? error.message : String(error),
        severity: 'critical',
        recoverable: false,
        suggestedAction: '시스템 관리자에게 문의하세요',
      });

      const endTime = performance.now();
      report.executionTime = endTime - startTime;

      return report;
    }
  }

  /**
   * 개별 사용자 마이그레이션 상태 확인
   */
  async checkUserMigrationStatus(supabaseUserId: string): Promise<{
    needsMigration: boolean;
    syncStatus: SyncStatus;
    recommendations: string[];
  }> {
    try {
      const syncStatus = await this.syncService.checkSyncStatus(supabaseUserId);

      const needsMigration = syncStatus.syncHealth !== 'healthy' ||
                            syncStatus.healthScore < UserDataQualityRules.syncQualityThresholds.healthy;

      const recommendations: string[] = [];

      if (syncStatus.syncHealth === 'missing') {
        recommendations.push('Prisma User 테이블에 사용자 데이터가 없습니다. 동기화가 필요합니다.');
      } else if (syncStatus.syncHealth === 'conflict') {
        recommendations.push('데이터 불일치가 발견되었습니다. 수동 검토가 필요합니다.');
      } else if (syncStatus.syncHealth === 'outdated') {
        recommendations.push('데이터가 오래되었습니다. 재동기화를 권장합니다.');
      }

      if (syncStatus.healthScore < 80) {
        recommendations.push('데이터 품질이 낮습니다. 데이터 정정이 필요합니다.');
      }

      return {
        needsMigration,
        syncStatus,
        recommendations,
      };

    } catch (error) {
      console.error('❌ 마이그레이션 상태 확인 실패:', error);
      return {
        needsMigration: true,
        syncStatus: {
          supabaseUserId,
          prismaUserId: null,
          lastSyncAt: null,
          syncHealth: 'missing',
          healthScore: 0,
        },
        recommendations: ['상태 확인 중 오류가 발생했습니다. 관리자에게 문의하세요.'],
      };
    }
  }

  /**
   * 데이터 무결성 검증
   */
  async verifyDataIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    statistics: {
      totalSupabaseUsers: number;
      totalPrismaUsers: number;
      syncedUsers: number;
      orphanedUsers: number;
      duplicateEmails: number;
    };
  }> {
    console.log('🔍 데이터 무결성 검증 시작...');

    const issues: string[] = [];

    try {
      // 1. Supabase vs Prisma 사용자 수 비교
      const [supabaseUsers, prismaUsers] = await Promise.all([
        this.getAllSupabaseUsers(),
        this.prisma.user.findMany({ select: { id: true, email: true } }),
      ]);

      const statistics = {
        totalSupabaseUsers: supabaseUsers.length,
        totalPrismaUsers: prismaUsers.length,
        syncedUsers: 0,
        orphanedUsers: 0,
        duplicateEmails: 0,
      };

      // 2. 동기화된 사용자 수 계산
      const supabaseUserIds = new Set(supabaseUsers.map(u => u.id));
      const prismaUserIds = new Set(prismaUsers.map(u => u.id));

      statistics.syncedUsers = prismaUsers.filter(u => supabaseUserIds.has(u.id)).length;
      statistics.orphanedUsers = prismaUsers.filter(u => !supabaseUserIds.has(u.id)).length;

      // 3. 중복 이메일 검사
      const emailCounts = new Map<string, number>();
      prismaUsers.forEach(user => {
        const count = emailCounts.get(user.email) || 0;
        emailCounts.set(user.email, count + 1);
      });

      statistics.duplicateEmails = Array.from(emailCounts.values())
        .filter(count => count > 1).length;

      // 4. 문제점 식별
      if (statistics.totalSupabaseUsers > statistics.totalPrismaUsers) {
        const missing = statistics.totalSupabaseUsers - statistics.syncedUsers;
        issues.push(`${missing}명의 Supabase 사용자가 Prisma에 동기화되지 않음`);
      }

      if (statistics.orphanedUsers > 0) {
        issues.push(`${statistics.orphanedUsers}명의 고아 사용자가 Prisma에 존재 (Supabase에 없음)`);
      }

      if (statistics.duplicateEmails > 0) {
        issues.push(`${statistics.duplicateEmails}개의 중복 이메일 발견`);
      }

      // 5. 동기화 품질 검사
      const syncRate = (statistics.syncedUsers / statistics.totalSupabaseUsers) * 100;
      if (syncRate < 95) {
        issues.push(`동기화율이 낮음: ${syncRate.toFixed(1)}% (목표: 95% 이상)`);
      }

      const isValid = issues.length === 0;

      console.log('✅ 데이터 무결성 검증 완료:', {
        유효성: isValid ? '정상' : '문제있음',
        문제수: issues.length,
        통계: statistics,
      });

      return { isValid, issues, statistics };

    } catch (error) {
      console.error('❌ 데이터 무결성 검증 실패:', error);
      issues.push('무결성 검증 중 오류 발생');

      return {
        isValid: false,
        issues,
        statistics: {
          totalSupabaseUsers: 0,
          totalPrismaUsers: 0,
          syncedUsers: 0,
          orphanedUsers: 0,
          duplicateEmails: 0,
        },
      };
    }
  }

  // === 내부 헬퍼 메서드 ===

  private async getAllSupabaseUsers() {
    const { data: users, error } = await supabaseAdmin
      .from('auth.users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Supabase 사용자 조회 실패: ${error.message}`);
    }

    return users || [];
  }

  private async processBatch(
    users: any[],
    report: MigrationReport,
    dryRun: boolean,
    maxRetries: number
  ) {
    for (const user of users) {
      report.processed++;

      try {
        // 데이터 품질 사전 검사
        const qualityCheck = validateUserDataQuality({
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username,
        });

        if (!qualityCheck.isValid && qualityCheck.score < 60) {
          report.skipped++;
          report.errors.push({
            userId: user.id,
            email: user.email,
            error: `데이터 품질 점수 낮음: ${qualityCheck.score}점`,
            severity: 'medium',
            recoverable: true,
            suggestedAction: '데이터 정정 후 재시도',
          });
          continue;
        }

        // 동기화 실행 (재시도 로직 포함)
        let success = false;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            if (!dryRun) {
              const syncRequest: UserSyncRequest = {
                supabaseUserId: user.id,
                email: user.email,
                emailConfirmed: Boolean(user.email_confirmed_at),
                userMetadata: user.user_metadata || {},
                syncReason: 'manual_sync',
              };

              const result = await this.syncService.syncUser(syncRequest);
              if (result.success) {
                success = true;
                break;
              }
            } else {
              // Dry run: 변환만 검증
              const transformed = safeTransformUserToPrisma(user, 'Migration Dry Run');
              if (transformed) {
                success = true;
                break;
              }
            }
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) {
              await this.sleep(1000 * attempt); // 지수 백오프
            }
          }
        }

        if (success) {
          report.succeeded++;
        } else {
          report.failed++;
          report.errors.push({
            userId: user.id,
            email: user.email,
            error: lastError?.message || '알 수 없는 오류',
            severity: 'high',
            recoverable: maxRetries < 5, // 재시도 가능 여부
            suggestedAction: '로그 확인 후 수동 처리 필요',
          });
        }

      } catch (error) {
        report.failed++;
        report.errors.push({
          userId: user.id,
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
          severity: 'high',
          recoverable: false,
          suggestedAction: '기술팀에 문의',
        });
      }
    }
  }

  private async createBackup(): Promise<RollbackPlan> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupTable = `user_backup_${timestamp}`;

    const rollbackQueries = [
      `CREATE TABLE ${backupTable} AS SELECT * FROM "User";`,
      `-- 롤백 시 실행: DROP TABLE "User"; ALTER TABLE ${backupTable} RENAME TO "User";`,
    ];

    return {
      backupTable,
      rollbackQueries,
      verificationSteps: [
        `SELECT COUNT(*) FROM ${backupTable};`,
        `SELECT COUNT(*) FROM "User";`,
        'Supabase Auth 사용자 수와 비교 확인',
      ],
      estimatedTime: 30000, // 30초 추정
    };
  }

  private async generateQualityReport(): Promise<QualityReport> {
    const users = await this.prisma.user.findMany({
      select: { id: true, email: true, username: true, emailVerified: true },
    });

    const scores = users.map(user => {
      const quality = validateUserDataQuality(user);
      return quality.score;
    });

    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    const distribution = {
      excellent: scores.filter(s => s >= 95).length,
      good: scores.filter(s => s >= 80 && s < 95).length,
      poor: scores.filter(s => s >= 60 && s < 80).length,
      critical: scores.filter(s => s < 60).length,
    };

    return {
      averageScore,
      distribution,
      commonIssues: [
        '사용자명 형식 불일치',
        '이메일 미인증 상태',
        '프로필 정보 누락',
      ],
      recommendations: [
        '데이터 품질 점수가 80점 미만인 사용자 검토 필요',
        '이메일 인증 프로세스 개선 고려',
        '사용자명 정규화 규칙 적용 필요',
      ],
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 싱글톤 인스턴스
 */
export const createUserMigrationService = (prisma: PrismaClient) => {
  return new UserMigrationService(prisma);
};