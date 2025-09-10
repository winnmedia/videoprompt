/**
 * 클라이언트 사이드 PDF 생성 유틸리티
 * jsPDF를 사용하여 기획안을 PDF로 변환
 */

import jsPDF from 'jspdf';

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
 * 기획안 데이터를 PDF로 변환하여 다운로드
 */
export async function generatePlanningPDF(data: PdfData): Promise<void> {
  try {
    // A4 세로 방향으로 PDF 생성
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    
    let yPosition = margin;
    const lineHeight = 7;

    // 페이지 추가가 필요한지 확인하는 함수
    const checkPageBreak = (neededHeight: number) => {
      if (yPosition + neededHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    // 텍스트 추가 헬퍼 함수
    const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
      checkPageBreak(lineHeight);
      doc.setFontSize(fontSize);
      if (isBold) {
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      doc.text(text, margin, yPosition, { maxWidth });
      yPosition += lineHeight;
    };

    // 제목
    addText(data.title, 18, true);
    yPosition += 5;

    // 생성 일시
    addText(`생성일시: ${data.generatedAt}`, 10);
    yPosition += 10;

    // 기본 정보
    addText('기본 정보', 14, true);
    yPosition += 2;
    
    if (data.scenario.title) {
      addText(`제목: ${data.scenario.title}`);
    }
    if (data.scenario.oneLine) {
      addText(`로그라인: ${data.scenario.oneLine}`);
    }
    if (data.scenario.version) {
      addText(`버전: ${data.scenario.version}`);
    }
    yPosition += 10;

    // 4단계 구성
    if (data.scenario.structure4 && data.scenario.structure4.length > 0) {
      addText('구성 (4단계)', 14, true);
      yPosition += 2;
      
      data.scenario.structure4.forEach((step, idx) => {
        addText(`${idx + 1}. ${step.title || ''}`, 12, true);
        if (step.summary) {
          addText(`   ${step.summary}`, 10);
        }
        yPosition += 3;
      });
      yPosition += 10;
    }

    // 숏트 요약
    if (data.shots && data.shots.length > 0) {
      addText('숏트 요약', 14, true);
      yPosition += 2;
      
      const maxShots = Math.min(data.shots.length, 12);
      for (let i = 0; i < maxShots; i++) {
        const shot = data.shots[i];
        addText(`#${i + 1} ${shot.title || ''}`, 12, true);
        if (shot.description) {
          addText(`   ${shot.description}`, 10);
        }
        yPosition += 3;
      }
    }

    // 푸터
    const pageCount = (doc as any).internal.pages.length - 1; // jsPDF 페이지 수 계산
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `페이지 ${i} / ${pageCount}`, 
        pageWidth - margin, 
        pageHeight - 10, 
        { align: 'right' }
      );
      doc.text(
        'VLANET - AI 영상 플랫폼', 
        margin, 
        pageHeight - 10
      );
    }

    // PDF 다운로드
    const fileName = `VLANET_기획안_${data.scenario.title || ''}${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}.pdf`;
    doc.save(fileName);

    console.log('PDF가 성공적으로 생성되었습니다:', fileName);

  } catch (error) {
    console.error('PDF 생성 중 오류 발생:', error);
    throw new Error('PDF 생성에 실패했습니다. 다시 시도해주세요.');
  }
}

/**
 * 진행률을 표시하며 PDF를 생성
 */
export async function generatePlanningPDFWithProgress(
  data: PdfData,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    onProgress?.(10);
    
    // 약간의 지연을 두어 사용자가 진행률을 볼 수 있도록 함
    await new Promise(resolve => setTimeout(resolve, 100));
    onProgress?.(30);
    
    await generatePlanningPDF(data);
    onProgress?.(100);
    
  } catch (error) {
    onProgress?.(0);
    throw error;
  }
}