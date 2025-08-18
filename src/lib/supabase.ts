import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
} else {
  // 안전 가드: 환경변수 미설정 시 Supabase는 비활성화
  // 콘솔 경고만 남기고 null 클라이언트 유지
  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn('[Supabase] 환경변수가 없어 Supabase가 비활성화되었습니다. Railway 백엔드 사용을 권장합니다.');
  }
}

export { supabase };

// 데이터베이스 타입 정의
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          username: string;
          avatar_url?: string;
          role: 'user' | 'admin' | 'moderator';
          preferences: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          username: string;
          avatar_url?: string;
          role?: 'user' | 'admin' | 'moderator';
          preferences?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          username?: string;
          avatar_url?: string;
          role?: 'user' | 'admin' | 'moderator';
          preferences?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          title: string;
          description?: string;
          thumbnail_url?: string;
          status: 'draft' | 'in_progress' | 'completed' | 'archived';
          user_id: string;
          created_at: string;
          updated_at: string;
          tags: string[];
          metadata: any;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string;
          thumbnail_url?: string;
          status?: 'draft' | 'in_progress' | 'completed' | 'archived';
          user_id: string;
          created_at?: string;
          updated_at?: string;
          tags?: string[];
          metadata?: any;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          thumbnail_url?: string;
          status?: 'draft' | 'in_progress' | 'completed' | 'archived';
          user_id?: string;
          created_at?: string;
          updated_at?: string;
          tags?: string[];
          metadata?: any;
        };
      };
      scenes: {
        Row: {
          id: string;
          title: string;
          description: string;
          prompt: any;
          thumbnail_url?: string;
          duration: number;
          order: number;
          status: 'pending' | 'generating' | 'completed' | 'failed';
          ai_generated: boolean;
          project_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          prompt: any;
          thumbnail_url?: string;
          duration: number;
          order: number;
          status?: 'pending' | 'generating' | 'completed' | 'failed';
          ai_generated?: boolean;
          project_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          prompt?: any;
          thumbnail_url?: string;
          duration?: number;
          order?: number;
          status?: 'pending' | 'generating' | 'completed' | 'failed';
          ai_generated?: boolean;
          project_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      presets: {
        Row: {
          id: string;
          name: string;
          description: string;
          category: string;
          tags: string[];
          thumbnail_url?: string;
          data: any;
          is_public: boolean;
          user_id: string;
          downloads: number;
          rating: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          category: string;
          tags?: string[];
          thumbnail_url?: string;
          data: any;
          is_public?: boolean;
          user_id: string;
          downloads?: number;
          rating?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          category?: string;
          tags?: string[];
          thumbnail_url?: string;
          data?: any;
          is_public?: boolean;
          user_id?: string;
          downloads?: number;
          rating?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      timelines: {
        Row: {
          id: string;
          project_id: string;
          beads: any[];
          total_duration: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          beads?: any[];
          total_duration?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          beads?: any[];
          total_duration?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

// 타입 안전한 Supabase 클라이언트
export const typedSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
