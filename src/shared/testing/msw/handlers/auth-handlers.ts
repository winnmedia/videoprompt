/**
 * MSW Auth API 핸들러
 *
 * CLAUDE.md 준수: TDD, MSW 모킹, 결정론적 테스트, 비용 안전
 * $300 사건 방지: 실제 API 호출 완전 차단, 결정론적 응답
 */

import { http, HttpResponse } from 'msw'
import { costSafetyMiddleware } from '../middleware/cost-safety'
import { deterministicDataFactory } from '../factories/deterministic-data-factory'

// 비용 안전을 위한 API 호출 제한
const API_CALL_LIMITS = {
  '/api/auth/me': { maxCallsPerTest: 1, cooldownMs: 60000 },
  '/api/auth/refresh': { maxCallsPerTest: 3, cooldownMs: 30000 },
  '/api/auth/login': { maxCallsPerTest: 5, cooldownMs: 10000 },
  '/api/auth/register': { maxCallsPerTest: 5, cooldownMs: 10000 },
} as const

/**
 * 사용자 인증 상태 저장소 (테스트용)
 */
class TestAuthStore {
  private static users = new Map<string, any>()
  private static tokens = new Map<string, any>()
  private static refreshTokens = new Map<string, any>()

  static addUser(user: any): void {
    this.users.set(user.id, user)
  }

  static getUser(id: string): any | null {
    return this.users.get(id) || null
  }

  static getUserByEmail(email: string): any | null {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user
      }
    }
    return null
  }

  static addToken(token: string, payload: any): void {
    this.tokens.set(token, payload)
  }

  static getTokenPayload(token: string): any | null {
    return this.tokens.get(token) || null
  }

  static addRefreshToken(token: string, payload: any): void {
    this.refreshTokens.set(token, payload)
  }

  static getRefreshTokenPayload(token: string): any | null {
    return this.refreshTokens.get(token) || null
  }

  static clear(): void {
    this.users.clear()
    this.tokens.clear()
    this.refreshTokens.clear()
  }

  static reset(): void {
    this.clear()
    // 기본 테스트 사용자들 추가
    this.addUser({
      id: 'test-user-001',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      emailVerified: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    })

    this.addUser({
      id: 'admin-user-001',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      emailVerified: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    })
  }
}

// 테스트 시작 시 초기화
TestAuthStore.reset()

/**
 * JWT 토큰 파싱 (테스트용)
 */
function parseTestJWT(token: string): any | null {
  try {
    if (!token.startsWith('Bearer ')) return null
    const actualToken = token.substring(7)

    // 실제 JWT 대신 테스트용 간단한 디코딩
    const parts = actualToken.split('.')
    if (parts.length !== 3) return null

    // Base64 디코딩 시뮬레이션
    const payload = TestAuthStore.getTokenPayload(actualToken)
    return payload
  } catch {
    return null
  }
}

/**
 * 테스트용 JWT 토큰 생성
 */
function generateTestJWT(payload: any): string {
  const token = `test_jwt_${Date.now()}_${Math.random().toString(36)}`
  TestAuthStore.addToken(token, payload)
  return token
}

/**
 * 테스트용 Refresh 토큰 생성
 */
function generateTestRefreshToken(payload: any): string {
  const token = `test_refresh_${Date.now()}_${Math.random().toString(36)}`
  TestAuthStore.addRefreshToken(token, payload)
  return token
}

