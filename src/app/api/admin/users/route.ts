/**
 * Admin Users Management API Route
 *
 * 사용자 관리 엔드포인트 (검색, 필터, 페이지네이션)
 * CLAUDE.md 준수: PII 보호, 감사 로그, 성능 최적화
 */

import { NextRequest } from 'next/server';
import {
  withAdminHandler,
  createAdminSuccessResponse,
  createAdminPaginatedResponse,
  AdminApiError,
  maskPii,
} from '@/shared/api/admin-utils';
import {
  UserSearchQuerySchema,
  UserUpdateRequestSchema,
  type UserSearchQuery,
  type UserUpdateRequest,
} from '@/shared/api/admin-schemas';
import { validateQueryParams, validateRequest } from '@/shared/api/planning-utils';
import { supabaseClient } from '@/shared/api/supabase-client';
import logger from '@/shared/lib/structured-logger';
import type { AdminUser, PaginationInfo } from '@/entities/admin';

// ===========================================
// 캐시 설정
// ===========================================

const USER_SEARCH_CACHE_TTL = 2 * 60 * 1000; // 2분
const userSearchCache = new Map<string, { data: any; timestamp: number }>();

function getCachedUserSearch(key: string): any | null {
  const cached = userSearchCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > USER_SEARCH_CACHE_TTL) {
    userSearchCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedUserSearch(key: string, data: any): void {
  userSearchCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// ===========================================
// 사용자 검색 쿼리 빌더
// ===========================================

function buildUserSearchQuery(query: UserSearchQuery, baseQuery: any) {
  let searchQuery = baseQuery;

  // 키워드 검색 (이메일, 사용자명)
  if (query.keyword) {
    searchQuery = searchQuery.or(
      `email.ilike.%${query.keyword}%,username.ilike.%${query.keyword}%`
    );
  }

  // 상태 필터
  if (query.status && query.status.length > 0) {
    searchQuery = searchQuery.in('status', query.status);
  }

  // 역할 필터
  if (query.role && query.role.length > 0) {
    searchQuery = searchQuery.in('role', query.role);
  }

  // 날짜 범위 필터
  if (query.dateRange) {
    if (query.dateRange.start) {
      searchQuery = searchQuery.gte('created_at', query.dateRange.start);
    }
    if (query.dateRange.end) {
      searchQuery = searchQuery.lte('created_at', query.dateRange.end);
    }
  }

  // 정렬
  if (query.sort) {
    searchQuery = searchQuery.order(query.sort.field, {
      ascending: query.sort.direction === 'asc',
    });
  } else {
    // 기본 정렬: 최근 생성순
    searchQuery = searchQuery.order('created_at', { ascending: false });
  }

  return searchQuery;
}

// ===========================================
// 사용자 메트릭 계산
// ===========================================

async function calculateUserMetrics(userId: string): Promise<{
  projectsCount: number;
  lastLoginAt?: Date;
}> {
  try {
    // 프로젝트 수 조회
    const { count: projectsCount } = await supabaseClient.raw
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', false);

    // 마지막 로그인 시간 조회 (audit_logs에서)
    const { data: lastLogin } = await supabaseClient.raw
      .from('audit_logs')
      .select('timestamp')
      .eq('actor_id', userId)
      .eq('event_type', 'login')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return {
      projectsCount: projectsCount || 0,
      lastLoginAt: lastLogin?.timestamp ? new Date(lastLogin.timestamp) : undefined,
    };
  } catch (error) {
    logger.warn('사용자 메트릭 계산 실패', {
      component: 'AdminUsers',
      metadata: { userId, error: error instanceof Error ? error.message : String(error) },
    });

    return {
      projectsCount: 0,
      lastLoginAt: undefined,
    };
  }
}

// ===========================================
// GET: 사용자 목록 조회
// ===========================================

export const GET = withAdminHandler(
  async (request: NextRequest, { admin, createAuditLog }) => {
    // 1. 쿼리 파라미터 검증
    const query = validateQueryParams(request, UserSearchQuerySchema);

    // 캐시 키 생성
    const cacheKey = `user_search:${JSON.stringify(query)}`;
    const cached = getCachedUserSearch(cacheKey);

    if (cached) {
      await createAuditLog(
        'data_access',
        'users_list_viewed_cached',
        { type: 'users', id: 'list' },
        { query, source: 'cache' }
      );

      return createAdminPaginatedResponse(
        cached.users,
        cached.pagination,
        { message: '사용자 목록 조회가 완료되었습니다. (캐시됨)' }
      );
    }

    await createAuditLog(
      'data_access',
      'users_list_viewed',
      { type: 'users', id: 'list' },
      {
        query: maskPii(query),
        page: query.page,
        pageSize: query.pageSize,
      }
    );

    logger.info('사용자 목록 조회 요청', {
      component: 'AdminUsers',
      metadata: {
        adminId: admin.userId,
        query: maskPii(query),
      },
    });

    try {
      // 2. 기본 쿼리 구성
      let baseQuery = supabaseClient.raw
        .from('users')
        .select(`
          id,
          email,
          username,
          role,
          status,
          created_at,
          updated_at,
          last_sign_in_at,
          email_verified_at
        `, { count: 'exact' });

      // 3. 검색 조건 적용
      const searchQuery = buildUserSearchQuery(query, baseQuery);

      // 4. 페이지네이션 적용
      const offset = (query.page - 1) * query.pageSize;
      const paginatedQuery = searchQuery
        .range(offset, offset + query.pageSize - 1);

      // 5. 쿼리 실행
      const { data: users, error, count } = await supabaseClient.safeQuery(
        () => paginatedQuery,
        admin.userId,
        'get_admin_users'
      );

      if (error) {
        throw new AdminApiError(
          '사용자 목록 조회에 실패했습니다.',
          'USERS_FETCH_ERROR',
          500,
          { originalError: error.message }
        );
      }

      // 6. 사용자 메트릭 계산 (옵션)
      let adminUsers: AdminUser[] = (users || []).map(user => ({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role || 'user',
        accountStatus: user.status || 'active',
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
        lastSignInAt: user.last_sign_in_at ? new Date(user.last_sign_in_at) : undefined,
        emailVerifiedAt: user.email_verified_at ? new Date(user.email_verified_at) : undefined,
        projectsCount: 0, // 기본값
        lastLoginAt: user.last_sign_in_at ? new Date(user.last_sign_in_at) : undefined,
      }));

      // 메트릭 포함 옵션
      if (query.includeMetrics && adminUsers.length > 0) {
        const metricsPromises = adminUsers.map(user =>
          calculateUserMetrics(user.id)
        );

        const metricsResults = await Promise.allSettled(metricsPromises);

        adminUsers = adminUsers.map((user, index) => {
          const metricsResult = metricsResults[index];
          if (metricsResult.status === 'fulfilled') {
            return {
              ...user,
              ...metricsResult.value,
            };
          }
          return user;
        });
      }

      // 7. PII 마스킹 (응답 전)
      const maskedUsers = adminUsers.map(user => ({
        ...user,
        email: maskPii(user.email),
      }));

      // 8. 페이지네이션 정보 구성
      const totalPages = Math.ceil((count || 0) / query.pageSize);
      const pagination: PaginationInfo = {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: count || 0,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      };

      // 9. 캐시에 저장
      setCachedUserSearch(cacheKey, {
        users: maskedUsers,
        pagination,
      });

      logger.info('사용자 목록 조회 완료', {
        component: 'AdminUsers',
        metadata: {
          adminId: admin.userId,
          totalUsers: count || 0,
          page: query.page,
          includeMetrics: query.includeMetrics,
        },
      });

      return createAdminPaginatedResponse(
        maskedUsers,
        pagination,
        { message: '사용자 목록 조회가 완료되었습니다.' }
      );

    } catch (error) {
      await createAuditLog(
        'security_event',
        'users_list_error',
        { type: 'users', id: 'list' },
        {
          error: error instanceof Error ? error.message : String(error),
          query: maskPii(query),
        }
      );

      throw error;
    }
  },
  {
    endpoint: '/api/admin/users',
    permissions: ['admin.users.read'],
  }
);

// ===========================================
// PUT: 사용자 정보 업데이트
// ===========================================

export const PUT = withAdminHandler(
  async (request: NextRequest, { admin, createAuditLog }) => {
    // 1. 요청 검증
    const updateRequest = await validateRequest(request, UserUpdateRequestSchema);
    const userId = new URL(request.url).searchParams.get('userId');

    if (!userId) {
      throw new AdminApiError(
        '사용자 ID가 필요합니다.',
        'MISSING_USER_ID',
        400
      );
    }

    await createAuditLog(
      'admin_action',
      'user_update_attempted',
      { type: 'user', id: userId },
      {
        updateFields: Object.keys(updateRequest),
        reason: updateRequest.notes,
      }
    );

    logger.info('사용자 정보 업데이트 요청', {
      component: 'AdminUsers',
      metadata: {
        adminId: admin.userId,
        targetUserId: userId,
        updateFields: Object.keys(updateRequest),
      },
    });

    try {
      // 2. 기존 사용자 정보 조회
      const { data: existingUser, error: fetchError } = await supabaseClient.raw
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError || !existingUser) {
        throw new AdminApiError(
          '사용자를 찾을 수 없습니다.',
          'USER_NOT_FOUND',
          404
        );
      }

      // 3. 업데이트 데이터 준비
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updateRequest.status) {
        updateData.status = updateRequest.status;
      }

      if (updateRequest.role) {
        // 슈퍼 관리자만 역할 변경 가능
        if (admin.role !== 'super_admin') {
          throw new AdminApiError(
            '역할 변경은 슈퍼 관리자만 가능합니다.',
            'INSUFFICIENT_PERMISSIONS',
            403
          );
        }
        updateData.role = updateRequest.role;
      }

      // 4. 사용자 정보 업데이트
      const { data: updatedUser, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('users')
          .update(updateData)
          .eq('id', userId)
          .select('*')
          .single(),
        admin.userId,
        'update_user'
      );

      if (updateError || !updatedUser) {
        throw new AdminApiError(
          '사용자 정보 업데이트에 실패했습니다.',
          'USER_UPDATE_ERROR',
          500,
          { originalError: updateError?.message }
        );
      }

      // 5. 감사 로그 기록
      await createAuditLog(
        'admin_action',
        'user_updated',
        { type: 'user', id: userId },
        {
          changes: updateData,
          previousValues: {
            status: existingUser.status,
            role: existingUser.role,
          },
          reason: updateRequest.notes,
        }
      );

      // 6. 사용자 검색 캐시 무효화
      userSearchCache.clear();

      // 7. 응답 구성 (PII 마스킹)
      const response = {
        id: updatedUser.id,
        email: maskPii(updatedUser.email),
        username: updatedUser.username,
        role: updatedUser.role,
        status: updatedUser.status,
        updatedAt: new Date(updatedUser.updated_at),
        changes: Object.keys(updateData).filter(key => key !== 'updated_at'),
      };

      logger.info('사용자 정보 업데이트 완료', {
        component: 'AdminUsers',
        metadata: {
          adminId: admin.userId,
          targetUserId: userId,
          changes: Object.keys(updateData),
        },
      });

      return createAdminSuccessResponse(response, {
        message: '사용자 정보가 성공적으로 업데이트되었습니다.',
      });

    } catch (error) {
      await createAuditLog(
        'security_event',
        'user_update_error',
        { type: 'user', id: userId },
        {
          error: error instanceof Error ? error.message : String(error),
          updateFields: Object.keys(updateRequest),
        }
      );

      throw error;
    }
  },
  {
    endpoint: '/api/admin/users',
    permissions: ['admin.users.write'],
  }
);

// ===========================================
// OPTIONS: CORS 지원
// ===========================================

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}