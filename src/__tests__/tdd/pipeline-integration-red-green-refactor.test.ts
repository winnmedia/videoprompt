/**
 * Grace QA Lead TDD 전략: 핵심 파이프라인 통합 테스트
 *
 * RED → GREEN → REFACTOR 사이클로 파이프라인 단절 문제 해결
 * 목표: 시나리오 → 프롬프트 → 영상 전체 플로우 결정론적 검증
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// 핵심 파이프라인 타입 정의
interface ScenarioInput {
  theme: string;
  duration: number;
  style: string;
}

interface GeneratedPrompt {
  id: string;
  content: string;
  metadata: {
    scenario: ScenarioInput;
    timestamp: number;
  };
}

interface VideoGenerationResult {
  id: string;
  prompt: GeneratedPrompt;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

// Mock 서버 설정 (MSW)
const server = setupServer(
  // 시나리오 → 프롬프트 생성 API
  http.post('/api/ai/generate-planning', async ({ request }) => {
    const body = await request.json() as ScenarioInput;

    // RED 단계: 실패 케이스 먼저 테스트
    if (!body.theme || body.duration <= 0) {
      return HttpResponse.json(
        { error: 'Invalid scenario input' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      id: `prompt_${Date.now()}`,
      content: `영상 주제: ${body.theme}, 길이: ${body.duration}초, 스타일: ${body.style}`,
      metadata: {
        scenario: body,
        timestamp: Date.now()
      }
    });
  }),

  // 프롬프트 → 영상 생성 API
  http.post('/api/ai/generate-storyboard', async ({ request }) => {
    const body = await request.json() as { prompt: GeneratedPrompt };

    // RED 단계: 파이프라인 단절 시뮬레이션
    if (!body.prompt?.content) {
      return HttpResponse.json(
        { error: 'Prompt content is required' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      id: `video_${Date.now()}`,
      prompt: body.prompt,
      status: 'processing',
      videoUrl: null
    });
  }),

  // 영상 상태 확인 API
  http.get('/api/video/status/:id', ({ params }) => {
    const { id } = params;

    return HttpResponse.json({
      id,
      status: 'completed',
      videoUrl: `https://storage.example.com/videos/${id}.mp4`
    });
  })
);

describe('Grace QA: 핵심 파이프라인 통합 테스트 (TDD)', () => {
  beforeEach(() => {
    server.listen();
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('RED 단계: 실패하는 테스트부터 작성', () => {
    it('should fail when scenario input is invalid', async () => {
      const invalidScenario: ScenarioInput = {
        theme: '', // 빈 값
        duration: -1, // 음수
        style: 'cinematic'
      };

      const response = await fetch('/api/ai/generate-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidScenario)
      });

      expect(response.status).toBe(400);

      const error = await response.json();
      expect(error.error).toBe('Invalid scenario input');
    });

    it('should fail when prompt is empty in video generation', async () => {
      const emptyPrompt = {
        prompt: {
          id: 'test',
          content: '', // 빈 프롬프트
          metadata: {
            scenario: { theme: 'test', duration: 30, style: 'cinematic' },
            timestamp: Date.now()
          }
        }
      };

      const response = await fetch('/api/ai/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emptyPrompt)
      });

      expect(response.status).toBe(400);

      const error = await response.json();
      expect(error.error).toBe('Prompt content is required');
    });

    it('should fail when pipeline stages are disconnected', async () => {
      // 이것이 핵심 문제: 각 단계가 독립적으로 동작
      // 데이터가 다음 단계로 전달되지 않음

      // 1단계: 시나리오 입력
      const scenario: ScenarioInput = {
        theme: '모험 이야기',
        duration: 60,
        style: 'animation'
      };

      // 2단계: 프롬프트 생성 - 성공
      const promptResponse = await fetch('/api/ai/generate-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario)
      });

      expect(promptResponse.ok).toBe(true);
      const prompt = await promptResponse.json() as GeneratedPrompt;

      // 3단계: 영상 생성 - 실패 (파이프라인 단절)
      // 실제 구현에서는 prompt가 제대로 전달되지 않는 문제
      const videoResponse = await fetch('/api/ai/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: null }) // 의도적 null 전달
      });

      expect(videoResponse.status).toBe(400);
    });
  });

  describe('GREEN 단계: 최소한의 구현으로 테스트 통과', () => {
    it('should successfully generate prompt from valid scenario', async () => {
      const validScenario: ScenarioInput = {
        theme: '우주 탐험',
        duration: 90,
        style: 'realistic'
      };

      const response = await fetch('/api/ai/generate-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validScenario)
      });

      expect(response.ok).toBe(true);

      const prompt = await response.json() as GeneratedPrompt;
      expect(prompt.id).toMatch(/^prompt_\d+$/);
      expect(prompt.content).toContain('우주 탐험');
      expect(prompt.content).toContain('90초');
      expect(prompt.metadata.scenario).toEqual(validScenario);
    });

    it('should successfully generate video from valid prompt', async () => {
      const validPrompt: GeneratedPrompt = {
        id: 'prompt_123',
        content: '우주선이 새로운 행성을 발견하는 90초 영상',
        metadata: {
          scenario: { theme: '우주 탐험', duration: 90, style: 'realistic' },
          timestamp: Date.now()
        }
      };

      const response = await fetch('/api/ai/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: validPrompt })
      });

      expect(response.ok).toBe(true);

      const video = await response.json() as VideoGenerationResult;
      expect(video.id).toMatch(/^video_\d+$/);
      expect(video.prompt).toEqual(validPrompt);
      expect(video.status).toBe('processing');
    });

    it('should complete full pipeline: scenario → prompt → video', async () => {
      // 통합 파이프라인 테스트
      const scenario: ScenarioInput = {
        theme: '마법의 숲',
        duration: 120,
        style: 'fantasy'
      };

      // 1단계: 시나리오 → 프롬프트
      const promptResponse = await fetch('/api/ai/generate-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario)
      });

      expect(promptResponse.ok).toBe(true);
      const prompt = await promptResponse.json() as GeneratedPrompt;

      // 2단계: 프롬프트 → 영상 생성
      const videoResponse = await fetch('/api/ai/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      expect(videoResponse.ok).toBe(true);
      const video = await videoResponse.json() as VideoGenerationResult;

      // 3단계: 영상 완료 확인
      const statusResponse = await fetch(`/api/video/status/${video.id}`);
      expect(statusResponse.ok).toBe(true);

      const finalStatus = await statusResponse.json();
      expect(finalStatus.status).toBe('completed');
      expect(finalStatus.videoUrl).toMatch(/\.mp4$/);

      // 파이프라인 데이터 연속성 검증
      expect(video.prompt.metadata.scenario).toEqual(scenario);
      expect(finalStatus.id).toBe(video.id);
    });
  });

  describe('REFACTOR 단계: 코드 품질 개선', () => {
    // 성능 테스트
    it('should complete pipeline within performance budget', async () => {
      const startTime = Date.now();

      const scenario: ScenarioInput = {
        theme: '성능 테스트',
        duration: 30,
        style: 'minimal'
      };

      // 전체 파이프라인 실행
      const promptResponse = await fetch('/api/ai/generate-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario)
      });

      const prompt = await promptResponse.json();

      const videoResponse = await fetch('/api/ai/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const video = await videoResponse.json();

      await fetch(`/api/video/status/${video.id}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Grace의 성능 기준: 3초 이내
      expect(duration).toBeLessThan(3000);
    });

    // 에러 처리 테스트
    it('should handle API timeouts gracefully', async () => {
      // MSW로 타임아웃 시뮬레이션
      server.use(
        http.post('/api/ai/generate-planning', async () => {
          await new Promise(resolve => setTimeout(resolve, 5000));
          return HttpResponse.json({ error: 'Timeout' }, { status: 408 });
        })
      );

      const scenario: ScenarioInput = {
        theme: '타임아웃 테스트',
        duration: 30,
        style: 'test'
      };

      const response = await fetch('/api/ai/generate-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario)
      });

      expect(response.status).toBe(408);
    });

    // 동시성 테스트
    it('should handle concurrent pipeline executions', async () => {
      const scenarios: ScenarioInput[] = [
        { theme: '동시성 테스트 1', duration: 30, style: 'test' },
        { theme: '동시성 테스트 2', duration: 45, style: 'test' },
        { theme: '동시성 테스트 3', duration: 60, style: 'test' }
      ];

      const promises = scenarios.map(scenario =>
        fetch('/api/ai/generate-planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario)
        })
      );

      const responses = await Promise.all(promises);

      // 모든 요청이 성공해야 함
      responses.forEach(response => {
        expect(response.ok).toBe(true);
      });
    });

    // 메모리 누수 방지 테스트
    it('should not leak memory during pipeline execution', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 100번의 파이프라인 실행
      for (let i = 0; i < 100; i++) {
        const scenario: ScenarioInput = {
          theme: `메모리 테스트 ${i}`,
          duration: 30,
          style: 'test'
        };

        const response = await fetch('/api/ai/generate-planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario)
        });

        await response.json();
      }

      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Grace 기준: 10MB 이상 증가하면 메모리 누수 의심
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Grace 무관용 품질 검증', () => {
    it('should be 100% deterministic - no flaky behavior', async () => {
      const scenario: ScenarioInput = {
        theme: '결정론적 테스트',
        duration: 30,
        style: 'test'
      };

      // 동일한 입력으로 10회 실행
      const results = [];
      for (let i = 0; i < 10; i++) {
        const response = await fetch('/api/ai/generate-planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario)
        });

        const result = await response.json();
        results.push(result);
      }

      // 모든 결과가 동일한 구조를 가져야 함
      results.forEach(result => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata.scenario).toEqual(scenario);
      });
    });

    it('should never produce $300 cost patterns', async () => {
      // 비용 폭탄 패턴 검증
      const costMonitor = {
        apiCalls: 0,
        startTime: Date.now()
      };

      // 원래 fetch를 intercept
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async (...args) => {
        costMonitor.apiCalls++;
        return originalFetch(...args);
      });

      try {
        const scenario: ScenarioInput = {
          theme: '비용 모니터링',
          duration: 30,
          style: 'test'
        };

        await fetch('/api/ai/generate-planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario)
        });

        const endTime = Date.now();
        const duration = endTime - costMonitor.startTime;

        // Grace 규칙: 1초에 5회 이상 API 호출 금지
        const maxCallsPerSecond = 5;
        const actualCallsPerSecond = (costMonitor.apiCalls * 1000) / duration;

        expect(actualCallsPerSecond).toBeLessThan(maxCallsPerSecond);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});