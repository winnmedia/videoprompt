/**
 * Shot Entity Tests
 * TDD Red-Green-Refactor 사이클 적용
 */

import {
  createTwelveShotCollection,
  updateTwelveShotOrder,
  updateTwelveShot,
  updateShotStoryboard,
  validateTwelveShotCollection
} from '../../entities/Shot';
import type { FourActStory } from '../../entities/story';
import type { ShotBreakdownParams } from '../../features/shots/types';

// 테스트용 모의 데이터
const mockStory: FourActStory = {
  id: 'story_test_123',
  title: '테스트 스토리',
  synopsis: '테스트용 4단계 스토리입니다.',
  genre: 'drama',
  targetAudience: 'general',
  tone: 'serious',
  acts: {
    setup: {
      id: 'act_1',
      actNumber: 1,
      title: '도입',
      content: '주인공이 등장하고 상황이 설정됩니다.',
      duration: 60,
      keyEvents: ['주인공 등장', '갈등 제시'],
      emotions: 'calm',
      characterFocus: ['주인공']
    },
    development: {
      id: 'act_2',
      actNumber: 2,
      title: '전개',
      content: '갈등이 심화되고 복잡해집니다.',
      duration: 120,
      keyEvents: ['갈등 심화', '장애물 등장'],
      emotions: 'tension',
      characterFocus: ['주인공', '조력자']
    },
    climax: {
      id: 'act_3',
      actNumber: 3,
      title: '절정',
      content: '최고 긴장감의 순간입니다.',
      duration: 90,
      keyEvents: ['결정적 순간', '선택'],
      emotions: 'excitement',
      characterFocus: ['주인공']
    },
    resolution: {
      id: 'act_4',
      actNumber: 4,
      title: '결말',
      content: '갈등이 해결됩니다.',
      duration: 60,
      keyEvents: ['해결', '새로운 시작'],
      emotions: 'hope',
      characterFocus: ['주인공', '조력자']
    }
  },
  status: 'completed',
  userId: 'user_test',
  totalDuration: 330,
  aiGenerated: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

const mockParams: ShotBreakdownParams = {
  storyId: 'story_test_123',
  creativity: 70,
  cinematic: 80,
  pacing: 'medium',
  style: 'commercial'
};

describe('Shot Entity', () => {
  describe('createTwelveShotCollection', () => {
    it('should create a collection with exactly 12 shots', () => {
      const collection = createTwelveShotCollection(mockStory, mockParams);

      expect(collection.shots).toHaveLength(12);
      expect(collection.storyId).toBe(mockStory.id);
      expect(collection.aiGenerated).toBe(true);
    });

    it('should distribute shots correctly across acts for medium pacing', () => {
      const collection = createTwelveShotCollection(mockStory, {
        ...mockParams,
        pacing: 'medium'
      });

      const actCounts = {
        setup: 0,
        development: 0,
        climax: 0,
        resolution: 0
      };

      collection.shots.forEach(shot => {
        actCounts[shot.actType]++;
      });

      expect(actCounts.setup).toBe(3);
      expect(actCounts.development).toBe(4);
      expect(actCounts.climax).toBe(3);
      expect(actCounts.resolution).toBe(2);
    });

    it('should assign correct global order (1-12)', () => {
      const collection = createTwelveShotCollection(mockStory, mockParams);

      const orders = collection.shots.map(shot => shot.globalOrder).sort((a, b) => a - b);
      const expectedOrders = Array.from({ length: 12 }, (_, i) => i + 1);

      expect(orders).toEqual(expectedOrders);
    });

    it('should throw error for invalid story', () => {
      const invalidStory = { ...mockStory, id: '' };

      expect(() => {
        createTwelveShotCollection(invalidStory, mockParams);
      }).toThrow('스토리 ID는 필수입니다');
    });

    it('should assign appropriate shot types based on act type', () => {
      const collection = createTwelveShotCollection(mockStory, mockParams);

      const setupShots = collection.shots.filter(shot => shot.actType === 'setup');
      const climaxShots = collection.shots.filter(shot => shot.actType === 'climax');

      // Setup은 주로 establishing, wide 샷
      expect(setupShots.some(shot => ['establishing', 'wide'].includes(shot.shotType))).toBe(true);

      // Climax는 주로 close-up, extreme-close-up 샷
      expect(climaxShots.some(shot => ['close-up', 'extreme-close-up'].includes(shot.shotType))).toBe(true);
    });
  });

  describe('updateTwelveShotOrder', () => {
    let collection: ReturnType<typeof createTwelveShotCollection>;

    beforeEach(() => {
      collection = createTwelveShotCollection(mockStory, mockParams);
    });

    it('should update shot order correctly', () => {
      const shotToMove = collection.shots[0]; // 1번 샷
      const updatedCollection = updateTwelveShotOrder(collection, shotToMove.id, 5);

      const movedShot = updatedCollection.shots.find(shot => shot.id === shotToMove.id);
      expect(movedShot?.globalOrder).toBe(5);

      // 다른 샷들의 순서도 적절히 조정되어야 함
      const orders = updatedCollection.shots
        .map(shot => shot.globalOrder)
        .sort((a, b) => a - b);
      expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('should throw error for invalid order', () => {
      const shotId = collection.shots[0].id;

      expect(() => {
        updateTwelveShotOrder(collection, shotId, 0);
      }).toThrow('글로벌 순서는 1-12 사이여야 합니다');

      expect(() => {
        updateTwelveShotOrder(collection, shotId, 13);
      }).toThrow('글로벌 순서는 1-12 사이여야 합니다');
    });

    it('should throw error for non-existent shot', () => {
      expect(() => {
        updateTwelveShotOrder(collection, 'non_existent_shot', 5);
      }).toThrow('해당 ID의 숏트를 찾을 수 없습니다');
    });

    it('should not change anything if order is the same', () => {
      const shotToMove = collection.shots[0];
      const originalOrder = shotToMove.globalOrder;
      const updatedCollection = updateTwelveShotOrder(collection, shotToMove.id, originalOrder);

      expect(updatedCollection).toEqual(collection);
    });
  });

  describe('updateTwelveShot', () => {
    let collection: ReturnType<typeof createTwelveShotCollection>;

    beforeEach(() => {
      collection = createTwelveShotCollection(mockStory, mockParams);
    });

    it('should update shot content correctly', () => {
      const shotId = collection.shots[0].id;
      const updates = {
        title: '새로운 제목',
        description: '새로운 설명',
        duration: 10
      };

      const updatedCollection = updateTwelveShot(collection, shotId, updates);
      const updatedShot = updatedCollection.shots.find(shot => shot.id === shotId);

      expect(updatedShot?.title).toBe(updates.title);
      expect(updatedShot?.description).toBe(updates.description);
      expect(updatedShot?.duration).toBe(updates.duration);
      expect(updatedShot?.isUserEdited).toBe(true);
    });

    it('should update total duration when shot duration changes', () => {
      const shotId = collection.shots[0].id;
      const originalDuration = collection.totalDuration;
      const originalShotDuration = collection.shots[0].duration;

      const updatedCollection = updateTwelveShot(collection, shotId, { duration: 10 });

      const expectedDuration = originalDuration - originalShotDuration + 10;
      expect(updatedCollection.totalDuration).toBe(expectedDuration);
    });

    it('should record edit history', () => {
      const shotId = collection.shots[0].id;
      const originalTitle = collection.shots[0].title;

      const updatedCollection = updateTwelveShot(collection, shotId, {
        title: '새로운 제목'
      });

      const updatedShot = updatedCollection.shots.find(shot => shot.id === shotId);
      expect(updatedShot?.editHistory).toHaveLength(1);
      expect(updatedShot?.editHistory[0].field).toBe('title');
      expect(updatedShot?.editHistory[0].oldValue).toBe(originalTitle);
      expect(updatedShot?.editHistory[0].newValue).toBe('새로운 제목');
    });

    it('should throw error for non-existent shot', () => {
      expect(() => {
        updateTwelveShot(collection, 'non_existent_shot', { title: '제목' });
      }).toThrow('해당 ID의 숏트를 찾을 수 없습니다');
    });
  });

  describe('updateShotStoryboard', () => {
    let collection: ReturnType<typeof createTwelveShotCollection>;

    beforeEach(() => {
      collection = createTwelveShotCollection(mockStory, mockParams);
    });

    it('should update storyboard status correctly', () => {
      const shotId = collection.shots[0].id;
      const storyboardUpdate = {
        status: 'completed' as const,
        imageUrl: 'https://example.com/image.png',
        generatedAt: new Date().toISOString()
      };

      const updatedCollection = updateShotStoryboard(collection, shotId, storyboardUpdate);
      const updatedShot = updatedCollection.shots.find(shot => shot.id === shotId);

      expect(updatedShot?.storyboard.status).toBe('completed');
      expect(updatedShot?.storyboard.imageUrl).toBe(storyboardUpdate.imageUrl);
    });

    it('should update completion percentage when storyboard is completed', () => {
      const shotId = collection.shots[0].id;

      const updatedCollection = updateShotStoryboard(collection, shotId, {
        status: 'completed'
      });

      expect(updatedCollection.storyboardsCompleted).toBe(1);
      expect(updatedCollection.completionPercentage).toBeGreaterThan(0);
    });

    it('should set allStoryboardsGenerated to true when all are completed', () => {
      let updatedCollection = collection;

      // 모든 샷의 스토리보드를 완료 상태로 변경
      for (const shot of collection.shots) {
        updatedCollection = updateShotStoryboard(updatedCollection, shot.id, {
          status: 'completed'
        });
      }

      expect(updatedCollection.allStoryboardsGenerated).toBe(true);
      expect(updatedCollection.storyboardsCompleted).toBe(12);
      expect(updatedCollection.completionPercentage).toBe(100);
    });
  });

  describe('validateTwelveShotCollection', () => {
    let collection: ReturnType<typeof createTwelveShotCollection>;

    beforeEach(() => {
      collection = createTwelveShotCollection(mockStory, mockParams);
    });

    it('should validate a correct collection', () => {
      const validation = validateTwelveShotCollection(collection);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect incorrect number of shots', () => {
      const invalidCollection = {
        ...collection,
        shots: collection.shots.slice(0, 10) // 10개만
      };

      const validation = validateTwelveShotCollection(invalidCollection);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('12개의 숏트가 필요하지만 10개입니다');
    });

    it('should detect incorrect shot order', () => {
      const invalidCollection = {
        ...collection,
        shots: collection.shots.map((shot, index) => ({
          ...shot,
          globalOrder: index === 0 ? 5 : shot.globalOrder // 첫 번째 샷 순서를 5로 변경
        }))
      };

      const validation = validateTwelveShotCollection(invalidCollection);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('순서'))).toBe(true);
    });

    it('should provide helpful suggestions based on completion', () => {
      // 빈 제목과 설명을 가진 샷들로 테스트
      const incompleteCollection = {
        ...collection,
        shots: collection.shots.map((shot, index) => ({
          ...shot,
          title: index < 5 ? '' : shot.title,
          description: index < 5 ? '' : shot.description
        }))
      };

      const validation = validateTwelveShotCollection(incompleteCollection);

      expect(validation.completionPercentage).toBeLessThan(50);
      expect(validation.suggestions).toContain('AI 생성을 통해 기본 숏트 내용을 완성해보세요');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow from creation to completion', () => {
      // 1. 컬렉션 생성
      let collection = createTwelveShotCollection(mockStory, mockParams);
      expect(collection.shots).toHaveLength(12);

      // 2. 첫 번째 샷 편집
      const firstShotId = collection.shots[0].id;
      collection = updateTwelveShot(collection, firstShotId, {
        title: '편집된 제목',
        description: '편집된 설명'
      });

      // 3. 샷 순서 변경
      collection = updateTwelveShotOrder(collection, firstShotId, 3);

      // 4. 스토리보드 생성
      collection = updateShotStoryboard(collection, firstShotId, {
        status: 'completed',
        imageUrl: 'https://example.com/storyboard.png'
      });

      // 5. 최종 검증
      const validation = validateTwelveShotCollection(collection);
      expect(validation.isValid).toBe(true);

      const editedShot = collection.shots.find(shot => shot.id === firstShotId);
      expect(editedShot?.globalOrder).toBe(3);
      expect(editedShot?.title).toBe('편집된 제목');
      expect(editedShot?.storyboard.status).toBe('completed');
      expect(editedShot?.isUserEdited).toBe(true);
    });

    it('should maintain data integrity across multiple operations', () => {
      let collection = createTwelveShotCollection(mockStory, mockParams);

      // 여러 작업을 순차적으로 수행
      const operations = [
        () => updateTwelveShot(collection, collection.shots[0].id, { title: '제목1' }),
        () => updateTwelveShot(collection, collection.shots[1].id, { title: '제목2' }),
        () => updateTwelveShotOrder(collection, collection.shots[0].id, 5),
        () => updateShotStoryboard(collection, collection.shots[0].id, { status: 'completed' })
      ];

      for (const operation of operations) {
        collection = operation();

        // 각 작업 후 무결성 검증
        const validation = validateTwelveShotCollection(collection);
        expect(validation.errors.filter(e => e.includes('순서'))).toHaveLength(0);

        // 모든 샷이 여전히 존재하는지 확인
        expect(collection.shots).toHaveLength(12);

        // 순서가 1-12 범위에 있는지 확인
        const orders = collection.shots.map(shot => shot.globalOrder);
        expect(Math.min(...orders)).toBe(1);
        expect(Math.max(...orders)).toBe(12);
      }
    });
  });
});