/**
 * Auth API Tests
 * TDD 원칙에 따른 인증 API 테스트
 */

import {
  login,
  register,
  logout,
  getCurrentUserInfo,
  loginAsGuest,
  sendPasswordResetEmail,
  checkAuthStatus,
  AuthError,
} from './auth-api';
import {
  signInWithEmail,
  signUpWithEmail,
  signOut,
  getCurrentUser,
  getSupabaseClient,
} from '../../../shared/api';
import {
  createRegisteredUser,
  createGuestUser,
  validateUser,
} from '../../../entities';
// removed unused import

// Mock shared/api
jest.mock('../../../shared/api', () => ({
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
  signOut: jest.fn(),
  getCurrentUser: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

// Mock entities
jest.mock('../../../entities', () => ({
  createRegisteredUser: jest.fn(),
  createGuestUser: jest.fn(),
  validateUser: jest.fn(),
}));

const mockSignInWithEmail = signInWithEmail as jest.MockedFunction<
  typeof signInWithEmail
>;
const mockSignUpWithEmail = signUpWithEmail as jest.MockedFunction<
  typeof signUpWithEmail
>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
  typeof getCurrentUser
>;
const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<
  typeof getSupabaseClient
>;
const mockCreateRegisteredUser = createRegisteredUser as jest.MockedFunction<
  typeof createRegisteredUser
>;
const mockCreateGuestUser = createGuestUser as jest.MockedFunction<
  typeof createGuestUser
>;
const mockValidateUser = validateUser as jest.MockedFunction<
  typeof validateUser
>;

describe('auth-api', () => {
  // 공통 모킹 데이터를 상위 스코프로 이동
  const mockSupabaseUser = {
    id: 'user-123',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: '',
    created_at: '2024-01-01T00:00:00.000Z',
  };

  const mockSession = {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: mockSupabaseUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const validLoginRequest = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      isGuest: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('이메일이 없으면 AuthError를 던진다', async () => {
      await expect(
        login({ email: '', password: 'password123' })
      ).rejects.toThrow(AuthError);
      await expect(
        login({ email: '', password: 'password123' })
      ).rejects.toThrow('이메일과 비밀번호를 입력해주세요.');
    });

    it('비밀번호가 없으면 AuthError를 던진다', async () => {
      await expect(
        login({ email: 'test@example.com', password: '' })
      ).rejects.toThrow(AuthError);
    });

    it('성공적으로 로그인하고 AuthResponse를 반환한다', async () => {
      // Arrange
      mockSignInWithEmail.mockResolvedValue({
        user: mockSupabaseUser,
        session: mockSession,
      } as never);
      mockCreateRegisteredUser.mockReturnValue(mockUser);
      mockValidateUser.mockReturnValue({ isValid: true, errors: [] });

      // Act
      const result = await login(validLoginRequest);

      // Assert
      expect(mockSignInWithEmail).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
      expect(mockCreateRegisteredUser).toHaveBeenCalledWith(
        'test@example.com',
        'user-123'
      );
      expect(mockValidateUser).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({
        user: mockUser,
        token: 'mock-token',
      });
    });

    it('Supabase 로그인 실패 시 AuthError를 던진다', async () => {
      mockSignInWithEmail.mockRejectedValue(
        new Error('이메일 또는 비밀번호가 올바르지 않습니다')
      );

      await expect(login(validLoginRequest)).rejects.toThrow(AuthError);
      await expect(login(validLoginRequest)).rejects.toThrow(
        '로그인 중 오류가 발생했습니다.'
      );
    });

    it('사용자 검증 실패 시 AuthError를 던진다', async () => {
      mockSignInWithEmail.mockResolvedValue({
        user: mockSupabaseUser,
        session: mockSession,
      } as never);
      mockCreateRegisteredUser.mockReturnValue(mockUser);
      mockValidateUser.mockReturnValue({
        isValid: false,
        errors: ['Invalid email'],
      });

      await expect(login(validLoginRequest)).rejects.toThrow(AuthError);
      await expect(login(validLoginRequest)).rejects.toThrow(
        '사용자 정보 검증 실패: Invalid email'
      );
    });
  });

  describe('register', () => {
    const validRegisterRequest = {
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    };

    it('이메일이 없으면 AuthError를 던진다', async () => {
      await expect(
        register({ ...validRegisterRequest, email: '' })
      ).rejects.toThrow('모든 필드를 입력해주세요.');
    });

    it('비밀번호가 일치하지 않으면 AuthError를 던진다', async () => {
      await expect(
        register({ ...validRegisterRequest, confirmPassword: 'different' })
      ).rejects.toThrow('비밀번호가 일치하지 않습니다.');
    });

    it('비밀번호가 8자 미만이면 AuthError를 던진다', async () => {
      await expect(
        register({
          ...validRegisterRequest,
          password: '123',
          confirmPassword: '123',
        })
      ).rejects.toThrow('비밀번호는 8자 이상이어야 합니다.');
    });

    it('성공적으로 회원가입하고 AuthResponse를 반환한다', async () => {
      const registerMockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isGuest: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockSignUpWithEmail.mockResolvedValue({
        user: mockSupabaseUser,
        session: mockSession,
      } as never);
      mockCreateRegisteredUser.mockReturnValue(registerMockUser);
      mockValidateUser.mockReturnValue({ isValid: true, errors: [] });

      const result = await register(validRegisterRequest);

      expect(result).toEqual({
        user: registerMockUser,
        token: 'mock-token',
      });
    });
  });

  describe('logout', () => {
    it('성공적으로 로그아웃한다', async () => {
      mockSignOut.mockResolvedValue(true);

      await expect(logout()).resolves.toBeUndefined();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('로그아웃 실패 시 AuthError를 던진다', async () => {
      mockSignOut.mockRejectedValue(new Error('Logout failed'));

      await expect(logout()).rejects.toThrow(AuthError);
    });
  });

  describe('getCurrentUserInfo', () => {
    it('사용자 정보를 반환한다', async () => {
      const getUserMockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        isGuest: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockGetCurrentUser.mockResolvedValue(mockSupabaseUser);
      mockCreateRegisteredUser.mockReturnValue(getUserMockUser);
      mockValidateUser.mockReturnValue({ isValid: true, errors: [] });

      const result = await getCurrentUserInfo();

      expect(result).toEqual(getUserMockUser);
    });

    it('사용자가 없으면 null을 반환한다', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getCurrentUserInfo();

      expect(result).toBeNull();
    });

    it('사용자 검증 실패 시 null을 반환한다', async () => {
      mockGetCurrentUser.mockResolvedValue(mockSupabaseUser);
      const invalidMockUser = {
        id: 'user-123',
        name: 'Test User',
        isGuest: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockCreateRegisteredUser.mockReturnValue(invalidMockUser);
      mockValidateUser.mockReturnValue({ isValid: false, errors: ['Invalid'] });

      const result = await getCurrentUserInfo();

      expect(result).toBeNull();
    });
  });

  describe('loginAsGuest', () => {
    it('게스트 사용자를 반환한다', () => {
      const mockGuestUser = {
        id: 'guest-123',
        name: '게스트 사용자',
        isGuest: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockCreateGuestUser.mockReturnValue(mockGuestUser);

      const result = loginAsGuest();

      expect(result).toEqual(mockGuestUser);
      expect(mockCreateGuestUser).toHaveBeenCalled();
    });
  });

  describe('sendPasswordResetEmail', () => {
    beforeEach(() => {
      mockGetSupabaseClient.mockReturnValue({
        auth: {
          resetPasswordForEmail: jest.fn(),
        },
      } as never);
    });

    it('이메일이 없으면 AuthError를 던진다', async () => {
      await expect(sendPasswordResetEmail('')).rejects.toThrow(
        '이메일을 입력해주세요.'
      );
    });

    it('성공적으로 비밀번호 재설정 이메일을 보낸다', async () => {
      const mockSupabase = mockGetSupabaseClient();
      (mockSupabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        error: null,
      });

      await expect(
        sendPasswordResetEmail('test@example.com')
      ).resolves.toBeUndefined();

      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );
    });

    it('이메일 전송 실패 시 AuthError를 던진다', async () => {
      const mockSupabase = mockGetSupabaseClient();
      (mockSupabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        error: { message: 'Failed' },
      });

      await expect(sendPasswordResetEmail('test@example.com')).rejects.toThrow(
        '비밀번호 재설정 이메일 전송에 실패했습니다.'
      );
    });
  });

  describe('checkAuthStatus', () => {
    it('인증된 사용자가 있으면 true를 반환한다', async () => {
      mockGetCurrentUser.mockResolvedValue(mockSupabaseUser);

      const result = await checkAuthStatus();

      expect(result).toBe(true);
    });

    it('인증된 사용자가 없으면 false를 반환한다', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await checkAuthStatus();

      expect(result).toBe(false);
    });

    it('에러 발생 시 false를 반환한다', async () => {
      mockGetCurrentUser.mockRejectedValue(new Error('Network error'));

      const result = await checkAuthStatus();

      expect(result).toBe(false);
    });
  });

  describe('AuthError', () => {
    it('메시지와 함께 AuthError를 생성한다', () => {
      const error = new AuthError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AuthError');
      expect(error.code).toBeUndefined();
      expect(error.status).toBeUndefined();
    });

    it('코드와 상태와 함께 AuthError를 생성한다', () => {
      const error = new AuthError('Test error', 'TEST_CODE', 400);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.status).toBe(400);
    });
  });
});
