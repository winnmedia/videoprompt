/**
 * 스토리 기획 API 통합 테스트
 * TDD 원칙: 실제 데이터베이스와 HTTP 요청을 사용한 통합 테스트
 * MSW를 사용하여 결정론적 테스트 실행
 */

import { describe, it, expect, beforeEach } from 'vitest';

// 통합 테스트 환경 변수 설정
process.env.INTEGRATION_TEST = 'true';

const BASE_URL = 'http://localhost:3000';

describe('/api/planning/stories 통합 테스트', () => {
  describe('GET /api/planning/stories', () => {
    it('스토리 목록을 페이지네이션과 함께 조회해야 함', async () => {
      // Arrange & Act
      const response = await fetch(`${BASE_URL}/api/planning/stories?page=1&limit=5`);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.stories).toBeDefined();
      expect(Array.isArray(result.stories)).toBe(true);
      expect(result.stories.length).toBeLessThanOrEqual(5);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.itemsPerPage).toBe(5);
      expect(result.pagination.totalItems).toBeGreaterThan(0);
      
      // 스토리 구조 검증
      if (result.stories.length > 0) {
        const story = result.stories[0];
        expect(story).toHaveProperty('id');
        expect(story).toHaveProperty('title');
        expect(story).toHaveProperty('oneLineStory');
        expect(story).toHaveProperty('genre');
        expect(story).toHaveProperty('tone');
        expect(story).toHaveProperty('target');
        expect(story).toHaveProperty('createdAt');
        expect(story).toHaveProperty('updatedAt');
      }
    });

    it('검색 기능이 올바르게 작동해야 함', async () => {
      // Arrange & Act
      const searchTerm = 'action';
      const response = await fetch(`${BASE_URL}/api/planning/stories?search=${searchTerm}`);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.stories).toBeDefined();
      expect(Array.isArray(result.stories)).toBe(true);
      
      // 검색 결과 검증 - 제목, 스토리 내용, 장르에서 검색어 포함 여부 확인
      result.stories.forEach((story: any) => {
        const containsSearchTerm = 
          story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          story.oneLineStory.toLowerCase().includes(searchTerm.toLowerCase()) ||
          story.genre.toLowerCase().includes(searchTerm.toLowerCase());
        expect(containsSearchTerm).toBe(true);
      });
    });

    it('빈 검색어로도 정상 응답해야 함', async () => {
      // Arrange & Act
      const response = await fetch(`${BASE_URL}/api/planning/stories?search=`);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.stories).toBeDefined();
      expect(result.pagination).toBeDefined();
    });

    it('유효하지 않은 페이지 번호에 대해 적절히 처리해야 함', async () => {
      // Arrange & Act
      const response = await fetch(`${BASE_URL}/api/planning/stories?page=-1`);
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.stories).toBeDefined();
      expect(result.pagination.currentPage).toBe(1); // 기본값으로 처리
    });
  });

  describe('POST /api/planning/stories', () => {
    it('유효한 스토리 데이터로 생성에 성공해야 함', async () => {
      // Arrange
      const requestBody = {
        title: '새로운 테스트 스토리',
        oneLineStory: '흥미진진한 테스트 스토리 내용',
        genre: 'Action',
        tone: 'Exciting',
        target: 'Teen',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/planning/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(result.id).toBeDefined();
      expect(result.title).toBe(requestBody.title);
      expect(result.oneLineStory).toBe(requestBody.oneLineStory);
      expect(result.genre).toBe(requestBody.genre);
      expect(result.tone).toBe(requestBody.tone);
      expect(result.target).toBe(requestBody.target);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('필수 필드가 누락된 경우 400 에러를 반환해야 함', async () => {
      // Arrange
      const requestBody = {
        title: '제목만 있는 스토리',
        // oneLineStory 누락
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/planning/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('제목과 스토리는 필수입니다.');
    });

    it('데이터베이스 에러 시뮬레이션이 올바르게 작동해야 함', async () => {
      // Arrange - DB 에러를 트리거하는 특수한 제목 사용
      const requestBody = {
        title: 'DB_ERROR_TEST',
        oneLineStory: '데이터베이스 에러 테스트',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/planning/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(result.error).toBe('스토리 저장 중 오류가 발생했습니다.');
    });

    it('기본값들이 올바르게 설정되어야 함', async () => {
      // Arrange
      const requestBody = {
        title: '기본값 테스트 스토리',
        oneLineStory: '기본값으로 설정되는 스토리',
        // genre, tone, target 누락
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/planning/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(result.genre).toBe('Drama'); // 기본값
      expect(result.tone).toBe('Neutral'); // 기본값
      expect(result.target).toBe('General'); // 기본값
      expect(result.structure).toBeNull();
    });

    it('빈 요청 바디에 대해 적절히 처리해야 함', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/planning/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('제목과 스토리는 필수입니다.');
    });

    it('잘못된 JSON 형식에 대해 적절히 처리해야 함', async () => {
      // Act
      const response = await fetch(`${BASE_URL}/api/planning/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      // Assert
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});