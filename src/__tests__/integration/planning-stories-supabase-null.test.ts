/**
 * Planning Stories Supabase Null Error 시나리오 테스트
 * Supabase 연결 실패 및 null 에러 상황에서의 graceful degradation 검증
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/planning/stories/route';
import { getPlanningRepository } from '@/entities/planning';
import { ServiceConfigError } from '@/shared/lib/supabase-safe';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@/entities/planning');
vi.mock('@/shared/lib/auth-middleware-v2', () => ({
  withOptionalAuth: (handler: any) => handler
}));

const mockRepository = {
  findByUserId: vi.fn(),
  save: vi.fn(),
  getStorageHealth: vi.fn()
};

const mockGetPlanningRepository = getPlanningRepository as any;

describe('Planning Stories Supabase Null Error Scenarios', () => {
  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com'
  };

  const mockAuthContext = {
    status: 'authenticated' as const,
    degradationMode: 'normal' as const
  };

  const mockGuestUser = {
    id: null,
    email: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlanningRepository.mockReturnValue(mockRepository as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/planning/stories - Supabase 연결 실패 시나리오', () => {
    it('Supabase 연결 실패 시에도 에러를 graceful하게 처리', async () => {
      // Arrange
      mockRepository.findByUserId.mockRejectedValue(
        new ServiceConfigError('SUPABASE_URL이 설정되지 않았습니다.', 'MISSING_CONFIG', 503)
      );

      const request = new NextRequest('http://localhost:3000/api/planning/stories?page=1&limit=10');

      // Act
      const response = await GET(request, { user: mockUser, authContext: mockAuthContext });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.degraded).toBe(true);
      expect(responseData.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining('MISSING_CONFIG')
      ]));
    });

    it('네트워크 연결 오류 시 적절한 에러 메시지 반환', async () => {
      // Arrange
      mockRepository.findByUserId.mockRejectedValue(
        new Error('fetch failed: ENOTFOUND')
      );

      const request = new NextRequest('http://localhost:3000/api/planning/stories?page=1&limit=10');

      // Act
      const response = await GET(request, { user: mockUser, authContext: mockAuthContext });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining('fetch failed')
      ]));
    });

    it('빈 데이터베이스에서 빈 배열 반환', async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue([]);
      mockRepository.getStorageHealth.mockReturnValue({
        prisma: { isHealthy: true },
        supabase: { isHealthy: true }
      });

      const request = new NextRequest('http://localhost:3000/api/planning/stories?page=1&limit=10');

      // Act
      const response = await GET(request, { user: mockUser, authContext: mockAuthContext });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.stories).toEqual([]);
      expect(responseData.data.total).toBe(0);
    });

    it('게스트 사용자로 stories 조회', async () => {
      // Arrange
      mockRepository.findByUserId.mockResolvedValue([]);
      mockRepository.getStorageHealth.mockReturnValue({
        prisma: { isHealthy: true },
        supabase: { isHealthy: false, lastError: 'Connection failed' }
      });

      const request = new NextRequest('http://localhost:3000/api/planning/stories?page=1&limit=10');

      // Act
      const response = await GET(request, { user: mockGuestUser, authContext: mockAuthContext });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.degraded).toBe(true);
      expect(responseData.storageStatus).toMatchObject({
        prisma: 'healthy',
        supabase: 'failed'
      });
      expect(mockRepository.findByUserId).toHaveBeenCalledWith('guest');
    });

    it('null/undefined 필드가 포함된 scenario 데이터 처리', async () => {
      // Arrange
      const mockScenarioWithNulls = {
        id: 'scenario-1',
        type: 'scenario',
        title: null, // null title
        story: undefined, // undefined story
        genre: '',
        tone: null,
        target: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: null
      };

      mockRepository.findByUserId.mockResolvedValue([mockScenarioWithNulls]);
      mockRepository.getStorageHealth.mockReturnValue({
        prisma: { isHealthy: true },
        supabase: { isHealthy: true }
      });

      const request = new NextRequest('http://localhost:3000/api/planning/stories?page=1&limit=10');

      // Act
      const response = await GET(request, { user: mockUser, authContext: mockAuthContext });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.data.stories).toHaveLength(1);

      const story = responseData.data.stories[0];
      expect(story.title).toBe('Untitled Story'); // null -> default
      expect(story.content).toBe(''); // undefined -> empty string
      expect(story.genre).toBe('General'); // empty -> default
      expect(story.tone).toBe('Neutral'); // null -> default
      expect(story.targetAudience).toBe('General'); // undefined -> default
    });

    it('잘못된 쿼리 파라미터에 대해 400 에러 반환', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/planning/stories?page=invalid&limit=-1');

      // Act
      const response = await GET(request, { user: mockUser, authContext: mockAuthContext });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
    });
  });

  describe('POST /api/planning/stories - Supabase 저장 실패 시나리오', () => {
    it('Supabase 저장 실패 시 적절한 에러 응답', async () => {
      // Arrange
      const validStoryPayload = {
        title: '테스트 스토리',
        content: '스토리 내용입니다. 최소 10자 이상이어야 하므로 더 긴 내용을 작성합니다.',
        genre: 'Fantasy',
        tone: 'Whimsical',
        targetAudience: 'Young Adults'
      };

      mockRepository.save.mockResolvedValue({
        success: false,
        error: 'Supabase connection timeout'
      });

      const request = new NextRequest('http://localhost:3000/api/planning/stories', {
        method: 'POST',
        body: JSON.stringify(validStoryPayload),
        headers: { 'Content-Type': 'application/json' }
      });

      // Act
      const response = await POST(request, { user: mockUser, authContext: mockAuthContext });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.degraded).toBe(true);
      expect(responseData.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining('connection timeout')
      ]));
    });

    it('게스트 사용자의 story 생성', async () => {
      // Arrange
      const validStoryPayload = {
        title: '게스트 스토리',
        content: '게스트가 만든 스토리입니다. 최소 10자 이상의 내용이 필요합니다.',
        genre: 'Drama'
      };

      const mockSavedId = 'scenario-guest-123';
      mockRepository.save.mockResolvedValue({
        success: true,
        id: mockSavedId
      });

      mockRepository.getStorageHealth.mockReturnValue({
        prisma: { isHealthy: true },
        supabase: { isHealthy: false }
      });

      const request = new NextRequest('http://localhost:3000/api/planning/stories', {
        method: 'POST',
        body: JSON.stringify(validStoryPayload),
        headers: { 'Content-Type': 'application/json' }
      });

      // Act
      const response = await POST(request, { user: mockGuestUser, authContext: mockAuthContext });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.data.userId).toBeNull();
      expect(responseData.degraded).toBe(true);
      expect(responseData.storageStatus).toMatchObject({
        prisma: 'healthy',
        supabase: 'failed'
      });

      // ScenarioContent 구조 확인
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedContent = mockRepository.save.mock.calls[0][0];
      expect(savedContent).toMatchObject({
        type: 'scenario',
        title: '게스트 스토리',
        story: '게스트가 만든 스토리입니다. 최소 10자 이상의 내용이 필요합니다.',
        metadata: {
          createdBy: undefined,
          author: 'guest'
        }
      });
    });

    it('필수 필드 누락 시 400 에러 반환', async () => {
      // Arrange
      const invalidPayload = {
        // title 누락
        content: '내용만 있는 스토리입니다. 최소 10자 이상의 긴 내용입니다.',
        genre: 'Comedy'
      };

      const request = new NextRequest('http://localhost:3000/api/planning/stories', {
        method: 'POST',
        body: JSON.stringify(invalidPayload),
        headers: { 'Content-Type': 'application/json' }
      });

      // Act
      const response = await POST(request, { user: mockUser, authContext: mockAuthContext });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBeDefined();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('매우 긴 content가 포함된 story 저장', async () => {
      // Arrange
      const longContent = 'A'.repeat(4500); // 4.5KB content (under 5KB limit)
      const validStoryPayload = {
        title: '긴 스토리',
        content: longContent,
        genre: 'Drama'
      };

      mockRepository.save.mockResolvedValue({
        success: true,
        id: 'scenario-long-123'
      });

      mockRepository.getStorageHealth.mockReturnValue({
        prisma: { isHealthy: true },
        supabase: { isHealthy: true }
      });

      const request = new NextRequest('http://localhost:3000/api/planning/stories', {
        method: 'POST',
        body: JSON.stringify(validStoryPayload),
        headers: { 'Content-Type': 'application/json' }
      });

      // Act
      const response = await POST(request, { user: mockUser, authContext: mockAuthContext });
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);

      // oneLineStory가 적절히 잘렸는지 확인
      const story = responseData.data;
      expect(story.oneLineStory).toHaveLength(203); // 200 + '...'
      expect(story.oneLineStory.endsWith('...')).toBe(true);
    });

    it('동시 저장 요청 처리', async () => {
      // Arrange
      const story1 = { title: '스토리 1', content: '내용 1 최소 10자 이상의 긴 내용입니다.', genre: 'Action' };
      const story2 = { title: '스토리 2', content: '내용 2 최소 10자 이상의 긴 내용입니다.', genre: 'Romance' };

      mockRepository.save
        .mockResolvedValueOnce({ success: true, id: 'scenario-1' })
        .mockResolvedValueOnce({ success: true, id: 'scenario-2' });

      mockRepository.getStorageHealth.mockReturnValue({
        prisma: { isHealthy: true },
        supabase: { isHealthy: true }
      });

      const request1 = new NextRequest('http://localhost:3000/api/planning/stories', {
        method: 'POST',
        body: JSON.stringify(story1),
        headers: { 'Content-Type': 'application/json' }
      });

      const request2 = new NextRequest('http://localhost:3000/api/planning/stories', {
        method: 'POST',
        body: JSON.stringify(story2),
        headers: { 'Content-Type': 'application/json' }
      });

      // Act
      const [response1, response2] = await Promise.all([
        POST(request1, { user: mockUser, authContext: mockAuthContext }),
        POST(request2, { user: mockUser, authContext: mockAuthContext })
      ]);

      // Assert
      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });
  });
});