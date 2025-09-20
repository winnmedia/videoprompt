/**
 * Planning Register Dual Storage 통합 테스트
 * 단순화된 /api/planning/register 엔드포인트의 dual-storage 기능 검증
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/planning/register/route';
import { getPlanningRepository } from '@/entities/planning';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@/entities/planning');
vi.mock('@/shared/lib/auth-middleware-v2', () => ({
  withAuth: (handler: any) => handler
}));

const mockRepository = {
  save: vi.fn(),
  getStorageHealth: vi.fn()
};

const mockGetPlanningRepository = getPlanningRepository as any;

describe('Planning Register Dual Storage Integration', () => {
  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    tokenType: 'supabase' as const
  };

  const mockAuthContext = {
    status: 'authenticated' as const,
    degradationMode: 'normal' as const
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlanningRepository.mockReturnValue(mockRepository as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scenario 타입 데이터를 dual-storage에 성공적으로 저장', async () => {
    // Arrange
    const validPayload = {
      type: 'scenario' as const,
      projectId: 'project-123',
      source: 'ai-generated',
      createdAt: new Date().toISOString(),
      title: '테스트 시나리오',
      story: '흥미진진한 이야기입니다.',
      genre: 'SciFi',
      tone: 'Dramatic',
      target: 'Family'
    };

    mockRepository.save.mockResolvedValue({
      success: true,
      id: 'scenario_project-123_1234567890'
    });

    mockRepository.getStorageHealth.mockReturnValue({
      prisma: { isHealthy: true },
      supabase: { isHealthy: true }
    });

    const request = new NextRequest('http://localhost:3000/api/planning/register', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' }
    });

    // Act
    const response = await POST(request, { user: mockUser, authContext: mockAuthContext });
    const responseData = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(responseData.success).toBe(true);
    expect(responseData.data).toMatchObject({
      type: 'scenario',
      title: '테스트 시나리오',
      userId: 'test-user-123',
      status: 'active'
    });

    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    const savedContent = mockRepository.save.mock.calls[0][0];
    expect(savedContent).toMatchObject({
      type: 'scenario',
      title: '테스트 시나리오',
      story: '흥미진진한 이야기입니다.',
      metadata: {
        userId: 'test-user-123',
        status: 'active'
      }
    });
  });

  it('prompt 타입 데이터를 dual-storage에 성공적으로 저장', async () => {
    // Arrange
    const validPayload = {
      type: 'prompt' as const,
      projectId: 'project-456',
      source: 'user-created',
      createdAt: new Date().toISOString(),
      scenarioTitle: '프롬프트 테스트',
      finalPrompt: '아름다운 풍경을 그려주세요',
      keywords: ['풍경', '자연'],
      visualStyle: 'realistic'
    };

    mockRepository.save.mockResolvedValue({
      success: true,
      id: 'prompt_project-456_1234567890'
    });

    mockRepository.getStorageHealth.mockReturnValue({
      prisma: { isHealthy: true },
      supabase: { isHealthy: true }
    });

    const request = new NextRequest('http://localhost:3000/api/planning/register', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' }
    });

    // Act
    const response = await POST(request, { user: mockUser, authContext: mockAuthContext });
    const responseData = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(responseData.success).toBe(true);
    expect(responseData.data.type).toBe('prompt');
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('video 타입 데이터를 dual-storage에 성공적으로 저장', async () => {
    // Arrange
    const validPayload = {
      type: 'video' as const,
      projectId: 'project-789',
      source: 'ai-generated',
      createdAt: new Date().toISOString(),
      title: '생성된 영상',
      finalPrompt: '영상 생성 프롬프트',
      provider: 'seedance',
      status: 'completed' as const,
      videoUrl: 'https://example.com/video.mp4'
    };

    mockRepository.save.mockResolvedValue({
      success: true,
      id: 'video_project-789_1234567890'
    });

    mockRepository.getStorageHealth.mockReturnValue({
      prisma: { isHealthy: true },
      supabase: { isHealthy: true }
    });

    const request = new NextRequest('http://localhost:3000/api/planning/register', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' }
    });

    // Act
    const response = await POST(request, { user: mockUser, authContext: mockAuthContext });
    const responseData = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(responseData.success).toBe(true);
    expect(responseData.data.type).toBe('video');
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('잘못된 입력 데이터에 대해 400 에러 반환', async () => {
    // Arrange
    const invalidPayload = {
      type: 'invalid-type',
      projectId: 'project-123'
      // 필수 필드 누락
    };

    const request = new NextRequest('http://localhost:3000/api/planning/register', {
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

  it('repository 저장 실패 시 500 에러 반환', async () => {
    // Arrange
    const validPayload = {
      type: 'scenario',
      projectId: 'project-123',
      source: 'ai-generated',
      createdAt: new Date().toISOString(),
      title: '테스트 시나리오',
      story: '이야기 내용'
    };

    mockRepository.save.mockResolvedValue({
      success: false,
      error: 'Database connection failed'
    });

    const request = new NextRequest('http://localhost:3000/api/planning/register', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' }
    });

    // Act
    const response = await POST(request, { user: mockUser, authContext: mockAuthContext });
    const responseData = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(responseData.success).toBe(false);
    expect(responseData.warnings).toContain('Database connection failed');
  });

  it('storage health 상태를 응답에 포함', async () => {
    // Arrange
    const validPayload = {
      type: 'scenario',
      projectId: 'project-123',
      source: 'ai-generated',
      createdAt: new Date().toISOString(),
      title: '테스트 시나리오',
      story: '이야기 내용'
    };

    mockRepository.save.mockResolvedValue({
      success: true,
      id: 'scenario_project-123_1234567890'
    });

    mockRepository.getStorageHealth.mockReturnValue({
      prisma: { isHealthy: false, lastError: 'Connection timeout' },
      supabase: { isHealthy: true }
    });

    const request = new NextRequest('http://localhost:3000/api/planning/register', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' }
    });

    // Act
    const response = await POST(request, { user: mockUser, authContext: mockAuthContext });
    const responseData = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(responseData.degraded).toBe(true);
    expect(responseData.storageStatus).toMatchObject({
      prisma: 'failed',
      supabase: 'healthy'
    });
  });

  it('매우 긴 title과 content 처리', async () => {
    // Arrange
    const longTitle = 'A'.repeat(1000);
    const longStory = 'B'.repeat(10000);

    const validPayload = {
      type: 'scenario',
      projectId: 'project-123',
      source: 'ai-generated',
      createdAt: new Date().toISOString(),
      title: longTitle,
      story: longStory
    };

    mockRepository.save.mockResolvedValue({
      success: true,
      id: 'scenario_project-123_1234567890'
    });

    mockRepository.getStorageHealth.mockReturnValue({
      prisma: { isHealthy: true },
      supabase: { isHealthy: true }
    });

    const request = new NextRequest('http://localhost:3000/api/planning/register', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' }
    });

    // Act
    const response = await POST(request, { user: mockUser, authContext: mockAuthContext });

    // Assert
    expect(response.status).toBe(201);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    const savedContent = mockRepository.save.mock.calls[0][0];
    expect(savedContent.title).toBe(longTitle);
    expect(savedContent.story).toBe(longStory);
  });
});