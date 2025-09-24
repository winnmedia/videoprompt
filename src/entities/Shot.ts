/**
 * 12단계 숏트 엔티티 (12-Shot System)
 * 4단계 스토리를 12개 숏트로 분할하는 시스템
 * UserJourneyMap 7-10단계 완전 구현
 */

import type { FourActStory, StoryAct } from './story';

// 확장된 카메라 앵글 타입
export type ShotType =
  | 'extreme-wide'      // 극 롱샷 (풍경, 전체적인 상황)
  | 'wide'             // 와이드샷 (전신 포함)
  | 'medium-wide'      // 미디엄 와이드 (무릎 위)
  | 'medium'           // 미디엄샷 (허리 위)
  | 'medium-close'     // 미디엄 클로즈 (가슴 위)
  | 'close-up'         // 클로즈업 (얼굴)
  | 'extreme-close-up' // 익스트림 클로즈업 (눈, 입 등)
  | 'pov'              // 주관적 시점
  | 'over-shoulder'    // 오버 숄더
  | 'insert'           // 인서트 (소품, 디테일)
  | 'cutaway'          // 컷어웨이 (상황 전환)
  | 'establishing';    // 에스태블리싱 (장소 설정)

// 확장된 카메라 무브먼트
export type CameraMovement =
  | 'static'      // 고정
  | 'pan-left'    // 좌측 패닝
  | 'pan-right'   // 우측 패닝
  | 'tilt-up'     // 위쪽 틸트
  | 'tilt-down'   // 아래쪽 틸트
  | 'dolly-in'    // 달리 인 (접근)
  | 'dolly-out'   // 달리 아웃 (후퇴)
  | 'track-left'  // 좌측 트래킹
  | 'track-right' // 우측 트래킹
  | 'zoom-in'     // 줌 인
  | 'zoom-out'    // 줌 아웃
  | 'handheld'    // 핸드헬드 (흔들림)
  | 'crane-up'    // 크레인 업
  | 'crane-down'  // 크레인 다운
  | 'steadicam'   // 스테디캠 (부드러운 이동)
  | 'whip-pan';   // 휩 팬 (빠른 회전)

// 숏트 장르별 감정/톤
export type ShotEmotion =
  | 'neutral'     // 중립적
  | 'tension'     // 긴장감
  | 'excitement'  // 흥미진진
  | 'calm'        // 평온함
  | 'mystery'     // 신비로움
  | 'romance'     // 로맨틱
  | 'action'      // 액션
  | 'drama'       // 드라마틱
  | 'comedy'      // 코미디
  | 'horror'      // 공포
  | 'sadness'     // 슬픔
  | 'hope';       // 희망

// 콘티 상태 관리
export interface ShotStoryboard {
  id: string;
  shotId: string;
  imageUrl?: string;        // 생성된 콘티 이미지 URL
  prompt: string;           // AI 생성용 프롬프트
  style: 'sketch' | 'realistic' | 'anime' | 'cinematic'; // 콘티 스타일
  status: 'empty' | 'generating' | 'completed' | 'error';
  generationAttempts: number; // 재생성 횟수
  aiModel?: 'bytedance' | 'stable-diffusion' | 'midjourney';
  generatedAt?: string;
  downloadUrl?: string;     // 다운로드용 고해상도 URL
}

// 12단계 숏트 메인 인터페이스
export interface TwelveShot {
  id: string;
  storyId: string;          // 연결된 4단계 스토리 ID
  actType: keyof FourActStory['acts']; // 어느 Act에 속하는지
  actOrder: number;         // Act 내에서의 순서 (1-4 or 1-3)
  globalOrder: number;      // 전체 12개 숏트에서의 순서 (1-12)

  // 기본 숏트 정보
  title: string;            // 숏트 제목
  description: string;      // 숏트 내용 설명
  shotType: ShotType;       // 카메라 앵글
  cameraMovement: CameraMovement; // 카메라 움직임
  duration: number;         // 예상 지속시간 (초)

  // 영화적 요소
  emotion: ShotEmotion;     // 감정/톤
  lightingMood: 'bright' | 'dim' | 'dramatic' | 'natural' | 'neon' | 'golden-hour';
  colorPalette: 'warm' | 'cool' | 'monochrome' | 'vibrant' | 'muted' | 'high-contrast';

