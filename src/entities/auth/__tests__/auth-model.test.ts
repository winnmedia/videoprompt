/**
 * Auth Model Tests
 *
 * 도메인 로직 단위 테스트
 * CLAUDE.md 준수: 순수 함수 테스트, 비즈니스 로직 검증
 */

import { AuthModel } from '../model'
import { AuthStatus, UserRole, type User, type AuthTokens, type AuthState } from '../types'

describe('AuthModel', () => {
  // === 테스트 데이터 ===

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    role: UserRole.USER,
    isEmailVerified: true,
    metadata: {
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      lastLoginAt: new Date('2024-01-01')
    }
  }

  const mockTokens: AuthTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1시간 후
  }

  const mockExpiredTokens: AuthTokens = {
    accessToken: 'expired-token',
    refreshToken: 'expired-refresh',
    expiresAt: new Date(Date.now() - 60 * 60 * 1000) // 1시간 전
  }

  describe('상태 생성자', () => {
    it('인증된 상태를 올바르게 생성한다', () => {
      // When
      const state = AuthModel.createAuthenticatedState(mockUser, mockTokens)

      // Then
      expect(state).toEqual({
        status: AuthStatus.AUTHENTICATED,
        user: mockUser,
        tokens: mockTokens,
        error: null,
        lastActivity: expect.any(Date)
      })
    })

    it('로딩 상태를 올바르게 생성한다', () => {
      // Given
      const currentState: AuthState = {
        status: AuthStatus.IDLE,
        user: null,
        tokens: null,
        error: 'previous error',
        lastActivity: null
      }

      // When
      const state = AuthModel.createLoadingState(currentState)

      // Then
      expect(state).toEqual({
        ...currentState,
        status: AuthStatus.LOADING,
        error: null
      })
    })

    it('오류 상태를 올바르게 생성한다', () => {
      // Given
      const errorMessage = 'Something went wrong'

      // When
      const state = AuthModel.createErrorState(errorMessage)

      // Then
      expect(state).toEqual({
        status: AuthStatus.ERROR,
        user: null,
        tokens: null,
        error: errorMessage,
        lastActivity: null
      })
    })

    it('비인증 상태를 올바르게 생성한다', () => {
      // When
      const state = AuthModel.createUnauthenticatedState()

      // Then
      expect(state).toEqual({
        status: AuthStatus.UNAUTHENTICATED,
        user: null,
        tokens: null,
        error: null,
        lastActivity: null
      })
    })
  })

  describe('상태 업데이트', () => {
    it('활동 시간을 올바르게 업데이트한다', () => {
      // Given
      const oldDate = new Date('2024-01-01')
      const currentState: AuthState = {
        status: AuthStatus.AUTHENTICATED,
        user: mockUser,
        tokens: mockTokens,
        error: null,
        lastActivity: oldDate
      }

      // When
      const updatedState = AuthModel.updateLastActivity(currentState)

      // Then
      expect(updatedState.lastActivity).not.toEqual(oldDate)
      expect(updatedState.lastActivity).toBeInstanceOf(Date)
      expect(updatedState.lastActivity!.getTime()).toBeGreaterThan(oldDate.getTime())
    })

    it('토큰을 올바르게 업데이트한다', () => {
      // Given
      const currentState: AuthState = {
        status: AuthStatus.AUTHENTICATED,
        user: mockUser,
        tokens: mockTokens,
        error: null,
        lastActivity: new Date('2024-01-01')
      }

      const newTokens: AuthTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2시간 후
      }

      // When
      const updatedState = AuthModel.updateTokens(currentState, newTokens)

      // Then
      expect(updatedState.tokens).toEqual(newTokens)
      expect(updatedState.lastActivity).toBeInstanceOf(Date)
      expect(updatedState.lastActivity!.getTime()).toBeGreaterThan(currentState.lastActivity!.getTime())
    })

    it('비인증 상태에서 토큰 업데이트를 무시한다', () => {
      // Given
      const currentState: AuthState = {
        status: AuthStatus.UNAUTHENTICATED,
        user: null,
        tokens: null,
        error: null,
        lastActivity: null
      }

      // When
      const updatedState = AuthModel.updateTokens(currentState, mockTokens)

      // Then
      expect(updatedState).toEqual(currentState)
    })

    it('사용자 정보를 올바르게 업데이트한다', () => {
      // Given
      const currentState: AuthState = {
        status: AuthStatus.AUTHENTICATED,
        user: mockUser,
        tokens: mockTokens,
        error: null,
        lastActivity: new Date('2024-01-01')
      }

      const userUpdates = {
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.jpg'
      }

      // When
      const updatedState = AuthModel.updateUser(currentState, userUpdates)

      // Then
      expect(updatedState.user).toEqual({
        ...mockUser,
        ...userUpdates,
        metadata: {
          ...mockUser.metadata,
          updatedAt: expect.any(Date)
        }
      })
      expect(updatedState.lastActivity).toBeInstanceOf(Date)
    })

    it('사용자가 없는 상태에서 사용자 업데이트를 무시한다', () => {
      // Given
      const currentState: AuthState = {
        status: AuthStatus.UNAUTHENTICATED,
        user: null,
        tokens: null,
        error: null,
        lastActivity: null
      }

      // When
      const updatedState = AuthModel.updateUser(currentState, { displayName: 'New Name' })

      // Then
      expect(updatedState).toEqual(currentState)
    })
  })

  describe('검증 함수', () => {
    describe('로그인 요청 검증', () => {
      it('유효한 로그인 요청을 통과시킨다', () => {
        // Given
        const validRequest = {
          email: 'test@example.com',
          password: 'password123',
          rememberMe: false
        }

        // When
        const errors = AuthModel.validateLoginRequest(validRequest)

        // Then
        expect(errors).toEqual([])
      })

      it('유효하지 않은 이메일을 거부한다', () => {
        // Given
        const invalidRequest = {
          email: 'invalid-email',
          password: 'password123',
          rememberMe: false
        }

        // When
        const errors = AuthModel.validateLoginRequest(invalidRequest)

        // Then
        expect(errors).toContain('유효한 이메일을 입력하세요')
      })

      it('짧은 비밀번호를 거부한다', () => {
        // Given
        const invalidRequest = {
          email: 'test@example.com',
          password: '123',
          rememberMe: false
        }

        // When
        const errors = AuthModel.validateLoginRequest(invalidRequest)

        // Then
        expect(errors).toContain('비밀번호는 최소 8자 이상이어야 합니다')
      })
    })

    describe('회원가입 요청 검증', () => {
      it('유효한 회원가입 요청을 통과시킨다', () => {
        // Given
        const validRequest = {
          email: 'test@example.com',
          password: 'SecurePass123!',
          displayName: 'Test User',
          acceptTerms: true
        }

        // When
        const errors = AuthModel.validateRegisterRequest(validRequest)

        // Then
        expect(errors).toEqual([])
      })

      it('약한 비밀번호를 거부한다', () => {
        // Given
        const invalidRequest = {
          email: 'test@example.com',
          password: 'weakpass',
          displayName: 'Test User',
          acceptTerms: true
        }

        // When
        const errors = AuthModel.validateRegisterRequest(invalidRequest)

        // Then
        expect(errors).toContain('비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다')
      })

      it('짧은 이름을 거부한다', () => {
        // Given
        const invalidRequest = {
          email: 'test@example.com',
          password: 'SecurePass123!',
          displayName: 'A',
          acceptTerms: true
        }

        // When
        const errors = AuthModel.validateRegisterRequest(invalidRequest)

        // Then
        expect(errors).toContain('이름은 최소 2자 이상이어야 합니다')
      })

      it('약관 미동의를 거부한다', () => {
        // Given
        const invalidRequest = {
          email: 'test@example.com',
          password: 'SecurePass123!',
          displayName: 'Test User',
          acceptTerms: false
        }

        // When
        const errors = AuthModel.validateRegisterRequest(invalidRequest)

        // Then
        expect(errors).toContain('이용약관에 동의해야 합니다')
      })
    })
  })

  describe('토큰 관리', () => {
    it('만료된 토큰을 올바르게 감지한다', () => {
      // When & Then
      expect(AuthModel.isTokenExpired(mockExpiredTokens)).toBe(true)
      expect(AuthModel.isTokenExpired(mockTokens)).toBe(false)
      expect(AuthModel.isTokenExpired(null)).toBe(true)
    })

    it('세션 유효성을 올바르게 확인한다', () => {
      // Given - 유효한 세션
      const validState: AuthState = {
        status: AuthStatus.AUTHENTICATED,
        user: mockUser,
        tokens: mockTokens,
        error: null,
        lastActivity: new Date() // 현재 시간
      }

      // When & Then
      expect(AuthModel.isSessionValid(validState)).toBe(true)

      // Given - 만료된 토큰
      const expiredTokenState: AuthState = {
        ...validState,
        tokens: mockExpiredTokens
      }

      expect(AuthModel.isSessionValid(expiredTokenState)).toBe(false)

      // Given - 오래된 활동
      const oldActivityState: AuthState = {
        ...validState,
        lastActivity: new Date(Date.now() - 31 * 60 * 1000) // 31분 전
      }

      expect(AuthModel.isSessionValid(oldActivityState)).toBe(false)

      // Given - 비인증 상태
      const unauthenticatedState: AuthState = {
        status: AuthStatus.UNAUTHENTICATED,
        user: null,
        tokens: null,
        error: null,
        lastActivity: null
      }

      expect(AuthModel.isSessionValid(unauthenticatedState)).toBe(false)
    })
  })

  describe('권한 관리', () => {
    it('관리자 권한을 올바르게 확인한다', () => {
      // Given
      const adminUser: User = { ...mockUser, role: UserRole.ADMIN }
      const moderatorUser: User = { ...mockUser, role: UserRole.MODERATOR }
      const normalUser: User = { ...mockUser, role: UserRole.USER }

      // When & Then
      expect(AuthModel.hasPermission(adminUser, UserRole.USER)).toBe(true)
      expect(AuthModel.hasPermission(adminUser, UserRole.MODERATOR)).toBe(true)
      expect(AuthModel.hasPermission(adminUser, UserRole.ADMIN)).toBe(true)

      expect(AuthModel.hasPermission(moderatorUser, UserRole.USER)).toBe(true)
      expect(AuthModel.hasPermission(moderatorUser, UserRole.MODERATOR)).toBe(true)
      expect(AuthModel.hasPermission(moderatorUser, UserRole.ADMIN)).toBe(false)

      expect(AuthModel.hasPermission(normalUser, UserRole.USER)).toBe(true)
      expect(AuthModel.hasPermission(normalUser, UserRole.MODERATOR)).toBe(false)
      expect(AuthModel.hasPermission(normalUser, UserRole.ADMIN)).toBe(false)

      expect(AuthModel.hasPermission(null, UserRole.USER)).toBe(false)
    })
  })

  describe('유틸리티 함수', () => {
    it('사용자 표시 이름을 올바르게 생성한다', () => {
      // Given
      const userWithName: User = { ...mockUser, displayName: 'Custom Name' }
      const userWithoutName: User = { ...mockUser, displayName: null }

      // When & Then
      expect(AuthModel.getDisplayName(userWithName)).toBe('Custom Name')
      expect(AuthModel.getDisplayName(userWithoutName)).toBe('test') // 이메일 앞부분
    })

    it('이메일을 올바르게 마스킹한다', () => {
      // When & Then
      expect(AuthModel.maskEmail('test@example.com')).toBe('te**@example.com')
      expect(AuthModel.maskEmail('a@example.com')).toBe('a*@example.com')
      expect(AuthModel.maskEmail('ab@example.com')).toBe('ab@example.com')
      expect(AuthModel.maskEmail('verylongemail@example.com')).toBe('ve***********@example.com')
    })

    it('로그인 시도 제한을 올바르게 확인한다', () => {
      // Given
      const now = new Date()
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)
      const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000)

      // When & Then - 시도 횟수 미만
      expect(AuthModel.canAttemptLogin(3, null)).toEqual({ canAttempt: true })
      expect(AuthModel.canAttemptLogin(4, tenMinutesAgo)).toEqual({ canAttempt: true })

      // When & Then - 시도 횟수 초과 (아직 잠금 시간 내)
      const resultBlocked = AuthModel.canAttemptLogin(5, tenMinutesAgo)
      expect(resultBlocked.canAttempt).toBe(false)
      expect(resultBlocked.waitTime).toBeGreaterThan(0)

      // When & Then - 시도 횟수 초과 (잠금 시간 경과)
      expect(AuthModel.canAttemptLogin(5, twentyMinutesAgo)).toEqual({ canAttempt: true })

      // When & Then - 마지막 시도 시간 없음 (시도 횟수 초과)
      const resultNoTime = AuthModel.canAttemptLogin(5, null)
      expect(resultNoTime.canAttempt).toBe(false)
      expect(resultNoTime.waitTime).toBe(15 * 60 * 1000) // 15분
    })
  })

  describe('엣지 케이스', () => {
    it('null 값들을 안전하게 처리한다', () => {
      // When & Then
      expect(AuthModel.hasPermission(null, UserRole.USER)).toBe(false)
      expect(AuthModel.isTokenExpired(null)).toBe(true)

      const stateWithNullUser: AuthState = {
        status: AuthStatus.AUTHENTICATED,
        user: null,
        tokens: mockTokens,
        error: null,
        lastActivity: new Date()
      }

      expect(AuthModel.isSessionValid(stateWithNullUser)).toBe(false)
    })

    it('빈 문자열을 올바르게 처리한다', () => {
      // Given
      const emptyRequest = {
        email: '',
        password: '',
        rememberMe: false
      }

      // When
      const errors = AuthModel.validateLoginRequest(emptyRequest)

      // Then
      expect(errors.length).toBeGreaterThan(0)
      expect(errors).toContain('유효한 이메일을 입력하세요')
      expect(errors).toContain('비밀번호는 최소 8자 이상이어야 합니다')
    })
  })
})