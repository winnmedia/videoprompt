/**
 * generate-story API E2E 테스트
 * 실제 API Route 동작 검증 (Mock 없이)
 */

import { transformStoryInputToApiRequest } from '@/shared/api/dto-transformers';
import { StoryGenerationSchema } from '@/shared/schemas/story-generation.schema';

describe('generate-story API E2E', () => {
  describe('요청 데이터 변환 및 검증 플로우', () => {
    it('프론트엔드 배열 요청 -> DTO 변환 -> 스키마 검증 성공', () => {
      // 1. 프론트엔드에서 보내는 원시 데이터 (문제가 되었던 형태)
      const frontendRequestBody = {
        title: '테스트 영상',
        oneLineStory: '재미있는 이야기를 만들어보자',
        toneAndManner: ['밝은', '활기찬', '유쾌한'], // 배열 형태 (400 에러 원인)
        genre: '코미디',
        target: '20-30대 직장인',
        duration: '60초',
        format: '16:9',
        tempo: '빠름',
        developmentMethod: '클래식 기승전결',
        developmentIntensity: '강함'
      };

      // 2. API Route에서 수행되는 변환 (실제 로직)
      const transformedData = transformStoryInputToApiRequest(frontendRequestBody);

      // 3. 변환된 데이터가 올바른 형태인지 확인
      expect(transformedData.toneAndManner).toBe('밝은, 활기찬, 유쾌한');
      expect(typeof transformedData.toneAndManner).toBe('string');

      // 4. 스키마 검증 통과 확인 (이전에는 여기서 실패)
      const validationResult = StoryGenerationSchema.safeParse(transformedData);

      expect(validationResult.success).toBe(true);
      if (validationResult.success) {
        expect(validationResult.data.toneAndManner).toBe('밝은, 활기찬, 유쾌한');
      }
    });

    it('다양한 입력 형태에 대한 안전성 검증', () => {
      const testCases = [
        {
          name: '배열 형태 (일반적인 경우)',
          input: ['밝은', '활기찬'],
          expected: '밝은, 활기찬'
        },
        {
          name: '이미 문자열 형태',
          input: '차분한, 진중한',
          expected: '차분한, 진중한'
        },
        {
          name: '빈 배열',
          input: [],
          expected: '일반적'
        },
        {
          name: '공백이 포함된 배열',
          input: ['  밝은  ', '활기찬', '', '  ', '유쾌한'],
          expected: '밝은, 활기찬, 유쾌한'
        },
        {
          name: 'null 또는 undefined',
          input: null,
          expected: '일반적'
        }
      ];

      testCases.forEach(({ name, input, expected }) => {
        const requestBody = {
          title: '테스트',
          oneLineStory: '테스트 스토리',
          toneAndManner: input,
          genre: '드라마',
          target: '일반인'
        };

        const transformedData = transformStoryInputToApiRequest(requestBody);
        const validationResult = StoryGenerationSchema.safeParse(transformedData);

        expect(validationResult.success).toBe(true);
        expect(transformedData.toneAndManner).toBe(expected);
      });
    });

    it('필수 필드 누락 시 기본값으로 안전하게 처리', () => {
      const incompleteRequest = {
        // title 누락 - 기본값 '영상 시나리오'로 설정됨
        oneLineStory: '스토리',
        toneAndManner: ['밝은'],
        genre: '코미디',
        target: '20대'
      };

      const transformedData = transformStoryInputToApiRequest(incompleteRequest);
      const validationResult = StoryGenerationSchema.safeParse(transformedData);

      // DTO 변환 함수가 기본값을 제공하므로 검증 통과
      expect(validationResult.success).toBe(true);
      expect(transformedData.title).toBe('영상 시나리오'); // 기본값
      expect(transformedData.toneAndManner).toBe('밝은');
    });

    it('빈 문자열 필드도 기본값으로 안전하게 처리', () => {
      const invalidRequest = {
        title: '', // 빈 문자열 - 기본값으로 대체됨
        oneLineStory: '',
        toneAndManner: ['밝은'],
        genre: '',
        target: ''
      };

      const transformedData = transformStoryInputToApiRequest(invalidRequest);
      const validationResult = StoryGenerationSchema.safeParse(transformedData);

      // DTO 변환 함수가 빈 문자열도 기본값으로 대체하므로 검증 통과
      expect(validationResult.success).toBe(true);
      expect(transformedData.title).toBe('영상 시나리오'); // 기본값
      expect(transformedData.oneLineStory).toBe('영상 시나리오를 만들어주세요'); // 기본값
      expect(transformedData.genre).toBe('드라마'); // 기본값
      expect(transformedData.target).toBe('일반 시청자'); // 기본값
    });
  });

  describe('성능 및 안정성', () => {
    it('대량의 톤앤매너 배열도 안전하게 처리', () => {
      const largeToneArray = Array.from({ length: 50 }, (_, i) => `톤${i + 1}`);

      const requestBody = {
        title: '테스트',
        oneLineStory: '스토리',
        toneAndManner: largeToneArray,
        genre: '드라마',
        target: '일반인'
      };

      const startTime = performance.now();
      const transformedData = transformStoryInputToApiRequest(requestBody);
      const endTime = performance.now();

      // 성능 체크 (1ms 이내 처리)
      expect(endTime - startTime).toBeLessThan(1);

      // 결과 검증
      expect(transformedData.toneAndManner).toBe(largeToneArray.join(', '));

      const validationResult = StoryGenerationSchema.safeParse(transformedData);
      expect(validationResult.success).toBe(true);
    });

    it('잘못된 데이터 타입도 안전하게 처리', () => {
      const edgeCases = [
        { toneAndManner: 123 }, // 숫자
        { toneAndManner: { wrong: 'object' } }, // 객체
        { toneAndManner: [123, 'valid', null] }, // 혼재된 배열
      ];

      edgeCases.forEach((testCase, index) => {
        const requestBody = {
          title: `테스트 ${index}`,
          oneLineStory: '스토리',
          ...testCase,
          genre: '드라마',
          target: '일반인'
        };

        expect(() => {
          const transformedData = transformStoryInputToApiRequest(requestBody);
          expect(typeof transformedData.toneAndManner).toBe('string');
        }).not.toThrow();
      });
    });
  });
});