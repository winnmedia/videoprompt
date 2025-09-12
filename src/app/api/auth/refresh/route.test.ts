import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock modules
vi.mock('@/lib/db');
vi.mock('jsonwebtoken');
vi.mock('@/shared/lib/api-response');
vi.mock('@/shared/lib/cors-utils');

// Import mocked modules after mocking
const { prisma } = await import('@/lib/db');
const jwt = await import('jsonwebtoken');
const { success, failure, getTraceId } = await import('@/shared/lib/api-response');
const { addCorsHeaders } = await import('@/shared/lib/cors-utils');

const mockPrisma = prisma as any;
const mockJwt = jwt as any;
const mockSuccess = success as any;
const mockFailure = failure as any;
const mockGetTraceId = getTraceId as any;
const mockAddCorsHeaders = addCorsHeaders as any;

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    
    // Default mock implementations
    mockGetTraceId.mockReturnValue('test-trace-id');
    mockAddCorsHeaders.mockImplementation((response: any) => response);
    mockSuccess.mockImplementation((data: any, status: number, traceId: string) => ({
      json: () => Promise.resolve({ status: 'success', data }),
      status,
      cookies: { set: vi.fn() }
    }));
    mockFailure.mockImplementation((code: string, message: string, status: number, details: any, traceId: string) => ({
      json: () => Promise.resolve({ status: 'error', error: { code, message } }),
      status
    }));
  });

  it('refresh token이 없으면 401 오류를 반환해야 한다', async () => {
    // Arrange
    const request = new NextRequest('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(mockFailure).toHaveBeenCalledWith(
      'MISSING_REFRESH_TOKEN',
      'Refresh token이 필요합니다.',
      401,
      undefined,
      'test-trace-id'
    );
  });

  it('유효하지 않은 refresh token이면 401 오류를 반환해야 한다', async () => {
    // Arrange
    const invalidToken = 'invalid-refresh-token';
    const request = new NextRequest('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 
        'content-type': 'application/json',
        'Cookie': `refresh_token=${invalidToken}`,
      },
    });

    mockJwt.verify.mockReturnValue({ sub: 'user-123', type: 'refresh' });
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

    // Act
    const response = await POST(request);

    // Assert
    expect(mockFailure).toHaveBeenCalledWith(
      'INVALID_REFRESH_TOKEN',
      'Refresh token을 찾을 수 없습니다.',
      401,
      undefined,
      'test-trace-id'
    );
  });

  it('만료된 refresh token이면 401 오류를 반환해야 한다', async () => {
    // Arrange
    const expiredToken = 'expired-refresh-token';
    const request = new NextRequest('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 
        'content-type': 'application/json',
        'Cookie': `refresh_token=${expiredToken}`,
      },
    });

    mockJwt.verify.mockReturnValue({ sub: 'user-123', type: 'refresh' });
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-id',
      token: expiredToken,
      userId: 'user-123',
      expiresAt: new Date(Date.now() - 1000), // 1초 전에 만료
      revokedAt: null,
      usedAt: null,
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(mockFailure).toHaveBeenCalledWith(
      'REFRESH_TOKEN_EXPIRED',
      'Refresh token이 만료되었습니다.',
      401,
      undefined,
      'test-trace-id'
    );
  });

  it('이미 사용된 refresh token이면 모든 토큰을 취소하고 401 오류를 반환해야 한다', async () => {
    // Arrange
    const usedToken = 'used-refresh-token';
    const userId = 'user-123';
    const request = new NextRequest('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 
        'content-type': 'application/json',
        'Cookie': `refresh_token=${usedToken}`,
      },
    });

    mockJwt.verify.mockReturnValue({ sub: userId, type: 'refresh' });
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-id',
      token: usedToken,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      usedAt: new Date(), // 이미 사용됨
    });
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

    // Act
    const response = await POST(request);

    // Assert
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId }
    });
    expect(mockFailure).toHaveBeenCalledWith(
      'TOKEN_REUSE_DETECTED',
      '토큰 재사용이 감지되었습니다. 보안을 위해 모든 세션이 종료되었습니다.',
      401,
      undefined,
      'test-trace-id'
    );
  });

  it('유효한 refresh token으로 새 access token을 발급해야 한다', async () => {
    // Arrange
    const refreshToken = 'valid-refresh-token';
    const userId = 'user-123';
    const newAccessToken = 'new-access-token';
    const newRefreshToken = 'new-refresh-token';

    const request = new NextRequest('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 
        'content-type': 'application/json',
        'Cookie': `refresh_token=${refreshToken}`,
        'user-agent': 'test-agent',
      },
    });

    mockJwt.verify.mockReturnValue({ sub: userId, type: 'refresh', deviceId: 'device-123' });
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-id',
      token: refreshToken,
      userId,
      deviceId: 'device-123',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
      revokedAt: null,
      usedAt: null,
      createdAt: new Date(),
      user: {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
      }
    });

    mockJwt.sign
      .mockReturnValueOnce(newAccessToken) // access token
      .mockReturnValueOnce(newRefreshToken); // refresh token

    mockPrisma.refreshToken.update.mockResolvedValue({});
    mockPrisma.refreshToken.create.mockResolvedValue({});

    // Act
    const response = await POST(request);

    // Assert
    expect(mockSuccess).toHaveBeenCalledWith({
      accessToken: newAccessToken,
      user: {
        id: userId,
        email: 'test@example.com',
        username: 'testuser'
      }
    }, 200, 'test-trace-id');

    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
      where: { token: refreshToken },
      data: { usedAt: expect.any(Date) }
    });

    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        token: newRefreshToken,
        userId,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        expiresAt: expect.any(Date)
      })
    });
  });
});