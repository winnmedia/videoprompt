/**
 * Story Entity Tests
 * TDD 구현 - Red, Green, Refactor 패턴 준수
 */

import {
  createFourActStory,
  updateStoryAct,
  validateFourActStory,
  prepareForShotBreakdown,
  extractThumbnailPrompt,
  ACT_TEMPLATES,
  type StoryGenerationParams,
  type FourActStory
} from '../../entities/story';

describe('Story Entity', () => {
  // 테스트용 기본 파라미터
  const defaultParams: StoryGenerationParams = {
    title: '시간을 되돌리는 사진사',
    synopsis: '낡은 카메라를 발견한 사진사가 과거로 돌아가 인생의 중요한 순간들을 다시 경험하게 되는 이야기',
    genre: 'drama',
    targetAudience: 'adult',
    tone: 'dramatic',
    creativity: 70,
    intensity: 60,
    pacing: 'medium',
    keyCharacters: ['민수', '옛 연인'],
    keyThemes: ['후회', '성장', '시간'],
    specialRequirements: '감동적인 결말'
  };

  const userId = 'test-user-123';

  describe('createFourActStory', () => {
    it('should create a valid four-act story with all required fields', () => {
      const story = createFourActStory(defaultParams, userId);

      expect(story).toBeDefined();
      expect(story.id).toMatch(/^story_\d+$/);
      expect(story.title).toBe(defaultParams.title);
      expect(story.synopsis).toBe(defaultParams.synopsis);
      expect(story.genre).toBe(defaultParams.genre);
      expect(story.userId).toBe(userId);
      expect(story.status).toBe('draft');
      expect(story.aiGenerated).toBe(false);
    });

    it('should create four acts with correct structure', () => {
      const story = createFourActStory(defaultParams, userId);

      expect(Object.keys(story.acts)).toHaveLength(4);
      expect(story.acts.setup).toBeDefined();
      expect(story.acts.development).toBeDefined();
      expect(story.acts.climax).toBeDefined();
      expect(story.acts.resolution).toBeDefined();

      // 각 Act의 구조 검증
      Object.entries(story.acts).forEach(([actType, act], index) => {
        expect(act.actNumber).toBe(index + 1);
        expect(act.id).toMatch(new RegExp(`${story.id}_act_${index + 1}`));
        expect(act.title).toBe(ACT_TEMPLATES[actType as keyof typeof ACT_TEMPLATES].title);
        expect(act.content).toBe(''); // 초기에는 빈 내용
        expect(act.duration).toBeGreaterThan(0);
        expect(Array.isArray(act.keyEvents)).toBe(true);
        expect(Array.isArray(act.characterFocus)).toBe(true);
      });
    });

    it('should throw error for invalid title', () => {
      const invalidParams = { ...defaultParams, title: '' };
      expect(() => createFourActStory(invalidParams, userId)).toThrow('제목은 필수입니다');
    });

    it('should throw error for invalid synopsis', () => {
      const invalidParams = { ...defaultParams, synopsis: '' };
      expect(() => createFourActStory(invalidParams, userId)).toThrow('줄거리는 필수입니다');
    });

    it('should throw error for invalid creativity value', () => {
      const invalidParams = { ...defaultParams, creativity: 150 };
      expect(() => createFourActStory(invalidParams, userId)).toThrow('창의성 수치는 0-100 사이여야 합니다');
    });

    it('should throw error for invalid intensity value', () => {
      const invalidParams = { ...defaultParams, intensity: -10 };
      expect(() => createFourActStory(invalidParams, userId)).toThrow('강도 수치는 0-100 사이여야 합니다');
    });

    it('should set key characters in acts', () => {
      const story = createFourActStory(defaultParams, userId);

      Object.values(story.acts).forEach(act => {
        expect(act.characterFocus).toEqual(defaultParams.keyCharacters);
      });
    });

    it('should calculate total duration correctly', () => {
      const story = createFourActStory(defaultParams, userId);
      const expectedDuration = Object.values(story.acts).reduce((sum, act) => sum + act.duration, 0);

      expect(story.totalDuration).toBe(expectedDuration);
    });
  });

  describe('updateStoryAct', () => {
    let story: FourActStory;

    beforeEach(() => {
      story = createFourActStory(defaultParams, userId);
    });

    it('should update act content correctly', async () => {
      const newContent = '새로운 도입부 내용입니다.';

      // timestamp 차이를 확실히 하기 위해 1ms 대기
      await new Promise(resolve => setTimeout(resolve, 1));

      const updatedStory = updateStoryAct(story, 'setup', { content: newContent });

      expect(updatedStory.acts.setup.content).toBe(newContent);
      expect(updatedStory.acts.setup.id).toBe(story.acts.setup.id); // ID는 변경되지 않음
      expect(updatedStory.acts.setup.actNumber).toBe(1); // actNumber도 변경되지 않음
      expect(updatedStory.updatedAt).not.toBe(story.updatedAt); // 업데이트 시간은 변경됨
    });

    it('should update act title correctly', () => {
      const newTitle = '새로운 도입부 제목';
      const updatedStory = updateStoryAct(story, 'setup', { title: newTitle });

      expect(updatedStory.acts.setup.title).toBe(newTitle);
    });

    it('should update multiple act properties', () => {
      const updates = {
        content: '절정 부분의 새로운 내용',
        keyEvents: ['결정적 선택', '운명의 순간'],
        emotions: 'excitement' as const
      };

      const updatedStory = updateStoryAct(story, 'climax', updates);

      expect(updatedStory.acts.climax.content).toBe(updates.content);
      expect(updatedStory.acts.climax.keyEvents).toEqual(updates.keyEvents);
      expect(updatedStory.acts.climax.emotions).toBe(updates.emotions);
    });

    it('should not affect other acts when updating one act', () => {
      const originalSetup = { ...story.acts.setup };
      const updatedStory = updateStoryAct(story, 'development', { content: '새로운 전개' });

      expect(updatedStory.acts.setup).toEqual(originalSetup);
      expect(updatedStory.acts.climax).toEqual(story.acts.climax);
      expect(updatedStory.acts.resolution).toEqual(story.acts.resolution);
    });
  });

  describe('validateFourActStory', () => {
    let story: FourActStory;

    beforeEach(() => {
      story = createFourActStory(defaultParams, userId);
    });

    it('should return invalid for empty story content', () => {
      const validation = validateFourActStory(story);

      expect(validation.isValid).toBe(false);
      expect(validation.completionPercentage).toBeLessThan(70);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should return valid for complete story', () => {
      // 모든 Act 내용 채우기
      story.acts.setup.content = '도입부 내용을 충분히 작성했습니다. 주인공이 소개되고 배경이 설정됩니다.';
      story.acts.development.content = '전개부 내용을 충분히 작성했습니다. 갈등이 발생하고 복잡해집니다.';
      story.acts.climax.content = '절정부 내용을 충분히 작성했습니다. 가장 극적인 순간입니다.';
      story.acts.resolution.content = '결말부 내용을 충분히 작성했습니다. 모든 것이 해결됩니다.';

      // 주요 사건들 추가
      story.acts.setup.keyEvents = ['인물 소개', '배경 설정'];
      story.acts.development.keyEvents = ['갈등 발생', '복잡화'];
      story.acts.climax.keyEvents = ['결정적 순간'];
      story.acts.resolution.keyEvents = ['해결', '새로운 시작'];

      const validation = validateFourActStory(story);

      expect(validation.isValid).toBe(true);
      expect(validation.completionPercentage).toBeGreaterThanOrEqual(70);
      expect(validation.errors).toHaveLength(0);
    });

    it('should provide helpful suggestions', () => {
      const validation = validateFourActStory(story);

      expect(validation.suggestions.length).toBeGreaterThan(0);
      expect(validation.suggestions.some(s => s.includes('기본 구조'))).toBe(true);
    });

    it('should warn about short content', () => {
      story.acts.setup.content = '짧은 내용';
      const validation = validateFourActStory(story);

      expect(validation.suggestions.some(s => s.includes('구체적으로'))).toBe(true);
    });

    it('should suggest character development', () => {
      const validation = validateFourActStory(story);

      expect(validation.suggestions.some(s => s.includes('등장인물'))).toBe(true);
    });
  });

  describe('prepareForShotBreakdown', () => {
    let story: FourActStory;

    beforeEach(() => {
      story = createFourActStory(defaultParams, userId);
    });

    it('should prepare correct shot breakdown for medium pacing', () => {
      const breakdown = prepareForShotBreakdown(story);

      expect(breakdown.totalShots).toBe(12);
      expect(breakdown.actBreakdowns).toHaveLength(4);

      // Medium pacing: setup(3), development(4), climax(3), resolution(2)
      expect(breakdown.actBreakdowns[0].suggestedShots).toBe(3); // setup
      expect(breakdown.actBreakdowns[1].suggestedShots).toBe(4); // development
      expect(breakdown.actBreakdowns[2].suggestedShots).toBe(3); // climax
      expect(breakdown.actBreakdowns[3].suggestedShots).toBe(2); // resolution

      const totalSuggested = breakdown.actBreakdowns.reduce(
        (sum, act) => sum + act.suggestedShots,
        0
      );
      expect(totalSuggested).toBe(12);
    });

    it('should prepare correct shot breakdown for fast pacing', () => {
      const fastStory = {
        ...story,
        generationParams: { ...story.generationParams, pacing: 'fast' as const }
      };
      const breakdown = prepareForShotBreakdown(fastStory);

      // Fast pacing: setup(2), development(3), climax(4), resolution(3)
      expect(breakdown.actBreakdowns[0].suggestedShots).toBe(2);
      expect(breakdown.actBreakdowns[1].suggestedShots).toBe(3);
      expect(breakdown.actBreakdowns[2].suggestedShots).toBe(4);
      expect(breakdown.actBreakdowns[3].suggestedShots).toBe(3);
    });

    it('should prepare correct shot breakdown for slow pacing', () => {
      const slowStory = {
        ...story,
        generationParams: { ...story.generationParams, pacing: 'slow' as const }
      };
      const breakdown = prepareForShotBreakdown(slowStory);

      // Slow pacing: setup(4), development(4), climax(3), resolution(1)
      expect(breakdown.actBreakdowns[0].suggestedShots).toBe(4);
      expect(breakdown.actBreakdowns[1].suggestedShots).toBe(4);
      expect(breakdown.actBreakdowns[2].suggestedShots).toBe(3);
      expect(breakdown.actBreakdowns[3].suggestedShots).toBe(1);
    });
  });

  describe('extractThumbnailPrompt', () => {
    let story: FourActStory;

    beforeEach(() => {
      story = createFourActStory(defaultParams, userId);
      story.acts.setup.content = '평범한 사진사 민수는 골동품 가게에서 오래된 카메라를 발견한다. 카메라는 신비로운 힘을 가지고 있는 것 같다.';
      story.acts.setup.characterFocus = ['민수'];
      story.acts.setup.emotions = 'calm';
    });

    it('should generate proper thumbnail prompt', () => {
      const prompt = extractThumbnailPrompt(story.acts.setup, story);

      expect(prompt).toContain('drama genre');
      expect(prompt).toContain('dramatic tone');
      expect(prompt).toContain('민수');
      expect(prompt).toContain('calm atmosphere');
      expect(prompt).toContain('평범한 사진사 민수는 골동품 가게에서 오래된 카메라를 발견한다');
    });

    it('should handle empty character focus', () => {
      story.acts.setup.characterFocus = [];
      const prompt = extractThumbnailPrompt(story.acts.setup, story);

      expect(prompt).toContain('drama genre');
      expect(prompt).not.toContain('featuring');
    });

    it('should limit content length', () => {
      const longContent = 'a'.repeat(300);
      story.acts.setup.content = longContent;
      const prompt = extractThumbnailPrompt(story.acts.setup, story);

      // 최대 200자까지만 포함되어야 함
      expect(prompt.length).toBeLessThan(longContent.length + 100);
    });
  });

  describe('ACT_TEMPLATES', () => {
    it('should have all required act templates', () => {
      expect(ACT_TEMPLATES.setup).toBeDefined();
      expect(ACT_TEMPLATES.development).toBeDefined();
      expect(ACT_TEMPLATES.climax).toBeDefined();
      expect(ACT_TEMPLATES.resolution).toBeDefined();
    });

    it('should have consistent template structure', () => {
      Object.values(ACT_TEMPLATES).forEach(template => {
        expect(template.title).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.expectedDuration).toBeGreaterThan(0);
        expect(Array.isArray(template.keyElements)).toBe(true);
        expect(template.keyElements.length).toBeGreaterThan(0);
      });
    });

    it('should have reasonable duration expectations', () => {
      const totalDuration = Object.values(ACT_TEMPLATES).reduce(
        (sum, template) => sum + template.expectedDuration,
        0
      );

      // 전체 예상 시간이 5-6분 정도여야 함
      expect(totalDuration).toBeGreaterThan(300); // 5분
      expect(totalDuration).toBeLessThan(450); // 7.5분
    });
  });
});