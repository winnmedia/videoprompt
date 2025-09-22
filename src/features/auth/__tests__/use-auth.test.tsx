/**
 * useAuth Hook Tests
 *
 * React 훅 테스트 with Redux and MSW
 * CLAUDE.md 준수: TDD, 통합 테스트, 결정론적 테스트
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { useAuth } from '../hooks/use-auth'
import { authReducer, type LoginRequest, type RegisterRequest, UserRole } from '../../../entities/auth'

// === 테스트 스토어 설정 ===

const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActionsPaths: ['payload.tokens.expiresAt', 'payload.user.metadata'],
          ignoredStatePaths: ['auth.tokens.expiresAt', 'auth.user.metadata', 'auth.lastActivity']
        }
      })
  })
}

// === MSW 서버 설정 ===

const server = setupServer(
  // 로그인 성공
  http.post('*/auth/v1/token', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          email_confirmed_at: '2024-01-01T00:00:00Z',
          user_metadata: {
            display_name: 'Test User'
          },
          app_metadata: {
            role: 'user'
          },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      })
    )
  }),

  // 회원가입 성공
  http.post('*/auth/v1/signup', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        user: {
          id: 'user-456',
          email: 'newuser@example.com',
          email_confirmed_at: null,
          user_metadata: {
            display_name: 'New User'
          },
          app_metadata: {
            role: 'user'
          },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        session: null
      })
    )
  }),

  // 로그아웃
  http.post('*/auth/v1/logout', (req, res, ctx) => {
    return res(ctx.status(204))
  }),

  // 현재 사용자 조회
  http.get('*/auth/v1/user', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: '2024-01-01T00:00:00Z',
        user_metadata: {
          display_name: 'Test User'
        },
        app_metadata: {
          role: 'user'
        },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      })
    )
  })
)

// === 테스트 헬퍼 ===

const renderUseAuth = () => {
  const store = createTestStore()
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )

  return {
    ...renderHook(() => useAuth(), { wrapper }),
    store
  }
}

// === 테스트 설정 ===

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' })

  // console.warn을 모킹하여 테스트 출력 정리
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  server.resetHandlers()
  jest.restoreAllMocks()
})

afterEach(() => {
  server.close()
})

// === 테스트 스위트 ===

