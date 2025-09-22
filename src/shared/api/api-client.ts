/**
 * High-Level API Client
 *
 * 고수준 API 클라이언트로 다음 기능을 제공:
 * - 도메인 중심 API 인터페이스
 * - 자동 DTO 변환
 * - 캐싱 전략 (Stale-While-Revalidate)
 * - 에러 처리 및 재시도 로직
 * - 타입 안전성
 */

import { supabaseClient } from './supabase-client';
import { dataTransformers, User, Project, Story, Scenario, VideoGeneration, Prompt, Asset } from './dto-transformers';
import {
  ApiResponse,
  PaginatedResponse,
  SearchFilter,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateStoryRequest,
  CreateScenarioRequest,
  CreateVideoGenerationRequest,
  ApiError,
  NotFoundError,
} from './types';

// ===========================================
// 캐싱 전략
// ===========================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTime: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5분

  set<T>(key: string, data: T, staleTime: number = this.DEFAULT_STALE_TIME): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      staleTime,
    });
  }

  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    const isStale = age > entry.staleTime;

    return { data: entry.data, isStale };
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const [key] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// ===========================================
// API 클라이언트 클래스
// ===========================================

class APIClient {
  private cache = new APICache();
  private currentUser: User | null = null;

  constructor() {
    this.setupAuthStateListener();
  }

  // ===========================================
  // 인증 관리
  // ===========================================

