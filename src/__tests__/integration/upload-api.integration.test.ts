/**
 * 파일 업로드 API 통합 테스트
 * TDD 원칙: 600MB 제한, 파일 형식 검증, 실제 FormData 처리
 * MSW를 사용한 결정론적 테스트
 */

import { describe, it, expect } from 'vitest';

// 통합 테스트 환경 변수 설정
process.env.INTEGRATION_TEST = 'true';

const BASE_URL = 'http://localhost:3000';

// 테스트 파일 생성 유틸리티
function createMockFile(name: string, type: string, size: number): File {
  const buffer = new ArrayBuffer(size);
  const blob = new Blob([buffer], { type });
  return new File([blob], name, { type });
}

describe('파일 업로드 API 통합 테스트', () => {
  describe('POST /api/upload/video', () => {
    it('유효한 비디오 파일 업로드가 성공해야 함', async () => {
      // Arrange
      const videoFile = createMockFile('test-video.mp4', 'video/mp4', 50 * 1024 * 1024); // 50MB
      const formData = new FormData();
      formData.append('video', videoFile);

      // Act
      const response = await fetch(`${BASE_URL}/api/upload/video`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
      expect(result.data.filename).toBe('test-video.mp4');
      expect(result.data.type).toBe('video/mp4');
      expect(result.data.size).toBe(50 * 1024 * 1024);
      expect(result.data.uploadedAt).toBeDefined();
      expect(result.data.url).toContain('test-video.mp4');
    });

    it('600MB 제한을 초과하는 파일은 거부되어야 함', async () => {
      // Arrange - 600MB를 초과하는 파일 생성
      const oversizedFile = createMockFile(
        'huge-video.mp4', 
        'video/mp4', 
        650 * 1024 * 1024 // 650MB
      );
      const formData = new FormData();
      formData.append('video', oversizedFile);

      // Act
      const response = await fetch(`${BASE_URL}/api/upload/video`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(413); // Payload Too Large
      expect(result.error).toBe('파일 크기가 600MB를 초과합니다.');
    });

    it('지원하지 않는 파일 형식은 거부되어야 함', async () => {
      // Arrange
      const textFile = createMockFile('document.txt', 'text/plain', 1024);
      const formData = new FormData();
      formData.append('video', textFile);

      // Act
      const response = await fetch(`${BASE_URL}/api/upload/video`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('지원하지 않는 파일 형식입니다.');
    });

    it('다양한 비디오 형식이 지원되어야 함', async () => {
      const supportedFormats = [
        { name: 'video.mp4', type: 'video/mp4' },
        { name: 'video.avi', type: 'video/avi' },
        { name: 'video.mov', type: 'video/mov' },
        { name: 'video.quicktime', type: 'video/quicktime' },
      ];

      for (const format of supportedFormats) {
        // Arrange
        const videoFile = createMockFile(format.name, format.type, 10 * 1024 * 1024); // 10MB
        const formData = new FormData();
        formData.append('video', videoFile);

        // Act
        const response = await fetch(`${BASE_URL}/api/upload/video`, {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.data.type).toBe(format.type);
      }
    });

    it('파일이 없는 경우 에러를 반환해야 함', async () => {
      // Arrange
      const formData = new FormData();

      // Act
      const response = await fetch(`${BASE_URL}/api/upload/video`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('비디오 파일이 필요합니다.');
    });
  });

  describe('POST /api/upload/image', () => {
    it('유효한 이미지 파일 업로드가 성공해야 함', async () => {
      // Arrange
      const imageFile = createMockFile('test-image.jpg', 'image/jpeg', 2 * 1024 * 1024); // 2MB
      const formData = new FormData();
      formData.append('image', imageFile);

      // Act
      const response = await fetch(`${BASE_URL}/api/upload/image`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
      expect(result.data.filename).toBe('test-image.jpg');
      expect(result.data.type).toBe('image/jpeg');
      expect(result.data.size).toBe(2 * 1024 * 1024);
      expect(result.data.uploadedAt).toBeDefined();
      expect(result.data.url).toContain('test-image.jpg');
      expect(result.data.thumbnailUrl).toContain('thumb/test-image.jpg');
    });

    it('지원하는 모든 이미지 형식이 처리되어야 함', async () => {
      const supportedFormats = [
        { name: 'image.jpg', type: 'image/jpeg' },
        { name: 'image.png', type: 'image/png' },
        { name: 'image.webp', type: 'image/webp' },
        { name: 'image.gif', type: 'image/gif' },
      ];

      for (const format of supportedFormats) {
        // Arrange
        const imageFile = createMockFile(format.name, format.type, 1024 * 1024); // 1MB
        const formData = new FormData();
        formData.append('image', imageFile);

        // Act
        const response = await fetch(`${BASE_URL}/api/upload/image`, {
          method: 'POST',
          body: formData,
        });
        const result = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.data.type).toBe(format.type);
      }
    });

    it('지원하지 않는 이미지 형식은 거부되어야 함', async () => {
      // Arrange
      const bmpFile = createMockFile('image.bmp', 'image/bmp', 1024);
      const formData = new FormData();
      formData.append('image', bmpFile);

      // Act
      const response = await fetch(`${BASE_URL}/api/upload/image`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('지원하지 않는 이미지 형식입니다.');
    });

    it('이미지 파일이 없는 경우 에러를 반환해야 함', async () => {
      // Arrange
      const formData = new FormData();

      // Act
      const response = await fetch(`${BASE_URL}/api/upload/image`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('이미지 파일이 필요합니다.');
    });
  });
});