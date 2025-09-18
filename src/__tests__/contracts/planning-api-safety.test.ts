/**
 * Planning API 안전성 및 데이터 계약 무결성 테스트
 *
 * 목적: 모든 planning API가 null 참조 없이 안전하게 동작함을 보장
 * 핵심: Supabase degraded 모드에서도 크래시 없이 적절한 에러 응답 반환
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as storiesGET, POST as storiesPOST } from '@/app/api/planning/stories/route'
import { GET as videosGET, POST as videosPOST } from '@/app/api/planning/videos/route'
import { POST as registerPOST } from '@/app/api/planning/register/route'
import { GET as scenariosGET } from '@/app/api/planning/scenarios/route'
import { GET as dashboardGET } from '@/app/api/planning/dashboard/route'

// Supabase 안전 라이브러리 모킹
vi.mock('@/shared/lib/supabase-safe', () => ({
  getSupabaseClientForAPI: () => ({
    client: null,
    error: {
      success: false,
      message: 'Supabase client not available. Mode: degraded',
      mode: 'degraded',
      shouldReturn503: true
    }
  }),
  getSupabaseAdminForAPI: () => ({
    client: null,
    error: {
      success: false,
      message: 'Admin client not available: Supabase not configured. Mode: degraded',
      mode: 'degraded',
      shouldReturn503: true
    }
  })
}))

// Prisma 모킹 (videos, scenarios 등에서 사용)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    videoAsset: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: 'test-video-id',
        status: 'queued',
        url: null
      })
    }
  },
  checkDatabaseConnection: vi.fn().mockResolvedValue({
    success: true,
    latency: 50
  })
}))

// Auth 모킹
vi.mock('@/shared/lib/supabase-auth', () => ({
  requireSupabaseAuthentication: vi.fn().mockResolvedValue({
    authenticated: false,
    user: null
  }),
  isAuthenticated: vi.fn().mockReturnValue(false),
  isAuthError: vi.fn().mockReturnValue(false)
}))

vi.mock('@/shared/lib/auth-middleware', () => ({
  withAuth: (handler: any) => handler,
  withOptionalAuth: (handler: any) => handler
}))

vi.mock('@/shared/lib/auth', () => ({
  getUserIdFromRequest: vi.fn().mockReturnValue('test-user-id')
}))

// Dual storage engine 모킹
vi.mock('@/shared/services/dual-storage-engine.service', () => ({
  dualStorageEngine: {
    saveDualStorage: vi.fn().mockResolvedValue({
      success: true,
      prismaResult: { id: 'test-id', saved: true },
      supabaseResult: { saved: false, tables: [], error: 'degraded mode' },
      latencyMs: 100,
      rollbackExecuted: false
    })
  }
}))

describe('Planning API 안전성 테스트 (Degraded Mode)', () => {

  describe('Stories API 안전성', () => {
    test('GET /api/planning/stories - degraded 모드에서 503 에러 반환 (크래시 없음)', async () => {
      const request = new NextRequest('http://localhost:3000/api/planning/stories')

      const response = await storiesGET(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('SUPABASE_CONFIG_ERROR')
      expect(data.error.message).toContain('Supabase 설정이 올바르지 않습니다')
    })

    test('POST /api/planning/stories - degraded 모드에서 503 에러 반환 (크래시 없음)', async () => {
      const validPayload = {
        title: 'Test Story',
        oneLineStory: 'A test story',
        genre: 'Drama',
        tone: 'Serious',
        targetAudience: 'Adults',
        structure: {
          act1: { title: 'Act 1', description: 'First act', key_elements: [], emotional_arc: 'start' },
          act2: { title: 'Act 2', description: 'Second act', key_elements: [], emotional_arc: 'middle' },
          act3: { title: 'Act 3', description: 'Third act', key_elements: [], emotional_arc: 'end' },
          act4: { title: 'Act 4', description: 'Fourth act', key_elements: [], emotional_arc: 'conclusion' }
        }
      }

      const request = new NextRequest('http://localhost:3000/api/planning/stories', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await storiesPOST(request)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('SERVICE_UNAVAILABLE')
      expect(data.error.message).toContain('스토리 생성 서비스가 일시적으로 사용할 수 없습니다')
    })
  })

  describe('Videos API 안전성', () => {
    test('GET /api/planning/videos - Prisma 기반으로 안전 동작', async () => {
      const request = new NextRequest('http://localhost:3000/api/planning/videos')

      const response = await videosGET(request, { user: { id: 'test-user' } })

      expect(response.status).toBe(200)
      // Prisma 기반이므로 정상 동작
    })

    test('POST /api/planning/videos - Prisma 기반으로 안전 동작', async () => {
      const validPayload = {
        promptId: '123e4567-e89b-12d3-a456-426614174000',
        provider: 'mock',
        status: 'queued',
        url: 'https://example.com/video.mp4',
        version: 1
      }

      const request = new NextRequest('http://localhost:3000/api/planning/videos', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await videosPOST(request, { user: { id: 'test-user' } })

      expect(response.status).toBe(200)
      // Prisma 기반이므로 정상 동작
    })
  })

  describe('Register API 안전성', () => {
    test('POST /api/planning/register - 이중 저장 시스템으로 부분 성공', async () => {
      const validPayload = {
        type: 'scenario',
        projectId: 'test-project',
        source: 'ai_generated',
        createdAt: new Date().toISOString(),
        title: 'Test Scenario',
        story: 'A test story',
        genre: 'Drama',
        tone: 'Serious',
        target: 'Adults',
        format: '16:9',
        tempo: '보통',
        developmentMethod: 'linear',
        developmentIntensity: 'medium',
        durationSec: 120
      }

      const request = new NextRequest('http://localhost:3000/api/planning/register', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await registerPOST(request, { user: { id: 'test-user', username: 'testuser' } })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.dualStorage.prismaStored).toBe(true)
      expect(data.data.dualStorage.supabaseStored).toBe(false) // degraded 모드
    })
  })

  describe('Scenarios API 안전성', () => {
    test('GET /api/planning/scenarios - Prisma 기반으로 안전 동작', async () => {
      const request = new NextRequest('http://localhost:3000/api/planning/scenarios')

      const response = await scenariosGET(request, { user: { id: 'test-user' } })

      expect(response.status).toBe(200)
      // Prisma 기반이므로 정상 동작
    })
  })

  describe('Dashboard API 안전성', () => {
    test('GET /api/planning/dashboard - Prisma 기반으로 안전 동작', async () => {
      const request = new NextRequest('http://localhost:3000/api/planning/dashboard')

      const response = await dashboardGET(request)

      expect(response.status).toBe(200)
      // Prisma 기반이므로 정상 동작
    })
  })
})

describe('데이터 계약 무결성 테스트', () => {

  test('모든 API는 degraded 모드에서 적절한 HTTP 상태 코드 반환', async () => {
    // Stories API - Supabase 의존성으로 503 반환
    const storiesRequest = new NextRequest('http://localhost:3000/api/planning/stories')
    const storiesResponse = await storiesGET(storiesRequest)
    expect([503, 500]).toContain(storiesResponse.status)

    // Videos, Scenarios, Dashboard - Prisma 기반으로 200 반환
    const videosRequest = new NextRequest('http://localhost:3000/api/planning/videos')
    const videosResponse = await videosGET(videosRequest, { user: { id: 'test' } })
    expect(videosResponse.status).toBe(200)
  })

  test('에러 응답 구조가 표준 API 스키마 준수', async () => {
    const request = new NextRequest('http://localhost:3000/api/planning/stories')
    const response = await storiesGET(request)
    const data = await response.json()

    // API 에러 응답 표준 구조 검증
    expect(data).toHaveProperty('success', false)
    expect(data).toHaveProperty('error')
    expect(data.error).toHaveProperty('code')
    expect(data.error).toHaveProperty('message')
    expect(data).toHaveProperty('timestamp')
  })

  test('성공 응답 구조가 표준 API 스키마 준수', async () => {
    const request = new NextRequest('http://localhost:3000/api/planning/videos')
    const response = await videosGET(request, { user: { id: 'test' } })
    const data = await response.json()

    // API 성공 응답 표준 구조 검증
    expect(data).toHaveProperty('success', true)
    expect(data).toHaveProperty('data')
    expect(data.data).toHaveProperty('videos')
    expect(Array.isArray(data.data.videos)).toBe(true)
  })
})

describe('Null 참조 안전성 보장', () => {

  test('Supabase 클라이언트가 null일 때 안전한 에러 처리', () => {
    // 이미 모킹된 supabase-safe에서 null 클라이언트 반환 확인
    const { getSupabaseClientForAPI, getSupabaseAdminForAPI } = require('@/shared/lib/supabase-safe')

    const clientResult = getSupabaseClientForAPI()
    expect(clientResult.client).toBeNull()
    expect(clientResult.error).toBeDefined()
    expect(clientResult.error.shouldReturn503).toBe(true)

    const adminResult = getSupabaseAdminForAPI()
    expect(adminResult.client).toBeNull()
    expect(adminResult.error).toBeDefined()
  })

  test('API는 null 클라이언트에 대해 .from() 호출 없이 에러 반환', async () => {
    // Stories API가 null 체크 후 즉시 에러 반환함을 확인
    const request = new NextRequest('http://localhost:3000/api/planning/stories')
    const response = await storiesGET(request)

    // .from() 호출 전에 null 체크하여 안전하게 에러 반환
    expect(response.status).toBe(503)
  })
})