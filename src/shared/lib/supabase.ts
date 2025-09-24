/**
 * Supabase 클라이언트 설정
 * Phase 9: 핵심 기능 완성을 위한 실제 데이터베이스 연동
 */

import { createClient } from '@supabase/supabase-js';

// 환경변수 타입 검증
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL is not defined. Please check your environment variables.'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined. Please check your environment variables.'
  );
}

// Supabase 클라이언트 생성 (클라이언트 사이드)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// 데이터베이스 타입 정의
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          username: string | null;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          is_guest: boolean;
          guest_session_id: string | null;
          subscription_tier: string;
          usage_stats: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          is_guest?: boolean;
          guest_session_id?: string | null;
          subscription_tier?: string;
          usage_stats?: Record<string, unknown>;
        };
        Update: {
          username?: string | null;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          is_guest?: boolean;
          guest_session_id?: string | null;
          subscription_tier?: string;
          usage_stats?: Record<string, unknown>;
        };
      };
      scenarios: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          genre: string;
          style: string;
          target: string;
          structure: string;
          intensity: string;
          quality_score: number;
          estimated_duration: number;
          cost: number;
          tokens: number;
          feedback: string[];
          suggestions: string[];
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          content: string;
          genre: string;
          style: string;
          target: string;
          structure: string;
          intensity: string;
          quality_score?: number;
          estimated_duration?: number;
          cost?: number;
          tokens?: number;
          feedback?: string[];
          suggestions?: string[];
          status?: string;
        };
        Update: {
          title?: string;
          content?: string;
          genre?: string;
          style?: string;
          target?: string;
          structure?: string;
          intensity?: string;
          quality_score?: number;
          estimated_duration?: number;
          cost?: number;
          tokens?: number;
          feedback?: string[];
          suggestions?: string[];
          status?: string;
        };
      };
      stories: {
        Row: {
          id: string;
          scenario_id: string | null;
          user_id: string;
          title: string;
          synopsis: string;
          genre: string;
          target_audience: string;
          tone: string;
          total_duration: number;
          acts: Record<string, unknown>;
          generation_params: Record<string, unknown>;
          status: string;
          progress: number;
          cost: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          scenario_id?: string | null;
          user_id: string;
          title: string;
          synopsis: string;
          genre: string;
          target_audience: string;
          tone: string;
          total_duration: number;
          acts: Record<string, unknown>;
          generation_params?: Record<string, unknown>;
          status?: string;
          progress?: number;
          cost?: number;
        };
        Update: {
          scenario_id?: string | null;
          title?: string;
          synopsis?: string;
          genre?: string;
          target_audience?: string;
          tone?: string;
          total_duration?: number;
          acts?: Record<string, unknown>;
          generation_params?: Record<string, unknown>;
          status?: string;
          progress?: number;
          cost?: number;
        };
      };
      shots: {
        Row: {
          id: string;
          story_id: string;
          user_id: string;
          shot_number: number;
          global_order: number;
          title: string;
          description: string;
          act_type: string;
          shot_type: string;
          camera_angle: string;
          lighting: string;
          duration: number;
          storyboard: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          story_id: string;
          user_id: string;
          shot_number: number;
          global_order: number;
          title: string;
          description: string;
          act_type: string;
          shot_type: string;
          camera_angle: string;
          lighting: string;
          duration: number;
          storyboard?: Record<string, unknown>;
        };
        Update: {
          shot_number?: number;
          global_order?: number;
          title?: string;
          description?: string;
          act_type?: string;
          shot_type?: string;
          camera_angle?: string;
          lighting?: string;
          duration?: number;
          storyboard?: Record<string, unknown>;
        };
      };
    };
  };
}

// 타입이 적용된 Supabase 클라이언트
export const typedSupabase = supabase as any; // 타입 추론을 위한 임시 any

