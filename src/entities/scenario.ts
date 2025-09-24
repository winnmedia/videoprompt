/**
 * 시나리오 엔티티
 * UserJourneyMap 3-4단계 대응
 * 시나리오 제목, 내용, 드롭다운 요소, 전개 방식, 강도 관리
 */

// 시나리오 기본 정보
export interface Scenario {
  id: string;
  title: string;
  content: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  status: ScenarioStatus;
  metadata: ScenarioMetadata;
}

// 시나리오 상태
export type ScenarioStatus =
  | 'draft'      // 초안
  | 'generating' // 생성 중
  | 'completed'  // 완성
  | 'error';     // 오류

// 시나리오 메타데이터
export interface ScenarioMetadata {
  genre: Genre;
  style: Style;
  target: Target;
  structure: StoryStructure;
  intensity: IntensityLevel;
  estimatedDuration: number;
  qualityScore: number;
  tokens: number;
  cost: number;
}

// 장르 옵션 (드롭다운 메뉴)
export type Genre =
  | 'drama'        // 드라마
  | 'comedy'       // 코미디
  | 'romance'      // 로맨스
  | 'thriller'     // 스릴러
  | 'horror'       // 호러
  | 'fantasy'      // 판타지
  | 'sci-fi'       // SF
  | 'action'       // 액션
  | 'mystery'      // 미스터리
  | 'slice-of-life' // 일상
  | 'documentary'  // 다큐멘터리
  | 'animation';   // 애니메이션

// 스타일 옵션 (드롭다운 메뉴)
export type Style =
  | 'realistic'    // 현실적
  | 'stylized'     // 양식화된
  | 'minimalist'   // 미니멀
  | 'dramatic'     // 극적
  | 'comedic'      // 코믹
  | 'poetic'       // 시적
  | 'raw'          // 날것의
  | 'polished'     // 세련된
  | 'experimental' // 실험적
  | 'commercial'   // 상업적
  | 'artistic'     // 예술적
  | 'documentary'; // 다큐멘터리

// 타겟 옵션 (드롭다운 메뉴)
export type Target =
  | 'children'     // 어린이 (7-12세)
  | 'teens'        // 청소년 (13-19세)
  | 'young-adults' // 청년 (20-35세)
  | 'adults'       // 성인 (36-55세)
  | 'seniors'      // 시니어 (55세+)
  | 'family'       // 가족
  | 'general'      // 일반
  | 'niche'        // 틈새
  | 'professional' // 전문가
  | 'international'; // 국제

// 스토리 구조 (전개 방식)
export type StoryStructure =
  | 'traditional'  // 기승전결 (4단계)
  | 'three-act'    // 3막 구조
  | 'free-form'    // 자유형
  | 'episodic'     // 에피소드형
  | 'circular'     // 순환형
  | 'non-linear'   // 비선형
  | 'montage'      // 몽타주
  | 'vignette';    // 비네트

// 전개 강도
export type IntensityLevel =
  | 'low'    // 약함 (잔잔한)
  | 'medium' // 보통 (적당한)
  | 'high';  // 강함 (강렬한)

// 시나리오 생성 요청
export interface ScenarioGenerationRequest {
  title: string;
  content: string;
  genre: Genre;
  style: Style;
  target: Target;
  structure: StoryStructure;
  intensity: IntensityLevel;
}

// 시나리오 생성 응답
export interface ScenarioGenerationResponse {
  scenario: Scenario;
  feedback: string[];
  suggestions: string[];
  alternatives: Partial<ScenarioMetadata>[];
}

// 드롭다운 옵션 라벨 매핑
export const GENRE_LABELS: Record<Genre, string> = {
  drama: '드라마',
  comedy: '코미디',
  romance: '로맨스',
  thriller: '스릴러',
  horror: '호러',
  fantasy: '판타지',
  'sci-fi': 'SF',
  action: '액션',
  mystery: '미스터리',
  'slice-of-life': '일상',
  documentary: '다큐멘터리',
  animation: '애니메이션',
};

export const STYLE_LABELS: Record<Style, string> = {
  realistic: '현실적',
  stylized: '양식화된',
  minimalist: '미니멀',
  dramatic: '극적',
  comedic: '코믹',
  poetic: '시적',
  raw: '날것의',
  polished: '세련된',
  experimental: '실험적',
  commercial: '상업적',
  artistic: '예술적',
  documentary: '다큐멘터리',
};

