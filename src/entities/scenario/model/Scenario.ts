/**
 * Scenario Entity Implementation
 * 시나리오 도메인 모델 및 비즈니스 로직
 */

// 씬 타입 정의 (기승전결)
export type SceneType = '기' | '승' | '전' | '결';

// 씬 인터페이스
export interface Scene {
  id: string;
  title: string;
  description: string;
  type: SceneType;
  duration: number; // 초 단위
  content: string;
  order: number;
}

// 시나리오 상태
export type ScenarioStatus = 'draft' | 'completed' | 'published' | 'archived';

// 시나리오 인터페이스
export interface Scenario {
  id: string;
  title: string;
  description: string;
  scenes: Scene[];
  totalDuration: number; // 초 단위
  createdAt: string;
  updatedAt: string;
  status: ScenarioStatus;
  genre: string;
  targetAudience: string;
}

// 검증 결과 인터페이스
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * 새로운 시나리오 생성
 */
export function createScenario(
  title: string,
  description: string,
  genre: string,
  targetAudience: string
): Scenario {
  if (!title.trim()) {
    throw new Error('제목은 필수입니다');
  }
  if (!description.trim()) {
    throw new Error('설명은 필수입니다');
  }

  const now = new Date().toISOString();

  return {
    id: `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: title.trim(),
    description: description.trim(),
    scenes: [],
    totalDuration: 0,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    genre: genre.trim(),
    targetAudience: targetAudience.trim(),
  };
}

/**
 * 시나리오에 씬 추가
 */
export function addScene(
  scenario: Scenario,
  sceneData: Omit<Scene, 'id' | 'order'>
): Scenario {
  const newScene: Scene = {
    ...sceneData,
    id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    order: scenario.scenes.length + 1,
  };

  const updatedScenes = [...scenario.scenes, newScene];
  const totalDuration = calculateScenarioTotalDuration(updatedScenes);

  return {
    ...scenario,
    scenes: updatedScenes,
    totalDuration,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 씬 업데이트
 */
export function updateScene(
  scenario: Scenario,
  sceneId: string,
  updates: Partial<Omit<Scene, 'id' | 'order'>>
): Scenario {
  const sceneIndex = scenario.scenes.findIndex((scene) => scene.id === sceneId);
  if (sceneIndex === -1) {
    throw new Error('씬을 찾을 수 없습니다');
  }

  const updatedScenes = scenario.scenes.map((scene, index) =>
    index === sceneIndex ? { ...scene, ...updates } : scene
  );

  const totalDuration = calculateScenarioTotalDuration(updatedScenes);

  return {
    ...scenario,
    scenes: updatedScenes,
    totalDuration,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 씬 제거
 */
export function removeScene(scenario: Scenario, sceneId: string): Scenario {
  const updatedScenes = scenario.scenes
    .filter((scene) => scene.id !== sceneId)
    .map((scene, index) => ({ ...scene, order: index + 1 }));

  const totalDuration = calculateScenarioTotalDuration(updatedScenes);

  return {
    ...scenario,
    scenes: updatedScenes,
    totalDuration,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 씬 순서 변경
 */
export function reorderScenes(
  scenario: Scenario,
  sceneId: string,
  newOrder: number
): Scenario {
  const scene = scenario.scenes.find((s) => s.id === sceneId);
  if (!scene) {
    throw new Error('씬을 찾을 수 없습니다');
  }

  const otherScenes = scenario.scenes.filter((s) => s.id !== sceneId);
  const reorderedScenes = [...otherScenes];
  reorderedScenes.splice(newOrder - 1, 0, scene);

  // 순서 재정렬
  const finalScenes = reorderedScenes.map((s, index) => ({
    ...s,
    order: index + 1,
  }));

  return {
    ...scenario,
    scenes: finalScenes,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 시나리오 검증
 */
export function validateScenario(scenario: Scenario): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 필수 검증
  if (scenario.scenes.length === 0) {
    errors.push('최소 1개의 씬이 필요합니다');
  }

  if (!scenario.title.trim()) {
    errors.push('제목은 필수입니다');
  }

  if (!scenario.description.trim()) {
    errors.push('설명은 필수입니다');
  }

  // 4단 구조 권장
  if (scenario.scenes.length !== 4) {
    warnings.push('기승전결 4단 구조를 권장합니다');
  }

  // 씬 타입 체크
  const sceneTypes = scenario.scenes.map((scene) => scene.type);
  const expectedTypes: SceneType[] = ['기', '승', '전', '결'];

  if (scenario.scenes.length === 4) {
    const missingTypes = expectedTypes.filter(
      (type) => !sceneTypes.includes(type)
    );
    if (missingTypes.length > 0) {
      warnings.push(`누락된 구조: ${missingTypes.join(', ')}`);
    }
  }

  // 지속시간 검증
  if (scenario.totalDuration > 600) {
    // 10분 초과
    warnings.push('영상이 10분을 초과합니다. 시청자 집중도를 고려해보세요.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 시나리오 총 지속시간 계산
 */
export function calculateScenarioDuration(scenario: Scenario): number {
  return calculateScenarioTotalDuration(scenario.scenes);
}

/**
 * 씬들의 총 지속시간 계산 (헬퍼 함수)
 */
function calculateScenarioTotalDuration(scenes: Scene[]): number {
  return scenes.reduce((total, scene) => total + scene.duration, 0);
}
