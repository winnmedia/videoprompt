/**
 * 통합 토큰 매니저 - Supabase + 레거시 토큰 통합 관리
 * 프로덕션 401/400 에러 근본 해결을 위한 토큰 시스템 일원화
 */

interface TokenInfo {
  token: string;
  type: 'supabase' | 'legacy' | 'bearer';
  source: 'cookie' | 'localStorage' | 'header';
  expiresAt?: number;
}

interface TokenManagerConfig {
  enableLegacySupport: boolean;
  enableDebugLogging: boolean;
  supabaseTokenPriority: boolean;
}

class TokenManager {
  private static instance: TokenManager;
  private config: TokenManagerConfig;

  private constructor() {
    this.config = {
      enableLegacySupport: true, // 기존 사용자 세션 유지
      enableDebugLogging: process.env.NODE_ENV !== 'production',
      supabaseTokenPriority: true // Supabase 토큰 우선
    };
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * 모든 가능한 토큰 소스에서 가장 적절한 토큰 반환
   * 우선순위: Supabase Access Token > Bearer Header > Legacy Token > Legacy Cookie
   */
  getAuthToken(): TokenInfo | null {
    if (typeof window === 'undefined') {
      // 서버 사이드에서는 토큰을 직접 가져올 수 없음
      return null;
    }

    // 1순위: Supabase Access Token (Cookie)
    if (this.config.supabaseTokenPriority) {
      const supabaseToken = this.getSupabaseToken();
      if (supabaseToken) {
        this.debugLog('✅ Using Supabase access token from cookie');
        return supabaseToken;
      }
    }

    // 2순위: Bearer Token (localStorage의 token을 Bearer로 사용)
    const bearerToken = this.getBearerToken();
    if (bearerToken) {
      this.debugLog('✅ Using Bearer token from localStorage');
      return bearerToken;
    }

    // 3순위: Legacy Token (localStorage)
    if (this.config.enableLegacySupport) {
      const legacyToken = this.getLegacyToken();
      if (legacyToken) {
        this.debugLog('✅ Using legacy token from localStorage');
        return legacyToken;
      }
    }

    this.debugLog('⚠️ No valid tokens found');
    return null;
  }

  /**
   * Supabase 토큰 가져오기 (httpOnly 쿠키에서)
   */
  private getSupabaseToken(): TokenInfo | null {
    if (typeof document === 'undefined') return null;

    // httpOnly 쿠키는 JavaScript로 직접 접근 불가
    // 하지만 API 요청 시 자동으로 전송됨
    // 여기서는 수동으로 설정된 토큰이나 localStorage 백업을 확인
    const supabaseBackup = localStorage.getItem('sb-access-token-backup');
    if (supabaseBackup) {
      try {
        const tokenData = JSON.parse(supabaseBackup);
        if (this.isTokenValid(tokenData.token, tokenData.expiresAt)) {
          return {
            token: tokenData.token,
            type: 'supabase',
            source: 'localStorage',
            expiresAt: tokenData.expiresAt
          };
        }
      } catch (error) {
        this.debugLog('⚠️ Failed to parse Supabase token backup:', error);
      }
    }

    return null;
  }

  /**
   * Bearer 토큰 가져오기 (localStorage의 token을 Bearer로 처리)
   */
  private getBearerToken(): TokenInfo | null {
    const token = localStorage.getItem('token');
    if (!token) return null;

    // JWT 토큰 만료 확인
    if (!this.isTokenValid(token)) {
      this.debugLog('⚠️ Bearer token expired, removing');
      localStorage.removeItem('token');
      return null;
    }

    return {
      token,
      type: 'bearer',
      source: 'localStorage'
    };
  }

  /**
   * 레거시 토큰 가져오기
   */
  private getLegacyToken(): TokenInfo | null {
    // accessToken 우선, 없으면 token
    const legacyToken = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!legacyToken) return null;

    if (!this.isTokenValid(legacyToken)) {
      this.debugLog('⚠️ Legacy token expired, removing');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      return null;
    }

    return {
      token: legacyToken,
      type: 'legacy',
      source: 'localStorage'
    };
  }