export const authHandlers = [
  // POST /api/auth/login - 로그인
  http.post('/api/auth/login', async ({ request }) => {
    const isSafe = costSafetyMiddleware.checkApiCall('/api/auth/login', API_CALL_LIMITS)
    if (!isSafe.allowed) {
      return HttpResponse.json(
        {
          error: 'API_CALL_LIMIT_EXCEEDED',
          message: isSafe.reason,
          retryAfter: isSafe.retryAfter
        },
        { status: 429 }
      )
    }

    try {
      const body = await request.json() as any
      const { email, password } = body

      if (!email || !password) {
        return HttpResponse.json(
          {
            error: 'MISSING_CREDENTIALS',
            message: 'Email and password are required'
          },
          { status: 400 }
        )
      }

      // 테스트용 사용자 조회
      const user = TestAuthStore.getUserByEmail(email)
      if (!user) {
        return HttpResponse.json(
          {
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          },
          { status: 401 }
        )
      }

      // 테스트에서는 모든 비밀번호를 허용 (보안은 실제 서버에서 처리)
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600 // 1시간
      }

      const accessToken = generateTestJWT(tokenPayload)
      const refreshToken = generateTestRefreshToken({ userId: user.id })

      return HttpResponse.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailVerified: user.emailVerified
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 3600
          }
        }
      })
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Login processing failed'
        },
        { status: 500 }
      )
    }
  }),

  // POST /api/auth/register - 회원가입
  http.post('/api/auth/register', async ({ request }) => {
    const isSafe = costSafetyMiddleware.checkApiCall('/api/auth/register', API_CALL_LIMITS)
    if (!isSafe.allowed) {
      return HttpResponse.json(
        {
          error: 'API_CALL_LIMIT_EXCEEDED',
          message: isSafe.reason,
          retryAfter: isSafe.retryAfter
        },
        { status: 429 }
      )
    }

    try {
      const body = await request.json() as any
      const { email, password, name } = body

      if (!email || !password || !name) {
        return HttpResponse.json(
          {
            error: 'MISSING_FIELDS',
            message: 'Email, password, and name are required'
          },
          { status: 400 }
        )
      }

      // 이메일 중복 체크
      const existingUser = TestAuthStore.getUserByEmail(email)
      if (existingUser) {
        return HttpResponse.json(
          {
            error: 'EMAIL_ALREADY_EXISTS',
            message: 'User with this email already exists'
          },
          { status: 409 }
        )
      }

      // 새 사용자 생성
      const newUser = deterministicDataFactory.createUser({
        email,
        name,
        role: 'user',
        emailVerified: false
      })

      TestAuthStore.addUser(newUser)

      return HttpResponse.json({
        success: true,
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            emailVerified: newUser.emailVerified
          },
          message: 'Registration successful. Please verify your email.'
        }
      })
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Registration processing failed'
        },
        { status: 500 }
      )
    }
  }),

  // GET /api/auth/me - 현재 사용자 정보 ($300 사건 방지 핵심)
  http.get('/api/auth/me', async ({ request }) => {
    const isSafe = costSafetyMiddleware.checkApiCall('/api/auth/me', API_CALL_LIMITS)
    if (!isSafe.allowed) {
      return HttpResponse.json(
        {
          error: 'API_CALL_LIMIT_EXCEEDED',
          message: `🚨 $300 패턴 감지: ${isSafe.reason}`,
          retryAfter: isSafe.retryAfter,
          preventBilling: true
        },
        { status: 429 }
      )
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return HttpResponse.json(
        {
          error: 'MISSING_AUTH_HEADER',
          message: 'Authorization header is required'
        },
        { status: 401 }
      )
    }

    const tokenPayload = parseTestJWT(authHeader)
    if (!tokenPayload) {
      return HttpResponse.json(
        {
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        },
        { status: 401 }
      )
    }

    // 토큰 만료 체크
    if (tokenPayload.exp && tokenPayload.exp < Math.floor(Date.now() / 1000)) {
      return HttpResponse.json(
        {
          error: 'TOKEN_EXPIRED',
          message: 'Token has expired'
        },
        { status: 401 }
      )
    }

    const user = TestAuthStore.getUser(tokenPayload.userId)
    if (!user) {
      return HttpResponse.json(
        {
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        },
        { status: 404 }
      )
    }

    return HttpResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    })
  }),

  // POST /api/auth/refresh - 토큰 새로고침
  http.post('/api/auth/refresh', async ({ request }) => {
    const isSafe = costSafetyMiddleware.checkApiCall('/api/auth/refresh', API_CALL_LIMITS)
    if (!isSafe.allowed) {
      return HttpResponse.json(
        {
          error: 'API_CALL_LIMIT_EXCEEDED',
          message: isSafe.reason,
          retryAfter: isSafe.retryAfter
        },
        { status: 429 }
      )
    }

    try {
      const body = await request.json() as any
      const { refreshToken } = body

      if (!refreshToken) {
        return HttpResponse.json(
          {
            error: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token is required'
          },
          { status: 400 }
        )
      }

      const refreshPayload = TestAuthStore.getRefreshTokenPayload(refreshToken)
      if (!refreshPayload) {
        return HttpResponse.json(
          {
            error: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid refresh token'
          },
          { status: 401 }
        )
      }

      const user = TestAuthStore.getUser(refreshPayload.userId)
      if (!user) {
        return HttpResponse.json(
          {
            error: 'USER_NOT_FOUND',
            message: 'User not found'
          },
          { status: 404 }
        )
      }

      // 새 액세스 토큰 생성
      const newTokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }

      const newAccessToken = generateTestJWT(newTokenPayload)

      return HttpResponse.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: 3600
        }
      })
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Token refresh failed'
        },
        { status: 500 }
      )
    }
  }),

  // POST /api/auth/logout - 로그아웃
  http.post('/api/auth/logout', async ({ request }) => {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return HttpResponse.json(
        {
          error: 'MISSING_AUTH_HEADER',
          message: 'Authorization header is required'
        },
        { status: 401 }
      )
    }

    // 테스트에서는 항상 성공
    return HttpResponse.json({
      success: true,
      data: {
        message: 'Logout successful'
      }
    })
  })
]

/**
 * 테스트 유틸리티 함수들
 */
export const authTestUtils = {
  // 테스트 데이터 리셋
  reset: () => {
    TestAuthStore.reset()
    costSafetyMiddleware.reset()
  },

  // 사용자 추가
  addUser: (user: any) => {
    TestAuthStore.addUser(user)
  },

  // 테스트 토큰 생성
  generateToken: (payload: any) => {
    return generateTestJWT(payload)
  },

  // API 호출 이력 조회
  getApiCallHistory: () => {
    return costSafetyMiddleware.getCallHistory()
  },

  // 비용 안전 상태 조회
  getCostSafetyStatus: () => {
    return costSafetyMiddleware.getStatus()
  }
}