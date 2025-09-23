/**
 * Shared Libraries - 통합 버전
 * 모든 공통 라이브러리 함수들
 */

import { createClient } from '@supabase/supabase-js';

// API Client
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}/${endpoint}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }
}

export const apiClient = new ApiClient();

// Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Storage Utilities
export class Storage {
  static get<T>(key: string, defaultValue?: T): T | null {
    if (typeof window === 'undefined') return defaultValue || null;

    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue || null;
    }
  }

  static set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  }

  static remove(key: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  }

  static clear(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }
}

// DTO Transformers
export class DTOTransformers {
  static storyToView(dto: any) {
    return {
      id: dto.id,
      title: dto.title,
      summary: dto.summary || dto.description,
      genre: dto.genre,
      status: dto.status || 'draft',
      totalDuration: dto.total_duration || dto.totalDuration,
      createdAt: dto.created_at || dto.createdAt,
      updatedAt: dto.updated_at || dto.updatedAt
    };
  }

  static userToView(dto: any) {
    return {
      id: dto.id,
      name: dto.name || dto.display_name,
      email: dto.email,
      isGuest: dto.is_guest || dto.isGuest || false,
      avatarUrl: dto.avatar_url || dto.avatarUrl,
      createdAt: dto.created_at || dto.createdAt
    };
  }
}

// Validation Error Handler
export class ValidationErrorHandler {
  static handle(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error?.message) {
      return error.message;
    }

    if (error?.errors && Array.isArray(error.errors)) {
      return error.errors.map((e: any) => e.message || e).join(', ');
    }

    return 'Validation error occurred';
  }

  static formatFieldErrors(errors: Record<string, string[]>): string {
    return Object.entries(errors)
      .map(([field, fieldErrors]) =>
        `${field}: ${fieldErrors.join(', ')}`
      )
      .join('; ');
  }
}

// Prompt Optimizer
export class PromptOptimizer {
  static optimize(prompt: string, options: {
    maxLength?: number;
    includeStyle?: boolean;
    tone?: 'formal' | 'casual' | 'creative';
  } = {}): string {
    const { maxLength = 500, includeStyle = true, tone = 'creative' } = options;

    let optimized = prompt.trim();

    // Length optimization
    if (optimized.length > maxLength) {
      optimized = optimized.substring(0, maxLength - 3) + '...';
    }

    // Style enhancement
    if (includeStyle) {
      const stylePrefix = {
        formal: 'In a professional manner: ',
        casual: 'In a friendly way: ',
        creative: 'Creatively and imaginatively: '
      }[tone];

      optimized = stylePrefix + optimized;
    }

    return optimized;
  }

  static extractKeywords(text: string): string[] {
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 10);
  }
}

// Storage Aliases & Constants
export const TypedStorage = {
  getItem: <T>(key: string): T | null => Storage.get<T>(key),
  setItem: <T>(key: string, value: T): void => Storage.set<T>(key, value),
  removeItem: (key: string): void => Storage.remove(key),
  clear: (): void => Storage.clear()
};

export const STORAGE_KEYS = {
  USER: 'app_user',
  AUTH_TOKEN: 'auth_token',
  PREFERENCES: 'user_preferences',
  DRAFTS: 'story_drafts'
};