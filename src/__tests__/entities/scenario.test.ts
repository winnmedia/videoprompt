/**
 * 시나리오 엔티티 테스트
 * TDD 구현: Red → Green → Refactor
 */

import {
  type Scenario,
  type ScenarioGenerationRequest,
  createScenarioId,
  getDefaultScenario,
  validateScenario,
  isScenarioValid,
  calculateScenarioProgress,
  GENRE_LABELS,
  STYLE_LABELS,
  TARGET_LABELS,
  STRUCTURE_LABELS,
  INTENSITY_LABELS,
  GENRE_OPTIONS,
  STYLE_OPTIONS,
  TARGET_OPTIONS,
  STRUCTURE_OPTIONS,
  INTENSITY_OPTIONS,
} from '../../entities/scenario';

describe('시나리오 엔티티', () => {
  describe('createScenarioId', () => {
    it('고유한 시나리오 ID를 생성해야 한다', () => {
      const id1 = createScenarioId();
      const id2 = createScenarioId();

      expect(id1).toMatch(/^scenario_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^scenario_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('getDefaultScenario', () => {
    it('기본 시나리오 구조를 반환해야 한다', () => {
      const defaultScenario = getDefaultScenario();

      expect(defaultScenario).toEqual({
        title: '',
        content: '',
        userId: '',
        status: 'draft',
        metadata: {
          genre: 'drama',
          style: 'realistic',
          target: 'general',
          structure: 'traditional',
          intensity: 'medium',
          estimatedDuration: 10,
          qualityScore: 0,
          tokens: 0,
          cost: 0,
        },
      });
    });
  });

  describe('validateScenario', () => {
    it('유효한 시나리오는 에러가 없어야 한다', () => {
      const validScenario: Partial<Scenario> = {
        title: '테스트 시나리오',
        content: '이것은 50자 이상의 유효한 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.',
      };

      const errors = validateScenario(validScenario);
      expect(errors).toEqual([]);
    });

    it('제목이 없으면 에러를 반환해야 한다', () => {
      const scenario: Partial<Scenario> = {
        title: '',
        content: '이것은 50자 이상의 유효한 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.',
      };

      const errors = validateScenario(scenario);
      expect(errors).toContain('시나리오 제목은 필수입니다.');
    });

    it('내용이 없으면 에러를 반환해야 한다', () => {
      const scenario: Partial<Scenario> = {
        title: '테스트 시나리오',
        content: '',
      };

      const errors = validateScenario(scenario);
      expect(errors).toContain('시나리오 내용은 필수입니다.');
    });

    it('제목이 100자를 초과하면 에러를 반환해야 한다', () => {
      const scenario: Partial<Scenario> = {
        title: 'a'.repeat(101),
        content: '이것은 50자 이상의 유효한 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.',
      };

      const errors = validateScenario(scenario);
      expect(errors).toContain('제목은 100자를 초과할 수 없습니다.');
    });

    it('내용이 50자 미만이면 에러를 반환해야 한다', () => {
      const scenario: Partial<Scenario> = {
        title: '테스트 시나리오',
        content: '짧은 내용',
      };

      const errors = validateScenario(scenario);
      expect(errors).toContain('내용은 최소 50자 이상이어야 합니다.');
    });

    it('내용이 5000자를 초과하면 에러를 반환해야 한다', () => {
      const scenario: Partial<Scenario> = {
        title: '테스트 시나리오',
        content: 'a'.repeat(5001),
      };

      const errors = validateScenario(scenario);
      expect(errors).toContain('내용은 5000자를 초과할 수 없습니다.');
    });

    it('여러 에러가 있으면 모든 에러를 반환해야 한다', () => {
      const scenario: Partial<Scenario> = {
        title: '',
        content: '',
      };

      const errors = validateScenario(scenario);
      expect(errors).toHaveLength(2);
      expect(errors).toContain('시나리오 제목은 필수입니다.');
      expect(errors).toContain('시나리오 내용은 필수입니다.');
    });
  });

  describe('isScenarioValid', () => {
    it('유효한 시나리오는 true를 반환해야 한다', () => {
      const validScenario: Partial<Scenario> = {
        title: '테스트 시나리오',
        content: '이것은 50자 이상의 유효한 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.',
      };

      expect(isScenarioValid(validScenario)).toBe(true);
    });

    it('유효하지 않은 시나리오는 false를 반환해야 한다', () => {
      const invalidScenario: Partial<Scenario> = {
        title: '',
        content: '',
      };

      expect(isScenarioValid(invalidScenario)).toBe(false);
    });
  });

  describe('calculateScenarioProgress', () => {
    it('빈 시나리오는 0% 진행률을 반환해야 한다', () => {
      const emptyScenario: Partial<Scenario> = {
        title: '',
        content: '',
      };

      const progress = calculateScenarioProgress(emptyScenario);
      expect(progress).toBe(0);
    });

    it('제목만 있으면 20% 진행률을 반환해야 한다', () => {
      const scenario: Partial<Scenario> = {
        title: '테스트 시나리오',
        content: '',
      };

      const progress = calculateScenarioProgress(scenario);
      expect(progress).toBe(20);
    });

    it('제목과 내용이 있으면 50% 진행률을 반환해야 한다', () => {
      const scenario: Partial<Scenario> = {
        title: '테스트 시나리오',
        content: '테스트 내용',
      };

      const progress = calculateScenarioProgress(scenario);
      expect(progress).toBe(50);
    });

    it('모든 메타데이터가 있으면 100% 진행률을 반환해야 한다', () => {
      const scenario: Partial<Scenario> = {
        title: '테스트 시나리오',
        content: '테스트 내용',
        metadata: {
          genre: 'drama',
          style: 'realistic',
          target: 'general',
          structure: 'traditional',
          intensity: 'medium',
          estimatedDuration: 10,
          qualityScore: 0,
          tokens: 0,
          cost: 0,
        },
      };

      const progress = calculateScenarioProgress(scenario);
      expect(progress).toBe(100);
    });

    it('진행률은 100%를 초과하지 않아야 한다', () => {
      const scenario: Partial<Scenario> = {
        title: '테스트 시나리오',
        content: '테스트 내용',
        metadata: {
          genre: 'drama',
          style: 'realistic',
          target: 'general',
          structure: 'traditional',
          intensity: 'medium',
          estimatedDuration: 10,
          qualityScore: 0,
          tokens: 0,
          cost: 0,
        },
      };

      const progress = calculateScenarioProgress(scenario);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  describe('라벨 상수', () => {
    it('모든 장르 라벨이 정의되어 있어야 한다', () => {
      expect(GENRE_LABELS.drama).toBe('드라마');
      expect(GENRE_LABELS.comedy).toBe('코미디');
      expect(GENRE_LABELS.romance).toBe('로맨스');
      expect(GENRE_LABELS.thriller).toBe('스릴러');
      expect(GENRE_LABELS.horror).toBe('호러');
      expect(GENRE_LABELS.fantasy).toBe('판타지');
      expect(GENRE_LABELS['sci-fi']).toBe('SF');
      expect(GENRE_LABELS.action).toBe('액션');
      expect(GENRE_LABELS.mystery).toBe('미스터리');
      expect(GENRE_LABELS['slice-of-life']).toBe('일상');
      expect(GENRE_LABELS.documentary).toBe('다큐멘터리');
      expect(GENRE_LABELS.animation).toBe('애니메이션');
    });

    it('모든 스타일 라벨이 정의되어 있어야 한다', () => {
      expect(STYLE_LABELS.realistic).toBe('현실적');
      expect(STYLE_LABELS.stylized).toBe('양식화된');
      expect(STYLE_LABELS.minimalist).toBe('미니멀');
      expect(STYLE_LABELS.dramatic).toBe('극적');
      expect(STYLE_LABELS.comedic).toBe('코믹');
      expect(STYLE_LABELS.poetic).toBe('시적');
    });

    it('모든 타겟 라벨이 정의되어 있어야 한다', () => {
      expect(TARGET_LABELS.children).toBe('어린이 (7-12세)');
      expect(TARGET_LABELS.teens).toBe('청소년 (13-19세)');
      expect(TARGET_LABELS['young-adults']).toBe('청년 (20-35세)');
      expect(TARGET_LABELS.adults).toBe('성인 (36-55세)');
      expect(TARGET_LABELS.seniors).toBe('시니어 (55세+)');
      expect(TARGET_LABELS.family).toBe('가족');
      expect(TARGET_LABELS.general).toBe('일반');
    });

    it('모든 구조 라벨이 정의되어 있어야 한다', () => {
      expect(STRUCTURE_LABELS.traditional).toBe('기승전결 (4단계)');
      expect(STRUCTURE_LABELS['three-act']).toBe('3막 구조');
      expect(STRUCTURE_LABELS['free-form']).toBe('자유형');
      expect(STRUCTURE_LABELS.episodic).toBe('에피소드형');
    });

    it('모든 강도 라벨이 정의되어 있어야 한다', () => {
      expect(INTENSITY_LABELS.low).toBe('약함 (잔잔한)');
      expect(INTENSITY_LABELS.medium).toBe('보통 (적당한)');
      expect(INTENSITY_LABELS.high).toBe('강함 (강렬한)');
    });
  });

  describe('옵션 배열', () => {
    it('장르 옵션이 올바른 구조를 가져야 한다', () => {
      expect(Array.isArray(GENRE_OPTIONS)).toBe(true);
      expect(GENRE_OPTIONS.length).toBeGreaterThan(0);

      GENRE_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
      });
    });

    it('스타일 옵션이 올바른 구조를 가져야 한다', () => {
      expect(Array.isArray(STYLE_OPTIONS)).toBe(true);
      expect(STYLE_OPTIONS.length).toBeGreaterThan(0);

      STYLE_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
      });
    });

    it('타겟 옵션이 올바른 구조를 가져야 한다', () => {
      expect(Array.isArray(TARGET_OPTIONS)).toBe(true);
      expect(TARGET_OPTIONS.length).toBeGreaterThan(0);

      TARGET_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
      });
    });

    it('구조 옵션이 올바른 구조를 가져야 한다', () => {
      expect(Array.isArray(STRUCTURE_OPTIONS)).toBe(true);
      expect(STRUCTURE_OPTIONS.length).toBeGreaterThan(0);

      STRUCTURE_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
      });
    });

    it('강도 옵션이 올바른 구조를 가져야 한다', () => {
      expect(Array.isArray(INTENSITY_OPTIONS)).toBe(true);
      expect(INTENSITY_OPTIONS).toHaveLength(3);

      INTENSITY_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
      });
    });
  });

  describe('시나리오 타입', () => {
    it('ScenarioGenerationRequest 타입이 올바른 구조를 가져야 한다', () => {
      const request: ScenarioGenerationRequest = {
        title: '테스트 시나리오',
        content: '테스트 내용',
        genre: 'drama',
        style: 'realistic',
        target: 'general',
        structure: 'traditional',
        intensity: 'medium',
      };

      expect(request.title).toBe('테스트 시나리오');
      expect(request.content).toBe('테스트 내용');
      expect(request.genre).toBe('drama');
      expect(request.style).toBe('realistic');
      expect(request.target).toBe('general');
      expect(request.structure).toBe('traditional');
      expect(request.intensity).toBe('medium');
    });
  });
});