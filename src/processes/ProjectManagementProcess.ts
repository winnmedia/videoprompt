/**
 * ProjectManagementProcess - 프로젝트 관리 프로세스
 * 프로젝트 생성, 수정, 삭제, 상태 관리 등의 복합 비즈니스 로직
 */

export interface Project {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'in_progress' | 'review' | 'completed' | 'archived';
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    originalIdea?: string;
    scenarioId?: string;
    storyboardIds?: string[];
    videoUrl?: string;
    tags: string[];
  };
}

export interface ProjectStats {
  totalProjects: number;
  completedProjects: number;
  inProgressProjects: number;
  completionRate: number;
}

export class ProjectManagementProcess {
  private projects: Map<string, Project> = new Map();

  /**
   * 새 프로젝트 생성
   */
  async createProject(
    userId: string,
    title: string,
    description: string,
    originalIdea?: string,
    tags: string[] = []
  ): Promise<Project> {
    const project: Project = {
      id: this.generateProjectId(),
      title,
      description,
      status: 'draft',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        originalIdea,
        tags,
      },
    };

    this.projects.set(project.id, project);
    await this.saveProject(project);

    return project;
  }

  /**
   * 프로젝트 정보 업데이트
   */
  async updateProject(
    projectId: string,
    updates: Partial<Pick<Project, 'title' | 'description' | 'status'>>
  ): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('프로젝트를 찾을 수 없습니다.');
    }

    Object.assign(project, updates);
    project.updatedAt = new Date();

    this.projects.set(projectId, project);
    await this.saveProject(project);

    return project;
  }

  /**
   * 프로젝트 메타데이터 업데이트
   */
  async updateProjectMetadata(
    projectId: string,
    metadataUpdates: Partial<Project['metadata']>
  ): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('프로젝트를 찾을 수 없습니다.');
    }

    project.metadata = { ...project.metadata, ...metadataUpdates };
    project.updatedAt = new Date();

    this.projects.set(projectId, project);
    await this.saveProject(project);

    return project;
  }

  /**
   * 프로젝트 상태 변경
   */
  async changeProjectStatus(
    projectId: string,
    newStatus: Project['status']
  ): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('프로젝트를 찾을 수 없습니다.');
    }

    // 상태 변경 유효성 검증
    this.validateStatusTransition(project.status, newStatus);

    project.status = newStatus;
    project.updatedAt = new Date();

    this.projects.set(projectId, project);
    await this.saveProject(project);

    return project;
  }

  /**
   * 사용자별 프로젝트 목록 조회
   */
  async getUserProjects(
    userId: string,
    filters?: {
      status?: Project['status'];
      limit?: number;
      sortBy?: 'createdAt' | 'updatedAt';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<Project[]> {
    let projects = Array.from(this.projects.values()).filter(
      (p) => p.userId === userId
    );

    // 상태 필터링
    if (filters?.status) {
      projects = projects.filter((p) => p.status === filters.status);
    }

    // 정렬
    const sortBy = filters?.sortBy || 'updatedAt';
    const sortOrder = filters?.sortOrder || 'desc';

    projects.sort((a, b) => {
      const aValue = a[sortBy].getTime();
      const bValue = b[sortBy].getTime();
      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

    // 제한
    if (filters?.limit) {
      projects = projects.slice(0, filters.limit);
    }

    return projects;
  }

  /**
   * 프로젝트 삭제
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('프로젝트를 찾을 수 없습니다.');
    }

    if (project.userId !== userId) {
      throw new Error('프로젝트 삭제 권한이 없습니다.');
    }

    this.projects.delete(projectId);
    await this.removeProject(projectId);
  }

  /**
   * 프로젝트 복사
   */
  async duplicateProject(projectId: string, userId: string): Promise<Project> {
    const originalProject = this.projects.get(projectId);
    if (!originalProject) {
      throw new Error('복사할 프로젝트를 찾을 수 없습니다.');
    }

    if (originalProject.userId !== userId) {
      throw new Error('프로젝트 복사 권한이 없습니다.');
    }

    const duplicatedProject: Project = {
      ...originalProject,
      id: this.generateProjectId(),
      title: `${originalProject.title} (복사본)`,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        ...originalProject.metadata,
        // 복사본은 시나리오/스토리보드 연결 해제
        scenarioId: undefined,
        storyboardIds: undefined,
        videoUrl: undefined,
      },
    };

    this.projects.set(duplicatedProject.id, duplicatedProject);
    await this.saveProject(duplicatedProject);

    return duplicatedProject;
  }

  /**
   * 사용자 프로젝트 통계
   */
  async getUserProjectStats(userId: string): Promise<ProjectStats> {
    const userProjects = await this.getUserProjects(userId);

    const totalProjects = userProjects.length;
    const completedProjects = userProjects.filter(
      (p) => p.status === 'completed'
    ).length;
    const inProgressProjects = userProjects.filter(
      (p) => p.status === 'in_progress'
    ).length;
    const completionRate =
      totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

    return {
      totalProjects,
      completedProjects,
      inProgressProjects,
      completionRate: Math.round(completionRate * 100) / 100,
    };
  }

  /**
   * 프로젝트 검색
   */
  async searchProjects(
    userId: string,
    query: string,
    searchFields: Array<'title' | 'description' | 'tags'> = [
      'title',
      'description',
    ]
  ): Promise<Project[]> {
    const userProjects = await this.getUserProjects(userId);
    const searchQuery = query.toLowerCase();

    return userProjects.filter((project) => {
      return searchFields.some((field) => {
        switch (field) {
          case 'title':
            return project.title.toLowerCase().includes(searchQuery);
          case 'description':
            return project.description.toLowerCase().includes(searchQuery);
          case 'tags':
            return project.metadata.tags.some((tag) =>
              tag.toLowerCase().includes(searchQuery)
            );
          default:
            return false;
        }
      });
    });
  }

  // Private 헬퍼 메서드들

  private generateProjectId(): string {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateStatusTransition(
    currentStatus: Project['status'],
    newStatus: Project['status']
  ): void {
    const allowedTransitions: Record<Project['status'], Project['status'][]> = {
      draft: ['in_progress', 'archived'],
      in_progress: ['review', 'draft', 'archived'],
      review: ['completed', 'in_progress'],
      completed: ['archived', 'in_progress'], // 재작업 허용
      archived: ['draft'], // 보관함에서 복원
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `${currentStatus}에서 ${newStatus}로 상태 변경이 불가능합니다.`
      );
    }
  }

  private async saveProject(_project: Project): Promise<void> {
    // 실제로는 데이터베이스에 저장
    // 여기서는 시뮬레이션
    void _project;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async removeProject(_projectId: string): Promise<void> {
    // 실제로는 데이터베이스에서 삭제
    void _projectId;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