  /**
   * JWT 토큰 유효성 검사
   */
  private isTokenValid(token: string, expiresAt?: number): boolean {
    try {
      // expiresAt이 제공된 경우 우선 사용
      if (expiresAt) {
        return Date.now() < expiresAt;
      }

      // JWT 토큰 파싱으로 만료 확인
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return true; // exp가 없으면 유효하다고 가정

      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp > currentTime;
    } catch (error) {
      this.debugLog('⚠️ Token validation error:', error);
      return false;
    }
  }

  /**
   * Authorization 헤더 생성
   */
  getAuthHeader(): Record<string, string> | null {
    const tokenInfo = this.getAuthToken();
    if (!tokenInfo) return null;

    return {
      'Authorization': `Bearer ${tokenInfo.token}`
    };
  }

  /**
   * 토큰 저장 (클라이언트에서 직접 토큰을 받은 경우)
   */
  setToken(token: string, type: 'supabase' | 'legacy' | 'bearer', expiresAt?: number): void {
    switch (type) {
      case 'supabase':
        // Supabase 토큰은 주로 httpOnly 쿠키로 관리되지만 백업용으로 저장
        if (expiresAt) {
          localStorage.setItem('sb-access-token-backup', JSON.stringify({
            token,
            expiresAt
          }));
        }
        break;

      case 'bearer':
      case 'legacy':
        localStorage.setItem('token', token);
        if (type === 'legacy') {
          localStorage.setItem('accessToken', token);
        }
        break;
    }

    this.debugLog(`✅ Token stored: ${type}`);
  }

  /**
   * 모든 토큰 정리
   */
  clearAllTokens(): void {
    if (typeof window === 'undefined') return;

    // localStorage 토큰들 정리
    const tokensToRemove = [
      'token',
      'accessToken',
      'refreshToken',
      'sb-access-token-backup',
      'legacyToken'
    ];

    tokensToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    this.debugLog('🧹 All tokens cleared');
  }

  /**
   * 토큰 마이그레이션 (레거시 → Supabase)
   */
  migrateTokens(): boolean {
    const legacyToken = this.getLegacyToken();
    if (!legacyToken) return false;

    this.debugLog('🔄 Token migration detected');

    // 마이그레이션 로직은 서버에서 처리되어야 함
    // 여기서는 마이그레이션 필요 신호만 반환
    return true;
  }

  /**
   * 토큰 상태 정보 반환 (디버깅용)
   */
  getTokenStatus(): {
    hasSupabase: boolean;
    hasBearer: boolean;
    hasLegacy: boolean;
    activeToken: TokenInfo | null;
    needsMigration: boolean;
  } {
    const supabase = this.getSupabaseToken();
    const bearer = this.getBearerToken();
    const legacy = this.getLegacyToken();

    return {
      hasSupabase: !!supabase,
      hasBearer: !!bearer,
      hasLegacy: !!legacy,
      activeToken: this.getAuthToken(),
      needsMigration: this.migrateTokens()
    };
  }

  private debugLog(...args: any[]): void {
    if (this.config.enableDebugLogging) {
      console.log('[TokenManager]', ...args);
    }
  }
}

// 싱글턴 인스턴스 export
export const tokenManager = TokenManager.getInstance();

// 편의 함수들
export const getAuthToken = () => tokenManager.getAuthToken();
export const getAuthHeader = () => tokenManager.getAuthHeader();
export const setToken = (token: string, type: 'supabase' | 'legacy' | 'bearer', expiresAt?: number) =>
  tokenManager.setToken(token, type, expiresAt);
export const clearAllTokens = () => tokenManager.clearAllTokens();
export const getTokenStatus = () => tokenManager.getTokenStatus();

