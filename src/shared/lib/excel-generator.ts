/**
 * Excel 파일 생성 유틸리티
 * XLSX 라이브러리를 사용한 기획안 Excel 변환
 */

import * as XLSX from 'xlsx';
import { logger } from './logger';

interface ExcelData {
  title: string;
  generatedAt: string;
  scenario: {
    title?: string;
    oneLine?: string;
    version?: string;
    structure4?: Array<{
      title: string;
      summary: string;
    }>;
  };
  shots?: Array<{
    title: string;
    description: string;
  }>;
  prompt?: any;
}

/**
 * 기획안 데이터를 Excel 워크북으로 변환
 */
export function createWorkbook(data: ExcelData): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // 1. 기본 정보 시트
  const basicInfoData = [
    ['항목', '내용'],
    ['제목', data.scenario.title || '제목 없음'],
    ['한줄 요약', data.scenario.oneLine || '요약 없음'],
    ['버전', data.scenario.version || '1.0'],
    ['생성일시', data.generatedAt],
  ];

  const basicInfoSheet = XLSX.utils.aoa_to_sheet(basicInfoData);

  // 헤더 스타일링 (A1:B1)
  basicInfoSheet['!cols'] = [{ width: 20 }, { width: 50 }];

  XLSX.utils.book_append_sheet(workbook, basicInfoSheet, '기본정보');

  // 2. 스토리 구조 시트 (4막 구조)
  if (data.scenario.structure4 && data.scenario.structure4.length > 0) {
    const structureData = [
      ['막', '제목', '내용 요약'],
      ...data.scenario.structure4.map((act, index) => [
        `${index + 1}막`,
        act.title || '제목 없음',
        act.summary || '내용 없음'
      ])
    ];

    const structureSheet = XLSX.utils.aoa_to_sheet(structureData);
    structureSheet['!cols'] = [{ width: 10 }, { width: 30 }, { width: 60 }];

    XLSX.utils.book_append_sheet(workbook, structureSheet, '스토리구조');
  }

  // 3. 샷 리스트 시트
  if (data.shots && data.shots.length > 0) {
    const shotsData = [
      ['샷 번호', '제목', '설명'],
      ...data.shots.map((shot, index) => [
        index + 1,
        shot.title || `샷 ${index + 1}`,
        shot.description || '설명 없음'
      ])
    ];

    const shotsSheet = XLSX.utils.aoa_to_sheet(shotsData);
    shotsSheet['!cols'] = [{ width: 10 }, { width: 30 }, { width: 60 }];

    XLSX.utils.book_append_sheet(workbook, shotsSheet, '샷리스트');
  }

  // 4. 프롬프트 정보 시트
  if (data.prompt) {
    const promptData = [
      ['항목', '내용'],
      ['프롬프트 타입', data.prompt.type || '일반'],
      ['생성 모델', data.prompt.model || 'GPT-4'],
      ['생성일시', data.prompt.createdAt || data.generatedAt],
    ];

    // 프롬프트 내용이 있으면 추가
    if (data.prompt.content) {
      promptData.push(['프롬프트 내용', data.prompt.content]);
    }

    const promptSheet = XLSX.utils.aoa_to_sheet(promptData);
    promptSheet['!cols'] = [{ width: 20 }, { width: 80 }];

    XLSX.utils.book_append_sheet(workbook, promptSheet, '프롬프트');
  }

  return workbook;
}

/**
 * Excel 파일을 다운로드
 */
export function downloadExcel(data: ExcelData, filename?: string): void {
  try {
    logger.info('🔄 Excel 파일 생성 시작', { title: data.title });

    const workbook = createWorkbook(data);

    // 파일명 생성
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    const finalFilename = filename || `기획안_${data.scenario.title || 'untitled'}_${timestamp}.xlsx`;

    // Excel 파일 다운로드
    XLSX.writeFile(workbook, finalFilename);

    logger.info('✅ Excel 파일 다운로드 완료', {
      filename: finalFilename,
      sheets: workbook.SheetNames.length
    });

  } catch (error) {
    logger.error('❌ Excel 파일 생성 실패', error as Error, {
      operation: 'excel-generation',
      title: data.title
    });
    throw error;
  }
}

/**
 * Excel 파일을 Base64 데이터 URL로 변환
 */
export function generateExcelDataUrl(data: ExcelData): string {
  try {
    const workbook = createWorkbook(data);

    // 워크북을 ArrayBuffer로 변환
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    // Base64로 인코딩
    const base64 = btoa(
      new Uint8Array(excelBuffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;

  } catch (error) {
    logger.error('❌ Excel 데이터 URL 생성 실패', error as Error);
    throw error;
  }
}

/**
 * 진행률을 표시하며 Excel 파일 생성
 */
export async function downloadExcelWithProgress(
  data: ExcelData,
  onProgress?: (progress: number, status: string) => void,
  filename?: string
): Promise<void> {
  try {
    onProgress?.(10, '데이터 검증 중...');

    // 데이터 유효성 검사
    if (!data.scenario.title) {
      throw new Error('시나리오 제목이 필요합니다');
    }

    onProgress?.(30, 'Excel 워크북 생성 중...');

    const workbook = createWorkbook(data);

    onProgress?.(60, '시트 구성 중...');

    // 파일명 생성
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    const finalFilename = filename || `기획안_${data.scenario.title}_${timestamp}.xlsx`;

    onProgress?.(80, '파일 생성 중...');

    // 약간의 지연으로 진행률 표시
    await new Promise(resolve => setTimeout(resolve, 300));

    onProgress?.(90, '다운로드 준비 중...');

    // Excel 파일 다운로드
    XLSX.writeFile(workbook, finalFilename);

    onProgress?.(100, '완료!');

    logger.info('✅ Excel 파일 다운로드 완료 (진행률 표시)', {
      filename: finalFilename,
      sheets: workbook.SheetNames.length
    });

  } catch (error) {
    logger.error('❌ Excel 파일 생성 실패 (진행률)', error as Error);
    onProgress?.(0, '오류 발생');
    throw error;
  }
}

/**
 * 시나리오 데이터를 Excel 호환 형식으로 변환
 */
export function transformScenarioForExcel(scenario: any): ExcelData {
  return {
    title: 'VLANET • 기획안 Excel 내보내기',
    generatedAt: new Date().toLocaleString('ko-KR'),
    scenario: {
      title: scenario.title || scenario.storyTitle,
      oneLine: scenario.oneLine || scenario.oneLineStory,
      version: scenario.version || '1.0',
      structure4: scenario.structure4 || scenario.storyStructure || []
    },
    shots: scenario.shots || scenario.storyboard || [],
    prompt: scenario.prompt || null
  };
}