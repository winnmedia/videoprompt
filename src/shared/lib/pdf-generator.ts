/**
 * 클라이언트 사이드 PDF 생성 유틸리티
 * html2canvas + jsPDF 조합으로 한글 폰트 지원
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { logger } from './logger';


// 한글 폰트 지원을 위한 인터페이스
interface PdfData {
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
 * HTML 문서를 생성하여 한글 폰트로 렌더링된 PDF 생성 (페이지 분할 지원)
 */
function createPrintableHTML(data: PdfData): string {
  return `
    <!DOCTYPE html>
    <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.5;
            color: #1a1a1a;
            background: white;
            padding: 0;
            width: 210mm; /* A4 width */
          }
          
          .page {
            min-height: 297mm; /* A4 height */
            padding: 20mm;
            page-break-after: always;
            position: relative;
          }
          
          .page:last-child {
            page-break-after: avoid;
          }
          
          .header {
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e5e5;
          }
          
          .title {
            font-size: 22px;
            font-weight: 700;
            color: #2563eb;
            margin-bottom: 8px;
          }
          
          .date {
            font-size: 11px;
            color: #6b7280;
          }
          
          .section {
            margin-bottom: 25px;
            break-inside: avoid;
          }
          
          .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid #d1d5db;
          }
          
          .info-item {
            margin-bottom: 6px;
            font-size: 13px;
          }
          
          .info-label {
            font-weight: 500;
            color: #4b5563;
            display: inline-block;
            min-width: 70px;
          }
          
          .step-item {
            margin-bottom: 15px;
            padding: 12px;
            background: #f8fafc;
            border-left: 3px solid #2563eb;
            border-radius: 0 4px 4px 0;
            break-inside: avoid;
          }
          
          .step-title {
            font-size: 15px;
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 6px;
          }
          
          .step-summary {
            font-size: 13px;
            color: #4b5563;
            line-height: 1.4;
          }
          
          .shot-item {
            margin-bottom: 12px;
            padding: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            break-inside: avoid;
          }
          
          .shot-title {
            font-size: 14px;
            font-weight: 500;
            color: #1f2937;
            margin-bottom: 4px;
          }
          
          .shot-description {
            font-size: 12px;
            color: #6b7280;
            line-height: 1.3;
          }
          
          .page-number {
            position: absolute;
            bottom: 10mm;
            right: 20mm;
            font-size: 10px;
            color: #9ca3af;
          }
          
          .footer {
            position: absolute;
            bottom: 10mm;
            left: 20mm;
            font-size: 10px;
            color: #9ca3af;
          }
          
          @media print {
            .page {
              margin: 0;
              padding: 15mm;
            }
            .title { font-size: 18px; }
            .section-title { font-size: 14px; }
            .info-item { font-size: 11px; }
            .step-item { font-size: 11px; }
            .shot-item { font-size: 11px; }
          }
        </style>
      </head>
      <body>
        <!-- 첫 번째 페이지 -->
        <div class="page">
          <div class="header">
            <div class="title">${data.title}</div>
            <div class="date">생성일시: ${data.generatedAt}</div>
          </div>
          
          <div class="section">
            <div class="section-title">기본 정보</div>
            ${data.scenario.title ? `<div class="info-item"><span class="info-label">제목:</span> ${data.scenario.title}</div>` : ''}
            ${data.scenario.oneLine ? `<div class="info-item"><span class="info-label">로그라인:</span> ${data.scenario.oneLine}</div>` : ''}
            ${data.scenario.version ? `<div class="info-item"><span class="info-label">버전:</span> ${data.scenario.version}</div>` : ''}
          </div>
          
          ${data.scenario.structure4 && data.scenario.structure4.length > 0 ? `
            <div class="section">
              <div class="section-title">구성 (4단계)</div>
              ${data.scenario.structure4.slice(0, 2).map((step, idx) => `
                <div class="step-item">
                  <div class="step-title">${idx + 1}. ${step.title || ''}</div>
                  ${step.summary ? `<div class="step-summary">${step.summary}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          <div class="footer">VLANET - AI 영상 플랫폼</div>
          <div class="page-number">1</div>
        </div>

        <!-- 두 번째 페이지 (나머지 구성 + 숏트 시작) -->
        ${(data.scenario.structure4 && data.scenario.structure4.length > 2) || (data.shots && data.shots.length > 0) ? `
        <div class="page">
          ${data.scenario.structure4 && data.scenario.structure4.length > 2 ? `
            <div class="section">
              <div class="section-title">구성 (4단계) - 계속</div>
              ${data.scenario.structure4.slice(2).map((step, idx) => `
                <div class="step-item">
                  <div class="step-title">${idx + 3}. ${step.title || ''}</div>
                  ${step.summary ? `<div class="step-summary">${step.summary}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          ${data.shots && data.shots.length > 0 ? `
            <div class="section">
              <div class="section-title">숏트 요약 (1-6)</div>
              ${data.shots.slice(0, 6).map((shot, idx) => `
                <div class="shot-item">
                  <div class="shot-title">#${idx + 1} ${shot.title || ''}</div>
                  ${shot.description ? `<div class="shot-description">${shot.description}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          <div class="footer">VLANET - AI 영상 플랫폼</div>
          <div class="page-number">2</div>
        </div>
        ` : ''}

        <!-- 세 번째 페이지 (나머지 숏트) -->
        ${data.shots && data.shots.length > 6 ? `
        <div class="page">
          <div class="section">
            <div class="section-title">숏트 요약 (7-12)</div>
            ${data.shots.slice(6, 12).map((shot, idx) => `
              <div class="shot-item">
                <div class="shot-title">#${idx + 7} ${shot.title || ''}</div>
                ${shot.description ? `<div class="shot-description">${shot.description}</div>` : ''}
              </div>
            `).join('')}
          </div>
          
          <div class="footer">VLANET - AI 영상 플랫폼</div>
          <div class="page-number">3</div>
        </div>
        ` : ''}
      </body>
    </html>
  `;
}

/**
 * 기획안 데이터를 PDF로 변환하여 다운로드 (html2canvas + jsPDF)
 */
export async function generatePlanningPDF(data: PdfData): Promise<void> {
  try {
    // HTML 문서 생성
    const htmlContent = createPrintableHTML(data);
    
    // 임시 iframe으로 HTML 렌더링
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.width = '210mm'; // A4 width
    iframe.style.height = '297mm'; // A4 height
    
    document.body.appendChild(iframe);
    
    // iframe에 HTML 컨텐츠 로드
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('iframe 문서에 접근할 수 없습니다.');
    }
    
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
    
    // 폰트 로딩 대기 - document.fonts.ready 사용
    if (iframeDoc.fonts) {
      await iframeDoc.fonts.ready;
    }
    // 추가 대기시간으로 안정성 확보
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 전체 문서의 실제 높이를 측정
    const totalHeight = iframeDoc.body.scrollHeight;
    const pageHeight = 1123; // A4 height in pixels at 96 DPI (297mm)
    const pageWidth = 794; // A4 width in pixels at 96 DPI (210mm)
    
    // html2canvas로 캔버스 생성 (전체 높이 포함)
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2, // 고품질 렌더링
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: pageWidth,
      height: totalHeight, // 전체 높이 사용
      logging: false,
      removeContainer: true,
    });
    
    // iframe 제거
    document.body.removeChild(iframe);
    
    // PDF 생성
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    const pdfPageWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    
    // 캔버스를 페이지별로 분할하여 PDF에 추가
    const totalPages = Math.ceil(canvas.height / (pageHeight * 2)); // scale 2를 고려
    
    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }
      
      // 각 페이지에 해당하는 캔버스 영역을 추출
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = pageHeight * 2; // scale 2를 고려
      
      const pageCtx = pageCanvas.getContext('2d');
      if (pageCtx) {
        pageCtx.drawImage(
          canvas,
          0, page * pageHeight * 2, // 소스 y 위치
          canvas.width, pageHeight * 2, // 소스 크기
          0, 0, // 대상 위치
          pageCanvas.width, pageCanvas.height // 대상 크기
        );
        
        const pageImgData = pageCanvas.toDataURL('image/png', 0.8);
        pdf.addImage(pageImgData, 'PNG', 0, 0, pdfPageWidth, pdfPageHeight);
      }
    }
    
    // 캔버스 메모리 정리
    canvas.width = 0;
    canvas.height = 0;
    
    // PDF 다운로드
    const fileName = `VLANET_기획안_${data.scenario.title || 'untitled'}_${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}.pdf`;
    pdf.save(fileName);
    
    logger.info('PDF가 성공적으로 생성되었습니다:', fileName);
    
  } catch (error) {
    console.error('PDF 생성 중 오류 발생:', error);
    throw new Error('PDF 생성에 실패했습니다. 다시 시도해주세요.');
  }
}

/**
 * 진행률을 표시하며 PDF를 생성 (html2canvas + jsPDF)
 */
export async function generatePlanningPDFWithProgress(
  data: PdfData,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    onProgress?.(5);
    
    // HTML 문서 생성
    const htmlContent = createPrintableHTML(data);
    onProgress?.(15);
    
    // 임시 iframe 생성 및 렌더링
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    
    document.body.appendChild(iframe);
    onProgress?.(25);
    
    // iframe에 HTML 컨텐츠 로드
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('iframe 문서에 접근할 수 없습니다.');
    }
    
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
    onProgress?.(40);
    
    // 폰트 로딩 대기 - document.fonts.ready 사용
    if (iframeDoc.fonts) {
      await iframeDoc.fonts.ready;
    }
    // 추가 대기시간으로 안정성 확보
    await new Promise(resolve => setTimeout(resolve, 500));
    onProgress?.(55);
    
    // 전체 문서의 실제 높이를 측정
    const totalHeight = iframeDoc.body.scrollHeight;
    const pageHeight = 1123; // A4 height in pixels at 96 DPI
    const pageWidth = 794; // A4 width in pixels at 96 DPI
    
    // html2canvas로 캔버스 생성 (전체 높이 포함)
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: pageWidth,
      height: totalHeight,
      logging: false,
      removeContainer: true,
    });
    onProgress?.(70);
    
    // iframe 제거
    document.body.removeChild(iframe);
    
    // PDF 생성
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    const pdfPageWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    
    // 캔버스를 페이지별로 분할하여 PDF에 추가
    const totalPages = Math.ceil(canvas.height / (pageHeight * 2));
    
    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }
      
      // 각 페이지에 해당하는 캔버스 영역을 추출
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = pageHeight * 2;
      
      const pageCtx = pageCanvas.getContext('2d');
      if (pageCtx) {
        pageCtx.drawImage(
          canvas,
          0, page * pageHeight * 2, 
          canvas.width, pageHeight * 2, 
          0, 0, 
          pageCanvas.width, pageCanvas.height 
        );
        
        const pageImgData = pageCanvas.toDataURL('image/png', 0.8);
        pdf.addImage(pageImgData, 'PNG', 0, 0, pdfPageWidth, pdfPageHeight);
      }
      
      // 페이지 처리 진행률 업데이트
      onProgress?.(75 + (page / totalPages) * 15);
    }
    
    // 캔버스 메모리 정리
    canvas.width = 0;
    canvas.height = 0;
    
    // PDF 다운로드
    const fileName = `VLANET_기획안_${data.scenario.title || 'untitled'}_${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}.pdf`;
    pdf.save(fileName);
    
    onProgress?.(100);
    logger.info('PDF가 성공적으로 생성되었습니다:', fileName);
    
  } catch (error) {
    onProgress?.(0);
    console.error('PDF 생성 중 오류 발생:', error);
    throw new Error('PDF 생성에 실패했습니다. 다시 시도해주세요.');
  }
}