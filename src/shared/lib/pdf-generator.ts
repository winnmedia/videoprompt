/**
 * PDF Generator for Shot Plans
 * 12단계 숏트 기획안을 전문적인 PDF로 생성
 */

import type { TwelveShotCollection, TwelveShot } from '../../entities/Shot';
import type { ShotPlanDownloadRequest, ShotPlanDownloadResponse } from '../../features/shots/types';

// PDF 생성 옵션
interface PDFGenerationOptions {
  format: 'A4' | 'A3' | 'Letter';
  orientation: 'portrait' | 'landscape';
  quality: 'draft' | 'standard' | 'high';
  includeMetadata: boolean;
  includeStoryboards: boolean;
  templateStyle: 'modern' | 'classic' | 'minimal';
}

// PDF 레이아웃 템플릿
interface PDFTemplate {
  name: string;
  description: string;
  layout: 'grid' | 'timeline' | 'storyboard';
  columns: number;
  shotsPerPage: number;
  includeActDividers: boolean;
}

const PDF_TEMPLATES: Record<string, PDFTemplate> = {
  horizontal_grid: {
    name: '가로형 그리드',
    description: '12개 숏트를 4x3 그리드로 배치',
    layout: 'grid',
    columns: 4,
    shotsPerPage: 12,
    includeActDividers: true
  },
  vertical_timeline: {
    name: '세로형 타임라인',
    description: '시간 순서대로 세로 배치',
    layout: 'timeline',
    columns: 1,
    shotsPerPage: 6,
    includeActDividers: true
  },
  storyboard_format: {
    name: '스토리보드 형식',
    description: '영화 스토리보드 스타일',
    layout: 'storyboard',
    columns: 2,
    shotsPerPage: 8,
    includeActDividers: false
  }
};

export class PDFGenerator {
  private collection: TwelveShotCollection;
  private options: PDFGenerationOptions;

  constructor(collection: TwelveShotCollection, options: Partial<PDFGenerationOptions> = {}) {
    this.collection = collection;
    this.options = {
      format: 'A4',
      orientation: 'landscape',
      quality: 'standard',
      includeMetadata: true,
      includeStoryboards: true,
      templateStyle: 'modern',
      ...options
    };
  }

