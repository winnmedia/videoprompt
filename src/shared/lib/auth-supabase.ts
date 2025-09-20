/**
 * Supabase Auth 기반 인증 라이브러리
 * 기존 auth.ts의 Supabase Auth 버전
 * Supabase 에러 메시지 한국어 매핑 강화
 */

import type { NextRequest } from 'next/server';
import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';
import type { User } from '@supabase/supabase-js';

/**
 * Supabase 에러 메시지를 사용자 친화적인 한국어로 변환
 */
function mapSupabaseErrorToKorean(error: any): string {
  if (!error?.message) {
    return '알 수 없는 오류가 발생했습니다.';
  }

  const message = error.message.toLowerCase();

  // 인증 관련 에러들
  if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
    return '이메일 인증이 필요합니다. 가입 시 받은 이메일을 확인하여 계정을 활성화해주세요.';
  }

  if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }

  if (message.includes('user already registered') || message.includes('already registered')) {
    return '이미 등록된 이메일입니다.';
  }

  if (message.includes('signup disabled') || message.includes('signups not allowed')) {
    return '회원가입이 현재 비활성화되어 있습니다.';
  }

  if (message.includes('password')) {
    if (message.includes('too short') || message.includes('minimum')) {
      return '비밀번호가 너무 짧습니다. 최소 8자 이상 입력해주세요.';
    }
    if (message.includes('weak') || message.includes('strength')) {
      return '비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.';
    }
    return '비밀번호 형식이 올바르지 않습니다.';
  }

  if (message.includes('email')) {
    if (message.includes('invalid') || message.includes('format')) {
      return '이메일 형식이 올바르지 않습니다.';
    }
    if (message.includes('not found')) {
      return '등록되지 않은 이메일입니다.';
    }
    return '이메일 관련 오류가 발생했습니다.';
  }

  if (message.includes('rate limit') || message.includes('too many')) {
    return '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
  }

  if (message.includes('session') || message.includes('token') || message.includes('expired')) {
    return '세션이 만료되었습니다. 다시 로그인해주세요.';
  }

  // 기본 오류 메시지
  return '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

type AuthUser = {
  id: string;
  email?: string;
  username?: string;
  createdAt: string;
  updatedAt?: string;
  role?: string;
  avatarUrl?: string;
};

/**
 * Supabase JWT 토큰에서 사용자 정보 추출
 */
export function getSupabaseUserFromRequest(req: NextRequest): Promise<User | null> {
  // Authorization Bearer 토큰 우선 검사
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    return getSupabaseUserFromToken(token);
  }

  // Cookie에서 토큰 확인
  const cookieToken = req.cookies.get('sb-access-token')?.value;
  if (cookieToken) {
    return getSupabaseUserFromToken(cookieToken);
  }

  return Promise.resolve(null);
}

/**
 * Supabase 토큰에서 사용자 정보 추출
 */
export async function getSupabaseUserFromToken(token: string): Promise<User | null> {
  try {
    const supabase = await getSupabaseClientSafe('anon');

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.warn('🚨 Supabase token verification failed:', error?.message);
      return null;
    }

    console.log(`🔑 Supabase authentication successful: ${user.id}`);
    return user;
  } catch (error) {
    console.error('🚨 Supabase token parsing error:', error);
    return null;
  }
}

/**
 * Legacy 호환성을 위한 getUserIdFromRequest 대체
 */
export async function getUserIdFromRequestSupabase(req: NextRequest): Promise<string | undefined> {
  const user = await getSupabaseUserFromRequest(req);
  return user?.id;
}

/**
 * Supabase Auth에서 사용자 상세 정보 조회
 * users 테이블이 아닌 Supabase Auth와 통합된 정보 조회
 */
export async function getSupabaseUser(req: NextRequest): Promise<AuthUser | null> {
  const user = await getSupabaseUserFromRequest(req);
  if (!user) return null;

  try {
    const supabase = await getSupabaseClientSafe('anon');

    // Supabase users 테이블에서 추가 정보 조회 (있다면)
    const { data: userProfile, error } = await supabase
      .from('users')
      .select('username, role, avatar_url')
      .eq('id', user.id)
      .single();

    // 에러가 있어도 기본 사용자 정보는 반환
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      username: userProfile?.username || user.user_metadata?.username,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      role: userProfile?.role || 'user',
      avatarUrl: userProfile?.avatar_url || user.user_metadata?.avatar_url,
    };

    return authUser;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);

    // 기본 정보만으로라도 반환
    return {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}

/**
 * Legacy 호환성을 위한 getUser 대체
 */
export async function getUserSupabase(req: NextRequest): Promise<AuthUser | null> {
  return getSupabaseUser(req);
}

/**
 * Supabase 기반 인증 필수 검사
 */
export async function requireSupabaseAuthentication(req: NextRequest): Promise<string | null> {
  const userId = await getUserIdFromRequestSupabase(req);
  if (!userId) {
    console.warn('🚨 Supabase 인증 실패 - 토큰 없음 또는 유효하지 않음');
    return null;
  }

  console.log('✅ Supabase 인증 성공:', userId);
  return userId;
}

/**
 * Supabase Auth로 사용자 로그인 (에러 메시지 한국어 매핑)
 */
export async function signInWithSupabase(email: string, password: string) {
  try {
    const supabase = await getSupabaseClientSafe('anon');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 한국어 에러 메시지로 변환
      const koreanError = {
        ...error,
        message: mapSupabaseErrorToKorean(error),
        originalMessage: error.message, // 원본 메시지 보존 (디버깅용)
      };
      return { user: null, session: null, error: koreanError };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    const koreanError = {
      message: mapSupabaseErrorToKorean(error),
      originalMessage: error,
    };
    return { user: null, session: null, error: koreanError };
  }
}

/**
 * Supabase Auth로 사용자 회원가입 (에러 메시지 한국어 매핑)
 */
export async function signUpWithSupabase(email: string, password: string, metadata?: { username?: string }) {
  try {
    const supabase = await getSupabaseClientSafe('anon');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {},
      },
    });

    if (error) {
      // 한국어 에러 메시지로 변환
      const koreanError = {
        ...error,
        message: mapSupabaseErrorToKorean(error),
        originalMessage: error.message, // 원본 메시지 보존 (디버깅용)
      };
      return { user: null, session: null, error: koreanError };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    const koreanError = {
      message: mapSupabaseErrorToKorean(error),
      originalMessage: error,
    };
    return { user: null, session: null, error: koreanError };
  }
}

/**
 * Supabase Auth 로그아웃
 */
export async function signOutWithSupabase() {
  try {
    const supabase = await getSupabaseClientSafe('anon');

    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    return { error };
  }
}

/**
 * Supabase Admin으로 사용자 정보 조회 (서버사이드만)
 */
export async function getSupabaseUserByIdAdmin(userId: string): Promise<User | null> {
  const supabaseAdmin = await getSupabaseClientSafe('admin');

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !user) {
      console.warn('Failed to get user by ID:', error?.message);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

/**
 * 토큰 갱신
 */
export async function refreshSupabaseToken(refreshToken: string) {
  try {
    const supabase = await getSupabaseClientSafe('anon');

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error) {
      return { session: null, error };
    }

    return { session: data.session, error: null };
  } catch (error) {
    return { session: null, error };
  }
}