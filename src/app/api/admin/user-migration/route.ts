/**
 * 관리자용 사용자 마이그레이션 API
 *
 * POST /api/admin/user-migration - 전체 마이그레이션 실행
 * GET /api/admin/user-migration - 마이그레이션 상태 확인
 *
 * 보안: 관리자 권한 필요
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { createUserMigrationService } from '@/shared/lib/user-migration.service';
import { createErrorResponse, createSuccessResponse } from '@/shared/schemas/api.schema';

// 환경 설정
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 타임아웃

// 마이그레이션 요청 스키마
const MigrationRequestSchema = z.object({
  action: z.enum(['run', 'verify', 'status']),
  options: z.object({
    dryRun: z.boolean().default(false),
    batchSize: z.number().min(1).max(100).default(50),
    maxRetries: z.number().min(1).max(10).default(3),
    createBackup: z.boolean().default(true),
  }).optional(),
  userId: z.string().uuid().optional(), // 특정 사용자만 확인
});

/**
 * POST - 마이그레이션 실행
 */
export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const adminCheck = await verifyAdminAccess(request);
    if (!adminCheck.success) {
      return adminCheck.response;
    }

    const body = await request.json();
    const validationResult = MigrationRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', '요청 데이터가 올바르지 않습니다.'),
        { status: 400 }
      );
    }

    const { action, options = {}, userId } = validationResult.data;

    // Prisma 클라이언트 초기화
    const { prisma } = await import('@/lib/prisma');
    const migrationService = createUserMigrationService(prisma);

    console.log('🔧 관리자 마이그레이션 요청:', {
      action,
      options,
      userId,
      adminId: adminCheck.adminId,
      timestamp: new Date().toISOString(),
    });

    switch (action) {
      case 'run': {
        // 전체 마이그레이션 실행
        console.log('🚀 전체 마이그레이션 실행 시작...');

        const migrationReport = await migrationService.runFullMigration(options);

        const response = {
          action: 'migration_completed',
          report: migrationReport,
          summary: {
            총사용자: migrationReport.totalUsers,
            성공: migrationReport.succeeded,
            실패: migrationReport.failed,
            건너뜀: migrationReport.skipped,
            성공률: `${((migrationReport.succeeded / migrationReport.totalUsers) * 100).toFixed(1)}%`,
            실행시간: `${(migrationReport.executionTime / 1000).toFixed(2)}초`,
            평균품질점수: migrationReport.qualityReport.averageScore.toFixed(1),
          },
          recommendations: migrationReport.qualityReport.recommendations,
          rollbackPlan: migrationReport.rollbackPlan,
        };

        return NextResponse.json(
          createSuccessResponse(response, '마이그레이션이 완료되었습니다.'),
          { status: 200 }
        );
      }

      case 'verify': {
        // 데이터 무결성 검증
        console.log('🔍 데이터 무결성 검증 시작...');

        const integrityResult = await migrationService.verifyDataIntegrity();

        const response = {
          action: 'integrity_verification',
          isValid: integrityResult.isValid,
          issues: integrityResult.issues,
          statistics: integrityResult.statistics,
          recommendations: integrityResult.isValid
            ? ['데이터 무결성이 정상입니다.']
            : ['발견된 문제를 해결한 후 마이그레이션을 실행하세요.'],
        };

        return NextResponse.json(
          createSuccessResponse(response, '무결성 검증이 완료되었습니다.'),
          { status: 200 }
        );
      }

      case 'status': {
        if (!userId) {
          return NextResponse.json(
            createErrorResponse('MISSING_PARAMETER', 'userId가 필요합니다.'),
            { status: 400 }
          );
        }

        // 특정 사용자 상태 확인
        console.log('📊 사용자 상태 확인:', userId);

        const userStatus = await migrationService.checkUserMigrationStatus(userId);

        const response = {
          action: 'user_status_check',
          userId,
          needsMigration: userStatus.needsMigration,
          syncStatus: userStatus.syncStatus,
          recommendations: userStatus.recommendations,
        };

        return NextResponse.json(
          createSuccessResponse(response, '사용자 상태 확인이 완료되었습니다.'),
          { status: 200 }
        );
      }

      default:
        return NextResponse.json(
          createErrorResponse('INVALID_ACTION', '지원하지 않는 작업입니다.'),
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ 마이그레이션 API 오류:', error);

    return NextResponse.json(
      createErrorResponse(
        'MIGRATION_ERROR',
        error instanceof Error ? error.message : '마이그레이션 중 오류가 발생했습니다.'
      ),
      { status: 500 }
    );
  }
}

