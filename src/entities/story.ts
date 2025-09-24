/**
 * 4단계 스토리 엔티티 (기승전결 구조)
 * UserJourneyMap 5-6단계 완전 구현
 */

export interface StoryAct {
  id: string;
  actNumber: 1 | 2 | 3 | 4;
  title: string;
  content: string;
  thumbnail?: string; // 대표 썸네일 이미지 URL
  duration: number; // 예상 진행 시간 (초)
  keyEvents: string[]; // 주요 사건들
  emotions: 'tension' | 'calm' | 'excitement' | 'sadness' | 'hope' | 'fear';
  characterFocus: string[]; // 중심 인물들
}

export interface FourActStory {
  id: string;
  title: string;
  synopsis: string;
  genre: 'drama' | 'action' | 'comedy' | 'documentary' | 'educational' | 'thriller' | 'romance';
  targetAudience: 'general' | 'kids' | 'teen' | 'adult' | 'senior';
  tone: 'serious' | 'light' | 'dramatic' | 'humorous' | 'mysterious';

  // 4단계 구조 (기승전결)
  acts: {
    setup: StoryAct;      // Act 1: 도입 (Setup)
    development: StoryAct; // Act 2: 전개 (Development)
    climax: StoryAct;     // Act 3: 절정 (Climax)
    resolution: StoryAct;  // Act 4: 결말 (Resolution)
  };

  // 메타데이터
  status: 'draft' | 'inProgress' | 'completed' | 'published';
  userId: string;
  scenarioId?: string; // 연결된 시나리오 ID
  totalDuration: number; // 전체 예상 시간 (초)

  // AI 생성 관련
  aiGenerated: boolean;
  aiPrompt?: string;
  aiModel?: 'gemini' | 'gpt-4' | 'claude';
  generationParams?: {
    creativity: number; // 0-100
    intensity: number;  // 0-100
    pacing: 'slow' | 'medium' | 'fast';
  };

  // 타임스탬프
  createdAt: string;
  updatedAt: string;
}

// 4단계 스토리 생성 파라미터
export interface StoryGenerationParams {
  title: string;
  synopsis: string;
  genre: FourActStory['genre'];
  targetAudience: FourActStory['targetAudience'];
  tone: FourActStory['tone'];
  creativity: number; // 0-100
  intensity: number;  // 0-100
  pacing: 'slow' | 'medium' | 'fast';
  keyCharacters?: string[];
  keyThemes?: string[];
  specialRequirements?: string;
}

// Act 기본 템플릿
export const ACT_TEMPLATES = {
  setup: {
    title: '도입 (Setup)',
    description: '등장인물과 배경을 소개하고 갈등의 씨앗을 뿌립니다',
    expectedDuration: 60, // 1분
    keyElements: ['인물 소개', '배경 설정', '갈등 제시', '목표 설정']
  },
  development: {
    title: '전개 (Development)',
    description: '갈등이 심화되고 복잡해지며 긴장감이 고조됩니다',
    expectedDuration: 120, // 2분
    keyElements: ['갈등 심화', '장애물 등장', '캐릭터 발전', '복잡성 증가']
  },
  climax: {
    title: '절정 (Climax)',
    description: '가장 극적인 순간으로 모든 갈등이 정점에 달합니다',
    expectedDuration: 90, // 1.5분
    keyElements: ['최고 긴장감', '결정적 순간', '운명의 선택', '전환점']
  },
  resolution: {
    title: '결말 (Resolution)',
    description: '갈등이 해결되고 새로운 균형 상태에 도달합니다',
    expectedDuration: 60, // 1분
    keyElements: ['갈등 해결', '여운', '메시지 전달', '새로운 시작']
  }
} as const;

// 4단계 스토리 생성 함수
export function createFourActStory(
  params: StoryGenerationParams,
  userId: string
): FourActStory {
  if (!params.title.trim()) {
    throw new Error('제목은 필수입니다');
  }

  if (!params.synopsis.trim()) {
    throw new Error('줄거리는 필수입니다');
  }

  if (params.creativity < 0 || params.creativity > 100) {
    throw new Error('창의성 수치는 0-100 사이여야 합니다');
  }

  if (params.intensity < 0 || params.intensity > 100) {
    throw new Error('강도 수치는 0-100 사이여야 합니다');
  }

  const timestamp = new Date().toISOString();
  const storyId = `story_${Date.now()}`;

  // 각 Act 기본 구조 생성
  const createAct = (actNumber: 1 | 2 | 3 | 4, actType: keyof typeof ACT_TEMPLATES): StoryAct => {
    const template = ACT_TEMPLATES[actType];
    return {
      id: `${storyId}_act_${actNumber}`,
      actNumber,
      title: template.title,
      content: '', // AI로 생성될 예정
      duration: template.expectedDuration,
      keyEvents: [],
      emotions: actNumber === 1 ? 'calm' :
               actNumber === 2 ? 'tension' :
               actNumber === 3 ? 'excitement' : 'hope',
      characterFocus: params.keyCharacters || []
    };
  };

  return {
    id: storyId,
    title: params.title.trim(),
    synopsis: params.synopsis.trim(),
    genre: params.genre,
    targetAudience: params.targetAudience,
    tone: params.tone,

    acts: {
      setup: createAct(1, 'setup'),
      development: createAct(2, 'development'),
      climax: createAct(3, 'climax'),
      resolution: createAct(4, 'resolution')
    },

    status: 'draft',
    userId,
    totalDuration: 330, // 5.5분 기본값

    aiGenerated: false,
    generationParams: {
      creativity: params.creativity,
      intensity: params.intensity,
      pacing: params.pacing
    },

    createdAt: timestamp,
    updatedAt: timestamp
  };
}

