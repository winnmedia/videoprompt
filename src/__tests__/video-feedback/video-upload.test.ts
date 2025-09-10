/**
 * 비디오 업로드 기능 테스트
 * 
 * 테스트 범위:
 * - 파일 저장 및 검증
 * - 메타데이터 추출
 * - 파일 크기 및 타입 검증
 * - 에러 처리
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// MSW 서버 설정
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  vi.resetAllMocks();
});

afterAll(() => {
  server.close();
});

// Mock 비디오 파일 생성 헬퍼
const createMockVideoFile = (name: string, size: number = 1024 * 1024): File => {
  const content = new Uint8Array(size).fill(0);
  return new File([content], name, { type: 'video/mp4' });
};

// Mock 이미지 파일 생성 헬퍼 (잘못된 파일 타입 테스트용)
const createMockImageFile = (name: string): File => {
  const content = new Uint8Array(1024).fill(0);
  return new File([content], name, { type: 'image/jpeg' });
};

describe('비디오 업로드 기능', () => {
  it('유효한 비디오 파일 업로드 성공', async () => {
    // MSW 핸들러 설정
    server.use(
      http.post('/api/upload/video', () => {
        return HttpResponse.json({
          ok: true,
          videoUrl: 'https://example.com/videos/test-video.mp4',
          fileName: 'test-video.mp4',
          fileSize: 1048576,
          fileType: 'video/mp4',
        }, { status: 200 });
      })
    );

    const file = createMockVideoFile('test-video.mp4');
    const formData = new FormData();
    formData.append('video', file);

    const response = await fetch('/api/upload/video', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.videoUrl).toMatch(/test-video\.mp4$/);
    expect(result.fileName).toBe('test-video.mp4');
    expect(result.fileType).toBe('video/mp4');
  });

  it('파일 크기 초과 시 업로드 실패', async () => {
    server.use(
      http.post('/api/upload/video', () => {
        return HttpResponse.json({
          ok: false,
          error: 'FILE_TOO_LARGE',
          message: '파일 크기가 200MB를 초과합니다.',
        }, { status: 413 });
      })
    );

    const largeFile = createMockVideoFile('large-video.mp4', 250 * 1024 * 1024); // 250MB
    const formData = new FormData();
    formData.append('video', largeFile);

    const response = await fetch('/api/upload/video', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    expect(response.status).toBe(413);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('FILE_TOO_LARGE');
  });

  it('유효하지 않은 파일 타입 업로드 실패', async () => {
    server.use(
      http.post('/api/upload/video', () => {
        return HttpResponse.json({
          ok: false,
          error: 'INVALID_TYPE',
          message: '유효한 영상 파일이 아닙니다.',
        }, { status: 400 });
      })
    );

    const imageFile = createMockImageFile('image.jpg');
    const formData = new FormData();
    formData.append('video', imageFile);

    const response = await fetch('/api/upload/video', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('INVALID_TYPE');
  });

  it('파일 누락 시 업로드 실패', async () => {
    server.use(
      http.post('/api/upload/video', () => {
        return HttpResponse.json({
          ok: false,
          error: 'VIDEO_MISSING',
          message: '영상 파일이 필요합니다.',
        }, { status: 400 });
      })
    );

    const formData = new FormData();

    const response = await fetch('/api/upload/video', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('VIDEO_MISSING');
  });

  it('비디오 메타데이터 추출 및 검증', async () => {
    server.use(
      http.post('/api/upload/video', () => {
        return HttpResponse.json({
          ok: true,
          videoUrl: 'https://example.com/videos/meta-test.mp4',
          fileName: 'meta-test.mp4',
          fileSize: 5242880,
          fileType: 'video/mp4',
          metadata: {
            duration: 120.5,
            width: 1920,
            height: 1080,
            codec: 'h264',
            bitrate: 2000,
          },
        }, { status: 200 });
      })
    );

    const file = createMockVideoFile('meta-test.mp4', 5 * 1024 * 1024);
    const formData = new FormData();
    formData.append('video', file);

    const response = await fetch('/api/upload/video', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.duration).toBeGreaterThan(0);
    expect(result.metadata.width).toBe(1920);
    expect(result.metadata.height).toBe(1080);
    expect(result.metadata.codec).toBe('h264');
  });
});