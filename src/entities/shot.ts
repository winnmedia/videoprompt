/**
 * 12단계 숏트 엔티티
 * 4단계 스토리를 12개 숏트로 분할한 개별 숏트 정보
 */

// 숏트 타입 정의
export type ShotType =
  | 'establishing' // 설정/환경
  | 'closeUp'      // 클로즈업
  | 'mediumShot'   // 미디엄 샷
  | 'longShot'     // 롱 샷
  | 'cutaway'      // 컷어웨이
  | 'transition';  // 전환

// 카메라 앵글 타입
export type CameraAngle =
  | 'eyeLevel'     // 아이 레벨
  | 'lowAngle'     // 로우 앵글
  | 'highAngle'    // 하이 앵글
  | 'birdEye'      // 버즈 아이
  | 'dutch';       // 더치 앵글

// 감정 톤
export type EmotionTone =
  | 'tension'      // 긴장
  | 'calm'         // 평온
  | 'excitement'   // 흥분
  | 'sadness'      // 슬픔
  | 'hope'         // 희망
  | 'fear';        // 공포

// Act 타입 (4단계 구조)
export type ActType = 'setup' | 'development' | 'climax' | 'resolution';

// 스토리보드 상태
export interface ShotStoryboard {
  status: 'empty' | 'generating' | 'completed' | 'error';
  imageUrl?: string;
  prompt?: string;
  generatedAt?: string;
  error?: string;
}

// 12단계 숏트 인터페이스
export interface TwelveShot {
  id: string;
  globalOrder: number; // 1-12 전체 순서
  actType: ActType; // 속한 Act
  actOrder: number; // Act 내 순서 (1-4)

  // 숏트 기본 정보
  title: string;
  description: string;
  duration: number; // 초 단위

  // 카메라 및 연출
  shotType: ShotType;
  cameraAngle: CameraAngle;
  emotion: EmotionTone;

  // 스토리보드
  storyboard: ShotStoryboard;

