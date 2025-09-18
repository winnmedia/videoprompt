/**
 * 비즈니스 핵심 기능 중요 경로 테스트
 * 매출 및 사용자 경험 직결 기능
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { testUtils } from '@/test/deterministic-setup';

describe('💼 비즈니스 핵심 기능 중요 경로 테스트', () => {
  const server = setupServer();

  beforeEach(() => {
    server.resetHandlers();
  });

  describe('1. 스토리 생성 워크플로우 (Core Revenue Path)', () => {
    it('완전한 스토리 생성 파이프라인', async () => {
      // Given: 전체 스토리 생성 API 체인
      let storyId: string;

      server.use(
        // 1. 스토리 생성 시작
        http.post('/api/ai/generate-story', async ({ request }) => {
          const body = await request.json() as any;
          expect(body).toHaveProperty('prompt');
          expect(body).toHaveProperty('toneAndManner');

          storyId = 'story-' + testUtils.generateTestId();
          return HttpResponse.json({
            id: storyId,
            status: 'generating',
            prompt: body.prompt,
            toneAndManner: body.toneAndManner
          });
        }),

        // 2. 생성 상태 확인
        http.get('/api/ai/generate-story/:id/status', ({ params }) => {
          return HttpResponse.json({
            id: params.id,
            status: 'completed',
            result: {
              title: 'Generated Story Title',
              content: 'Generated story content...',
              scenes: [
                { id: 1, description: 'Scene 1', duration: 30 },
                { id: 2, description: 'Scene 2', duration: 45 }
              ]
            }
          });
        }),

        // 3. 스토리 저장
        http.post('/api/stories', async ({ request }) => {
          const body = await request.json() as any;
          return HttpResponse.json({
            id: storyId,
            ...body,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        })
      );

      // When: 전체 워크플로우 실행
      const storyRequest = {
        prompt: 'Create a marketing video for a tech startup',
        toneAndManner: 'Professional and engaging',
        duration: 60,
        targetAudience: 'Business professionals'
      };

      // 1. 스토리 생성 요청
      const generateResponse = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyRequest)
      });
      const generateData = await generateResponse.json();

      // 2. 상태 확인 (폴링 시뮬레이션)
      await testUtils.advanceTime(1000); // 1초 대기 시뮬레이션
      const statusResponse = await fetch(`/api/ai/generate-story/${generateData.id}/status`);
      const statusData = await statusResponse.json();

      // 3. 완성된 스토리 저장
      const saveResponse = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...storyRequest,
          generatedContent: statusData.result
        })
      });
      const savedStory = await saveResponse.json();

      // Then: 전체 파이프라인 성공
      expect(generateResponse.status).toBe(200);
      expect(generateData.status).toBe('generating');
      expect(statusResponse.status).toBe(200);
      expect(statusData.status).toBe('completed');
      expect(statusData.result.scenes).toHaveLength(2);
      expect(saveResponse.status).toBe(200);
      expect(savedStory.id).toBeDefined();
    });

    it('AI 생성 실패 시 Graceful Degradation', async () => {
      // Given: AI 서비스 실패 시나리오
      server.use(
        http.post('/api/ai/generate-story', () => {
          return HttpResponse.json(
            { error: 'AI service temporarily unavailable' },
            { status: 503 }
          );
        }),

        // Fallback: 템플릿 기반 스토리 제공
        http.get('/api/story-templates', () => {
          return HttpResponse.json({
            templates: [
              {
                id: 'template-1',
                title: 'Marketing Video Template',
                scenes: [
                  { description: 'Introduction', duration: 15 },
                  { description: 'Problem Statement', duration: 20 },
                  { description: 'Solution Presentation', duration: 20 },
                  { description: 'Call to Action', duration: 5 }
                ]
              }
            ]
          });
        })
      );

      // When: AI 실패 후 Fallback 로직
      const storyWorkflow = {
        async generateStory(prompt: string) {
          try {
            const response = await fetch('/api/ai/generate-story', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
              throw new Error('AI generation failed');
            }

            return await response.json();
          } catch (error) {
            // Fallback to templates
            const templatesResponse = await fetch('/api/story-templates');
            const templatesData = await templatesResponse.json();

            return {
              id: 'fallback-' + testUtils.generateTestId(),
              status: 'completed',
              result: templatesData.templates[0],
              fallback: true
            };
          }
        }
      };

      const result = await storyWorkflow.generateStory('Marketing video');

      // Then: Fallback 템플릿 제공
      expect(result.fallback).toBe(true);
      expect(result.result.scenes).toHaveLength(4);
      expect(result.result.title).toContain('Template');
    });

    it('대용량 스토리 처리 성능', async () => {
      // Given: 대용량 스토리 데이터
      const largeStoryData = {
        title: 'Epic Story',
        scenes: Array(100).fill(null).map((_, i) => ({
          id: i + 1,
          description: `Scene ${i + 1} description with detailed content...`.repeat(10),
          duration: 30 + (i % 60)
        }))
      };

      server.use(
        http.post('/api/ai/generate-story', () => {
          return HttpResponse.json({
            id: 'large-story-123',
            status: 'completed',
            result: largeStoryData
          });
        })
      );

      // When: 대용량 스토리 생성 및 처리
      const startTime = performance.now();

      const response = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Generate large story' })
      });

      const data = await response.json();
      const endTime = performance.now();

      // Then: 성능 기준 충족 (100ms 이내)
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(100);
      expect(data.result.scenes).toHaveLength(100);
      expect(response.status).toBe(200);
    });
  });

  describe('2. 데이터 저장 및 동기화 (Data Integrity Path)', () => {
    it('이중 저장소 동기화 검증', async () => {
      const primaryStore = new Map();
      const backupStore = new Map();

      // Given: 이중 저장소 시스템
      server.use(
        http.post('/api/stories', async ({ request }) => {
          const body = await request.json() as any;
          const storyId = 'story-' + testUtils.generateTestId();

          // Primary 저장
          primaryStore.set(storyId, { ...body, source: 'primary' });

          // Backup 저장 (비동기)
          setTimeout(() => {
            backupStore.set(storyId, { ...body, source: 'backup' });
          }, 10);

          return HttpResponse.json({ id: storyId, ...body });
        }),

        http.get('/api/stories/:id', ({ params }) => {
          const story = primaryStore.get(params.id) || backupStore.get(params.id);
          if (!story) {
            return HttpResponse.json({ error: 'Story not found' }, { status: 404 });
          }
          return HttpResponse.json(story);
        })
      );

      // When: 스토리 저장 및 검증
      const storyData = { title: 'Test Story', content: 'Story content' };

      const saveResponse = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyData)
      });
      const savedStory = await saveResponse.json();

      // 백업 저장 완료 대기
      await testUtils.advanceTime(20);

      const retrieveResponse = await fetch(`/api/stories/${savedStory.id}`);
      const retrievedStory = await retrieveResponse.json();

      // Then: 양쪽 저장소에 데이터 존재
      expect(primaryStore.has(savedStory.id)).toBe(true);
      expect(backupStore.has(savedStory.id)).toBe(true);
      expect(retrievedStory.title).toBe(storyData.title);
    });

    it('트랜잭션 롤백 시나리오', async () => {
      let transactionLog: string[] = [];

      // Given: 트랜잭션 실패 시나리오
      server.use(
        http.post('/api/stories/transaction', async ({ request }) => {
          const body = await request.json() as any;

          try {
            // 1. 메타데이터 저장
            transactionLog.push('metadata_save_start');
            if (body.title === 'FAIL') {
              throw new Error('Simulated failure');
            }
            transactionLog.push('metadata_save_success');

            // 2. 콘텐츠 저장
            transactionLog.push('content_save_start');
            transactionLog.push('content_save_success');

            // 3. 인덱싱
            transactionLog.push('indexing_start');
            transactionLog.push('indexing_success');

            return HttpResponse.json({ success: true, id: 'story-123' });

          } catch (error) {
            // 롤백 실행
            transactionLog.push('rollback_start');
            transactionLog.push('rollback_complete');

            return HttpResponse.json(
              { error: 'Transaction failed', rollback: true },
              { status: 500 }
            );
          }
        })
      );

      // When: 실패하는 트랜잭션 실행
      const failResponse = await fetch('/api/stories/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'FAIL', content: 'Test' })
      });
      const failData = await failResponse.json();

      // Then: 롤백이 정상적으로 실행됨
      expect(failResponse.status).toBe(500);
      expect(failData.rollback).toBe(true);
      expect(transactionLog).toContain('rollback_start');
      expect(transactionLog).toContain('rollback_complete');
    });
  });

  describe('3. 파일 업로드 및 처리 (Media Processing Path)', () => {
    it('대용량 파일 업로드 처리', async () => {
      // Given: 대용량 파일 업로드 시나리오
      const largeFileData = new Uint8Array(5 * 1024 * 1024); // 5MB
      largeFileData.fill(65); // 'A' 문자로 채움

      server.use(
        http.post('/api/upload', async ({ request }) => {
          const formData = await request.formData();
          const file = formData.get('file') as File;

          if (file.size > 10 * 1024 * 1024) { // 10MB 제한
            return HttpResponse.json(
              { error: 'File too large' },
              { status: 413 }
            );
          }

          return HttpResponse.json({
            id: 'file-' + testUtils.generateTestId(),
            size: file.size,
            type: file.type,
            status: 'uploaded'
          });
        }),

        http.post('/api/upload/process', async ({ request }) => {
          const body = await request.json() as any;

          // 처리 시뮬레이션
          await new Promise(resolve => setTimeout(resolve, 50));

          return HttpResponse.json({
            id: body.fileId,
            status: 'processed',
            thumbnails: ['thumb1.jpg', 'thumb2.jpg'],
            metadata: {
              duration: 120,
              resolution: '1920x1080'
            }
          });
        })
      );

      // When: 파일 업로드 및 처리
      const formData = new FormData();
      formData.append('file', new Blob([largeFileData], { type: 'video/mp4' }), 'test.mp4');

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadResponse.json();

      const processResponse = await fetch('/api/upload/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: uploadData.id })
      });
      const processData = await processResponse.json();

      // Then: 업로드 및 처리 성공
      expect(uploadResponse.status).toBe(200);
      expect(uploadData.size).toBe(largeFileData.length);
      expect(processResponse.status).toBe(200);
      expect(processData.thumbnails).toHaveLength(2);
    });

    it('파일 업로드 중단 및 재시도', async () => {
      let uploadAttempts = 0;

      server.use(
        http.post('/api/upload/chunk', async ({ request }) => {
          uploadAttempts++;

          // 첫 번째 시도는 실패
          if (uploadAttempts === 1) {
            return HttpResponse.json(
              { error: 'Network error' },
              { status: 500 }
            );
          }

          const formData = await request.formData();
          const chunk = formData.get('chunk');
          const chunkIndex = formData.get('chunkIndex');

          return HttpResponse.json({
            chunkIndex,
            status: 'received',
            size: (chunk as Blob).size
          });
        }),

        http.post('/api/upload/complete', () => {
          return HttpResponse.json({
            id: 'file-complete-123',
            status: 'assembled'
          });
        })
      );

      // When: 청크 업로드 재시도 로직
      const uploadWithRetry = async (chunkData: Blob, chunkIndex: number, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const formData = new FormData();
            formData.append('chunk', chunkData);
            formData.append('chunkIndex', chunkIndex.toString());

            const response = await fetch('/api/upload/chunk', {
              method: 'POST',
              body: formData
            });

            if (response.ok) {
              return await response.json();
            }

            if (attempt === maxRetries) {
              throw new Error('Max retries exceeded');
            }

            // 백오프 대기
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));

          } catch (error) {
            if (attempt === maxRetries) {
              throw error;
            }
          }
        }
      };

      const testChunk = new Blob(['chunk data'], { type: 'application/octet-stream' });
      const chunkResult = await uploadWithRetry(testChunk, 0);

      // Then: 재시도 후 성공
      expect(chunkResult.status).toBe('received');
      expect(uploadAttempts).toBe(2); // 1회 실패 + 1회 성공
    });
  });

  describe('4. 성능 및 확장성 (Performance & Scalability)', () => {
    it('동시 사용자 요청 처리 능력', async () => {
      let activeRequests = 0;
      const maxConcurrentRequests = 50;

      server.use(
        http.post('/api/ai/generate-story', async ({ request }) => {
          activeRequests++;

          if (activeRequests > maxConcurrentRequests) {
            activeRequests--;
            return HttpResponse.json(
              { error: 'Server overloaded' },
              { status: 503 }
            );
          }

          // 처리 시뮬레이션
          await new Promise(resolve => setTimeout(resolve, 100));
          activeRequests--;

          return HttpResponse.json({
            id: 'story-' + testUtils.generateTestId(),
            status: 'generated'
          });
        })
      );

      // When: 동시 요청 100개 발송
      const requests = Array(100).fill(null).map((_, i) =>
        fetch('/api/ai/generate-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: `Story ${i}` })
        })
      );

      const responses = await Promise.all(requests);
      const statusCodes = responses.map(r => r.status);

      // Then: 적절한 로드 밸런싱
      const successCount = statusCodes.filter(code => code === 200).length;
      const overloadCount = statusCodes.filter(code => code === 503).length;

      expect(successCount).toBeGreaterThan(40); // 최소 40% 성공
      expect(overloadCount).toBeGreaterThan(0); // 일부는 오버로드로 거부
      expect(successCount + overloadCount).toBe(100);
    });

    it('캐시 효율성 검증', async () => {
      const cache = new Map();
      let dbHits = 0;

      server.use(
        http.get('/api/stories/:id', ({ params }) => {
          const cacheKey = `story:${params.id}`;

          if (cache.has(cacheKey)) {
            return HttpResponse.json({
              ...cache.get(cacheKey),
              source: 'cache'
            });
          }

          // DB 히트 시뮬레이션
          dbHits++;
          const story = {
            id: params.id,
            title: 'Cached Story',
            content: 'Story content',
            source: 'database'
          };

          cache.set(cacheKey, story);
          return HttpResponse.json(story);
        })
      );

      // When: 동일한 스토리를 여러 번 요청
      const storyId = 'story-123';
      const requests = Array(10).fill(null).map(() =>
        fetch(`/api/stories/${storyId}`)
      );

      const responses = await Promise.all(requests);
      const stories = await Promise.all(responses.map(r => r.json()));

      // Then: 캐시 효율성 확인
      const cacheHits = stories.filter(s => s.source === 'cache').length;
      const dbSources = stories.filter(s => s.source === 'database').length;

      expect(dbHits).toBe(1); // DB는 1회만 히트
      expect(dbSources).toBe(1); // 첫 번째 요청만 DB에서
      expect(cacheHits).toBe(9); // 나머지는 캐시에서
    });
  });
});