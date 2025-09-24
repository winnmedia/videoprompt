/**
 * 일관성 관리자 TDD 테스트
 *
 * 테스트 범위:
 * - 일관성 특징 추출 및 분석
 * - 프롬프트에 일관성 적용
 * - 가중치 기반 일관성 제어
 * - 스타일별 특징 강화
 * - 일관성 점수 계산
 * - 설정 관리 및 업데이트
 */

// Jest globals are available by default
import { getConsistencyManager, ConsistencyManager } from '@/shared/lib/consistency-manager';
import { createTestConsistencyFeatures } from '@/shared/mocks/data/storyboard-test-data';

describe('일관성 관리자 (ConsistencyManager)', () => {
  let consistencyManager: ConsistencyManager;

  beforeEach(() => {
    // 각 테스트 전에 새로운 인스턴스 생성
    consistencyManager = getConsistencyManager();
  });

  afterEach(() => {
    // 테스트 후 정리
    // 실제 구현에서는 상태 리셋 메서드 필요
  });

  describe('초기화 및 설정', () => {
    it('기본 설정으로 올바르게 초기화되어야 함', () => {
      // When: 일관성 관리자를 생성함
      const manager = new ConsistencyManager();

      // Then: 기본 설정이 적용되어야 함
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(ConsistencyManager);
    });

    it('커스텀 설정으로 초기화할 수 있어야 함', () => {
      // Given: 커스텀 설정
      const customConfig = {
        weights: {
          characters: 0.9,
          locations: 0.5,
          objects: 0.6,
          style: 0.8,
          composition: 0.4,
        },
        adaptationStrength: 0.9,
      };

      // When: 커스텀 설정으로 관리자를 생성함
      const manager = new ConsistencyManager(customConfig);

      // Then: 관리자가 정상적으로 생성되어야 함
      expect(manager).toBeDefined();
    });

    it('잘못된 설정에 대해 검증 에러를 발생시켜야 함', () => {
      // Given: 잘못된 설정 (가중치가 범위를 벗어남)
      const invalidConfig = {
        weights: {
          characters: 1.5, // 1.0 초과
          locations: -0.1, // 0.0 미만
        },
      };

      // When & Then: 설정 검증 에러가 발생해야 함
      expect(() => new ConsistencyManager(invalidConfig as any)).toThrow();
    });
  });

  describe('일관성 특징 추출', () => {
    it('이미지와 프롬프트에서 특징을 성공적으로 추출해야 함', async () => {
      // Given: 유효한 이미지 URL과 프롬프트
      const imageUrl = 'https://mock-seedream-api.com/images/test_image.png';
      const prompt = 'A young protagonist walking through a traditional village with stone houses';
      const style = 'pencil';

      // When: 특징 추출을 요청함
      const features = await consistencyManager.extractFeatures(imageUrl, prompt, style);

      // Then: 특징이 올바르게 추출되어야 함
      expect(features).toBeDefined();
      expect(features.characters).toBeDefined();
      expect(features.locations).toBeDefined();
      expect(features.objects).toBeDefined();
      expect(features.style).toBeDefined();
      expect(features.composition).toBeDefined();

      // 신뢰도 검증
      expect(features.confidence).toBeGreaterThan(0);
      expect(features.confidence).toBeLessThanOrEqual(1);

      // 날짜 필드 검증
      expect(features.extractedAt).toBeDefined();
      expect(new Date(features.extractedAt)).toBeInstanceOf(Date);
    });

    it('캐릭터 키워드가 포함된 프롬프트에서 캐릭터를 감지해야 함', async () => {
      // Given: 캐릭터가 명시된 프롬프트
      const prompt = 'A brave young woman with brown hair stands in front of a castle';
      const imageUrl = 'https://mock-seedream-api.com/images/character_test.png';

      // When: 특징을 추출함
      const features = await consistencyManager.extractFeatures(imageUrl, prompt, 'pencil');

      // Then: 캐릭터가 감지되어야 함
      expect(features.characters.length).toBeGreaterThan(0);
      const character = features.characters[0];
      expect(character.name).toBeDefined();
      expect(character.visualFeatures).toBeDefined();
      expect(character.importance).toBeGreaterThan(0);
    });

    it('위치 키워드가 포함된 프롬프트에서 위치를 감지해야 함', async () => {
      // Given: 위치가 명시된 프롬프트
      const prompt = 'Indoor scene in a cozy room with warm lighting';
      const imageUrl = 'https://mock-seedream-api.com/images/location_test.png';

      // When: 특징을 추출함
      const features = await consistencyManager.extractFeatures(imageUrl, prompt, 'colored');

      // Then: 위치가 감지되어야 함
      expect(features.locations.length).toBeGreaterThan(0);
      const location = features.locations[0];
      expect(location.name).toBeDefined();
      expect(location.visualElements).toBeDefined();
      expect(location.importance).toBeGreaterThan(0);
    });

    it('스타일별로 다른 특징 강화가 적용되어야 함', async () => {
      // Given: 동일한 프롬프트와 이미지
      const prompt = 'Test scene with character and objects';
      const imageUrl = 'https://mock-seedream-api.com/images/style_test.png';

      // When: 다른 스타일로 특징을 추출함
      const pencilFeatures = await consistencyManager.extractFeatures(imageUrl, prompt, 'pencil');
      const roughFeatures = await consistencyManager.extractFeatures(imageUrl, prompt, 'rough');

      // Then: 스타일별로 다른 특징이 적용되어야 함
      expect(pencilFeatures.style.name).toBe('pencil');
      expect(roughFeatures.style.name).toBe('rough');
      expect(pencilFeatures.style.visualCharacteristics).not.toEqual(
        roughFeatures.style.visualCharacteristics
      );
    });

    it('잘못된 이미지 URL에 대해 에러를 발생시켜야 함', async () => {
      // Given: 잘못된 이미지 URL
      const invalidUrl = 'not-a-valid-url';
      const prompt = 'Test prompt';

      // When & Then: URL 검증 에러가 발생해야 함
      await expect(
        consistencyManager.extractFeatures(invalidUrl, prompt, 'pencil')
      ).rejects.toThrow();
    });
  });

  describe('일관성 프롬프트 적용', () => {
    it('일관성 특징을 프롬프트에 성공적으로 적용해야 함', () => {
      // Given: 기본 프롬프트와 일관성 특징
      const originalPrompt = 'A person walking down the street';
      const features = createTestConsistencyFeatures();
      const shotIndex = 3;

      // When: 일관성을 적용함
      const enhancedPrompt = consistencyManager.applyConsistencyToPrompt(
        originalPrompt,
        features,
        shotIndex
      );

      // Then: 일관성 특징이 프롬프트에 추가되어야 함
      expect(enhancedPrompt).toContain(originalPrompt);
      expect(enhancedPrompt.length).toBeGreaterThan(originalPrompt.length);

      // 캐릭터 특징이 포함되어야 함
      expect(enhancedPrompt.toLowerCase()).toContain('character');

      // 스타일 특징이 포함되어야 함
      expect(enhancedPrompt.toLowerCase()).toContain('pencil');
    });

    it('높은 중요도의 특징만 적용되어야 함', () => {
      // Given: 다양한 중요도의 특징들
      const features = createTestConsistencyFeatures();
      features.characters[0].importance = 0.9; // 높은 중요도
      features.locations[0].importance = 0.3; // 낮은 중요도

      const originalPrompt = 'Test scene';

      // When: 일관성을 적용함
      const enhancedPrompt = consistencyManager.applyConsistencyToPrompt(
        originalPrompt,
        features,
        0
      );

      // Then: 높은 중요도 특징만 포함되어야 함
      expect(enhancedPrompt).toContain('Characters:'); // 캐릭터는 포함
      expect(enhancedPrompt).not.toContain('Setting:'); // 위치는 제외 (낮은 중요도)
    });

    it('샷 진행도에 따라 일관성 강도가 조절되어야 함', () => {
      // Given: 동일한 특징과 프롬프트
      const features = createTestConsistencyFeatures();
      const originalPrompt = 'Test scene';

      // When: 다른 샷 인덱스로 적용함
      const earlyShot = consistencyManager.applyConsistencyToPrompt(originalPrompt, features, 1);
      const lateShot = consistencyManager.applyConsistencyToPrompt(originalPrompt, features, 11);

      // Then: 후반 샷일수록 일관성 강도가 약해져야 함
      expect(earlyShot).toContain('maintain 80%'); // 초반: 높은 일관성
      expect(lateShot).toContain('maintain 64%'); // 후반: 낮은 일관성
    });

    it('특징이 없는 경우 원본 프롬프트를 반환해야 함', () => {
      // Given: 빈 특징과 원본 프롬프트
      const originalPrompt = 'Simple test prompt';
      const emptyFeatures = null;

      // When: 일관성을 적용함
      const result = consistencyManager.applyConsistencyToPrompt(
        originalPrompt,
        emptyFeatures as any,
        0
      );

      // Then: 원본 프롬프트가 변경 없이 반환되어야 함
      expect(result).toBe(originalPrompt);
    });
  });

  describe('일관성 점수 계산', () => {
    it('동일한 프롬프트에 대해 높은 점수를 반환해야 함', () => {
      // Given: 동일한 프롬프트 두 개
      const prompt1 = 'A peaceful village with stone houses and mountains';
      const prompt2 = 'A peaceful village with stone houses and mountains';

      // When: 일관성 점수를 계산함
      const score = consistencyManager.calculateConsistencyScore(prompt1, prompt2);

      // Then: 완벽한 일관성 점수를 받아야 함
      expect(score).toBe(1.0);
    });

    it('완전히 다른 프롬프트에 대해 낮은 점수를 반환해야 함', () => {
      // Given: 완전히 다른 프롬프트 두 개
      const prompt1 = 'A peaceful village with stone houses';
      const prompt2 = 'Futuristic spaceship in outer space';

      // When: 일관성 점수를 계산함
      const score = consistencyManager.calculateConsistencyScore(prompt1, prompt2);

      // Then: 낮은 일관성 점수를 받아야 함
      expect(score).toBeLessThan(0.3);
    });

    it('부분적으로 유사한 프롬프트에 대해 중간 점수를 반환해야 함', () => {
      // Given: 부분적으로 유사한 프롬프트
      const prompt1 = 'A young person walking through a village';
      const prompt2 = 'A young woman walking through a modern city';

      // When: 일관성 점수를 계산함
      const score = consistencyManager.calculateConsistencyScore(prompt1, prompt2);

      // Then: 중간 정도의 일관성 점수를 받아야 함
      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThan(0.8);
    });

    it('빈 프롬프트에 대해 0점을 반환해야 함', () => {
      // Given: 빈 프롬프트
      const prompt1 = '';
      const prompt2 = 'Some content';

      // When: 일관성 점수를 계산함
      const score = consistencyManager.calculateConsistencyScore(prompt1, prompt2);

      // Then: 0점을 받아야 함
      expect(score).toBe(0);
    });
  });

  describe('특징 업데이트', () => {
    it('새로운 특징으로 기존 특징을 업데이트해야 함', async () => {
      // Given: 초기 특징 추출
      const imageUrl = 'https://mock-seedream-api.com/images/initial.png';
      const initialPrompt = 'Initial scene with character';
      await consistencyManager.extractFeatures(imageUrl, initialPrompt, 'pencil');

      const initialFeatures = consistencyManager.getExtractedFeatures();
      const initialConfidence = initialFeatures?.confidence || 0;

      // When: 새로운 특징으로 업데이트
      const newFeatures = {
        characters: [{
          name: 'updated_character',
          description: 'Updated character description',
          visualFeatures: ['new_feature'],
          importance: 0.9,
          confidence: 0.9,
        }],
      };

      consistencyManager.updateFeatures(newFeatures as any);

      // Then: 특징이 업데이트되고 신뢰도가 증가해야 함
      const updatedFeatures = consistencyManager.getExtractedFeatures();
      expect(updatedFeatures?.confidence).toBeGreaterThan(initialConfidence);
    });

    it('특징이 추출되지 않은 상태에서 업데이트하면 무시되어야 함', () => {
      // Given: 특징이 추출되지 않은 상태
      const newFeatures = {
        characters: [{ name: 'test' }],
      };

      // When: 업데이트를 시도함
      consistencyManager.updateFeatures(newFeatures as any);

      // Then: 특징이 여전히 null이어야 함
      const features = consistencyManager.getExtractedFeatures();
      expect(features).toBeNull();
    });
  });

  describe('설정 관리', () => {
    it('설정을 동적으로 업데이트할 수 있어야 함', () => {
      // Given: 초기 설정 (모든 필수 필드 포함)
      const newConfig = {
        weights: {
          characters: 0.95,
          locations: 0.6,
          objects: 0.7,
          style: 0.9,
          composition: 0.5,
        },
        adaptationStrength: 0.7,
      };

      // When: 설정을 업데이트함
      consistencyManager.updateConfig(newConfig);

      // Then: 설정이 업데이트되어야 함 (실제 구현에서는 getter 메서드 필요)
      expect(() => consistencyManager.updateConfig(newConfig)).not.toThrow();
    });

    it('잘못된 설정 업데이트를 거부해야 함', () => {
      // Given: 잘못된 설정
      const invalidConfig = {
        weights: {
          characters: 2.0, // 범위 초과
          locations: 0.6,
          objects: 0.7,
          style: 0.8,
          composition: 0.5,
        },
      };

      // When & Then: 설정 검증 에러가 발생해야 함
      expect(() => consistencyManager.updateConfig(invalidConfig as any)).toThrow();
    });
  });

  describe('스타일별 최적화', () => {
    it('연필 스타일에 대해 적절한 특징을 생성해야 함', async () => {
      // Given: 연필 스타일 요청
      const imageUrl = 'https://mock-seedream-api.com/images/pencil_test.png';
      const prompt = 'Test scene for pencil style';

      // When: 연필 스타일로 특징을 추출함
      const features = await consistencyManager.extractFeatures(imageUrl, prompt, 'pencil');

      // Then: 연필 스타일 특성이 포함되어야 함
      expect(features.style.visualCharacteristics).toContain('soft lines');
      expect(features.style.technique).toContain('pencil');
    });

    it('러프 스타일에 대해 적절한 특징을 생성해야 함', async () => {
      // Given: 러프 스타일 요청
      const imageUrl = 'https://mock-seedream-api.com/images/rough_test.png';
      const prompt = 'Test scene for rough style';

      // When: 러프 스타일로 특징을 추출함
      const features = await consistencyManager.extractFeatures(imageUrl, prompt, 'rough');

      // Then: 러프 스타일 특성이 포함되어야 함
      expect(features.style.visualCharacteristics).toContain('energetic strokes');
      expect(features.style.technique).toContain('loose strokes');
    });

    it('모노크롬 스타일에 대해 적절한 특징을 생성해야 함', async () => {
      // Given: 모노크롬 스타일 요청
      const imageUrl = 'https://mock-seedream-api.com/images/mono_test.png';
      const prompt = 'Test scene for monochrome style';

      // When: 모노크롬 스타일로 특징을 추출함
      const features = await consistencyManager.extractFeatures(imageUrl, prompt, 'monochrome');

      // Then: 모노크롬 스타일 특성이 포함되어야 함
      expect(features.style.visualCharacteristics).toContain('high contrast');
      expect(features.style.colorPalette).toContain('#000000');
      expect(features.style.colorPalette).toContain('#FFFFFF');
    });

    it('컬러 스타일에 대해 적절한 특징을 생성해야 함', async () => {
      // Given: 컬러 스타일 요청
      const imageUrl = 'https://mock-seedream-api.com/images/colored_test.png';
      const prompt = 'Test scene for colored style';

      // When: 컬러 스타일로 특징을 추출함
      const features = await consistencyManager.extractFeatures(imageUrl, prompt, 'colored');

      // Then: 컬러 스타일 특성이 포함되어야 함
      expect(features.style.visualCharacteristics).toContain('vibrant colors');
      expect(features.style.technique).toContain('realistic rendering');
    });
  });

  describe('에러 처리', () => {
    it('네트워크 오류 시 적절한 에러를 발생시켜야 함', async () => {
      // Given: 네트워크 오류 상황
      const invalidUrl = 'https://non-existent-domain.com/image.png';
      const prompt = 'Test prompt';

      // When & Then: 네트워크 에러가 발생해야 함
      await expect(
        consistencyManager.extractFeatures(invalidUrl, prompt, 'pencil')
      ).rejects.toThrow('일관성 특징 추출에 실패했습니다');
    });

    it('빈 프롬프트에 대해 기본 특징을 생성해야 함', async () => {
      // Given: 빈 프롬프트
      const imageUrl = 'https://mock-seedream-api.com/images/empty_prompt_test.png';
      const emptyPrompt = '';

      // When: 빈 프롬프트로 특징을 추출함
      const features = await consistencyManager.extractFeatures(imageUrl, emptyPrompt, 'pencil');

      // Then: 기본 특징이 생성되어야 함
      expect(features).toBeDefined();
      expect(features.style).toBeDefined();
      expect(features.style.name).toBe('pencil');
    });
  });
});