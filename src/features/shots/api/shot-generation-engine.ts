/**
 * Shot Generation Engine
 * 4단계 스토리를 12단계 숏트로 변환하는 AI 엔진
 * Gemini API 활용한 영화적 숏트 분할
 */

import type {
  ShotGenerationRequest,
  ShotGenerationResponse,
  ShotGenerationProgress,
  ShotGenerationError
} from '../types';
import type { TwelveShotCollection, TwelveShot } from '../../../entities/Shot';
import { createTwelveShotCollection } from '../../../entities/Shot';
import type { FourActStory, StoryAct } from '../../../entities/story';

// $300 사건 방지: API 호출 캐시 및 제한
class ApiCallTracker {
  private static instance: ApiCallTracker;
  private calls: Map<string, { timestamp: number; count: number }> = new Map();
  private readonly CACHE_DURATION = 60000; // 1분
  private readonly MAX_CALLS_PER_MINUTE = 5;

  static getInstance(): ApiCallTracker {
    if (!ApiCallTracker.instance) {
      ApiCallTracker.instance = new ApiCallTracker();
    }
    return ApiCallTracker.instance;
  }

  canMakeCall(key: string): boolean {
    const now = Date.now();
    const record = this.calls.get(key);

    if (!record) {
      this.calls.set(key, { timestamp: now, count: 1 });
      return true;
    }

    // 1분 이내라면 호출 횟수 체크
    if (now - record.timestamp < this.CACHE_DURATION) {
      if (record.count >= this.MAX_CALLS_PER_MINUTE) {
        return false; // 제한 초과
      }
      record.count++;
      return true;
    }

    // 1분 지났으면 리셋
    this.calls.set(key, { timestamp: now, count: 1 });
    return true;
  }

  getCachedResult<T>(key: string): T | null {
    const record = this.calls.get(key);
    if (!record) return null;

    const now = Date.now();
    if (now - record.timestamp > this.CACHE_DURATION) {
      this.calls.delete(key);
      return null;
    }

    // 캐시된 결과가 있다면 반환 (실제로는 별도 캐시 시스템 필요)
    return null;
  }
}

export class ShotGenerationEngine {
  private tracker = ApiCallTracker.getInstance();

