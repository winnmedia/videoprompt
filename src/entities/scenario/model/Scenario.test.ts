/**
 * Scenario Entity Tests
 * TDD 원칙에 따른 시나리오 엔티티 테스트
 */

import {
  Scenario,
  Scene,
  createScenario,
  addScene,
  validateScenario,
  calculateScenarioDuration,
} from './Scenario';

describe('Scenario Entity', () => {
  const mockScene: Scene = {
    id: 'scene-1',
    title: '오프닝',
    description: '제주도 여행 시작',
    type: '기',
    duration: 30,
    content: '주인공이 제주도 공항에 도착하는 장면',
    order: 1,
  };

  const mockScenario: Scenario = {
    id: 'scenario-1',
    title: '제주도 여행 브이로그',
    description: '제주도 3박 4일 여행 이야기',
    scenes: [mockScene],
    totalDuration: 30, // mockScene.duration과 일치
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    status: 'draft',
    genre: '여행',
    targetAudience: '20-30대',
  };

  describe('createScenario', () => {
    it('새로운 시나리오를 생성한다', () => {
      const scenario = createScenario(
        '제주도 여행',
        '제주도 여행 영상',
        '여행',
        '20-30대'
      );

      expect(scenario.id).toBeDefined();
      expect(scenario.title).toBe('제주도 여행');
      expect(scenario.description).toBe('제주도 여행 영상');
      expect(scenario.scenes).toEqual([]);
      expect(scenario.status).toBe('draft');
      expect(scenario.genre).toBe('여행');
      expect(scenario.targetAudience).toBe('20-30대');
      expect(scenario.totalDuration).toBe(0);
    });

    it('필수 항목이 비어있으면 오류를 던진다', () => {
      expect(() => createScenario('', '설명', '여행', '20-30대')).toThrow(
        '제목은 필수입니다'
      );
      expect(() => createScenario('제목', '', '여행', '20-30대')).toThrow(
        '설명은 필수입니다'
      );
    });
  });

  describe('addScene', () => {
    it('시나리오에 새 씬을 추가한다', () => {
      const newScene: Omit<Scene, 'id' | 'order'> = {
        title: '중간',
        description: '맛집 탐방',
        type: '승',
        duration: 45,
        content: '맛집에서 음식을 먹는 장면',
      };

      const updated = addScene(mockScenario, newScene);

      expect(updated.scenes).toHaveLength(2);
      expect(updated.scenes[1].title).toBe('중간');
      expect(updated.scenes[1].order).toBe(2);
      expect(updated.totalDuration).toBe(75); // 30 + 45
    });
  });

  describe('validateScenario', () => {
    it('유효한 시나리오는 검증을 통과한다', () => {
      const result = validateScenario(mockScenario);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('씬이 없는 시나리오는 검증에 실패한다', () => {
      const emptyScenario = { ...mockScenario, scenes: [] };
      const result = validateScenario(emptyScenario);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('최소 1개의 씬이 필요합니다');
    });

    it('4단 구조가 아니면 경고를 포함한다', () => {
      const incompleteScenario = {
        ...mockScenario,
        scenes: [mockScene], // 1개만 있음 (4개여야 함)
      };
      const result = validateScenario(incompleteScenario);
      expect(result.warnings).toContain('기승전결 4단 구조를 권장합니다');
    });
  });

  describe('calculateScenarioDuration', () => {
    it('모든 씬의 지속시간을 합산한다', () => {
      const scenes: Scene[] = [
        { ...mockScene, duration: 30 },
        { ...mockScene, id: 'scene-2', duration: 45 },
        { ...mockScene, id: 'scene-3', duration: 60 },
      ];
      const scenarioWithScenes = { ...mockScenario, scenes };

      const totalDuration = calculateScenarioDuration(scenarioWithScenes);
      expect(totalDuration).toBe(135); // 30 + 45 + 60
    });
  });
});
