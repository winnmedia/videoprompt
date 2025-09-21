/**
 * PDF 생성 유틸리티
 * FSD: features/export/utils
 */

import jsPDF from 'jspdf';
import type { ScenarioExportData, ExportOptions } from '../types';

export class PDFGenerator {
  private doc: jsPDF;
  private readonly margin = 20;
  private readonly lineHeight = 7;
  private currentY = 20;

  constructor(options: ExportOptions) {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: options.pageSize || 'A4',
    });
  }

  private addText(text: string, x: number, y: number, options?: {
    fontSize?: number;
    fontStyle?: 'normal' | 'bold' | 'italic';
    maxWidth?: number;
  }): number {
    const fontSize = options?.fontSize || 10;
    const fontStyle = options?.fontStyle || 'normal';
    const maxWidth = options?.maxWidth || 170;

    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', fontStyle);

    const lines = this.doc.splitTextToSize(text, maxWidth);
    this.doc.text(lines, x, y);

    return lines.length * this.lineHeight;
  }

  private addHeading(text: string, level: number = 1): void {
    this.checkPageBreak(20);

    const fontSize = level === 1 ? 16 : level === 2 ? 14 : 12;
    const fontStyle = level <= 2 ? 'bold' : 'normal';

    if (level === 1) {
      this.currentY += 10; // 추가 여백
    }

    this.addText(text, this.margin, this.currentY, {
      fontSize,
      fontStyle
    });

    this.currentY += this.lineHeight * 1.5;

    if (level <= 2) {
      this.doc.setDrawColor(0, 0, 0);
      this.doc.line(this.margin, this.currentY, 190, this.currentY);
      this.currentY += 5;
    }
  }

  private checkPageBreak(spaceNeeded: number): void {
    if (this.currentY + spaceNeeded > 277) { // A4 height - margin
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  private addSeparator(): void {
    this.currentY += 5;
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.currentY, 190, this.currentY);
    this.currentY += 10;
  }

  generateScenarioPDF(data: ScenarioExportData): Blob {
    // 제목 페이지
    this.addHeading(data.title, 1);

    if (data.description) {
      this.currentY += 5;
      const textHeight = this.addText(data.description, this.margin, this.currentY, {
        fontSize: 11,
        maxWidth: 170
      });
      this.currentY += textHeight + 10;
    }

    // 메타데이터
    this.addHeading('프로젝트 정보', 2);
    this.addText(`생성일: ${new Date(data.metadata.createdAt).toLocaleString('ko-KR')}`, this.margin, this.currentY);
    this.currentY += this.lineHeight;

    if (data.metadata.createdBy) {
      this.addText(`작성자: ${data.metadata.createdBy}`, this.margin, this.currentY);
      this.currentY += this.lineHeight;
    }

    if (data.metadata.version) {
      this.addText(`버전: ${data.metadata.version}`, this.margin, this.currentY);
      this.currentY += this.lineHeight;
    }

    this.addText(`총 샷 수: ${data.shots.length}개`, this.margin, this.currentY);
    this.currentY += this.lineHeight * 2;

    this.addSeparator();

    // 샷 목록
    this.addHeading('샷 목록', 2);

    data.shots.forEach((shot, index) => {
      this.checkPageBreak(40);

      // 샷 제목
      this.addHeading(`${index + 1}. ${shot.title}`, 3);

      // 샷 설명
      if (shot.description) {
        const textHeight = this.addText(shot.description, this.margin, this.currentY, {
          fontSize: 10,
          maxWidth: 170
        });
        this.currentY += textHeight + 5;
      }

      // 샷 세부 정보
      const details: string[] = [];
      if (shot.duration) details.push(`지속시간: ${shot.duration}초`);
      if (shot.location) details.push(`장소: ${shot.location}`);
      if (shot.characters?.length) details.push(`등장인물: ${shot.characters.join(', ')}`);
      if (shot.equipment?.length) details.push(`장비: ${shot.equipment.join(', ')}`);

      if (details.length > 0) {
        details.forEach(detail => {
          this.addText(`• ${detail}`, this.margin + 5, this.currentY, {
            fontSize: 9
          });
          this.currentY += this.lineHeight;
        });
        this.currentY += 3;
      }

      // 노트
      if (shot.notes) {
        this.addText('노트:', this.margin, this.currentY, {
          fontSize: 9,
          fontStyle: 'bold'
        });
        this.currentY += this.lineHeight;

        const notesHeight = this.addText(shot.notes, this.margin + 5, this.currentY, {
          fontSize: 9,
          maxWidth: 165
        });
        this.currentY += notesHeight + 5;
      }

      if (index < data.shots.length - 1) {
        this.addSeparator();
      }
    });

    // 푸터 정보
    this.checkPageBreak(20);
    this.currentY += 10;
    this.addText(
      `이 문서는 VideoPlanet에서 자동 생성되었습니다. (${new Date().toLocaleString('ko-KR')})`,
      this.margin,
      this.currentY,
      { fontSize: 8 }
    );

    return this.doc.output('blob');
  }

  generateFileName(prefix: string): string {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace(/[:-]/g, '');
    return `${prefix}_${timestamp}.pdf`;
  }
}