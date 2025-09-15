/**
 * Supabase Auth 기반 인증 라이브러리
 * 기존 auth.ts의 Supabase Auth 버전
 */

import type { NextRequest } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

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
 * Supabase Auth로 사용자 로그인
 */
export async function signInWithSupabase(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, session: null, error };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    return { user: null, session: null, error };
  }
}

/**
 * Supabase Auth로 사용자 회원가입
 */
export async function signUpWithSupabase(email: string, password: string, metadata?: { username?: string }) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {},
      },
    });

    if (error) {
      return { user: null, session: null, error };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    return { user: null, session: null, error };
  }
}

/**
 * Supabase Auth 로그아웃
 */
export async function signOutWithSupabase() {
  try {
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
  if (!supabaseAdmin) {
    console.error('Supabase Admin client not available');
    return null;
  }

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
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error) {
      return { session: null, error };
    }

    return { session: data.session, error: null };
  } catch (error) {
    return { session: null, error };
  }
}