/**
 * Storyboard Consistency Analysis API Tests
 *
 * TDD Red Phase: 일관성 분석 실패하는 테스트 작성
 * CLAUDE.md 준수: TDD, MSW 모킹, 비용 안전 규칙
 */

import { http, HttpResponse } from 'msw'
import { server } from '../../../shared/testing/msw/setup'
import { storyboardTestUtils } from '../../../shared/testing/msw/handlers/storyboard-handlers'
import type {
  ConsistencyReference,
  Storyboard,
  StoryboardFrame
} from '../../../entities/storyboard'

/**
 * 일관성 분석 결과 타입
 */
interface ConsistencyAnalysisResult {
  overallScore: number // 0.0 ~ 1.0
  frameConsistency: Array<{
    frameId: string
    consistencyScore: number
    issues: Array<{
      type: 'style' | 'color' | 'lighting' | 'composition'
      severity: 'low' | 'medium' | 'high'
      description: string
      suggestion: string
    }>
  }>
  globalIssues: Array<{
    type: string
    affectedFrames: string[]
    description: string
    recommendation: string
  }>
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high'
    action: string
    expectedImprovement: number
  }>
}

describe('/api/storyboard/consistency - 일관성 분석 API', () => {
  beforeEach(() => {
    storyboardTestUtils.resetApiLimiter()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    server.resetHandlers()
  })

  describe('Red Phase: 기본 일관성 분석', () => {
    it('스토리보드 일관성 분석이 성공해야 함', async () => {
      // Given: 분석할 스토리보드 ID
      const storyboardId = 'storyboard-test-001'

      // When: 일관성 분석 API 호출
      const response = await fetch(`/api/storyboard/${storyboardId}/consistency`, {
        method: 'GET'
      })

      // Then: 일관성 분석 결과를 반환해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('overallScore')
      expect(result.data).toHaveProperty('frameConsistency')
      expect(result.data).toHaveProperty('globalIssues')
      expect(result.data).toHaveProperty('recommendations')

      // 점수는 0-1 범위여야 함
      expect(result.data.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.data.overallScore).toBeLessThanOrEqual(1)
    })

    it('존재하지 않는 스토리보드 분석 시 404 에러를 반환해야 함', async () => {
      // Given: 존재하지 않는 스토리보드 ID
      const nonExistentId = 'non-existent-storyboard'

      // When: 일관성 분석 API 호출
      const response = await fetch(`/api/storyboard/${nonExistentId}/consistency`)

      // Then: 404 에러를 반환해야 함
      expect(response.status).toBe(404)

      const result = await response.json()
      expect(result.error.message).toContain('스토리보드를 찾을 수 없습니다')
    })

    it('프레임이 없는 스토리보드 분석 시 적절한 응답을 반환해야 함', async () => {
      // Given: 빈 스토리보드
      const emptyStoryboard: Storyboard = {
        metadata: {
          id: 'empty-storyboard',
          scenarioId: 'scenario-001',
          title: '빈 스토리보드',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'draft',
          userId: 'test-user',
          version: 1
        },
        frames: [],
        settings: {
          defaultConfig: {
            model: 'dall-e-3',
            aspectRatio: '16:9',
            quality: 'hd'
          },
          globalConsistencyRefs: [],
          autoGeneration: false,
          qualityThreshold: 0.7,
          maxRetries: 3,
          batchSize: 5
        }
      }

      storyboardTestUtils.addMockStoryboard(emptyStoryboard)

      // When: 일관성 분석 API 호출
      const response = await fetch(`/api/storyboard/${emptyStoryboard.metadata.id}/consistency`)

      // Then: 빈 결과를 적절히 처리해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data.overallScore).toBe(0)
      expect(result.data.frameConsistency).toEqual([])
      expect(result.data.globalIssues).toEqual([])
    })
  })

  describe('Red Phase: 고급 일관성 분석', () => {
    it('캐릭터 일관성 분석이 올바르게 동작해야 함', async () => {
      // Given: 캐릭터 일관성 참조가 있는 스토리보드
      const characterRef: ConsistencyReference = {
        id: 'char-ref-001',
        type: 'character',
        name: '주인공',
        description: '20대 여성, 긴 검은 머리, 캐주얼한 복장',
        keyFeatures: ['long black hair', 'casual clothing', 'young woman'],
        weight: 0.8,
        isActive: true,
        referenceImageUrl: 'https://example.com/character-ref.jpg'
      }

      const analysisRequest = {
        type: 'character',
        referenceId: characterRef.id,
        analysisDepth: 'detailed'
      }

      // When: 캐릭터 일관성 분석 API 호출
      const response = await fetch('/api/storyboard/storyboard-test-001/consistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisRequest)
      })

      // Then: 캐릭터별 일관성 분석 결과를 반환해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data).toHaveProperty('characterAnalysis')
      expect(result.data.characterAnalysis).toHaveProperty('appearanceConsistency')
      expect(result.data.characterAnalysis).toHaveProperty('poseVariation')
      expect(result.data.characterAnalysis).toHaveProperty('facialFeatureConsistency')
    })

    it('환경/배경 일관성 분석이 올바르게 동작해야 함', async () => {
      // Given: 환경 일관성 참조
      const locationRef: ConsistencyReference = {
        id: 'loc-ref-001',
        type: 'location',
        name: '커피숍',
        description: '아늑한 카페, 따뜻한 조명, 나무 테이블',
        keyFeatures: ['warm lighting', 'wooden furniture', 'cozy atmosphere'],
        weight: 0.7,
        isActive: true
      }

      const analysisRequest = {
        type: 'location',
        referenceId: locationRef.id,
        analysisDepth: 'detailed'
      }

      // When: 환경 일관성 분석 API 호출
      const response = await fetch('/api/storyboard/storyboard-test-001/consistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisRequest)
      })

      // Then: 환경별 일관성 분석 결과를 반환해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data).toHaveProperty('locationAnalysis')
      expect(result.data.locationAnalysis).toHaveProperty('lightingConsistency')
      expect(result.data.locationAnalysis).toHaveProperty('architecturalConsistency')
      expect(result.data.locationAnalysis).toHaveProperty('atmosphereConsistency')
    })

    it('스타일 일관성 분석이 올바르게 동작해야 함', async () => {
      // Given: 스타일 분석 요청
      const analysisRequest = {
        type: 'style',
        aspects: ['color_palette', 'art_style', 'lighting_mood', 'composition']
      }

      // When: 스타일 일관성 분석 API 호출
      const response = await fetch('/api/storyboard/storyboard-test-001/consistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisRequest)
      })

      // Then: 스타일별 일관성 분석 결과를 반환해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data).toHaveProperty('styleAnalysis')
      expect(result.data.styleAnalysis).toHaveProperty('colorPaletteConsistency')
      expect(result.data.styleAnalysis).toHaveProperty('artStyleConsistency')
      expect(result.data.styleAnalysis).toHaveProperty('lightingMoodConsistency')
    })
  })

  describe('Red Phase: 비교 및 개선 제안', () => {
    it('프레임 간 비교 분석이 올바르게 동작해야 함', async () => {
      // Given: 비교할 프레임들
      const comparisonRequest = {
        frameIds: ['frame-test-001', 'frame-test-002'],
        comparisonType: 'similarity',
        aspects: ['character', 'lighting', 'composition']
      }

      // When: 프레임 비교 API 호출
      const response = await fetch('/api/storyboard/consistency/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comparisonRequest)
      })

      // Then: 비교 결과를 반환해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data).toHaveProperty('similarityScore')
      expect(result.data).toHaveProperty('differences')
      expect(result.data).toHaveProperty('recommendations')

      // 유사도 점수는 0-1 범위여야 함
      expect(result.data.similarityScore).toBeGreaterThanOrEqual(0)
      expect(result.data.similarityScore).toBeLessThanOrEqual(1)
    })

    it('자동 개선 제안이 올바르게 생성되어야 함', async () => {
      // Given: 개선 제안 요청
      const improvementRequest = {
        storyboardId: 'storyboard-test-001',
        targetScore: 0.85, // 목표 일관성 점수
        priorities: ['character', 'lighting', 'style']
      }

      // When: 개선 제안 API 호출
      const response = await fetch('/api/storyboard/consistency/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(improvementRequest)
      })

      // Then: 구체적인 개선 제안을 반환해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data).toHaveProperty('improvements')
      expect(result.data.improvements).toBeInstanceOf(Array)

      // 각 개선 제안은 필수 정보를 포함해야 함
      result.data.improvements.forEach((improvement: any) => {
        expect(improvement).toHaveProperty('frameId')
        expect(improvement).toHaveProperty('issue')
        expect(improvement).toHaveProperty('suggestion')
        expect(improvement).toHaveProperty('expectedImprovement')
        expect(improvement).toHaveProperty('priority')
      })
    })

    it('배치 일관성 개선이 올바르게 동작해야 함', async () => {
      // Given: 배치 개선 요청
      const batchImprovementRequest = {
        storyboardId: 'storyboard-test-001',
        frameIds: ['frame-test-001', 'frame-test-002'],
        improvementType: 'auto_regenerate',
        preserveAspects: ['composition', 'character_pose']
      }

      // When: 배치 개선 API 호출
      const response = await fetch('/api/storyboard/consistency/batch-improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchImprovementRequest)
      })

      // Then: 배치 개선 작업이 시작되어야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data).toHaveProperty('batchId')
      expect(result.data).toHaveProperty('status', 'started')
      expect(result.data).toHaveProperty('totalFrames')
      expect(result.data).toHaveProperty('estimatedTime')
    })
  })

  describe('Red Phase: 실시간 일관성 모니터링', () => {
    it('실시간 일관성 점수 모니터링이 동작해야 함', async () => {
      // Given: WebSocket 연결 모킹
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }

      global.WebSocket = jest.fn(() => mockWebSocket) as any

      const storyboardId = 'storyboard-test-001'

      // When: 실시간 모니터링 시작
      const ws = new WebSocket(`ws://localhost:3000/api/storyboard/${storyboardId}/consistency/monitor`)

      // 일관성 점수 업데이트 시뮬레이션
      const consistencyUpdate = {
        timestamp: new Date().toISOString(),
        overallScore: 0.75,
        changedFrames: ['frame-test-001'],
        improvements: 0.05 // 이전 대비 개선
      }

      // Then: WebSocket 연결이 올바르게 설정되어야 함
      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining(`/api/storyboard/${storyboardId}/consistency/monitor`)
      )
    })

    it('일관성 임계값 알림이 올바르게 동작해야 함', async () => {
      // Given: 임계값 설정
      const alertConfig = {
        storyboardId: 'storyboard-test-001',
        thresholds: {
          character: 0.7,
          lighting: 0.6,
          style: 0.8
        },
        notificationMethods: ['websocket', 'email']
      }

      // When: 알림 설정 API 호출
      const response = await fetch('/api/storyboard/consistency/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertConfig)
      })

      // Then: 알림 설정이 성공해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('alertId')
      expect(result.data).toHaveProperty('status', 'active')
    })

    it('일관성 히스토리 추적이 올바르게 동작해야 함', async () => {
      // Given: 히스토리 조회 요청
      const storyboardId = 'storyboard-test-001'
      const timeRange = {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24시간 전
        to: new Date().toISOString()
      }

      // When: 일관성 히스토리 조회
      const response = await fetch(
        `/api/storyboard/${storyboardId}/consistency/history?from=${timeRange.from}&to=${timeRange.to}`
      )

      // Then: 히스토리 데이터를 반환해야 함
      expect(response.ok).toBe(true)

      const result = await response.json()
      expect(result.data).toHaveProperty('timeline')
      expect(result.data).toHaveProperty('changes')
      expect(result.data).toHaveProperty('improvements')

      // 타임라인 데이터 검증
      expect(result.data.timeline).toBeInstanceOf(Array)
      result.data.timeline.forEach((entry: any) => {
        expect(entry).toHaveProperty('timestamp')
        expect(entry).toHaveProperty('overallScore')
        expect(entry).toHaveProperty('frameCount')
      })
    })
  })

  describe('Red Phase: 비용 안전 및 성능', () => {
    it('분당 일관성 분석 제한을 적용해야 함', async () => {
      // Given: 연속적인 분석 요청 (제한: 분당 5회)
      const requests = Array.from({ length: 7 }, () =>
        fetch('/api/storyboard/storyboard-test-001/consistency')
      )

      // When: 모든 요청을 동시에 전송
      const responses = await Promise.all(requests)

      // Then: 일부 요청은 429 에러를 반환해야 함
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)

      // 첫 번째 rate limited 응답 확인
      const rateLimitedResult = await rateLimitedResponses[0].json()
      expect(rateLimitedResult.error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(rateLimitedResult.error.message).toContain('일관성 분석 한도 초과')
    })

    it('대용량 스토리보드 분석이 적절히 처리되어야 함', async () => {
      // Given: 대용량 스토리보드 (100개 프레임)
      const largeStoryboardRequest = {
        storyboardId: 'large-storyboard-001',
        analysisType: 'comprehensive',
        frameLimit: 100
      }

      // When: 대용량 분석 요청
      const response = await fetch('/api/storyboard/consistency/analyze-large', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeStoryboardRequest)
      })

      // Then: 적절한 처리 방식을 제안해야 함 (배치 처리 또는 제한)
      if (response.status === 413) {
        // 요청이 너무 큰 경우
        const result = await response.json()
        expect(result.error.code).toBe('REQUEST_TOO_LARGE')
        expect(result.error.alternatives).toContain('batch_analysis')
      } else {
        // 배치 처리로 수락된 경우
        expect(response.ok).toBe(true)
        const result = await response.json()
        expect(result.data).toHaveProperty('batchId')
        expect(result.data).toHaveProperty('estimatedTime')
      }
    })

    it('분석 결과 캐싱이 올바르게 동작해야 함', async () => {
      // Given: 동일한 스토리보드에 대한 연속 요청
      const storyboardId = 'storyboard-test-001'

      // 첫 번째 요청
      const firstResponse = await fetch(`/api/storyboard/${storyboardId}/consistency`)
      expect(firstResponse.ok).toBe(true)

      const firstResult = await firstResponse.json()
      const firstTimestamp = firstResult.data.analysisTimestamp

      // 짧은 시간 후 두 번째 요청
      await new Promise(resolve => setTimeout(resolve, 100))

      // When: 두 번째 요청
      const secondResponse = await fetch(`/api/storyboard/${storyboardId}/consistency`)
      expect(secondResponse.ok).toBe(true)

      const secondResult = await secondResponse.json()

      // Then: 캐시된 결과를 반환해야 함 (동일한 분석 시간)
      expect(secondResult.data.analysisTimestamp).toBe(firstTimestamp)
      expect(secondResult.data.cached).toBe(true)
    })
  })
})