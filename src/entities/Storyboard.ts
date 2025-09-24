/**
 * Storyboard Entity Implementation (TDD GREEN Phase)
 * 콘티(스토리보드) 관리 엔티티
 */

export interface Storyboard {
  id: string;
  projectId: string;
  sceneId: string;
  shotId: string;
  prompt: string;
  style: 'realistic' | 'anime' | 'sketch' | 'watercolor';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  imageUrl?: string;
  consistency?: {
    characterRef?: string[];
    styleRef?: string;
    colorPalette?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

// 유효한 상태 전환 규칙
const VALID_TRANSITIONS: Record<Storyboard['status'], Storyboard['status'][]> =
  {
    pending: ['generating'],
    generating: ['completed', 'failed'],
    completed: ['pending'], // 재생성 가능
    failed: ['pending'], // 재시도 가능
  };

// 스토리보드 생성
export function createStoryboard(
  projectId: string,
  sceneId: string,
  shotId: string,
  prompt: string,
  style: Storyboard['style']
): Storyboard {
  if (!projectId.trim()) {
    throw new Error('프로젝트 ID는 필수입니다');
  }

  if (!sceneId.trim()) {
    throw new Error('씬 ID는 필수입니다');
  }

  if (!shotId.trim()) {
    throw new Error('샷 ID는 필수입니다');
  }

  if (!prompt.trim()) {
    throw new Error('프롬프트는 필수입니다');
  }

  if (prompt.trim().length < 10) {
    throw new Error('프롬프트는 최소 10자 이상이어야 합니다');
  }

  const timestamp = new Date().toISOString();
  const storyboardId = `storyboard_${Date.now()}`;

  return {
    id: storyboardId,
    projectId: projectId.trim(),
    sceneId: sceneId.trim(),
    shotId: shotId.trim(),
    prompt: prompt.trim(),
    style,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// 스토리보드 상태 업데이트
export function updateStoryboardStatus(
  storyboard: Storyboard,
  newStatus: Storyboard['status']
): Storyboard {
  const validTransitions = VALID_TRANSITIONS[storyboard.status];

  if (!validTransitions.includes(newStatus)) {
    throw new Error(
      `${storyboard.status}에서 ${newStatus}로 직접 전환할 수 없습니다`
    );
  }

  return {
    ...storyboard,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
}

// 스토리보드 검증
export function validateStoryboard(storyboard: Partial<Storyboard>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 필수 필드 검사
  if (!storyboard.id) {
    errors.push('ID는 필수입니다');
  }

  if (!storyboard.projectId) {
    errors.push('프로젝트 ID는 필수입니다');
  }

  if (!storyboard.sceneId) {
    errors.push('씬 ID는 필수입니다');
  }

  if (!storyboard.shotId) {
    errors.push('샷 ID는 필수입니다');
  }

  if (!storyboard.prompt) {
    errors.push('프롬프트는 필수입니다');
  } else if (storyboard.prompt.length < 10) {
    errors.push('프롬프트는 최소 10자 이상이어야 합니다');
  } else if (storyboard.prompt.length > 500) {
    errors.push('프롬프트는 500자를 초과할 수 없습니다');
  }

  if (!storyboard.style) {
    errors.push('스타일은 필수입니다');
  } else {
    const validStyles: Storyboard['style'][] = [
      'realistic',
      'anime',
      'sketch',
      'watercolor',
    ];
    if (!validStyles.includes(storyboard.style)) {
      errors.push('유효하지 않은 스타일입니다');
    }
  }

  if (!storyboard.status) {
    errors.push('상태는 필수입니다');
  } else {
    const validStatuses: Storyboard['status'][] = [
      'pending',
      'generating',
      'completed',
      'failed',
    ];
    if (!validStatuses.includes(storyboard.status)) {
      errors.push('유효하지 않은 상태입니다');
    }
  }

  // 완성된 스토리보드는 이미지 URL 필수
  if (storyboard.status === 'completed' && !storyboard.imageUrl) {
    errors.push('완성된 스토리보드는 이미지 URL이 필요합니다');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// 스토리보드에 이미지 첨부
export function attachImageToStoryboard(
  storyboard: Storyboard,
  imageUrl: string
): Storyboard {
  if (!imageUrl.trim()) {
    throw new Error('이미지 URL은 필수입니다');
  }

  // 간단한 URL 형식 검증
  const urlPattern = /^https?:\/\/.+\..+/;
  if (!urlPattern.test(imageUrl.trim())) {
    throw new Error('유효하지 않은 URL 형식입니다');
  }

  return {
    ...storyboard,
    imageUrl: imageUrl.trim(),
    updatedAt: new Date().toISOString(),
  };
}

// 일관성 파라미터 설정
export function setConsistencyParams(
  storyboard: Storyboard,
  params: Partial<Storyboard['consistency']>
): Storyboard {
  if (!params) {
    throw new Error('일관성 파라미터는 필수입니다');
  }

  // 캐릭터 참조 검증
  if (params.characterRef !== undefined) {
    if (params.characterRef.length === 0) {
      throw new Error('캐릭터 참조는 최소 1개 이상이어야 합니다');
    }
  }

  // 색상 팔레트 검증
  if (params.colorPalette !== undefined) {
    if (params.colorPalette.length > 5) {
      throw new Error('색상 팔레트는 최대 5개까지만 허용됩니다');
    }

    // 색상 형식 검증 (hex 형식)
    const hexColorPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    for (const color of params.colorPalette) {
      if (!hexColorPattern.test(color)) {
        throw new Error(`유효하지 않은 색상 형식입니다: ${color}`);
      }
    }
  }

  return {
    ...storyboard,
    consistency: { ...params },
    updatedAt: new Date().toISOString(),
  };
}

// VideoCreationProcess 호환을 위한 클래스 추가
export class StoryboardEntity implements Storyboard {
  public id: string;
  public projectId: string;
  public sceneId: string;
  public shotId: string;
  public prompt: string;
  public style: 'realistic' | 'anime' | 'sketch' | 'watercolor';
  public status: 'pending' | 'generating' | 'completed' | 'failed';
  public imageUrl?: string;
  public consistency?: {
    characterRef?: string[];
    styleRef?: string;
    colorPalette?: string[];
  };
  public createdAt: string;
  public updatedAt: string;

  constructor(
    id: string,
    title: string,
    description: string,
    imageUrl?: string
  ) {
    this.id = id;
    this.projectId = 'temp_project';
    this.sceneId = 'temp_scene';
    this.shotId = 'temp_shot';
    this.prompt = `${title}: ${description}`;
    this.style = 'realistic';
    this.status = 'completed';
    this.imageUrl = imageUrl;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
}