/**
 * GET - 마이그레이션 상태 및 통계 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const adminCheck = await verifyAdminAccess(request);
    if (!adminCheck.success) {
      return adminCheck.response;
    }

    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';

    // Prisma 클라이언트 초기화
    const { prisma } = await import('@/lib/prisma');
    const migrationService = createUserMigrationService(prisma);

    console.log('📊 마이그레이션 상태 조회:', {
      includeDetails,
      adminId: adminCheck.adminId,
    });

    // 기본 통계 수집
    const [integrityResult, users] = await Promise.all([
      migrationService.verifyDataIntegrity(),
      includeDetails ? prisma.user.findMany({
        select: {
          id: true,
          email: true,
          username: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // 최근 100명만
      }) : [],
    ]);

    const response = {
      timestamp: new Date().toISOString(),
      integrity: {
        isValid: integrityResult.isValid,
        issues: integrityResult.issues,
        statistics: integrityResult.statistics,
      },
      systemHealth: {
        syncRate: integrityResult.statistics.totalSupabaseUsers > 0
          ? ((integrityResult.statistics.syncedUsers / integrityResult.statistics.totalSupabaseUsers) * 100).toFixed(1)
          : '0',
        status: integrityResult.isValid ? 'healthy' : 'needs_attention',
        lastChecked: new Date().toISOString(),
      },
      ...(includeDetails && {
        recentUsers: users.map(user => ({
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })),
      }),
      actions: {
        available: [
          { action: 'verify', description: '데이터 무결성 검증' },
          { action: 'run', description: '전체 마이그레이션 실행 (주의!)' },
          { action: 'status', description: '특정 사용자 상태 확인' },
        ],
        recommendations: integrityResult.isValid
          ? ['시스템이 정상 상태입니다.']
          : ['마이그레이션 실행을 고려하세요.', '백업을 먼저 생성하세요.'],
      },
    };

    return NextResponse.json(
      createSuccessResponse(response, '마이그레이션 상태 조회가 완료되었습니다.'),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ 마이그레이션 상태 조회 오류:', error);

    return NextResponse.json(
      createErrorResponse(
        'STATUS_CHECK_ERROR',
        error instanceof Error ? error.message : '상태 조회 중 오류가 발생했습니다.'
      ),
      { status: 500 }
    );
  }
}

// === 헬퍼 함수 ===

/**
 * 관리자 권한 확인
 */
async function verifyAdminAccess(request: NextRequest): Promise<{
  success: boolean;
  adminId?: string;
  response?: NextResponse;
}> {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return {
      success: false,
      response: NextResponse.json(
        createErrorResponse('AUTHENTICATION_REQUIRED', '로그인이 필요합니다.'),
        { status: 401 }
      ),
    };
  }

  try {
    const { prisma } = await import('@/lib/prisma');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });

    if (!user || user.role !== 'admin') {
      console.warn('🚨 관리자 권한 없는 마이그레이션 API 접근 시도:', {
        userId,
        userRole: user?.role,
        userEmail: user?.email,
      });

      return {
        success: false,
        response: NextResponse.json(
          createErrorResponse('INSUFFICIENT_PERMISSIONS', '관리자 권한이 필요합니다.'),
          { status: 403 }
        ),
      };
    }

    console.log('✅ 관리자 권한 확인됨:', {
      adminId: userId,
      adminEmail: user.email,
    });

    return { success: true, adminId: userId };

  } catch (error) {
    console.error('❌ 관리자 권한 확인 실패:', error);

    return {
      success: false,
      response: NextResponse.json(
        createErrorResponse('AUTHORIZATION_ERROR', '권한 확인 중 오류가 발생했습니다.'),
        { status: 500 }
      ),
    };
  }
}