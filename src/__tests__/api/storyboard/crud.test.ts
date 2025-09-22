/**
 * Storyboard CRUD Operations API Tests
 *
 * TDD Red Phase: CRUD 작업 실패하는 테스트 작성
 * CLAUDE.md 준수: TDD, MSW 모킹, Zod 검증, 비용 안전 규칙
 */

import { http, HttpResponse } from 'msw'
import { server } from '../../../shared/testing/msw/setup'
import { storyboardTestUtils } from '../../../shared/testing/msw/handlers/storyboard-handlers'
import type {
  Storyboard,
  StoryboardCreateInput,
  StoryboardUpdateInput,
  StoryboardFrame,
  FrameGenerationRequest
} from '../../../entities/storyboard'

describe('/api/storyboard/[id] - CRUD Operations', () => {
  beforeEach(() => {
    storyboardTestUtils.resetApiLimiter()
    storyboardTestUtils.clearMockStoryboards()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    server.resetHandlers()
  })

  describe('Red Phase: CREATE - 스토리보드 생성', () => {
    it('유효한 데이터로 스토리보드 생성이 성공해야 함', async () => {
      // Given: 유효한 생성 데이터
      const createData: StoryboardCreateInput = {
        scenarioId: 'scenario-test-001',
        title: '새로운 스토리보드',
        description: '테스트용 스토리보드 생성',
        userId: 'user-test-001',
        config: {
          model: 'dall-e-3',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic'
        }
      }

      // When: 스토리보드 생성 API 호출
      const response = await fetch('/api/storyboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData)
      })

      // Then: 생성 성공 및 올바른 응답 형식
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('metadata')
      expect(result.data.metadata.title).toBe(createData.title)
      expect(result.data.metadata.scenarioId).toBe(createData.scenarioId)
      expect(result.data.metadata.userId).toBe(createData.userId)
      expect(result.data.metadata.status).toBe('draft')
      expect(result.data.metadata.version).toBe(1)
      expect(result.data.frames).toEqual([])
    })

    it('필수 필드 누락 시 400 에러를 반환해야 함', async () => {
      // Given: 필수 필드가 누락된 데이터들
      const invalidInputs = [
        {
          // title 누락
          scenarioId: 'scenario-test-001',
          userId: 'user-test-001'
        },
        {
          // scenarioId 누락
          title: '테스트 스토리보드',
          userId: 'user-test-001'
        },
        {
          // userId 누락
          scenarioId: 'scenario-test-001',
          title: '테스트 스토리보드'
        }
      ]

      // When & Then: 각 잘못된 입력에 대해 400 에러 검증
      for (const invalidInput of invalidInputs) {
        const response = await fetch('/api/storyboards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidInput)
        })

        expect(response.status).toBe(400)

        const result = await response.json()
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.details).toBeDefined()
      }
    })

    it('중복된 제목으로 생성 시 적절한 처리가 되어야 함', async () => {
      // Given: 이미 존재하는 제목
      const existingTitle = '기존 스토리보드'
      const firstCreateData: StoryboardCreateInput = {
        scenarioId: 'scenario-test-001',
        title: existingTitle,
        userId: 'user-test-001'
      }

      // 첫 번째 스토리보드 생성
      const firstResponse = await fetch('/api/storyboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firstCreateData)
      })
      expect(firstResponse.ok).toBe(true)

      // When: 동일한 제목으로 두 번째 생성 시도
      const secondCreateData: StoryboardCreateInput = {
        scenarioId: 'scenario-test-001',
        title: existingTitle,
        userId: 'user-test-001'
      }

      const secondResponse = await fetch('/api/storyboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(secondCreateData)
      })

      // Then: 자동으로 제목이 수정되어 생성되거나 409 에러 반환
      if (secondResponse.status === 409) {
        const result = await secondResponse.json()
        expect(result.error.code).toBe('DUPLICATE_TITLE')
      } else {
        expect(secondResponse.ok).toBe(true)
        const result = await secondResponse.json()
        expect(result.data.metadata.title).not.toBe(existingTitle)
        expect(result.data.metadata.title).toContain(existingTitle)
      }
    })
  })

  describe('Red Phase: READ - 스토리보드 조회', () => {
    it('ID로 스토리보드 상세 조회가 성공해야 함', async () => {
      // Given: 존재하는 스토리보드 ID
      const storyboards = storyboardTestUtils.getMockStoryboards()
      const existingId = storyboards[0]?.metadata.id || 'storyboard-test-001'

      // When: 스토리보드 조회 API 호출
      const response = await fetch(`/api/storyboards/${existingId}`)

      // Then: 상세 정보 반환
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('metadata')
      expect(result.data).toHaveProperty('frames')
      expect(result.data).toHaveProperty('settings')
      expect(result.data.metadata.id).toBe(existingId)
    })

    it('존재하지 않는 ID로 조회 시 404 에러를 반환해야 함', async () => {
      // Given: 존재하지 않는 스토리보드 ID
      const nonExistentId = 'non-existent-storyboard'

      // When: 스토리보드 조회 API 호출
      const response = await fetch(`/api/storyboards/${nonExistentId}`)

      // Then: 404 에러 반환
      expect(response.status).toBe(404)

      const result = await response.json()
      expect(result.error.message).toContain('스토리보드를 찾을 수 없습니다')
    })

    it('스토리보드 목록 조회가 올바르게 동작해야 함', async () => {
      // Given: 여러 스토리보드가 있는 상태
      const mockStoryboards = storyboardTestUtils.getMockStoryboards()

      // When: 목록 조회 API 호출
      const response = await fetch('/api/storyboards')

      // Then: 목록 반환
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toBeInstanceOf(Array)
      expect(result.pagination).toBeDefined()
      expect(result.pagination).toHaveProperty('total')
      expect(result.pagination).toHaveProperty('page')
      expect(result.pagination).toHaveProperty('limit')
    })

    it('시나리오 ID로 필터링된 목록 조회가 동작해야 함', async () => {
      // Given: 특정 시나리오 ID
      const scenarioId = 'scenario-test-001'

      // When: 필터링된 목록 조회
      const response = await fetch(`/api/storyboards?scenarioId=${scenarioId}`)

      // Then: 해당 시나리오의 스토리보드만 반환
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toBeInstanceOf(Array)

      // 모든 결과가 해당 시나리오 ID를 가져야 함
      result.data.forEach((storyboard: Storyboard) => {
        expect(storyboard.metadata.scenarioId).toBe(scenarioId)
      })
    })

    it('페이지네이션이 올바르게 동작해야 함', async () => {
      // Given: 페이지네이션 파라미터
      const page = 2
      const limit = 5

      // When: 페이지네이션된 목록 조회
      const response = await fetch(`/api/storyboards?page=${page}&limit=${limit}`)

      // Then: 올바른 페이지네이션 정보 반환
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.pagination.page).toBe(page)
      expect(result.pagination.limit).toBe(limit)
      expect(result.data.length).toBeLessThanOrEqual(limit)
    })
  })

  describe('Red Phase: UPDATE - 스토리보드 수정', () => {
    it('스토리보드 메타데이터 수정이 성공해야 함', async () => {
      // Given: 수정할 스토리보드와 업데이트 데이터
      const storyboards = storyboardTestUtils.getMockStoryboards()
      const existingId = storyboards[0]?.metadata.id || 'storyboard-test-001'

      const updateData: StoryboardUpdateInput = {
        title: '수정된 스토리보드 제목',
        description: '수정된 설명입니다'
      }

      // When: 스토리보드 수정 API 호출
      const response = await fetch(`/api/storyboards/${existingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      // Then: 수정 성공 및 버전 증가
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data.metadata.title).toBe(updateData.title)
      expect(result.data.metadata.description).toBe(updateData.description)
      expect(result.data.metadata.version).toBeGreaterThan(1)
      expect(result.data.metadata.updatedAt).toBeDefined()
    })

    it('스토리보드 설정 수정이 올바르게 동작해야 함', async () => {
      // Given: 설정 업데이트 데이터
      const storyboards = storyboardTestUtils.getMockStoryboards()
      const existingId = storyboards[0]?.metadata.id || 'storyboard-test-001'

      const updateData: StoryboardUpdateInput = {
        settings: {
          defaultConfig: {
            model: 'stable-diffusion',
            aspectRatio: '9:16',
            quality: '4k',
            style: 'anime'
          },
          qualityThreshold: 0.8,
          maxRetries: 5,
          batchSize: 3
        }
      }

      // When: 설정 수정 API 호출
      const response = await fetch(`/api/storyboards/${existingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      // Then: 설정이 올바르게 수정되어야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data.settings.defaultConfig.model).toBe('stable-diffusion')
      expect(result.data.settings.qualityThreshold).toBe(0.8)
      expect(result.data.settings.maxRetries).toBe(5)
      expect(result.data.settings.batchSize).toBe(3)
    })

    it('부분 업데이트가 올바르게 동작해야 함', async () => {
      // Given: 일부 필드만 업데이트
      const storyboards = storyboardTestUtils.getMockStoryboards()
      const existingId = storyboards[0]?.metadata.id || 'storyboard-test-001'

      const partialUpdate = {
        title: '부분 업데이트된 제목'
        // description은 업데이트하지 않음
      }

      // When: 부분 업데이트 API 호출
      const response = await fetch(`/api/storyboards/${existingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partialUpdate)
      })

      // Then: 지정된 필드만 수정되고 나머지는 보존
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data.metadata.title).toBe(partialUpdate.title)
      // 기존 description이 보존되어야 함
      expect(result.data.metadata.description).toBeDefined()
    })

    it('잘못된 업데이트 데이터로 400 에러를 반환해야 함', async () => {
      // Given: 잘못된 업데이트 데이터
      const storyboards = storyboardTestUtils.getMockStoryboards()
      const existingId = storyboards[0]?.metadata.id || 'storyboard-test-001'

      const invalidUpdates = [
        {
          title: '', // 빈 제목
        },
        {
          title: 'a'.repeat(101), // 너무 긴 제목
        },
        {
          settings: {
            qualityThreshold: 1.5 // 범위 초과
          }
        }
      ]

      // When & Then: 각 잘못된 업데이트에 대해 400 에러 검증
      for (const invalidUpdate of invalidUpdates) {
        const response = await fetch(`/api/storyboards/${existingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidUpdate)
        })

        expect(response.status).toBe(400)

        const result = await response.json()
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('Red Phase: DELETE - 스토리보드 삭제', () => {
    it('스토리보드 삭제가 성공해야 함', async () => {
      // Given: 삭제할 스토리보드
      const storyboards = storyboardTestUtils.getMockStoryboards()
      const existingId = storyboards[0]?.metadata.id || 'storyboard-test-001'

      // When: 스토리보드 삭제 API 호출
      const response = await fetch(`/api/storyboards/${existingId}`, {
        method: 'DELETE'
      })

      // Then: 삭제 성공
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)

      // 삭제 후 조회 시 404 에러
      const getResponse = await fetch(`/api/storyboards/${existingId}`)
      expect(getResponse.status).toBe(404)
    })

    it('소프트 삭제가 올바르게 동작해야 함', async () => {
      // Given: 소프트 삭제 설정
      const storyboards = storyboardTestUtils.getMockStoryboards()
      const existingId = storyboards[0]?.metadata.id || 'storyboard-test-001'

      // When: 소프트 삭제 API 호출
      const response = await fetch(`/api/storyboards/${existingId}?soft=true`, {
        method: 'DELETE'
      })

      // Then: 소프트 삭제 성공
      expect(response.ok).toBe(true)

      // 일반 조회에서는 보이지 않지만 관리자 조회에서는 보임
      const getResponse = await fetch(`/api/storyboards/${existingId}`)
      expect(getResponse.status).toBe(404)

      const adminGetResponse = await fetch(`/api/storyboards/${existingId}?includeDeleted=true`)
      expect(adminGetResponse.ok).toBe(true)

      const adminResult = await adminGetResponse.json()
      expect(adminResult.data.metadata.status).toBe('archived')
    })

    it('존재하지 않는 스토리보드 삭제 시 404 에러를 반환해야 함', async () => {
      // Given: 존재하지 않는 스토리보드 ID
      const nonExistentId = 'non-existent-storyboard'

      // When: 삭제 API 호출
      const response = await fetch(`/api/storyboards/${nonExistentId}`, {
        method: 'DELETE'
      })

      // Then: 404 에러 반환
      expect(response.status).toBe(404)

      const result = await response.json()
      expect(result.error.message).toContain('스토리보드를 찾을 수 없습니다')
    })

    it('권한이 없는 사용자의 삭제 시도 시 403 에러를 반환해야 함', async () => {
      // Given: 다른 사용자의 스토리보드
      const storyboards = storyboardTestUtils.getMockStoryboards()
      const existingId = storyboards[0]?.metadata.id || 'storyboard-test-001'

      // When: 권한 없는 사용자로 삭제 시도
      const response = await fetch(`/api/storyboards/${existingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer wrong-user-token'
        }
      })

      // Then: 403 에러 반환
      expect(response.status).toBe(403)

      const result = await response.json()
      expect(result.error.code).toBe('INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Red Phase: 복합 작업 및 트랜잭션', () => {
    it('스토리보드와 프레임 일괄 생성이 성공해야 함', async () => {
      // Given: 스토리보드와 프레임을 함께 생성하는 요청
      const bulkCreateData = {
        storyboard: {
          scenarioId: 'scenario-test-001',
          title: '일괄 생성 스토리보드',
          userId: 'user-test-001'
        },
        frames: [
          {
            sceneId: 'scene-001',
            sceneDescription: '첫 번째 프레임',
            priority: 'high' as const
          },
          {
            sceneId: 'scene-002',
            sceneDescription: '두 번째 프레임',
            priority: 'normal' as const
          }
        ]
      }

      // When: 일괄 생성 API 호출
      const response = await fetch('/api/storyboards/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkCreateData)
      })

      // Then: 스토리보드와 프레임이 함께 생성되어야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data.storyboard).toBeDefined()
      expect(result.data.frames).toHaveLength(2)
      expect(result.data.storyboard.frames).toHaveLength(2)
    })

    it('트랜잭션 실패 시 롤백이 올바르게 동작해야 함', async () => {
      // Given: 실패를 유발하는 일괄 생성 요청
      server.use(
        http.post('/api/storyboards/bulk-create', () => {
          return HttpResponse.json(
            { error: { code: 'TRANSACTION_FAILED', message: '트랜잭션 실패' } },
            { status: 500 }
          )
        })
      )

      const bulkCreateData = {
        storyboard: {
          scenarioId: 'scenario-test-001',
          title: '실패할 스토리보드',
          userId: 'user-test-001'
        },
        frames: [
          {
            sceneId: 'scene-001',
            sceneDescription: '실패할 프레임'
          }
        ]
      }

      // When: 실패하는 일괄 생성 시도
      const response = await fetch('/api/storyboards/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkCreateData)
      })

      // Then: 실패 시 아무것도 생성되지 않아야 함
      expect(response.status).toBe(500)

      // 스토리보드가 생성되지 않았는지 확인
      const listResponse = await fetch('/api/storyboards')
      const listResult = await listResponse.json()
      const createdStoryboard = listResult.data.find(
        (sb: Storyboard) => sb.metadata.title === '실패할 스토리보드'
      )
      expect(createdStoryboard).toBeUndefined()
    })

    it('스토리보드 복제가 올바르게 동작해야 함', async () => {
      // Given: 복제할 스토리보드
      const storyboards = storyboardTestUtils.getMockStoryboards()
      const sourceId = storyboards[0]?.metadata.id || 'storyboard-test-001'

      const cloneData = {
        newTitle: '복제된 스토리보드',
        includeFrames: true,
        resetStatistics: true
      }

      // When: 스토리보드 복제 API 호출
      const response = await fetch(`/api/storyboards/${sourceId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cloneData)
      })

      // Then: 복제가 성공하고 새 ID를 가져야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data.metadata.id).not.toBe(sourceId)
      expect(result.data.metadata.title).toBe(cloneData.newTitle)
      expect(result.data.metadata.version).toBe(1) // 새 버전으로 시작
      expect(result.data.statistics).toBeUndefined() // 통계 리셋
    })
  })
})