  // 메타데이터
  isUserEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

// 12단계 숏트 생성 파라미터
export interface ShotBreakdownParams {
  storyId: string;
  acts: {
    setup: { content: string; duration: number; };
    development: { content: string; duration: number; };
    climax: { content: string; duration: number; };
    resolution: { content: string; duration: number; };
  };
  pacing: 'slow' | 'medium' | 'fast';
  style?: string;
  targetDuration?: number; // 전체 영상 목표 시간 (초)
}

// Act별 숏트 분배 전략
export const SHOT_DISTRIBUTION = {
  slow: { setup: 4, development: 4, climax: 3, resolution: 1 },
  medium: { setup: 3, development: 4, climax: 3, resolution: 2 },
  fast: { setup: 2, development: 3, climax: 4, resolution: 3 }
} as const;

// 숏트 타입별 기본 지속 시간 (초)
export const SHOT_DURATION_DEFAULTS = {
  establishing: 8,   // 설정 샷은 길게
  closeUp: 4,        // 클로즈업은 짧게
  mediumShot: 6,     // 미디엄은 중간
  longShot: 10,      // 롱샷은 길게
  cutaway: 3,        // 컷어웨이는 짧게
  transition: 2      // 전환은 매우 짧게
} as const;

// Act별 권장 숏트 타입 분배
export const ACT_SHOT_TYPE_RECOMMENDATIONS = {
  setup: {
    primary: ['establishing', 'longShot', 'mediumShot'] as ShotType[],
    secondary: ['closeUp'] as ShotType[]
  },
  development: {
    primary: ['mediumShot', 'closeUp', 'cutaway'] as ShotType[],
    secondary: ['longShot', 'transition'] as ShotType[]
  },
  climax: {
    primary: ['closeUp', 'mediumShot', 'transition'] as ShotType[],
    secondary: ['longShot', 'cutaway'] as ShotType[]
  },
  resolution: {
    primary: ['longShot', 'establishing', 'mediumShot'] as ShotType[],
    secondary: ['closeUp'] as ShotType[]
  }
} as const;

// 감정별 권장 카메라 앵글
export const EMOTION_CAMERA_MAPPING = {
  tension: ['lowAngle', 'dutch'] as CameraAngle[],
  calm: ['eyeLevel', 'highAngle'] as CameraAngle[],
  excitement: ['lowAngle', 'dutch'] as CameraAngle[],
  sadness: ['highAngle', 'eyeLevel'] as CameraAngle[],
  hope: ['lowAngle', 'eyeLevel'] as CameraAngle[],
  fear: ['dutch', 'lowAngle'] as CameraAngle[]
} as const;

// 12단계 숏트 생성 함수
export function generateTwelveShots(params: ShotBreakdownParams): TwelveShot[] {
  const shots: TwelveShot[] = [];
  const distribution = SHOT_DISTRIBUTION[params.pacing];
  const timestamp = new Date().toISOString();

  let globalOrder = 1;

  // 각 Act별로 숏트 생성
  (Object.keys(params.acts) as ActType[]).forEach((actType) => {
    const act = params.acts[actType];
    const shotCount = distribution[actType];
    const actRecommendations = ACT_SHOT_TYPE_RECOMMENDATIONS[actType];

    for (let actOrder = 1; actOrder <= shotCount; actOrder++) {
      // 숏트 타입 결정 (첫 번째와 마지막은 특별 처리)
      let shotType: ShotType;
      if (actOrder === 1 && actType === 'setup') {
        shotType = 'establishing'; // 첫 번째는 무조건 establishing
      } else if (actOrder === shotCount && actType === 'resolution') {
        shotType = 'longShot'; // 마지막은 longShot
      } else {
        // 권장 타입에서 랜덤 선택
        const availableTypes = Math.random() > 0.7 ?
          actRecommendations.secondary : actRecommendations.primary;
        shotType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      }

      // 감정 톤 결정 (Act에 따라)
      let emotion: EmotionTone;
      switch (actType) {
        case 'setup': emotion = 'calm'; break;
        case 'development': emotion = 'tension'; break;
        case 'climax': emotion = 'excitement'; break;
        case 'resolution': emotion = 'hope'; break;
      }

      // 카메라 앵글 결정
      const recommendedAngles = EMOTION_CAMERA_MAPPING[emotion];
      const cameraAngle = recommendedAngles[Math.floor(Math.random() * recommendedAngles.length)];

      // 지속 시간 계산
      const baseDuration = SHOT_DURATION_DEFAULTS[shotType];
      const duration = Math.round(baseDuration * (0.8 + Math.random() * 0.4)); // ±20% 변동

      const shot: TwelveShot = {
        id: `shot_${params.storyId}_${globalOrder}`,
        globalOrder,
        actType,
        actOrder,
        title: `${actType} ${actOrder}단계`,
        description: act.content.substring(0, 100) + '...', // Act 내용의 일부
        duration,
        shotType,
        cameraAngle,
        emotion,
        storyboard: {
          status: 'empty'
        },
        isUserEdited: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      shots.push(shot);
      globalOrder++;
    }
  });

  return shots;
}

// 숏트 업데이트 함수
export function updateShot(
  shot: TwelveShot,
  updates: Partial<Omit<TwelveShot, 'id' | 'globalOrder' | 'createdAt'>>
): TwelveShot {
  return {
    ...shot,
    ...updates,
    isUserEdited: true,
    updatedAt: new Date().toISOString()
  };
}

// 스토리보드 상태 업데이트
export function updateShotStoryboard(
  shot: TwelveShot,
  storyboard: Partial<ShotStoryboard>
): TwelveShot {
  return updateShot(shot, {
    storyboard: {
      ...shot.storyboard,
      ...storyboard
    }
  });
}

// 숏트 순서 변경
export function reorderShots(shots: TwelveShot[], fromIndex: number, toIndex: number): TwelveShot[] {
  const result = [...shots];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);

  // globalOrder 재정렬
  return result.map((shot, index) => ({
    ...shot,
    globalOrder: index + 1,
    updatedAt: new Date().toISOString()
  }));
}

// 숏트 유효성 검증
export function validateShot(shot: TwelveShot): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 필수 필드 검증
  if (!shot.title.trim()) errors.push('숏트 제목은 필수입니다');
  if (!shot.description.trim()) errors.push('숏트 설명은 필수입니다');
  if (shot.duration <= 0) errors.push('지속 시간은 0보다 커야 합니다');

  // 권장사항 검증
  if (shot.duration > 15) warnings.push('15초를 초과하는 숏트는 너무 길 수 있습니다');
  if (shot.description.length < 20) warnings.push('설명을 더 자세히 작성하면 좋겠습니다');

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// 전체 12숏트 통계
export function getShotsStats(shots: TwelveShot[]): {
  totalDuration: number;
  shotsByAct: Record<ActType, number>;
  shotsByType: Record<ShotType, number>;
  completedStoryboards: number;
  averageDuration: number;
} {
  const totalDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
  const shotsByAct = shots.reduce((acc, shot) => {
    acc[shot.actType] = (acc[shot.actType] || 0) + 1;
    return acc;
  }, {} as Record<ActType, number>);

  const shotsByType = shots.reduce((acc, shot) => {
    acc[shot.shotType] = (acc[shot.shotType] || 0) + 1;
    return acc;
  }, {} as Record<ShotType, number>);

  const completedStoryboards = shots.filter(
    shot => shot.storyboard.status === 'completed'
  ).length;

  return {
    totalDuration,
    shotsByAct,
    shotsByType,
    completedStoryboards,
    averageDuration: Math.round(totalDuration / shots.length)
  };
}