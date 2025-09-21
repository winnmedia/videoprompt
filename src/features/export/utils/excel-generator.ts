/**
 * Excel 생성 유틸리티
 * FSD: features/export/utils
 */

import * as XLSX from 'xlsx';
import type { PromptExportData, ScenarioExportData, ExportOptions } from '../types';

export class ExcelGenerator {
  private workbook: XLSX.WorkBook;

  constructor() {
    this.workbook = XLSX.utils.book_new();
  }

  private createHeaderStyle() {
    return {
      font: { bold: true, sz: 12 },
      fill: { fgColor: { rgb: 'E6F3FF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }
    };
  }

  private createCellStyle() {
    return {
      alignment: { vertical: 'top', wrapText: true },
      border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }
    };
  }

  generatePromptExcel(data: PromptExportData): Blob {
    // 프롬프트 데이터 시트
    const promptsData = [
      ['ID', '제목', '내용', '타입', '카테고리', '태그', '생성일', '수정일'],
      ...data.prompts.map(prompt => [
        prompt.id,
        prompt.title,
        prompt.content,
        prompt.type,
        prompt.category || '',
        prompt.tags?.join(', ') || '',
        new Date(prompt.createdAt).toLocaleString('ko-KR'),
        prompt.updatedAt ? new Date(prompt.updatedAt).toLocaleString('ko-KR') : ''
      ])
    ];

    const promptsSheet = XLSX.utils.aoa_to_sheet(promptsData);

    // 컬럼 너비 설정
    promptsSheet['!cols'] = [
      { wch: 15 }, // ID
      { wch: 25 }, // 제목
      { wch: 50 }, // 내용
      { wch: 12 }, // 타입
      { wch: 15 }, // 카테고리
      { wch: 20 }, // 태그
      { wch: 18 }, // 생성일
      { wch: 18 }  // 수정일
    ];

    // 행 높이 설정 (내용이 긴 경우를 위해)
    promptsSheet['!rows'] = promptsData.map((_, index) =>
      index === 0 ? { hpt: 25 } : { hpt: 40 }
    );

    XLSX.utils.book_append_sheet(this.workbook, promptsSheet, '프롬프트 목록');

    // 메타데이터 시트
    const metadataData = [
      ['항목', '값'],
      ['프로젝트명', data.projectName],
      ['총 프롬프트 수', data.metadata.totalPrompts],
      ['내보내기 일시', data.metadata.exportedAt],
      ['프로젝트 ID', data.metadata.projectId || ''],
      ['', ''],
      ['타입별 통계', ''],
      ['시스템 프롬프트', data.prompts.filter(p => p.type === 'system').length],
      ['사용자 프롬프트', data.prompts.filter(p => p.type === 'user').length],
      ['어시스턴트 프롬프트', data.prompts.filter(p => p.type === 'assistant').length]
    ];

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataData);
    metadataSheet['!cols'] = [{ wch: 20 }, { wch: 30 }];

    XLSX.utils.book_append_sheet(this.workbook, metadataSheet, '메타데이터');

    // 카테고리별 통계 시트
    const categories = [...new Set(data.prompts.map(p => p.category).filter(Boolean))] as string[];
    if (categories.length > 0) {
      const categoryData = [
        ['카테고리', '프롬프트 수'],
        ...categories.map(category => [
          category,
          data.prompts.filter(p => p.category === category).length
        ])
      ];

      const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
      categorySheet['!cols'] = [{ wch: 25 }, { wch: 15 }];

      XLSX.utils.book_append_sheet(this.workbook, categorySheet, '카테고리별 통계');
    }

    return this.createBlob();
  }

  generateScenarioExcel(data: ScenarioExportData): Blob {
    // 샷 목록 시트
    const shotsData = [
      ['번호', '제목', '설명', '지속시간(초)', '장소', '등장인물', '장비', '노트'],
      ...data.shots.map((shot, index) => [
        index + 1,
        shot.title,
        shot.description,
        shot.duration || '',
        shot.location || '',
        shot.characters?.join(', ') || '',
        shot.equipment?.join(', ') || '',
        shot.notes || ''
      ])
    ];

    const shotsSheet = XLSX.utils.aoa_to_sheet(shotsData);

    // 컬럼 너비 설정
    shotsSheet['!cols'] = [
      { wch: 8 },  // 번호
      { wch: 25 }, // 제목
      { wch: 40 }, // 설명
      { wch: 12 }, // 지속시간
      { wch: 20 }, // 장소
      { wch: 25 }, // 등장인물
      { wch: 25 }, // 장비
      { wch: 30 }  // 노트
    ];

    // 행 높이 설정
    shotsSheet['!rows'] = shotsData.map((_, index) =>
      index === 0 ? { hpt: 25 } : { hpt: 50 }
    );

    XLSX.utils.book_append_sheet(this.workbook, shotsSheet, '샷 목록');

    // 프로젝트 정보 시트
    const projectData = [
      ['항목', '값'],
      ['프로젝트 제목', data.title],
      ['설명', data.description || ''],
      ['총 샷 수', data.shots.length],
      ['생성일', new Date(data.metadata.createdAt).toLocaleString('ko-KR')],
      ['작성자', data.metadata.createdBy || ''],
      ['프로젝트 ID', data.metadata.projectId || ''],
      ['버전', data.metadata.version || ''],
      ['', ''],
      ['통계 정보', ''],
      ['평균 샷 길이', this.calculateAverageShot(data.shots)],
      ['장소별 샷 수', ''],
      ...this.getLocationStats(data.shots)
    ];

    const projectSheet = XLSX.utils.aoa_to_sheet(projectData);
    projectSheet['!cols'] = [{ wch: 20 }, { wch: 40 }];

    XLSX.utils.book_append_sheet(this.workbook, projectSheet, '프로젝트 정보');

    return this.createBlob();
  }

  private calculateAverageShot(shots: any[]): string {
    const durations = shots
      .map(shot => shot.duration)
      .filter(duration => duration && typeof duration === 'number');

    if (durations.length === 0) return '정보 없음';

    const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    return `${average.toFixed(1)}초`;
  }

  private getLocationStats(shots: any[]): string[][] {
    const locations = shots
      .map(shot => shot.location)
      .filter(location => location);

    if (locations.length === 0) return [];

    const locationCounts = locations.reduce((acc, location) => {
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(locationCounts).map(([location, count]) => [
      `- ${location}`,
      `${count}개`
    ]);
  }

  private createBlob(): Blob {
    const buffer = XLSX.write(this.workbook, {
      bookType: 'xlsx',
      type: 'array',
      bookSST: false
    });

    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  generateFileName(prefix: string): string {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace(/[:-]/g, '');
    return `${prefix}_${timestamp}.xlsx`;
  }
}