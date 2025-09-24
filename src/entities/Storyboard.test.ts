/**
 * Storyboard Entity Tests (TDD RED Phase)
 * 콘티(스토리보드) 관리 엔티티 테스트
 */

import {
  Storyboard,
  createStoryboard,
  updateStoryboardStatus,
  validateStoryboard,
  attachImageToStoryboard,
  setConsistencyParams,
} from './Storyboard';

describe('Storyboard Entity', () => {
  describe('createStoryboard', () => {
    it('should create a storyboard with required fields', () => {
      const projectId = 'project_123';
      const sceneId = 'scene_456';
      const shotId = 'shot_789';
      const prompt = '평화로운 마을 광장에서 주인공이 걸어가는 장면';
      const style = 'realistic';

      const storyboard = createStoryboard(
        projectId,
        sceneId,
        shotId,
        prompt,
        style
      );

      expect(storyboard).toMatchObject({
        projectId,
        sceneId,
        shotId,
        prompt,
        style,
        status: 'pending',
      });
      expect(storyboard.id).toMatch(/^storyboard_/);
      expect(storyboard.imageUrl).toBeUndefined();
      expect(storyboard.createdAt).toBeDefined();
      expect(storyboard.updatedAt).toBeDefined();
    });

    it('should create storyboards with different styles', () => {
      const styles: Array<'realistic' | 'anime' | 'sketch' | 'watercolor'> = [
        'realistic',
        'anime',
        'sketch',
        'watercolor',
      ];

      styles.forEach((style) => {
        const storyboard = createStoryboard(
          'project_123',
          'scene_456',
          'shot_789',
          '테스트 프롬프트 내용입니다',
          style
        );
        expect(storyboard.style).toBe(style);
      });
    });

    it('should throw error for empty projectId', () => {
      expect(() => {
        createStoryboard('', 'scene_456', 'shot_789', '프롬프트', 'realistic');
      }).toThrow('프로젝트 ID는 필수입니다');
    });

    it('should throw error for empty sceneId', () => {
      expect(() => {
        createStoryboard(
          'project_123',
          '',
          'shot_789',
          '프롬프트',
          'realistic'
        );
      }).toThrow('씬 ID는 필수입니다');
    });

    it('should throw error for empty shotId', () => {
      expect(() => {
        createStoryboard(
          'project_123',
          'scene_456',
          '',
          '프롬프트',
          'realistic'
        );
      }).toThrow('샷 ID는 필수입니다');
    });

    it('should throw error for empty prompt', () => {
      expect(() => {
        createStoryboard(
          'project_123',
          'scene_456',
          'shot_789',
          '',
          'realistic'
        );
      }).toThrow('프롬프트는 필수입니다');
    });

    it('should throw error for too short prompt', () => {
      expect(() => {
        createStoryboard(
          'project_123',
          'scene_456',
          'shot_789',
          '짧음',
          'realistic'
        );
      }).toThrow('프롬프트는 최소 10자 이상이어야 합니다');
    });
  });

  describe('updateStoryboardStatus', () => {
    let baseStoryboard: Storyboard;

    beforeEach(() => {
      baseStoryboard = createStoryboard(
        'project_123',
        'scene_456',
        'shot_789',
        '평화로운 마을 광장에서 주인공이 걸어가는 장면',
        'realistic'
      );
    });

    it('should update storyboard status from pending to generating', async () => {
      // 시간 차이를 보장하기 위해 5ms 대기
      await new Promise((resolve) => setTimeout(resolve, 5));

      const updatedStoryboard = updateStoryboardStatus(
        baseStoryboard,
        'generating'
      );

      expect(updatedStoryboard.status).toBe('generating');
      expect(updatedStoryboard.updatedAt).not.toBe(baseStoryboard.updatedAt);
    });

    it('should update storyboard status from generating to completed', () => {
      const generatingStoryboard = updateStoryboardStatus(
        baseStoryboard,
        'generating'
      );
      const completedStoryboard = updateStoryboardStatus(
        generatingStoryboard,
        'completed'
      );

      expect(completedStoryboard.status).toBe('completed');
    });

    it('should update storyboard status from generating to failed', () => {
      const generatingStoryboard = updateStoryboardStatus(
        baseStoryboard,
        'generating'
      );
      const failedStoryboard = updateStoryboardStatus(
        generatingStoryboard,
        'failed'
      );

      expect(failedStoryboard.status).toBe('failed');
    });

    it('should allow retry from failed to pending', () => {
      const generatingStoryboard = updateStoryboardStatus(
        baseStoryboard,
        'generating'
      );
      const failedStoryboard = updateStoryboardStatus(
        generatingStoryboard,
        'failed'
      );
      const retryStoryboard = updateStoryboardStatus(
        failedStoryboard,
        'pending'
      );

      expect(retryStoryboard.status).toBe('pending');
    });

    it('should not allow invalid status transitions', () => {
      expect(() => {
        updateStoryboardStatus(baseStoryboard, 'completed');
      }).toThrow('pending에서 completed로 직접 전환할 수 없습니다');
    });
  });

  describe('validateStoryboard', () => {
    it('should validate complete storyboard object', () => {
      const storyboard: Storyboard = {
        id: 'storyboard_123',
        projectId: 'project_456',
        sceneId: 'scene_789',
        shotId: 'shot_012',
        prompt: '아름다운 자연 풍경 속에서 캐릭터가 모험을 시작하는 장면',
        style: 'realistic',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validateStoryboard(storyboard);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for too short prompt', () => {
      const storyboardWithShortPrompt: Partial<Storyboard> = {
        id: 'storyboard_123',
        projectId: 'project_456',
        sceneId: 'scene_789',
        shotId: 'shot_012',
        prompt: '짧은글',
        style: 'realistic',
        status: 'pending',
      };

      const result = validateStoryboard(storyboardWithShortPrompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('프롬프트는 최소 10자 이상이어야 합니다');
    });

    it('should fail validation for too long prompt', () => {
      const storyboardWithLongPrompt: Partial<Storyboard> = {
        id: 'storyboard_123',
        projectId: 'project_456',
        sceneId: 'scene_789',
        shotId: 'shot_012',
        prompt: 'a'.repeat(501), // 501자
        style: 'realistic',
        status: 'pending',
      };

      const result = validateStoryboard(storyboardWithLongPrompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('프롬프트는 500자를 초과할 수 없습니다');
    });

    it('should fail validation for missing required fields', () => {
      const incompleteStoryboard: Partial<Storyboard> = {
        prompt: '적절한 길이의 프롬프트입니다.',
        style: 'realistic',
        // projectId, sceneId, shotId, status 누락
      };

      const result = validateStoryboard(incompleteStoryboard);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('프로젝트 ID는 필수입니다');
      expect(result.errors).toContain('씬 ID는 필수입니다');
      expect(result.errors).toContain('샷 ID는 필수입니다');
      expect(result.errors).toContain('상태는 필수입니다');
    });

    it('should fail validation for invalid style', () => {
      const storyboardWithInvalidStyle = {
        id: 'storyboard_123',
        projectId: 'project_456',
        sceneId: 'scene_789',
        shotId: 'shot_012',
        prompt: '적절한 길이의 프롬프트입니다.',
        style: 'invalid_style' as Storyboard['style'],
        status: 'pending' as Storyboard['status'],
      };

      const result = validateStoryboard(storyboardWithInvalidStyle);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('유효하지 않은 스타일입니다');
    });

    it('should fail validation for invalid status', () => {
      const storyboardWithInvalidStatus = {
        id: 'storyboard_123',
        projectId: 'project_456',
        sceneId: 'scene_789',
        shotId: 'shot_012',
        prompt: '적절한 길이의 프롬프트입니다.',
        style: 'realistic' as Storyboard['style'],
        status: 'invalid_status' as Storyboard['status'],
      };

      const result = validateStoryboard(storyboardWithInvalidStatus);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('유효하지 않은 상태입니다');
    });

    it('should validate completed storyboard must have image URL', () => {
      const completedStoryboardWithoutImage: Partial<Storyboard> = {
        id: 'storyboard_123',
        projectId: 'project_456',
        sceneId: 'scene_789',
        shotId: 'shot_012',
        prompt: '적절한 길이의 프롬프트입니다.',
        style: 'realistic',
        status: 'completed',
        // imageUrl 누락
      };

      const result = validateStoryboard(completedStoryboardWithoutImage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '완성된 스토리보드는 이미지 URL이 필요합니다'
      );
    });
  });

  describe('attachImageToStoryboard', () => {
    let baseStoryboard: Storyboard;

    beforeEach(() => {
      baseStoryboard = createStoryboard(
        'project_123',
        'scene_456',
        'shot_789',
        '평화로운 마을 광장에서 주인공이 걸어가는 장면',
        'realistic'
      );
    });

    it('should attach image URL to storyboard', async () => {
      // 시간 차이를 보장하기 위해 5ms 대기
      await new Promise((resolve) => setTimeout(resolve, 5));

      const imageUrl = 'https://example.com/storyboard/image123.jpg';
      const updatedStoryboard = attachImageToStoryboard(
        baseStoryboard,
        imageUrl
      );

      expect(updatedStoryboard.imageUrl).toBe(imageUrl);
      expect(updatedStoryboard.updatedAt).not.toBe(baseStoryboard.updatedAt);
    });

    it('should throw error for empty imageUrl', () => {
      expect(() => {
        attachImageToStoryboard(baseStoryboard, '');
      }).toThrow('이미지 URL은 필수입니다');
    });

    it('should throw error for invalid imageUrl format', () => {
      expect(() => {
        attachImageToStoryboard(baseStoryboard, 'invalid-url');
      }).toThrow('유효하지 않은 URL 형식입니다');
    });

    it('should allow replacing existing image URL', () => {
      const firstImageUrl = 'https://example.com/image1.jpg';
      const secondImageUrl = 'https://example.com/image2.jpg';

      const storyboardWithFirstImage = attachImageToStoryboard(
        baseStoryboard,
        firstImageUrl
      );
      const storyboardWithSecondImage = attachImageToStoryboard(
        storyboardWithFirstImage,
        secondImageUrl
      );

      expect(storyboardWithSecondImage.imageUrl).toBe(secondImageUrl);
    });
  });

  describe('setConsistencyParams', () => {
    let baseStoryboard: Storyboard;

    beforeEach(() => {
      baseStoryboard = createStoryboard(
        'project_123',
        'scene_456',
        'shot_789',
        '평화로운 마을 광장에서 주인공이 걸어가는 장면',
        'realistic'
      );
    });

    it('should set consistency parameters', async () => {
      // 시간 차이를 보장하기 위해 5ms 대기
      await new Promise((resolve) => setTimeout(resolve, 5));

      const consistencyParams = {
        characterRef: ['char_123', 'char_456'],
        styleRef: 'style_789',
        colorPalette: ['#FF5733', '#33C4FF', '#75FF33'],
      };

      const updatedStoryboard = setConsistencyParams(
        baseStoryboard,
        consistencyParams
      );

      expect(updatedStoryboard.consistency).toEqual(consistencyParams);
      expect(updatedStoryboard.updatedAt).not.toBe(baseStoryboard.updatedAt);
    });

    it('should allow partial consistency parameters', () => {
      const partialParams = {
        characterRef: ['char_123'],
      };

      const updatedStoryboard = setConsistencyParams(
        baseStoryboard,
        partialParams
      );

      expect(updatedStoryboard.consistency).toEqual(partialParams);
    });

    it('should throw error for empty characterRef array', () => {
      const invalidParams = {
        characterRef: [],
      };

      expect(() => {
        setConsistencyParams(baseStoryboard, invalidParams);
      }).toThrow('캐릭터 참조는 최소 1개 이상이어야 합니다');
    });

    it('should throw error for too many color palette entries', () => {
      const invalidParams = {
        colorPalette: [
          '#FF5733',
          '#33C4FF',
          '#75FF33',
          '#FF33A8',
          '#A833FF',
          '#33FFA8',
        ], // 6개 (최대 5개)
      };

      expect(() => {
        setConsistencyParams(baseStoryboard, invalidParams);
      }).toThrow('색상 팔레트는 최대 5개까지만 허용됩니다');
    });

    it('should throw error for invalid color format', () => {
      const invalidParams = {
        colorPalette: ['invalid-color'],
      };

      expect(() => {
        setConsistencyParams(baseStoryboard, invalidParams);
      }).toThrow('유효하지 않은 색상 형식입니다: invalid-color');
    });

    it('should replace existing consistency parameters', () => {
      const firstParams = { characterRef: ['char_123'] };
      const secondParams = { styleRef: 'style_456' };

      const storyboardWithFirst = setConsistencyParams(
        baseStoryboard,
        firstParams
      );
      const storyboardWithSecond = setConsistencyParams(
        storyboardWithFirst,
        secondParams
      );

      expect(storyboardWithSecond.consistency).toEqual(secondParams);
    });
  });
});
