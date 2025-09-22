/**
 * Version Manager Hook - Phase 3.9
 *
 * CLAUDE.md 준수: features 레이어 비즈니스 로직
 * v1/v2/v3 버전 관리 및 메타데이터 처리를 위한 React 훅
 */

import { useCallback, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectCurrentSession,
  selectSelectedVideoSlot,
  selectActiveVideo,
  type VideoSlot,
  type VersionMetadata,
  type VersionHistory,
  type VersionComparisonRequest,
  type VersionComparisonResult,
  VersionConstants
} from '../../../entities/feedback'

/**
 * 버전 업로드 옵션
 */
export interface VersionUploadOptions {
  readonly replaceReason?: string
  readonly autoActivate: boolean
  readonly generateThumbnail: boolean
  readonly notifyParticipants: boolean
}

/**
 * 버전 관리 결과
 */
export interface VersionManagerReturn {
  // 현재 상태
  readonly currentVersions: Record<VideoSlot, VersionHistory>
  readonly activeVersionId: string | null
  readonly isUploading: boolean
  readonly uploadProgress: number
  readonly error: string | null

  // 버전 조회
  readonly getVersionHistory: (slot: VideoSlot) => VersionHistory | null
  readonly getActiveVersion: (slot?: VideoSlot) => VersionMetadata | null
  readonly getAllVersions: (slot: VideoSlot) => VersionMetadata[]
  readonly getVersionById: (versionId: string) => VersionMetadata | null

  // 버전 업로드
  readonly uploadVersion: (
    slot: VideoSlot,
    file: File,
    options?: Partial<VersionUploadOptions>
  ) => Promise<VersionMetadata>

  // 버전 활성화
  readonly activateVersion: (versionId: string) => Promise<void>
  readonly revertToVersion: (versionId: string) => Promise<void>

  // 버전 비교
  readonly compareVersions: (
    request: VersionComparisonRequest
  ) => Promise<VersionComparisonResult>

  // 버전 관리
  readonly deleteVersion: (versionId: string) => Promise<void>
  readonly archiveOldVersions: (slot: VideoSlot, keepCount: number) => Promise<void>

  // 메타데이터
  readonly updateVersionMetadata: (
    versionId: string,
    updates: Partial<Pick<VersionMetadata, 'replaceReason'>>
  ) => Promise<void>

  // 유틸리티
  readonly getVersionCount: (slot: VideoSlot) => number
  readonly getStorageUsage: (slot?: VideoSlot) => number
  readonly canUploadVersion: (slot: VideoSlot) => boolean
  readonly validateFile: (file: File) => ValidationResult
}

/**
 * 파일 검증 결과
 */
export interface ValidationResult {
  readonly isValid: boolean
  readonly errors: string[]
  readonly warnings: string[]
  readonly fileInfo: {
    readonly size: number
    readonly format: string
    readonly estimatedDuration?: number
  }
}

/**
 * 버전 관리 훅
 */
