/**
 * Planning PDF Export API Route
 *
 * Marp 기반 PDF 내보내기 엔드포인트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS, $300 사건 방지
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'

import {
  withApiHandler,
  validateRequest,
  createSuccessResponse,
  handleCorsPreflightRequest,
  PlanningApiError,
  setCachedResponse,
} from '@/shared/api/planning-utils'

import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'
import { marpPdfClient, type MarpPdfOptions } from '@/shared/lib/pdf-generation/marp-client'
import type { PlanningProject } from '@/entities/planning'

// ===========================================
// 요청/응답 스키마
// ===========================================

const PdfExportRequestSchema = z.object({
  projectId: z.string().uuid('유효하지 않은 프로젝트 ID입니다'),
  format: z.enum(['A4', 'A3', 'A5', '16:9', '4:3']).default('A4'),
  orientation: z.enum(['landscape', 'portrait']).default('landscape'),
  theme: z.enum(['default', 'vlanet', 'minimal', 'cinematic']).default('vlanet'),
  quality: z.enum(['draft', 'standard', 'high']).default('standard'),
  includeStorySteps: z.boolean().default(true),
  includeShotSequences: z.boolean().default(true),
  includeContiImages: z.boolean().default(true),
  includeInsertShots: z.boolean().default(false),
  branding: z.object({
    companyName: z.string().min(1, '회사명은 필수입니다'),
    projectCode: z.string().optional(),
    version: z.string().default('v1.0'),
    logo: z.string().optional(),
  })
})

interface PdfExportResult {
  exportId: string
  fileName: string
  fileSize: number
  pageCount: number
  format: string
  downloadUrl: string
  expiresAt: string
}

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// ===========================================
// POST: PDF 내보내기
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const requestData = await validateRequest(request, PdfExportRequestSchema)

    // 캐시 키 생성 (동일한 설정으로 PDF 요청 시 캐시 활용)
    const cacheKey = `pdf-export-${requestData.projectId}-${JSON.stringify({
      format: requestData.format,
      orientation: requestData.orientation,
      theme: requestData.theme,
      quality: requestData.quality,
      includeStorySteps: requestData.includeStorySteps,
      includeShotSequences: requestData.includeShotSequences,
      includeContiImages: requestData.includeContiImages,
      includeInsertShots: requestData.includeInsertShots,
    })}`

    logger.info('PDF 내보내기 요청', {
      userId: user?.userId,
      component: 'PdfExportAPI',
      metadata: {
        projectId: requestData.projectId,
        format: requestData.format,
        orientation: requestData.orientation,
        quality: requestData.quality,
      },
    })

    try {
      // 1. 프로젝트 상세 정보 조회 (모든 관련 데이터 포함)
      const project = await this.fetchFullProjectData(requestData.projectId, user!.userId)

      // 2. PDF 생성 옵션 구성
      const pdfOptions: MarpPdfOptions = {
        format: requestData.format,
        orientation: requestData.orientation,
        theme: requestData.theme,
        quality: requestData.quality,
        includeStorySteps: requestData.includeStorySteps,
        includeShotSequences: requestData.includeShotSequences,
        includeContiImages: requestData.includeContiImages,
        includeInsertShots: requestData.includeInsertShots,
        branding: {
          companyName: requestData.branding.companyName,
          projectCode: requestData.branding.projectCode || project.metadata.id.slice(0, 8).toUpperCase(),
          version: requestData.branding.version,
          logo: requestData.branding.logo,
        }
      }

      // 3. PDF 생성
      logger.info('Marp PDF 생성 시작', {
        userId: user?.userId,
        component: 'PdfExportAPI',
        metadata: {
          projectId: requestData.projectId,
          projectTitle: project.metadata.title,
          options: pdfOptions,
        },
      })

      const pdfResult = await marpPdfClient.generateProjectPdf(project, pdfOptions)

      // 4. 다운로드 URL 생성 (24시간 유효)
      const downloadUrl = this.generateDownloadUrl(pdfResult.fileName)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      // 5. 내보내기 기록 저장
      const exportRecord = {
        id: pdfResult.id,
        planning_project_id: requestData.projectId,
        user_id: user!.userId,
        file_name: pdfResult.fileName,
        file_path: pdfResult.filePath,
        file_size: pdfResult.fileSize,
        page_count: pdfResult.pageCount,
        format: pdfResult.format,
        theme: requestData.theme,
        quality: requestData.quality,
        options: pdfOptions,
        download_url: downloadUrl,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }

      const { error: insertError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('marp_exports')
          .insert(exportRecord),
        user!.userId,
        'insert_pdf_export_record'
      )

      if (insertError) {
        logger.warn('PDF 내보내기 기록 저장 실패', {
          exportId: pdfResult.id,
          error: insertError
        })
      }

      // 6. 응답 구성
      const result: PdfExportResult = {
        exportId: pdfResult.id,
        fileName: pdfResult.fileName,
        fileSize: pdfResult.fileSize,
        pageCount: pdfResult.pageCount,
        format: pdfResult.format,
        downloadUrl,
        expiresAt,
      }

      // 7. 캐시 저장 (1시간)
      setCachedResponse(cacheKey, result)

      // 성공 로그
      logger.logBusinessEvent('planning_pdf_exported', {
        userId: user?.userId,
        projectId: requestData.projectId,
        exportId: pdfResult.id,
        fileName: pdfResult.fileName,
        fileSize: pdfResult.fileSize,
        pageCount: pdfResult.pageCount,
        format: pdfResult.format,
        options: pdfOptions,
      })

      return createSuccessResponse(result, {
        userId: user?.userId,
      })

    } catch (error) {
      logger.error(
        'PDF 내보내기 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'PdfExportAPI',
          metadata: {
            projectId: requestData.projectId,
            options: requestData,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/planning/export-pdf',
  }
)

// ===========================================
// GET: PDF 다운로드
// ===========================================

const DownloadQuerySchema = z.object({
  fileName: z.string().min(1, '파일명이 필요합니다'),
  token: z.string().optional(),
})

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { searchParams } = new URL(request.url)

    const queryData = DownloadQuerySchema.parse({
      fileName: searchParams.get('fileName'),
      token: searchParams.get('token'),
    })

    logger.info('PDF 다운로드 요청', {
      userId: user?.userId,
      component: 'PdfExportAPI',
      metadata: {
        fileName: queryData.fileName,
        hasToken: !!queryData.token,
      },
    })

    try {
      // 1. 파일 존재 확인
      const filePath = path.join(process.cwd(), 'tmp', 'pdf-exports', queryData.fileName)

      try {
        await fs.access(filePath)
      } catch {
        throw new PlanningApiError('파일을 찾을 수 없습니다.', 'FILE_NOT_FOUND', 404)
      }

      // 2. 내보내기 기록 확인 (권한 검증)
      const { data: exportRecord, error: recordError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('marp_exports')
          .select('*')
          .eq('file_name', queryData.fileName)
          .eq('user_id', user!.userId)
          .single(),
        user!.userId,
        'get_pdf_export_record'
      )

      if (recordError || !exportRecord) {
        throw new PlanningApiError('다운로드 권한이 없습니다.', 'DOWNLOAD_FORBIDDEN', 403)
      }

      // 3. 만료 시간 확인
      if (new Date(exportRecord.expires_at) < new Date()) {
        // 만료된 파일 정리
        try {
          await fs.unlink(filePath)
          await supabaseClient.raw
            .from('marp_exports')
            .delete()
            .eq('id', exportRecord.id)
        } catch {
          // 정리 실패는 무시
        }

        throw new PlanningApiError('파일이 만료되었습니다.', 'FILE_EXPIRED', 410)
      }

      // 4. 파일 읽기 및 전송
      const fileBuffer = await fs.readFile(filePath)

      // 5. 다운로드 로그
      logger.logBusinessEvent('planning_pdf_downloaded', {
        userId: user?.userId,
        exportId: exportRecord.id,
        fileName: queryData.fileName,
        fileSize: fileBuffer.length,
      })

      // 6. 응답 헤더 설정
      const headers = new Headers()
      headers.set('Content-Type', 'application/pdf')
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(queryData.fileName)}"`)
      headers.set('Content-Length', fileBuffer.length.toString())
      headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate')

      return new Response(fileBuffer, {
        status: 200,
        headers,
      })

    } catch (error) {
      logger.error(
        'PDF 다운로드 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'PdfExportAPI',
          metadata: {
            fileName: queryData.fileName,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: false, // 다운로드는 비용 안전 적용 안함
    endpoint: '/api/planning/export-pdf',
  }
)

// ===========================================
// DELETE: PDF 내보내기 기록 삭제
// ===========================================

const DeleteQuerySchema = z.object({
  exportId: z.string().uuid('유효하지 않은 내보내기 ID입니다'),
})

export const DELETE = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context
    const { searchParams } = new URL(request.url)

    const queryData = DeleteQuerySchema.parse({
      exportId: searchParams.get('exportId'),
    })

    logger.info('PDF 내보내기 삭제 요청', {
      userId: user?.userId,
      component: 'PdfExportAPI',
      metadata: {
        exportId: queryData.exportId,
      },
    })

    try {
      // 1. 내보내기 기록 조회
      const { data: exportRecord, error: recordError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('marp_exports')
          .select('*')
          .eq('id', queryData.exportId)
          .eq('user_id', user!.userId)
          .single(),
        user!.userId,
        'get_pdf_export_for_delete'
      )

      if (recordError || !exportRecord) {
        throw new PlanningApiError('내보내기 기록을 찾을 수 없습니다.', 'EXPORT_NOT_FOUND', 404)
      }

      // 2. 파일 삭제
      try {
        await fs.unlink(exportRecord.file_path)
      } catch (error) {
        logger.warn('PDF 파일 삭제 실패', {
          exportId: queryData.exportId,
          filePath: exportRecord.file_path,
          error: error instanceof Error ? error.message : error
        })
      }

      // 3. 데이터베이스 기록 삭제
      const { error: deleteError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('marp_exports')
          .delete()
          .eq('id', queryData.exportId)
          .eq('user_id', user!.userId),
        user!.userId,
        'delete_pdf_export_record'
      )

      if (deleteError) {
        throw new PlanningApiError('내보내기 기록 삭제 실패', 'EXPORT_DELETE_FAILED', 500)
      }

      // 성공 로그
      logger.logBusinessEvent('planning_pdf_export_deleted', {
        userId: user?.userId,
        exportId: queryData.exportId,
        fileName: exportRecord.file_name,
      })

      return createSuccessResponse({
        exportId: queryData.exportId,
        message: 'PDF 내보내기 기록이 삭제되었습니다.',
      }, {
        userId: user?.userId,
      })

    } catch (error) {
      logger.error(
        'PDF 내보내기 삭제 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'PdfExportAPI',
          metadata: {
            exportId: queryData.exportId,
          },
        }
      )
      throw error
    }
  },
  {
    requireAuth: true,
    costSafety: false,
    endpoint: '/api/planning/export-pdf',
  }
)

// ===========================================
// 헬퍼 함수들
// ===========================================

/**
 * 전체 프로젝트 데이터 조회 (모든 관련 테이블 포함)
 */
