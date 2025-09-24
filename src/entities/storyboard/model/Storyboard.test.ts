/**
 * Storyboard Entity Tests
 * TDD 원칙에 따른 스토리보드 엔티티 테스트
 */

import {
  Storyboard,
  StoryboardPanel,
  createStoryboard,
  addPanel,
  updatePanel,
  removePanel,
  reorderPanels,
  validateStoryboard,
  generateImagePrompt,
} from './Storyboard';

describe('Storyboard Entity', () => {
  const mockPanel: StoryboardPanel = {
    id: 'panel-1',
    sceneId: 'scene-1',
    imageUrl: 'https://example.com/panel1.jpg',
    imagePrompt: '제주도 공항에서 여행객이 도착하는 모습',
    duration: 30,
    order: 1,
    visualDescription: '밝은 공항 로비, 여행 가방을 든 주인공',
    cameraAngle: '미디엄 샷',
    lighting: '자연광',
  };

  const mockStoryboard: Storyboard = {
    id: 'storyboard-1',
    scenarioId: 'scenario-1',
    title: '제주도 여행 스토리보드',
    description: '제주도 여행 영상을 위한 시각적 계획',
    panels: [mockPanel],
    totalDuration: 30,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    status: 'draft',
  };

  describe('createStoryboard', () => {
    it('새로운 스토리보드를 생성한다', () => {
      const storyboard = createStoryboard(
        'scenario-1',
        '제주도 여행',
        '제주도 여행 스토리보드'
      );

      expect(storyboard.id).toBeDefined();
      expect(storyboard.scenarioId).toBe('scenario-1');
      expect(storyboard.title).toBe('제주도 여행');
      expect(storyboard.description).toBe('제주도 여행 스토리보드');
      expect(storyboard.panels).toEqual([]);
      expect(storyboard.status).toBe('draft');
      expect(storyboard.totalDuration).toBe(0);
    });

    it('필수 항목이 비어있으면 오류를 던진다', () => {
      expect(() => createStoryboard('', '제목', '설명')).toThrow(
        '시나리오 ID는 필수입니다'
      );
      expect(() => createStoryboard('scenario-1', '', '설명')).toThrow(
        '제목은 필수입니다'
      );
      expect(() => createStoryboard('scenario-1', '제목', '')).toThrow(
        '설명은 필수입니다'
      );
    });
  });

  describe('addPanel', () => {
    it('스토리보드에 새 패널을 추가한다', () => {
      const newPanelData: Omit<StoryboardPanel, 'id' | 'order'> = {
        sceneId: 'scene-2',
        imageUrl: 'https://example.com/panel2.jpg',
        imagePrompt: '맛집에서 음식을 먹는 모습',
        duration: 45,
        visualDescription: '따뜻한 식당 내부, 맛있는 음식',
        cameraAngle: '클로즈업',
        lighting: '실내 조명',
      };

      const updated = addPanel(mockStoryboard, newPanelData);

      expect(updated.panels).toHaveLength(2);
      expect(updated.panels[1].sceneId).toBe('scene-2');
      expect(updated.panels[1].order).toBe(2);
      expect(updated.totalDuration).toBe(75); // 30 + 45
    });
  });

  describe('validateStoryboard', () => {
    it('유효한 스토리보드는 검증을 통과한다', () => {
      const result = validateStoryboard(mockStoryboard);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('패널이 없는 스토리보드는 검증에 실패한다', () => {
      const emptyStoryboard = { ...mockStoryboard, panels: [] };
      const result = validateStoryboard(emptyStoryboard);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('최소 1개의 패널이 필요합니다');
    });

    it('이미지 프롬프트가 없는 패널이 있으면 경고를 포함한다', () => {
      const panelWithoutPrompt = { ...mockPanel, imagePrompt: '' };
      const storyboardWithIncompletePanel = {
        ...mockStoryboard,
        panels: [panelWithoutPrompt],
      };
      const result = validateStoryboard(storyboardWithIncompletePanel);
      expect(result.warnings).toContain(
        '일부 패널에 이미지 프롬프트가 누락되었습니다'
      );
    });
  });

  describe('generateImagePrompt', () => {
    it('씬 정보를 기반으로 이미지 프롬프트를 생성한다', () => {
      const sceneInfo = {
        title: '오프닝',
        description: '제주도 공항 도착',
        type: '기' as const,
        content: '주인공이 공항에 도착하여 설레는 마음을 표현',
      };

      const prompt = generateImagePrompt(sceneInfo, '미디엄 샷', '자연광');

      expect(prompt).toContain('제주도 공항');
      expect(prompt).toContain('미디엄 샷');
      expect(prompt).toContain('자연광');
      expect(prompt).toContain('설레는');
    });

    it('카메라 앵글과 조명 정보가 없으면 기본값을 사용한다', () => {
      const sceneInfo = {
        title: '오프닝',
        description: '제주도 공항 도착',
        type: '기' as const,
        content: '주인공이 공항에 도착하여 설레는 마음을 표현',
      };

      const prompt = generateImagePrompt(sceneInfo);

      expect(prompt).toContain('제주도 공항');
      expect(prompt).toContain('미디엄 샷'); // 기본값
      expect(prompt).toContain('자연스러운 조명'); // 기본값
    });
  });

  describe('updatePanel', () => {
    it('패널 정보를 업데이트한다', () => {
      const updates = {
        imagePrompt: '업데이트된 프롬프트',
        duration: 60,
      };

      const updated = updatePanel(mockStoryboard, 'panel-1', updates);

      expect(updated.panels[0].imagePrompt).toBe('업데이트된 프롬프트');
      expect(updated.panels[0].duration).toBe(60);
      expect(updated.totalDuration).toBe(60);
    });

    it('존재하지 않는 패널 업데이트 시 오류를 던진다', () => {
      expect(() => updatePanel(mockStoryboard, 'nonexistent', {})).toThrow(
        '패널을 찾을 수 없습니다'
      );
    });
  });

  describe('removePanel', () => {
    it('패널을 제거하고 순서를 재정렬한다', () => {
      const twoPanel = addPanel(mockStoryboard, {
        sceneId: 'scene-2',
        imageUrl: 'url2',
        imagePrompt: 'prompt2',
        duration: 45,
        visualDescription: 'desc2',
        cameraAngle: '클로즈업',
        lighting: '실내 조명',
      });

      const updated = removePanel(twoPanel, 'panel-1');

      expect(updated.panels).toHaveLength(1);
      expect(updated.panels[0].order).toBe(1);
      expect(updated.totalDuration).toBe(45);
    });
  });

  describe('reorderPanels', () => {
    it('패널 순서를 변경한다', () => {
      const twoPanel = addPanel(mockStoryboard, {
        sceneId: 'scene-2',
        imageUrl: 'url2',
        imagePrompt: 'prompt2',
        duration: 45,
        visualDescription: 'desc2',
        cameraAngle: '클로즈업',
        lighting: '실내 조명',
      });

      // 두 번째 패널을 첫 번째로 이동
      const secondPanelId = twoPanel.panels[1].id;
      const reordered = reorderPanels(twoPanel, secondPanelId, 1);

      expect(reordered.panels[0].sceneId).toBe('scene-2');
      expect(reordered.panels[0].order).toBe(1);
      expect(reordered.panels[1].sceneId).toBe('scene-1');
      expect(reordered.panels[1].order).toBe(2);
    });

    it('존재하지 않는 패널 순서 변경 시 오류를 던진다', () => {
      expect(() => reorderPanels(mockStoryboard, 'nonexistent', 1)).toThrow(
        '패널을 찾을 수 없습니다'
      );
    });
  });
});
