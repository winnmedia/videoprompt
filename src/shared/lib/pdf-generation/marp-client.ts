/**
 * Marp PDF Generation Client
 *
 * CLAUDE.md 준수: shared/lib 기술 구현
 * Marp Core를 이용한 프레젠테이션 PDF 생성 클라이언트
 */

import { Marp } from '@marp-team/marp-core'
import fs from 'fs/promises'
import path from 'path'
import puppeteer from 'puppeteer'
import logger from '../logger'
import type { PlanningProject, StoryStep, ShotSequence } from '@/entities/planning'

/**
 * PDF 생성 옵션
 */
export interface MarpPdfOptions {
  format: 'A4' | 'A3' | 'A5' | '16:9' | '4:3'
  orientation: 'landscape' | 'portrait'
  theme?: 'default' | 'vlanet' | 'minimal' | 'cinematic'
  includeStorySteps: boolean
  includeShotSequences: boolean
  includeContiImages: boolean
  includeInsertShots: boolean
  quality: 'draft' | 'standard' | 'high'
  branding: {
    logo?: string
    companyName: string
    projectCode?: string
    version?: string
  }
}

/**
 * PDF 생성 결과
 */
export interface MarpPdfResult {
  id: string
  filePath: string
  fileName: string
  fileSize: number
  pageCount: number
  format: string
  createdAt: string
  downloadUrl?: string
}

/**
 * PDF 생성 에러
 */
export class PdfGenerationError extends Error {
  constructor(
    message: string,
    public code: string = 'PDF_GENERATION_ERROR',
    public status: number = 500
  ) {
    super(message)
    this.name = 'PdfGenerationError'
  }
}

/**
 * Marp PDF 생성 클라이언트
 */
export class MarpPdfClient {
  private marp: Marp
  private outputDir: string

  constructor() {
    this.marp = new Marp({
      allowLocalFiles: true,
      html: true,
    })

    // PDF 출력 디렉토리 설정
    this.outputDir = path.join(process.cwd(), 'tmp', 'pdf-exports')
    this.initializeClient()
  }

  /**
   * 클라이언트 초기화
   */
  private async initializeClient(): Promise<void> {
    try {
      // 출력 디렉토리 생성
      await fs.mkdir(this.outputDir, { recursive: true })

      // VLANET 커스텀 테마 등록
      await this.registerVlanetTheme()

      logger.info('Marp PDF 클라이언트 초기화 완료', {
        component: 'MarpPdfClient',
        outputDir: this.outputDir
      })
    } catch (error) {
      logger.error('Marp PDF 클라이언트 초기화 실패', {
        error: error instanceof Error ? error.message : error
      })
      throw new PdfGenerationError('PDF 클라이언트 초기화 실패', 'CLIENT_INIT_FAILED', 500)
    }
  }

