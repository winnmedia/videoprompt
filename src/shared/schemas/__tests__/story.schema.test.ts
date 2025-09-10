import { describe, it, expect } from '@jest/globals';
import {
  StorySchema,
  CreateStoryRequestSchema,
  GetStoriesQuerySchema,
  DevelopShotsRequestSchema,
  storyValidators,
  validateStoryStructure,
  validateDevelopShotsRequest,
} from '../story.schema';

describe('Story Schema Tests', () => {
  describe('StorySchema', () => {
    it('유효한 스토리 데이터를 검증해야 함', () => {
      const validStory = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Story',
        oneLineStory: 'This is a test story about validation',
        genre: 'Drama',
        tone: 'Serious',
        target: 'Adults',
        structure: null,
        userId: '123e4567-e89b-12d3-a456-426614174001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = StorySchema.safeParse(validStory);
      expect(result.success).toBe(true);
    });

    it('잘못된 UUID를 거부해야 함', () => {
      const invalidStory = {
        id: 'invalid-uuid',
        title: 'Test Story',
        oneLineStory: 'This is a test story',
        genre: 'Drama',
        tone: 'Serious',
        target: 'Adults',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = StorySchema.safeParse(invalidStory);
      expect(result.success).toBe(false);
    });

    it('너무 긴 제목을 거부해야 함', () => {
      const longTitle = 'A'.repeat(201);
      const invalidStory = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: longTitle,
        oneLineStory: 'This is a test story',
        genre: 'Drama',
        tone: 'Serious',
        target: 'Adults',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = StorySchema.safeParse(invalidStory);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateStoryRequestSchema', () => {
    it('유효한 스토리 생성 요청을 검증해야 함', () => {
      const validRequest = {
        title: 'New Story',
        oneLineStory: 'A compelling story about data validation',
        genre: 'Comedy',
        tone: 'Lighthearted',
        target: 'Family',
      };

      const result = CreateStoryRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      expect(result.data?.genre).toBe('Comedy');
      expect(result.data?.tone).toBe('Lighthearted');
    });

    it('기본값을 적용해야 함', () => {
      const minimalRequest = {
        title: 'Minimal Story',
        oneLineStory: 'A story with default values',
      };

      const result = CreateStoryRequestSchema.safeParse(minimalRequest);
      expect(result.success).toBe(true);
      expect(result.data?.genre).toBe('Drama');
      expect(result.data?.tone).toBe('Neutral');
      expect(result.data?.target).toBe('General');
    });

    it('공백을 제거해야 함', () => {
      const requestWithSpaces = {
        title: '  Story with spaces  ',
        oneLineStory: '  Story description  ',
      };

      const result = CreateStoryRequestSchema.safeParse(requestWithSpaces);
      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Story with spaces');
      expect(result.data?.oneLineStory).toBe('Story description');
    });

    it('너무 짧은 한줄스토리를 거부해야 함', () => {
      const invalidRequest = {
        title: 'Short',
        oneLineStory: 'Too short',
      };

      const result = CreateStoryRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toContain('최소 10자');
    });
  });

  describe('GetStoriesQuerySchema', () => {
    it('유효한 쿼리 파라미터를 검증해야 함', () => {
      const validQuery = {
        page: '2',
        limit: '20',
        search: 'test',
        genre: 'Drama',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const result = GetStoriesQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
      expect(result.data?.page).toBe(2);
      expect(result.data?.limit).toBe(20);
    });

    it('기본값을 적용해야 함', () => {
      const emptyQuery = {};

      const result = GetStoriesQuerySchema.safeParse(emptyQuery);
      expect(result.success).toBe(true);
      expect(result.data?.page).toBe(1);
      expect(result.data?.limit).toBe(10);
      expect(result.data?.sortBy).toBe('updatedAt');
      expect(result.data?.sortOrder).toBe('desc');
    });

    it('잘못된 정렬 필드를 거부해야 함', () => {
      const invalidQuery = {
        sortBy: 'invalidField',
      };

      const result = GetStoriesQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it('한계 초과 페이지 크기를 거부해야 함', () => {
      const invalidQuery = {
        limit: '100',
      };

      const result = GetStoriesQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });
  });

  describe('DevelopShotsRequestSchema', () => {
    it('유효한 12샷 분해 요청을 검증해야 함', () => {
      const validRequest = {
        structure4: [
          { title: 'Act 1', summary: 'Beginning of the story' },
          { title: 'Act 2', summary: 'Development of conflict' },
          { title: 'Act 3', summary: 'Climax of the story' },
          { title: 'Act 4', summary: 'Resolution and ending' },
        ],
        genre: 'Action',
        tone: 'Intense',
      };

      const result = DevelopShotsRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('잘못된 구조 개수를 거부해야 함', () => {
      const invalidRequest = {
        structure4: [
          { title: 'Act 1', summary: 'Beginning' },
          { title: 'Act 2', summary: 'Middle' },
        ], // 2개만 제공
        genre: 'Drama',
        tone: 'Serious',
      };

      const result = DevelopShotsRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('빈 제목을 거부해야 함', () => {
      const invalidRequest = {
        structure4: [
          { title: '', summary: 'Beginning' },
          { title: 'Act 2', summary: 'Middle' },
          { title: 'Act 3', summary: 'Climax' },
          { title: 'Act 4', summary: 'End' },
        ],
        genre: 'Drama',
        tone: 'Serious',
      };

      const result = DevelopShotsRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('Story Validators', () => {
    describe('storyValidators', () => {
      it('title 검증이 작동해야 함', () => {
        expect(storyValidators.title('Valid Title')).toBeNull();
        expect(storyValidators.title('')).toContain('1 characters');
        expect(storyValidators.title('A'.repeat(201))).toContain('200 characters');
      });

      it('oneLineStory 검증이 작동해야 함', () => {
        expect(storyValidators.oneLineStory('Valid story description')).toBeNull();
        expect(storyValidators.oneLineStory('Short')).toContain('최소 10자');
        expect(storyValidators.oneLineStory('A'.repeat(501))).toContain('500자');
      });

      it('genre 검증이 작동해야 함', () => {
        expect(storyValidators.genre('Drama')).toBeNull();
        expect(storyValidators.genre('InvalidGenre')).toBe('유효하지 않은 장르입니다');
      });

      it('tone 검증이 작동해야 함', () => {
        expect(storyValidators.tone('Serious')).toBeNull();
        expect(storyValidators.tone('InvalidTone')).toBe('유효하지 않은 톤입니다');
      });

      it('target 검증이 작동해야 함', () => {
        expect(storyValidators.target('Adults')).toBeNull();
        expect(storyValidators.target('InvalidTarget')).toBe('유효하지 않은 타겟 대상입니다');
      });
    });

    describe('validateStoryStructure', () => {
      it('유효한 스토리 구조를 검증해야 함', () => {
        const validStructure = {
          act1: {
            title: 'Act 1',
            description: 'Beginning',
            key_elements: ['element1'],
            emotional_arc: 'calm to excited',
          },
          act2: {
            title: 'Act 2',
            description: 'Development',
            key_elements: ['element2'],
            emotional_arc: 'excited to tense',
          },
          act3: {
            title: 'Act 3',
            description: 'Climax',
            key_elements: ['element3'],
            emotional_arc: 'tense to peak',
          },
          act4: {
            title: 'Act 4',
            description: 'Resolution',
            key_elements: ['element4'],
            emotional_arc: 'peak to satisfied',
          },
        };

        expect(validateStoryStructure(validStructure)).toBeNull();
      });

      it('불완전한 구조를 거부해야 함', () => {
        const incompleteStructure = {
          act1: {
            title: 'Act 1',
            description: 'Beginning',
            key_elements: ['element1'],
            emotional_arc: 'calm to excited',
          },
          // act2, act3, act4 누락
        };

        expect(validateStoryStructure(incompleteStructure)).not.toBeNull();
      });
    });

    describe('validateDevelopShotsRequest', () => {
      it('유효한 요청을 검증해야 함', () => {
        const validRequest = {
          structure4: [
            { title: 'Act 1', summary: 'Beginning' },
            { title: 'Act 2', summary: 'Development' },
            { title: 'Act 3', summary: 'Climax' },
            { title: 'Act 4', summary: 'Resolution' },
          ],
          genre: 'Drama',
          tone: 'Serious',
        };

        expect(validateDevelopShotsRequest(validRequest)).toBeNull();
      });

      it('잘못된 요청을 거부해야 함', () => {
        const invalidRequest = {
          structure4: [
            { title: 'Act 1', summary: 'Beginning' },
            // 3개 누락
          ],
          genre: 'Drama',
          tone: 'Serious',
        };

        expect(validateDevelopShotsRequest(invalidRequest)).not.toBeNull();
      });
    });
  });
});