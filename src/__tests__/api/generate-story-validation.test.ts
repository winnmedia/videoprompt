/**
 * generate-story API 검증 로직 테스트
 * TDD: Red -> Green -> Refactor
 */

import { StoryGenerationSchema } from '@/shared/schemas/story-generation.schema';
import { transformStoryInputToApiRequest } from '@/shared/api/dto-transformers';

describe('generate-story API validation', () => {
  describe('스키마 검증', () => {
    it('toneAndManner 문자열 입력을 허용해야 한다', () => {
      const validInput = {
        title: '테스트 제목',
        oneLineStory: '테스트 스토리',
        toneAndManner: '밝은, 활기찬',
        genre: '코미디',
        target: '20-30대',
        duration: '60초',
        format: '16:9',
        tempo: '빠름',
        developmentMethod: '클래식 기승전결',
        developmentIntensity: '강함',
      };

      const result = StoryGenerationSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('toneAndManner 배열 입력을 허용해야 한다 (z.union 사용)', () => {
      const arrayInput = {
        title: '테스트 제목',
        oneLineStory: '테스트 스토리',
        toneAndManner: ['밝은', '활기찬'], // 배열 형태
        genre: '코미디',
        target: '20-30대',
        duration: '60초',
        format: '16:9',
        tempo: '빠름',
        developmentMethod: '클래식 기승전결',
        developmentIntensity: '강함',
      };

      const result = StoryGenerationSchema.safeParse(arrayInput);
      expect(result.success).toBe(true);
    });
  });

  describe('DTO 변환', () => {
    it('배열 형태 toneAndManner를 문자열로 변환해야 한다', () => {
      const storyInput = {
        title: '테스트 제목',
        oneLineStory: '테스트 스토리',
        toneAndManner: ['밝은', '활기찬', '유쾌한'],
        genre: '코미디',
        target: '20-30대',
        duration: '60초',
        format: '16:9',
        tempo: '빠름',
        developmentMethod: '클래식 기승전결',
        developmentIntensity: '강함',
      };

      const result = transformStoryInputToApiRequest(storyInput);

      expect(result.toneAndManner).toBe('밝은, 활기찬, 유쾌한');
      expect(typeof result.toneAndManner).toBe('string');
    });

    it('빈 배열이나 잘못된 형태를 안전하게 처리해야 한다', () => {
      const storyInput = {
        title: '테스트 제목',
        oneLineStory: '테스트 스토리',
        toneAndManner: [], // 빈 배열
        genre: '코미디',
        target: '20-30대',
      };

      const result = transformStoryInputToApiRequest(storyInput);

      expect(result.toneAndManner).toBe('일반적'); // 기본값
    });

    it('이미 문자열인 toneAndManner는 그대로 유지해야 한다', () => {
      const storyInput = {
        title: '테스트 제목',
        oneLineStory: '테스트 스토리',
        toneAndManner: '밝은, 활기찬', // 이미 문자열
        genre: '코미디',
        target: '20-30대',
      };

      const result = transformStoryInputToApiRequest(storyInput);

      expect(result.toneAndManner).toBe('밝은, 활기찬');
    });
  });

  describe('통합 시나리오', () => {
    it('프론트엔드 배열 입력 -> 변환 -> 검증 -> 성공 플로우', () => {
      // 프론트엔드에서 보내는 원시 데이터 (배열 형태)
      const frontendRequest = {
        title: '테스트 제목',
        oneLineStory: '테스트 스토리',
        toneAndManner: ['밝은', '활기찬'],
        genre: '코미디',
        target: '20-30대',
      };

      // 1단계: DTO 변환 (배열 -> 문자열)
      const transformedData = transformStoryInputToApiRequest(frontendRequest);

      // 2단계: 스키마 검증
      const validationResult = StoryGenerationSchema.safeParse(transformedData);

      expect(validationResult.success).toBe(true);
      expect(transformedData.toneAndManner).toBe('밝은, 활기찬');
    });
  });
});