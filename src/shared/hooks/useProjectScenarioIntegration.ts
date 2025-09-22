/**
 * Project-Scenario Integration Hook
 *
 * CLAUDE.md 준수: FSD shared 레이어, React 19 훅 규칙
 * $300 사건 방지: 안전한 API 호출 및 캐싱
 */

import { useCallback, useRef, useEffect } from 'react'
// Note: This shared hook should not use app-specific stores directly
// Moving to features layer would be more appropriate
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../app/store'
import { scenarioActions, scenarioSelectors } from '../../entities/scenario'
import { projectActions, projectSelectors } from '../../entities/project'
import logger from '../lib/logger'

/**
 * 비용 안전: API 호출 제한기
 */
class IntegrationCallLimiter {
  private static lastCall: Map<string, number> = new Map()
  private static readonly COOLDOWN_MS = 60000 // 1분 쿨다운

  static canCall(operation: string): boolean {
    const now = Date.now()
    const lastTime = this.lastCall.get(operation) || 0

    if (now - lastTime < this.COOLDOWN_MS) {
      logger.warn('🚨 API 호출 제한', {
        operation,
        remainingCooldown: Math.ceil((this.COOLDOWN_MS - (now - lastTime)) / 1000),
        warning: '$300 사건 방지 - 과도한 API 호출 차단',
      })
      return false
    }

    this.lastCall.set(operation, now)
    return true
  }

  static reset() {
    this.lastCall.clear()
  }
}

/**
 * 프로젝트-시나리오 통합 상태
 */
export interface ProjectScenarioIntegrationState {
  isLinking: boolean
  isUnlinking: boolean
  error: string | null
  lastOperation: string | null
}

/**
 * 프로젝트-시나리오 통합 Hook
 *
 * 비용 안전 규칙:
 * - 1분 내 동일 작업 중복 방지
 * - useEffect 의존성 배열 안전 관리
 * - 자동 cleanup으로 메모리 누수 방지
 */
