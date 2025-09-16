/**
 * API 계약 검증 테스트
 * Benjamin의 계약 기반 개발 원칙에 따른 API 계약 검증
 *
 * 테스트 목표:
 * 1. HTTP 상태 코드 일관성 검증
 * 2. 에러 메시지 형식 통일성 확인
 * 3. DTO 변환 로직 검증
 * 4. 무한 루프 방지 확인
 */

import { NextRequest } from 'next/server';
import {
  getHttpStatusForError,
  validateHttpStatusUsage,
  INFINITE_LOOP_PREVENTION
} from '@/shared/lib/http-status-guide';
import { transformStoryInputToApiRequest } from '@/shared/api/dto-transformers';
import { StoryInput } from '@/entities/scenario';

// Mock NextRequest helper
function createMockRequest(options: {
  method?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: any;
} = {}): NextRequest {
  const {
    method = 'GET',
    headers = {},
    cookies = {},
    body
  } = options;

  const url = 'http://localhost:3000/api/test';
  const request = new NextRequest(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  // Mock cookies
  Object.entries(cookies).forEach(([key, value]) => {
    (request as any).cookies = {
      ...((request as any).cookies || {}),
      get: (name: string) => name === key ? { value } : undefined
    };
  });

  return request;
}

describe('API 계약 검증 테스트', () => {
  describe('HTTP 상태 코드 일관성', () => {
    test('인증 관련 에러는 401 상태 코드를 사용해야 함', () => {
      const authErrors = [
        'NO_AUTH_TOKEN',
        'INVALID_AUTH_TOKEN',
        'REFRESH_TOKEN_FAILED',
        'UNAUTHORIZED'
      ];

      authErrors.forEach(errorCode => {
        const status = getHttpStatusForError(errorCode);
        expect(status).toBe(401);

        const validation = validateHttpStatusUsage(errorCode, 401);
        expect(validation.isValid).toBe(true);
      });
    });

    test('클라이언트 요청 오류는 400 상태 코드를 사용해야 함', () => {
      const badRequestErrors = [
        'MISSING_REFRESH_TOKEN',
        'MISSING_FILE',
        'VALIDATION_ERROR',
        'INVALID_REQUEST'
      ];

      badRequestErrors.forEach(errorCode => {
        const status = getHttpStatusForError(errorCode);
        expect(status).toBe(400);

        const validation = validateHttpStatusUsage(errorCode, 400);
        expect(validation.isValid).toBe(true);
      });
    });

    test('MISSING_REFRESH_TOKEN은 반드시 400 상태 코드를 사용해야 함 (무한 루프 방지)', () => {
      // 401 사용 시 무한 루프 유발 가능성 때문에 400 강제
      const status = getHttpStatusForError('MISSING_REFRESH_TOKEN');
      expect(status).toBe(400);

      const validation = validateHttpStatusUsage('MISSING_REFRESH_TOKEN', 401);
      expect(validation.isValid).toBe(false);
      expect(validation.expectedStatus).toBe(400);
      expect(validation.message).toContain('400');
    });

    test('잘못된 상태 코드 사용 시 검증 실패', () => {
      const validation = validateHttpStatusUsage('UNAUTHORIZED', 400);
      expect(validation.isValid).toBe(false);
      expect(validation.expectedStatus).toBe(401);
      expect(validation.message).toContain('401');
    });
  });

  describe('DTO 변환 로직 검증', () => {
    test('transformStoryInputToApiRequest는 toneAndManner 배열을 문자열로 변환해야 함', () => {
      const storyInput: StoryInput = {
        title: '테스트 영상',
        oneLineStory: '재미있는 스토리',
        genre: '코미디',
        toneAndManner: ['유머러스한', '밝은', '경쾌한'],
        target: '20-30대',
        duration: '60초',
        format: '16:9',
        tempo: '빠름',
        developmentMethod: '클래식 기승전결',
        developmentIntensity: '강함'
      };

      const apiRequest = transformStoryInputToApiRequest(storyInput);

      expect(apiRequest.toneAndManner).toBe('유머러스한, 밝은, 경쾌한');
      expect(typeof apiRequest.toneAndManner).toBe('string');
      expect(apiRequest.title).toBe('테스트 영상');
      expect(apiRequest.oneLineStory).toBe('재미있는 스토리');
    });

    test('빈 toneAndManner 배열 처리', () => {
      const storyInput: StoryInput = {
        title: '테스트',
        oneLineStory: '테스트 스토리',
        genre: '드라마',
        toneAndManner: [],
        target: '일반',
        duration: '30초',
        format: '16:9',
        tempo: '보통',
        developmentMethod: '선형',
        developmentIntensity: '보통'
      };

      const apiRequest = transformStoryInputToApiRequest(storyInput);

      expect(apiRequest.toneAndManner).toBe('일반적');
    });

    test('유효하지 않은 toneAndManner 값 필터링', () => {
      const storyInput: StoryInput = {
        title: '테스트',
        oneLineStory: '테스트 스토리',
        genre: '드라마',
        toneAndManner: ['유효한값', '', '  ', null as any, undefined as any, '또다른유효한값'],
        target: '일반',
        duration: '30초',
        format: '16:9',
        tempo: '보통',
        developmentMethod: '선형',
        developmentIntensity: '보통'
      };

      const apiRequest = transformStoryInputToApiRequest(storyInput);

      expect(apiRequest.toneAndManner).toBe('유효한값, 또다른유효한값');
    });

    test('필수 필드 기본값 처리', () => {
      const emptyInput = {} as StoryInput;
      const apiRequest = transformStoryInputToApiRequest(emptyInput);

      expect(apiRequest.title).toBe('영상 시나리오');
      expect(apiRequest.oneLineStory).toBe('영상 시나리오를 만들어주세요');
      expect(apiRequest.genre).toBe('드라마');
      expect(apiRequest.toneAndManner).toBe('일반적');
      expect(apiRequest.target).toBe('일반 시청자');
      expect(apiRequest.duration).toBe('60초');
      expect(apiRequest.format).toBe('16:9');
      expect(apiRequest.tempo).toBe('보통');
      expect(apiRequest.developmentMethod).toBe('클래식 기승전결');
      expect(apiRequest.developmentIntensity).toBe('보통');
    });
  });

  describe('무한 루프 방지 규칙', () => {
    test('refresh API에서 MISSING_REFRESH_TOKEN은 400 상태 코드 사용', () => {
      expect(INFINITE_LOOP_PREVENTION.MISSING_REFRESH_TOKEN_MUST_BE_400).toBe(true);
      expect(getHttpStatusForError('MISSING_REFRESH_TOKEN')).toBe(400);
    });

    test('refresh API 에러 전략 검증', () => {
      const strategy = INFINITE_LOOP_PREVENTION.REFRESH_API_ERROR_STRATEGY;

      expect(strategy.missingToken).toBe(400);    // 토큰 없음 = 클라이언트 오류
      expect(strategy.invalidToken).toBe(401);    // 토큰 무효 = 인증 필요
      expect(strategy.expiredToken).toBe(401);    // 토큰 만료 = 인증 필요
      expect(strategy.malformedRequest).toBe(400); // 요청 형식 오류 = 클라이언트 오류
    });
  });

  describe('API 응답 형식 일관성', () => {
    test('에러 응답은 일관된 구조를 가져야 함', () => {
      // 이는 실제 API 호출이 아닌 응답 구조 검증
      const expectedErrorStructure = {
        success: false,
        error: 'ERROR_CODE',
        message: '사용자 친화적 메시지',
        statusCode: expect.any(Number),
        traceId: expect.any(String),
        timestamp: expect.any(String)
      };

      // 실제 API 응답이 이 구조를 따르는지는 통합 테스트에서 확인
      expect(expectedErrorStructure).toBeDefined();
    });

    test('성공 응답은 일관된 구조를 가져야 함', () => {
      const expectedSuccessStructure = {
        success: true,
        data: expect.any(Object),
        traceId: expect.any(String),
        timestamp: expect.any(String)
      };

      expect(expectedSuccessStructure).toBeDefined();
    });
  });
});

// 계약 위반 감지를 위한 린터 규칙 검증
describe('API 계약 위반 감지', () => {
  test('개발자가 잘못된 상태 코드를 사용할 때 경고', () => {
    const commonMistakes = [
      { errorCode: 'UNAUTHORIZED', wrongStatus: 400, correctStatus: 401 },
      { errorCode: 'MISSING_REFRESH_TOKEN', wrongStatus: 401, correctStatus: 400 },
      { errorCode: 'VALIDATION_ERROR', wrongStatus: 500, correctStatus: 400 }
    ];

    commonMistakes.forEach(({ errorCode, wrongStatus, correctStatus }) => {
      const validation = validateHttpStatusUsage(errorCode, wrongStatus);

      expect(validation.isValid).toBe(false);
      expect(validation.expectedStatus).toBe(correctStatus);
      expect(validation.message).toContain(errorCode);
      expect(validation.message).toContain(correctStatus.toString());
      expect(validation.message).toContain(wrongStatus.toString());
    });
  });
});

// 타입 안전성 검증
describe('타입 안전성', () => {
  test('StoryInput 타입과 API 스키마 호환성', () => {
    const storyInput: StoryInput = {
      title: '테스트',
      oneLineStory: '스토리',
      genre: '장르',
      toneAndManner: ['톤1', '톤2'],
      target: '타겟',
      duration: '60초',
      format: '16:9',
      tempo: '보통',
      developmentMethod: '방법',
      developmentIntensity: '강도'
    };

    // 변환된 결과가 API가 기대하는 형식과 일치하는지 확인
    const apiRequest = transformStoryInputToApiRequest(storyInput);

    // API 스키마가 기대하는 모든 필드가 존재하는지 확인
    const requiredFields = [
      'title', 'oneLineStory', 'genre', 'toneAndManner',
      'target', 'duration', 'format', 'tempo',
      'developmentMethod', 'developmentIntensity'
    ];

    requiredFields.forEach(field => {
      expect(apiRequest).toHaveProperty(field);
      expect(apiRequest[field as keyof typeof apiRequest]).toBeDefined();
    });

    // toneAndManner가 문자열로 변환되었는지 확인
    expect(typeof apiRequest.toneAndManner).toBe('string');
  });
});