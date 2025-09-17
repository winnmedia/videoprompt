/**
 * 환경변수 검증 모듈 테스트
 * FSD Architecture - Test Coverage
 */

import { validateEnvironment } from '@/shared/lib/env-validation'

// 기존 환경변수 백업
const originalEnv = { ...process.env }

describe('환경변수 검증 시스템', () => {
  beforeEach(() => {
    // 각 테스트 전에 환경변수 초기화
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('SUPABASE_') || key === 'NODE_ENV') {
        delete process.env[key]
      }
    })
  })

  afterAll(() => {
    // 테스트 완료 후 원래 환경변수 복원
    process.env = originalEnv
  })

  describe('필수 환경변수 누락 시', () => {
    test('SUPABASE_URL과 SUPABASE_ANON_KEY 모두 없으면 실패해야 함', () => {
      const result = validateEnvironment({ failFast: false, logErrors: false })

      expect(result.success).toBe(false)
      expect(result.mode).toBe('disabled')
      expect(result.canOperateSupabase).toBe(false)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('SUPABASE_URL'),
          expect.stringContaining('SUPABASE_ANON_KEY')
        ])
      )
    })

    test('SUPABASE_URL만 없으면 실패해야 함', () => {
      process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

      const result = validateEnvironment({ failFast: false, logErrors: false })

      expect(result.success).toBe(false)
      expect(result.mode).toBe('disabled')
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('SUPABASE_URL')
        ])
      )
    })

    test('SUPABASE_ANON_KEY만 없으면 실패해야 함', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'

      const result = validateEnvironment({ failFast: false, logErrors: false })

      expect(result.success).toBe(false)
      expect(result.mode).toBe('disabled')
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('SUPABASE_ANON_KEY')
        ])
      )
    })
  })

  describe('최소 환경변수가 있는 경우', () => {
    test('SUPABASE_URL과 SUPABASE_ANON_KEY가 있으면 degraded 모드로 성공', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

      const result = validateEnvironment({ failFast: false, logErrors: false })

      expect(result.success).toBe(true)
      expect(result.mode).toBe('degraded')
      expect(result.canOperateSupabase).toBe(true)
      expect(result.config).toBeDefined()
      expect(result.config!.SUPABASE_URL).toBe('https://test.supabase.co')
    })
  })

  describe('전체 환경변수가 있는 경우', () => {
    test('모든 Supabase 환경변수가 있으면 full 모드로 성공', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

      const result = validateEnvironment({ failFast: false, logErrors: false })

      expect(result.success).toBe(true)
      expect(result.mode).toBe('full')
      expect(result.canOperateSupabase).toBe(true)
    })
  })

  describe('잘못된 형식의 환경변수', () => {
    test('잘못된 URL 형식은 실패해야 함', () => {
      process.env.SUPABASE_URL = 'invalid-url'
      process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

      const result = validateEnvironment({ failFast: false, logErrors: false })

      expect(result.success).toBe(false)
      expect(result.mode).toBe('disabled')
    })

    test('잘못된 JWT 토큰 형식은 실패해야 함', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_ANON_KEY = 'invalid-jwt-token'

      const result = validateEnvironment({ failFast: false, logErrors: false })

      expect(result.success).toBe(false)
      expect(result.mode).toBe('disabled')
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('JWT token')
        ])
      )
    })
  })
})