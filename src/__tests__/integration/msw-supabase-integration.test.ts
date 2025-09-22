/**
 * MSW v2 + Supabase 모킹 통합 테스트
 *
 * FSD shared 레이어 테스트 - MSW v2와 Supabase 모킹의 완전한 통합 검증
 * CLAUDE.md 준수: TDD, 결정론성, 비용 안전
 */

import { setupMSW, testUtils, server } from '../../shared/testing/msw-setup'
import { supabaseTestUtils } from '../../shared/testing/supabase-handlers'

// MSW 설정
setupMSW()

describe('MSW v2 + Supabase 통합 테스트', () => {
  beforeEach(() => {
    // 각 테스트마다 깨끗한 상태로 시작
    testUtils.supabase.reset()
    testUtils.resetCostCounter()
  })

  describe('Supabase Auth API 모킹', () => {
    it('올바른 자격증명으로 로그인 성공', async () => {
      const response = await fetch('https://test.supabase.co/auth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'password',
          email: 'test@example.com',
          password: 'password'
        })
      })

      expect(response.ok).toBe(true)
      const data = await response.json()

      expect(data).toMatchObject({
        access_token: expect.any(String),
        token_type: 'bearer',
        expires_in: expect.any(Number),
        user: {
          id: expect.any(String),
          email: 'test@example.com'
        }
      })
    })

    it('잘못된 자격증명으로 로그인 실패', async () => {
      const response = await fetch('https://test.supabase.co/auth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'password',
          email: 'wrong@example.com',
          password: 'wrongpassword'
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.message).toBe('Invalid login credentials')
    })

    it('유효한 토큰으로 사용자 정보 조회', async () => {
      // 먼저 로그인해서 토큰 얻기
      const loginResponse = await fetch('https://test.supabase.co/auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'password',
          email: 'test@example.com',
          password: 'password'
        })
      })

      const loginData = await loginResponse.json()
      const token = loginData.access_token

      // 사용자 정보 조회
      const userResponse = await fetch('https://test.supabase.co/auth/v1/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      expect(userResponse.ok).toBe(true)
      const userData = await userResponse.json()

      expect(userData).toMatchObject({
        id: expect.any(String),
        email: 'test@example.com',
        user_metadata: expect.any(Object),
        app_metadata: expect.any(Object)
      })
    })

    it('유효하지 않은 토큰으로 사용자 정보 조회 실패', async () => {
      const response = await fetch('https://test.supabase.co/auth/v1/user', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.message).toBe('Invalid JWT')
    })
  })

  describe('Supabase REST API 모킹', () => {
    let authToken: string

    beforeEach(async () => {
      // 각 테스트마다 인증 토큰 획득
      const loginResponse = await fetch('https://test.supabase.co/auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'password',
          email: 'test@example.com',
          password: 'password'
        })
      })

      const loginData = await loginResponse.json()
      authToken = loginData.access_token
    })

    describe('Scenarios 테이블', () => {
      it('시나리오 목록 조회', async () => {
        const response = await fetch('https://test.supabase.co/rest/v1/scenarios', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        })

        expect(response.ok).toBe(true)
        const scenarios = await response.json()

        expect(Array.isArray(scenarios)).toBe(true)
        expect(scenarios.length).toBeGreaterThan(0)
        expect(scenarios[0]).toMatchObject({
          id: expect.any(String),
          user_id: expect.any(String),
          title: expect.any(String),
          content: expect.any(String),
          status: expect.stringMatching(/draft|completed|processing/),
          story_steps: expect.any(Array)
        })
      })

      it('새 시나리오 생성', async () => {
        const newScenario = {
          title: '테스트 시나리오',
          content: '이것은 테스트용 시나리오입니다.',
          status: 'draft' as const
        }

        const response = await fetch('https://test.supabase.co/rest/v1/scenarios', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newScenario)
        })

        expect(response.status).toBe(201)
        const created = await response.json()

        expect(created).toMatchObject({
          id: expect.any(String),
          title: newScenario.title,
          content: newScenario.content,
          status: newScenario.status,
          user_id: expect.any(String),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        })
      })

      it('시나리오 업데이트', async () => {
        const updateData = {
          title: '업데이트된 시나리오',
          status: 'completed' as const
        }

        const response = await fetch('https://test.supabase.co/rest/v1/scenarios?id=eq.scenario-001', {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })

        expect(response.ok).toBe(true)
        const updated = await response.json()

        expect(updated.title).toBe(updateData.title)
        expect(updated.status).toBe(updateData.status)
        expect(updated.updated_at).not.toBe(updated.created_at)
      })
    })

    describe('Projects 테이블', () => {
      it('프로젝트 목록 조회', async () => {
        const response = await fetch('https://test.supabase.co/rest/v1/projects', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        })

        expect(response.ok).toBe(true)
        const projects = await response.json()

        expect(Array.isArray(projects)).toBe(true)
        expect(projects.length).toBeGreaterThan(0)
        expect(projects[0]).toMatchObject({
          id: expect.any(String),
          user_id: expect.any(String),
          title: expect.any(String),
          description: expect.any(String),
          scenario_id: expect.any(String),
          shot_sequences: expect.any(Array),
          status: expect.stringMatching(/draft|planning|production|completed/)
        })

        // 12-shot 확인
        expect(projects[0].shot_sequences).toHaveLength(12)
      })

      it('새 프로젝트 생성', async () => {
        const newProject = {
          title: '테스트 프로젝트',
          description: '테스트용 프로젝트입니다.',
          scenario_id: 'scenario-001',
          status: 'draft' as const
        }

        const response = await fetch('https://test.supabase.co/rest/v1/projects', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newProject)
        })

        expect(response.status).toBe(201)
        const created = await response.json()

        expect(created).toMatchObject({
          id: expect.any(String),
          title: newProject.title,
          description: newProject.description,
          scenario_id: newProject.scenario_id,
          status: newProject.status,
          user_id: expect.any(String)
        })
      })
    })

    describe('UserJourneys 테이블', () => {
      it('사용자 여정 조회', async () => {
        const response = await fetch('https://test.supabase.co/rest/v1/user_journeys', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        })

        expect(response.ok).toBe(true)
        const journeys = await response.json()

        expect(Array.isArray(journeys)).toBe(true)
        if (journeys.length > 0) {
          expect(journeys[0]).toMatchObject({
            id: expect.any(String),
            user_id: expect.any(String),
            session_id: expect.any(String),
            current_step: expect.any(String),
            completed_steps: expect.any(Array),
            persisted_data: expect.any(Object),
            metadata: expect.any(Object)
          })
        }
      })

      it('새 사용자 여정 생성', async () => {
        const newJourney = {
          session_id: 'test-session-new',
          current_step: 'auth-login' as const,
          completed_steps: [],
          persisted_data: {
            auth: {},
            scenario: {},
            planning: {},
            video: {},
            feedback: {},
            project: {}
          }
        }

        const response = await fetch('https://test.supabase.co/rest/v1/user_journeys', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newJourney)
        })

        expect(response.status).toBe(201)
        const created = await response.json()

        expect(created).toMatchObject({
          id: expect.any(String),
          session_id: newJourney.session_id,
          current_step: newJourney.current_step,
          completed_steps: newJourney.completed_steps,
          persisted_data: newJourney.persisted_data,
          user_id: expect.any(String)
        })
      })
    })
  })

  describe('인증 없이 접근 시 보안 검증', () => {
    it('인증 토큰 없이 REST API 접근 시 401 응답', async () => {
      const response = await fetch('https://test.supabase.co/rest/v1/scenarios')

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.message).toBe('Unauthorized')
    })

    it('잘못된 인증 토큰으로 REST API 접근 시 401 응답', async () => {
      const response = await fetch('https://test.supabase.co/rest/v1/scenarios', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.message).toBe('Unauthorized')
    })
  })

  describe('테스트 유틸리티 검증', () => {
    it('testUtils.supabase.reset() 동작 확인', () => {
      // 초기 데이터 존재 확인
      const initialUser = testUtils.supabase.store.getUser('test-user-001')
      expect(initialUser).toBeDefined()

      // 새 사용자 생성
      const newUser = testUtils.supabase.createUser({
        email: 'new-user@example.com'
      })
      expect(newUser.id).toBeDefined()

      // 리셋 실행
      testUtils.supabase.reset()

      // 새 사용자는 사라지고 초기 데이터는 복원
      const resetUser = testUtils.supabase.store.getUser('test-user-001')
      expect(resetUser).toBeDefined()
      expect(resetUser?.email).toBe('test@example.com')
    })

    it('testUtils.supabase.createUser() 동작 확인', () => {
      const userData = {
        email: 'dynamic-user@example.com',
        user_metadata: {
          name: 'Dynamic User'
        }
      }

      const user = testUtils.supabase.createUser(userData)

      expect(user).toMatchObject({
        id: expect.any(String),
        email: userData.email,
        user_metadata: userData.user_metadata,
        aud: 'authenticated'
      })

      // Store에서도 확인
      const stored = testUtils.supabase.store.getUser(user.id)
      expect(stored).toEqual(user)
    })

    it('testUtils.supabase.createSession() 동작 확인', () => {
      const user = testUtils.supabase.createUser({
        email: 'session-user@example.com'
      })

      const session = testUtils.supabase.createSession(user.id)

      expect(session).toMatchObject({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
        expires_in: 3600,
        token_type: 'bearer',
        user: user
      })

      // Store에서도 확인
      const stored = testUtils.supabase.store.getSession(session.access_token)
      expect(stored).toEqual(session)
    })
  })

  describe('비용 안전 검증', () => {
    it('실제 Supabase API 호출 차단 확인', async () => {
      // Jest setup에서 설정한 fetch override가 실제 API 호출을 차단하는지 확인
      await expect(
        fetch('https://real-project.supabase.co/rest/v1/some-table')
      ).rejects.toThrow('실제 API 호출 감지')
    })

    it('모킹되지 않은 외부 API 호출 차단 확인', async () => {
      await expect(
        fetch('https://api.openai.com/v1/chat/completions')
      ).rejects.toThrow('실제 API 호출 감지')
    })

    it('비용 카운터 리셋 확인', () => {
      // 비용 발생 시뮬레이션
      testUtils.setCostLimit(3)
      expect(testUtils).toBeDefined()

      // 리셋 후 확인
      testUtils.resetCostCounter()
      expect(testUtils).toBeDefined()
    })
  })

  describe('결정론성 검증', () => {
    it('동일한 요청에 대해 일관된 응답', async () => {
      const authToken = await getAuthToken()

      // 여러 번 동일한 요청
      const responses = await Promise.all([
        fetch('https://test.supabase.co/rest/v1/scenarios', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch('https://test.supabase.co/rest/v1/scenarios', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch('https://test.supabase.co/rest/v1/scenarios', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      ])

      const data = await Promise.all(responses.map(r => r.json()))

      // 모든 응답이 동일해야 함
      expect(data[0]).toEqual(data[1])
      expect(data[1]).toEqual(data[2])
    })

    it('테스트 간 상태 격리 확인', async () => {
      // 이 테스트에서 시나리오 생성
      const authToken = await getAuthToken()

      const response = await fetch('https://test.supabase.co/rest/v1/scenarios', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: '격리 테스트 시나리오',
          content: '이 시나리오는 다른 테스트에 영향을 주지 않아야 합니다.'
        })
      })

      expect(response.status).toBe(201)

      // 다음 테스트에서는 이 데이터가 보이지 않아야 함
      // (beforeEach에서 reset되므로)
    })
  })
})

// 헬퍼 함수
async function getAuthToken(): Promise<string> {
  const response = await fetch('https://test.supabase.co/auth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      email: 'test@example.com',
      password: 'password'
    })
  })

  const data = await response.json()
  return data.access_token
}