/**
 * NextRequest에서 토큰 추출 (서버 사이드용)
 * 우선순위: Bearer Header > Supabase Cookie > Legacy Session Cookie
 */
export function extractTokenFromRequest(req: Request): TokenInfo | null {
  // 1순위: Authorization 헤더 확인
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    return {
      token,
      type: 'bearer',
      source: 'header'
    };
  }

  // 2순위: 쿠키에서 확인 (Supabase 토큰 우선)
  const cookies = req.headers.get('cookie');
  if (cookies) {
    const cookieMap = new Map();
    cookies.split(';').forEach(cookie => {
      const [key, ...valueParts] = cookie.trim().split('=');
      if (key && valueParts.length > 0) {
        cookieMap.set(key.trim(), valueParts.join('=').trim());
      }
    });

    // Supabase 토큰
    const supabaseToken = cookieMap.get('sb-access-token');
    if (supabaseToken) {
      return {
        token: supabaseToken,
        type: 'supabase',
        source: 'cookie'
      };
    }

    // 레거시 토큰
    const legacyToken = cookieMap.get('session');
    if (legacyToken) {
      return {
        token: legacyToken,
        type: 'legacy',
        source: 'cookie'
      };
    }
  }

  return null;
}

/**
 * 토큰 유효성 검증 (서버 사이드용)
 */
export function validateTokenOnServer(tokenInfo: TokenInfo): { isValid: boolean; userId?: string; error?: string } {
  if (!tokenInfo || !tokenInfo.token) {
    return { isValid: false, error: 'No token provided' };
  }

  try {
    switch (tokenInfo.type) {
      case 'bearer':
      case 'legacy':
        // JWT 토큰 검증
        const parts = tokenInfo.token.split('.');
        if (parts.length !== 3) {
          return { isValid: false, error: 'Invalid token format' };
        }

        const payload = JSON.parse(atob(parts[1]));

        // 만료 시간 확인
        if (payload.exp) {
          const currentTime = Math.floor(Date.now() / 1000);
          if (payload.exp <= currentTime) {
            return { isValid: false, error: 'Token expired' };
          }
        }

        // userId 추출
        const userId = payload.sub || payload.userId;
        if (!userId) {
          return { isValid: false, error: 'No user ID in token' };
        }

        return { isValid: true, userId };

      case 'supabase':
        // Supabase 토큰은 별도 검증 로직이 필요할 수 있음
        // 지금은 기본적인 형태만 검증
        if (tokenInfo.token.includes('.')) {
          try {
            const payload = JSON.parse(atob(tokenInfo.token.split('.')[1]));
            return { isValid: true, userId: payload.sub };
          } catch {
            return { isValid: false, error: 'Invalid Supabase token format' };
          }
        }
        return { isValid: false, error: 'Invalid Supabase token' };

      default:
        return { isValid: false, error: 'Unknown token type' };
    }
  } catch (error) {
    return { isValid: false, error: `Token validation failed: ${error}` };
  }
}

/**
 * 통합된 인증 검증 함수 (서버 사이드용)
 * @param req Request 객체
 * @returns AuthResult { isAuthenticated: boolean, userId?: string, error?: string, tokenInfo?: TokenInfo }
 */
export interface AuthResult {
  isAuthenticated: boolean;
  userId?: string;
  error?: string;
  tokenInfo?: TokenInfo;
}

export function authenticateRequest(req: Request): AuthResult {
  // 1. 토큰 추출
  const tokenInfo = extractTokenFromRequest(req);

  if (!tokenInfo) {
    return {
      isAuthenticated: false,
      error: 'No authentication token found'
    };
  }

  // 2. 토큰 검증
  const validation = validateTokenOnServer(tokenInfo);

  if (!validation.isValid) {
    return {
      isAuthenticated: false,
      error: validation.error,
      tokenInfo
    };
  }

  return {
    isAuthenticated: true,
    userId: validation.userId,
    tokenInfo
  };
}