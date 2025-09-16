/**
 * Generate-story API 통합 테스트 - 전체 플로우 검증
 * 🚨 프로덕션 400 에러 디버깅: 실제 API 호출까지 포함한 전체 플로우 테스트
 */

import { generateStorySteps } from '@/features/scenario/api/story-generation';
import { StoryInput } from '@/entities/scenario';

// MSW 설정
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';

// 🚨 프로덕션 시나리오 재현을 위한 Mock 서버
const server = setupServer(
  // 성공 케이스: 서버가 올바른 형식의 데이터를 받았을 때
  http.post('/api/ai/generate-story', async ({ request }) => {
    const body = await request.json();
    console.log('🔍 Mock 서버가 받은 데이터:', body);

    // 🚨 핵심: toneAndManner가 문자열인지 검증
    if (typeof body.toneAndManner !== 'string') {
      console.error('❌ toneAndManner가 문자열이 아님:', typeof body.toneAndManner, body.toneAndManner);
      return HttpResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'toneAndManner는 문자열이어야 합니다'
        },
        { status: 400 }
      );
    }

    // 성공 응답 반환 (Gemini API 형식)
    return HttpResponse.json({
      success: true,
      data: {
        steps: [
          {
            step: 1,
            title: '오프닝: 상황 설정',
            description: '주인공이 처한 상황을 소개합니다',
            keyElements: ['주인공 등장', '배경 설명', '문제 제시'],
            emotionalArc: '호기심 유발',
            duration: '0-15초',
            visualDirection: '클로즈업과 와이드샷 조합'
          },
          {
            step: 2,
            title: '전개: 갈등 심화',
            description: '문제가 더욱 복잡해집니다',
            keyElements: ['갈등 심화', '장애물 등장', '긴장감 고조'],
            emotionalArc: '불안과 긴장',
            duration: '15-30초',
            visualDirection: '빠른 컷 편집'
          },
          {
            step: 3,
            title: '클라이맥스: 최고조',
            description: '가장 극적인 순간이 펼쳐집니다',
            keyElements: ['절정 상황', '결정적 선택', '감정 폭발'],
            emotionalArc: '극적 긴장',
            duration: '30-45초',
            visualDirection: '다이나믹한 카메라 워크'
          },
          {
            step: 4,
            title: '엔딩: 해결과 감동',
            description: '문제가 해결되고 감동적인 마무리',
            keyElements: ['문제 해결', '감동적 메시지', '여운 남기기'],
            emotionalArc: '감동과 만족',
            duration: '45-60초',
            visualDirection: '따뜻한 색감의 클로즈업'
          }
        ],
        metadata: {
          provider: 'gemini',
          model: 'Gemini 2.0 Flash',
          generatedAt: new Date().toISOString()
        }
      }
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Generate-story API 통합 테스트', () => {
  // 🚨 프로덕션 에러 재현: 실제 플로우대로 테스트
  test('toneAndManner 배열이 포함된 StoryInput을 올바르게 처리', async () => {
    const mockInput: StoryInput = {
      title: '브랜드 광고 스토리',
      oneLineStory: '새로운 제품을 소개하는 감동적인 광고',
      toneAndManner: ['유머러스', '감성적', '친근한'], // 🚨 배열 입력 (프로덕션 시나리오)
      genre: '광고',
      target: '20-30대',
      duration: '60초',
      format: '16:9',
      tempo: '보통',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '보통'
    };

    let capturedRequest: any = null;

    // Mock 서버 요청 캡처를 위한 핸들러 재정의
    server.use(
      http.post('/api/ai/generate-story', async ({ request }) => {
        capturedRequest = await request.json();
        console.log('🔍 실제 API 요청 데이터:', capturedRequest);

        return HttpResponse.json({
          success: true,
          data: {
            steps: [
              { step: 1, title: 'Test Step 1', description: 'Description 1', keyElements: [], emotionalArc: 'Arc 1' },
              { step: 2, title: 'Test Step 2', description: 'Description 2', keyElements: [], emotionalArc: 'Arc 2' },
              { step: 3, title: 'Test Step 3', description: 'Description 3', keyElements: [], emotionalArc: 'Arc 3' },
              { step: 4, title: 'Test Step 4', description: 'Description 4', keyElements: [], emotionalArc: 'Arc 4' }
            ]
          }
        });
      })
    );

    const result = await generateStorySteps({
      storyInput: mockInput,
      onLoadingStart: (message) => console.log('Loading:', message),
      onLoadingEnd: () => console.log('Loading ended'),
      onError: (error, type) => console.error('Error:', error, type),
      onSuccess: (steps, message) => console.log('Success:', message, steps.length, 'steps')
    });

    // 🚨 핵심 검증: API가 성공적으로 호출되고 스텝이 반환되었는지
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(4);

    // 🚨 핵심: 실제 API 요청에서 toneAndManner가 문자열로 변환되었는지 확인
    expect(capturedRequest).toBeDefined();
    expect(typeof capturedRequest.toneAndManner).toBe('string');
    expect(capturedRequest.toneAndManner).toBe('유머러스, 감성적, 친근한');
  });

  test('빈 toneAndManner 배열 처리', async () => {
    const mockInput: StoryInput = {
      title: '테스트 스토리',
      oneLineStory: '테스트용 스토리',
      toneAndManner: [], // 빈 배열
      genre: '드라마',
      target: '일반인',
      duration: '60초',
      format: '16:9',
      tempo: '보통',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '보통'
    };

    let capturedRequest: any = null;

    server.use(
      http.post('/api/ai/generate-story', async ({ request }) => {
        capturedRequest = await request.json();

        return HttpResponse.json({
          success: true,
          data: {
            steps: [
              { step: 1, title: 'Test Step 1', description: 'Description 1', keyElements: [], emotionalArc: 'Arc 1' }
            ]
          }
        });
      })
    );

    await generateStorySteps({
      storyInput: mockInput
    });

    // 빈 배열은 기본값 "일반적"으로 변환되어야 함
    expect(capturedRequest.toneAndManner).toBe('일반적');
  });

  // 🚨 서버 검증 실패 시뮬레이션
  test('서버에서 toneAndManner 타입 오류 발생 시 처리', async () => {
    const mockInput: StoryInput = {
      title: '타입 오류 테스트',
      oneLineStory: '타입 오류 시뮬레이션',
      toneAndManner: ['테스트'],
      genre: '테스트',
      target: '테스트',
      duration: '60초',
      format: '16:9',
      tempo: '보통',
      developmentMethod: '클래식 기승전결',
      developmentIntensity: '보통'
    };

    // 서버에서 400 에러를 반환하는 시나리오
    server.use(
      http.post('/api/ai/generate-story', () => {
        return HttpResponse.json(
          {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'toneAndManner는 문자열이어야 합니다'
          },
          { status: 400 }
        );
      })
    );

    let errorCaptured = false;

    try {
      await generateStorySteps({
        storyInput: mockInput,
        onError: (error, type) => {
          console.log('예상된 에러 발생:', error, type);
          errorCaptured = true;
        }
      });
    } catch (error) {
      console.log('예상된 예외 발생:', error);
      errorCaptured = true;
    }

    expect(errorCaptured).toBe(true);
  });
});