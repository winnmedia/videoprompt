/**
 * Supabase Client Wrapper
 *
 * Supabase 클라이언트의 래퍼로 다음 기능을 제공:
 * - 환경변수 검증
 * - 에러 처리 및 재시도 로직
 * - 비용 안전 장치 ($300 사건 방지)
 * - 캐싱 전략
 */

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { EnvValidator } from '../config/env-validator';
import { ApiError, AuthenticationError, RateLimitError } from './types';

// Database 타입 정의 (auto-generated)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          username?: string;
          role: 'admin' | 'user' | 'guest';
          display_name?: string;
          avatar_url?: string;
          bio?: string;
          api_calls_today: number;
          api_calls_this_month: number;
          storage_usage_bytes: number;
          preferences: Record<string, any>;
          notification_settings: Record<string, any>;
          created_at: string;
          updated_at: string;
          last_login_at?: string;
          is_deleted: boolean;
          deleted_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description?: string;
          status: 'draft' | 'planning' | 'in_progress' | 'completed' | 'archived';
          thumbnail_url?: string;
          settings: Record<string, any>;
          brand_guidelines: Record<string, any>;
          target_audience?: string;
          duration_seconds?: number;
          collaborators: string[];
          is_public: boolean;
          share_token?: string;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      feedback_projects: {
        Row: {
          id: string;
          title: string;
          description?: string;
          owner_id: string;
          project_id?: string;
          status: 'draft' | 'active' | 'completed' | 'archived';
          settings: Record<string, any>;
          allowed_domains?: string[];
          max_video_slots: number;
          is_public: boolean;
          guest_access_enabled: boolean;
          require_auth: boolean;
          share_token?: string;
          share_link_expires_at?: string;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['feedback_projects']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['feedback_projects']['Insert']>;
      };
      video_slots: {
        Row: {
          id: string;
          feedback_project_id: string;
          slot_number: number;
          title: string;
          description?: string;
          video_file_path?: string;
          video_file_size?: number;
          video_duration_seconds?: number;
          video_mime_type?: string;
          thumbnail_file_path?: string;
          thumbnail_file_size?: number;
          screenshots: Record<string, any>[];
          metadata: Record<string, any>;
          processing_status: 'pending' | 'processing' | 'completed' | 'failed';
          processing_progress: number;
          uploaded_by_user_id?: string;
          uploaded_by_guest_id?: string;
          upload_session_id?: string;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['video_slots']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['video_slots']['Insert']>;
      };
      timecode_feedbacks: {
        Row: {
          id: string;
          video_slot_id: string;
          feedback_project_id: string;
          timestamp_seconds: number;
          duration_seconds: number;
          feedback_text: string;
          feedback_type: 'general' | 'technical' | 'creative' | 'urgent' | 'approval';
          priority: 'low' | 'medium' | 'high' | 'critical';
          emotion_type?: 'like' | 'love' | 'concern' | 'confused' | 'angry' | 'excited';
          emotion_intensity?: number;
          author_user_id?: string;
          author_guest_id?: string;
          author_name?: string;
          author_email?: string;
          status: 'active' | 'resolved' | 'archived';
          resolved_by_user_id?: string;
          resolved_at?: string;
          resolution_note?: string;
          parent_feedback_id?: string;
          reactions: Record<string, any>;
          position_x?: number;
          position_y?: number;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['timecode_feedbacks']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['timecode_feedbacks']['Insert']>;
      };
      feedback_participants: {
        Row: {
          id: string;
          feedback_project_id: string;
          user_id?: string;
          guest_id?: string;
          guest_name?: string;
          guest_email?: string;
          role: 'owner' | 'admin' | 'editor' | 'viewer' | 'guest';
          permissions: Record<string, any>;
          invited_by_user_id?: string;
          invitation_token?: string;
          invitation_sent_at?: string;
          invitation_accepted_at?: string;
          last_accessed_at?: string;
          access_count: number;
          status: 'pending' | 'active' | 'suspended' | 'removed';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['feedback_participants']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['feedback_participants']['Insert']>;
      };
      emotion_reactions: {
        Row: {
          id: string;
          target_type: 'video_slot' | 'timecode_feedback';
          target_id: string;
          feedback_project_id: string;
          reactor_user_id?: string;
          reactor_guest_id?: string;
          reactor_name?: string;
          emotion_type: 'like' | 'love' | 'concern' | 'confused' | 'angry' | 'excited';
          emotion_intensity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['emotion_reactions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['emotion_reactions']['Insert']>;
      };
      feedback_activity_logs: {
        Row: {
          id: string;
          feedback_project_id: string;
          target_type: string;
          target_id?: string;
          action: string;
          description?: string;
          actor_user_id?: string;
          actor_guest_id?: string;
          actor_name?: string;
          metadata: Record<string, any>;
          ip_address?: string;
          user_agent?: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['feedback_activity_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['feedback_activity_logs']['Insert']>;
      };
      // Planning System Tables
      planning_projects: {
        Row: {
          id: string;
          title: string;
          description?: string;
          user_id: string;
          project_id?: string;
          status: 'draft' | 'generating' | 'completed' | 'error';
          current_step: 'input' | 'story' | 'shots';

          // Input Data (Step 1)
          logline: string;
          tone_and_manner: 'casual' | 'professional' | 'creative' | 'educational' | 'marketing';
          development: 'linear' | 'dramatic' | 'problem_solution' | 'comparison' | 'tutorial';
          intensity: 'low' | 'medium' | 'high';
          target_duration?: number;
          additional_notes?: string;

          // Calculated fields
          total_duration?: number;
          completion_percentage: number;

          // Export settings
          export_settings?: Record<string, any>;

          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['planning_projects']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['planning_projects']['Insert']>;
      };

      story_steps: {
        Row: {
          id: string;
          planning_project_id: string;
          order: number; // 1-4
          title: string;
          description: string;
          duration?: number;
          key_points: string[];
          thumbnail_url?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['story_steps']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['story_steps']['Insert']>;
      };

      shot_sequences: {
        Row: {
          id: string;
          planning_project_id: string;
          story_step_id: string;
          order: number; // 1-12
          title: string;
          description: string;
          duration: number;

          // Conti information
          conti_description: string;
          conti_image_url?: string;
          conti_style: 'pencil' | 'rough' | 'monochrome' | 'colored';

          // Shooting information
          shot_type?: 'close_up' | 'medium' | 'wide' | 'extreme_wide';
          camera_movement?: 'static' | 'pan' | 'tilt' | 'zoom' | 'dolly';
          location?: string;
          characters?: string[];

          // Editing information
          visual_elements?: string[];
          audio_notes?: string;
          transition_type?: 'cut' | 'fade' | 'dissolve' | 'wipe';

          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['shot_sequences']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['shot_sequences']['Insert']>;
      };

      insert_shots: {
        Row: {
          id: string;
          shot_sequence_id: string;
          planning_project_id: string;
          order: number; // 1-3
          description: string;
          purpose: 'detail' | 'context' | 'emotion' | 'transition';
          image_url?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['insert_shots']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['insert_shots']['Insert']>;
      };

      conti_generations: {
        Row: {
          id: string;
          shot_sequence_id: string;
          planning_project_id: string;
          user_id: string;

          // Generation settings
          style: 'pencil' | 'rough' | 'monochrome' | 'colored';
          prompt: string;
          reference_image_url?: string;
          project_context?: Record<string, any>;

          // Generation results
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
          external_job_id?: string;
          image_url?: string;
          seed?: number;
          progress_percentage: number;

          // Error handling
          retry_count: number;
          max_retries: number;
          last_error_message?: string;

          // Cost tracking
          estimated_cost?: number;
          actual_cost?: number;
          provider: 'bytedance' | 'stable_diffusion' | 'midjourney';

          created_at: string;
          updated_at: string;
          completed_at?: string;
          failed_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['conti_generations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['conti_generations']['Insert']>;
      };

      marp_exports: {
        Row: {
          id: string;
          planning_project_id: string;
          user_id: string;

          // Export settings
          format: 'json' | 'pdf' | 'both';
          theme: 'default' | 'gaia' | 'uncover';
          include_conti: boolean;
          include_inserts: boolean;
          include_timing: boolean;
          custom_template?: string;

          // Export results
          status: 'pending' | 'processing' | 'completed' | 'failed';
          pdf_url?: string;
          json_url?: string;
          file_size?: number;
          page_count?: number;

          // Metadata
          expires_at: string;
          download_count: number;
          last_downloaded_at?: string;

          created_at: string;
          updated_at: string;
          completed_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['marp_exports']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['marp_exports']['Insert']>;
      };

      planning_templates: {
        Row: {
          id: string;
          name: string;
          description: string;
          category: 'marketing' | 'education' | 'entertainment' | 'corporate';

          // Template data
          input_data_template: Record<string, any>;
          story_steps_template: Record<string, any>[];
          export_settings_template: Record<string, any>;

          // Metadata
          is_public: boolean;
          created_by: string;
          usage_count: number;
          rating: number;
          tags: string[];

          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['planning_templates']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['planning_templates']['Insert']>;
      };

      // 기존 테이블들
      video_generations: {
        Row: {
          id: string;
          scenario_id: string;
          project_id: string;
          user_id: string;
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
          external_job_id?: string;
          input_prompt: string;
          input_image_url?: string;
          generation_settings: Record<string, any>;
          output_video_url?: string;
          output_thumbnail_url?: string;
          output_metadata: Record<string, any>;
          progress_percentage: number;
          queue_position?: number;
          estimated_completion_at?: string;
          retry_count: number;
          max_retries: number;
          last_error_message?: string;
          estimated_cost?: number;
          actual_cost?: number;
          created_at: string;
          updated_at: string;
          completed_at?: string;
          failed_at?: string;
          is_deleted: boolean;
          deleted_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['video_generations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['video_generations']['Insert']>;
      };
    };
    Functions: {
      transition_video_generation_status: {
        Args: {
          generation_id: string;
          new_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
          error_message?: string;
        };
        Returns: boolean;
      };
      record_api_call: {
        Args: {
          user_uuid: string;
          api_endpoint: string;
          estimated_cost?: number;
        };
        Returns: boolean;
      };
      create_version_snapshot: {
        Args: {
          entity_type: string;
          entity_id: string;
          user_id: string;
          title?: string;
          description?: string;
        };
        Returns: string;
      };
      get_feedback_project_stats: {
        Args: {
          project_id: string;
        };
        Returns: {
          total_videos: number;
          total_feedbacks: number;
          unresolved_feedbacks: number;
          total_participants: number;
          recent_activity_count: number;
        }[];
      };
      verify_guest_access: {
        Args: {
          project_token: string;
          guest_identifier?: string;
        };
        Returns: {
          project_id: string | null;
          access_granted: boolean;
          access_level: string;
        }[];
      };
      // Planning Functions
      create_planning_project_with_steps: {
        Args: {
          project_data: Record<string, any>;
          story_steps?: Record<string, any>[];
        };
        Returns: string; // planning_project_id
      };
      update_planning_progress: {
        Args: {
          planning_project_id: string;
          current_step: 'input' | 'story' | 'shots';
          completion_percentage: number;
        };
        Returns: boolean;
      };
      get_planning_project_full: {
        Args: {
          planning_project_id: string;
          user_id: string;
        };
        Returns: {
          planning_project: Record<string, any>;
          story_steps: Record<string, any>[];
          shot_sequences: Record<string, any>[];
          insert_shots: Record<string, any>[];
          conti_generations: Record<string, any>[];
        }[];
      };
      duplicate_planning_project: {
        Args: {
          source_project_id: string;
          user_id: string;
          new_title: string;
        };
        Returns: string; // new_planning_project_id
      };
      calculate_planning_duration: {
        Args: {
          planning_project_id: string;
        };
        Returns: {
          total_duration: number;
          step_durations: Record<string, number>;
          shot_durations: Record<string, number>;
        }[];
      };
      archive_old_conti_generations: {
        Args: {
          days_old: number;
        };
        Returns: number; // archived_count
      };
      get_user_planning_stats: {
        Args: {
          user_uuid: string;
        };
        Returns: {
          total_projects: number;
          completed_projects: number;
          total_shots_created: number;
          total_conti_generated: number;
          this_month_projects: number;
        }[];
      };
    };
  };
}

class SupabaseClientWrapper {
  private client: SupabaseClient<Database>;
  private rateLimitCache = new Map<string, number>();
  private requestQueue: Array<() => Promise<any>> = [];
  private processing = false;

  constructor() {
    const env = EnvValidator.getValidatedEnv();

    this.client = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'X-Client-Info': 'videoplanet-web@1.0.0',
          },
        },
      }
    );

    this.setupGlobalErrorHandler();
  }

  // ===========================================
  // 비용 안전 장치 ($300 사건 방지)
  // ===========================================

  /**
   * API 호출 전 비용 안전 검증
   */
  private async checkApiSafety(userId: string, endpoint: string): Promise<void> {
    const cacheKey = `${userId}:${endpoint}`;
    const lastCall = this.rateLimitCache.get(cacheKey);
    const now = Date.now();

    // 1분 내 동일 엔드포인트 호출 제한
    if (lastCall && (now - lastCall) < 60000) {
      throw new RateLimitError(`Too many requests to ${endpoint}. Please wait.`);
    }

    // 사용자 일일 한도 체크
    const { data: user } = await this.client
      .from('users')
      .select('api_calls_today, api_calls_this_month')
      .eq('id', userId)
      .single();

    if (user?.api_calls_today >= 100) {
      throw new RateLimitError('Daily API limit exceeded (100 calls)');
    }

    if (user?.api_calls_this_month >= 1000) {
      throw new RateLimitError('Monthly API limit exceeded (1000 calls)');
    }

    this.rateLimitCache.set(cacheKey, now);
  }

  /**
   * API 호출 기록
   */
  private async recordApiCall(userId: string, endpoint: string, estimatedCost: number = 0): Promise<void> {
    try {
      await this.client.rpc('record_api_call', {
        user_uuid: userId,
        api_endpoint: endpoint,
        estimated_cost: estimatedCost,
      });
    } catch (error) {
      console.warn('Failed to record API call:', error);
      // API 기록 실패는 치명적이지 않음
    }
  }

  // ===========================================
  // 큐 기반 요청 처리
  // ===========================================

  /**
   * 요청을 큐에 추가하여 순차 처리
   */
  private async queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * 큐 처리
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
        // 요청 간 최소 100ms 간격
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.processing = false;
  }

  // ===========================================
  // 에러 처리
  // ===========================================

  private setupGlobalErrorHandler(): void {
    // Supabase 에러를 표준 에러로 변환
    this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.rateLimitCache.clear();
      }
    });
  }

  private transformSupabaseError(error: any): ApiError {
    if (!error) return new ApiError('Unknown error');

    const message = error.message || 'An error occurred';
    const code = error.code || 'SUPABASE_ERROR';

    switch (error.code) {
      case 'PGRST116':
        return new AuthenticationError('Authentication required');
      case 'PGRST301':
        return new ApiError('Resource not found', 'NOT_FOUND', 404);
      case '23505':
        return new ApiError('Duplicate entry', 'DUPLICATE_ERROR', 409);
      case '23503':
        return new ApiError('Foreign key constraint violation', 'CONSTRAINT_ERROR', 400);
      default:
        return new ApiError(message, code, error.status || 500, error.details);
    }
  }

  // ===========================================
  // Public API
  // ===========================================

  /**
   * 현재 사용자 정보 가져오기
   */
  async getCurrentUser(): Promise<User | null> {
    const { data: { user }, error } = await this.client.auth.getUser();

    if (error) {
      throw this.transformSupabaseError(error);
    }

    return user;
  }

  /**
   * 현재 세션 정보 가져오기
   */
  async getCurrentSession(): Promise<Session | null> {
    const { data: { session }, error } = await this.client.auth.getSession();

    if (error) {
      throw this.transformSupabaseError(error);
    }

    return session;
  }

  /**
   * 안전한 데이터베이스 쿼리 실행
   */
  async safeQuery<T>(
    queryBuilder: () => any,
    userId?: string,
    endpoint: string = 'database_query'
  ): Promise<{ data: T | null; error: ApiError | null }> {
    try {
      // 사용자가 있으면 비용 안전 검증
      if (userId) {
        await this.checkApiSafety(userId, endpoint);
      }

      const result = await this.queueRequest(async () => {
        const query = queryBuilder();
        return await query;
      });

      if (result.error) {
        const apiError = this.transformSupabaseError(result.error);

        // API 호출 기록 (에러도 기록)
        if (userId) {
          await this.recordApiCall(userId, endpoint, 0.001);
        }

        return { data: null, error: apiError };
      }

      // 성공적인 API 호출 기록
      if (userId) {
        await this.recordApiCall(userId, endpoint, 0.001);
      }

      return { data: result.data, error: null };
    } catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : this.transformSupabaseError(error);

      return { data: null, error: apiError };
    }
  }

  /**
   * 안전한 RPC 호출
   */
  async safeRpc<T>(
    functionName: keyof Database['public']['Functions'],
    params: any,
    userId?: string
  ): Promise<{ data: T | null; error: ApiError | null }> {
    try {
      if (userId) {
        await this.checkApiSafety(userId, `rpc:${functionName}`);
      }

      const result = await this.queueRequest(async () => {
        return await this.client.rpc(functionName, params);
      });

      if (result.error) {
        const apiError = this.transformSupabaseError(result.error);

        if (userId) {
          await this.recordApiCall(userId, `rpc:${functionName}`, 0.01);
        }

        return { data: null, error: apiError };
      }

      if (userId) {
        await this.recordApiCall(userId, `rpc:${functionName}`, 0.01);
      }

      return { data: result.data, error: null };
    } catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : this.transformSupabaseError(error);

      return { data: null, error: apiError };
    }
  }

  /**
   * 파일 업로드 (Storage)
   */
  async uploadFile(
    bucket: string,
    filePath: string,
    file: File | Blob,
    options?: { upsert?: boolean; contentType?: string }
  ): Promise<{ data: { path: string } | null; error: ApiError | null }> {
    try {
      const result = await this.client.storage
        .from(bucket)
        .upload(filePath, file, {
          upsert: options?.upsert || false,
          contentType: options?.contentType,
        });

      if (result.error) {
        return { data: null, error: this.transformSupabaseError(result.error) };
      }

      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error: this.transformSupabaseError(error) };
    }
  }

  /**
   * 파일 다운로드 URL 생성
   */
  getPublicUrl(bucket: string, filePath: string): string {
    const { data } = this.client.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  /**
   * 원시 Supabase 클라이언트 접근 (고급 사용자용)
   */
  get raw(): SupabaseClient<Database> {
    return this.client;
  }

  /**
   * 연결 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client.from('users').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.rateLimitCache.clear();
  }
}

// 싱글톤 인스턴스 생성
export const supabaseClient = new SupabaseClientWrapper();