async function fetchFullProjectData(projectId: string, userId: string): Promise<PlanningProject> {
  // 1. 기본 프로젝트 정보
  const { data: project, error: projectError } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('planning_projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .single(),
    userId,
    'get_full_project_data'
  )

  if (projectError || !project) {
    throw new PlanningApiError('프로젝트를 찾을 수 없습니다.', 'PROJECT_NOT_FOUND', 404)
  }

  // 2. 스토리 스텝 조회
  const { data: storySteps } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('story_steps')
      .select('*')
      .eq('planning_project_id', projectId)
      .order('order', { ascending: true }),
    userId,
    'get_story_steps_for_pdf'
  )

  // 3. 샷 시퀀스 조회
  const { data: shotSequences } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('shot_sequences')
      .select('*')
      .eq('planning_project_id', projectId)
      .order('order', { ascending: true }),
    userId,
    'get_shot_sequences_for_pdf'
  )

  // 4. 인서트 샷 조회
  const { data: insertShots } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('insert_shots')
      .select('*')
      .eq('planning_project_id', projectId)
      .order('shot_sequence_id, order', { ascending: true }),
    userId,
    'get_insert_shots_for_pdf'
  )

  // 5. 콘티 이미지 정보 조회
  const { data: contiGenerations } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('conti_generations')
      .select('shot_sequence_id, image_url, status')
      .eq('planning_project_id', projectId)
      .eq('status', 'completed'),
    userId,
    'get_conti_for_pdf'
  )

  const contiMap = new Map(
    (contiGenerations || []).map(conti => [conti.shot_sequence_id, conti.image_url])
  )

  // 6. PlanningProject 형식으로 변환
  const planningProject: PlanningProject = {
    metadata: {
      id: project.id,
      title: project.title,
      description: project.description,
      createdAt: new Date(project.created_at),
      updatedAt: new Date(project.updated_at),
      userId: project.user_id,
      projectId: project.project_id,
      status: project.status,
    },
    inputData: project.input_data,
    storySteps: (storySteps || []).map(step => ({
      id: step.id,
      order: step.order,
      title: step.title,
      description: step.description,
      duration: step.duration,
      keyPoints: step.key_points || [],
      thumbnailUrl: step.thumbnail_url,
    })),
    shotSequences: (shotSequences || []).map(shot => ({
      id: shot.id,
      order: shot.order,
      title: shot.title,
      description: shot.description,
      duration: shot.duration,
      contiDescription: shot.conti_description,
      contiImageUrl: contiMap.get(shot.id) || shot.conti_image_url,
      contiStyle: shot.conti_style,
      shotType: shot.shot_type,
      cameraMovement: shot.camera_movement,
      location: shot.location,
      characters: shot.characters || [],
      visualElements: shot.visual_elements || [],
      audioNotes: shot.audio_notes,
      transitionType: shot.transition_type,
      storyStepId: shot.story_step_id,
    })),
    insertShots: (insertShots || []).map(insert => ({
      id: insert.id,
      shotSequenceId: insert.shot_sequence_id,
      order: insert.order,
      description: insert.description,
      purpose: insert.purpose,
      imageUrl: insert.image_url,
    })),
    totalDuration: project.total_duration,
    completionPercentage: project.completion_percentage,
    currentStep: project.current_step,
    exportSettings: project.export_settings,
  }

  return planningProject
}

/**
 * 다운로드 URL 생성
 */
function generateDownloadUrl(fileName: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  return `${baseUrl}/api/planning/export-pdf?fileName=${encodeURIComponent(fileName)}`
}