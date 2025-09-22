/**
 * Content Management Domain Types
 * 콘텐츠 관리 도메인 모델 타입 정의
 */

import { z } from 'zod';

/**
 * 콘텐츠 기본 타입
 */
export type ContentType = 'scenario' | 'prompt' | 'image' | 'video';

/**
 * 콘텐츠 상태
 */
export type ContentStatus = 'draft' | 'active' | 'archived' | 'deleted';

/**
 * 기본 콘텐츠 인터페이스
 */
export interface BaseContent {
  id: string;
  title: string;
  description?: string;
  type: ContentType;
  status: ContentStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata: Record<string, unknown>;
}

/**
 * AI 시나리오 콘텐츠
 */
export interface ScenarioContent extends BaseContent {
  type: 'scenario';
  content: {
    logline: string;
    tone: string;
    target: string;
    genre: string;
    duration: number;
    steps: Array<{
      id: string;
      title: string;
      description: string;
      shots: Array<{
        id: string;
        description: string;
        imageUrl?: string;
        duration: number;
      }>;
    }>;
  };
  stats: {
    views: number;
    likes: number;
    uses: number;
  };
}

/**
 * 프롬프트 콘텐츠
 */
export interface PromptContent extends BaseContent {
  type: 'prompt';
  content: {
    prompt: string;
    category: string;
    parameters: Record<string, unknown>;
    examples?: string[];
  };
  stats: {
    uses: number;
    rating: number;
    ratingCount: number;
  };
}

/**
 * 이미지 콘텐츠
 */
export interface ImageContent extends BaseContent {
  type: 'image';
  content: {
    url: string;
    thumbnailUrl: string;
    alt: string;
    dimensions: {
      width: number;
      height: number;
    };
    format: string;
    size: number;
  };
  stats: {
    downloads: number;
    views: number;
  };
}

/**
 * 비디오 콘텐츠
 */
export interface VideoContent extends BaseContent {
  type: 'video';
  content: {
    url: string;
    thumbnailUrl: string;
    duration: number;
    dimensions: {
      width: number;
      height: number;
    };
    format: string;
    size: number;
    quality: 'sd' | 'hd' | '4k';
  };
  stats: {
    views: number;
    downloads: number;
    likes: number;
  };
}

/**
 * 모든 콘텐츠 타입의 유니언
 */
export type Content = ScenarioContent | PromptContent | ImageContent | VideoContent;

/**
 * 필터 옵션
 */
export interface ContentFilters {
  type?: ContentType;
  status?: ContentStatus;
  search?: string;
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  createdBy?: string;
}

/**
 * 정렬 설정
 */
export interface SortConfig {
  field: keyof BaseContent | 'views' | 'likes' | 'uses' | 'rating';
  direction: 'asc' | 'desc';
}

/**
 * 페이지네이션 설정
 */
export interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
}

/**
 * 콘텐츠 통계
 */
export interface ContentStats {
  totalCounts: Record<ContentType, number>;
  recentActivity: Array<{
    id: string;
    type: ContentType;
    action: 'created' | 'updated' | 'viewed' | 'deleted';
    timestamp: string;
    userId: string;
  }>;
  topTags: Array<{
    tag: string;
    count: number;
  }>;
  popularContent: Array<{
    id: string;
    title: string;
    type: ContentType;
    views: number;
  }>;
}

/**
 * 배치 작업 타입
 */
export type BatchAction = 'delete' | 'archive' | 'activate' | 'addTags' | 'removeTags';

/**
 * 배치 작업 결과
 */
export interface BatchActionResult {
  success: string[];
  failed: Array<{
    id: string;
    error: string;
  }>;
}

/**
 * 실시간 업데이트 이벤트
 */
export interface RealtimeEvent {
  type: 'content_created' | 'content_updated' | 'content_deleted' | 'stats_updated';
  data: Partial<Content> | ContentStats;
  userId: string;
  timestamp: string;
}

/**
 * Zod 스키마들 (런타임 검증용)
 */
export const ContentTypeSchema = z.enum(['scenario', 'prompt', 'image', 'video']);

export const ContentStatusSchema = z.enum(['draft', 'active', 'archived', 'deleted']);

export const BaseContentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: ContentTypeSchema,
  status: ContentStatusSchema,
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});

export const ContentFiltersSchema = z.object({
  type: ContentTypeSchema.optional(),
  status: ContentStatusSchema.optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
  createdBy: z.string().optional(),
});

export const SortConfigSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
});

export const PaginationConfigSchema = z.object({
  page: z.number().min(1),
  limit: z.number().min(1).max(100),
  total: z.number().min(0),
});

/**
 * 타입 가드 함수들
 */
export function isScenarioContent(content: Content): content is ScenarioContent {
  return content.type === 'scenario';
}

export function isPromptContent(content: Content): content is PromptContent {
  return content.type === 'prompt';
}

export function isImageContent(content: Content): content is ImageContent {
  return content.type === 'image';
}

export function isVideoContent(content: Content): content is VideoContent {
  return content.type === 'video';
}

/**
 * 기본값 상수들
 */
export const DEFAULT_FILTERS: ContentFilters = {};

export const DEFAULT_SORT: SortConfig = {
  field: 'updatedAt',
  direction: 'desc',
};

export const DEFAULT_PAGINATION: PaginationConfig = {
  page: 1,
  limit: 20,
  total: 0,
};

/**
 * 콘텐츠 타입별 라벨
 */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  scenario: 'AI 시나리오',
  prompt: '프롬프트',
  image: '이미지',
  video: '비디오',
};

/**
 * 상태별 라벨
 */
export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: '초안',
  active: '활성',
  archived: '보관됨',
  deleted: '삭제됨',
};

/**
 * 콘텐츠 타입별 아이콘
 */
export const CONTENT_TYPE_ICONS: Record<ContentType, string> = {
  scenario: '🎬',
  prompt: '💡',
  image: '🖼️',
  video: '🎥',
};