  /**
   * VLANET 커스텀 테마 등록
   */
  private async registerVlanetTheme(): Promise<void> {
    const vlanetTheme = `
/* @theme vlanet */

@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');

:root {
  --vlanet-primary: #FF6B35;
  --vlanet-secondary: #2C3E50;
  --vlanet-accent: #3498DB;
  --vlanet-dark: #1A1A1A;
  --vlanet-light: #F8F9FA;
  --vlanet-gray: #6C757D;
}

section {
  font-family: 'Noto Sans KR', sans-serif;
  background: linear-gradient(135deg, var(--vlanet-light) 0%, #E8F4F8 100%);
  color: var(--vlanet-dark);
  padding: 60px;
  line-height: 1.6;
}

section.title {
  background: linear-gradient(135deg, var(--vlanet-primary) 0%, var(--vlanet-secondary) 100%);
  color: white;
  text-align: center;
  justify-content: center;
  display: flex;
  flex-direction: column;
}

section.title h1 {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 30px;
  text-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

section.title .subtitle {
  font-size: 1.5rem;
  font-weight: 300;
  opacity: 0.9;
  margin-bottom: 40px;
}

section.title .metadata {
  font-size: 1rem;
  font-weight: 400;
  opacity: 0.8;
}

h1 {
  color: var(--vlanet-primary);
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 30px;
  border-bottom: 3px solid var(--vlanet-primary);
  padding-bottom: 15px;
}

h2 {
  color: var(--vlanet-secondary);
  font-size: 2rem;
  font-weight: 500;
  margin: 40px 0 25px 0;
  position: relative;
}

h2::before {
  content: '';
  position: absolute;
  left: -20px;
  top: 50%;
  transform: translateY(-50%);
  width: 5px;
  height: 30px;
  background: var(--vlanet-accent);
  border-radius: 3px;
}

h3 {
  color: var(--vlanet-accent);
  font-size: 1.5rem;
  font-weight: 500;
  margin: 30px 0 20px 0;
}

.shot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 25px;
  margin: 30px 0;
}

.shot-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  border-left: 5px solid var(--vlanet-accent);
}

.shot-card h4 {
  color: var(--vlanet-secondary);
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 15px;
}

.shot-info {
  font-size: 0.9rem;
  color: var(--vlanet-gray);
  margin-bottom: 10px;
}

.conti-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  margin: 15px 0;
  border: 2px solid var(--vlanet-light);
}

.footer {
  position: absolute;
  bottom: 30px;
  right: 40px;
  font-size: 0.8rem;
  color: var(--vlanet-gray);
  font-weight: 300;
}

.logo {
  position: absolute;
  top: 30px;
  right: 40px;
  width: 120px;
  height: auto;
}

.page-number {
  position: absolute;
  bottom: 30px;
  left: 40px;
  font-size: 0.8rem;
  color: var(--vlanet-gray);
  font-weight: 300;
}

/* 프린트 최적화 */
@media print {
  section {
    page-break-inside: avoid;
  }

  .shot-grid {
    page-break-inside: avoid;
  }

  .shot-card {
    page-break-inside: avoid;
  }
}
`

    this.marp.themeSet.add(vlanetTheme)
  }

  /**
   * 기획 프로젝트를 PDF로 생성
   */
  async generateProjectPdf(
    project: PlanningProject,
    options: MarpPdfOptions
  ): Promise<MarpPdfResult> {
    this.validateProject(project)
    this.validateOptions(options)

    const startTime = Date.now()
    const pdfId = `pdf-${project.metadata.id}-${Date.now()}`
    const fileName = this.generateFileName(project, options)
    const filePath = path.join(this.outputDir, fileName)

    logger.info('PDF 생성 시작', {
      component: 'MarpPdfClient',
      metadata: {
        projectId: project.metadata.id,
        projectTitle: project.metadata.title,
        pdfId,
        options
      }
    })

    try {
      // 1. Markdown 콘텐츠 생성
      const markdownContent = await this.generateMarkdownContent(project, options)

      // 2. Marp로 HTML 변환
      const { html, css } = this.marp.render(markdownContent, {
        allowLocalFiles: true
      })

      // 3. Puppeteer로 PDF 생성
      const pdfBuffer = await this.generatePdfFromHtml(html, css, options)

      // 4. 파일 저장
      await fs.writeFile(filePath, pdfBuffer)

      // 5. 파일 정보 수집
      const stats = await fs.stat(filePath)
      const pageCount = await this.estimatePageCount(markdownContent)

      const result: MarpPdfResult = {
        id: pdfId,
        filePath,
        fileName,
        fileSize: stats.size,
        pageCount,
        format: `${options.format}-${options.orientation}`,
        createdAt: new Date().toISOString(),
      }

      const processingTime = Date.now() - startTime

      logger.logBusinessEvent('planning_pdf_generated', {
        projectId: project.metadata.id,
        pdfId,
        fileName,
        fileSize: stats.size,
        pageCount,
        processingTime,
        options
      })

      logger.info('PDF 생성 완료', {
        component: 'MarpPdfClient',
        metadata: {
          ...result,
          processingTime
        }
      })

      return result

    } catch (error) {
      logger.error('PDF 생성 실패', {
        error: error instanceof Error ? error.message : error,
        projectId: project.metadata.id,
        pdfId,
        options
      })

      // 실패한 파일 정리
      try {
        await fs.unlink(filePath)
      } catch {
        // 파일이 생성되지 않았을 수 있음
      }

      throw new PdfGenerationError(
        'PDF 생성 중 오류가 발생했습니다',
        'PDF_GENERATION_FAILED',
        500
      )
    }
  }

