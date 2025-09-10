/**
 * PDF 생성 API 통합 테스트
 * TDD 원칙: 한국어 폰트 지원, 메모리 사용량 제한, 실제 PDF 바이너리 처리
 * MSW를 사용한 결정론적 테스트
 */

import { describe, it, expect } from 'vitest';

// 통합 테스트 환경 변수 설정
process.env.INTEGRATION_TEST = 'true';

const BASE_URL = 'http://localhost:3000';

describe('PDF 생성 API 통합 테스트', () => {
  describe('POST /api/generate/pdf', () => {
    it('유효한 컨텐츠로 PDF 생성이 성공해야 함', async () => {
      // Arrange
      const requestBody = {
        title: '테스트 스토리',
        content: '이것은 PDF 생성을 위한 테스트 컨텐츠입니다.',
        storyId: 'story_123',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(response.headers.get('content-disposition')).toContain('attachment');
      expect(response.headers.get('content-disposition')).toContain('.pdf');

      // PDF 바이너리 데이터 검증
      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      const pdfHeader = new TextDecoder().decode(uint8Array.slice(0, 8));
      expect(pdfHeader).toBe('%PDF-1.4');
    });

    it('한국어 컨텐츠로 PDF 생성 시 폰트 정보가 포함되어야 함', async () => {
      // Arrange - 한국어 포함 컨텐츠
      const requestBody = {
        title: '한국어 스토리',
        content: '안녕하세요. 한국어로 작성된 스토리 내용입니다. 가나다라마바사아자차카타파하.',
        storyId: 'korean_story_123',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get('x-korean-font-used')).toBe('true');
      
      // PDF 바이너리 검증
      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('영어 컨텐츠로 PDF 생성 시 한국어 폰트가 사용되지 않아야 함', async () => {
      // Arrange - 영어만 포함된 컨텐츠
      const requestBody = {
        title: 'English Story',
        content: 'This is an English content for PDF generation testing.',
        storyId: 'english_story_123',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get('x-korean-font-used')).toBe('false');
    });

    it('대용량 컨텐츠는 메모리 부족 에러를 반환해야 함', async () => {
      // Arrange - 1MB 이상의 대용량 컨텐츠 생성
      const largeContent = 'A'.repeat(1000001); // 1MB + 1 byte
      const requestBody = {
        content: largeContent,
        storyId: 'large_story_123',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(413); // Payload Too Large
      expect(result.error).toBe('컨텐츠가 너무 큽니다. 메모리 부족으로 처리할 수 없습니다.');
    });

    it('storyId만 제공해도 PDF 생성이 가능해야 함', async () => {
      // Arrange
      const requestBody = {
        storyId: 'story_only_123',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
    });

    it('content와 storyId가 모두 없으면 에러를 반환해야 함', async () => {
      // Arrange
      const requestBody = {
        title: 'Title Only',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('생성할 컨텐츠 또는 스토리 ID가 필요합니다.');
    });

    it('빈 요청 바디는 에러를 반환해야 함', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('생성할 컨텐츠 또는 스토리 ID가 필요합니다.');
    });

    it('PDF 파일 크기가 합리적인 범위여야 함', async () => {
      // Arrange
      const requestBody = {
        title: '표준 길이 스토리',
        content: '이것은 표준적인 길이의 스토리 내용입니다. '.repeat(100), // 적당한 길이
        storyId: 'standard_story_123',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Assert
      expect(response.status).toBe(200);
      
      const buffer = await response.arrayBuffer();
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      
      // PDF 크기가 합리적인 범위인지 검증 (100KB 이하)
      expect(buffer.byteLength).toBeGreaterThan(100); // 최소 크기
      expect(buffer.byteLength).toBeLessThan(100 * 1024); // 최대 100KB
      expect(contentLength).toBe(buffer.byteLength);
    });

    it('특수 문자가 포함된 컨텐츠도 처리되어야 함', async () => {
      // Arrange
      const requestBody = {
        title: '특수문자 테스트',
        content: '특수문자: !@#$%^&*()_+-=[]{}|;:,.<>? 숫자: 0123456789 한글: 가나다',
        storyId: 'special_chars_story',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/generate/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      
      const buffer = await response.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    });
  });
});