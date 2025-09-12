import { NextRequest } from 'next/server';
import { POST } from './route';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  it('유효한 로그인 정보로 로그인하면 access token과 refresh token을 발급해야 한다', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'password123';
    const hashedPassword = 'hashed_password';
    const userId = 'user-123';

    const mockUser = {
      id: userId,
      email,
      username: 'testuser',
      passwordHash: hashedPassword,
      createdAt: new Date(),
    };

    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(true);
    
    // Mock JWT signing
    mockJwt.sign
      .mockReturnValueOnce('access-token-123') // signAccessToken
      .mockReturnValueOnce('refresh-token-123') // signRefreshToken
      .mockReturnValueOnce('legacy-token-123'); // signSessionToken

    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'refresh-id',
      token: 'refresh-token-123',
      userId,
      deviceId: 'device-123',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      usedAt: null,
      createdAt: new Date(),
    });

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'test-agent',
      },
      body: JSON.stringify({ email, password }),
    });

    // Act
    const response = await POST(request);
    const result = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(result.status).toBe('success');
    expect(result.data.accessToken).toBe('access-token-123');
    expect(result.data.token).toBe('legacy-token-123');
    expect(result.data.id).toBe(userId);
    expect(result.data.email).toBe(email);

    // Verify JWT signing calls
    expect(mockJwt.sign).toHaveBeenCalledTimes(3);
    expect(mockJwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: userId,
        email,
        username: 'testuser',
        type: 'access'
      }),
      'test-secret',
      { expiresIn: '15m' }
    );

    // Verify refresh token creation
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        token: 'refresh-token-123',
        userId,
        deviceId: expect.stringMatching(/^device_\d+_[a-z0-9]+$/),
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        expiresAt: expect.any(Date)
      }
    });

    // Verify cookies are set
    const cookies = response.cookies;
    expect(cookies.get('refresh_token')?.value).toBe('refresh-token-123');
    expect(cookies.get('session')?.value).toBe('legacy-token-123');
  });

  it('잘못된 비밀번호로 로그인하면 401 오류를 반환해야 한다', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'wrong-password';

    const mockUser = {
      id: 'user-123',
      email,
      username: 'testuser',
      passwordHash: 'hashed_password',
      createdAt: new Date(),
    };

    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    // Act
    const response = await POST(request);
    const result = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('UNAUTHORIZED');
    expect(result.error.message).toBe('비밀번호가 올바르지 않습니다.');

    // Verify no tokens are created
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('존재하지 않는 사용자로 로그인하면 404 오류를 반환해야 한다', async () => {
    // Arrange
    const email = 'nonexistent@example.com';
    const password = 'password123';

    mockPrisma.user.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    // Act
    const response = await POST(request);
    const result = await response.json();

    // Assert
    expect(response.status).toBe(404);
    expect(result.status).toBe('error');
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.message).toBe('사용자를 찾을 수 없습니다.');

    // Verify no tokens are created
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('같은 디바이스의 기존 refresh token을 정리해야 한다', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'password123';
    const userId = 'user-123';

    const mockUser = {
      id: userId,
      email,
      username: 'testuser',
      passwordHash: 'hashed_password',
      createdAt: new Date(),
    };

    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockJwt.sign.mockReturnValue('token');
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'refresh-id',
      token: 'new-refresh-token',
      userId,
      deviceId: 'device-123',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      usedAt: null,
      createdAt: new Date(),
    });

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'test-agent',
        'x-forwarded-for': '192.168.1.1',
      },
      body: JSON.stringify({ email, password }),
    });

    // Act
    await POST(request);

    // Assert
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        userId,
        userAgent: 'test-agent',
        ipAddress: '192.168.1.1'
      }
    });

    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        userAgent: 'test-agent',
        ipAddress: '192.168.1.1'
      })
    });
  });
});