  /**
   * Markdown 콘텐츠 생성
   */
  private async generateMarkdownContent(
    project: PlanningProject,
    options: MarpPdfOptions
  ): Promise<string> {
    const sections: string[] = []

    // Marp 설정
    sections.push('---')
    sections.push(`theme: ${options.theme || 'vlanet'}`)
    sections.push(`size: ${options.format}`)
    sections.push('paginate: true')
    sections.push('header: ![logo](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgMTIwIDQwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8dGV4dCB4PSI2MCIgeT0iMjQiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZm9udC13ZWlnaHQ9ImJvbGQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNGRjZCMzUiPlZMQU5FVDwvdGV4dD4KPC9zdmc+)')
    sections.push('footer: \'© 2024 VLANET. All rights reserved.\'')
    sections.push('---')

    // 표지 페이지
    sections.push('<!-- _class: title -->')
    sections.push('')
    sections.push(`# ${project.metadata.title}`)
    sections.push('')
    sections.push('<div class="subtitle">영상 기획서</div>')
    sections.push('')
    sections.push('<div class="metadata">')
    sections.push(`**프로젝트 코드:** ${options.branding.projectCode || project.metadata.id.slice(0, 8).toUpperCase()}`)
    sections.push(`**생성일:** ${new Date().toLocaleDateString('ko-KR')}`)
    sections.push(`**버전:** ${options.branding.version || 'v1.0'}`)
    sections.push(`**제작사:** ${options.branding.companyName}`)
    sections.push('</div>')
    sections.push('')
    sections.push('---')

    // 프로젝트 개요
    sections.push('# 프로젝트 개요')
    sections.push('')
    if (project.metadata.description) {
      sections.push(`**프로젝트 설명**`)
      sections.push('')
      sections.push(project.metadata.description)
      sections.push('')
    }

    if (project.inputData) {
      const input = project.inputData
      sections.push('## 기획 정보')
      sections.push('')
      sections.push('| 항목 | 내용 |')
      sections.push('|------|------|')
      if (input.targetDuration) sections.push(`| 목표 러닝타임 | ${Math.floor(input.targetDuration / 60)}분 ${input.targetDuration % 60}초 |`)
      if (input.toneAndManner) sections.push(`| 톤앤매너 | ${input.toneAndManner} |`)
      if (input.development) sections.push(`| 전개 방식 | ${input.development} |`)
      if (input.intensity) sections.push(`| 강도 | ${input.intensity} |`)
      if (input.targetAudience) sections.push(`| 타겟 | ${input.targetAudience} |`)
      if (input.mainMessage) sections.push(`| 핵심 메시지 | ${input.mainMessage} |`)
      sections.push('')
    }

    sections.push(`**총 예상 러닝타임:** ${this.formatDuration(project.totalDuration || 0)}`)
    sections.push(`**완성도:** ${project.completionPercentage || 0}%`)
    sections.push('')
    sections.push('---')

    // 스토리 구성 (4단계)
    if (options.includeStorySteps && project.storySteps && project.storySteps.length > 0) {
      sections.push('# 스토리 구성')
      sections.push('')

      project.storySteps.forEach((step, index) => {
        sections.push(`## ${index + 1}단계: ${step.title}`)
        sections.push('')
        if (step.description) {
          sections.push(step.description)
          sections.push('')
        }

        if (step.keyPoints && step.keyPoints.length > 0) {
          sections.push('**주요 포인트:**')
          sections.push('')
          step.keyPoints.forEach(point => {
            sections.push(`- ${point}`)
          })
          sections.push('')
        }

        if (step.duration) {
          sections.push(`**예상 시간:** ${this.formatDuration(step.duration)}`)
          sections.push('')
        }

        if (index < project.storySteps.length - 1) {
          sections.push('---')
          sections.push('')
        }
      })

      sections.push('---')
    }

    // 샷 시퀀스
    if (options.includeShotSequences && project.shotSequences && project.shotSequences.length > 0) {
      sections.push('# 샷 시퀀스')
      sections.push('')

      // 샷 시퀀스를 그룹으로 나누어 처리 (페이지당 4-6개)
      const shotsPerPage = 4
      for (let i = 0; i < project.shotSequences.length; i += shotsPerPage) {
        const shotGroup = project.shotSequences.slice(i, i + shotsPerPage)

        sections.push('<div class="shot-grid">')
        sections.push('')

        shotGroup.forEach(shot => {
          sections.push('<div class="shot-card">')
          sections.push('')
          sections.push(`#### Shot ${shot.order}: ${shot.title}`)
          sections.push('')

          sections.push('<div class="shot-info">')
          if (shot.shotType) sections.push(`**샷 타입:** ${shot.shotType}`)
          if (shot.cameraMovement) sections.push(`**카메라 무브먼트:** ${shot.cameraMovement}`)
          if (shot.location) sections.push(`**장소:** ${shot.location}`)
          if (shot.duration) sections.push(`**길이:** ${this.formatDuration(shot.duration)}`)
          sections.push('</div>')
          sections.push('')

          if (shot.description) {
            sections.push(shot.description)
            sections.push('')
          }

          // 콘티 이미지 포함
          if (options.includeContiImages && shot.contiImageUrl) {
            sections.push(`![콘티](${shot.contiImageUrl})`)
            sections.push('')
          }

          if (shot.characters && shot.characters.length > 0) {
            sections.push(`**등장인물:** ${shot.characters.join(', ')}`)
            sections.push('')
          }

          if (shot.visualElements && shot.visualElements.length > 0) {
            sections.push(`**시각적 요소:** ${shot.visualElements.join(', ')}`)
            sections.push('')
          }

          if (shot.audioNotes) {
            sections.push(`**오디오 노트:** ${shot.audioNotes}`)
            sections.push('')
          }

          sections.push('</div>')
          sections.push('')
        })

        sections.push('</div>')
        sections.push('')

        // 마지막 그룹이 아니면 페이지 나누기
        if (i + shotsPerPage < project.shotSequences.length) {
          sections.push('---')
          sections.push('')
        }
      }

      sections.push('---')
    }

    // 인서트 샷 (옵션)
    if (options.includeInsertShots && project.insertShots && project.insertShots.length > 0) {
      sections.push('# 인서트 샷')
      sections.push('')

      project.insertShots.forEach(insert => {
        sections.push(`## ${insert.description}`)
        sections.push('')
        sections.push(`**목적:** ${insert.purpose}`)
        sections.push('')
        if (insert.imageUrl) {
          sections.push(`![인서트](${insert.imageUrl})`)
          sections.push('')
        }
      })

      sections.push('---')
    }

    // 부록 및 메타데이터
    sections.push('# 부록')
    sections.push('')
    sections.push('## 제작 정보')
    sections.push('')
    sections.push('| 항목 | 내용 |')
    sections.push('|------|------|')
    sections.push(`| 문서 생성일 | ${new Date().toLocaleString('ko-KR')} |`)
    sections.push(`| 프로젝트 ID | ${project.metadata.id} |`)
    sections.push(`| 최종 수정일 | ${new Date(project.metadata.updatedAt).toLocaleString('ko-KR')} |`)
    sections.push(`| 현재 단계 | ${project.currentStep} |`)
    sections.push(`| 총 스토리 단계 | ${project.storySteps?.length || 0}개 |`)
    sections.push(`| 총 샷 시퀀스 | ${project.shotSequences?.length || 0}개 |`)
    sections.push(`| 총 인서트 샷 | ${project.insertShots?.length || 0}개 |`)
    sections.push('')

    return sections.join('\n')
  }

