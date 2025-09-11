/**
 * 시나리오 개발 API 통합 테스트
 * TDD 원칙: AI API 호출 시뮬레이션, 타임아웃 처리, 재시도 로직
 * MSW를 사용한 결정론적 테스트
 */

import { describe, it, expect } from 'vitest';

// 통합 테스트 환경 변수 설정
process.env.INTEGRATION_TEST = 'true';

const BASE_URL = 'http://localhost:3000';

describe('시나리오 개발 API 통합 테스트', () => {
  describe('POST /api/scenario/develop-shots', () => {
    it('유효한 시나리오 데이터로 샷 개발이 성공해야 함', async () => {
      // Arrange
      const requestBody = {
        storyId: 'story_123',
        scenario: '주인공이 어두운 복도를 걸어가는 장면',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/scenario/develop-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.storyId).toBe('story_123');
      expect(result.data.shots).toBeDefined();
      expect(Array.isArray(result.data.shots)).toBe(true);
      expect(result.data.shots.length).toBeGreaterThan(0);
      expect(result.data.totalShots).toBe(result.data.shots.length);
      expect(result.data.estimatedDuration).toBeGreaterThan(0);
      expect(result.data.generatedAt).toBeDefined();
      expect(result.data.aiModel).toBe('gemini-1.5-flash');
      expect(result.data.processingTime).toBeDefined();
    });

    it('생성된 샷 데이터 구조가 올바른지 검증해야 함', async () => {
      // Arrange
      const requestBody = {
        scenario: '액션 시퀀스 장면 - 자동차 추격전',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/scenario/develop-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.data.shots.length).toBeGreaterThan(0);

      // 첫 번째 샷 구조 검증
      const firstShot = result.data.shots[0];
      expect(firstShot).toHaveProperty('shotNumber');
      expect(firstShot).toHaveProperty('shotType');
      expect(firstShot).toHaveProperty('description');
      expect(firstShot).toHaveProperty('duration');
      expect(firstShot).toHaveProperty('camera');
      expect(firstShot).toHaveProperty('lighting');
      expect(firstShot).toHaveProperty('audio');

      // 카메라 정보 검증
      expect(firstShot.camera).toHaveProperty('movement');
      expect(firstShot.camera).toHaveProperty('angle');

      // 오디오 정보 검증
      expect(firstShot.audio).toHaveProperty('dialogue');
      expect(firstShot.audio).toHaveProperty('music');
      expect(firstShot.audio).toHaveProperty('sfx');
      expect(typeof firstShot.audio.dialogue).toBe('boolean');
      expect(typeof firstShot.audio.music).toBe('boolean');
      expect(typeof firstShot.audio.sfx).toBe('boolean');

      // 샷 타입이 유효한 값인지 검증
      const validShotTypes = ['Wide Shot', 'Medium Shot', 'Close-up', 'Over-the-shoulder'];
      expect(validShotTypes).toContain(firstShot.shotType);

      // 조명이 유효한 값인지 검증
      const validLighting = ['Natural', 'Soft', 'Dramatic', 'Bright'];
      expect(validLighting).toContain(firstShot.lighting);
    });

    it('storyId만 제공해도 샷 개발이 가능해야 함', async () => {
      // Arrange
      const requestBody = {
        storyId: 'existing_story_456',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/scenario/develop-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.storyId).toBe('existing_story_456');
      expect(result.data.shots.length).toBeGreaterThan(0);
    });

    it('storyId와 scenario가 모두 없으면 에러를 반환해야 함', async () => {
      // Arrange
      const requestBody = {};

      // Act
      const response = await fetch(`${BASE_URL}/api/scenario/develop-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('스토리 ID 또는 시나리오 데이터가 필요합니다.');
    });

    it('AI API 에러 시뮬레이션이 올바르게 작동해야 함', async () => {
      // Arrange - AI 에러를 트리거하는 특수한 시나리오
      const requestBody = {
        scenario: 'AI_API_ERROR',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/scenario/develop-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(503); // Service Unavailable
      expect(result.error).toBe('AI 서비스 일시 장애로 처리할 수 없습니다.');
    });

    it('처리 시간이 적절한 범위여야 함', async () => {
      // Arrange
      const requestBody = {
        scenario: '간단한 대화 장면',
      };

      const startTime = Date.now();

      // Act
      const response = await fetch(`${BASE_URL}/api/scenario/develop-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      const actualProcessingTime = Date.now() - startTime;

      // Assert
      expect(response.status).toBe(200);
      expect(actualProcessingTime).toBeGreaterThan(4000); // 최소 4초 (MSW delay)
      expect(actualProcessingTime).toBeLessThan(10000); // 최대 10초
      expect(result.data.processingTime).toBeDefined();
      expect(typeof result.data.processingTime).toBe('number');
    });

    it('샷 개수와 추정 시간이 합리적인 범위여야 함', async () => {
      // Arrange
      const requestBody = {
        scenario: '표준적인 드라마 장면',
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/scenario/develop-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      
      // 샷 개수가 합리적인 범위인지 검증 (5-15개)
      expect(result.data.totalShots).toBeGreaterThanOrEqual(5);
      expect(result.data.totalShots).toBeLessThanOrEqual(15);
      
      // 추정 시간이 합리적인 범위인지 검증 (각 샷 10-40초)
      const minDuration = result.data.totalShots * 10;
      const maxDuration = result.data.totalShots * 40;
      expect(result.data.estimatedDuration).toBeGreaterThanOrEqual(minDuration);
      expect(result.data.estimatedDuration).toBeLessThanOrEqual(maxDuration);

      // 각 샷의 지속 시간 검증
      result.data.shots.forEach((shot: any) => {
        expect(shot.duration).toBeGreaterThanOrEqual(10);
        expect(shot.duration).toBeLessThanOrEqual(40);
      });
    });

    it('긴 시나리오 텍스트도 적절히 처리되어야 함', async () => {
      // Arrange - 긴 시나리오 텍스트
      const longScenario = `
        이것은 매우 긴 시나리오입니다. 주인공은 아침에 일어나서 창문을 열고 햇살을 바라봅니다.
        그리고 천천히 화장실로 향하여 세면을 합니다. 이후 주방에서 간단한 아침식사를 준비하고,
        TV를 켜서 뉴스를 시청합니다. 뉴스에서는 중요한 사건이 일어났다는 소식이 전해집니다.
        주인공의 표정이 진지해집니다. 급히 옷을 갈아입고 집을 나섭니다. 거리에는 사람들이 분주하게 움직이고 있습니다.
        주인공은 지하철역으로 향하며 휴대폰으로 누군가에게 전화를 겁니다.
      `.trim();

      const requestBody = {
        scenario: longScenario,
      };

      // Act
      const response = await fetch(`${BASE_URL}/api/scenario/develop-shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.shots.length).toBeGreaterThan(5); // 긴 시나리오에 대해 더 많은 샷 생성
    });
  });

  describe('API 성능 및 안정성', () => {
    it('동시 요청 처리 능력 검증', async () => {
      // Arrange
      const requests = Array.from({ length: 3 }, (_, index) => 
        fetch(`${BASE_URL}/api/scenario/develop-shots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario: `동시 요청 테스트 ${index + 1}`,
          }),
        })
      );

      // Act
      const responses = await Promise.all(requests);

      // Assert
      responses.forEach(async (response, index) => {
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.data.shots.length).toBeGreaterThan(0);
      });
    });
  });
});