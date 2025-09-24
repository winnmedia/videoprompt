/**
 * Auth API Client
 * 인증 관련 API 호출 함수들
 */

import {
  getSupabaseClient,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  getCurrentUser,
} from '../../../shared/api';
import {
  createGuestUser,
  createRegisteredUser,
  validateUser,
  type User,
} from '../../../entities';

// 로그인 요청 타입
export interface LoginRequest {
  email: string;
  password: string;
}

// 회원가입 요청 타입
export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
}

// 로그인 응답 타입
export interface AuthResponse {
  user: User;
  token: string;
}

// 인증 에러 타입
export class AuthError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// 로그인 함수
export async function login(request: LoginRequest): Promise<AuthResponse> {
  try {
    // 입력 검증
    if (!request.email || !request.password) {
      throw new AuthError('이메일과 비밀번호를 입력해주세요.');
    }

    // Supabase 로그인
    const data = await signInWithEmail(request.email, request.password);
    const supabaseUser = data.user;
    const session = data.session;

    if (!supabaseUser || !session) {
      throw new AuthError('로그인에 실패했습니다.');
    }

    // User 엔티티로 변환
    const user = createRegisteredUser(
      supabaseUser.email || '',
      supabaseUser.id
    );

    // 사용자 검증
    const validation = validateUser(user);
    if (!validation.isValid) {
      throw new AuthError(
        `사용자 정보 검증 실패: ${validation.errors.join(', ')}`
      );
    }

    return {
      user,
      token: session.access_token,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError('로그인 중 오류가 발생했습니다.');
  }
}

// 회원가입 함수
export async function register(
  request: RegisterRequest
): Promise<AuthResponse> {
  try {
    // 입력 검증
    if (!request.email || !request.password || !request.confirmPassword) {
      throw new AuthError('모든 필드를 입력해주세요.');
    }

    if (request.password !== request.confirmPassword) {
      throw new AuthError('비밀번호가 일치하지 않습니다.');
    }

    if (request.password.length < 8) {
      throw new AuthError('비밀번호는 8자 이상이어야 합니다.');
    }

    // Supabase 회원가입
    const data = await signUpWithEmail(request.email, request.password);
    const supabaseUser = data.user;
    const session = data.session;

    if (!supabaseUser) {
      throw new AuthError('회원가입에 실패했습니다.');
    }

    // User 엔티티로 변환
    const user = createRegisteredUser(
      supabaseUser.email || '',
      supabaseUser.id
    );

    // 사용자 검증
    const validation = validateUser(user);
    if (!validation.isValid) {
      throw new AuthError(
        `사용자 정보 검증 실패: ${validation.errors.join(', ')}`
      );
    }

    return {
      user,
      token: session?.access_token || '',
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError('회원가입 중 오류가 발생했습니다.');
  }
}

// 로그아웃 함수
export async function logout(): Promise<void> {
  try {
    await signOut();
  } catch (error) {
    throw new AuthError('로그아웃 중 오류가 발생했습니다.');
  }
}

// 현재 사용자 정보 가져오기
export async function getCurrentUserInfo(): Promise<User | null> {
  try {
    const supabaseUser = await getCurrentUser();

    if (!supabaseUser) {
      return null;
    }

    // User 엔티티로 변환
    const user = createRegisteredUser(
      supabaseUser.email || '',
      supabaseUser.id
    );

    // 사용자 검증
    const validation = validateUser(user);
    if (!validation.isValid) {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

// 게스트 로그인 함수
export function loginAsGuest(): User {
  return createGuestUser();
}

// 비밀번호 재설정 이메일 전송
export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    if (!email) {
      throw new AuthError('이메일을 입력해주세요.');
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw new AuthError('비밀번호 재설정 이메일 전송에 실패했습니다.');
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError('비밀번호 재설정 중 오류가 발생했습니다.');
  }
}

// 인증 상태 확인
export async function checkAuthStatus(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return user !== null;
  } catch (error) {
    return false;
  }
}
