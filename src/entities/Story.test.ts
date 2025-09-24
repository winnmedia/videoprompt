/**
 * Story Entity Tests (TDD RED Phase)
 * 실패하는 테스트부터 작성
 */

import {
  Story,
  createStory,
  updateStoryStatus,
  validateStory,
  addSceneToStory,
} from './Story';

describe('Story Entity', () => {
  describe('createStory', () => {
    it('should create a story with required fields', () => {
      const title = '영웅의 여정';
      const synopsis = '평범한 청년이 모험을 통해 성장하는 이야기';
      const genre = 'drama';
      const userId = 'user_123';

      const story = createStory(title, synopsis, genre, userId);

      expect(story).toMatchObject({
        title,
        synopsis,
        genre,
        userId,
        status: 'draft',
        scenes: [],
      });
      expect(story.id).toMatch(/^story_/);
      expect(story.createdAt).toBeDefined();
      expect(story.updatedAt).toBeDefined();
    });

    it('should create different story genres', () => {
      const genres: Array<
        'drama' | 'action' | 'comedy' | 'documentary' | 'educational'
      > = ['drama', 'action', 'comedy', 'documentary', 'educational'];

      genres.forEach((genre) => {
        const story = createStory('테스트', '설명', genre, 'user_123');
        expect(story.genre).toBe(genre);
      });
    });

    it('should throw error for empty title', () => {
      expect(() => {
        createStory('', '설명', 'drama', 'user_123');
      }).toThrow('제목은 필수입니다');
    });

    it('should throw error for empty synopsis', () => {
      expect(() => {
        createStory('제목', '', 'drama', 'user_123');
      }).toThrow('줄거리는 필수입니다');
    });
  });

  describe('updateStoryStatus', () => {
    let baseStory: Story;

    beforeEach(() => {
      baseStory = createStory('테스트', '설명', 'drama', 'user_123');
    });

    it('should update story status from draft to inProgress', async () => {
      // 시간 차이를 보장하기 위해 5ms 대기
      await new Promise((resolve) => setTimeout(resolve, 5));

      const updatedStory = updateStoryStatus(baseStory, 'inProgress');

      expect(updatedStory.status).toBe('inProgress');
      expect(updatedStory.updatedAt).not.toBe(baseStory.updatedAt);
    });

    it('should update story status from inProgress to completed', () => {
      const workingStory = updateStoryStatus(baseStory, 'inProgress');
      const completedStory = updateStoryStatus(workingStory, 'completed');

      expect(completedStory.status).toBe('completed');
    });

    it('should allow reverting from inProgress back to draft', () => {
      const workingStory = updateStoryStatus(baseStory, 'inProgress');
      const draftStory = updateStoryStatus(workingStory, 'draft');

      expect(draftStory.status).toBe('draft');
    });

    it('should not allow direct transition from draft to completed', () => {
      expect(() => {
        updateStoryStatus(baseStory, 'completed');
      }).toThrow('draft에서 completed로 직접 전환할 수 없습니다');
    });
  });

  describe('validateStory', () => {
    it('should validate complete story object', () => {
      const story: Story = {
        id: 'story_123',
        title: '좋은 제목',
        synopsis: '충분히 긴 줄거리입니다. 최소 20자 이상이어야 합니다.',
        genre: 'drama',
        status: 'draft',
        userId: 'user_123',
        scenes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validateStory(story);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for too short synopsis', () => {
      const storyWithShortSynopsis: Partial<Story> = {
        id: 'story_123',
        title: '제목',
        synopsis: '짧음',
        genre: 'drama',
        status: 'draft',
        userId: 'user_123',
      };

      const result = validateStory(storyWithShortSynopsis);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('줄거리는 최소 20자 이상이어야 합니다');
    });

    it('should fail validation for too long title', () => {
      const storyWithLongTitle: Partial<Story> = {
        id: 'story_123',
        title: 'a'.repeat(101), // 101자
        synopsis: '충분히 긴 줄거리입니다. 최소 20자 이상이어야 합니다.',
        genre: 'drama',
        status: 'draft',
        userId: 'user_123',
      };

      const result = validateStory(storyWithLongTitle);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('제목은 100자를 초과할 수 없습니다');
    });

    it('should fail validation for missing required fields', () => {
      const incompleteStory: Partial<Story> = {
        title: '제목',
        // synopsis 누락
        genre: 'drama',
        status: 'draft',
      };

      const result = validateStory(incompleteStory);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('줄거리는 필수입니다');
    });

    it('should fail validation for missing title', () => {
      const storyWithoutTitle: Partial<Story> = {
        id: 'story_123',
        synopsis: '충분히 긴 줄거리입니다. 최소 20자 이상이어야 합니다.',
        genre: 'drama',
        status: 'draft',
        userId: 'user_123',
      };

      const result = validateStory(storyWithoutTitle);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('제목은 필수입니다');
    });

    it('should fail validation for missing genre', () => {
      const storyWithoutGenre: Partial<Story> = {
        id: 'story_123',
        title: '제목',
        synopsis: '충분히 긴 줄거리입니다. 최소 20자 이상이어야 합니다.',
        status: 'draft',
        userId: 'user_123',
      };

      const result = validateStory(storyWithoutGenre);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('장르는 필수입니다');
    });

    it('should fail validation for missing status', () => {
      const storyWithoutStatus: Partial<Story> = {
        id: 'story_123',
        title: '제목',
        synopsis: '충분히 긴 줄거리입니다. 최소 20자 이상이어야 합니다.',
        genre: 'drama',
        userId: 'user_123',
      };

      const result = validateStory(storyWithoutStatus);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('상태는 필수입니다');
    });
  });

  describe('addSceneToStory', () => {
    let baseStory: Story;

    beforeEach(() => {
      baseStory = createStory(
        '테스트',
        '충분히 긴 줄거리입니다. 최소 20자 이상이어야 합니다.',
        'drama',
        'user_123'
      );
    });

    it('should add scene to story', async () => {
      // 시간 차이를 보장하기 위해 5ms 대기
      await new Promise((resolve) => setTimeout(resolve, 5));

      const sceneId = 'scene_456';
      const updatedStory = addSceneToStory(baseStory, sceneId);

      expect(updatedStory.scenes).toContain(sceneId);
      expect(updatedStory.scenes).toHaveLength(1);
      expect(updatedStory.updatedAt).not.toBe(baseStory.updatedAt);
    });

    it('should not add duplicate scene', () => {
      const sceneId = 'scene_456';
      const storyWithScene = addSceneToStory(baseStory, sceneId);

      expect(() => {
        addSceneToStory(storyWithScene, sceneId);
      }).toThrow('씬이 이미 스토리에 추가되어 있습니다');
    });

    it('should maintain scene order', () => {
      const scene1 = 'scene_1';
      const scene2 = 'scene_2';
      const scene3 = 'scene_3';

      let story = addSceneToStory(baseStory, scene1);
      story = addSceneToStory(story, scene2);
      story = addSceneToStory(story, scene3);

      expect(story.scenes).toEqual([scene1, scene2, scene3]);
    });

    it('should not allow more than 4 scenes (4-stage structure)', () => {
      let story = baseStory;

      // 4개까지는 정상 추가
      story = addSceneToStory(story, 'scene_1'); // 도입
      story = addSceneToStory(story, 'scene_2'); // 전개
      story = addSceneToStory(story, 'scene_3'); // 절정
      story = addSceneToStory(story, 'scene_4'); // 결말

      // 5번째 추가 시 에러
      expect(() => {
        addSceneToStory(story, 'scene_5');
      }).toThrow('스토리는 최대 4개의 씬만 가질 수 있습니다 (4단계 구조)');
    });
  });

  describe('4-stage story structure validation', () => {
    it('should validate story has exactly 4 scenes for completion', () => {
      const story: Story = {
        id: 'story_123',
        title: '완성된 스토리',
        synopsis: '4단계 구조를 갖춘 완성된 스토리입니다.',
        genre: 'drama',
        status: 'completed',
        userId: 'user_123',
        scenes: ['scene_1', 'scene_2', 'scene_3'], // 3개만 (부족)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validateStory(story);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '완성된 스토리는 정확히 4개의 씬이 필요합니다 (도입/전개/절정/결말)'
      );
    });

    it('should allow draft and inProgress stories with incomplete scenes', () => {
      const draftStory: Story = {
        id: 'story_123',
        title: '초안 스토리',
        synopsis:
          '아직 작업 중인 초안 스토리입니다. 최소 20자를 맞추기 위한 설명입니다.',
        genre: 'drama',
        status: 'draft',
        userId: 'user_123',
        scenes: ['scene_1'], // 1개만 있어도 OK
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validateStory(draftStory);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate completed story with exactly 4 scenes', () => {
      const completedStory: Story = {
        id: 'story_123',
        title: '완성된 스토리',
        synopsis: '4단계 구조를 갖춘 완성된 스토리입니다.',
        genre: 'drama',
        status: 'completed',
        userId: 'user_123',
        scenes: ['scene_1', 'scene_2', 'scene_3', 'scene_4'], // 정확히 4개
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validateStory(completedStory);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
