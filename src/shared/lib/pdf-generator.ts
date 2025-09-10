/**
 * 클라이언트 사이드 PDF 생성 유틸리티
 * html2canvas + jsPDF 조합으로 한글 폰트 지원
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
 * HTML 문서를 생성하여 한글 폰트로 렌더링된 PDF 생성
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
            line-height: 1.6;
            color: #1a1a1a;
            background: white;
            padding: 40px;
            max-width: 210mm; /* A4 width */
          }
          
          .header {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e5e5;
          }
          
          .title {
            font-size: 24px;
            font-weight: 700;
            color: #2563eb;
            margin-bottom: 10px;
          }
          
          .date {
            font-size: 12px;
            color: #6b7280;
          }
          
          .section {
            margin-bottom: 30px;
          }
          
          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid #d1d5db;
          }
          
          .info-item {
            margin-bottom: 8px;
            font-size: 14px;
          }
          
          .info-label {
            font-weight: 500;
            color: #4b5563;
            display: inline-block;
            min-width: 80px;
          }
          
          .step-item {
            margin-bottom: 20px;
            padding: 15px;
            background: #f8fafc;
            border-left: 4px solid #2563eb;
            border-radius: 0 6px 6px 0;
          }
          
          .step-title {
            font-size: 16px;
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 8px;
          }
          
          .step-summary {
            font-size: 14px;
            color: #4b5563;
            line-height: 1.5;
          }
          
          .shot-item {
            margin-bottom: 15px;
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
          }
          
          .shot-title {
            font-size: 15px;
            font-weight: 500;
            color: #1f2937;
            margin-bottom: 6px;
          }
          
          .shot-description {
            font-size: 13px;
            color: #6b7280;
            line-height: 1.4;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            font-size: 12px;
            color: #9ca3af;
            text-align: center;
          }
          
          @media print {
            body { 
              padding: 20px;
              font-size: 13px;
            }
            .title { font-size: 20px; }
            .section-title { font-size: 16px; }
          }
        </style>
      </head>
      <body>
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
            ${data.scenario.structure4.map((step, idx) => `
              <div class="step-item">
                <div class="step-title">${idx + 1}. ${step.title || ''}</div>
                ${step.summary ? `<div class="step-summary">${step.summary}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${data.shots && data.shots.length > 0 ? `
          <div class="section">
            <div class="section-title">숏트 요약</div>
            ${data.shots.slice(0, 12).map((shot, idx) => `
              <div class="shot-item">
                <div class="shot-title">#${idx + 1} ${shot.title || ''}</div>
                ${shot.description ? `<div class="shot-description">${shot.description}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        <div class="footer">
          VLANET - AI 영상 플랫폼
        </div>
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
    
    // html2canvas로 캔버스 생성 (메모리 효율적인 옵션 적용)
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2, // 고품질 렌더링
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794, // A4 width in pixels at 96 DPI
      height: 1123, // A4 height in pixels at 96 DPI
      logging: false, // 성능 향상을 위한 로그 비활성화
      removeContainer: true, // 메모리 정리
    });
    
    // iframe 제거
    document.body.removeChild(iframe);
    
    // PDF 생성
    const imgData = canvas.toDataURL('image/png', 0.8); // 압축률 조정으로 파일 크기 최적화
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true // PDF 압축 활성화
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // 이미지를 PDF에 추가 (전체 페이지 크기에 맞춤)
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    
    // 캔버스 메모리 정리
    canvas.width = 0;
    canvas.height = 0;
    
    // PDF 다운로드
    const fileName = `VLANET_기획안_${data.scenario.title || 'untitled'}_${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}.pdf`;
    pdf.save(fileName);
    
    console.log('PDF가 성공적으로 생성되었습니다:', fileName);
    
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
    
    // html2canvas로 캔버스 생성
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      height: 1123,
      logging: false,
      removeContainer: true,
    });
    onProgress?.(75);
    
    // iframe 제거
    document.body.removeChild(iframe);
    
    // PDF 생성
    const imgData = canvas.toDataURL('image/png', 0.8);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    onProgress?.(90);
    
    // 캔버스 메모리 정리
    canvas.width = 0;
    canvas.height = 0;
    
    // PDF 다운로드
    const fileName = `VLANET_기획안_${data.scenario.title || 'untitled'}_${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}.pdf`;
    pdf.save(fileName);
    
    onProgress?.(100);
    console.log('PDF가 성공적으로 생성되었습니다:', fileName);
    
  } catch (error) {
    onProgress?.(0);
    console.error('PDF 생성 중 오류 발생:', error);
    throw new Error('PDF 생성에 실패했습니다. 다시 시도해주세요.');
  }
}