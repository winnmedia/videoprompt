/**
 * Register API 실제 데이터 저장 검증 테스트 (TDD)
 *
 * 목표: Mock이 아닌 실제 Supabase 테이블에 데이터 저장 검증
 * 데이터 계약: 사용자 정보가 실제로 users 테이블에 저장되어야 함
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getSupabaseClientForAPI, getSupabaseAdminForAPI } from '@/shared/lib/supabase-safe'

describe('Register API 실제 저장 검증', () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    username: `testuser${Date.now()}`,
    password: 'testPassword123!',
  }

  let createdUserId: string | null = null

  afterEach(async () => {
    // 테스트 후 생성된 사용자 정리
    if (createdUserId) {
      try {
        const { client: adminClient } = getSupabaseAdminForAPI()
        const { client: supabaseClient } = getSupabaseClientForAPI()

        if (adminClient) {
          await adminClient.auth.admin.deleteUser(createdUserId)
        }

        // users 테이블에서도 제거 (존재하는 경우)
        if (supabaseClient) {
          await supabaseClient
            .from('users')
            .delete()
            .eq('id', createdUserId)
        }
      } catch (error) {
        console.warn('테스트 사용자 정리 실패:', error)
      }
    }
  })

  it('[FAILING] 회원가입 시 실제 Supabase users 테이블에 저장되어야 함', async () => {
    // Red Phase: 실패하는 테스트
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    })

    const result = await response.json()

    console.log('API Response:', { status: response.status, result })

    expect(response.status).toBe(201)
    expect(result.success).toBe(true)
    expect(result.data.id).toBeDefined()

    createdUserId = result.data.id

    // 🔥 핵심 검증: 실제 users 테이블에 저장되었는지 확인
    const { client: supabaseClient } = getSupabaseClientForAPI()

    if (supabaseClient) {
      const { data: storedUser, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', createdUserId)
        .single()

      // 이제 실제 저장되어야 함
      expect(error).toBeNull()
      expect(storedUser).not.toBeNull()
      expect(storedUser.email).toBe(testUser.email)
      expect(storedUser.username).toBe(testUser.username)
    }
  })

  it('[FAILING] 저장된 사용자 정보가 데이터 계약을 준수해야 함', async () => {
    // 사용자 생성
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    })

    const result = await response.json()
    createdUserId = result.data.id

    const { client: supabaseClient } = getSupabaseClientForAPI()

    if (supabaseClient) {
      const { data: storedUser } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', createdUserId)
        .single()

      // 데이터 계약 검증
      expect(storedUser.id).toBe(createdUserId)
      expect(storedUser.email).toBe(testUser.email)
      expect(storedUser.username).toBe(testUser.username)
      expect(storedUser.role).toBe('user') // 기본값
      expect(storedUser.email_verified).toBe(false) // 기본값 (개발환경에서는 true일 수 있음)
      expect(storedUser.created_at).toBeDefined()
      expect(storedUser.updated_at).toBeDefined()
    }
  })

  it('[FAILING] 중복 이메일 등록 시 적절한 에러 처리', async () => {
    // 첫 번째 사용자 생성
    const firstResponse = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    })

    const firstResult = await firstResponse.json()
    createdUserId = firstResult.data.id

    // 같은 이메일로 두 번째 등록 시도
    const secondResponse = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...testUser,
        username: 'different-username',
      }),
    })

    const secondResult = await secondResponse.json()

    expect(secondResponse.status).toBe(400)
    expect(secondResult.success).toBe(false)
    expect(secondResult.error).toContain('이미 등록된')
  })

  it('Supabase 클라이언트가 사용 가능해야 함', () => {
    // 테스트 실행 전제 조건 검증
    const { client: supabaseClient } = getSupabaseClientForAPI()
    expect(supabaseClient).not.toBeNull()
    expect(supabaseClient).toBeDefined()
  })
})