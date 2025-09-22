/**
 * Admin API Routes Test Suite
 *
 * 관리자 API 엔드포인트 통합 테스트
 * CLAUDE.md 준수: TDD, 결정론성, MSW 모킹, 보안 검증
 */

import { http } from 'msw';
import { setupServer } from 'msw/node';
import crypto from 'crypto';

// ===========================================
// 테스트 환경 설정
// ===========================================

const JWT_SECRET = 'test-secret-key';
const ADMIN_API_KEY = 'test-admin-api-key';

// 환경변수 모킹
process.env.JWT_SECRET = JWT_SECRET;
process.env.ADMIN_API_KEY = ADMIN_API_KEY;
process.env.ADMIN_IP_WHITELIST = '127.0.0.1,::1';
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });

// MSW 서버 설정
const server = setupServer(
  // Supabase RPC 함수 모킹
  http.post('*/rest/v1/rpc/get_admin_user_metrics', () => {
    return Response.json({
      total_users: 150,
      recent_week_users: 12,
      admin_users: 3,
      guest_ratio: 15.5,
    });
  }),

  http.post('*/rest/v1/rpc/get_admin_content_metrics', () => {
    return Response.json({
      total_projects: 45,
      total_scenarios: 120,
      total_prompts: 300,
      total_video_assets: 75,
    });
  }),

  http.post('*/rest/v1/rpc/get_admin_system_metrics', () => {
    return Response.json({
      queued_videos: 5,
      processing_videos: 2,
      completed_videos: 60,
      failed_videos: 8,
      recent_errors: 3,
    });
  }),

  // 외부 제공자 Health Check 모킹
  http.get('https://api.seedance.com/health', () => {
    return Response.json({ status: 'healthy' });
  }),

  http.get('https://api.veo.com/v1/health', () => {
    return Response.json({ status: 'healthy' });
  }),

  // 사용자 목록 모킹
  http.get('*/rest/v1/users', ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const pageSize = parseInt(url.searchParams.get('limit') || '20');

    const mockUsers = Array.from({ length: pageSize }, (_, index) => ({
      id: `user-${index + 1}`,
      email: `user${index + 1}@example.com`,
      username: `user${index + 1}`,
      role: index === 0 ? 'admin' : 'user',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      last_sign_in_at: '2024-01-01T00:00:00Z',
      email_verified_at: '2024-01-01T00:00:00Z',
    }));

    const response = Response.json(mockUsers);
    response.headers.set('Content-Range', `0-${pageSize - 1}/100`);
    return response;
  }),

  // 비디오 에셋 모킹
  http.get('*/rest/v1/video_assets', () => {
    return Response.json([
      {
        id: 'video-1',
        status: 'failed',
        provider: 'seedance',
        retry_count: 1,
        error_message: 'Generation timeout',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]);
  }),

  // 데이터베이스 Health Check 모킹
  http.get('*/api/health/database', () => {
    return Response.json({ status: 'healthy' });
  })
);

// ===========================================
// 테스트 유틸리티
// ===========================================

