/**
 * 피드백 시스템 API 테스트
 *
 * TDD 방식으로 작성된 피드백 시스템의 핵심 API 테스트 스위트
 * Red → Green → Refactor 사이클을 따름
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMocks } from 'node-mocks-http';

// API 라우트 imports
import { GET as getFeedbackProjects, POST as createFeedbackProject } from '@/app/api/feedback/projects/route';
import { GET as getFeedbackProject, PUT as updateFeedbackProject } from '@/app/api/feedback/projects/[id]/route';
import { GET as getSharedProject } from '@/app/api/feedback/share/[token]/route';

// 모킹
jest.mock('@/shared/api/supabase-client', () => ({
  supabaseClient: {
    getCurrentUser: jest.fn(),
    safeQuery: jest.fn(),
    safeRpc: jest.fn(),
    getPublicUrl: jest.fn(),
  },
}));

jest.mock('@/shared/lib/crypto-utils', () => ({
  generateSecureToken: jest.fn(() => 'mock-token-123'),
  generateGuestId: jest.fn(() => 'guest-456'),
}));

// 테스트 데이터
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: {
    display_name: 'Test User',
  },
};

const mockProject = {
  id: 'project-123',
  title: 'Test Feedback Project',
  description: 'A test project for feedback',
  owner_id: 'user-123',
  status: 'draft',
  max_video_slots: 3,
  is_public: false,
  guest_access_enabled: true,
  require_auth: false,
  share_token: 'mock-token-123',
  created_at: '2025-01-22T00:00:00Z',
  updated_at: '2025-01-22T00:00:00Z',
  is_deleted: false,
};

// ===========================================
// 피드백 프로젝트 CRUD 테스트
// ===========================================

describe('Feedback Projects API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/feedback/projects', () => {
    it('should create a new feedback project successfully', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);
      (supabaseClient.safeQuery as any)
        .mockResolvedValueOnce({ data: mockProject, error: null }) // 프로젝트 생성
        .mockResolvedValueOnce({ data: { id: 'participant-123' }, error: null }) // 참여자 추가
        .mockResolvedValueOnce({ data: { id: 'activity-123' }, error: null }); // 활동 로그

      const requestBody = {
        title: 'Test Feedback Project',
        description: 'A test project for feedback',
        max_video_slots: 3,
        is_public: false,
        guest_access_enabled: true,
      };

      const request = new NextRequest('http://localhost/api/feedback/projects', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await createFeedbackProject(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        title: 'Test Feedback Project',
        description: 'A test project for feedback',
        max_video_slots: 3,
      });
      expect(responseData.data.share_url).toContain('mock-token-123');
    });

    it('should reject request without authentication', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.getCurrentUser as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/feedback/projects', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test Project' }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await createFeedbackProject(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Authentication required');
    });

    it('should validate required fields', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost/api/feedback/projects', {
        method: 'POST',
        body: JSON.stringify({}), // 빈 요청
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await createFeedbackProject(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid request data');
      expect(responseData.details).toBeDefined();
    });
  });

  describe('GET /api/feedback/projects', () => {
    it('should return user feedback projects', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);
      (supabaseClient.safeQuery as any)
        .mockResolvedValueOnce({
          data: [{ ...mockProject, participants: [{ role: 'owner' }] }],
          error: null,
        })
        .mockResolvedValueOnce({ data: { count: 1 }, error: null });

      const request = new NextRequest('http://localhost/api/feedback/projects');

      // Act
      const response = await getFeedbackProjects(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toHaveLength(1);
      expect(responseData.data[0]).toMatchObject({
        id: 'project-123',
        title: 'Test Feedback Project',
        user_role: 'owner',
      });
    });

    it('should support pagination', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);
      (supabaseClient.safeQuery as any)
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: { count: 0 }, error: null });

      const request = new NextRequest(
        'http://localhost/api/feedback/projects?limit=10&offset=0'
      );

      // Act
      const response = await getFeedbackProjects(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.pagination).toMatchObject({
        total: 0,
        limit: 10,
        offset: 0,
        has_more: false,
      });
    });
  });
});

// ===========================================
// 게스트 공유 테스트
// ===========================================

describe('Guest Share API', () => {
  describe('GET /api/feedback/share/[token]', () => {
    it('should allow access with valid share token', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.safeRpc as any).mockResolvedValue({
        data: [{ project_id: 'project-123', access_granted: true, access_level: 'guest' }],
      });
      (supabaseClient.safeQuery as any).mockResolvedValue({
        data: {
          ...mockProject,
          owner: { display_name: 'Project Owner' },
          video_slots: [],
        },
        error: null,
      });
      (supabaseClient.getPublicUrl as any).mockReturnValue('https://example.com/thumbnail.jpg');

      const request = new NextRequest('http://localhost/api/feedback/share/mock-token-123');

      // Act
      const response = await getSharedProject(request, { params: { token: 'mock-token-123' } });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        id: 'project-123',
        title: 'Test Feedback Project',
        access_level: 'guest',
      });
      expect(responseData.data.guest_permissions).toBeDefined();
    });

    it('should reject invalid share token', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.safeRpc as any).mockResolvedValue({
        data: [{ access_granted: false }],
      });

      const request = new NextRequest('http://localhost/api/feedback/share/invalid-token');

      // Act
      const response = await getSharedProject(request, { params: { token: 'invalid-token' } });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Invalid or expired share link');
    });
  });
});

// ===========================================
// 프로젝트 상세 및 수정 테스트
// ===========================================

describe('Individual Project API', () => {
  describe('GET /api/feedback/projects/[id]', () => {
    it('should return project details with user permissions', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);
      (supabaseClient.safeQuery as any).mockResolvedValue({
        data: {
          ...mockProject,
          participants: [{ role: 'owner', permissions: { can_view: true } }],
          video_slots: [],
          recent_activity: [],
        },
        error: null,
      });
      (supabaseClient.safeRpc as any).mockResolvedValue({
        data: [{ total_videos: 0, total_feedbacks: 0 }],
      });

      const request = new NextRequest('http://localhost/api/feedback/projects/project-123');

      // Act
      const response = await getFeedbackProject(request, { params: { id: 'project-123' } });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toMatchObject({
        id: 'project-123',
        title: 'Test Feedback Project',
        user_role: 'owner',
      });
      expect(responseData.data.stats).toBeDefined();
    });

    it('should deny access to unauthorized users', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);
      (supabaseClient.safeQuery as any).mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' },
      });

      const request = new NextRequest('http://localhost/api/feedback/projects/project-123');

      // Act
      const response = await getFeedbackProject(request, { params: { id: 'project-123' } });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Project not found');
    });
  });

  describe('PUT /api/feedback/projects/[id]', () => {
    it('should update project with owner permissions', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);
      (supabaseClient.safeQuery as any)
        .mockResolvedValueOnce({
          data: { participants: [{ role: 'owner' }] },
          error: null,
        }) // 권한 확인
        .mockResolvedValueOnce({
          data: { ...mockProject, title: 'Updated Title' },
          error: null,
        }) // 업데이트
        .mockResolvedValueOnce({ data: { id: 'activity-123' }, error: null }); // 활동 로그

      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      const request = new NextRequest('http://localhost/api/feedback/projects/project-123', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await updateFeedbackProject(request, { params: { id: 'project-123' } });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.title).toBe('Updated Title');
    });

    it('should deny update to non-owner users', async () => {
      // Arrange
      const { supabaseClient } = await import('@/shared/api/supabase-client');
      (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);
      (supabaseClient.safeQuery as any).mockResolvedValue({
        data: { participants: [{ role: 'viewer' }] },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/feedback/projects/project-123', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated Title' }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await updateFeedbackProject(request, { params: { id: 'project-123' } });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(responseData.error).toBe('Insufficient permissions');
    });
  });
});

// ===========================================
// 에러 처리 테스트
// ===========================================

describe('Error Handling', () => {
  it('should handle database connection errors gracefully', async () => {
    // Arrange
    const { supabaseClient } = await import('@/shared/api/supabase-client');
    (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);
    (supabaseClient.safeQuery as any).mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed', code: 'CONNECTION_ERROR' },
    });

    const request = new NextRequest('http://localhost/api/feedback/projects');

    // Act
    const response = await getFeedbackProjects(request);
    const responseData = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(responseData.error).toBe('Failed to fetch projects');
  });

  it('should validate JSON parsing errors', async () => {
    // Arrange
    const { supabaseClient } = await import('@/shared/api/supabase-client');
    (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost/api/feedback/projects', {
      method: 'POST',
      body: 'invalid-json',
      headers: { 'Content-Type': 'application/json' },
    });

    // Act
    const response = await createFeedbackProject(request);

    // Assert
    expect(response.status).toBe(500);
  });
});

// ===========================================
// 통합 테스트
// ===========================================

describe('Integration Tests', () => {
  it('should complete full project creation and access flow', async () => {
    // Arrange
    const { supabaseClient } = await import('@/shared/api/supabase-client');
    (supabaseClient.getCurrentUser as any).mockResolvedValue(mockUser);

    // 프로젝트 생성 모킹
    (supabaseClient.safeQuery as any)
      .mockResolvedValueOnce({ data: mockProject, error: null })
      .mockResolvedValueOnce({ data: { id: 'participant-123' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'activity-123' }, error: null });

    // Act 1: Create project
    const createRequest = new NextRequest('http://localhost/api/feedback/projects', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Integration Test Project',
        guest_access_enabled: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const createResponse = await createFeedbackProject(createRequest);
    const createData = await createResponse.json();

    // 게스트 접근 모킹
    (supabaseClient.safeRpc as any).mockResolvedValue({
      data: [{ project_id: mockProject.id, access_granted: true, access_level: 'guest' }],
    });
    (supabaseClient.safeQuery as any).mockResolvedValue({
      data: { ...mockProject, owner: { display_name: 'Test User' }, video_slots: [] },
      error: null,
    });

    // Act 2: Access via share link
    const shareRequest = new NextRequest('http://localhost/api/feedback/share/mock-token-123');
    const shareResponse = await getSharedProject(shareRequest, { params: { token: 'mock-token-123' } });
    const shareData = await shareResponse.json();

    // Assert
    expect(createResponse.status).toBe(200);
    expect(createData.success).toBe(true);
    expect(shareResponse.status).toBe(200);
    expect(shareData.data.id).toBe(createData.data.id);
  });
});