// 인증 관련 헬퍼 함수들
export const auth = {
  // 현재 사용자 가져오기
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // 게스트 사용자 생성
  createGuestUser: async () => {
    const guestEmail = `guest_${Date.now()}@videoplanet.local`;
    const guestPassword = `guest_${Math.random().toString(36).substring(2, 15)}`;

    const { data, error } = await supabase.auth.signUp({
      email: guestEmail,
      password: guestPassword,
      options: {
        data: {
          is_guest: true,
          full_name: 'Guest User',
        },
      },
    });

    if (error) throw error;
    return data.user;
  },

  // 로그아웃
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // 인증 상태 변경 리스너
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// 데이터베이스 헬퍼 함수들
export const db = {
  // 시나리오 관련
  scenarios: {
    getAll: (userId: string) =>
      supabase.from('scenarios').select('*').eq('user_id', userId),

    getById: (id: string, userId: string) =>
      supabase.from('scenarios').select('*').eq('id', id).eq('user_id', userId).single(),

    create: (data: Database['public']['Tables']['scenarios']['Insert']) =>
      supabase.from('scenarios').insert(data).select().single(),

    update: (id: string, data: Database['public']['Tables']['scenarios']['Update'], userId: string) =>
      supabase.from('scenarios').update(data).eq('id', id).eq('user_id', userId).select().single(),

    delete: (id: string, userId: string) =>
      supabase.from('scenarios').delete().eq('id', id).eq('user_id', userId),
  },

  // 스토리 관련
  stories: {
    getAll: (userId: string) =>
      supabase.from('stories').select('*').eq('user_id', userId),

    getById: (id: string, userId: string) =>
      supabase.from('stories').select('*').eq('id', id).eq('user_id', userId).single(),

    getByScenarioId: (scenarioId: string, userId: string) =>
      supabase.from('stories').select('*').eq('scenario_id', scenarioId).eq('user_id', userId),

    create: (data: Database['public']['Tables']['stories']['Insert']) =>
      supabase.from('stories').insert(data).select().single(),

    update: (id: string, data: Database['public']['Tables']['stories']['Update'], userId: string) =>
      supabase.from('stories').update(data).eq('id', id).eq('user_id', userId).select().single(),

    delete: (id: string, userId: string) =>
      supabase.from('stories').delete().eq('id', id).eq('user_id', userId),
  },

  // 숏트 관련
  shots: {
    getAll: (userId: string) =>
      supabase.from('shots').select('*').eq('user_id', userId),

    getByStoryId: (storyId: string, userId: string) =>
      supabase.from('shots').select('*').eq('story_id', storyId).eq('user_id', userId).order('global_order'),

    create: (data: Database['public']['Tables']['shots']['Insert']) =>
      supabase.from('shots').insert(data).select().single(),

    createMany: (data: Database['public']['Tables']['shots']['Insert'][]) =>
      supabase.from('shots').insert(data).select(),

    update: (id: string, data: Database['public']['Tables']['shots']['Update'], userId: string) =>
      supabase.from('shots').update(data).eq('id', id).eq('user_id', userId).select().single(),

    updateStoryboard: (id: string, storyboard: Record<string, unknown>, userId: string) =>
      supabase.from('shots').update({ storyboard }).eq('id', id).eq('user_id', userId).select().single(),

    delete: (id: string, userId: string) =>
      supabase.from('shots').delete().eq('id', id).eq('user_id', userId),
  },
};

// 실시간 구독 헬퍼
export const realtime = {
  // 시나리오 변경 구독
  subscribeToScenarios: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('scenarios')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scenarios', filter: `user_id=eq.${userId}` },
        callback
      )
      .subscribe();
  },

  // 스토리 변경 구독
  subscribeToStories: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('stories')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stories', filter: `user_id=eq.${userId}` },
        callback
      )
      .subscribe();
  },

  // 숏트 변경 구독
  subscribeToShots: (userId: string, callback: (payload: any) => void) => {
    return supabase
      .channel('shots')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'shots', filter: `user_id=eq.${userId}` },
        callback
      )
      .subscribe();
  },
};