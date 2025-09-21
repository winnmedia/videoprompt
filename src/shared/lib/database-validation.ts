/**
 * 데이터베이스 연결 및 데이터 품질 검증 유틸리티
 * 데이터 계약 기반 안전한 데이터베이스 연산 제공
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/shared/lib/logger';
import { z } from 'zod';

// ============================================
// 데이터베이스 연결 상태 스키마
// ============================================

export const DatabaseConnectionStatusSchema = z.object({
  isConnected: z.boolean(),
  latency: z.number().min(0).optional(),
  lastChecked: z.string().datetime(),
  error: z.string().optional(),
});

export const DatabaseHealthSchema = z.object({
  connection: DatabaseConnectionStatusSchema,
  schema: z.object({
    isValid: z.boolean(),
    missingTables: z.array(z.string()),
    error: z.string().optional(),
  }),
  performance: z.object({
    avgLatency: z.number().min(0),
    maxLatency: z.number().min(0),
    checksPerformed: z.number().int().min(0),
  }),
});

export type DatabaseConnectionStatus = z.infer<typeof DatabaseConnectionStatusSchema>;
export type DatabaseHealth = z.infer<typeof DatabaseHealthSchema>;

// ============================================
// 연결 검증 결과 타입
// ============================================

export interface ConnectionValidationResult {
  success: boolean;
  latency?: number;
  error?: string;
  timestamp: string;
}

export interface SchemaValidationResult {
  isValid: boolean;
  missingTables: string[];
  error?: string;
  timestamp: string;
}

// ============================================
// 데이터베이스 연결 검증 클래스
// ============================================

export class DatabaseValidator {
  private static instance: DatabaseValidator;
  private connectionCache: Map<string, ConnectionValidationResult> = new Map();
  private readonly cacheTimeout = 30 * 1000; // 30초 캐시

  private constructor() {}

  public static getInstance(): DatabaseValidator {
    if (!DatabaseValidator.instance) {
      DatabaseValidator.instance = new DatabaseValidator();
    }
    return DatabaseValidator.instance;
  }

  /**
   * 캐시된 연결 상태 확인
   */
  private getCachedResult(key: string): ConnectionValidationResult | null {
    const cached = this.connectionCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    const cacheTime = new Date(cached.timestamp).getTime();

    if (now - cacheTime > this.cacheTimeout) {
      this.connectionCache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * 결정론적 데이터베이스 연결 검증
   * 30초 내 동일한 요청은 캐시된 결과 반환
   */
  public async validateConnection(
    client: PrismaClient,
    retries = 3
  ): Promise<ConnectionValidationResult> {
    const cacheKey = 'db_connection';
    const cached = this.getCachedResult(cacheKey);

    if (cached) {
      return cached;
    }

    let lastError: string | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const startTime = Date.now();

      try {
        // 간단한 연결 테스트 쿼리
        await client.$queryRaw`SELECT 1 as test`;

        const latency = Date.now() - startTime;
        const result: ConnectionValidationResult = {
          success: true,
          latency,
          timestamp: new Date().toISOString(),
        };

        // 성공 시 캐시 저장
        this.connectionCache.set(cacheKey, result);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error.message : '알 수 없는 오류';

        // 마지막 시도가 아니면 지수 백오프 적용
        if (attempt < retries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s...
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const result: ConnectionValidationResult = {
      success: false,
      error: lastError,
      timestamp: new Date().toISOString(),
    };

    // 실패도 캐시하되 더 짧은 시간으로
    setTimeout(() => this.connectionCache.delete(cacheKey), 5000); // 5초 후 삭제
    this.connectionCache.set(cacheKey, result);

    return result;
  }

  /**
   * 데이터베이스 스키마 검증
   */
  public async validateSchema(
    client: PrismaClient
  ): Promise<SchemaValidationResult> {
    const requiredTables = [
      'User', 'Project', 'Scene', 'Preset', 'Timeline',
      'Scenario', 'Prompt', 'VideoAsset', 'ShareToken',
      'Comment', 'Story', 'Upload', 'EmailVerification', 'PasswordReset'
    ];

    try {
      // PostgreSQL 테이블 목록 조회
      const tables = await client.$queryRaw<{ tablename: string }[]>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
      `;

      const existingTables = tables.map(t => t.tablename);
      const missingTables = requiredTables.filter(
        table => !existingTables.includes(table)
      );

      return {
        isValid: missingTables.length === 0,
        missingTables,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      return {
        isValid: false,
        missingTables: requiredTables,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 종합적인 데이터베이스 건강 상태 체크
   */
  public async checkDatabaseHealth(
    client: PrismaClient
  ): Promise<DatabaseHealth> {
    const connectionResult = await this.validateConnection(client);
    const schemaResult = await this.validateSchema(client);

    // 성능 메트릭 계산
    const performanceMetrics = this.calculatePerformanceMetrics();

    const health: DatabaseHealth = {
      connection: {
        isConnected: connectionResult.success,
        latency: connectionResult.latency,
        lastChecked: connectionResult.timestamp,
        error: connectionResult.error,
      },
      schema: {
        isValid: schemaResult.isValid,
        missingTables: schemaResult.missingTables,
        error: schemaResult.error,
      },
      performance: performanceMetrics,
    };

    // 스키마 검증으로 건강 상태 확인
    const validationResult = DatabaseHealthSchema.safeParse(health);
    if (!validationResult.success) {
      logger.debug('데이터베이스 건강 상태 스키마 검증 실패:', validationResult.error);
    }

    return health;
  }

  /**
   * 성능 메트릭 계산
   */
  private calculatePerformanceMetrics() {
    const latencies = Array.from(this.connectionCache.values())
      .filter(result => result.success && result.latency)
      .map(result => result.latency!);

    if (latencies.length === 0) {
      return {
        avgLatency: 0,
        maxLatency: 0,
        checksPerformed: 0,
      };
    }

    return {
      avgLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
      maxLatency: Math.max(...latencies),
      checksPerformed: latencies.length,
    };
  }

  /**
   * 캐시 정리
   */
  public clearCache(): void {
    this.connectionCache.clear();
  }
}

// ============================================
// DTO 변환 및 검증 유틸리티
// ============================================

/**
 * 안전한 DTO 변환 클래스
 * Prisma 데이터를 API 응답 형식으로 변환하며 데이터 무결성 보장
 */
export class DTOTransformer {
  /**
   * Project 엔티티를 Story DTO로 변환
   * 데이터 계약 준수 보장
   */
  public static transformProjectToStory(project: any): any {
    try {
      // 필수 필드 검증
      if (!project.id || !project.title) {
        throw new Error('필수 필드가 누락되었습니다: id, title');
      }

      // 메타데이터 안전 추출
      const metadata = project.metadata || {};

      // 결정론적 변환 수행
      const transformed = {
        id: project.id,
        title: project.title,
        oneLineStory: project.description || '',
        genre: metadata.genre || 'Unknown',
        tone: this.extractTone(metadata),
        target: metadata.target || 'General',
        structure: metadata.storySteps || null,
        userId: project.userId,
        createdAt: project.createdAt instanceof Date
          ? project.createdAt.toISOString()
          : project.createdAt,
        updatedAt: project.updatedAt instanceof Date
          ? project.updatedAt.toISOString()
          : project.updatedAt,
      };

      return transformed;
    } catch (error) {
      logger.error('Project to Story 변환 실패:', error instanceof Error ? error : new Error(String(error)));
      throw new Error(`DTO 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * 톤 추출 로직 (결정론적)
   */
  private static extractTone(metadata: any): string {
    // 우선순위: toneAndManner[0] > tone > 기본값
    if (metadata.toneAndManner && Array.isArray(metadata.toneAndManner) && metadata.toneAndManner.length > 0) {
      return metadata.toneAndManner[0];
    }

    if (metadata.tone) {
      return metadata.tone;
    }

    return 'Neutral';
  }

  /**
   * 페이지네이션 메타데이터 생성
   */
  public static createPaginationMetadata(
    currentPage: number,
    totalItems: number,
    pageSize: number
  ) {
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      currentPage,
      totalPages,
      totalItems,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    };
  }

  /**
   * API 응답 포맷 표준화
   */
  public static formatApiResponse<T>(
    data: T,
    success = true,
    message?: string
  ) {
    return {
      success,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================
// 에러 분류 및 응답 생성
// ============================================

export enum DatabaseErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  SCHEMA_INVALID = 'SCHEMA_INVALID',
  QUERY_FAILED = 'QUERY_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  TIMEOUT = 'TIMEOUT',
}

export interface DatabaseError {
  type: DatabaseErrorType;
  message: string;
  details?: any;
  timestamp: string;
}

export class DatabaseErrorHandler {
  /**
   * 에러 분류 및 HTTP 상태 코드 결정
   */
  public static classifyError(error: any): {
    statusCode: number;
    errorType: DatabaseErrorType;
    message: string;
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const timestamp = new Date().toISOString();

    // 연결 관련 에러
    if (errorMessage.includes('DATABASE_URL') ||
        errorMessage.includes('connect') ||
        errorMessage.includes('ENOTFOUND')) {
      return {
        statusCode: 503,
        errorType: DatabaseErrorType.CONNECTION_FAILED,
        message: '데이터베이스 연결에 실패했습니다. 환경 설정을 확인해주세요.',
      };
    }

    // Prisma 초기화 에러
    if (errorMessage.includes('PrismaClient')) {
      return {
        statusCode: 503,
        errorType: DatabaseErrorType.CONNECTION_FAILED,
        message: '데이터베이스 초기화에 실패했습니다.',
      };
    }

    // 스키마 관련 에러
    if (errorMessage.includes('Table') && errorMessage.includes('does not exist')) {
      return {
        statusCode: 503,
        errorType: DatabaseErrorType.SCHEMA_INVALID,
        message: '데이터베이스 스키마가 올바르지 않습니다.',
      };
    }

    // 제약 조건 위반
    if (errorMessage.includes('Unique constraint')) {
      return {
        statusCode: 409,
        errorType: DatabaseErrorType.VALIDATION_FAILED,
        message: '중복된 데이터입니다.',
      };
    }

    // 타임아웃
    if (errorMessage.includes('timeout')) {
      return {
        statusCode: 503,
        errorType: DatabaseErrorType.TIMEOUT,
        message: '데이터베이스 요청 시간이 초과되었습니다.',
      };
    }

    // 기본 서버 에러
    return {
      statusCode: 500,
      errorType: DatabaseErrorType.QUERY_FAILED,
      message: '데이터베이스 작업 중 오류가 발생했습니다.',
    };
  }

  /**
   * 표준화된 에러 응답 생성
   */
  public static createErrorResponse(error: any) {
    const classification = this.classifyError(error);

    return {
      success: false,
      error: classification.errorType,
      message: classification.message,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        details: error instanceof Error ? error.stack : String(error),
      }),
    };
  }
}

// ============================================
// 통합 데이터베이스 연산 래퍼
// ============================================

/**
 * 안전한 데이터베이스 연산을 위한 고차 함수
 */
export async function withDatabaseValidation<T>(
  client: PrismaClient,
  operation: (client: PrismaClient) => Promise<T>,
  options: {
    skipConnectionCheck?: boolean;
    skipSchemaCheck?: boolean;
    retries?: number;
  } = {}
): Promise<T> {
  const validator = DatabaseValidator.getInstance();

  // 연결 검증
  if (!options.skipConnectionCheck) {
    const connectionResult = await validator.validateConnection(client, options.retries);
    if (!connectionResult.success) {
      throw new Error(`데이터베이스 연결 실패: ${connectionResult.error}`);
    }
  }

  // 스키마 검증
  if (!options.skipSchemaCheck) {
    const schemaResult = await validator.validateSchema(client);
    if (!schemaResult.isValid) {
      throw new Error(`데이터베이스 스키마 검증 실패: ${schemaResult.missingTables.join(', ')} 테이블이 누락되었습니다`);
    }
  }

  // 실제 연산 수행
  try {
    return await operation(client);
  } catch (error) {
    logger.error('데이터베이스 연산 실패:', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}