  /**
   * Puppeteer로 PDF 생성
   */
  private async generatePdfFromHtml(
    html: string,
    css: string,
    options: MarpPdfOptions
  ): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })

    try {
      const page = await browser.newPage()

      // 페이지 크기 설정
      const pageSize = this.getPageSize(options.format, options.orientation)
      await page.setViewport({ width: pageSize.width, height: pageSize.height })

      // HTML 콘텐츠 설정
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>${css}</style>
        </head>
        <body>${html}</body>
        </html>
      `

      await page.setContent(fullHtml, { waitUntil: 'networkidle0' })

      // PDF 생성 옵션
      const pdfOptions: any = {
        format: options.format === '16:9' || options.format === '4:3' ? 'A4' : options.format,
        landscape: options.orientation === 'landscape',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      }

      // 품질 설정
      switch (options.quality) {
        case 'draft':
          pdfOptions.preferCSSPageSize = false
          break
        case 'standard':
          pdfOptions.preferCSSPageSize = true
          break
        case 'high':
          pdfOptions.preferCSSPageSize = true
          pdfOptions.scale = 1.2
          break
      }

      const pdfBuffer = await page.pdf(pdfOptions)
      return pdfBuffer

    } finally {
      await browser.close()
    }
  }

  /**
   * 파일명 생성
   */
  private generateFileName(project: PlanningProject, options: MarpPdfOptions): string {
    const safeTitle = project.metadata.title
      .replace(/[^a-zA-Z0-9가-힣\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
    const format = `${options.format}_${options.orientation}`

    return `${safeTitle}_${format}_${timestamp}.pdf`
  }

  /**
   * 페이지 크기 계산
   */
  private getPageSize(format: string, orientation: string) {
    const sizes: Record<string, { width: number; height: number }> = {
      'A4': { width: 794, height: 1123 },
      'A3': { width: 1123, height: 1587 },
      'A5': { width: 559, height: 794 },
      '16:9': { width: 1024, height: 576 },
      '4:3': { width: 1024, height: 768 }
    }

    const size = sizes[format] || sizes['A4']

    if (orientation === 'landscape') {
      return { width: size.height, height: size.width }
    }

    return size
  }

  /**
   * 페이지 수 추정
   */
  private async estimatePageCount(markdownContent: string): Promise<number> {
    // 페이지 구분자(---)와 콘텐츠 양을 기반으로 추정
    const pageBreaks = (markdownContent.match(/^---$/gm) || []).length
    const contentLines = markdownContent.split('\n').filter(line => line.trim()).length
    const estimatedContentPages = Math.ceil(contentLines / 25) // 페이지당 약 25줄

    return Math.max(pageBreaks, estimatedContentPages)
  }

  /**
   * 시간 포맷팅
   */
  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}분 ${secs}초`
  }

  /**
   * 프로젝트 검증
   */
  private validateProject(project: PlanningProject): void {
    if (!project.metadata?.title) {
      throw new PdfGenerationError('프로젝트 제목이 필요합니다', 'MISSING_TITLE', 400)
    }

    if (!project.metadata?.id) {
      throw new PdfGenerationError('프로젝트 ID가 필요합니다', 'MISSING_PROJECT_ID', 400)
    }
  }

  /**
   * 옵션 검증
   */
  private validateOptions(options: MarpPdfOptions): void {
    const validFormats = ['A4', 'A3', 'A5', '16:9', '4:3']
    if (!validFormats.includes(options.format)) {
      throw new PdfGenerationError('지원하지 않는 PDF 형식입니다', 'INVALID_FORMAT', 400)
    }

    const validOrientations = ['landscape', 'portrait']
    if (!validOrientations.includes(options.orientation)) {
      throw new PdfGenerationError('지원하지 않는 방향입니다', 'INVALID_ORIENTATION', 400)
    }

    if (!options.branding?.companyName) {
      throw new PdfGenerationError('회사명이 필요합니다', 'MISSING_COMPANY_NAME', 400)
    }
  }

  /**
   * 생성된 PDF 파일 정리
   */
  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const files = await fs.readdir(this.outputDir)
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000)

      for (const file of files) {
        if (file.endsWith('.pdf')) {
          const filePath = path.join(this.outputDir, file)
          const stats = await fs.stat(filePath)

          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath)
            logger.info('오래된 PDF 파일 삭제', {
              component: 'MarpPdfClient',
              fileName: file,
              age: Math.round((Date.now() - stats.mtime.getTime()) / (60 * 60 * 1000))
            })
          }
        }
      }
    } catch (error) {
      logger.warn('PDF 파일 정리 실패', {
        error: error instanceof Error ? error.message : error
      })
    }
  }
}

/**
 * 글로벌 Marp PDF 클라이언트 인스턴스
 */
export const marpPdfClient = new MarpPdfClient()