  // 연결성 및 흐름
  transitionType: 'cut' | 'fade' | 'dissolve' | 'wipe' | 'match-cut';
  continuityNotes: string;  // 연속성 메모

  // 캐릭터 및 대사
  charactersInShot: string[]; // 등장인물
  dialogue?: string;        // 대사 (있는 경우)
  voiceOverNotes?: string;  // 보이스오버 메모

  // 콘티 및 시각적 요소
  storyboard: ShotStoryboard;
  visualReferences: string[]; // 참고 이미지 URL들

  // 메타데이터
  isUserEdited: boolean;    // 사용자가 편집했는지
  editHistory: Array<{      // 편집 히스토리
    timestamp: string;
    field: string;
    oldValue: string;
    newValue: string;
  }>;

  // 타임스탬프
  createdAt: string;
  updatedAt: string;
}

// 12단계 숏트 컬렉션
export interface TwelveShotCollection {
  id: string;
  storyId: string;
  shots: TwelveShot[];      // 정확히 12개
  totalDuration: number;    // 전체 예상 시간

  // 생성 메타데이터
  aiGenerated: boolean;
  generationParams: {
    creativity: number;     // 0-100
    cinematic: number;      // 영화적 완성도 0-100
    pacing: 'slow' | 'medium' | 'fast';
    style: 'commercial' | 'documentary' | 'narrative' | 'experimental';
  };

  // 상태 관리
  status: 'draft' | 'in-progress' | 'completed' | 'ready-for-production';
  completionPercentage: number; // 0-100

  // 콘티 현황
  storyboardsCompleted: number; // 완성된 콘티 수
  allStoryboardsGenerated: boolean;

  // 타임스탬프
  createdAt: string;
  updatedAt: string;
}

// 4→12 변환 파라미터
export interface ShotBreakdownParams {
  storyId: string;
  creativity: number;       // 0-100
  cinematic: number;        // 영화적 완성도 0-100
  pacing: 'slow' | 'medium' | 'fast';
  style: 'commercial' | 'documentary' | 'narrative' | 'experimental';

  // 선택적 커스터마이징
  preferredShotTypes?: ShotType[];
  emphasizeCharacters?: boolean;
  includeCloseUps?: boolean;
  cinematicTransitions?: boolean;
}

