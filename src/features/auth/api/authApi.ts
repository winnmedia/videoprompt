/**
 * Auth API - 테스트 가능한 인증 API 클라이언트
 * TDD 원칙에 따라 모킹 가능한 구조로 설계
 */

import { User } from '@/entities/user';

export interface LoginResponse {
  user?: User;
  message: string;
  token?: string;
}

export interface AuthApiInterface {
  getCurrentUser(): Promise<User | null>;
  loginWithEmail(email: string): Promise<LoginResponse>;
  logout(): Promise<void>;
  refreshToken(): Promise<string>;
}

class AuthApiImpl implements AuthApiInterface {
  private baseUrl = '/api/auth';

  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch(`${this.baseUrl}/me`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.user || null;
    } catch (error) {
      console.warn('getCurrentUser failed:', error);
      return null;
    }
  }

  async loginWithEmail(email: string): Promise<LoginResponse> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    return response.json();
  }

  async logout(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/logout`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Logout failed');
    }
  }

  async refreshToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/refresh`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    return data.token;
  }
}

export const AuthApi = new AuthApiImpl();