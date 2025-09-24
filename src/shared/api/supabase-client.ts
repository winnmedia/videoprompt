/**
 * Supabase Client Implementation
 * 데이터베이스 연결 및 인증 관리
 */

import { createClient } from '@supabase/supabase-js';

// 환경변수 타입 정의
interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// 환경변수 검증
function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다');
  }

  if (!anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다'
    );
  }

  return { url, anonKey };
}

// Supabase 클라이언트 인스턴스 생성
export function createSupabaseClient() {
  const config = getSupabaseConfig();

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

// 싱글톤 패턴으로 클라이언트 인스턴스 관리
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient();
  }
  return supabaseInstance;
}

// 인증 상태 확인
export async function getCurrentUser() {
  const supabase = getSupabaseClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

// 로그아웃
export async function signOut() {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error('로그아웃에 실패했습니다');
    }

    return true;
  } catch (error) {
    throw error;
  }
}

// 이메일/비밀번호 로그인
export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

// 이메일 회원가입
export async function signUpWithEmail(email: string, password: string) {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error('회원가입에 실패했습니다');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

// 연결 상태 확인
export async function checkSupabaseConnection() {
  try {
    const supabase = getSupabaseClient();

    // 간단한 쿼리로 연결 테스트
    const { error } = await supabase.from('users').select('count').limit(1);

    if (error && error.code !== 'PGRST116') {
      // PGRST116은 테이블이 없음을 의미 (정상)
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}
