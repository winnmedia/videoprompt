/**
 * 프로덕션 모니터링 API - $300 사건 재발 방지
 * 실시간 에러 추적 및 시스템 상태 모니터링
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { createSuccessResponse, createErrorResponse } from '@/shared/schemas/api.schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 메모리 기반 모니터링 데이터 (간단한 구현)
let monitoringData = {
  apiCallCount: 0,
  errorCount: 0,
  authErrors: 0,
  clientErrors: 0,
  serverErrors: 0,
  lastReset: new Date().toISOString(),
  recentErrors: [] as Array<{
    timestamp: string;
    endpoint: string;
    statusCode: number;
    errorType: string;
    message: string;
    userAgent?: string;
  }>
};

// 최대 100개의 최근 에러만 보관
const MAX_RECENT_ERRORS = 100;

/**
 * 시스템 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        return NextResponse.json(createSuccessResponse({
          systemHealth: {
            status: 'operational',
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            version: process.version
          },
          metrics: {
            apiCalls: monitoringData.apiCallCount,
            totalErrors: monitoringData.errorCount,
            authErrors: monitoringData.authErrors,
            clientErrors: monitoringData.clientErrors,
            serverErrors: monitoringData.serverErrors,
            errorRate: monitoringData.apiCallCount > 0
              ? (monitoringData.errorCount / monitoringData.apiCallCount * 100).toFixed(2) + '%'
              : '0%'
          },
          lastReset: monitoringData.lastReset,
          timestamp: new Date().toISOString()
        }));

      case 'errors':
        return NextResponse.json(createSuccessResponse({
          recentErrors: monitoringData.recentErrors.slice(-20), // 최근 20개
          totalErrors: monitoringData.recentErrors.length,
          criticalAlerts: monitoringData.recentErrors.filter(error =>
            error.statusCode >= 500 || error.errorType.includes('INFINITE_LOOP')
          ).slice(-5)
        }));

      case 'reset':
        // 개발 환경에서만 리셋 허용
        if (process.env.NODE_ENV !== 'production') {
          monitoringData = {
            apiCallCount: 0,
            errorCount: 0,
            authErrors: 0,
            clientErrors: 0,
            serverErrors: 0,
            lastReset: new Date().toISOString(),
            recentErrors: []
          };
          return NextResponse.json(createSuccessResponse({
            message: 'Monitoring data reset successfully',
            timestamp: monitoringData.lastReset
          }));
        } else {
          return NextResponse.json(
            createErrorResponse('FORBIDDEN', 'Reset not allowed in production'),
            { status: 403 }
          );
        }

      default:
        return NextResponse.json(
          createErrorResponse('INVALID_ACTION', 'Valid actions: status, errors, reset'),
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Production monitor error:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      createErrorResponse('MONITOR_ERROR', 'Failed to fetch monitoring data'),
      { status: 500 }
    );
  }
}

/**
 * 에러 보고
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, statusCode, errorType, message, context } = body;

    // 기본 검증
    if (!endpoint || !statusCode || !errorType) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'endpoint, statusCode, errorType are required'),
        { status: 400 }
      );
    }

    // 에러 분류
    let category = 'unknown';
    if (statusCode === 401) category = 'auth';
    else if (statusCode >= 400 && statusCode < 500) category = 'client';
    else if (statusCode >= 500) category = 'server';

    // 모니터링 데이터 업데이트
    monitoringData.apiCallCount++;
    monitoringData.errorCount++;

    switch (category) {
      case 'auth': monitoringData.authErrors++; break;
      case 'client': monitoringData.clientErrors++; break;
      case 'server': monitoringData.serverErrors++; break;
    }

    // 최근 에러에 추가
    const errorEntry = {
      timestamp: new Date().toISOString(),
      endpoint,
      statusCode,
      errorType,
      message,
      userAgent: request.headers.get('user-agent') || undefined,
      context: context || {}
    };

    monitoringData.recentErrors.push(errorEntry);

    // 최대 개수 유지
    if (monitoringData.recentErrors.length > MAX_RECENT_ERRORS) {
      monitoringData.recentErrors = monitoringData.recentErrors.slice(-MAX_RECENT_ERRORS);
    }

    // 🚨 중요: $300 사건 패턴 감지
    const criticalPatterns = [
      'INFINITE_LOOP_DETECTED',
      'AUTH_RETRY_STORM',
      'EXCESSIVE_API_CALLS',
      'MISSING_REFRESH_TOKEN'
    ];

    const isCritical = criticalPatterns.some(pattern =>
      errorType.includes(pattern) || message.includes(pattern)
    );

    if (isCritical) {
      logger.debug('🚨 CRITICAL PATTERN DETECTED:', {
        errorType,
        message,
        endpoint,
        statusCode,
        timestamp: errorEntry.timestamp
      });
    }

    return NextResponse.json(createSuccessResponse({
      recorded: true,
      timestamp: errorEntry.timestamp,
      category,
      isCritical
    }));

  } catch (error) {
    logger.error('Error reporting failed:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      createErrorResponse('REPORT_ERROR', 'Failed to report error'),
      { status: 500 }
    );
  }
}

/**
 * API 호출 추적 (성공한 호출도 카운트)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, statusCode, responseTime } = body;

    // 성공한 API 호출도 카운트
    monitoringData.apiCallCount++;

    return NextResponse.json(createSuccessResponse({
      tracked: true,
      totalCalls: monitoringData.apiCallCount
    }));

  } catch (error) {
    return NextResponse.json(
      createErrorResponse('TRACKING_ERROR', 'Failed to track API call'),
      { status: 500 }
    );
  }
}