// 기존 Shot 인터페이스 (하위 호환성)
export interface Shot {
  id: string;
  sceneId: string;
  shotType: 'wide' | 'medium' | 'closeup' | 'extreme-closeup' | 'pov';
  cameraMovement: 'static' | 'pan' | 'tilt' | 'dolly' | 'zoom';
  duration: number; // seconds
  description: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// 샷 생성
export function createShot(
  sceneId: string,
  shotType: Shot['shotType'],
  description: string,
  cameraMovement: Shot['cameraMovement'] = 'static',
  duration: number = 3,
  order: number = 1
): Shot {
  if (!sceneId.trim()) {
    throw new Error('씬 ID는 필수입니다');
  }

  if (!description.trim()) {
    throw new Error('샷 설명은 필수입니다');
  }

  const timestamp = new Date().toISOString();
  const shotId = `shot_${Date.now()}`;

  return {
    id: shotId,
    sceneId: sceneId.trim(),
    shotType,
    cameraMovement,
    duration,
    description: description.trim(),
    order,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// ===== 12단계 숏트 시스템 핵심 함수들 =====

// 12단계 숏트 생성 (4단계 스토리로부터)
export function createTwelveShotCollection(
  story: FourActStory,
  params: ShotBreakdownParams
): TwelveShotCollection {
  if (!story.id) {
    throw new Error('스토리 ID는 필수입니다');
  }

  // Act별 숏트 배분 (총 12개)
  const shotDistribution = getShotDistribution(params.pacing);
  const timestamp = new Date().toISOString();
  const collectionId = `shots_${Date.now()}`;

  const shots: TwelveShot[] = [];
  let globalOrder = 1;

  // 각 Act별로 숏트 생성
  Object.entries(story.acts).forEach(([actType, act]) => {
    const actKey = actType as keyof FourActStory['acts'];
    const shotsForAct = shotDistribution[actKey];

    for (let actOrder = 1; actOrder <= shotsForAct; actOrder++) {
      const shot = createTwelveShot({
        storyId: story.id,
        actType: actKey,
        actOrder,
        globalOrder,
        act,
        story,
        params
      });
      shots.push(shot);
      globalOrder++;
    }
  });

  return {
    id: collectionId,
    storyId: story.id,
    shots,
    totalDuration: shots.reduce((sum, shot) => sum + shot.duration, 0),
    aiGenerated: true,
    generationParams: {
      creativity: params.creativity,
      cinematic: params.cinematic,
      pacing: params.pacing,
      style: params.style
    },
    status: 'draft',
    completionPercentage: 0,
    storyboardsCompleted: 0,
    allStoryboardsGenerated: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

// 개별 12단계 숏트 생성
function createTwelveShot({
  storyId,
  actType,
  actOrder,
  globalOrder,
  act,
  story,
  params
}: {
  storyId: string;
  actType: keyof FourActStory['acts'];
  actOrder: number;
  globalOrder: number;
  act: StoryAct;
  story: FourActStory;
  params: ShotBreakdownParams;
}): TwelveShot {
  const timestamp = new Date().toISOString();
  const shotId = `shot_${storyId}_${actType}_${actOrder}`;

  // Act 특성에 따른 기본 설정
  const actSettings = getActShotSettings(actType, actOrder, params);

  return {
    id: shotId,
    storyId,
    actType,
    actOrder,
    globalOrder,
    title: generateShotTitle(actType, actOrder, act),
    description: `${act.title}의 ${actOrder}번째 숏트입니다. ${act.content.substring(0, 100)}... 이 장면의 세부 내용은 AI로 생성될 예정입니다.`,
    shotType: actSettings.shotType,
    cameraMovement: actSettings.cameraMovement,
    duration: actSettings.duration,
    emotion: mapActEmotionToShot(act.emotions),
    lightingMood: actSettings.lightingMood,
    colorPalette: getColorPaletteForGenre(story.genre, story.tone),
    transitionType: 'cut',
    continuityNotes: '',
    charactersInShot: act.characterFocus.slice(0, 3), // 최대 3명
    storyboard: {
      id: `storyboard_${shotId}`,
      shotId,
      prompt: '',
      style: 'cinematic',
      status: 'empty',
      generationAttempts: 0
    },
    visualReferences: [],
    isUserEdited: false,
    editHistory: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

// Act별 숏트 배분 가져오기
function getShotDistribution(pacing: 'slow' | 'medium' | 'fast'): {
  setup: number;
  development: number;
  climax: number;
  resolution: number;
} {
  const distributions = {
    slow: { setup: 4, development: 4, climax: 3, resolution: 1 },
    medium: { setup: 3, development: 4, climax: 3, resolution: 2 },
    fast: { setup: 2, development: 3, climax: 4, resolution: 3 }
  };
  return distributions[pacing];
}

// Act별 숏트 설정
function getActShotSettings(
  actType: keyof FourActStory['acts'],
  actOrder: number,
  params: ShotBreakdownParams
) {
  const baseSettings = {
    setup: {
      shotTypes: ['establishing' as const, 'wide' as const, 'medium' as const],
      movements: ['static' as const, 'pan-right' as const, 'dolly-in' as const],
      duration: 4,
      lightingMood: 'natural' as const
    },
    development: {
      shotTypes: ['medium' as const, 'close-up' as const, 'over-shoulder' as const],
      movements: ['dolly-in' as const, 'track-left' as const, 'zoom-in' as const],
      duration: 6,
      lightingMood: 'dramatic' as const
    },
    climax: {
      shotTypes: ['close-up' as const, 'extreme-close-up' as const, 'wide' as const],
      movements: ['handheld' as const, 'whip-pan' as const, 'dolly-out' as const],
      duration: 5,
      lightingMood: 'dramatic' as const
    },
    resolution: {
      shotTypes: ['medium' as const, 'wide' as const, 'extreme-wide' as const],
      movements: ['static' as const, 'dolly-out' as const, 'crane-up' as const],
      duration: 4,
      lightingMood: 'bright' as const
    }
  };

  const settings = baseSettings[actType];
  const shotTypeIndex = (actOrder - 1) % settings.shotTypes.length;
  const movementIndex = (actOrder - 1) % settings.movements.length;

  return {
    shotType: settings.shotTypes[shotTypeIndex],
    cameraMovement: settings.movements[movementIndex],
    duration: settings.duration,
    lightingMood: settings.lightingMood
  };
}

// 숏트 제목 생성
function generateShotTitle(
  actType: keyof FourActStory['acts'],
  actOrder: number,
  act: StoryAct
): string {
  const actNames = {
    setup: '도입',
    development: '전개',
    climax: '절정',
    resolution: '결말'
  };
  return `${actNames[actType]} ${actOrder}: ${act.title.slice(0, 20)}...`;
}

// Act 감정을 Shot 감정으로 매핑
function mapActEmotionToShot(
  actEmotion: StoryAct['emotions']
): ShotEmotion {
  const mapping = {
    'calm': 'calm',
    'tension': 'tension',
    'excitement': 'excitement',
    'sadness': 'sadness',
    'hope': 'hope',
    'fear': 'tension'
  } as const;
  return mapping[actEmotion] || 'neutral';
}

// 장르별 컬러 팔레트
function getColorPaletteForGenre(
  genre: FourActStory['genre'],
  tone: FourActStory['tone']
): TwelveShot['colorPalette'] {
  if (tone === 'dramatic') return 'high-contrast';
  if (tone === 'light') return 'warm';
  if (tone === 'mysterious') return 'cool';

  const genreMapping = {
    'drama': 'muted',
    'action': 'high-contrast',
    'comedy': 'vibrant',
    'documentary': 'warm', // Changed from 'natural'
    'educational': 'warm',
    'thriller': 'cool',
    'romance': 'warm'
  } as const;

  return genreMapping[genre] || 'warm';
}

// 12단계 숏트 순서 업데이트 (드래그앤드롭용)
export function updateTwelveShotOrder(
  collection: TwelveShotCollection,
  shotId: string,
  newGlobalOrder: number
): TwelveShotCollection {
  if (newGlobalOrder < 1 || newGlobalOrder > 12) {
    throw new Error('글로벌 순서는 1-12 사이여야 합니다');
  }

  const shotIndex = collection.shots.findIndex(shot => shot.id === shotId);
  if (shotIndex === -1) {
    throw new Error('해당 ID의 숏트를 찾을 수 없습니다');
  }

  const updatedShots = [...collection.shots];
  const movedShot = updatedShots[shotIndex];
  const oldOrder = movedShot.globalOrder;

  // 순서 변경이 필요 없는 경우
  if (oldOrder === newGlobalOrder) {
    return collection;
  }

  // 다른 숏트들의 순서 조정
  updatedShots.forEach(shot => {
    if (shot.id === shotId) {
      shot.globalOrder = newGlobalOrder;
      shot.updatedAt = new Date().toISOString();
    } else {
      if (oldOrder < newGlobalOrder) {
        // 뒤로 이동: 사이에 있는 숏트들을 앞으로
        if (shot.globalOrder > oldOrder && shot.globalOrder <= newGlobalOrder) {
          shot.globalOrder -= 1;
          shot.updatedAt = new Date().toISOString();
        }
      } else {
        // 앞으로 이동: 사이에 있는 숏트들을 뒤로
        if (shot.globalOrder >= newGlobalOrder && shot.globalOrder < oldOrder) {
          shot.globalOrder += 1;
          shot.updatedAt = new Date().toISOString();
        }
      }
    }
  });

  // globalOrder로 정렬
  updatedShots.sort((a, b) => a.globalOrder - b.globalOrder);

  return {
    ...collection,
    shots: updatedShots,
    updatedAt: new Date().toISOString()
  };
}

// 숏트 내용 업데이트
export function updateTwelveShot(
  collection: TwelveShotCollection,
  shotId: string,
  updates: Partial<Pick<TwelveShot,
    'title' | 'description' | 'shotType' | 'cameraMovement' |
    'duration' | 'emotion' | 'lightingMood' | 'colorPalette' |
    'transitionType' | 'charactersInShot' | 'dialogue' |
    'voiceOverNotes' | 'continuityNotes' | 'visualReferences'
  >>
): TwelveShotCollection {
  const shotIndex = collection.shots.findIndex(shot => shot.id === shotId);
  if (shotIndex === -1) {
    throw new Error('해당 ID의 숏트를 찾을 수 없습니다');
  }

  const timestamp = new Date().toISOString();
  const updatedShots = [...collection.shots];
  const oldShot = updatedShots[shotIndex];

  // 편집 히스토리 기록
  const editHistory = [...oldShot.editHistory];
  Object.entries(updates).forEach(([field, newValue]) => {
    const oldValue = (oldShot as any)[field];
    if (oldValue !== newValue) {
      editHistory.push({
        timestamp,
        field,
        oldValue: String(oldValue || ''),
        newValue: String(newValue || '')
      });
    }
  });

  updatedShots[shotIndex] = {
    ...oldShot,
    ...updates,
    isUserEdited: true,
    editHistory,
    updatedAt: timestamp
  };

  // 총 시간 재계산
  const totalDuration = updatedShots.reduce((sum, shot) => sum + shot.duration, 0);

  return {
    ...collection,
    shots: updatedShots,
    totalDuration,
    updatedAt: timestamp
  };
}

// 콘티 상태 업데이트
export function updateShotStoryboard(
  collection: TwelveShotCollection,
  shotId: string,
  storyboardUpdates: Partial<ShotStoryboard>
): TwelveShotCollection {
  const shotIndex = collection.shots.findIndex(shot => shot.id === shotId);
  if (shotIndex === -1) {
    throw new Error('해당 ID의 숏트를 찾을 수 없습니다');
  }

  const updatedShots = [...collection.shots];
  updatedShots[shotIndex] = {
    ...updatedShots[shotIndex],
    storyboard: {
      ...updatedShots[shotIndex].storyboard,
      ...storyboardUpdates
    },
    updatedAt: new Date().toISOString()
  };

  // 완성된 콘티 수 재계산
  const storyboardsCompleted = updatedShots.filter(
    shot => shot.storyboard.status === 'completed'
  ).length;

  // 완성률 재계산
  const completionPercentage = Math.round(
    (storyboardsCompleted / 12) * 100
  );

  return {
    ...collection,
    shots: updatedShots,
    storyboardsCompleted,
    allStoryboardsGenerated: storyboardsCompleted === 12,
    completionPercentage,
    updatedAt: new Date().toISOString()
  };
}

// 컬렉션 완성도 검증
export function validateTwelveShotCollection(
  collection: TwelveShotCollection
): {
  isValid: boolean;
  completionPercentage: number;
  errors: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let completedItems = 0;
  const totalItems = 24; // 12개 숏트 * 2 (내용 + 콘티)

  // 숏트 수 검증
  if (collection.shots.length !== 12) {
    errors.push(`12개의 숏트가 필요하지만 ${collection.shots.length}개입니다`);
  }

  // 각 숏트 검증
  collection.shots.forEach((shot, index) => {
    // 내용 완성도
    if (shot.title && shot.description.length > 20) {
      completedItems++;
    } else {
      suggestions.push(`${shot.globalOrder}번 숏트의 내용을 보완해주세요`);
    }

    // 콘티 완성도
    if (shot.storyboard.status === 'completed') {
      completedItems++;
    } else if (shot.storyboard.status === 'empty') {
      suggestions.push(`${shot.globalOrder}번 숏트의 콘티를 생성해주세요`);
    }

    // 순서 검증
    if (shot.globalOrder !== index + 1) {
      errors.push(`${shot.globalOrder}번 숏트의 순서가 잘못되었습니다`);
    }
  });

  // Act별 분배 검증
  const actCounts = {
    setup: 0,
    development: 0,
    climax: 0,
    resolution: 0
  };

  collection.shots.forEach(shot => {
    actCounts[shot.actType]++;
  });

  const totalShots = Object.values(actCounts).reduce((sum, count) => sum + count, 0);
  if (totalShots !== 12) {
    errors.push('Act별 숏트 분배가 올바르지 않습니다');
  }

  const completionPercentage = Math.round((completedItems / totalItems) * 100);

  // 완성도별 제안
  if (completionPercentage < 30) {
    suggestions.push('AI 생성을 통해 기본 숏트 내용을 완성해보세요');
  } else if (completionPercentage < 70) {
    suggestions.push('콘티 생성을 시작하여 시각적 완성도를 높여보세요');
  } else if (completionPercentage >= 90) {
    suggestions.push('훌륭합니다! 기획안을 다운로드하여 완성된 작품을 확인해보세요');
  }

  return {
    isValid: errors.length === 0 && completionPercentage >= 50, // 새로 생성된 컬렉션도 valid하도록 조건 완화
    completionPercentage,
    errors,
    suggestions
  };
}

// ===== 기존 Shot 시스템 호환성 함수들 =====

// 기존 샷 순서 업데이트 (하위 호환성)
export function updateShotOrder(
  shots: Shot[],
  shotId: string,
  newOrder: number
): Shot[] {
  if (newOrder < 1) {
    throw new Error('순서는 1 이상이어야 합니다');
  }

  if (newOrder > shots.length) {
    throw new Error('순서는 전체 샷 개수를 초과할 수 없습니다');
  }

  const shotIndex = shots.findIndex((shot) => shot.id === shotId);
  if (shotIndex === -1) {
    throw new Error('해당 ID의 샷을 찾을 수 없습니다');
  }

  const originalOrder = shots[shotIndex].order;

  // 변경이 필요 없는 경우
  if (originalOrder === newOrder) {
    return shots;
  }

  const timestamp = new Date().toISOString();

  // 모든 샷의 복사본 생성
  const updatedShots = shots.map((shot) => ({ ...shot }));

  // 대상 샷의 순서 설정
  const targetShot = updatedShots.find((shot) => shot.id === shotId);
  if (targetShot) {
    targetShot.order = newOrder;
    targetShot.updatedAt = timestamp;
  }

  // 다른 샷들의 순서 조정
  updatedShots.forEach((shot) => {
    if (shot.id === shotId) {
      return; // 대상 샷은 이미 처리됨
    }

    const currentOrder = shot.order;

    if (originalOrder < newOrder) {
      // 뒤로 이동: originalOrder 초과이고 newOrder 이하인 샷들을 앞으로 당기기
      if (currentOrder > originalOrder && currentOrder <= newOrder) {
        shot.order = currentOrder - 1;
        shot.updatedAt = timestamp;
      }
    } else {
      // 앞으로 이동: newOrder 이상이고 originalOrder 미만인 샷들을 뒤로 밀기
      if (currentOrder >= newOrder && currentOrder < originalOrder) {
        shot.order = currentOrder + 1;
        shot.updatedAt = timestamp;
      }
    }
  });

  return updatedShots;
}

// 총 지속시간 계산
export function calculateTotalDuration(shots: Shot[]): number {
  return shots.reduce((total, shot) => total + shot.duration, 0);
}

// 샷 검증
export function validateShot(shot: Partial<Shot>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 필수 필드 검사
  if (!shot.id) {
    errors.push('샷 ID는 필수입니다');
  }

  if (!shot.sceneId) {
    errors.push('씬 ID는 필수입니다');
  }

  if (!shot.description) {
    errors.push('샷 설명은 필수입니다');
  } else if (shot.description.length < 10) {
    errors.push('샷 설명은 최소 10자 이상이어야 합니다');
  }

  if (!shot.shotType) {
    errors.push('샷 타입은 필수입니다');
  }

  if (!shot.cameraMovement) {
    errors.push('카메라 움직임은 필수입니다');
  }

  // 지속시간 검사
  if (shot.duration === undefined || shot.duration === null) {
    errors.push('지속시간은 필수입니다');
  } else if (shot.duration < 0.1) {
    errors.push('지속시간은 0.1초 이상이어야 합니다');
  } else if (shot.duration > 120) {
    errors.push('지속시간은 120초를 초과할 수 없습니다');
  }

  // 순서 검사
  if (shot.order === undefined || shot.order === null) {
    errors.push('순서는 필수입니다');
  } else if (shot.order < 1) {
    errors.push('순서는 1 이상이어야 합니다');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