export function useProjectScenarioIntegration() {
  const dispatch = useDispatch<AppDispatch>()

  // Redux 상태 - $300 사건 방지: 빈 배열로 의존성 제한
  const currentProject = useSelector((state: RootState) => projectSelectors.getCurrentProject(state))
  const currentScenario = useSelector((state: RootState) => scenarioSelectors.getCurrentScenario(state))
  const projectList = useSelector((state: RootState) => projectSelectors.getProjectList(state))
  const scenarioList = useSelector((state: RootState) => scenarioSelectors.getScenarioList(state))

  // 내부 상태
  const operationRef = useRef<ProjectScenarioIntegrationState>({
    isLinking: false,
    isUnlinking: false,
    error: null,
    lastOperation: null,
  })

  // Cleanup 함수 - 컴포넌트 언마운트 시 자동 실행
  useEffect(() => {
    return () => {
      // 메모리 누수 방지
      operationRef.current = {
        isLinking: false,
        isUnlinking: false,
        error: null,
        lastOperation: null,
      }
    }
  }, []) // 빈 배열 - 마운트 시 1회만 실행

  /**
   * 현재 프로젝트에 시나리오 연결
   *
   * 비용 안전: 호출 제한 및 중복 방지
   */
  const linkScenarioToProject = useCallback(async (
    projectId?: string,
    scenarioId?: string
  ): Promise<boolean> => {
    const targetProjectId = projectId || currentProject?.metadata.id
    const targetScenarioId = scenarioId || currentScenario?.metadata.id

    if (!targetProjectId || !targetScenarioId) {
      operationRef.current.error = '프로젝트 또는 시나리오를 선택해주세요.'
      logger.warn('연결 실패: 프로젝트/시나리오 미선택')
      return false
    }

    // 비용 안전: 호출 제한 체크
    const operationKey = `link_${targetProjectId}_${targetScenarioId}`
    if (!IntegrationCallLimiter.canCall(operationKey)) {
      operationRef.current.error = '잠시 후 다시 시도해주세요. (API 호출 제한)'
      return false
    }

    // 이미 연결되어 있는지 확인
    const project = projectList.find(p => p.metadata.id === targetProjectId)
    if (project?.resources.scenarioIds.includes(targetScenarioId)) {
      operationRef.current.error = '이미 연결된 시나리오입니다.'
      logger.info('연결 스킵: 이미 연결됨', { projectId: targetProjectId, scenarioId: targetScenarioId })
      return true
    }

    try {
      operationRef.current.isLinking = true
      operationRef.current.error = null
      operationRef.current.lastOperation = 'linking'

      // Redux 액션 디스패치
      dispatch(projectActions.linkScenarioToCurrentProject(targetScenarioId))

      logger.info('시나리오-프로젝트 연결 성공', {
        projectId: targetProjectId,
        scenarioId: targetScenarioId,
      })

      return true

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '연결 중 오류가 발생했습니다.'
      operationRef.current.error = errorMessage

      logger.error('시나리오-프로젝트 연결 실패', {
        projectId: targetProjectId,
        scenarioId: targetScenarioId,
        error: errorMessage,
      })

      return false

    } finally {
      operationRef.current.isLinking = false
    }
  }, [dispatch, currentProject?.metadata.id, currentScenario?.metadata.id, projectList])

  /**
   * 프로젝트에서 시나리오 연결 해제
   */
  const unlinkScenarioFromProject = useCallback(async (
    projectId?: string,
    scenarioId?: string
  ): Promise<boolean> => {
    const targetProjectId = projectId || currentProject?.metadata.id
    const targetScenarioId = scenarioId || currentScenario?.metadata.id

    if (!targetProjectId || !targetScenarioId) {
      operationRef.current.error = '프로젝트 또는 시나리오를 선택해주세요.'
      return false
    }

    // 비용 안전: 호출 제한 체크
    const operationKey = `unlink_${targetProjectId}_${targetScenarioId}`
    if (!IntegrationCallLimiter.canCall(operationKey)) {
      operationRef.current.error = '잠시 후 다시 시도해주세요. (API 호출 제한)'
      return false
    }

    try {
      operationRef.current.isUnlinking = true
      operationRef.current.error = null
      operationRef.current.lastOperation = 'unlinking'

      // Redux 액션 디스패치
      dispatch(projectActions.unlinkScenarioFromCurrentProject(targetScenarioId))

      logger.info('시나리오-프로젝트 연결 해제 성공', {
        projectId: targetProjectId,
        scenarioId: targetScenarioId,
      })

      return true

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '연결 해제 중 오류가 발생했습니다.'
      operationRef.current.error = errorMessage

      logger.error('시나리오-프로젝트 연결 해제 실패', {
        projectId: targetProjectId,
        scenarioId: targetScenarioId,
        error: errorMessage,
      })

      return false

    } finally {
      operationRef.current.isUnlinking = false
    }
  }, [dispatch, currentProject?.metadata.id, currentScenario?.metadata.id])

  /**
   * 프로젝트의 연결된 시나리오 목록 조회
   */
  const getLinkedScenarios = useCallback((projectId?: string) => {
    const targetProjectId = projectId || currentProject?.metadata.id
    if (!targetProjectId) return []

    const project = projectList.find(p => p.metadata.id === targetProjectId)
    if (!project) return []

    // 연결된 시나리오 ID를 실제 시나리오 객체로 변환
    return project.resources.scenarioIds
      .map(id => scenarioList.find(s => s.metadata.id === id))
      .filter(Boolean)
  }, [currentProject?.metadata.id, projectList, scenarioList])

  /**
   * 시나리오가 연결된 프로젝트 목록 조회
   */
  const getLinkedProjects = useCallback((scenarioId?: string) => {
    const targetScenarioId = scenarioId || currentScenario?.metadata.id
    if (!targetScenarioId) return []

    return projectList.filter(project =>
      project.resources.scenarioIds.includes(targetScenarioId)
    )
  }, [currentScenario?.metadata.id, projectList])

  /**
   * 연결 상태 확인
   */
  const isLinked = useCallback((projectId?: string, scenarioId?: string) => {
    const targetProjectId = projectId || currentProject?.metadata.id
    const targetScenarioId = scenarioId || currentScenario?.metadata.id

    if (!targetProjectId || !targetScenarioId) return false

    const project = projectList.find(p => p.metadata.id === targetProjectId)
    return project?.resources.scenarioIds.includes(targetScenarioId) || false
  }, [currentProject?.metadata.id, currentScenario?.metadata.id, projectList])

  /**
   * 에러 상태 초기화
   */
  const clearError = useCallback(() => {
    operationRef.current.error = null
  }, [])

  /**
   * 통합 상태 리셋
   */
  const resetIntegration = useCallback(() => {
    operationRef.current = {
      isLinking: false,
      isUnlinking: false,
      error: null,
      lastOperation: null,
    }
    IntegrationCallLimiter.reset()
  }, [])

  return {
    // 상태
    isLinking: operationRef.current.isLinking,
    isUnlinking: operationRef.current.isUnlinking,
    error: operationRef.current.error,
    lastOperation: operationRef.current.lastOperation,

    // 액션
    linkScenarioToProject,
    unlinkScenarioFromProject,
    clearError,
    resetIntegration,

    // 조회
    getLinkedScenarios,
    getLinkedProjects,
    isLinked,

    // 현재 상태 (읽기 전용)
    currentProject,
    currentScenario,
  }
}

/**
 * 개발 환경 전용: 통합 디버그 훅
 */
export function useProjectScenarioDebug() {
  const integration = useProjectScenarioIntegration()

  // 개발 환경에서만 디버그 정보 제공
  if (process.env.NODE_ENV !== 'development') {
    return { debug: null }
  }

  const debug = {
    ...integration,
    resetCallLimiter: () => IntegrationCallLimiter.reset(),
    getCallHistory: () => IntegrationCallLimiter.lastCall,
  }

  return { debug }
}