  private setupAuthStateListener(): void {
    supabaseClient.raw.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.cache.clear();
      } else if (event === 'SIGNED_IN' && session?.user) {
        await this.refreshCurrentUser();
      }
    });
  }

  private async refreshCurrentUser(): Promise<void> {
    try {
      const user = await supabaseClient.getCurrentUser();
      if (user) {
        const { data } = await supabaseClient.safeQuery(
          () => supabaseClient.raw.from('users').select('*').eq('id', user.id).single(),
          user.id,
          'get_current_user'
        );

        if (data) {
          this.currentUser = dataTransformers.userFromDTO(data);
        }
      }
    } catch (error) {
      console.warn('Failed to refresh current user:', error);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.currentUser) {
      await this.refreshCurrentUser();
    }
    return this.currentUser;
  }

  // ===========================================
  // 캐싱 헬퍼
  // ===========================================

  private async fetchWithCache<T>(
    cacheKey: string,
    fetcher: () => Promise<{ data: any; error: ApiError | null }>,
    transformer: (dto: any) => T,
    staleTime?: number
  ): Promise<ApiResponse<T>> {
    // 캐시 확인
    const cached = this.cache.get<T>(cacheKey);
    if (cached && !cached.isStale) {
      return { data: cached.data };
    }

    // 데이터 페치
    const { data, error } = await fetcher();

    if (error) {
      // Stale 데이터가 있으면 반환
      if (cached) {
        return { data: cached.data };
      }
      return { error };
    }

    if (!data) {
      return { error: new NotFoundError('Resource') };
    }

    // 변환 및 캐싱
    const transformed = transformer(data);
    this.cache.set(cacheKey, transformed, staleTime);

    return { data: transformed };
  }

  private async fetchArrayWithCache<T>(
    cacheKey: string,
    fetcher: () => Promise<{ data: any[]; error: ApiError | null; count?: number }>,
    transformer: (dto: any) => T,
    staleTime?: number
  ): Promise<PaginatedResponse<T>> {
    // 캐시 확인
    const cached = this.cache.get<T[]>(cacheKey);
    if (cached && !cached.isStale) {
      return { data: cached.data };
    }

    // 데이터 페치
    const { data, error, count } = await fetcher();

    if (error) {
      if (cached) {
        return { data: cached.data };
      }
      return { error };
    }

    if (!data) {
      return { data: [] };
    }

    // 변환 및 캐싱
    const transformed = dataTransformers.arrayFromDTOs(data, transformer);
    this.cache.set(cacheKey, transformed, staleTime);

    return {
      data: transformed,
      count,
    };
  }

  // ===========================================
  // 프로젝트 API
  // ===========================================

  async getProjects(filter: SearchFilter = {}): Promise<PaginatedResponse<Project>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    const cacheKey = `projects:${user.id}:${JSON.stringify(filter)}`;

    return this.fetchArrayWithCache(
      cacheKey,
      async () => {
        let query = supabaseClient.raw
          .from('projects')
          .select('*', { count: 'exact' })
          .eq('is_deleted', false);

        if (filter.query) {
          query = query.textSearch('title', filter.query);
        }

        if (filter.status) {
          query = query.eq('status', filter.status);
        }

        if (filter.limit) {
          query = query.limit(filter.limit);
        }

        if (filter.offset) {
          query = query.range(filter.offset, filter.offset + (filter.limit || 10) - 1);
        }

        const orderBy = filter.sort_by || 'updated_at';
        const orderDirection = filter.sort_order === 'asc' ? { ascending: true } : { ascending: false };
        query = query.order(orderBy, orderDirection);

        return supabaseClient.safeQuery(() => query, user.id, 'get_projects');
      },
      dataTransformers.projectFromDTO.bind(dataTransformers)
    );
  }

  async getProject(id: string): Promise<ApiResponse<Project>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    const cacheKey = `project:${id}`;

    return this.fetchWithCache(
      cacheKey,
      () => supabaseClient.safeQuery(
        () => supabaseClient.raw.from('projects').select('*').eq('id', id).eq('is_deleted', false).single(),
        user.id,
        'get_project'
      ),
      dataTransformers.projectFromDTO.bind(dataTransformers)
    );
  }

  async createProject(request: CreateProjectRequest): Promise<ApiResponse<Project>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    const projectData = {
      user_id: user.id,
      title: request.title,
      description: request.description,
      target_audience: request.target_audience,
      duration_seconds: request.duration_seconds,
      settings: request.settings || {},
      brand_guidelines: request.brand_guidelines || {},
      status: 'draft' as const,
      collaborators: [],
      is_public: false,
    };

    const { data, error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw.from('projects').insert(projectData).select('*').single(),
      user.id,
      'create_project'
    );

    if (error) {
      return { error };
    }

    // 캐시 무효화
    this.cache.invalidate(`projects:${user.id}`);

    const project = dataTransformers.projectFromDTO(data);
    this.cache.set(`project:${project.id}`, project);

    return { data: project };
  }

  async updateProject(id: string, request: UpdateProjectRequest): Promise<ApiResponse<Project>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    const { data, error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw.from('projects').update(request).eq('id', id).select('*').single(),
      user.id,
      'update_project'
    );

    if (error) {
      return { error };
    }

    // 캐시 업데이트
    const project = dataTransformers.projectFromDTO(data);
    this.cache.set(`project:${id}`, project);
    this.cache.invalidate(`projects:${user.id}`);

    return { data: project };
  }

  async deleteProject(id: string): Promise<ApiResponse<boolean>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    const { error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw.from('projects').update({ is_deleted: true }).eq('id', id),
      user.id,
      'delete_project'
    );

    if (error) {
      return { error };
    }

    // 캐시 무효화
    this.cache.invalidate(`project:${id}`);
    this.cache.invalidate(`projects:${user.id}`);

    return { data: true };
  }

  // ===========================================
  // 스토리 API
  // ===========================================

  async getStoriesByProject(projectId: string): Promise<PaginatedResponse<Story>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    const cacheKey = `stories:project:${projectId}`;

    return this.fetchArrayWithCache(
      cacheKey,
      () => supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('stories')
          .select('*', { count: 'exact' })
          .eq('project_id', projectId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        user.id,
        'get_stories'
      ),
      dataTransformers.storyFromDTO.bind(dataTransformers)
    );
  }

  async createStory(request: CreateStoryRequest): Promise<ApiResponse<Story>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    const storyData = {
      project_id: request.project_id,
      user_id: user.id,
      title: request.title,
      content: request.content,
      story_type: request.story_type,
      tone_and_manner: request.tone_and_manner,
      target_audience: request.target_audience,
      keywords: request.keywords || [],
      structured_content: {},
      generation_metadata: {},
    };

    const { data, error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw.from('stories').insert(storyData).select('*').single(),
      user.id,
      'create_story'
    );

    if (error) {
      return { error };
    }

    // 캐시 무효화
    this.cache.invalidate(`stories:project:${request.project_id}`);

    const story = dataTransformers.storyFromDTO(data);
    return { data: story };
  }

  // ===========================================
  // 영상 생성 API
  // ===========================================

  async createVideoGeneration(request: CreateVideoGenerationRequest): Promise<ApiResponse<VideoGeneration>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    const generationData = {
      scenario_id: request.scenario_id,
      project_id: request.project_id,
      user_id: user.id,
      status: 'pending' as const,
      input_prompt: request.input_prompt,
      input_image_url: request.input_image_url,
      generation_settings: request.generation_settings || {},
      progress_percentage: 0,
      retry_count: 0,
      max_retries: 3,
      output_metadata: {},
    };

    const { data, error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw.from('video_generations').insert(generationData).select('*').single(),
      user.id,
      'create_video_generation'
    );

    if (error) {
      return { error };
    }

    const videoGeneration = dataTransformers.videoGenerationFromDTO(data);
    return { data: videoGeneration };
  }

  async getVideoGenerationStatus(id: string): Promise<ApiResponse<VideoGeneration>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    // 영상 생성 상태는 캐싱하지 않음 (실시간 업데이트 필요)
    const { data, error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw.from('video_generations').select('*').eq('id', id).single(),
      user.id,
      'get_video_generation_status'
    );

    if (error) {
      return { error };
    }

    const videoGeneration = dataTransformers.videoGenerationFromDTO(data);
    return { data: videoGeneration };
  }

  async updateVideoGenerationStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
    errorMessage?: string
  ): Promise<ApiResponse<boolean>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    const { data, error } = await supabaseClient.safeRpc(
      'transition_video_generation_status',
      {
        generation_id: id,
        new_status: status,
        error_message: errorMessage,
      },
      user.id
    );

    if (error) {
      return { error };
    }

    return { data: data || true };
  }

  // ===========================================
  // 에셋 API
  // ===========================================

  async uploadAsset(
    file: File,
    projectId?: string,
    metadata?: { title?: string; description?: string; tags?: string[] }
  ): Promise<ApiResponse<Asset>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    // 파일 업로드
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${user.id}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabaseClient.uploadFile(
      'assets',
      filePath,
      file,
      { contentType: file.type }
    );

    if (uploadError || !uploadData) {
      return { error: uploadError || new ApiError('Upload failed') };
    }

    // 에셋 메타데이터 저장
    const assetData = {
      user_id: user.id,
      project_id: projectId,
      filename: fileName,
      original_filename: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      mime_type: file.type,
      asset_type: file.type.startsWith('image/') ? 'image' as const :
                  file.type.startsWith('video/') ? 'video' as const :
                  file.type.startsWith('audio/') ? 'audio' as const : 'template' as const,
      title: metadata?.title,
      description: metadata?.description,
      tags: metadata?.tags || [],
      usage_count: 0,
      cdn_url: supabaseClient.getPublicUrl('assets', uploadData.path),
      optimized_urls: {},
    };

    const { data, error } = await supabaseClient.safeQuery(
      () => supabaseClient.raw.from('assets').insert(assetData).select('*').single(),
      user.id,
      'create_asset'
    );

    if (error) {
      return { error };
    }

    const asset = dataTransformers.assetFromDTO(data);
    return { data: asset };
  }

  // ===========================================
  // 검색 API
  // ===========================================

  async searchContent(query: string, filters: SearchFilter = {}): Promise<PaginatedResponse<any>> {
    const user = await this.getCurrentUser();
    if (!user) {
      return { error: new ApiError('Authentication required') };
    }

    const cacheKey = `search:${query}:${JSON.stringify(filters)}`;
    const cached = this.cache.get<any[]>(cacheKey);

    if (cached && !cached.isStale) {
      return { data: cached.data };
    }

    // 다중 테이블 검색 (projects, stories, prompts)
    const searchPromises = [
      // 프로젝트 검색
      supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('projects')
          .select('*')
          .textSearch('title', query)
          .eq('is_deleted', false)
          .limit(filters.limit || 10),
        user.id,
        'search_projects'
      ),
      // 스토리 검색
      supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('stories')
          .select('*')
          .textSearch('title,content', query)
          .eq('is_deleted', false)
          .limit(filters.limit || 10),
        user.id,
        'search_stories'
      ),
    ];

    const results = await Promise.all(searchPromises);
    const searchResults: any[] = [];

    // 프로젝트 결과
    if (results[0].data) {
      searchResults.push(...results[0].data.map((item: any) => ({
        type: 'project',
        data: dataTransformers.projectFromDTO(item),
      })));
    }

    // 스토리 결과
    if (results[1].data) {
      searchResults.push(...results[1].data.map((item: any) => ({
        type: 'story',
        data: dataTransformers.storyFromDTO(item),
      })));
    }

    // 결과 캐싱 (검색 결과는 짧은 캐시 시간)
    this.cache.set(cacheKey, searchResults, 2 * 60 * 1000); // 2분

    return { data: searchResults };
  }

  // ===========================================
  // 유틸리티
  // ===========================================

  /**
   * 캐시 무효화
   */
  invalidateCache(pattern?: string): void {
    if (pattern) {
      this.cache.invalidate(pattern);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 연결 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    return supabaseClient.healthCheck();
  }
}

// 싱글톤 인스턴스 export
export const apiClient = new APIClient();