export const TARGET_LABELS: Record<Target, string> = {
  children: '어린이 (7-12세)',
  teens: '청소년 (13-19세)',
  'young-adults': '청년 (20-35세)',
  adults: '성인 (36-55세)',
  seniors: '시니어 (55세+)',
  family: '가족',
  general: '일반',
  niche: '틈새',
  professional: '전문가',
  international: '국제',
};

export const STRUCTURE_LABELS: Record<StoryStructure, string> = {
  traditional: '기승전결 (4단계)',
  'three-act': '3막 구조',
  'free-form': '자유형',
  episodic: '에피소드형',
  circular: '순환형',
  'non-linear': '비선형',
  montage: '몽타주',
  vignette: '비네트',
};

export const INTENSITY_LABELS: Record<IntensityLevel, string> = {
  low: '약함 (잔잔한)',
  medium: '보통 (적당한)',
  high: '강함 (강렬한)',
};

// 드롭다운 옵션 배열
export const GENRE_OPTIONS = Object.entries(GENRE_LABELS).map(([value, label]) => ({
  value: value as Genre,
  label,
}));

export const STYLE_OPTIONS = Object.entries(STYLE_LABELS).map(([value, label]) => ({
  value: value as Style,
  label,
}));

export const TARGET_OPTIONS = Object.entries(TARGET_LABELS).map(([value, label]) => ({
  value: value as Target,
  label,
}));

export const STRUCTURE_OPTIONS = Object.entries(STRUCTURE_LABELS).map(([value, label]) => ({
  value: value as StoryStructure,
  label,
}));

export const INTENSITY_OPTIONS = Object.entries(INTENSITY_LABELS).map(([value, label]) => ({
  value: value as IntensityLevel,
  label,
}));

// 유틸리티 함수
export function createScenarioId(): string {
  return `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getDefaultScenario(): Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    content: '',
    userId: '',
    status: 'draft',
    metadata: {
      genre: 'drama',
      style: 'realistic',
      target: 'general',
      structure: 'traditional',
      intensity: 'medium',
      estimatedDuration: 10,
      qualityScore: 0,
      tokens: 0,
      cost: 0,
    },
  };
}

export function validateScenario(scenario: Partial<Scenario>): string[] {
  const errors: string[] = [];

  if (!scenario.title?.trim()) {
    errors.push('시나리오 제목은 필수입니다.');
  }

  if (!scenario.content?.trim()) {
    errors.push('시나리오 내용은 필수입니다.');
  }

  if (scenario.title && scenario.title.length > 100) {
    errors.push('제목은 100자를 초과할 수 없습니다.');
  }

  if (scenario.content && scenario.content.length < 50) {
    errors.push('내용은 최소 50자 이상이어야 합니다.');
  }

  if (scenario.content && scenario.content.length > 5000) {
    errors.push('내용은 5000자를 초과할 수 없습니다.');
  }

  return errors;
}

export function isScenarioValid(scenario: Partial<Scenario>): boolean {
  return validateScenario(scenario).length === 0;
}

export function calculateScenarioProgress(scenario: Partial<Scenario>): number {
  let progress = 0;

  if (scenario.title?.trim()) progress += 20;
  if (scenario.content?.trim()) progress += 30;
  if (scenario.metadata?.genre) progress += 10;
  if (scenario.metadata?.style) progress += 10;
  if (scenario.metadata?.target) progress += 10;
  if (scenario.metadata?.structure) progress += 10;
  if (scenario.metadata?.intensity) progress += 10;

  return Math.min(progress, 100);
}

// 구조별 설명
export const STRUCTURE_DESCRIPTIONS: Record<StoryStructure, string> = {
  traditional: '기-승-전-결의 4단계 구조로 안정적이고 이해하기 쉬운 전개',
  'three-act': '설정-대립-해결의 3막 구조로 서구권에서 널리 사용되는 방식',
  'free-form': '정해진 구조 없이 창의적이고 자유로운 전개',
  episodic: '여러 개의 독립적인 에피소드로 구성된 구조',
  circular: '시작과 끝이 연결되는 순환적 구조',
  'non-linear': '시간 순서를 따르지 않는 비선형적 전개',
  montage: '여러 장면을 조합하여 의미를 만드는 구조',
  vignette: '짧고 인상적인 장면들로 구성된 구조',
};

// 강도별 특징
export const INTENSITY_DESCRIPTIONS: Record<IntensityLevel, string> = {
  low: '일상적이고 평화로운 분위기로 감정적 몰입도가 낮음',
  medium: '적당한 긴장감과 감정적 기복으로 균형 잡힌 전개',
  high: '강렬한 감정과 극적 상황으로 높은 몰입도 제공',
};