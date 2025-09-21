/**
 * Export utilities public API
 * FSD: features/export/utils
 */

export { PDFGenerator } from './pdf-generator';
export { ExcelGenerator } from './excel-generator';

import { PDFGenerator } from './pdf-generator';
import { ExcelGenerator } from './excel-generator';
import type {
  ExportFormat,
  ExportOptions,
  ExportResult,
  ScenarioExportData,
  PromptExportData
} from '../types';

/**
 * 파일 다운로드 유틸리티
 */
export function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  // 정리
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 시나리오 PDF 내보내기
 */
export async function exportScenarioToPDF(
  data: ScenarioExportData,
  options: ExportOptions = { format: 'pdf' }
): Promise<ExportResult> {
  try {
    const generator = new PDFGenerator(options);
    const blob = generator.generateScenarioPDF(data);
    const fileName = generator.generateFileName(`scenario_${data.title.replace(/[^a-zA-Z0-9가-힣]/g, '_')}`);

    downloadFile(blob, fileName);

    return {
      success: true,
      fileName,
      downloadUrl: URL.createObjectURL(blob)
    };
  } catch (error) {
    return {
      success: false,
      fileName: '',
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

/**
 * 시나리오 Excel 내보내기
 */
export async function exportScenarioToExcel(
  data: ScenarioExportData
): Promise<ExportResult> {
  try {
    const generator = new ExcelGenerator();
    const blob = generator.generateScenarioExcel(data);
    const fileName = generator.generateFileName(`scenario_${data.title.replace(/[^a-zA-Z0-9가-힣]/g, '_')}`);

    downloadFile(blob, fileName);

    return {
      success: true,
      fileName,
      downloadUrl: URL.createObjectURL(blob)
    };
  } catch (error) {
    return {
      success: false,
      fileName: '',
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

/**
 * 프롬프트 Excel 내보내기
 */
export async function exportPromptToExcel(
  data: PromptExportData
): Promise<ExportResult> {
  try {
    const generator = new ExcelGenerator();
    const blob = generator.generatePromptExcel(data);
    const fileName = generator.generateFileName(`prompts_${data.projectName.replace(/[^a-zA-Z0-9가-힣]/g, '_')}`);

    downloadFile(blob, fileName);

    return {
      success: true,
      fileName,
      downloadUrl: URL.createObjectURL(blob)
    };
  } catch (error) {
    return {
      success: false,
      fileName: '',
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 파일명에서 유효하지 않은 문자 제거
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_')  // Windows 금지 문자
    .replace(/\s+/g, '_')          // 공백을 언더스코어로
    .replace(/_{2,}/g, '_')        // 연속된 언더스코어 제거
    .slice(0, 100);                // 길이 제한
}