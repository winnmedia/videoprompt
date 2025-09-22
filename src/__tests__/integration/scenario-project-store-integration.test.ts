/**
 * Scenario-Project Store Integration Test
 *
 * CLAUDE.md 준수: TDD, MSW 모킹, 결정론적 테스트
 * $300 사건 방지: API 모킹으로 실제 호출 차단
 */

import { configureStore } from '@reduxjs/toolkit'
import { setupMswForTests, scenarioTestUtils } from '../../shared/testing/msw/setup'
import { costSafetyTestUtils } from '../../shared/lib/cost-safety-middleware'

// Entities
import scenarioReducer, { scenarioActions, scenarioSelectors, type ScenarioState } from '../../entities/scenario/store'
import projectReducer, { projectActions, projectSelectors, type ProjectState } from '../../entities/project/store'
import { ProjectModel } from '../../entities/project/model'
import type { Project, ProjectCreateInput } from '../../entities/project/types'
import type { Scenario, ScenarioCreateInput } from '../../entities/scenario/types'

// Test Store Setup
const createTestStore = () => {
  return configureStore({
    reducer: {
      scenario: scenarioReducer,
      project: projectReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  })
}

type TestRootState = {
  scenario: ScenarioState
  project: ProjectState
}

// MSW Setup
setupMswForTests()

describe('Scenario-Project Store Integration', () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    store = createTestStore()
    scenarioTestUtils.resetApiLimiter()
    costSafetyTestUtils.resetTracker()
  })

  afterEach(() => {
    scenarioTestUtils.clearMockScenarios()
  })

  describe('프로젝트-시나리오 연결 기능', () => {
    it('프로젝트에 시나리오를 연결할 수 있다', () => {
      // Given: 프로젝트와 시나리오 생성
      const projectInput: ProjectCreateInput = {
        title: '테스트 프로젝트',
        description: '통합 테스트용 프로젝트',
        author: 'test-user',
        estimatedDuration: 120,
      }

      const mockScenario: Scenario = {
        metadata: {
          id: 'scenario-test-001',
          title: '테스트 시나리오',
          description: '테스트용 시나리오',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['test'],
          author: 'test-user',
        },
        content: {
          genre: 'drama',
          mood: 'serious',
          targetAudience: 'adult',
          duration: 120,
          language: 'ko',
          themes: ['test'],
        },
        scenes: [],
        totalDuration: 0,
        structure: { acts: [] },
      }

      // When: 프로젝트 생성 후 시나리오 연결
      store.dispatch(projectActions.createProject(projectInput))
      store.dispatch(scenarioActions.setCurrentScenario(mockScenario))
      store.dispatch(projectActions.linkScenarioToCurrentProject('scenario-test-001'))

      // Then: 연결 상태 확인
      const state = store.getState()
      const currentProject = projectSelectors.getCurrentProject(state)
      const currentScenario = scenarioSelectors.getCurrentScenario(state)

      expect(currentProject).toBeTruthy()
      expect(currentScenario).toBeTruthy()
      expect(currentProject?.resources.scenarioIds).toContain('scenario-test-001')
    })

    it('프로젝트에서 시나리오 연결을 해제할 수 있다', () => {
      // Given: 연결된 프로젝트-시나리오
      const projectInput: ProjectCreateInput = {
        title: '테스트 프로젝트',
        author: 'test-user',
      }

      store.dispatch(projectActions.createProject(projectInput))
      store.dispatch(projectActions.linkScenarioToCurrentProject('scenario-test-001'))

      // When: 연결 해제
      store.dispatch(projectActions.unlinkScenarioFromCurrentProject('scenario-test-001'))

      // Then: 연결 해제 확인
      const state = store.getState()
      const currentProject = projectSelectors.getCurrentProject(state)

      expect(currentProject?.resources.scenarioIds).not.toContain('scenario-test-001')
    })
  })

  describe('상태 선택자 기능', () => {
    it('연결된 시나리오 목록을 올바르게 조회한다', () => {
      // Given: 여러 시나리오가 연결된 프로젝트
      const projectInput: ProjectCreateInput = {
        title: '멀티 시나리오 프로젝트',
        author: 'test-user',
      }

      const scenarios = [
        { id: 'scenario-001', title: '시나리오 1' },
        { id: 'scenario-002', title: '시나리오 2' },
        { id: 'scenario-003', title: '시나리오 3' },
      ]

      // When: 프로젝트 생성 후 시나리오들 연결
      store.dispatch(projectActions.createProject(projectInput))
      scenarios.forEach(scenario => {
        store.dispatch(projectActions.linkScenarioToCurrentProject(scenario.id))
      })

      // Then: 연결된 시나리오 ID 목록 확인
      const state = store.getState()
      const projectScenarios = projectSelectors.getProjectScenarios(state)

      expect(projectScenarios).toHaveLength(3)
      expect(projectScenarios).toEqual(['scenario-001', 'scenario-002', 'scenario-003'])
    })

    it('필터링된 프로젝트 목록을 올바르게 반환한다', () => {
      // Given: 다양한 상태의 프로젝트들
      const projects: ProjectCreateInput[] = [
        { title: '드래프트 프로젝트', author: 'user1', priority: 'high' },
        { title: '진행중 프로젝트', author: 'user2', priority: 'medium' },
        { title: '완료 프로젝트', author: 'user1', priority: 'low' },
      ]

      // When: 프로젝트들 생성 및 상태 변경
      projects.forEach((project, index) => {
        store.dispatch(projectActions.createProject(project))
        if (index === 1) {
          store.dispatch(projectActions.changeProjectStatus('planning'))
        } else if (index === 2) {
          store.dispatch(projectActions.changeProjectStatus('completed'))
        }
      })

      // 필터 적용
      store.dispatch(projectActions.setFilter({
        status: ['planning'],
        priority: ['medium']
      }))

      // Then: 필터링된 결과 확인
      const state = store.getState()
      const filteredProjects = projectSelectors.getFilteredProjects(state)

      expect(filteredProjects).toHaveLength(1)
      expect(filteredProjects[0].metadata.title).toBe('진행중 프로젝트')
      expect(filteredProjects[0].settings.status).toBe('planning')
      expect(filteredProjects[0].settings.priority).toBe('medium')
    })
  })

  describe('검증 및 에러 처리', () => {
    it('잘못된 프로젝트 데이터에 대해 검증 오류를 반환한다', () => {
      // Given: 잘못된 프로젝트 데이터
      const invalidProject: ProjectCreateInput = {
        title: '', // 빈 제목
        author: '', // 빈 작성자
        estimatedDuration: -10, // 음수 시간
      }

      // When: 잘못된 프로젝트 생성
      store.dispatch(projectActions.createProject(invalidProject))

      // Then: 검증 오류 확인
      const state = store.getState()
      const validationResult = projectSelectors.getValidationResult(state)
      const hasErrors = projectSelectors.getHasValidationErrors(state)

      expect(hasErrors).toBe(true)
      expect(validationResult?.isValid).toBe(false)
      expect(validationResult?.errors).toContain('프로젝트 제목은 필수입니다.')
      expect(validationResult?.errors).toContain('프로젝트 작성자는 필수입니다.')
    })

    it('시나리오 검증 오류를 올바르게 처리한다', () => {
      // Given: 잘못된 시나리오 데이터
      const invalidScenario: Scenario = {
        metadata: {
          id: '',
          title: '',
          description: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: [],
          author: '',
        },
        content: {
          genre: 'drama',
          mood: 'neutral',
          targetAudience: 'general',
          duration: 0,
          language: 'ko',
          themes: [],
        },
        scenes: [],
        totalDuration: 0,
        structure: { acts: [] },
      }

      // When: 잘못된 시나리오 설정
      store.dispatch(scenarioActions.setCurrentScenario(invalidScenario))

      // Then: 검증 오류 확인
      const state = store.getState()
      const hasErrors = scenarioSelectors.getHasValidationErrors(state)

      expect(hasErrors).toBe(true)
    })
  })

  describe('마일스톤 및 진행률 관리', () => {
    it('마일스톤 추가 및 완료 처리가 올바르게 작동한다', () => {
      // Given: 프로젝트 생성
      const projectInput: ProjectCreateInput = {
        title: '마일스톤 테스트 프로젝트',
        author: 'test-user',
      }

      store.dispatch(projectActions.createProject(projectInput))

      // When: 마일스톤 추가 및 완료
      store.dispatch(projectActions.addMilestone({
        name: '기획 완료',
        description: '프로젝트 기획 단계 완료'
      }))
      store.dispatch(projectActions.completeMilestone('기획 완료'))

      // Then: 마일스톤 상태 확인
      const state = store.getState()
      const currentProject = projectSelectors.getCurrentProject(state)

      expect(currentProject?.progress.milestones).toHaveLength(1)
      expect(currentProject?.progress.milestones[0].completed).toBe(true)
      expect(currentProject?.progress.milestones[0].completedAt).toBeTruthy()
      expect(currentProject?.progress.completionPercentage).toBeGreaterThan(0)
    })

    it('프로젝트 상태 변경 시 진행률이 자동 업데이트된다', () => {
      // Given: 프로젝트 생성
      const projectInput: ProjectCreateInput = {
        title: '진행률 테스트 프로젝트',
        author: 'test-user',
      }

      store.dispatch(projectActions.createProject(projectInput))

      // When: 상태 변경
      store.dispatch(projectActions.changeProjectStatus('planning'))

      let state = store.getState()
      let currentProject = projectSelectors.getCurrentProject(state)
      const planningProgress = currentProject?.progress.planning

      store.dispatch(projectActions.changeProjectStatus('production'))

      state = store.getState()
      currentProject = projectSelectors.getCurrentProject(state)

      // Then: 진행률 자동 업데이트 확인
      expect(planningProgress).toBeGreaterThanOrEqual(10)
      expect(currentProject?.progress.planning).toBe(100)
      expect(currentProject?.progress.production).toBeGreaterThanOrEqual(10)
      expect(currentProject?.settings.status).toBe('production')
    })
  })

  describe('정렬 및 필터링', () => {
    it('프로젝트 목록 정렬이 올바르게 작동한다', () => {
      // Given: 여러 프로젝트 생성
      const projects = [
        { title: 'C 프로젝트', author: 'user1', priority: 'high' as const },
        { title: 'A 프로젝트', author: 'user2', priority: 'low' as const },
        { title: 'B 프로젝트', author: 'user3', priority: 'medium' as const },
      ]

      projects.forEach(project => {
        store.dispatch(projectActions.createProject(project))
      })

      // When: 제목별 오름차순 정렬
      store.dispatch(projectActions.setSorting({
        sortBy: 'title',
        sortOrder: 'asc'
      }))

      // Then: 정렬 확인
      const state = store.getState()
      const sortedProjects = projectSelectors.getFilteredProjects(state)

      expect(sortedProjects[0].metadata.title).toBe('A 프로젝트')
      expect(sortedProjects[1].metadata.title).toBe('B 프로젝트')
      expect(sortedProjects[2].metadata.title).toBe('C 프로젝트')
    })
  })
})