/**
 * Project Entity Implementation (TDD GREEN Phase)
 * 프로젝트 관리 엔티티
 */

export interface Project {
  id: string;
  title: string;
  description: string;
  userId: string;
  storyId?: string;
  status: 'planning' | 'storyboard' | 'production' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// 유효한 상태 전환 규칙
const VALID_TRANSITIONS: Record<Project['status'], Project['status'][]> = {
  planning: ['storyboard', 'production'], // planning에서 completed 직접 불가
  storyboard: ['planning', 'production'],
  production: ['storyboard', 'completed'],
  completed: ['production'], // 완료에서 다시 프로덕션으로만 가능
};

// 프로젝트 생성
export function createProject(
  title: string,
  description: string,
  userId: string
): Project {
  if (!title.trim()) {
    throw new Error('프로젝트 제목은 필수입니다');
  }

  if (!description.trim()) {
    throw new Error('프로젝트 설명은 필수입니다');
  }

  if (!userId.trim()) {
    throw new Error('사용자 ID는 필수입니다');
  }

  const timestamp = new Date().toISOString();
  const projectId = `project_${Date.now()}`;

  return {
    id: projectId,
    title: title.trim(),
    description: description.trim(),
    userId: userId.trim(),
    status: 'planning',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// 프로젝트 상태 업데이트
export function updateProjectStatus(
  project: Project,
  newStatus: Project['status']
): Project {
  const validTransitions = VALID_TRANSITIONS[project.status];

  if (!validTransitions.includes(newStatus)) {
    throw new Error(
      `${project.status}에서 ${newStatus}로 직접 전환할 수 없습니다`
    );
  }

  return {
    ...project,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
}

// 프로젝트 검증
export function validateProject(project: Partial<Project>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 필수 필드 검사
  if (!project.title) {
    errors.push('제목은 필수입니다');
  } else if (project.title.length > 150) {
    errors.push('제목은 150자를 초과할 수 없습니다');
  }

  if (!project.description) {
    errors.push('설명은 필수입니다');
  } else if (project.description.length < 20) {
    errors.push('설명은 최소 20자 이상이어야 합니다');
  }

  if (!project.id) {
    errors.push('ID는 필수입니다');
  }

  if (!project.userId) {
    errors.push('사용자 ID는 필수입니다');
  }

  if (!project.status) {
    errors.push('상태는 필수입니다');
  } else {
    const validStatuses: Project['status'][] = [
      'planning',
      'storyboard',
      'production',
      'completed',
    ];
    if (!validStatuses.includes(project.status)) {
      errors.push('유효하지 않은 상태입니다');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// 프로젝트에 스토리 연결
export function attachStoryToProject(
  project: Project,
  storyId: string
): Project {
  if (!storyId.trim()) {
    throw new Error('스토리 ID는 필수입니다');
  }

  if (project.storyId === storyId) {
    throw new Error('스토리가 이미 프로젝트에 연결되어 있습니다');
  }

  return {
    ...project,
    storyId: storyId.trim(),
    updatedAt: new Date().toISOString(),
  };
}
