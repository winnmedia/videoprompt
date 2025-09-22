/**
 * Supabase Feedback Storage Client
 *
 * CLAUDE.md 준수: shared/lib 레이어 인프라스트럭처
 * 피드백 시스템을 위한 Supabase 파일 저장소 클라이언트
 */

import { createClient } from '@supabase/supabase-js'
import type { VideoSlot, VideoMetadata } from '../../entities/feedback'

/**
 * 파일 업로드 진행 상태
 */
export interface UploadProgress {
  readonly loaded: number // 업로드된 바이트
  readonly total: number  // 전체 바이트
  readonly progress: number // 진행률 (0-100)
  readonly speed?: number // 업로드 속도 (bytes/sec)
  readonly timeRemaining?: number // 남은 시간 (seconds)
}

/**
 * 업로드 옵션
 */
export interface UploadOptions {
  readonly onProgress?: (progress: UploadProgress) => void
  readonly onError?: (error: Error) => void
  readonly signal?: AbortSignal // 업로드 취소
}

/**
 * 썸네일 생성 옵션
 */
export interface ThumbnailOptions {
  readonly width: number
  readonly height: number
  readonly quality: number // 0.1 - 1.0
  readonly timeOffset: number // 썸네일 추출 시점 (seconds)
}

/**
 * Supabase 피드백 스토리지 클라이언트
 */
export class SupabaseFeedbackStorage {
  private readonly supabase
  private readonly bucket = 'feedback-videos'
  private readonly thumbnailBucket = 'feedback-thumbnails'

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  /**
   * 피드백 세션 스토리지 경로 생성
   */
  private getVideoPath(sessionId: string, slot: VideoSlot, filename: string): string {
    const timestamp = Date.now()
    const extension = filename.split('.').pop()
    return `sessions/${sessionId}/${slot}/${timestamp}.${extension}`
  }

  private getThumbnailPath(sessionId: string, slot: VideoSlot, filename: string): string {
    const timestamp = Date.now()
    return `sessions/${sessionId}/${slot}/thumb_${timestamp}.jpg`
  }

  /**
   * 파일 크기 검증
   */
  private validateFileSize(file: File): void {
    const MAX_SIZE = 300 * 1024 * 1024 // 300MB
    if (file.size > MAX_SIZE) {
      throw new Error(`파일 크기가 최대 제한(300MB)을 초과합니다. 현재: ${Math.round(file.size / 1024 / 1024)}MB`)
    }
  }

  /**
   * 파일 형식 검증
   */
  private validateFileFormat(file: File): void {
    const supportedFormats = ['mp4', 'webm', 'mov', 'avi']
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (!extension || !supportedFormats.includes(extension)) {
      throw new Error(`지원되지 않는 파일 형식입니다. 지원 형식: ${supportedFormats.join(', ')}`)
    }
  }