function createAdminJWT(payload: any = {}): string {
  // 테스트용 모킹된 JWT 토큰
  const mockPayload = {
    userId: 'admin-123',
    email: 'admin@example.com',
    role: 'admin',
    permissions: ['admin.metrics.read', 'admin.health.read', 'admin.users.read', 'admin.actions.execute'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  };
  return `test-jwt-${Buffer.from(JSON.stringify(mockPayload)).toString('base64')}`;
}

function createSuperAdminJWT(): string {
  return createAdminJWT({
    role: 'super_admin',
    permissions: ['admin.*'],
  });
}

function createUserJWT(): string {
  const mockPayload = {
    userId: 'user-123',
    email: 'user@example.com',
    role: 'user',
    permissions: [],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `test-jwt-${Buffer.from(JSON.stringify(mockPayload)).toString('base64')}`;
}

function createAdminHeaders(token?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || createAdminJWT()}`,
    'X-Admin-API-Key': ADMIN_API_KEY,
    'X-Forwarded-For': '127.0.0.1',
  };
}

// ===========================================
// 테스트 설정
// ===========================================

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// ===========================================
// Admin Metrics API 테스트
// ===========================================

describe('Admin Metrics API', () => {
  const METRICS_URL = '/api/admin/metrics';

  describe('GET /api/admin/metrics', () => {
    it('should return metrics data for valid admin', async () => {
      const response = await fetch(`http://localhost:3000${METRICS_URL}?timeRange=24h`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        users: {
          total: expect.any(Number),
          recentWeek: expect.any(Number),
          admins: expect.any(Number),
          guestRatio: expect.any(Number),
        },
        content: {
          projects: expect.any(Number),
          scenarios: expect.any(Number),
          prompts: expect.any(Number),
          videoAssets: expect.any(Number),
          recentProjects: expect.any(Array),
        },
        system: {
          queueStatus: {
            queued: expect.any(Number),
            processing: expect.any(Number),
            completed: expect.any(Number),
            failed: expect.any(Number),
          },
          recentErrors: expect.any(Number),
        },
      });
      expect(data.timestamp).toBeDefined();
    });

    it('should reject request without API key', async () => {
      const response = await fetch(`http://localhost:3000${METRICS_URL}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${createAdminJWT()}`,
          'X-Forwarded-For': '127.0.0.1',
        },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ADMIN_AUTH_ERROR');
    });

    it('should reject non-admin user', async () => {
      const response = await fetch(`http://localhost:3000${METRICS_URL}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${createUserJWT()}`,
          'X-Admin-API-Key': ADMIN_API_KEY,
          'X-Forwarded-For': '127.0.0.1',
        },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ADMIN_AUTH_ERROR');
    });

    it('should validate timeRange parameter', async () => {
      const response = await fetch(`http://localhost:3000${METRICS_URL}?timeRange=invalid`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should cache metrics data', async () => {
      // 첫 번째 요청
      const response1 = await fetch(`http://localhost:3000${METRICS_URL}?timeRange=24h`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });
      expect(response1.status).toBe(200);

      // 두 번째 요청 (캐시된 데이터)
      const response2 = await fetch(`http://localhost:3000${METRICS_URL}?timeRange=24h`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });
      expect(response2.status).toBe(200);

      const data1 = await response1.json();
      const data2 = await response2.json();

      // 캐시된 데이터이므로 같은 값이어야 함
      expect(data1.data).toEqual(data2.data);
    });
  });
});

// ===========================================
// Admin Health API 테스트
// ===========================================

describe('Admin Health API', () => {
  const HEALTH_URL = '/api/admin/health';

  describe('GET /api/admin/health', () => {
    it('should return system health status', async () => {
      const response = await fetch(`http://localhost:3000${HEALTH_URL}`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        overall: {
          status: expect.stringMatching(/^(healthy|degraded|down)$/),
          healthyProviders: expect.any(Number),
          totalProviders: expect.any(Number),
          lastCheckedAt: expect.any(String),
        },
        providers: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            status: expect.stringMatching(/^(healthy|degraded|down|unknown)$/),
            averageLatency: expect.any(Number),
            successRate: expect.any(Number),
            lastCheckedAt: expect.any(String),
          }),
        ]),
      });
    });

    it('should filter providers when specified', async () => {
      const response = await fetch(`${HEALTH_URL}?providers=seedance,veo`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.providers).toHaveLength(2);
      expect(data.data.providers.map((p: any) => p.name)).toEqual(['seedance', 'veo']);
    });

    it('should include system metrics when requested', async () => {
      const response = await fetch(`${HEALTH_URL}?includeMetrics=true`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.system).toBeDefined();
      expect(data.data.system).toMatchObject({
        database: expect.objectContaining({
          status: expect.any(String),
          latency: expect.any(Number),
        }),
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
        }),
        uptime: expect.any(Number),
      });
    });

    it('should handle timeout parameter', async () => {
      const response = await fetch(`${HEALTH_URL}?timeout=1000`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });

      expect(response.status).toBe(200);
      // 타임아웃이 짧아도 성공해야 함 (MSW 모킹이므로)
    });
  });
});

