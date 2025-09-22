/**
 * Project Entity Model
 *
 * CLAUDE.md 준수: 도메인 순수성, 단일 책임 원칙
 * 프로젝트 비즈니스 로직 및 검증
 */

import type {
  Project,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectValidationResult,
  ProjectStatus,
  ProjectPriority,
  ProjectScenarioLink,
} from './types'

/**
 * 프로젝트 도메인 모델
 */
export class ProjectModel {
  /**
   * 새 프로젝트 생성
   */
  static create(input: ProjectCreateInput): Project {
    const now = new Date()
    const id = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return {
      metadata: {
        id,
        title: input.title,
        description: input.description || '',
        createdAt: now,
        updatedAt: now,
        version: '1.0.0',
        tags: input.tags || [],
        author: input.author,
        collaborators: input.collaborators || [],
      },

      settings: {
        status: 'draft',
        priority: input.priority || 'medium',
        dueDate: input.dueDate,
        estimatedDuration: input.estimatedDuration || 60,
        targetFormat: input.targetFormat || 'video',
        autoSave: input.autoSave ?? true,
        versionControl: input.versionControl ?? true,
        approvalRequired: false,
      },

      resources: {
        scenarioIds: [],
        videoAssets: [],
        audioAssets: [],
        imageAssets: [],
        referenceLinks: [],
        documents: [],
      },

      progress: {
        completedTasks: 0,
        totalTasks: 0,
        completionPercentage: 0,
        planning: 0,
        production: 0,
        review: 0,
        milestones: [],
      },
    }
  }

  /**
   * 프로젝트 업데이트
   */
  static update(project: Project, updates: ProjectUpdateInput): Project {
    return {
      ...project,
      metadata: {
        ...project.metadata,
        ...updates.metadata,
        updatedAt: new Date(),
      },
      settings: {
        ...project.settings,
        ...updates.settings,
      },
      resources: {
        ...project.resources,
        ...updates.resources,
      },
      progress: {
        ...project.progress,
        ...updates.progress,
      },
    }
  }

  /**
   * 시나리오 연결
   */
  static linkScenario(
    project: Project,
    scenarioId: string,
    role: 'primary' | 'reference' | 'template' = 'primary'
  ): Project {
    // 이미 연결된 시나리오인지 확인
    if (project.resources.scenarioIds.includes(scenarioId)) {
      return project
    }

    return {
      ...project,
      resources: {
        ...project.resources,
        scenarioIds: [...project.resources.scenarioIds, scenarioId],
      },
      metadata: {
        ...project.metadata,
        updatedAt: new Date(),
      },
    }
  }

  /**
   * 시나리오 연결 해제
   */
  static unlinkScenario(project: Project, scenarioId: string): Project {
    return {
      ...project,
      resources: {
        ...project.resources,
        scenarioIds: project.resources.scenarioIds.filter(id => id !== scenarioId),
      },
      metadata: {
        ...project.metadata,
        updatedAt: new Date(),
      },
    }
  }

  /**
   * 프로젝트 상태 변경
   */
  static changeStatus(project: Project, status: ProjectStatus): Project {
    const updatedProject = {
      ...project,
      settings: {
        ...project.settings,
        status,
      },
      metadata: {
        ...project.metadata,
        updatedAt: new Date(),
      },
    }

    // 상태에 따른 진행률 자동 업데이트
    switch (status) {
      case 'planning':
        updatedProject.progress.planning = Math.max(updatedProject.progress.planning, 10)
        break
      case 'production':
        updatedProject.progress.planning = 100
        updatedProject.progress.production = Math.max(updatedProject.progress.production, 10)
        break
      case 'review':
        updatedProject.progress.planning = 100
        updatedProject.progress.production = 100
        updatedProject.progress.review = Math.max(updatedProject.progress.review, 10)
        break
      case 'completed':
        updatedProject.progress.planning = 100
        updatedProject.progress.production = 100
        updatedProject.progress.review = 100
        updatedProject.progress.completionPercentage = 100
        break
    }

    // 전체 완료율 재계산
    updatedProject.progress.completionPercentage = this.calculateCompletionPercentage(updatedProject)

    return updatedProject
  }

