/**
 * Scene Entity Tests (TDD RED Phase)
 * Story와 Shot을 연결하는 Scene 엔티티 테스트
 */

import {
  Scene,
  createScene,
  updateSceneOrder,
  validateScene,
  addShotToScene,
  removeShotFromScene,
} from './Scene';

describe('Scene Entity', () => {
  describe('createScene', () => {
    it('should create a scene with required fields', () => {
      const storyId = 'story_123';
      const title = '도입 - 평범한 일상';
      const description = '주인공이 평범한 일상을 보내는 장면들';
      const order = 1;

      const scene = createScene(storyId, title, description, order);

      expect(scene).toMatchObject({
        storyId,
        title,
        description,
        order,
        duration: 0, // 기본값
        shots: [], // 빈 배열로 시작
      });
      expect(scene.id).toMatch(/^scene_/);
      expect(scene.createdAt).toBeDefined();
      expect(scene.updatedAt).toBeDefined();
    });

    it('should create scenes with different orders', () => {
      const orders = [1, 2, 3, 4];

      orders.forEach((order) => {
        const scene = createScene('story_123', '테스트', '설명', order);
        expect(scene.order).toBe(order);
      });
    });

    it('should throw error for empty storyId', () => {
      expect(() => {
        createScene('', '제목', '설명', 1);
      }).toThrow('스토리 ID는 필수입니다');
    });

    it('should throw error for empty title', () => {
      expect(() => {
        createScene('story_123', '', '설명', 1);
      }).toThrow('씬 제목은 필수입니다');
    });

    it('should throw error for invalid order', () => {
      expect(() => {
        createScene('story_123', '제목', '설명', 0);
      }).toThrow('순서는 1-4 사이여야 합니다');

      expect(() => {
        createScene('story_123', '제목', '설명', 5);
      }).toThrow('순서는 1-4 사이여야 합니다');
    });
  });

  describe('updateSceneOrder', () => {
    let scenes: Scene[];

    beforeEach(() => {
      scenes = [
        createScene('story_123', '도입', '설명1', 1),
        createScene('story_123', '전개', '설명2', 2),
        createScene('story_123', '절정', '설명3', 3),
        createScene('story_123', '결말', '설명4', 4),
      ];
      // 고유 ID 설정
      scenes[0].id = 'scene_1';
      scenes[1].id = 'scene_2';
      scenes[2].id = 'scene_3';
      scenes[3].id = 'scene_4';
    });

    it('should reorder scenes correctly', () => {
      const updatedScenes = updateSceneOrder(scenes, 'scene_4', 2);

      // scene_4가 2번째로 이동
      const movedScene = updatedScenes.find((s) => s.id === 'scene_4');
      expect(movedScene?.order).toBe(2);

      // 나머지 씬들의 순서 확인
      const scene2 = updatedScenes.find((s) => s.id === 'scene_2');
      const scene3 = updatedScenes.find((s) => s.id === 'scene_3');
      expect(scene2?.order).toBe(3);
      expect(scene3?.order).toBe(4);
    });

    it('should throw error for invalid scene id', () => {
      expect(() => {
        updateSceneOrder(scenes, 'nonexistent_id', 2);
      }).toThrow('해당 ID의 씬을 찾을 수 없습니다');
    });

    it('should throw error for invalid new order', () => {
      expect(() => {
        updateSceneOrder(scenes, 'scene_1', 0);
      }).toThrow('순서는 1-4 사이여야 합니다');

      expect(() => {
        updateSceneOrder(scenes, 'scene_1', 5);
      }).toThrow('순서는 1-4 사이여야 합니다');
    });
  });

  describe('validateScene', () => {
    it('should validate complete scene object', () => {
      const scene: Scene = {
        id: 'scene_123',
        storyId: 'story_456',
        title: '좋은 씬',
        description: '충분히 긴 설명입니다. 최소 10자 이상이어야 합니다.',
        order: 2,
        duration: 30,
        shots: ['shot_1', 'shot_2', 'shot_3'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validateScene(scene);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for too short description', () => {
      const sceneWithShortDescription: Partial<Scene> = {
        id: 'scene_123',
        storyId: 'story_456',
        title: '제목',
        description: '짧음',
        order: 1,
        duration: 30,
        shots: [],
      };

      const result = validateScene(sceneWithShortDescription);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('설명은 최소 10자 이상이어야 합니다');
    });

    it('should fail validation for too many shots', () => {
      const sceneWithTooManyShots: Partial<Scene> = {
        id: 'scene_123',
        storyId: 'story_456',
        title: '제목',
        description: '충분히 긴 설명입니다',
        order: 1,
        duration: 30,
        shots: ['shot_1', 'shot_2', 'shot_3', 'shot_4'], // 4개 (최대 3개)
      };

      const result = validateScene(sceneWithTooManyShots);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('씬당 최대 3개의 샷만 허용됩니다');
    });

    it('should fail validation for missing required fields', () => {
      const incompleteScene: Partial<Scene> = {
        title: '제목',
        // storyId, description, order 누락
      };

      const result = validateScene(incompleteScene);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('스토리 ID는 필수입니다');
      expect(result.errors).toContain('설명은 필수입니다');
      expect(result.errors).toContain('순서는 필수입니다');
    });

    it('should fail validation for invalid order', () => {
      const sceneWithInvalidOrder: Partial<Scene> = {
        id: 'scene_123',
        storyId: 'story_456',
        title: '제목',
        description: '충분히 긴 설명입니다',
        order: 5, // 유효 범위: 1-4
        duration: 30,
        shots: [],
      };

      const result = validateScene(sceneWithInvalidOrder);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('순서는 1-4 사이여야 합니다');
    });

    it('should fail validation for negative duration', () => {
      const sceneWithNegativeDuration: Partial<Scene> = {
        id: 'scene_123',
        storyId: 'story_456',
        title: '제목',
        description: '충분히 긴 설명입니다',
        order: 1,
        duration: -10,
        shots: [],
      };

      const result = validateScene(sceneWithNegativeDuration);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('지속시간은 0 이상이어야 합니다');
    });
  });

  describe('addShotToScene', () => {
    let baseScene: Scene;

    beforeEach(() => {
      baseScene = createScene(
        'story_123',
        '테스트 씬',
        '충분히 긴 설명입니다',
        1
      );
    });

    it('should add shot to scene', async () => {
      // 시간 차이를 보장하기 위해 5ms 대기
      await new Promise((resolve) => setTimeout(resolve, 5));

      const shotId = 'shot_456';
      const updatedScene = addShotToScene(baseScene, shotId);

      expect(updatedScene.shots).toContain(shotId);
      expect(updatedScene.shots).toHaveLength(1);
      expect(updatedScene.updatedAt).not.toBe(baseScene.updatedAt);
    });

    it('should not add duplicate shot', () => {
      const shotId = 'shot_456';
      const sceneWithShot = addShotToScene(baseScene, shotId);

      expect(() => {
        addShotToScene(sceneWithShot, shotId);
      }).toThrow('샷이 이미 씬에 추가되어 있습니다');
    });

    it('should not add more than 3 shots', () => {
      let scene = baseScene;

      // 3개까지는 정상 추가
      scene = addShotToScene(scene, 'shot_1');
      scene = addShotToScene(scene, 'shot_2');
      scene = addShotToScene(scene, 'shot_3');

      // 4번째 추가 시 에러
      expect(() => {
        addShotToScene(scene, 'shot_4');
      }).toThrow('씬당 최대 3개의 샷만 허용됩니다');
    });

    it('should maintain shot order', () => {
      const shot1 = 'shot_1';
      const shot2 = 'shot_2';
      const shot3 = 'shot_3';

      let scene = addShotToScene(baseScene, shot1);
      scene = addShotToScene(scene, shot2);
      scene = addShotToScene(scene, shot3);

      expect(scene.shots).toEqual([shot1, shot2, shot3]);
    });
  });

  describe('removeShotFromScene', () => {
    let sceneWithShots: Scene;

    beforeEach(() => {
      let scene = createScene(
        'story_123',
        '테스트 씬',
        '충분히 긴 설명입니다',
        1
      );
      scene = addShotToScene(scene, 'shot_1');
      scene = addShotToScene(scene, 'shot_2');
      scene = addShotToScene(scene, 'shot_3');
      sceneWithShots = scene;
    });

    it('should remove shot from scene', async () => {
      // 시간 차이를 보장하기 위해 5ms 대기
      await new Promise((resolve) => setTimeout(resolve, 5));

      const updatedScene = removeShotFromScene(sceneWithShots, 'shot_2');

      expect(updatedScene.shots).not.toContain('shot_2');
      expect(updatedScene.shots).toHaveLength(2);
      expect(updatedScene.shots).toEqual(['shot_1', 'shot_3']);
      expect(updatedScene.updatedAt).not.toBe(sceneWithShots.updatedAt);
    });

    it('should throw error for non-existent shot', () => {
      expect(() => {
        removeShotFromScene(sceneWithShots, 'nonexistent_shot');
      }).toThrow('샷이 씬에 존재하지 않습니다');
    });

    it('should maintain order after removal', () => {
      const scene1 = removeShotFromScene(sceneWithShots, 'shot_1');
      expect(scene1.shots).toEqual(['shot_2', 'shot_3']);

      const scene2 = removeShotFromScene(scene1, 'shot_3');
      expect(scene2.shots).toEqual(['shot_2']);
    });
  });
});