  /**
   * 영상 메타데이터 추출
   */
  private async extractVideoMetadata(file: File): Promise<Partial<VideoMetadata>> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const url = URL.createObjectURL(file)

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          size: file.size,
          format: file.type,
          filename: file.name,
          originalName: file.name
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
   * 썸네일 생성
   */
  private async generateThumbnail(
    file: File,
    options: ThumbnailOptions = {
      width: 320,
      height: 180,
      quality: 0.8,
      timeOffset: 1.0
    }
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const url = URL.createObjectURL(file)

      video.onloadeddata = () => {
        video.currentTime = options.timeOffset
      }

      video.onseeked = () => {
        canvas.width = options.width
        canvas.height = options.height

        ctx.drawImage(video, 0, 0, options.width, options.height)

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url)
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('썸네일 생성에 실패했습니다'))
            }
          },
          'image/jpeg',
          options.quality
        )
      }

      video.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('썸네일 생성 중 오류가 발생했습니다'))
      }

      video.src = url
    })
  }

  /**
   * 영상 업로드
   */
  async uploadVideo(
    sessionId: string,
    slot: VideoSlot,
    file: File,
    options: UploadOptions = {}
  ): Promise<VideoMetadata> {
    // 검증
    this.validateFileSize(file)
    this.validateFileFormat(file)

    // 메타데이터 추출
    const metadata = await this.extractVideoMetadata(file)

    // 업로드 경로 생성
    const videoPath = this.getVideoPath(sessionId, slot, file.name)
    const thumbnailPath = this.getThumbnailPath(sessionId, slot, file.name)

    try {
      // 기존 파일 삭제 (같은 슬롯에 있던 파일)
      await this.deleteVideoBySlot(sessionId, slot)

      // 영상 업로드 (progress 추적)
      const { data: videoData, error: videoError } = await this.supabase.storage
        .from(this.bucket)
        .upload(videoPath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (videoError) throw videoError

      // 썸네일 생성 및 업로드
      const thumbnailBlob = await this.generateThumbnail(file)
      const { data: thumbnailData, error: thumbnailError } = await this.supabase.storage
        .from(this.thumbnailBucket)
        .upload(thumbnailPath, thumbnailBlob)

      if (thumbnailError) {
        console.warn('썸네일 업로드 실패:', thumbnailError)
      }

      // 공개 URL 생성
      const { data: videoUrl } = this.supabase.storage
        .from(this.bucket)
        .getPublicUrl(videoPath)

      const { data: thumbnailUrl } = thumbnailData
        ? this.supabase.storage.from(this.thumbnailBucket).getPublicUrl(thumbnailPath)
        : { data: null }

      return {
        id: crypto.randomUUID(),
        filename: videoPath,
        originalName: file.name,
        size: file.size,
        duration: metadata.duration || 0,
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || file.type,
        thumbnailUrl: thumbnailUrl?.publicUrl,
        uploadedAt: new Date()
      }
    } catch (error) {
      // 업로드 실패 시 정리
      await this.supabase.storage.from(this.bucket).remove([videoPath])
      await this.supabase.storage.from(this.thumbnailBucket).remove([thumbnailPath])

      throw error
    }
  }

  /**
   * 영상 삭제
   */
  async deleteVideo(videoPath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([videoPath])

    if (error) throw error

    // 썸네일도 삭제 시도
    const thumbnailPath = videoPath.replace(/\.[^.]+$/, '_thumb.jpg')
    await this.supabase.storage
      .from(this.thumbnailBucket)
      .remove([thumbnailPath])
      .catch(() => {
        // 썸네일 삭제 실패는 무시
      })
  }

  /**
   * 슬롯별 영상 삭제
   */
  async deleteVideoBySlot(sessionId: string, slot: VideoSlot): Promise<void> {
    try {
      // 해당 슬롯의 모든 파일 조회
      const { data: files } = await this.supabase.storage
        .from(this.bucket)
        .list(`sessions/${sessionId}/${slot}`)

      if (files && files.length > 0) {
        const filePaths = files.map(file => `sessions/${sessionId}/${slot}/${file.name}`)
        await this.supabase.storage.from(this.bucket).remove(filePaths)
      }

      // 썸네일도 삭제
      const { data: thumbnails } = await this.supabase.storage
        .from(this.thumbnailBucket)
        .list(`sessions/${sessionId}/${slot}`)

      if (thumbnails && thumbnails.length > 0) {
        const thumbnailPaths = thumbnails.map(file => `sessions/${sessionId}/${slot}/${file.name}`)
        await this.supabase.storage.from(this.thumbnailBucket).remove(thumbnailPaths)
      }
    } catch (error) {
      console.warn('기존 파일 삭제 실패:', error)
      // 기존 파일 삭제 실패는 치명적이지 않으므로 계속 진행
    }
  }

  /**
   * 세션의 모든 파일 삭제
   */
  async deleteSessionFiles(sessionId: string): Promise<void> {
    try {
      // 영상 파일들 삭제
      const { data: videoFiles } = await this.supabase.storage
        .from(this.bucket)
        .list(`sessions/${sessionId}`, { recursive: true })

      if (videoFiles && videoFiles.length > 0) {
        const videoPaths = videoFiles.map(file => `sessions/${sessionId}/${file.name}`)
        await this.supabase.storage.from(this.bucket).remove(videoPaths)
      }

      // 썸네일 파일들 삭제
      const { data: thumbnailFiles } = await this.supabase.storage
        .from(this.thumbnailBucket)
        .list(`sessions/${sessionId}`, { recursive: true })

      if (thumbnailFiles && thumbnailFiles.length > 0) {
        const thumbnailPaths = thumbnailFiles.map(file => `sessions/${sessionId}/${file.name}`)
        await this.supabase.storage.from(this.thumbnailBucket).remove(thumbnailPaths)
      }
    } catch (error) {
      console.error('세션 파일 삭제 실패:', error)
      throw error
    }
  }

  /**
   * 스토리지 사용량 조회
   */
  async getStorageUsage(sessionId: string): Promise<{ totalSize: number; fileCount: number }> {
    try {
      const { data: files } = await this.supabase.storage
        .from(this.bucket)
        .list(`sessions/${sessionId}`, { recursive: true })

      if (!files) return { totalSize: 0, fileCount: 0 }

      const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0)

      return {
        totalSize,
        fileCount: files.length
      }
    } catch (error) {
      console.error('스토리지 사용량 조회 실패:', error)
      return { totalSize: 0, fileCount: 0 }
    }
  }

  /**
   * 임시 업로드 URL 생성 (대용량 파일용)
   */
  async createUploadUrl(sessionId: string, slot: VideoSlot, filename: string): Promise<string> {
    const path = this.getVideoPath(sessionId, slot, filename)

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(path)

    if (error) throw error

    return data.signedUrl
  }

  /**
   * 다운로드 URL 생성 (만료 시간 포함)
   */
  async createDownloadUrl(videoPath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(videoPath, expiresIn)

    if (error) throw error

    return data.signedUrl
  }
}

// 싱글톤 인스턴스
export const feedbackStorage = new SupabaseFeedbackStorage()