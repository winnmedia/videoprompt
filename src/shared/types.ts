/**
 * Shared Types - 통합 버전
 * 모든 공통 타입 정의
 */

// Common Types
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type AsyncStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API Types
export interface AuthRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    isGuest: boolean;
  };
  token?: string;
}

export interface StoryGenerateRequest {
  title: string;
  content: string;
  genre: string;
  tone?: string;
  targetDuration?: number;
}

export interface StoryGenerateResponse {
  id: string;
  title: string;
  summary: string;
  genre: string;
  chapters: any;
  totalDuration: number;
  metadata: any;
}

// Prompt Types
export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  category: PromptCategory;
  tags: string[];
}

export type PromptCategory =
  | 'story'
  | 'character'
  | 'scene'
  | 'dialogue'
  | 'action'
  | 'description';

export interface PromptGenerationRequest {
  template: string;
  variables: Record<string, string>;
  style?: string;
  length?: 'short' | 'medium' | 'long';
}

export interface PromptGenerationResponse {
  prompt: string;
  metadata: {
    generatedAt: string;
    templateUsed: string;
    estimatedTokens: number;
  };
}

export interface PromptOptimizationConfig {
  maxLength: number;
  includeStyle: boolean;
  tone: 'formal' | 'casual' | 'creative';
  keywords: string[];
}

// Video/Shot Types
export interface CameraOption {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export type StoryPhase = 'exposition' | 'rising_action' | 'climax' | 'resolution';

export interface ShotCameraControls {
  angle: string;
  movement: string;
  lighting?: string;
  focus?: string;
}

// Generator Types
export interface PromptGeneratorShot {
  id: string;
  title: string;
  description: string;
  duration: number;
  promptText: string;
  visualElements: string[];
  audioElements: string[];
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  costPerToken: number;
  supportedFeatures: string[];
  promptFormat: string;
}

// Jest Axe Types (for testing)
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}

export interface AxeResults {
  violations: Array<{
    id: string;
    impact: string;
    description: string;
    nodes: Array<{
      html: string;
      target: string[];
    }>;
  }>;
}