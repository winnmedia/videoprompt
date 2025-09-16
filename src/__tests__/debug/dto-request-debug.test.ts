/**
 * DTO 변환 요청 디버깅 테스트 - 실제 전송 데이터 확인
 * 🚨 프로덕션 400 에러 원인 규명: 실제 API 요청 데이터를 로깅하여 확인
 */

import { transformStoryInputToApiRequest } from '@/shared/api/dto-transformers';
import { StoryInput } from '@/entities/scenario';

// 실제 API 호출을 가로채서 요청 데이터를 확인하는 테스트
describe('DTO 요청 데이터 디버깅', () => {
  test('실제 변환된 API 요청 데이터 확인', () => {
    const testInput: StoryInput = {
      title: '프로덕션 테스트 스토리',
      oneLineStory: '실제 프로덕션에서 사용되는 한 줄 스토리',
      toneAndManner: ['유머러스', '감성적', '친근한'], // 배열 입력
      genre: '브랜드 광고',
      target: '20-30대 여성',
      duration: '30초',
      format: '9:16',
      tempo: '보통',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '보통'
    };

    console.log('🔍 입력 데이터 (StoryInput):');
    console.log(JSON.stringify(testInput, null, 2));
    console.log('toneAndManner 타입:', typeof testInput.toneAndManner, Array.isArray(testInput.toneAndManner));

    const transformedRequest = transformStoryInputToApiRequest(testInput);

    console.log('🔍 변환된 요청 데이터 (API Request):');
    console.log(JSON.stringify(transformedRequest, null, 2));
    console.log('toneAndManner 타입:', typeof transformedRequest.toneAndManner);
    console.log('toneAndManner 값:', transformedRequest.toneAndManner);

    // 서버 스키마와 일치하는지 상세 검증
    const requiredFields = [
      'title', 'oneLineStory', 'toneAndManner', 'genre', 'target',
      'duration', 'format', 'tempo', 'developmentMethod', 'developmentIntensity'
    ];

    console.log('🔍 필수 필드 검증:');
    requiredFields.forEach(field => {
      const value = transformedRequest[field];
      const type = typeof value;
      const isEmpty = !value || (typeof value === 'string' && value.trim() === '');

      console.log(`  ${field}: ${type} = "${value}" (empty: ${isEmpty})`);

      expect(type).toBe('string');
      expect(isEmpty).toBe(false);
    });

    // toneAndManner 특별 검증
    expect(transformedRequest.toneAndManner).toBe('유머러스, 감성적, 친근한');
  });

  test('Edge case - 특수문자가 포함된 toneAndManner', () => {
    const testInput: StoryInput = {
      title: '특수문자 테스트',
      oneLineStory: '특수문자가 포함된 테스트',
      toneAndManner: ['유머러스 & 재미있는', '감성적... 따뜻한', '친근한!'], // 특수문자 포함
      genre: '브랜드 광고',
      target: '20-30대 여성',
      duration: '30초',
      format: '9:16',
      tempo: '보통',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '보통'
    };

    const transformedRequest = transformStoryInputToApiRequest(testInput);

    console.log('🔍 특수문자 테스트 결과:');
    console.log('toneAndManner:', transformedRequest.toneAndManner);

    expect(typeof transformedRequest.toneAndManner).toBe('string');
    expect(transformedRequest.toneAndManner).toBe('유머러스 & 재미있는, 감성적... 따뜻한, 친근한!');
  });

  test('Edge case - 한글 외 언어가 포함된 경우', () => {
    const testInput: StoryInput = {
      title: '다국어 테스트',
      oneLineStory: '다국어가 포함된 테스트',
      toneAndManner: ['friendly', '친근한', 'ユーモラス'], // 영어, 한국어, 일본어 혼합
      genre: 'commercial',
      target: 'global audience',
      duration: '30초',
      format: '9:16',
      tempo: '보통',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '보통'
    };

    const transformedRequest = transformStoryInputToApiRequest(testInput);

    console.log('🔍 다국어 테스트 결과:');
    console.log('toneAndManner:', transformedRequest.toneAndManner);

    expect(typeof transformedRequest.toneAndManner).toBe('string');
    expect(transformedRequest.toneAndManner).toBe('friendly, 친근한, ユーモラス');
  });

  test('빈 값들 처리 확인', () => {
    const testInput: StoryInput = {
      title: '',
      oneLineStory: '',
      toneAndManner: [],
      genre: '',
      target: '',
      duration: '',
      format: '',
      tempo: '',
      developmentMethod: '',
      developmentIntensity: ''
    };

    const transformedRequest = transformStoryInputToApiRequest(testInput);

    console.log('🔍 빈 값 처리 결과:');
    console.log(JSON.stringify(transformedRequest, null, 2));

    // 모든 필드가 기본값으로 설정되어야 함
    expect(transformedRequest.title).toBe('영상 시나리오');
    expect(transformedRequest.oneLineStory).toBe('영상 시나리오를 만들어주세요');
    expect(transformedRequest.toneAndManner).toBe('일반적');
    expect(transformedRequest.genre).toBe('드라마');
    expect(transformedRequest.target).toBe('일반 시청자');
    expect(transformedRequest.duration).toBe('60초');
    expect(transformedRequest.format).toBe('16:9');
    expect(transformedRequest.tempo).toBe('보통');
    expect(transformedRequest.developmentMethod).toBe('클래식 기승전결');
    expect(transformedRequest.developmentIntensity).toBe('보통');
  });

  // 🚨 실제 JSON 직렬화 테스트 (fetch body에서 사용되는 방식)
  test('JSON.stringify 후 파싱 테스트 - 실제 네트워크 전송 시뮬레이션', () => {
    const testInput: StoryInput = {
      title: 'JSON 직렬화 테스트',
      oneLineStory: 'JSON 직렬화 테스트 스토리',
      toneAndManner: ['유머러스', '감성적'],
      genre: '광고',
      target: '20-30대',
      duration: '60초',
      format: '16:9',
      tempo: '보통',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '보통'
    };

    const transformedRequest = transformStoryInputToApiRequest(testInput);

    // 실제 fetch에서 사용하는 방식과 동일하게 처리
    const jsonString = JSON.stringify(transformedRequest);
    const parsedBack = JSON.parse(jsonString);

    console.log('🔍 JSON 직렬화/역직렬화 결과:');
    console.log('원본:', transformedRequest);
    console.log('JSON 문자열:', jsonString);
    console.log('파싱 후:', parsedBack);

    // 직렬화 후에도 모든 값이 유지되는지 확인
    expect(parsedBack.toneAndManner).toBe('유머러스, 감성적');
    expect(typeof parsedBack.toneAndManner).toBe('string');

    // 모든 필드가 올바른 타입인지 확인
    Object.values(parsedBack).forEach(value => {
      expect(typeof value).toBe('string');
    });
  });
});