/**
 * Shot Entity Tests (TDD RED Phase)
 * 실패하는 테스트부터 작성
 */

import {
  Shot,
  createShot,
  updateShotOrder,
  calculateTotalDuration,
  validateShot,
} from './Shot';

describe('Shot Entity', () => {
  describe('createShot', () => {
    it('should create a shot with required fields', () => {
      const sceneId = 'scene_123';
      const shotType = 'medium';
      const description = '주인공이 창가에 서서 밖을 바라본다';

      const shot = createShot(sceneId, shotType, description);

      expect(shot).toMatchObject({
        sceneId,
        shotType,
        description,
        cameraMovement: 'static', // 기본값
        duration: 3, // 기본값 (초)
        order: 1, // 기본값
      });
      expect(shot.id).toMatch(/^shot_/);
      expect(shot.createdAt).toBeDefined();
      expect(shot.updatedAt).toBeDefined();
    });

    it('should create shots with different shot types', () => {
      const shotTypes: Array<
        'wide' | 'medium' | 'closeup' | 'extreme-closeup' | 'pov'
      > = ['wide', 'medium', 'closeup', 'extreme-closeup', 'pov'];

      shotTypes.forEach((shotType) => {
        const shot = createShot('scene_123', shotType, '설명');
        expect(shot.shotType).toBe(shotType);
      });
    });

    it('should create shots with different camera movements', () => {
      const movements: Array<'static' | 'pan' | 'tilt' | 'dolly' | 'zoom'> = [
        'static',
        'pan',
        'tilt',
        'dolly',
        'zoom',
      ];

      movements.forEach((movement) => {
        const shot = createShot('scene_123', 'medium', '설명', movement);
        expect(shot.cameraMovement).toBe(movement);
      });
    });

    it('should throw error for empty description', () => {
      expect(() => {
        createShot('scene_123', 'medium', '');
      }).toThrow('샷 설명은 필수입니다');
    });

    it('should throw error for empty sceneId', () => {
      expect(() => {
        createShot('', 'medium', '설명');
      }).toThrow('씬 ID는 필수입니다');
    });
  });

  describe('updateShotOrder', () => {
    let shots: Shot[];

    beforeEach(() => {
      shots = [
        createShot('scene_123', 'wide', '첫 번째 샷'),
        createShot('scene_123', 'medium', '두 번째 샷'),
        createShot('scene_123', 'closeup', '세 번째 샷'),
      ];
      // 고유 ID 설정 (타임스탬프 충돌 방지)
      shots[0].id = 'shot_1';
      shots[1].id = 'shot_2';
      shots[2].id = 'shot_3';
      // 순서 설정
      shots[0].order = 1;
      shots[1].order = 2;
      shots[2].order = 3;
    });

    it('should update shot order and reorder others', () => {
      const updatedShots = updateShotOrder(shots, shots[2].id, 1);

      const firstShot = updatedShots.find((s) => s.id === shots[2].id);
      expect(firstShot?.order).toBe(1);

      const secondShot = updatedShots.find((s) => s.id === shots[0].id);
      expect(secondShot?.order).toBe(2);

      const thirdShot = updatedShots.find((s) => s.id === shots[1].id);
      expect(thirdShot?.order).toBe(3);
    });

    it('should move shot to the end', () => {
      const updatedShots = updateShotOrder(shots, shots[0].id, 3);

      const firstShot = updatedShots.find((s) => s.id === shots[1].id);
      expect(firstShot?.order).toBe(1);

      const secondShot = updatedShots.find((s) => s.id === shots[2].id);
      expect(secondShot?.order).toBe(2);

      const thirdShot = updatedShots.find((s) => s.id === shots[0].id);
      expect(thirdShot?.order).toBe(3);
    });

    it('should throw error for invalid shot id', () => {
      expect(() => {
        updateShotOrder(shots, 'nonexistent_id', 1);
      }).toThrow('해당 ID의 샷을 찾을 수 없습니다');
    });

    it('should throw error for invalid order', () => {
      expect(() => {
        updateShotOrder(shots, shots[0].id, 0);
      }).toThrow('순서는 1 이상이어야 합니다');

      expect(() => {
        updateShotOrder(shots, shots[0].id, 4);
      }).toThrow('순서는 전체 샷 개수를 초과할 수 없습니다');
    });

    it('should return unchanged shots when newOrder equals current order', () => {
      const unchangedShots = updateShotOrder(shots, shots[0].id, 1);
      expect(unchangedShots).toBe(shots); // 참조가 같아야 함
    });
  });

  describe('calculateTotalDuration', () => {
    it('should calculate total duration of shots', () => {
      const shots: Shot[] = [
        { ...createShot('scene_123', 'wide', '첫 번째'), duration: 5 },
        { ...createShot('scene_123', 'medium', '두 번째'), duration: 3 },
        { ...createShot('scene_123', 'closeup', '세 번째'), duration: 7 },
      ];

      const totalDuration = calculateTotalDuration(shots);
      expect(totalDuration).toBe(15);
    });

    it('should return 0 for empty shots array', () => {
      const totalDuration = calculateTotalDuration([]);
      expect(totalDuration).toBe(0);
    });

    it('should handle single shot', () => {
      const shots = [createShot('scene_123', 'medium', '단일 샷')];
      shots[0].duration = 10;

      const totalDuration = calculateTotalDuration(shots);
      expect(totalDuration).toBe(10);
    });
  });

  describe('validateShot', () => {
    it('should validate complete shot object', () => {
      const shot: Shot = {
        id: 'shot_123',
        sceneId: 'scene_456',
        shotType: 'medium',
        cameraMovement: 'pan',
        duration: 5,
        description: '주인공이 카메라를 향해 걸어온다',
        order: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validateShot(shot);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for too short description', () => {
      const shotWithShortDescription: Partial<Shot> = {
        id: 'shot_123',
        sceneId: 'scene_456',
        shotType: 'medium',
        description: '짧음',
        duration: 5,
        order: 1,
      };

      const result = validateShot(shotWithShortDescription);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('샷 설명은 최소 10자 이상이어야 합니다');
    });

    it('should fail validation for invalid duration', () => {
      const shotWithInvalidDuration: Partial<Shot> = {
        id: 'shot_123',
        sceneId: 'scene_456',
        shotType: 'medium',
        description: '충분히 긴 샷 설명입니다',
        duration: 0,
        order: 1,
      };

      const result = validateShot(shotWithInvalidDuration);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('지속시간은 0.1초 이상이어야 합니다');
    });

    it('should fail validation for too long duration', () => {
      const shotWithLongDuration: Partial<Shot> = {
        id: 'shot_123',
        sceneId: 'scene_456',
        shotType: 'medium',
        description: '충분히 긴 샷 설명입니다',
        duration: 121, // 2분 1초
        order: 1,
      };

      const result = validateShot(shotWithLongDuration);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('지속시간은 120초를 초과할 수 없습니다');
    });

    it('should fail validation for missing required fields', () => {
      const incompleteShot: Partial<Shot> = {
        shotType: 'medium',
        description: '충분히 긴 샷 설명입니다',
        // sceneId, id, duration, order 누락
      };

      const result = validateShot(incompleteShot);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('씬 ID는 필수입니다');
      expect(result.errors).toContain('샷 ID는 필수입니다');
    });

    it('should fail validation for invalid order', () => {
      const shotWithInvalidOrder: Partial<Shot> = {
        id: 'shot_123',
        sceneId: 'scene_456',
        shotType: 'medium',
        description: '충분히 긴 샷 설명입니다',
        duration: 5,
        order: 0, // 0은 유효하지 않음
      };

      const result = validateShot(shotWithInvalidOrder);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('순서는 1 이상이어야 합니다');
    });

    it('should fail validation for missing description', () => {
      const shotWithoutDescription: Partial<Shot> = {
        id: 'shot_123',
        sceneId: 'scene_456',
        shotType: 'medium',
        duration: 5,
        order: 1,
      };

      const result = validateShot(shotWithoutDescription);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('샷 설명은 필수입니다');
    });

    it('should fail validation for missing shotType', () => {
      const shotWithoutType: Partial<Shot> = {
        id: 'shot_123',
        sceneId: 'scene_456',
        description: '충분히 긴 샷 설명입니다',
        duration: 5,
        order: 1,
      };

      const result = validateShot(shotWithoutType);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('샷 타입은 필수입니다');
    });
  });
});
