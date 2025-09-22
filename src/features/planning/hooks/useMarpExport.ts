/**
 * useMarpExport Hook
 *
 * Marp를 사용한 PDF 기획서 생성 및 다운로드 기능
 * CLAUDE.md 준수: 비용 안전, 백그라운드 처리
 */

import { useState, useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'

import type {
  PlanningProject,
  ExportSettings,
  MarpPdfGenerationRequest,
  MarpPdfGenerationResponse,
  MarpExportMetadata,
} from '../../../entities/planning'

import { planningActions } from '../store/planning-slice'
import { marpClient } from '../../../shared/lib/marp-client'
import logger from '../../../shared/lib/logger'

/**
 * 내보내기 상태
 */
export interface UseMarpExportState {
  isExporting: boolean
  progress: number // 0-100
  currentStep: ExportStep
  lastResult: MarpPdfGenerationResponse | null
  error: string | null
  downloadUrl: string | null
}

/**
 * 내보내기 단계
 */
export type ExportStep =
  | 'idle'
  | 'preparing'
  | 'generating_markdown'
  | 'rendering_pdf'
  | 'uploading'
  | 'completed'
  | 'error'

/**
 * Hook 옵션
 */
export interface UseMarpExportOptions {
  autoDownload?: boolean
  onStepChange?: (step: ExportStep, progress: number) => void
  onSuccess?: (result: MarpPdfGenerationResponse) => void
  onError?: (error: string) => void
}

/**
 * Marp PDF 내보내기 Hook
 */
export function useMarpExport(options: UseMarpExportOptions = {}) {
  const {
    autoDownload = true,
    onStepChange,
    onSuccess,
    onError,
  } = options

  const dispatch = useDispatch()

  // 내부 상태
  const [state, setState] = useState<UseMarpExportState>({
    isExporting: false,
    progress: 0,
    currentStep: 'idle',
    lastResult: null,
    error: null,
    downloadUrl: null,
  })

  // 취소를 위한 AbortController
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * 상태 업데이트 헬퍼
   */
  const updateState = useCallback((updates: Partial<UseMarpExportState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates }

      // 단계 변경 알림
      if (onStepChange && updates.currentStep) {
        onStepChange(updates.currentStep, newState.progress)
      }

      return newState
    })
  }, [onStepChange])

  /**
   * 진행률 업데이트
   */
  const updateProgress = useCallback((step: ExportStep, progress: number) => {
    updateState({ currentStep: step, progress })
  }, [updateState])

  /**
   * PDF 내보내기 실행
   */
  const exportToPdf = useCallback(async (
    project: PlanningProject,
    exportSettings: ExportSettings
  ): Promise<MarpPdfGenerationResponse | null> => {
    if (state.isExporting) {
      logger.warn('이미 내보내기가 진행 중입니다.')
      return null
    }

    try {
      // AbortController 설정
      abortControllerRef.current = new AbortController()

      // 초기 상태 설정
      updateState({
        isExporting: true,
        progress: 0,
        currentStep: 'preparing',
        error: null,
        lastResult: null,
        downloadUrl: null,
      })

      dispatch(planningActions.setLoading(true))

      // 1단계: 준비 (10%)
      updateProgress('preparing', 10)
      await new Promise(resolve => setTimeout(resolve, 500))

      // 2단계: 마크다운 생성 (40%)
      updateProgress('generating_markdown', 40)
      const markdownContent = generateMarpMarkdown(project, exportSettings)

      // 3단계: PDF 렌더링 (70%)
      updateProgress('rendering_pdf', 70)
      const request: MarpPdfGenerationRequest = {
        planningProject: project,
        exportSettings,
      }

      const pdfResponse = await marpClient.generatePdf({
        markdown: markdownContent,
        theme: exportSettings.marpSettings.theme,
        options: {
          backgroundColor: exportSettings.marpSettings.backgroundColor,
          textColor: exportSettings.marpSettings.textColor,
          accentColor: exportSettings.marpSettings.accentColor,
        },
      })

      // 4단계: 업로드 (90%)
      updateProgress('uploading', 90)

      const result: MarpPdfGenerationResponse = {
        pdfUrl: pdfResponse.downloadUrl,
        jsonUrl: exportSettings.format === 'both' ? await generateJsonExport(project) : undefined,
        fileSize: pdfResponse.fileSize,
        pageCount: pdfResponse.pageCount,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24시간 후 만료
      }

      // 완료 (100%)
      updateState({
        isExporting: false,
        progress: 100,
        currentStep: 'completed',
        lastResult: result,
        downloadUrl: result.pdfUrl,
      })

      // 자동 다운로드
      if (autoDownload) {
        downloadFile(result.pdfUrl, `${project.metadata.title}_기획서.pdf`)
      }

      onSuccess?.(result)

      logger.info('PDF 내보내기 성공', {
        projectId: project.metadata.id,
        projectTitle: project.metadata.title,
        fileSize: result.fileSize,
        pageCount: result.pageCount,
        format: exportSettings.format,
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'PDF 내보내기에 실패했습니다'

      // 에러 상태
      updateState({
        isExporting: false,
        progress: 0,
        currentStep: 'error',
        error: errorMessage,
      })

      onError?.(errorMessage)

      logger.error('PDF 내보내기 오류', {
        projectId: project.metadata.id,
        error: errorMessage,
        exportSettings,
      })

      return null

    } finally {
      dispatch(planningActions.setLoading(false))
      abortControllerRef.current = null
    }
  }, [state.isExporting, autoDownload, dispatch, updateState, updateProgress, onSuccess, onError])

  /**
   * JSON 내보내기
   */
  const exportToJson = useCallback(async (
    project: PlanningProject
  ): Promise<string | null> => {
    try {
      updateState({
        isExporting: true,
        progress: 50,
        currentStep: 'preparing',
        error: null,
      })

      const jsonUrl = await generateJsonExport(project)

      updateState({
        isExporting: false,
        progress: 100,
        currentStep: 'completed',
        downloadUrl: jsonUrl,
      })

      if (autoDownload) {
        downloadFile(jsonUrl, `${project.metadata.title}_데이터.json`)
      }

      logger.info('JSON 내보내기 성공', {
        projectId: project.metadata.id,
        projectTitle: project.metadata.title,
      })

      return jsonUrl

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'JSON 내보내기 실패'

      updateState({
        isExporting: false,
        error: errorMessage,
      })

      onError?.(errorMessage)
      return null
    }
  }, [autoDownload, updateState, onError])

  /**
   * 커스텀 템플릿으로 내보내기
   */
  const exportWithCustomTemplate = useCallback(async (
    project: PlanningProject,
    customTemplate: string,
    exportSettings: ExportSettings
  ): Promise<MarpPdfGenerationResponse | null> => {
    const enhancedSettings: ExportSettings = {
      ...exportSettings,
      marpSettings: {
        ...exportSettings.marpSettings,
        customTemplate,
      },
    }

    return exportToPdf(project, enhancedSettings)
  }, [exportToPdf])

  /**
   * 미리보기 생성
   */
  const generatePreview = useCallback(async (
    project: PlanningProject,
    exportSettings: ExportSettings
  ): Promise<string | null> => {
    try {
      const markdownContent = generateMarpMarkdown(project, exportSettings)

      const previewResponse = await marpClient.generatePreview({
        markdown: markdownContent,
        theme: exportSettings.marpSettings.theme,
      })

      logger.info('미리보기 생성 성공', {
        projectId: project.metadata.id,
      })

      return previewResponse.previewUrl

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '미리보기 생성 실패'

      updateState({ error: errorMessage })
      onError?.(errorMessage)

      logger.error('미리보기 생성 오류', {
        projectId: project.metadata.id,
        error: errorMessage,
      })

      return null
    }
  }, [updateState, onError])

  /**
   * 내보내기 취소
   */
  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    updateState({
      isExporting: false,
      progress: 0,
      currentStep: 'idle',
      error: null,
    })

    dispatch(planningActions.setLoading(false))

    logger.info('내보내기가 취소되었습니다.')
  }, [updateState, dispatch])

  /**
   * 파일 다운로드
   */
  const downloadFile = useCallback((url: string, filename: string) => {
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      logger.info('파일 다운로드 시작', { filename, url })
    } catch (error) {
      logger.error('파일 다운로드 실패', {
        filename,
        url,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  /**
   * 에러 클리어
   */
  const clearError = useCallback(() => {
    updateState({ error: null, currentStep: 'idle' })
  }, [updateState])

  /**
   * 상태 리셋
   */
  const reset = useCallback(() => {
    if (state.isExporting) {
      cancelExport()
    }

    setState({
      isExporting: false,
      progress: 0,
      currentStep: 'idle',
      lastResult: null,
      error: null,
      downloadUrl: null,
    })
  }, [state.isExporting, cancelExport])

  return {
    // 상태
    state,
    isExporting: state.isExporting,
    progress: state.progress,
    currentStep: state.currentStep,
    error: state.error,
    lastResult: state.lastResult,
    downloadUrl: state.downloadUrl,

    // 액션
    exportToPdf,
    exportToJson,
    exportWithCustomTemplate,
    generatePreview,
    downloadFile,
    cancelExport,
    clearError,
    reset,
  }
}

/**
 * Marp 마크다운 생성
 */
function generateMarpMarkdown(
  project: PlanningProject,
  exportSettings: ExportSettings
): string {
  const { marpSettings } = exportSettings
  const { inputData, storySteps, shotSequences, insertShots } = project

  let markdown = `---
marp: true
theme: ${marpSettings.theme}
paginate: true
${marpSettings.backgroundColor ? `backgroundColor: ${marpSettings.backgroundColor}` : ''}
${marpSettings.textColor ? `color: ${marpSettings.textColor}` : ''}
---

# ${project.metadata.title}

**영상 기획서**

---

## 기획 개요

- **제목**: ${inputData.title}
- **로그라인**: ${inputData.logline}
- **톤앤매너**: ${inputData.toneAndManner}
- **전개 방식**: ${inputData.development}
- **스토리 강도**: ${inputData.intensity}
- **목표 시간**: ${inputData.targetDuration || 180}초

${inputData.additionalNotes ? `\n**추가 요청사항**:\n${inputData.additionalNotes}` : ''}

---

## 4단계 스토리 구조

`

  // 스토리 스텝 추가
  storySteps.forEach((step, index) => {
    markdown += `
### ${step.order}. ${step.title}

${step.description}

- **예상 시간**: ${step.duration}초
- **핵심 포인트**: ${step.keyPoints.join(', ')}

${index < storySteps.length - 1 ? '---' : ''}
`
  })

  if (exportSettings.includeConti && shotSequences.length > 0) {
    markdown += `

---

## 숏 구성 (${shotSequences.length}개 숏)

`

    shotSequences.forEach((shot, index) => {
      markdown += `
### 숏 ${shot.order}: ${shot.title}

**설명**: ${shot.description}

**콘티**: ${shot.contiDescription}

- **시간**: ${shot.duration}초
- **샷 타입**: ${shot.shotType || 'medium'}
- **카메라 움직임**: ${shot.cameraMovement || 'static'}
${shot.location ? `- **장소**: ${shot.location}` : ''}
${shot.characters && shot.characters.length > 0 ? `- **등장인물**: ${shot.characters.join(', ')}` : ''}

${shot.contiImageUrl ? `![콘티 이미지](${shot.contiImageUrl})` : ''}

${index % 3 === 2 ? '---' : ''}
`
    })
  }

  if (exportSettings.includeInserts && insertShots.length > 0) {
    markdown += `

---

## 인서트 컷

`

    const groupedInserts = insertShots.reduce((acc, insert) => {
      if (!acc[insert.shotSequenceId]) {
        acc[insert.shotSequenceId] = []
      }
      acc[insert.shotSequenceId].push(insert)
      return acc
    }, {} as Record<string, typeof insertShots>)

    Object.entries(groupedInserts).forEach(([shotId, inserts]) => {
      const shot = shotSequences.find(s => s.id === shotId)
      if (shot) {
        markdown += `
### ${shot.title} 인서트

`
        inserts.forEach(insert => {
          markdown += `- **${insert.order}**: ${insert.description} (${insert.purpose})\n`
        })
      }
    })
  }

  if (exportSettings.includeTiming) {
    markdown += `

---

## 타이밍 구성

| 구간 | 내용 | 시간 |
|------|------|------|
`

    let currentTime = 0
    storySteps.forEach(step => {
      const endTime = currentTime + (step.duration || 0)
      markdown += `| ${formatTime(currentTime)}-${formatTime(endTime)} | ${step.title} | ${step.duration}초 |\n`
      currentTime = endTime
    })
  }

  if (exportSettings.includeMetadata) {
    const totalDuration = project.totalDuration || 0
    const completionPercentage = project.completionPercentage

    markdown += `

---

## 프로젝트 정보

- **생성일**: ${project.metadata.createdAt.toLocaleDateString()}
- **수정일**: ${project.metadata.updatedAt.toLocaleDateString()}
- **총 예상 시간**: ${totalDuration}초 (${Math.round(totalDuration / 60)}분)
- **완성도**: ${completionPercentage}%
- **스토리 단계**: ${storySteps.length}개
- **숏 구성**: ${shotSequences.length}개

`
  }

  if (exportSettings.includeVersionInfo) {
    markdown += `

---

## 생성 정보

이 기획서는 VideoPlanet 영상 기획 위저드로 생성되었습니다.

- **생성 시간**: ${new Date().toLocaleString()}
- **프로젝트 ID**: ${project.metadata.id}
- **버전**: v${project.metadata.updatedAt.getTime()}

`
  }

  // 커스텀 템플릿 적용
  if (marpSettings.customTemplate) {
    markdown = marpSettings.customTemplate.replace('{{CONTENT}}', markdown)
  }

  return markdown
}

/**
 * JSON 내보내기 생성
 */
async function generateJsonExport(project: PlanningProject): Promise<string> {
  const exportData = {
    metadata: {
      title: project.metadata.title,
      description: project.metadata.description,
      createdAt: project.metadata.createdAt.toISOString(),
      updatedAt: project.metadata.updatedAt.toISOString(),
      version: '1.0',
      generator: 'VideoPlanet Planning Wizard',
    },
    inputData: project.inputData,
    storySteps: project.storySteps,
    shotSequences: project.shotSequences,
    insertShots: project.insertShots,
    exportSettings: project.exportSettings,
    statistics: {
      totalDuration: project.totalDuration,
      completionPercentage: project.completionPercentage,
      storyStepCount: project.storySteps.length,
      shotCount: project.shotSequences.length,
      insertShotCount: project.insertShots.length,
    },
  }

  const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  })

  return URL.createObjectURL(jsonBlob)
}

/**
 * 시간 포맷팅 (초 -> MM:SS)
 */
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}