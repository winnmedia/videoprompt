// API 응답 기본 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 사용자 관련 타입
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: 'user' | 'admin' | 'moderator';
  createdAt: string;
  updatedAt: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'ko' | 'en';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  aiSettings: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// 프로젝트 관련 타입
export interface Project {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  scenes: Scene[];
  timeline: Timeline;
  userId: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadata: ProjectMetadata;
}

export interface ProjectMetadata {
  duration: number;
  aspectRatio: string;
  quality: 'standard' | 'hd' | '4k' | '8k';
  genre: string[];
  targetAudience: string[];
}

// 장면 관련 타입
export interface Scene {
  id: string;
  title: string;
  description: string;
  prompt: ScenePrompt;
  thumbnail?: string;
  duration: number;
  order: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScenePrompt {
  metadata: {
    prompt_name: string;
    base_style: string;
    aspect_ratio: string;
    room_description: string;
    camera_setup: string;
  };
  key_elements: string[];
  assembled_elements: string[];
  negative_prompts?: string[];
  timeline: TimelineElement[];
  text: string | 'none';
  keywords: string[];
}

export interface TimelineElement {
  sequence: number;
  timestamp: string;
  action: string;
  audio: string;
}

// 타임라인 관련 타입
export interface Timeline {
  id: string;
  projectId: string;
  beads: TimelineBead[];
  totalDuration: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineBead {
  id: string;
  sequence: number;
  startTime: number;
  endTime: number;
  duration: number;
  sceneId: string;
  actions: Action[];
  audio: AudioElement[];
  transitions: Transition[];
}

export interface Action {
  id: string;
  type: 'camera' | 'movement' | 'effect' | 'custom';
  name: string;
  parameters: Record<string, any>;
  startTime: number;
  duration: number;
}

export interface AudioElement {
  id: string;
  type: 'music' | 'sfx' | 'voice' | 'ambient';
  name: string;
  url: string;
  volume: number;
  startTime: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
}

export interface Transition {
  id: string;
  type: 'cut' | 'fade' | 'dissolve' | 'wipe' | 'custom';
  duration: number;
  easing: string;
  parameters: Record<string, any>;
}

// 프리셋 관련 타입
export interface Preset {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail?: string;
  data: PresetData;
  isPublic: boolean;
  userId: string;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface PresetData {
  theme: string;
  roomDescription: string;
  cameraSetup: string;
  keyElements: string[];
  assembledElements: string[];
  negativePrompts: string[];
  keywords: string[];
  durationSec: number;
}

// AI 추천 관련 타입
export interface RecommendationRequest {
  userId?: string;
  context: 'scene' | 'project' | 'discovery';
  preferences: {
    themes: string[];
    styles: string[];
    genres: string[];
    duration: number;
  };
  history?: {
    recentProjects: string[];
    favoritePresets: string[];
    searchQueries: string[];
  };
}

export interface RecommendationResponse {
  scenes: SceneRecommendation[];
  presets: PresetRecommendation[];
  themes: ThemeRecommendation[];
  confidence: number;
}

export interface SceneRecommendation {
  scene: Scene;
  score: number;
  reason: string;
  alternatives: string[];
}

export interface PresetRecommendation {
  preset: Preset;
  score: number;
  reason: string;
  alternatives: string[];
}

export interface ThemeRecommendation {
  theme: string;
  score: number;
  reason: string;
  examples: string[];
}

// 파일 업로드 관련 타입
export interface UploadRequest {
  file: File;
  type: 'image' | 'video' | 'audio';
  category: string;
  metadata?: Record<string, any>;
}

export interface UploadResponse {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  size: number;
  type: string;
  metadata: Record<string, any>;
  createdAt: string;
}

// 통계 및 분석 관련 타입
export interface AnalyticsData {
  period: 'day' | 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
  metrics: {
    totalProjects: number;
    totalScenes: number;
    totalUsers: number;
    activeUsers: number;
    aiGenerations: number;
    storageUsed: number;
  };
  trends: {
    projects: TimeSeriesData[];
    scenes: TimeSeriesData[];
    users: TimeSeriesData[];
  };
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  change: number;
}

// 웹훅 관련 타입
export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
  signature: string;
}

export interface AICompletionWebhook {
  event: 'ai_completion';
  sceneId: string;
  projectId: string;
  status: 'success' | 'failed';
  result?: {
    prompt: string;
    thumbnail: string;
    metadata: Record<string, any>;
  };
  error?: string;
  processingTime: number;
}

// 알림 관련 타입
export interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

// 에러 관련 타입
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  path: string;
  method: string;
}

// API 요청 옵션
export interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retries?: number;
}

// 12샷 분해 관련 타입
export interface DevelopShotsRequest {
  structure4: Array<{
    title: string;
    summary: string;
  }>;
  genre: string;
  tone: string;
}

export interface Shot {
  id: string;
  title: string;
  description: string;
}

export interface DevelopShotsResponse {
  success: boolean;
  data?: {
    shots12: Shot[];
    metadata: {
      originalStructure: DevelopShotsRequest['structure4'];
      genre: string;
      tone: string;
      generatedAt: string;
      aiModel: string;
    };
  };
  error?: string;
}

// 환경 설정 타입
export interface EnvironmentConfig {
  NODE_ENV: string;
  API_BASE_URL: string;
  API_VERSION: string;
  ENABLE_DEBUG: boolean;
  ENABLE_MOCK_API: boolean;
  MOCK_DELAY: number;
}