// Act 업데이트 함수
export function updateStoryAct(
  story: FourActStory,
  actType: keyof FourActStory['acts'],
  updates: Partial<StoryAct>
): FourActStory {
  const updatedAct = {
    ...story.acts[actType],
    ...updates,
    id: story.acts[actType].id, // ID는 변경 불가
    actNumber: story.acts[actType].actNumber // actNumber 변경 불가
  };

  return {
    ...story,
    acts: {
      ...story.acts,
      [actType]: updatedAct
    },
    updatedAt: new Date().toISOString()
  };
}

// 스토리 완성도 검증
export function validateFourActStory(story: FourActStory): {
  isValid: boolean;
  completionPercentage: number;
  errors: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let completedFields = 0;
  const totalFields = 12; // 기본 필드 + 각 Act의 핵심 필드

  // 기본 필드 검증
  if (!story.title) errors.push('제목은 필수입니다');
  else completedFields++;

  if (!story.synopsis) errors.push('줄거리는 필수입니다');
  else completedFields++;

  if (story.synopsis && story.synopsis.length < 20) {
    suggestions.push('줄거리를 더 자세히 작성하면 좋겠습니다 (현재 ' + story.synopsis.length + '자)');
  }

  // 각 Act 검증
  Object.entries(story.acts).forEach(([actType, act]) => {
    if (!act.content) {
      errors.push(`${ACT_TEMPLATES[actType as keyof typeof ACT_TEMPLATES].title}의 내용이 없습니다`);
    } else {
      completedFields++;
      if (act.content.length < 50) {
        suggestions.push(`${act.title}의 내용을 더 구체적으로 작성해보세요`);
      }
    }

    if (act.keyEvents.length === 0) {
      suggestions.push(`${act.title}에 주요 사건들을 추가해보세요`);
    } else {
      completedFields++;
    }
  });

  // 전체 스토리 흐름 검증
  const totalDuration = Object.values(story.acts).reduce((sum, act) => sum + act.duration, 0);
  if (totalDuration !== story.totalDuration) {
    suggestions.push('각 Act의 시간을 조정하여 전체 시간과 맞춰보세요');
  }

  // 캐릭터 일관성 검증
  const allCharacters = new Set<string>();
  Object.values(story.acts).forEach(act => {
    act.characterFocus.forEach(char => allCharacters.add(char));
  });

  if (allCharacters.size === 0) {
    suggestions.push('주요 등장인물을 각 Act에 설정해보세요');
  }

  const completionPercentage = Math.round((completedFields / totalFields) * 100);

  // 완성도에 따른 추가 제안
  if (completionPercentage < 50) {
    suggestions.push('스토리의 기본 구조를 먼저 완성해보세요');
    suggestions.push('등장인물의 특성과 동기를 더 명확히 해보세요');
  } else if (completionPercentage < 80) {
    suggestions.push('각 Act의 세부 내용을 보강하면 더 완성도 있는 스토리가 될 것입니다');
    suggestions.push('등장인물 간의 관계를 더 깊이 있게 발전시켜보세요');
  } else if (completionPercentage >= 90) {
    suggestions.push('훌륭합니다! 썸네일 생성을 통해 시각적 완성도를 높여보세요');
  }

  return {
    isValid: errors.length === 0 && completionPercentage >= 70,
    completionPercentage,
    errors,
    suggestions
  };
}

// 썸네일 생성을 위한 프롬프트 추출
export function extractThumbnailPrompt(act: StoryAct, story: FourActStory): string {
  const basePrompt = `${story.genre} genre, ${story.tone} tone`;
  const characterInfo = act.characterFocus.length > 0 ?
    `, featuring ${act.characterFocus.join(', ')}` : '';
  const emotionInfo = `, ${act.emotions} atmosphere`;
  const sceneDescription = act.content.slice(0, 200); // 첫 200자만 사용

  return `${basePrompt}${characterInfo}${emotionInfo}. Scene: ${sceneDescription}`;
}

// 스토리를 12단계 숏트로 변환하기 위한 준비 함수
export function prepareForShotBreakdown(story: FourActStory): {
  actBreakdowns: Array<{
    actType: keyof FourActStory['acts'];
    act: StoryAct;
    suggestedShots: number;
    pacing: 'slow' | 'medium' | 'fast';
  }>;
  totalShots: number;
} {
  const pacing = story.generationParams?.pacing || 'medium';

  // 각 Act별 권장 숏트 수 (총 12개가 되도록 조정)
  const shotDistribution = {
    slow: { setup: 4, development: 4, climax: 3, resolution: 1 },
    medium: { setup: 3, development: 4, climax: 3, resolution: 2 },
    fast: { setup: 2, development: 3, climax: 4, resolution: 3 }
  };

  const distribution = shotDistribution[pacing];

  const actBreakdowns = Object.entries(story.acts).map(([actType, act]) => ({
    actType: actType as keyof FourActStory['acts'],
    act,
    suggestedShots: distribution[actType as keyof typeof distribution],
    pacing
  }));

  return {
    actBreakdowns,
    totalShots: 12
  };
}