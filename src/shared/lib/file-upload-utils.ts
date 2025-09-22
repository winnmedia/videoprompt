/**
 * File Upload Utilities
 *
 * CLAUDE.md 준수: shared/lib 레이어 공통 유틸리티
 * 파일 업로드 관련 유틸리티 함수들
 */

/**
 * 파일 크기를 읽기 쉬운 형태로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 업로드 시간 추정
 */
export function estimateUploadTime(fileSize: number, speed: number): number {
  if (speed === 0) return 0
  return Math.ceil(fileSize / speed)
}

/**
 * 업로드 속도 계산
 */
export function calculateUploadSpeed(
  loaded: number,
  startTime: number,
  currentTime: number = Date.now()
): number {
  const timeElapsed = (currentTime - startTime) / 1000 // 초
  if (timeElapsed === 0) return 0
  return loaded / timeElapsed
}

/**
 * 파일 형식 검증
 */
export function validateVideoFile(file: File): { isValid: boolean; error?: string } {
  // 크기 검증
  const maxSize = 300 * 1024 * 1024 // 300MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `파일 크기가 최대 제한(300MB)을 초과합니다. 현재: ${formatFileSize(file.size)}`
    }
  }

  // 형식 검증
  const supportedFormats = ['mp4', 'webm', 'mov', 'avi']
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (!extension || !supportedFormats.includes(extension)) {
    return {
      isValid: false,
      error: `지원되지 않는 파일 형식입니다. 지원 형식: ${supportedFormats.join(', ')}`
    }
  }

  // MIME 타입 검증
  const supportedMimeTypes = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
  ]

  if (!supportedMimeTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `지원되지 않는 MIME 타입입니다: ${file.type}`
    }
  }

  return { isValid: true }
}

/**
 * 드래그 앤 드롭 파일 처리
 */
export function handleFilesDrop(event: DragEvent): File[] {
  event.preventDefault()

  const files: File[] = []

  if (event.dataTransfer?.items) {
    // DataTransferItemList 사용
    for (let i = 0; i < event.dataTransfer.items.length; i++) {
      const item = event.dataTransfer.items[i]
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
  } else if (event.dataTransfer?.files) {
    // DataTransferFileList 사용 (fallback)
    for (let i = 0; i < event.dataTransfer.files.length; i++) {
      files.push(event.dataTransfer.files[i])
    }
  }

  return files
}

/**
 * 업로드 진행률 계산
 */
export function calculateProgress(loaded: number, total: number): number {
  if (total === 0) return 0
  return Math.round((loaded / total) * 100)
}

/**
 * 시간을 읽기 쉬운 형태로 변환
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}초`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}분 ${remainingSeconds}초`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}시간 ${minutes}분`
  }
}

/**
 * 업로드 재시도 로직
 */
export async function retryUpload<T>(
  uploadFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadFn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('업로드 실패')

      if (attempt === maxRetries) {
        throw lastError
      }

      // 지수 백오프로 대기
      const waitTime = delay * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  throw lastError!
}

/**
 * 청크 업로드를 위한 파일 분할
 */
export function splitFileIntoChunks(file: File, chunkSize: number = 5 * 1024 * 1024): Blob[] {
  const chunks: Blob[] = []
  let start = 0

  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size)
    chunks.push(file.slice(start, end))
    start = end
  }

  return chunks
}

/**
 * 파일 해시 계산 (중복 감지용)
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 영상 메타데이터 추출
 */
export async function extractVideoMetadata(file: File): Promise<{
  duration: number
  width: number
  height: number
  aspectRatio: string
  fps?: number
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      const aspectRatio = `${video.videoWidth}:${video.videoHeight}`
      URL.revokeObjectURL(url)

      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('영상 메타데이터를 추출할 수 없습니다'))
    }

    video.src = url
  })
}

/**
 * 업로드 상태 관리 헬퍼
 */
export class UploadStateManager {
  private uploads = new Map<string, {
    startTime: number
    loaded: number
    total: number
    speed: number
  }>()

  startUpload(id: string, total: number): void {
    this.uploads.set(id, {
      startTime: Date.now(),
      loaded: 0,
      total,
      speed: 0
    })
  }

  updateProgress(id: string, loaded: number): void {
    const upload = this.uploads.get(id)
    if (!upload) return

    const now = Date.now()
    const timeElapsed = (now - upload.startTime) / 1000

    upload.loaded = loaded
    upload.speed = timeElapsed > 0 ? loaded / timeElapsed : 0

    this.uploads.set(id, upload)
  }

  getProgress(id: string): number {
    const upload = this.uploads.get(id)
    if (!upload) return 0

    return calculateProgress(upload.loaded, upload.total)
  }

  getSpeed(id: string): number {
    const upload = this.uploads.get(id)
    return upload?.speed || 0
  }

  getTimeRemaining(id: string): number {
    const upload = this.uploads.get(id)
    if (!upload || upload.speed === 0) return 0

    const remaining = upload.total - upload.loaded
    return remaining / upload.speed
  }

  finishUpload(id: string): void {
    this.uploads.delete(id)
  }

  cancelUpload(id: string): void {
    this.uploads.delete(id)
  }
}

/**
 * 압축 및 최적화 옵션
 */
export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number // 0.1 - 1.0
  format?: 'mp4' | 'webm'
}

/**
 * 클라이언트 사이드 영상 압축 (WebCodecs API 사용)
 * 주의: 실험적 기능으로 브라우저 지원 확인 필요
 */
export async function compressVideo(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  // WebCodecs API 지원 확인
  if (!('VideoEncoder' in window)) {
    throw new Error('브라우저가 영상 압축을 지원하지 않습니다')
  }

  // 실제 압축 로직은 복잡하므로 기본 구조만 제공
  // 프로덕션에서는 FFmpeg.wasm 등을 사용하는 것을 권장

  console.warn('영상 압축 기능은 아직 구현되지 않았습니다')
  return file
}

/**
 * 네트워크 상태 감지
 */
export function getNetworkInfo(): {
  isOnline: boolean
  connectionType?: string
  downlink?: number // Mbps
} {
  const navigator = window.navigator as any

  return {
    isOnline: navigator.onLine,
    connectionType: navigator.connection?.effectiveType,
    downlink: navigator.connection?.downlink
  }
}

/**
 * 업로드 품질 자동 조정
 */
export function getRecommendedChunkSize(): number {
  const network = getNetworkInfo()

  if (!network.isOnline) {
    throw new Error('인터넷 연결을 확인해주세요')
  }

  // 연결 속도에 따른 청크 크기 조정
  switch (network.connectionType) {
    case 'slow-2g':
    case '2g':
      return 1 * 1024 * 1024 // 1MB
    case '3g':
      return 2 * 1024 * 1024 // 2MB
    case '4g':
      return 5 * 1024 * 1024 // 5MB
    default:
      return 10 * 1024 * 1024 // 10MB
  }
}