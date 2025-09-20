/**
 * 파이프라인 핸들러 테스트 (TDD)
 * Benjamin's Contract-First + TDD 원칙
 *
 * 핵심 원칙:
 * 1. 계약 검증이 모든 핸들러의 첫 번째 단계
 * 2. $300 사건 방지: 무한 루프 및 중복 호출 차단
 * 3. 에러 처리 표준화
 * 4. 트랜잭션 무결성 보장
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import {
  PipelineContractValidator,
  PipelineTestDataFactory,
  StoryInputRequest,
  ScenarioGenerationRequest,
  PromptGenerationRequest,
  VideoGenerationRequest
} from '@/shared/contracts/pipeline-integration.contract';

// Mock된 핸들러들 (구현할 예정)
import {
  handleStorySubmission,
  handleScenarioGeneration,
  handlePromptGeneration,
  handleVideoGeneration,
  handlePipelineStatus
} from '@/features/pipeline/handlers/pipeline-handlers';

// Mock 의존성들
jest.mock('@/shared/lib/dual-storage-service');
jest.mock('@/shared/lib/ai-client');
jest.mock('@/shared/lib/auth-middleware-v2');

// ============================================================================
// 테스트 설정
// ============================================================================

describe('파이프라인 핸들러 테스트', () => {
  let mockRequest: NextRequest;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // 콘솔 에러 스파이 설정 (테스트 출력 정리용)
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // 기본 모킹 설정
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // ============================================================================
  // 1단계: 스토리 제출 핸들러 테스트
  // ============================================================================

  describe('스토리 제출 핸들러', () => {
    it('유효한 스토리 요청을 처리해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createStoryRequest();

      const request = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const response = await handleStorySubmission(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.storyId).toBeTruthy();
      expect(data.data.nextStep).toBe('scenario');
      expect(data.correlationId).toBe(validRequest.correlationId);
    });

    it('잘못된 계약을 가진 요청을 거부해야 한다', async () => {
      const invalidRequest = {
        projectId: 'invalid-uuid', // UUID 형식 아님
        story: {
          content: '짧음' // 10자 미만
        }
      };

      const request = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      const response = await handleStorySubmission(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('validation');
    });

    it('$300 사건 방지: 중복 요청을 차단해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createStoryRequest();

      const request1 = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const request2 = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest) // 동일한 correlationId
      });

      // 첫 번째 요청
      const response1 = await handleStorySubmission(request1);
      expect(response1.status).toBe(200);

      // 두 번째 중복 요청 (1분 이내)
      const response2 = await handleStorySubmission(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(429); // Too Many Requests
      expect(data2.error).toContain('중복 요청');
    });

    it('데이터베이스 저장 실패 시 올바른 에러를 반환해야 한다', async () => {
      // 데이터베이스 저장 실패 모킹
      const mockDualStorageService = require('@/shared/lib/dual-storage-service');
      mockDualStorageService.saveStory.mockRejectedValue(new Error('Database connection failed'));

      const validRequest = PipelineTestDataFactory.createStoryRequest();

      const request = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const response = await handleStorySubmission(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('저장 실패');
      expect(data.correlationId).toBe(validRequest.correlationId);
    });

    it('인증되지 않은 요청을 거부해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createStoryRequest();

      // 인증 실패 모킹
      const mockAuth = require('@/shared/lib/auth-middleware-v2');
      mockAuth.authenticateRequest.mockResolvedValue({ success: false, error: 'Unauthorized' });

      const request = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const response = await handleStorySubmission(request);

      expect(response.status).toBe(401);
    });
  });

  // ============================================================================
  // 2단계: 시나리오 생성 핸들러 테스트
  // ============================================================================

  describe('시나리오 생성 핸들러', () => {
    it('유효한 시나리오 요청을 처리해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createScenarioRequest();

      // AI 클라이언트 모킹
      const mockAiClient = require('@/shared/lib/ai-client');
      mockAiClient.generateScenario.mockResolvedValue({
        success: true,
        data: {
          generatedScenario: '생성된 시나리오 내용입니다. 이 내용은 50자를 넘어야 합니다.',
          estimatedDuration: 90
        }
      });

      const request = new NextRequest('http://localhost:3000/api/pipeline/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const response = await handleScenarioGeneration(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.scenarioId).toBeTruthy();
      expect(data.data.generatedScenario).toContain('생성된 시나리오');
      expect(data.data.nextStep).toBe('prompt');
    });

    it('존재하지 않는 스토리 ID로 요청 시 404를 반환해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createScenarioRequest({
        storyId: '00000000-0000-0000-0000-000000000000' // 존재하지 않는 ID
      });

      const mockDualStorageService = require('@/shared/lib/dual-storage-service');
      mockDualStorageService.getStoryById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/pipeline/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const response = await handleScenarioGeneration(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('스토리를 찾을 수 없습니다');
    });

    it('AI 생성 실패 시 폴백 로직을 사용해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createScenarioRequest();

      // AI 클라이언트 실패 모킹
      const mockAiClient = require('@/shared/lib/ai-client');
      mockAiClient.generateScenario.mockRejectedValue(new Error('AI service unavailable'));

      const request = new NextRequest('http://localhost:3000/api/pipeline/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const response = await handleScenarioGeneration(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.generatedScenario).toContain('기본 시나리오'); // 폴백 시나리오
    });
  });

  // ============================================================================
  // 3단계: 프롬프트 생성 핸들러 테스트
  // ============================================================================

  describe('프롬프트 생성 핸들러', () => {
    it('유효한 프롬프트 요청을 처리해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createPromptRequest();

      const mockAiClient = require('@/shared/lib/ai-client');
      mockAiClient.generatePrompt.mockResolvedValue({
        success: true,
        data: {
          finalPrompt: '생성된 최종 프롬프트입니다. 충분히 긴 내용을 포함합니다.',
          enhancedKeywords: ['magic', 'adventure', 'young hero', 'fantasy world'],
          estimatedTokens: 150,
          optimizationApplied: true
        }
      });

      const request = new NextRequest('http://localhost:3000/api/pipeline/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const response = await handlePromptGeneration(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.promptId).toBeTruthy();
      expect(data.data.finalPrompt).toContain('생성된 최종 프롬프트');
      expect(data.data.enhancedKeywords).toContain('magic');
      expect(data.data.nextStep).toBe('video');
    });

    it('키워드 최적화를 적용해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createPromptRequest({
        prompt: {
          visualStyle: 'cinematic',
          mood: 'adventurous',
          quality: 'premium',
          keywords: ['magic'] // 단일 키워드
        }
      });

      const mockAiClient = require('@/shared/lib/ai-client');
      mockAiClient.generatePrompt.mockResolvedValue({
        success: true,
        data: {
          finalPrompt: '최적화된 프롬프트',
          enhancedKeywords: ['magic', 'enchanted', 'mystical', 'spellbinding'], // 확장된 키워드
          estimatedTokens: 120,
          optimizationApplied: true
        }
      });

      const request = new NextRequest('http://localhost:3000/api/pipeline/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const response = await handlePromptGeneration(request);
      const data = await response.json();

      expect(data.data.enhancedKeywords.length).toBeGreaterThan(1);
      expect(data.data.metadata.optimizationApplied).toBe(true);
    });
  });

  // ============================================================================
  // 4단계: 영상 생성 핸들러 테스트
  // ============================================================================

  describe('영상 생성 핸들러', () => {
    it('유효한 영상 요청을 처리해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createVideoRequest();

      // Seedance API 모킹
      const mockSeedanceClient = require('@/shared/lib/seedance-client');
      mockSeedanceClient.createVideo.mockResolvedValue({
        success: true,
        data: {
          jobId: 'seedance-job-12345',
          status: 'queued',
          estimatedCompletionTime: new Date(Date.now() + 300000).toISOString() // 5분 후
        }
      });

      const request = new NextRequest('http://localhost:3000/api/pipeline/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const response = await handleVideoGeneration(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.videoId).toBeTruthy();
      expect(data.data.jobId).toBe('seedance-job-12345');
      expect(data.data.status).toBe('queued');
      expect(data.data.nextStep).toBeNull();
    });

    it('영상 생성 제공업체 선택을 올바르게 처리해야 한다', async () => {
      const runwayRequest = PipelineTestDataFactory.createVideoRequest({
        video: {
          duration: 30,
          aspectRatio: '16:9',
          resolution: '1080p',
          provider: 'runway',
          priority: 'high'
        }
      });

      const mockRunwayClient = require('@/shared/lib/runway-client');
      mockRunwayClient.createVideo.mockResolvedValue({
        success: true,
        data: {
          jobId: 'runway-job-67890',
          status: 'queued'
        }
      });

      const request = new NextRequest('http://localhost:3000/api/pipeline/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runwayRequest)
      });

      const response = await handleVideoGeneration(request);
      const data = await response.json();

      expect(data.data.provider).toBe('runway');
      expect(data.data.jobId).toBe('runway-job-67890');
    });

    it('영상 생성 실패 시 올바른 에러를 반환해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createVideoRequest();

      const mockSeedanceClient = require('@/shared/lib/seedance-client');
      mockSeedanceClient.createVideo.mockRejectedValue(new Error('Provider service unavailable'));

      const request = new NextRequest('http://localhost:3000/api/pipeline/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const response = await handleVideoGeneration(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('영상 생성 실패');
    });
  });

  // ============================================================================
  // 파이프라인 상태 조회 핸들러 테스트
  // ============================================================================

  describe('파이프라인 상태 조회 핸들러', () => {
    it('유효한 프로젝트 ID로 상태를 조회해야 한다', async () => {
      const projectId = '550e8400-e29b-41d4-a716-446655440000';

      const mockDualStorageService = require('@/shared/lib/dual-storage-service');
      mockDualStorageService.getPipelineStatus.mockResolvedValue({
        success: true,
        data: {
          projectId,
          currentStep: 'prompt',
          status: 'processing',
          progress: {
            story: { completed: true, id: '550e8400-e29b-41d4-a716-446655440002' },
            scenario: { completed: true, id: '550e8400-e29b-41d4-a716-446655440003' },
            prompt: { completed: false },
            video: { completed: false }
          },
          lastUpdated: new Date().toISOString(),
          errors: []
        }
      });

      const request = new NextRequest(`http://localhost:3000/api/pipeline/status/${projectId}`, {
        method: 'GET'
      });

      const response = await handlePipelineStatus(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.projectId).toBe(projectId);
      expect(data.data.currentStep).toBe('prompt');
      expect(data.data.progress.story.completed).toBe(true);
    });

    it('존재하지 않는 프로젝트 ID로 404를 반환해야 한다', async () => {
      const projectId = '00000000-0000-0000-0000-000000000000';

      const mockDualStorageService = require('@/shared/lib/dual-storage-service');
      mockDualStorageService.getPipelineStatus.mockResolvedValue(null);

      const request = new NextRequest(`http://localhost:3000/api/pipeline/status/${projectId}`, {
        method: 'GET'
      });

      const response = await handlePipelineStatus(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('프로젝트를 찾을 수 없습니다');
    });
  });

  // ============================================================================
  // 에러 처리 및 보안 테스트
  // ============================================================================

  describe('에러 처리 및 보안', () => {
    it('CORS 헤더를 올바르게 설정해야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createStoryRequest();

      const request = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://videoplanet.vercel.app'
        },
        body: JSON.stringify(validRequest)
      });

      const response = await handleStorySubmission(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('요청 크기 제한을 확인해야 한다', async () => {
      const largeRequest = PipelineTestDataFactory.createStoryRequest({
        story: {
          content: 'A'.repeat(10000), // 10KB 이상의 큰 내용
          title: 'Large Content Test'
        }
      });

      const request = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeRequest)
      });

      const response = await handleStorySubmission(request);
      const data = await response.json();

      expect(response.status).toBe(413); // Payload Too Large
      expect(data.error).toContain('요청 크기 초과');
    });

    it('잘못된 JSON 형식을 올바르게 처리해야 한다', async () => {
      const request = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }'
      });

      const response = await handleStorySubmission(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('JSON 파싱 실패');
    });

    it('모든 에러 응답에 correlationId가 포함되어야 한다', async () => {
      const invalidRequest = {
        correlationId: '550e8400-e29b-41d4-a716-446655440001',
        projectId: 'invalid'
      };

      const request = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      const response = await handleStorySubmission(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.correlationId).toBe(invalidRequest.correlationId);
    });
  });

  // ============================================================================
  // 성능 및 동시성 테스트
  // ============================================================================

  describe('성능 및 동시성', () => {
    it('동시 요청을 올바르게 처리해야 한다', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        PipelineTestDataFactory.createStoryRequest({
          correlationId: `550e8400-e29b-41d4-a716-44665544000${i}`
        })
      );

      const promises = requests.map(req => {
        const request = new NextRequest('http://localhost:3000/api/pipeline/story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req)
        });
        return handleStorySubmission(request);
      });

      const responses = await Promise.all(promises);

      // 모든 요청이 성공해야 함
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('응답 시간이 합리적인 범위 내에 있어야 한다', async () => {
      const validRequest = PipelineTestDataFactory.createStoryRequest();

      const request = new NextRequest('http://localhost:3000/api/pipeline/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest)
      });

      const start = performance.now();
      const response = await handleStorySubmission(request);
      const end = performance.now();

      expect(response.status).toBe(200);
      expect(end - start).toBeLessThan(5000); // 5초 이내
    });
  });
});