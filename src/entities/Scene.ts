/**
 * Scene Entity Implementation (TDD GREEN Phase)
 * Story와 Shot을 연결하는 Scene 엔티티
 */

export interface Scene {
  id: string;
  storyId: string;
  title: string;
  description: string;
  order: number; // 1-4 (4단계 구조)
  duration: number; // seconds
  shots: string[]; // Shot IDs (최대 3개)
  createdAt: string;
  updatedAt: string;
}

// 씬 생성
export function createScene(
  storyId: string,
  title: string,
  description: string,
  order: number
): Scene {
  if (!storyId.trim()) {
    throw new Error('스토리 ID는 필수입니다');
  }

  if (!title.trim()) {
    throw new Error('씬 제목은 필수입니다');
  }

  if (order < 1 || order > 4) {
    throw new Error('순서는 1-4 사이여야 합니다');
  }

  const timestamp = new Date().toISOString();
  const sceneId = `scene_${Date.now()}`;

  return {
    id: sceneId,
    storyId: storyId.trim(),
    title: title.trim(),
    description: description.trim(),
    order,
    duration: 0, // 기본값
    shots: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// 씬 순서 업데이트
export function updateSceneOrder(
  scenes: Scene[],
  sceneId: string,
  newOrder: number
): Scene[] {
  if (newOrder < 1 || newOrder > 4) {
    throw new Error('순서는 1-4 사이여야 합니다');
  }

  const sceneIndex = scenes.findIndex((scene) => scene.id === sceneId);
  if (sceneIndex === -1) {
    throw new Error('해당 ID의 씬을 찾을 수 없습니다');
  }

  const originalOrder = scenes[sceneIndex].order;

  // 변경이 필요 없는 경우
  if (originalOrder === newOrder) {
    return scenes;
  }

  const timestamp = new Date().toISOString();

  // 모든 씬의 복사본 생성
  const updatedScenes = scenes.map((scene) => ({ ...scene }));

  // 대상 씬의 순서 설정
  const targetScene = updatedScenes.find((scene) => scene.id === sceneId);
  if (targetScene) {
    targetScene.order = newOrder;
    targetScene.updatedAt = timestamp;
  }

  // 다른 씬들의 순서 조정
  updatedScenes.forEach((scene) => {
    if (scene.id === sceneId) {
      return; // 대상 씬은 이미 처리됨
    }

    const currentOrder = scene.order;

    if (originalOrder < newOrder) {
      // 뒤로 이동: originalOrder 초과이고 newOrder 이하인 씬들을 앞으로 당기기
      if (currentOrder > originalOrder && currentOrder <= newOrder) {
        scene.order = currentOrder - 1;
        scene.updatedAt = timestamp;
      }
    } else {
      // 앞으로 이동: newOrder 이상이고 originalOrder 미만인 씬들을 뒤로 밀기
      if (currentOrder >= newOrder && currentOrder < originalOrder) {
        scene.order = currentOrder + 1;
        scene.updatedAt = timestamp;
      }
    }
  });

  return updatedScenes;
}

// 씬 검증
export function validateScene(scene: Partial<Scene>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 필수 필드 검사
  if (!scene.id) {
    errors.push('씬 ID는 필수입니다');
  }

  if (!scene.storyId) {
    errors.push('스토리 ID는 필수입니다');
  }

  if (!scene.title) {
    errors.push('제목은 필수입니다');
  }

  if (!scene.description) {
    errors.push('설명은 필수입니다');
  } else if (scene.description.length < 10) {
    errors.push('설명은 최소 10자 이상이어야 합니다');
  }

  if (scene.order === undefined || scene.order === null) {
    errors.push('순서는 필수입니다');
  } else if (scene.order < 1 || scene.order > 4) {
    errors.push('순서는 1-4 사이여야 합니다');
  }

  // 지속시간 검사
  if (
    scene.duration !== undefined &&
    scene.duration !== null &&
    scene.duration < 0
  ) {
    errors.push('지속시간은 0 이상이어야 합니다');
  }

  // 샷 개수 검사
  if (scene.shots && scene.shots.length > 3) {
    errors.push('씬당 최대 3개의 샷만 허용됩니다');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// 씬에 샷 추가
export function addShotToScene(scene: Scene, shotId: string): Scene {
  if (!shotId.trim()) {
    throw new Error('샷 ID는 필수입니다');
  }

  if (scene.shots.includes(shotId)) {
    throw new Error('샷이 이미 씬에 추가되어 있습니다');
  }

  if (scene.shots.length >= 3) {
    throw new Error('씬당 최대 3개의 샷만 허용됩니다');
  }

  return {
    ...scene,
    shots: [...scene.shots, shotId.trim()],
    updatedAt: new Date().toISOString(),
  };
}

// 씬에서 샷 제거
export function removeShotFromScene(scene: Scene, shotId: string): Scene {
  if (!scene.shots.includes(shotId)) {
    throw new Error('샷이 씬에 존재하지 않습니다');
  }

  return {
    ...scene,
    shots: scene.shots.filter((id) => id !== shotId),
    updatedAt: new Date().toISOString(),
  };
}
