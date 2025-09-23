/**
 * Supabase 클라이언트 설정
 * TDD 원칙에 따라 테스트 가능한 구조로 설계
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 환경 변수 타입 정의
interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Supabase 설정
const getSupabaseConfig = (): SupabaseConfig => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // 테스트 환경에서는 기본값 사용
    if (process.env.NODE_ENV === 'test') {
      return {
        url: 'http://localhost:54321',
        anonKey: 'test-anon-key',
      };
    }

    throw new Error('Supabase URL and anon key must be provided');
  }

  return { url, anonKey };
};

// Supabase 클라이언트 생성 함수
export const createSupabaseClient = (): SupabaseClient => {
  const config = getSupabaseConfig();

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
};

// 기본 클라이언트 인스턴스
export const supabase = createSupabaseClient();

// 타입 정의
export type { SupabaseClient };