  /**
   * 마일스톤 추가
   */
  static addMilestone(
    project: Project,
    name: string,
    description?: string
  ): Project {
    return {
      ...project,
      progress: {
        ...project.progress,
        milestones: [
          ...project.progress.milestones,
          {
            name,
            completed: false,
            description,
          },
        ],
      },
      metadata: {
        ...project.metadata,
        updatedAt: new Date(),
      },
    }
  }

  /**
   * 마일스톤 완료 처리
   */
  static completeMilestone(project: Project, milestoneName: string): Project {
    const updatedMilestones = project.progress.milestones.map(milestone =>
      milestone.name === milestoneName
        ? { ...milestone, completed: true, completedAt: new Date() }
        : milestone
    )

    const updatedProject = {
      ...project,
      progress: {
        ...project.progress,
        milestones: updatedMilestones,
      },
      metadata: {
        ...project.metadata,
        updatedAt: new Date(),
      },
    }

    // 완료율 재계산
    updatedProject.progress.completionPercentage = this.calculateCompletionPercentage(updatedProject)

    return updatedProject
  }

  /**
   * 프로젝트 검증
   */
  static validate(project: Project): ProjectValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 필수 필드 검증
    if (!project.metadata.title.trim()) {
      errors.push('프로젝트 제목은 필수입니다.')
    }

    if (!project.metadata.author.trim()) {
      errors.push('프로젝트 작성자는 필수입니다.')
    }

    // 기간 검증
    if (project.settings.estimatedDuration <= 0) {
      errors.push('예상 소요 시간은 0보다 커야 합니다.')
    }

    // 마감일 검증
    if (project.settings.dueDate && project.settings.dueDate < new Date()) {
      warnings.push('마감일이 과거 날짜입니다.')
    }

    // 시나리오 연결 검증
    if (project.resources.scenarioIds.length === 0 && project.settings.status !== 'draft') {
      warnings.push('연결된 시나리오가 없습니다.')
    }

    // 진행률 일관성 검증
    const calculatedPercentage = this.calculateCompletionPercentage(project)
    if (Math.abs(project.progress.completionPercentage - calculatedPercentage) > 5) {
      warnings.push('진행률이 실제 상태와 일치하지 않습니다.')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * 완료율 계산
   */
  static calculateCompletionPercentage(project: Project): number {
    const { planning, production, review } = project.progress
    const statusWeights = {
      draft: 0,
      planning: 0.3,
      production: 0.6,
      review: 0.9,
      completed: 1,
      archived: 1,
    }

    // 상태 기반 기본 진행률
    const statusProgress = statusWeights[project.settings.status] * 100

    // 단계별 진행률 평균
    const phaseProgress = (planning + production + review) / 3

    // 마일스톤 진행률
    const completedMilestones = project.progress.milestones.filter(m => m.completed).length
    const totalMilestones = project.progress.milestones.length
    const milestoneProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0

    // 가중 평균으로 최종 진행률 계산
    const finalProgress = (statusProgress * 0.4) + (phaseProgress * 0.4) + (milestoneProgress * 0.2)

    return Math.round(Math.min(100, Math.max(0, finalProgress)))
  }

  /**
   * 프로젝트 요약 정보 생성
   */
  static getSummary(project: Project) {
    const totalScenarios = project.resources.scenarioIds.length
    const completedMilestones = project.progress.milestones.filter(m => m.completed).length
    const totalMilestones = project.progress.milestones.length
    const daysUntilDue = project.settings.dueDate
      ? Math.ceil((project.settings.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null

    return {
      id: project.metadata.id,
      title: project.metadata.title,
      status: project.settings.status,
      priority: project.settings.priority,
      completion: project.progress.completionPercentage,
      totalScenarios,
      milestoneProgress: `${completedMilestones}/${totalMilestones}`,
      daysUntilDue,
      lastUpdated: project.metadata.updatedAt,
    }
  }
}