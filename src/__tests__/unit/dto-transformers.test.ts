/**
 * DTO 변환기 단위 테스트 - toneAndManner 배열→문자열 변환 검증
 * 🚨 프로덕션 400 에러 디버깅: API 계약 준수 여부 확인
 */

import { transformStoryInputToApiRequest } from '@/shared/api/dto-transformers';
import { StoryInput } from '@/entities/scenario';

describe('DTO Transformers - toneAndManner 처리', () => {
  // 🚨 프로덕션 시나리오 재현: toneAndManner 배열이 문자열로 변환되는지 확인
  test('toneAndManner 배열을 문자열로 올바르게 변환', () => {
    const input: StoryInput = {
      title: '테스트 스토리',
      oneLineStory: '테스트용 한 줄 스토리',
      toneAndManner: ['유머러스', '감성적', '다이나믹'], // 배열 입력
      genre: '드라마',
      target: '20-30대',
      duration: '60초',
      format: '16:9',
      tempo: '빠름',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '강함'
    };

    const result = transformStoryInputToApiRequest(input);

    // 🚨 핵심 검증: 배열이 쉼표로 구분된 문자열로 변환되어야 함
    expect(typeof result.toneAndManner).toBe('string');
    expect(result.toneAndManner).toBe('유머러스, 감성적, 다이나믹');
  });

  test('빈 배열 처리 - 기본값 "일반적" 반환', () => {
    const input: StoryInput = {
      title: '테스트 스토리',
      oneLineStory: '테스트용 한 줄 스토리',
      toneAndManner: [], // 빈 배열
      genre: '드라마',
      target: '20-30대',
      duration: '60초',
      format: '16:9',
      tempo: '빠름',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '강함'
    };

    const result = transformStoryInputToApiRequest(input);

    expect(result.toneAndManner).toBe('일반적');
  });

  test('null/undefined 처리 - 기본값 "일반적" 반환', () => {
    const input: StoryInput = {
      title: '테스트 스토리',
      oneLineStory: '테스트용 한 줄 스토리',
      toneAndManner: null as any, // null 처리
      genre: '드라마',
      target: '20-30대',
      duration: '60초',
      format: '16:9',
      tempo: '빠름',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '강함'
    };

    const result = transformStoryInputToApiRequest(input);

    expect(result.toneAndManner).toBe('일반적');
  });

  test('유효하지 않은 값 필터링 - 공백 및 빈 문자열 제거', () => {
    const input: StoryInput = {
      title: '테스트 스토리',
      oneLineStory: '테스트용 한 줄 스토리',
      toneAndManner: ['유머러스', '', '  ', '감성적', null as any, '다이나믹'], // 잘못된 값 포함
      genre: '드라마',
      target: '20-30대',
      duration: '60초',
      format: '16:9',
      tempo: '빠름',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '강함'
    };

    const result = transformStoryInputToApiRequest(input);

    // 유효한 값만 포함되어야 함
    expect(result.toneAndManner).toBe('유머러스, 감성적, 다이나믹');
  });

  test('단일 항목 배열 처리', () => {
    const input: StoryInput = {
      title: '테스트 스토리',
      oneLineStory: '테스트용 한 줄 스토리',
      toneAndManner: ['유머러스'], // 단일 항목
      genre: '드라마',
      target: '20-30대',
      duration: '60초',
      format: '16:9',
      tempo: '빠름',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '강함'
    };

    const result = transformStoryInputToApiRequest(input);

    expect(result.toneAndManner).toBe('유머러스');
  });

  // 🚨 프로덕션 디버깅: 실제 API 요청 형식 검증
  test('전체 API 요청 형식 검증 - 서버 스키마와 일치하는지 확인', () => {
    const input: StoryInput = {
      title: '프로덕션 테스트 스토리',
      oneLineStory: '실제 프로덕션에서 사용되는 한 줄 스토리',
      toneAndManner: ['유머러스', '감성적'],
      genre: '브랜드 광고',
      target: '20-30대 여성',
      duration: '30초',
      format: '9:16',
      tempo: '보통',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '보통'
    };

    const result = transformStoryInputToApiRequest(input);

    // 서버 스키마 필드와 일치하는지 검증
    expect(result).toEqual({
      title: '프로덕션 테스트 스토리',
      oneLineStory: '실제 프로덕션에서 사용되는 한 줄 스토리',
      genre: '브랜드 광고',
      toneAndManner: '유머러스, 감성적', // 🚨 핵심: 문자열로 변환됨
      target: '20-30대 여성',
      duration: '30초',
      format: '9:16',
      tempo: '보통',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '보통'
    });

    // 모든 필드가 문자열인지 확인 (서버 스키마 요구사항)
    Object.values(result).forEach(value => {
      expect(typeof value).toBe('string');
    });
  });
});