export function useVersionManager(): VersionManagerReturn {
  const dispatch = useDispatch()

  // Redux 상태
  const currentSession = useSelector(selectCurrentSession)
  const selectedVideoSlot = useSelector(selectSelectedVideoSlot)
  const activeVideo = useSelector(selectActiveVideo)

  // 로컬 상태
  const [currentVersions, setCurrentVersions] = useState<Record<VideoSlot, VersionHistory>>({} as any)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  /**
   * 파일 검증
   */
  const validateFile = useCallback((file: File): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    // 파일 크기 검증
    if (file.size > VersionConstants.MAX_FILE_SIZE) {
      errors.push(`파일 크기가 ${VersionConstants.MAX_FILE_SIZE / 1024 / 1024}MB를 초과합니다`)
    }

    // 파일 형식 검증
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !VersionConstants.SUPPORTED_FORMATS.includes(extension as any)) {
      errors.push(`지원하지 않는 파일 형식입니다. 지원 형식: ${VersionConstants.SUPPORTED_FORMATS.join(', ')}`)
    }

    // 파일 이름 검증
    if (file.name.length > 255) {
      warnings.push('파일 이름이 너무 깁니다')
    }

    // 용량 경고
    if (file.size > 100 * 1024 * 1024) { // 100MB
      warnings.push('큰 파일은 업로드에 시간이 걸릴 수 있습니다')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileInfo: {
        size: file.size,
        format: extension || 'unknown'
      }
    }
  }, [])

  /**
   * 버전 히스토리 조회
   */
  const getVersionHistory = useCallback((slot: VideoSlot): VersionHistory | null => {
    return currentVersions[slot] || null
  }, [currentVersions])

  /**
   * 활성 버전 조회
   */
  const getActiveVersion = useCallback((slot?: VideoSlot): VersionMetadata | null => {
    const targetSlot = slot || selectedVideoSlot
    const history = currentVersions[targetSlot]

    if (!history) return null

    return history.versions.find(v => v.versionId === history.currentVersionId) || null
  }, [currentVersions, selectedVideoSlot])

  /**
   * 모든 버전 조회
   */
  const getAllVersions = useCallback((slot: VideoSlot): VersionMetadata[] => {
    const history = currentVersions[slot]
    return history ? history.versions.sort((a, b) => b.versionNumber - a.versionNumber) : []
  }, [currentVersions])

  /**
   * ID로 버전 조회
   */
  const getVersionById = useCallback((versionId: string): VersionMetadata | null => {
    for (const history of Object.values(currentVersions)) {
      const version = history.versions.find(v => v.versionId === versionId)
      if (version) return version
    }
    return null
  }, [currentVersions])

  /**
   * 버전 업로드
   */
  const uploadVersion = useCallback(async (
    slot: VideoSlot,
    file: File,
    options: Partial<VersionUploadOptions> = {}
  ): Promise<VersionMetadata> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    // 파일 검증
    const validation = validateFile(file)
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '))
    }

    // 버전 수 제한 확인
    const currentCount = getVersionCount(slot)
    if (currentCount >= VersionConstants.MAX_VERSIONS_PER_SLOT) {
      throw new Error(`슬롯당 최대 ${VersionConstants.MAX_VERSIONS_PER_SLOT}개 버전까지 업로드 가능합니다`)
    }

    const opts: VersionUploadOptions = {
      autoActivate: true,
      generateThumbnail: true,
      notifyParticipants: true,
      ...options
    }

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // 파일 해시 계산 (병렬 처리)
      const fileHash = await calculateFileHash(file)

      // 중복 파일 확인
      const existingVersion = getAllVersions(slot).find(v => v.fileHash === fileHash)
      if (existingVersion) {
        throw new Error('동일한 파일이 이미 업로드되어 있습니다')
      }

      // FormData 생성
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sessionId', currentSession.id)
      formData.append('slot', slot)
      formData.append('replaceReason', opts.replaceReason || '')
      formData.append('autoActivate', String(opts.autoActivate))
      formData.append('generateThumbnail', String(opts.generateThumbnail))

      // 업로드 요청
      const response = await fetch('/api/feedback/versions/upload', {
        method: 'POST',
        body: formData,
        onUploadProgress: (event) => {
          if (event.lengthComputable) {
            setUploadProgress((event.loaded / event.total) * 100)
          }
        }
      } as any)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '업로드에 실패했습니다')
      }

      const newVersion: VersionMetadata = await response.json()

      // 로컬 상태 업데이트
      setCurrentVersions(prev => {
        const history = prev[slot] || {
          sessionId: currentSession.id,
          slot,
          versions: [],
          currentVersionId: '',
          totalVersions: 0,
          createdAt: new Date(),
          lastModifiedAt: new Date()
        }

        const updatedHistory: VersionHistory = {
          ...history,
          versions: [...history.versions, newVersion],
          currentVersionId: opts.autoActivate ? newVersion.versionId : history.currentVersionId,
          totalVersions: history.totalVersions + 1,
          lastModifiedAt: new Date()
        }

        return {
          ...prev,
          [slot]: updatedHistory
        }
      })

      // 참여자 알림
      if (opts.notifyParticipants) {
        // 실시간 이벤트 발송
        // TODO: WebSocket 이벤트 구현
      }

      return newVersion

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '업로드에 실패했습니다'
      setError(errorMessage)
      throw err
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [currentSession, validateFile, getVersionCount, getAllVersions])

  /**
   * 버전 활성화
   */
  const activateVersion = useCallback(async (versionId: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    const version = getVersionById(versionId)
    if (!version) {
      throw new Error('버전을 찾을 수 없습니다')
    }

    try {
      const response = await fetch('/api/feedback/versions/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          versionId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '버전 활성화에 실패했습니다')
      }

      // 로컬 상태 업데이트
      setCurrentVersions(prev => ({
        ...prev,
        [version.slot]: {
          ...prev[version.slot],
          currentVersionId: versionId,
          lastModifiedAt: new Date()
        }
      }))

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '버전 활성화에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession, getVersionById])

  /**
   * 버전 되돌리기
   */
  const revertToVersion = useCallback(async (versionId: string): Promise<void> => {
    // activateVersion과 동일하지만 로깅/알림이 다름
    await activateVersion(versionId)

    // TODO: 되돌리기 이벤트 로그 기록
  }, [activateVersion])

  /**
   * 버전 비교
   */
  const compareVersions = useCallback(async (
    request: VersionComparisonRequest
  ): Promise<VersionComparisonResult> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch('/api/feedback/versions/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          sessionId: currentSession.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '버전 비교에 실패했습니다')
      }

      return await response.json()

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '버전 비교에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession])

  /**
   * 버전 삭제
   */
  const deleteVersion = useCallback(async (versionId: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    const version = getVersionById(versionId)
    if (!version) {
      throw new Error('버전을 찾을 수 없습니다')
    }

    // 활성 버전 삭제 방지
    const history = currentVersions[version.slot]
    if (history?.currentVersionId === versionId) {
      throw new Error('활성 버전은 삭제할 수 없습니다')
    }

    try {
      const response = await fetch(`/api/feedback/versions/${versionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '버전 삭제에 실패했습니다')
      }

      // 로컬 상태 업데이트
      setCurrentVersions(prev => ({
        ...prev,
        [version.slot]: {
          ...prev[version.slot],
          versions: prev[version.slot].versions.filter(v => v.versionId !== versionId),
          totalVersions: prev[version.slot].totalVersions - 1,
          lastModifiedAt: new Date()
        }
      }))

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '버전 삭제에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession, getVersionById, currentVersions])

  /**
   * 오래된 버전 아카이브
   */
  const archiveOldVersions = useCallback(async (
    slot: VideoSlot,
    keepCount: number
  ): Promise<void> => {
    const versions = getAllVersions(slot)
    if (versions.length <= keepCount) return

    const versionsToArchive = versions.slice(keepCount)

    for (const version of versionsToArchive) {
      if (!version.isActive) {
        await deleteVersion(version.versionId)
      }
    }
  }, [getAllVersions, deleteVersion])

  /**
   * 버전 메타데이터 업데이트
   */
  const updateVersionMetadata = useCallback(async (
    versionId: string,
    updates: Partial<Pick<VersionMetadata, 'replaceReason'>>
  ): Promise<void> => {
    if (!currentSession) {
      throw new Error('세션이 활성화되지 않았습니다')
    }

    try {
      const response = await fetch(`/api/feedback/versions/${versionId}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession.id,
          updates
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '메타데이터 업데이트에 실패했습니다')
      }

      // 로컬 상태 업데이트
      const version = getVersionById(versionId)
      if (version) {
        setCurrentVersions(prev => ({
          ...prev,
          [version.slot]: {
            ...prev[version.slot],
            versions: prev[version.slot].versions.map(v =>
              v.versionId === versionId ? { ...v, ...updates } : v
            ),
            lastModifiedAt: new Date()
          }
        }))
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '메타데이터 업데이트에 실패했습니다'
      setError(errorMessage)
      throw err
    }
  }, [currentSession, getVersionById])

  /**
   * 유틸리티 함수들
   */
  const getVersionCount = useCallback((slot: VideoSlot): number => {
    return currentVersions[slot]?.totalVersions || 0
  }, [currentVersions])

  const getStorageUsage = useCallback((slot?: VideoSlot): number => {
    if (slot) {
      const history = currentVersions[slot]
      return history ? history.versions.reduce((total, v) => total + v.fileSize, 0) : 0
    }

    return Object.values(currentVersions).reduce((total, history) =>
      total + history.versions.reduce((sum, v) => sum + v.fileSize, 0), 0
    )
  }, [currentVersions])

  const canUploadVersion = useCallback((slot: VideoSlot): boolean => {
    return getVersionCount(slot) < VersionConstants.MAX_VERSIONS_PER_SLOT
  }, [getVersionCount])

  /**
   * 세션 변경 시 버전 히스토리 로드
   */
  useEffect(() => {
    if (currentSession) {
      // TODO: API에서 버전 히스토리 로드
      loadVersionHistories(currentSession.id)
    }
  }, [currentSession])

  /**
   * 버전 히스토리 로드 (비동기)
   */
  const loadVersionHistories = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/feedback/sessions/${sessionId}/versions`)
      if (response.ok) {
        const histories: Record<VideoSlot, VersionHistory> = await response.json()
        setCurrentVersions(histories)
      }
    } catch (err) {
      console.error('버전 히스토리 로드 실패:', err)
    }
  }

  return {
    // 현재 상태
    currentVersions,
    activeVersionId: getActiveVersion()?.versionId || null,
    isUploading,
    uploadProgress,
    error,

    // 버전 조회
    getVersionHistory,
    getActiveVersion,
    getAllVersions,
    getVersionById,

    // 버전 업로드
    uploadVersion,

    // 버전 활성화
    activateVersion,
    revertToVersion,

    // 버전 비교
    compareVersions,

    // 버전 관리
    deleteVersion,
    archiveOldVersions,

    // 메타데이터
    updateVersionMetadata,

    // 유틸리티
    getVersionCount,
    getStorageUsage,
    canUploadVersion,
    validateFile
  }
}

/**
 * 파일 해시 계산 (SHA-256)
 */
async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')
}