  async generatePDF(request: ShotPlanDownloadRequest): Promise<ShotPlanDownloadResponse> {
    try {
      // PDF 생성 시뮬레이션 (실제로는 jsPDF, Puppeteer 등 사용)
      const pdfContent = await this.createPDFContent(request);

      // 실제 구현에서는 PDF 라이브러리 사용
      const blob = await this.generatePDFBlob(pdfContent, request);

      // 다운로드 URL 생성
      const downloadUrl = URL.createObjectURL(blob);

      // 파일명 생성
      const filename = this.generateFilename(request);

      return {
        success: true,
        downloadUrl,
        filename
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'unknown_error',
          message: error instanceof Error ? error.message : 'PDF 생성 중 오류가 발생했습니다',
          retryable: true,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private async createPDFContent(request: ShotPlanDownloadRequest) {
    const template = this.getTemplate(request.layout);
    const shots = this.collection.shots.sort((a, b) => a.globalOrder - b.globalOrder);

    return {
      title: this.generateTitle(),
      metadata: this.options.includeMetadata ? this.generateMetadata() : null,
      shots: await this.formatShotsForPDF(shots, template, request.includeStoryboards),
      template,
      style: this.options.templateStyle
    };
  }

  private getTemplate(layout: ShotPlanDownloadRequest['layout']): PDFTemplate {
    const templateMap = {
      'horizontal': PDF_TEMPLATES.horizontal_grid,
      'vertical': PDF_TEMPLATES.vertical_timeline,
      'grid': PDF_TEMPLATES.storyboard_format
    };

    return templateMap[layout] || PDF_TEMPLATES.horizontal_grid;
  }

  private generateTitle(): string {
    const storyTitle = this.collection.storyId ? `스토리 기반` : '무제';
    const timestamp = new Date().toLocaleDateString('ko-KR');
    return `12단계 숏트 기획안 - ${storyTitle} (${timestamp})`;
  }

  private generateMetadata() {
    return {
      projectInfo: {
        totalShots: this.collection.shots.length,
        totalDuration: this.collection.totalDuration,
        completionPercentage: this.collection.completionPercentage,
        generatedAt: new Date(this.collection.createdAt).toLocaleString('ko-KR'),
        updatedAt: new Date(this.collection.updatedAt).toLocaleString('ko-KR')
      },
      generationParams: this.collection.generationParams,
      storyboardStats: {
        completed: this.collection.storyboardsCompleted,
        total: this.collection.shots.length,
        allGenerated: this.collection.allStoryboardsGenerated
      },
      actDistribution: this.getActDistribution()
    };
  }

  private getActDistribution() {
    const distribution = {
      setup: 0,
      development: 0,
      climax: 0,
      resolution: 0
    };

    this.collection.shots.forEach(shot => {
      distribution[shot.actType]++;
    });

    return distribution;
  }

  private async formatShotsForPDF(
    shots: TwelveShot[],
    template: PDFTemplate,
    includeStoryboards: boolean
  ) {
    const formattedShots = await Promise.all(
      shots.map(async (shot, index) => {
        const shotData = {
          globalOrder: shot.globalOrder,
          actType: shot.actType,
          actOrder: shot.actOrder,
          title: shot.title,
          description: shot.description,
          shotType: shot.shotType,
          cameraMovement: shot.cameraMovement,
          duration: shot.duration,
          emotion: shot.emotion,
          lightingMood: shot.lightingMood,
          colorPalette: shot.colorPalette,
          transitionType: shot.transitionType,
          charactersInShot: shot.charactersInShot,
          dialogue: shot.dialogue,
          continuityNotes: shot.continuityNotes,
          isUserEdited: shot.isUserEdited
        };

        // 스토리보드 포함 여부 결정
        if (includeStoryboards && shot.storyboard.status === 'completed') {
          return {
            ...shotData,
            storyboard: {
              imageUrl: shot.storyboard.imageUrl,
              style: shot.storyboard.style,
              generatedAt: shot.storyboard.generatedAt
            }
          };
        }

        return shotData;
      })
    );

    // Act별 그룹화 (템플릿이 요구하는 경우)
    if (template.includeActDividers) {
      return this.groupShotsByAct(formattedShots);
    }

    return formattedShots;
  }

  private groupShotsByAct(shots: any[]) {
    const grouped = {
      setup: shots.filter(shot => shot.actType === 'setup'),
      development: shots.filter(shot => shot.actType === 'development'),
      climax: shots.filter(shot => shot.actType === 'climax'),
      resolution: shots.filter(shot => shot.actType === 'resolution')
    };

    return Object.entries(grouped).map(([actType, actShots]) => ({
      actType,
      actTitle: this.getActTitle(actType as any),
      shots: actShots,
      totalDuration: actShots.reduce((sum, shot) => sum + shot.duration, 0)
    }));
  }

  private getActTitle(actType: TwelveShot['actType']): string {
    const titles = {
      setup: '1막: 도입 (Setup)',
      development: '2막: 전개 (Development)',
      climax: '3막: 절정 (Climax)',
      resolution: '4막: 결말 (Resolution)'
    };
    return titles[actType];
  }

  private async generatePDFBlob(content: any, request: ShotPlanDownloadRequest): Promise<Blob> {
    // 실제 구현에서는 jsPDF, Puppeteer, 또는 서버사이드 PDF 생성 사용
    // 여기서는 시뮬레이션된 HTML을 Blob으로 변환

    const htmlContent = this.generateHTMLForPDF(content, request);

    // HTML을 PDF로 변환하는 시뮬레이션
    // 실제로는:
    // - jsPDF 사용: const pdf = new jsPDF(); pdf.html(htmlContent);
    // - Puppeteer 사용: await page.pdf({ format: 'A4' });
    // - 서버 API 호출: await fetch('/api/generate-pdf', { method: 'POST', body: content });

    return new Blob([htmlContent], { type: 'application/pdf' });
  }

  private generateHTMLForPDF(content: any, request: ShotPlanDownloadRequest): string {
    // PDF용 HTML 템플릿 생성
    const css = this.generatePDFStyles(request);
    const body = this.generatePDFBody(content, request);

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.title}</title>
    <style>${css}</style>
</head>
<body>
    ${body}
</body>
</html>`;
  }

  private generatePDFStyles(request: ShotPlanDownloadRequest): string {
    const baseStyles = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Noto Sans KR', Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 100%; margin: 0 auto; padding: 20px; }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
      .title { font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
      .subtitle { font-size: 14px; color: #6b7280; }
      .metadata { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
      .act-section { margin-bottom: 40px; }
      .act-title { font-size: 18px; font-weight: bold; color: #374151; margin-bottom: 20px; padding: 10px; background: #e5e7eb; border-radius: 6px; }
    `;

    const layoutStyles = {
      horizontal: `
        .shots-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
        .shot-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: white; }
      `,
      vertical: `
        .shots-grid { display: flex; flex-direction: column; gap: 20px; }
        .shot-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 15px; background: white; display: flex; gap: 15px; }
      `,
      grid: `
        .shots-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .shot-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 15px; background: white; }
      `
    };

    const shotStyles = `
      .shot-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .shot-number { background: #3b82f6; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
      .shot-title { font-weight: bold; font-size: 14px; margin-bottom: 8px; }
      .shot-description { font-size: 12px; color: #4b5563; margin-bottom: 10px; line-height: 1.4; }
      .shot-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
      .shot-tag { background: #e5e7eb; color: #374151; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
      .storyboard-image { width: 100%; max-width: 200px; height: auto; border-radius: 4px; margin-top: 10px; }
      .page-break { page-break-before: always; }
    `;

    return `${baseStyles}\n${layoutStyles[request.layout]}\n${shotStyles}`;
  }

  private generatePDFBody(content: any, request: ShotPlanDownloadRequest): string {
    let html = `
      <div class="container">
        <div class="header">
          <div class="title">${content.title}</div>
          <div class="subtitle">12단계 숏트 기획안</div>
        </div>
    `;

    // 메타데이터 추가
    if (content.metadata) {
      html += this.generateMetadataHTML(content.metadata);
    }

    // 숏트 내용 추가
    if (Array.isArray(content.shots[0])) {
      // Act별 그룹화된 경우
      content.shots.forEach((actGroup: any, index: number) => {
        html += `
          <div class="act-section ${index > 0 ? 'page-break' : ''}">
            <div class="act-title">${actGroup.actTitle} (${actGroup.shots.length}개 숏트, ${actGroup.totalDuration}초)</div>
            <div class="shots-grid">
              ${actGroup.shots.map((shot: any) => this.generateShotHTML(shot, request.includeStoryboards)).join('')}
            </div>
          </div>
        `;
      });
    } else {
      // 단순 배열인 경우
      html += `
        <div class="shots-grid">
          ${content.shots.map((shot: any) => this.generateShotHTML(shot, request.includeStoryboards)).join('')}
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  private generateMetadataHTML(metadata: any): string {
    return `
      <div class="metadata">
        <h3 style="margin-bottom: 10px; font-size: 16px;">프로젝트 정보</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; font-size: 12px;">
          <div><strong>총 숏트:</strong> ${metadata.projectInfo.totalShots}개</div>
          <div><strong>총 시간:</strong> ${Math.round(metadata.projectInfo.totalDuration)}초</div>
          <div><strong>완성도:</strong> ${metadata.projectInfo.completionPercentage}%</div>
          <div><strong>생성일:</strong> ${metadata.projectInfo.generatedAt}</div>
          <div><strong>콘티 완성:</strong> ${metadata.storyboardStats.completed}/${metadata.storyboardStats.total}</div>
          <div><strong>스타일:</strong> ${metadata.generationParams.style}</div>
        </div>
      </div>
    `;
  }

  private generateShotHTML(shot: any, includeStoryboards: boolean): string {
    const metaTags = [
      shot.shotType,
      `${shot.duration}초`,
      shot.emotion,
      shot.lightingMood
    ].filter(Boolean);

    let html = `
      <div class="shot-card">
        <div class="shot-header">
          <div class="shot-number">${shot.globalOrder}</div>
          <div style="font-size: 10px; color: #6b7280;">${this.getActTitle(shot.actType)}</div>
        </div>

        <div class="shot-title">${shot.title}</div>
        <div class="shot-description">${shot.description}</div>

        <div class="shot-meta">
          ${metaTags.map(tag => `<span class="shot-tag">${tag}</span>`).join('')}
          ${shot.isUserEdited ? '<span class="shot-tag" style="background: #dbeafe; color: #1d4ed8;">편집됨</span>' : ''}
        </div>
    `;

    // 스토리보드 이미지 추가
    if (includeStoryboards && shot.storyboard?.imageUrl) {
      html += `<img src="${shot.storyboard.imageUrl}" alt="${shot.title} 콘티" class="storyboard-image" />`;
    }

    // 추가 정보
    if (shot.charactersInShot?.length > 0) {
      html += `<div style="font-size: 10px; color: #6b7280; margin-top: 5px;"><strong>등장인물:</strong> ${shot.charactersInShot.join(', ')}</div>`;
    }

    if (shot.dialogue) {
      html += `<div style="font-size: 10px; color: #4b5563; margin-top: 5px; font-style: italic;">"${shot.dialogue}"</div>`;
    }

    html += '</div>';
    return html;
  }

  private generateFilename(request: ShotPlanDownloadRequest): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    const layout = request.layout;
    const format = request.format.toLowerCase();

    return `shots-plan-${layout}-${timestamp}.${format}`;
  }

  // 정적 메서드: 빠른 PDF 생성
  static async generateQuickPDF(
    collection: TwelveShotCollection,
    layout: ShotPlanDownloadRequest['layout'] = 'horizontal'
  ): Promise<ShotPlanDownloadResponse> {
    const generator = new PDFGenerator(collection);
    return generator.generatePDF({
      collectionId: collection.id,
      format: 'pdf',
      layout,
      includeStoryboards: true,
      includeMetadata: true
    });
  }

  // 정적 메서드: 이미지 생성 (PNG/JPG)
  static async generateImage(
    collection: TwelveShotCollection,
    format: 'png' | 'jpg' = 'png'
  ): Promise<ShotPlanDownloadResponse> {
    // HTML Canvas를 사용한 이미지 생성 시뮬레이션
    try {
      const generator = new PDFGenerator(collection, {
        format: 'A3',
        orientation: 'landscape',
        quality: 'high'
      });

      // 실제로는 html2canvas 등을 사용하여 이미지 생성
      const canvas = await generator.createCanvasFromHTML(collection);
      const blob = await generator.canvasToBlob(canvas, format);

      const downloadUrl = URL.createObjectURL(blob);
      const filename = `shots-plan-${new Date().toISOString().slice(0, 10)}.${format}`;

      return {
        success: true,
        downloadUrl,
        filename
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'unknown_error',
          message: error instanceof Error ? error.message : '이미지 생성 중 오류가 발생했습니다',
          retryable: true,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private async createCanvasFromHTML(collection: TwelveShotCollection): Promise<HTMLCanvasElement> {
    // html2canvas 시뮬레이션
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    // 실제로는 html2canvas(element) 사용
    return canvas;
  }

  private async canvasToBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpg'): Promise<Blob> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!);
      }, `image/${format}`, 0.9);
    });
  }
}