describe('useAuth', () => {
  describe('초기 상태', () => {
    it('초기 상태가 올바르게 설정된다', () => {
      // When
      const { result } = renderUseAuth()

      // Then
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.isSessionValid).toBe(false)
      expect(result.current.displayName).toBeNull()
      expect(result.current.isAdmin).toBe(false)
      expect(result.current.isEmailVerified).toBe(false)
    })
  })

  describe('login', () => {
    it('성공적인 로그인을 처리한다', async () => {
      // Given
      const { result } = renderUseAuth()
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      }

      // When
      let loginResult: { success: boolean; error?: string }
      await act(async () => {
        loginResult = await result.current.login(loginRequest)
      })

      // Then
      await waitFor(() => {
        expect(loginResult!.success).toBe(true)
        expect(loginResult!.error).toBeUndefined()
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.user).toEqual(
          expect.objectContaining({
            id: 'user-123',
            email: 'test@example.com',
            displayName: 'Test User',
            role: UserRole.USER,
            isEmailVerified: true
          })
        )
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
      })
    })

    it('로그인 중 상태를 올바르게 관리한다', async () => {
      // Given
      const { result } = renderUseAuth()
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      }

      // When - 로그인 시작
      act(() => {
        result.current.login(loginRequest)
      })

      // Then - 로딩 상태 확인
      expect(result.current.isLoading).toBe(true)
      expect(result.current.error).toBeNull()

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    // $300 사건 방지 테스트
    it('중복 로그인 요청을 방지한다', async () => {
      // Given
      const { result } = renderUseAuth()
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      }

      // When - 첫 번째 로그인 시작
      let firstResult: { success: boolean; error?: string }
      act(() => {
        result.current.login(loginRequest).then(r => { firstResult = r })
      })

      // When - 즉시 두 번째 로그인 시도
      let secondResult: { success: boolean; error?: string }
      await act(async () => {
        secondResult = await result.current.login(loginRequest)
      })

      // Then - 두 번째 요청은 거부됨
      expect(secondResult!.success).toBe(false)
      expect(secondResult!.error).toBe('이미 로그인 중입니다')

      // 첫 번째 요청 완료 대기
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('register', () => {
    it('성공적인 회원가입을 처리한다 (이메일 확인 필요)', async () => {
      // Given
      const { result } = renderUseAuth()
      const registerRequest: RegisterRequest = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        displayName: 'New User',
        acceptTerms: true
      }

      // When
      let registerResult: { success: boolean; error?: string }
      await act(async () => {
        registerResult = await result.current.register(registerRequest)
      })

      // Then
      await waitFor(() => {
        expect(registerResult!.success).toBe(true)
        expect(registerResult!.error).toBe('이메일 확인이 필요합니다')
        expect(result.current.user).toEqual(
          expect.objectContaining({
            id: 'user-456',
            email: 'newuser@example.com',
            displayName: 'New User',
            isEmailVerified: false
          })
        )
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('중복 회원가입 요청을 방지한다', async () => {
      // Given
      const { result } = renderUseAuth()
      const registerRequest: RegisterRequest = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        displayName: 'New User',
        acceptTerms: true
      }

      // When - 첫 번째 회원가입 시작
      act(() => {
        result.current.register(registerRequest)
      })

      // When - 즉시 두 번째 회원가입 시도
      let secondResult: { success: boolean; error?: string }
      await act(async () => {
        secondResult = await result.current.register(registerRequest)
      })

      // Then - 두 번째 요청은 거부됨
      expect(secondResult!.success).toBe(false)
      expect(secondResult!.error).toBe('이미 회원가입 중입니다')
    })
  })

  describe('logout', () => {
    it('성공적인 로그아웃을 처리한다', async () => {
      // Given - 로그인된 상태
      const { result } = renderUseAuth()
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      }

      await act(async () => {
        await result.current.login(loginRequest)
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      // When - 로그아웃
      await act(async () => {
        await result.current.logout()
      })

      // Then
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.user).toBeNull()
        expect(result.current.error).toBeNull()
      })
    })
  })

  describe('세션 관리', () => {
    it('사용자 활동을 올바르게 업데이트한다', async () => {
      // Given - 로그인된 상태
      const { result } = renderUseAuth()
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      }

      await act(async () => {
        await result.current.login(loginRequest)
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      const initialActivity = result.current.sessionTimeRemaining

      // When - 활동 업데이트
      act(() => {
        result.current.updateUserActivity()
      })

      // Then - 세션 시간이 갱신됨
      expect(result.current.sessionTimeRemaining).toBeGreaterThanOrEqual(initialActivity)
    })

    it('세션 유효성을 올바르게 확인한다', async () => {
      // Given - 로그인된 상태
      const { result } = renderUseAuth()
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      }

      await act(async () => {
        await result.current.login(loginRequest)
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      // When & Then
      expect(result.current.checkSessionValidity()).toBe(true)
      expect(result.current.getTimeUntilExpiry()).toBeGreaterThan(0)
    })
  })

  describe('오류 처리', () => {
    it('오류를 올바르게 클리어한다', async () => {
      // Given - 오류가 있는 상태
      const { result } = renderUseAuth()

      // 의도적으로 실패하는 로그인 시도
      server.use(
        http.post('*/auth/v1/token', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              error: 'invalid_credentials',
              error_description: 'Invalid login credentials'
            })
          )
        })
      )

      const loginRequest: LoginRequest = {
        email: 'invalid@example.com',
        password: 'wrong-password',
        rememberMe: false
      }

      await act(async () => {
        await result.current.login(loginRequest)
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      // When - 오류 클리어
      act(() => {
        result.current.clearError()
      })

      // Then
      expect(result.current.error).toBeNull()
    })
  })

  describe('권한 관리', () => {
    it('관리자 권한을 올바르게 확인한다', async () => {
      // Given - 관리자로 로그인
      server.use(
        http.post('*/auth/v1/token', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              access_token: 'admin-token',
              refresh_token: 'admin-refresh',
              expires_in: 3600,
              user: {
                id: 'admin-123',
                email: 'admin@example.com',
                email_confirmed_at: '2024-01-01T00:00:00Z',
                user_metadata: {
                  display_name: 'Admin User'
                },
                app_metadata: {
                  role: 'admin'
                },
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
              }
            })
          )
        })
      )

      const { result } = renderUseAuth()
      const loginRequest: LoginRequest = {
        email: 'admin@example.com',
        password: 'password123',
        rememberMe: false
      }

      // When
      await act(async () => {
        await result.current.login(loginRequest)
      })

      // Then
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.isAdmin).toBe(true)
        expect(result.current.user?.role).toBe(UserRole.ADMIN)
      })
    })
  })

  describe('성능 및 메모리 관리', () => {
    it('이벤트 리스너가 올바르게 정리된다', () => {
      // Given
      const { unmount } = renderUseAuth()

      // 초기 이벤트 리스너 수 확인 (정확한 측정은 어려우므로 기본 동작 테스트)
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener')
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener')

      // When
      unmount()

      // Then - cleanup이 호출되었는지 확인
      // (실제로는 useEffect cleanup 함수가 호출되는지 테스트)
      expect(removeEventListenerSpy).toHaveBeenCalled()

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })
})