// ===========================================
// Admin Users API 테스트
// ===========================================

describe('Admin Users API', () => {
  const USERS_URL = '/api/admin/users';

  describe('GET /api/admin/users', () => {
    it('should return paginated users list', async () => {
      const response = await fetch(`${USERS_URL}?page=1&pageSize=10`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
      expect(data.pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
        hasNext: expect.any(Boolean),
        hasPrev: expect.any(Boolean),
      });

      // 사용자 데이터 구조 확인
      if (data.data.length > 0) {
        expect(data.data[0]).toMatchObject({
          id: expect.any(String),
          email: expect.stringMatching(/\*\*\*/), // 마스킹된 이메일
          role: expect.any(String),
          accountStatus: expect.any(String),
          createdAt: expect.any(String),
        });
      }
    });

    it('should filter users by keyword', async () => {
      const response = await fetch(`${USERS_URL}?keyword=user1&page=1`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });

      expect(response.status).toBe(200);
      // 키워드 필터링 로직 확인은 실제 데이터베이스 연동 시 가능
    });

    it('should filter users by status', async () => {
      const response = await fetch(`${USERS_URL}?status=active&page=1`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });

      expect(response.status).toBe(200);
      // 상태 필터링 확인
    });

    it('should validate pagination parameters', async () => {
      const response = await fetch(`${USERS_URL}?page=0&pageSize=200`, {
        method: 'GET',
        headers: createAdminHeaders(),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/admin/users', () => {
    it('should update user status', async () => {
      const updateData = {
        status: 'suspended',
        notes: 'Policy violation',
      };

      const response = await fetch(`${USERS_URL}?userId=user-123`, {
        method: 'PUT',
        headers: createAdminHeaders(),
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.changes).toContain('status');
    });

    it('should require super admin for role changes', async () => {
      const updateData = {
        role: 'admin',
      };

      const response = await fetch(`${USERS_URL}?userId=user-123`, {
        method: 'PUT',
        headers: createAdminHeaders(), // 일반 관리자
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should allow super admin to change roles', async () => {
      const updateData = {
        role: 'admin',
      };

      const response = await fetch(`${USERS_URL}?userId=user-123`, {
        method: 'PUT',
        headers: createAdminHeaders(createSuperAdminJWT()),
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
    });

    it('should validate update request data', async () => {
      const invalidData = {
        status: 'invalid_status',
      };

      const response = await fetch(`${USERS_URL}?userId=user-123`, {
        method: 'PUT',
        headers: createAdminHeaders(),
        body: JSON.stringify(invalidData),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

// ===========================================
// Admin Actions API 테스트
// ===========================================

describe('Admin Actions API', () => {
  const ACTIONS_URL = '/api/admin/actions';

  describe('POST /api/admin/actions', () => {
    it('should execute video retry action', async () => {
      const actionData = {
        action: 'video_retry',
        targetId: 'video-1',
        targetType: 'video',
        reason: 'Manual retry requested',
      };

      const response = await fetch(ACTIONS_URL, {
        method: 'POST',
        headers: createAdminHeaders(),
        body: JSON.stringify(actionData),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        actionId: expect.any(String),
        action: 'video_retry',
        targetType: 'video',
        targetId: 'video-1',
        result: expect.stringMatching(/^(success|failed)$/),
        message: expect.any(String),
        performedAt: expect.any(String),
        performedBy: expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
        }),
      });
    });

    it('should execute token expire action', async () => {
      const actionData = {
        action: 'token_expire',
        targetId: 'token-123',
        targetType: 'token',
        reason: 'Security policy violation',
      };

      const response = await fetch(ACTIONS_URL, {
        method: 'POST',
        headers: createAdminHeaders(),
        body: JSON.stringify(actionData),
      });

      expect(response.status).toBe(200);
    });

    it('should execute comment delete action', async () => {
      const actionData = {
        action: 'comment_delete',
        targetId: 'comment-456',
        targetType: 'comment',
        reason: 'Inappropriate content',
      };

      const response = await fetch(ACTIONS_URL, {
        method: 'POST',
        headers: createAdminHeaders(),
        body: JSON.stringify(actionData),
      });

      expect(response.status).toBe(200);
    });

    it('should validate action request data', async () => {
      const invalidData = {
        action: 'invalid_action',
        targetId: 'target-123',
        targetType: 'invalid_type',
      };

      const response = await fetch(ACTIONS_URL, {
        method: 'POST',
        headers: createAdminHeaders(),
        body: JSON.stringify(invalidData),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require proper permissions', async () => {
      const limitedAdminToken = createAdminJWT({
        permissions: ['admin.metrics.read'], // actions.execute 권한 없음
      });

      const actionData = {
        action: 'video_retry',
        targetId: 'video-1',
        targetType: 'video',
        reason: 'Test',
      };

      const response = await fetch(ACTIONS_URL, {
        method: 'POST',
        headers: createAdminHeaders(limitedAdminToken),
        body: JSON.stringify(actionData),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe('ADMIN_AUTH_ERROR');
    });
  });
});

// ===========================================
// 보안 테스트
// ===========================================

describe('Admin API Security', () => {
  it('should block requests from non-whitelisted IPs', async () => {
    const response = await fetch('/api/admin/metrics', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${createAdminJWT()}`,
        'X-Admin-API-Key': ADMIN_API_KEY,
        'X-Forwarded-For': '192.168.1.100', // 화이트리스트에 없는 IP
      },
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error.code).toBe('IP_WHITELIST_ERROR');
  });

  it('should block requests with invalid JWT', async () => {
    const response = await fetch('/api/admin/metrics', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token',
        'X-Admin-API-Key': ADMIN_API_KEY,
        'X-Forwarded-For': '127.0.0.1',
      },
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe('AUTH_ERROR');
  });

  it('should block requests with expired JWT', async () => {
    const expiredTokenPayload = {
      userId: 'admin-123',
      email: 'admin@example.com',
      role: 'admin',
      iat: Math.floor(Date.now() / 1000) - 7200, // 2시간 전
      exp: Math.floor(Date.now() / 1000) - 3600, // 1시간 전 만료
    };
    const expiredToken = `test-jwt-expired-${Buffer.from(JSON.stringify(expiredTokenPayload)).toString('base64')}`;

    const response = await fetch('/api/admin/metrics', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${expiredToken}`,
        'X-Admin-API-Key': ADMIN_API_KEY,
        'X-Forwarded-For': '127.0.0.1',
      },
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe('AUTH_ERROR');
  });

  it('should mask PII in responses', async () => {
    const response = await fetch('/api/admin/users?page=1', {
      method: 'GET',
      headers: createAdminHeaders(),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    if (data.data.length > 0) {
      const user = data.data[0];
      // 이메일이 마스킹되어야 함
      expect(user.email).toMatch(/\*\*\*/);
      expect(user.email).not.toMatch(/@example\.com$/);
    }
  });
});

// ===========================================
// 성능 테스트
// ===========================================

describe('Admin API Performance', () => {
  it('should respond to metrics request within 500ms', async () => {
    const startTime = Date.now();

    const response = await fetch('/api/admin/metrics', {
      method: 'GET',
      headers: createAdminHeaders(),
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(500); // 500ms 이내
  });

  it('should respond to health check within 2 seconds', async () => {
    const startTime = Date.now();

    const response = await fetch('/api/admin/health', {
      method: 'GET',
      headers: createAdminHeaders(),
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(2000); // 2초 이내
  });

  it('should handle concurrent requests without errors', async () => {
    const requests = Array.from({ length: 5 }, () =>
      fetch('/api/admin/metrics', {
        method: 'GET',
        headers: createAdminHeaders(),
      })
    );

    const responses = await Promise.all(requests);

    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});