  async generateShots(
    request: ShotGenerationRequest,
    progressCallback?: (progress: ShotGenerationProgress) => void
  ): Promise<ShotGenerationResponse> {
    try {
      // Cost Safety: 호출 제한 체크
      const cacheKey = `shots_${request.story.id}_${JSON.stringify(request.params)}`;

      if (!this.tracker.canMakeCall(cacheKey)) {
        return {
          success: false,
          error: {
            type: 'api_error',
            message: 'API 호출 한도 초과. 1분 후 다시 시도해주세요.',
            retryable: true,
            timestamp: new Date().toISOString()
          }
        };
      }

      // 캐시된 결과 확인
      const cachedResult = this.tracker.getCachedResult<TwelveShotCollection>(cacheKey);
      if (cachedResult) {
        return { success: true, collection: cachedResult };
      }

      // 1단계: 스토리 분석 및 초기 컬렉션 생성
      progressCallback?.({
        phase: 'analyzing',
        currentShot: 0,
        overallProgress: 10,
        estimatedTimeRemaining: 60,
        currentTask: '4단계 스토리 구조 분석 중...'
      });

      let collection = createTwelveShotCollection(request.story, request.params);

      // 2단계: AI를 통한 숏트 내용 생성
      progressCallback?.({
        phase: 'generating',
        currentShot: 1,
        overallProgress: 20,
        estimatedTimeRemaining: 50,
        currentTask: '12단계 숏트 내용 생성 중...'
      });

      // 특정 숏트만 재생성하는 경우
      if (request.regenerateShot) {
        collection = await this.regenerateSingleShot(
          collection,
          request.regenerateShot,
          request.story,
          progressCallback
        );
      } else {
        // 전체 숏트 생성
        collection = await this.generateAllShots(
          collection,
          request.story,
          progressCallback
        );
      }

      // 3단계: 숏트 연결성 및 흐름 최적화
      progressCallback?.({
        phase: 'refining',
        currentShot: 12,
        overallProgress: 90,
        estimatedTimeRemaining: 5,
        currentTask: '숏트 연결성 및 흐름 최적화 중...'
      });

      collection = await this.optimizeShotFlow(collection, request.story);

      // 4단계: 완료
      progressCallback?.({
        phase: 'completed',
        currentShot: 12,
        overallProgress: 100,
        estimatedTimeRemaining: 0,
        currentTask: '12단계 숏트 생성 완료!'
      });

      return {
        success: true,
        collection,
        tokensUsed: this.estimateTokenUsage(request.story, collection),
        generationTime: 30 // 예상 생성 시간
      };

    } catch (error) {
      const errorObj: ShotGenerationError = {
        type: 'unknown_error',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
        retryable: true,
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error.stack : String(error) }
      };

      return { success: false, error: errorObj };
    }
  }

  private async generateAllShots(
    collection: TwelveShotCollection,
    story: FourActStory,
    progressCallback?: (progress: ShotGenerationProgress) => void
  ): Promise<TwelveShotCollection> {
    const updatedShots = [...collection.shots];

    // Act별로 순차 처리
    for (const [actType, act] of Object.entries(story.acts)) {
      const actShots = updatedShots.filter(shot => shot.actType === actType);

      for (let i = 0; i < actShots.length; i++) {
        const shot = actShots[i];
        const progress = ((shot.globalOrder - 1) / 12) * 70 + 20; // 20-90%

        progressCallback?.({
          phase: 'generating',
          currentShot: shot.globalOrder,
          overallProgress: progress,
          estimatedTimeRemaining: (12 - shot.globalOrder) * 3,
          currentTask: `${shot.globalOrder}번 숏트 생성 중... (${act.title})`
        });

        // AI를 통한 숏트 내용 생성
        const enhancedShot = await this.generateShotContent(
          shot,
          act as StoryAct,
          story,
          i + 1,
          actShots.length
        );

        // 배열에서 해당 숏트 업데이트
        const shotIndex = updatedShots.findIndex(s => s.id === shot.id);
        if (shotIndex !== -1) {
          updatedShots[shotIndex] = enhancedShot;
        }

        // Cost Safety: 과도한 호출 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      ...collection,
      shots: updatedShots,
      updatedAt: new Date().toISOString()
    };
  }

  private async generateShotContent(
    shot: TwelveShot,
    act: StoryAct,
    story: FourActStory,
    actShotIndex: number,
    totalActShots: number
  ): Promise<TwelveShot> {
    try {
      // AI 프롬프트 생성
      const prompt = this.buildShotPrompt(shot, act, story, actShotIndex, totalActShots);

      // 실제 Gemini API 호출 대신 시뮬레이션
      // 실제 구현에서는 Gemini API를 호출
      const aiResponse = await this.callGeminiAPI(prompt);

      return this.parseAIResponse(shot, aiResponse);

    } catch (error) {
      console.error(`숏트 ${shot.id} 생성 실패:`, error);
      return shot; // 실패 시 원본 반환
    }
  }

  private buildShotPrompt(
    shot: TwelveShot,
    act: StoryAct,
    story: FourActStory,
    actShotIndex: number,
    totalActShots: number
  ): string {
    const baseContext = `
장르: ${story.genre}
톤: ${story.tone}
전체 스토리: ${story.synopsis}

현재 Act: ${act.title}
Act 내용: ${act.content}
Act 감정: ${act.emotions}
주요 인물: ${act.characterFocus.join(', ')}

현재 숏트 정보:
- 글로벌 순서: ${shot.globalOrder}/12
- Act 내 순서: ${actShotIndex}/${totalActShots}
- 카메라 앵글: ${shot.shotType}
- 카메라 움직임: ${shot.cameraMovement}
- 예상 시간: ${shot.duration}초
- 감정/톤: ${shot.emotion}
    `;

    return `다음 조건에 맞는 영화적 숏트를 제작해주세요:

${baseContext}

요구사항:
1. 숏트 제목 (20자 이내)
2. 구체적인 숏트 설명 (50-150자)
3. 등장인물의 행동과 감정
4. 시각적 요소 (조명, 색감, 구도)
5. 이전/다음 숏트와의 연결성

결과는 다음 JSON 형식으로:
{
  "title": "숏트 제목",
  "description": "구체적인 숏트 설명",
  "charactersInShot": ["등장인물1", "등장인물2"],
  "dialogue": "대사 (있는 경우)",
  "continuityNotes": "연결성 메모",
  "lightingMood": "bright|dim|dramatic|natural",
  "visualNotes": "시각적 특징"
}`;
  }

  private async callGeminiAPI(prompt: string): Promise<any> {
    // Cost Safety: 실제 API 호출 대신 시뮬레이션
    // 실제 구현에서는 Gemini API 호출
    console.log('Gemini API 호출 시뮬레이션:', prompt.slice(0, 100));

    // 시뮬레이션된 응답
    return {
      title: "인물 등장",
      description: "주인공이 처음 등장하는 장면입니다. 배경과 함께 인물의 성격을 드러내는 중요한 순간을 담습니다.",
      charactersInShot: ["주인공"],
      dialogue: "",
      continuityNotes: "다음 숏트와 자연스럽게 연결되도록 인물의 시선 방향을 고려",
      lightingMood: "natural",
      visualNotes: "따뜻한 색감으로 친근함을 표현"
    };
  }

  private parseAIResponse(shot: TwelveShot, aiResponse: any): TwelveShot {
    try {
      return {
        ...shot,
        title: aiResponse.title || shot.title,
        description: aiResponse.description || shot.description,
        charactersInShot: aiResponse.charactersInShot || shot.charactersInShot,
        dialogue: aiResponse.dialogue || undefined,
        continuityNotes: aiResponse.continuityNotes || '',
        lightingMood: aiResponse.lightingMood || shot.lightingMood,
        isUserEdited: false,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('AI 응답 파싱 실패:', error);
      return shot;
    }
  }

  private async optimizeShotFlow(
    collection: TwelveShotCollection,
    story: FourActStory
  ): Promise<TwelveShotCollection> {
    // 숏트 간 연결성 최적화
    const optimizedShots = collection.shots.map((shot, index) => {
      const nextShot = collection.shots[index + 1];

      if (nextShot) {
        // 트랜지션 타입 최적화
        const optimizedTransition = this.optimizeTransition(shot, nextShot);
        return {
          ...shot,
          transitionType: optimizedTransition
        };
      }

      return shot;
    });

    return {
      ...collection,
      shots: optimizedShots,
      updatedAt: new Date().toISOString()
    };
  }

  private optimizeTransition(
    currentShot: TwelveShot,
    nextShot: TwelveShot
  ): TwelveShot['transitionType'] {
    // Act 간 전환은 fade 사용
    if (currentShot.actType !== nextShot.actType) {
      return 'fade';
    }

    // 감정 변화가 큰 경우 dissolve
    if (currentShot.emotion !== nextShot.emotion) {
      return 'dissolve';
    }

    // 같은 장소/인물 연속은 cut
    const sameCharacters = currentShot.charactersInShot.some(char =>
      nextShot.charactersInShot.includes(char)
    );

    if (sameCharacters) {
      return 'cut';
    }

    return 'cut'; // 기본값
  }

  private async regenerateSingleShot(
    collection: TwelveShotCollection,
    shotId: string,
    story: FourActStory,
    progressCallback?: (progress: ShotGenerationProgress) => void
  ): Promise<TwelveShotCollection> {
    const shotIndex = collection.shots.findIndex(shot => shot.id === shotId);
    if (shotIndex === -1) {
      throw new Error('해당 숏트를 찾을 수 없습니다');
    }

    const shot = collection.shots[shotIndex];
    const act = story.acts[shot.actType];

    progressCallback?.({
      phase: 'generating',
      currentShot: shot.globalOrder,
      overallProgress: 50,
      estimatedTimeRemaining: 10,
      currentTask: `${shot.globalOrder}번 숏트 재생성 중...`
    });

    const regeneratedShot = await this.generateShotContent(
      shot,
      act,
      story,
      shot.actOrder,
      collection.shots.filter(s => s.actType === shot.actType).length
    );

    const updatedShots = [...collection.shots];
    updatedShots[shotIndex] = regeneratedShot;

    return {
      ...collection,
      shots: updatedShots,
      updatedAt: new Date().toISOString()
    };
  }

  private estimateTokenUsage(story: FourActStory, collection: TwelveShotCollection): number {
    // 대략적인 토큰 사용량 추정
    const storyTokens = (story.synopsis.length + story.title.length) / 4;
    const shotTokens = collection.shots.reduce((sum, shot) => {
      return sum + (shot.description.length + shot.title.length) / 4;
    }, 0);

    return Math.round(storyTokens + shotTokens + 1000); // 시스템 프롬프트 등 추가
  }
}