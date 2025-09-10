/**
 * 안전한 Base64 인코딩 유틸리티
 * btoa의 Latin1 범위 제한을 해결하기 위한 함수
 */

/**
 * 문자열을 Base64로 안전하게 인코딩합니다.
 * 한글, 특수문자 등 Latin1 범위를 벗어나는 문자도 처리 가능합니다.
 * 
 * @param str 인코딩할 문자열
 * @returns Base64 인코딩된 문자열
 */
export function safeBase64Encode(str: string): string {
  if (typeof window !== 'undefined') {
    // 브라우저 환경
    try {
      // TextEncoder를 사용하여 UTF-8로 변환 후 Base64 인코딩
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      
      // Uint8Array를 문자열로 변환하여 btoa에 전달
      const binaryString = String.fromCharCode(...data);
      return btoa(binaryString);
    } catch (error) {
      console.error('Base64 encoding failed:', error);
      // 폴백: 영문자만 포함된 기본 메시지
      return btoa('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="80" y="45" text-anchor="middle" fill="#666">Error</text></svg>');
    }
  } else {
    // Node.js 환경
    return Buffer.from(str, 'utf8').toString('base64');
  }
}

/**
 * SVG를 Data URL로 변환합니다.
 * 
 * @param svgContent SVG 콘텐츠 문자열
 * @returns data:image/svg+xml;base64,... 형태의 Data URL
 */
export function svgToDataUrl(svgContent: string): string {
  const base64Content = safeBase64Encode(svgContent);
  return `data:image/svg+xml;base64,${base64Content}`;
}

/**
 * 에러 플레이스홀더 SVG를 생성합니다.
 * 
 * @param errorType 에러 타입
 * @param shotTitle 샷 제목 (선택사항)
 * @param width SVG 너비 (기본: 160)
 * @param height SVG 높이 (기본: 90)
 * @returns Data URL 형태의 에러 플레이스홀더
 */
export function createErrorPlaceholder(
  errorType: string = 'Error',
  shotTitle?: string,
  width: number = 160,
  height: number = 90
): string {
  const timestamp = new Date().toISOString().slice(11, 19);
  
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#fee2e2"/>
      <rect x="5" y="5" width="${width - 10}" height="${height - 10}" fill="none" stroke="#ef4444" stroke-width="1" stroke-dasharray="3,3"/>
      <text x="${width / 2}" y="${height * 0.4}" text-anchor="middle" fill="#dc2626" font-size="12" font-weight="bold">${errorType}</text>
      ${shotTitle ? `<text x="${width / 2}" y="${height * 0.6}" text-anchor="middle" fill="#991b1b" font-size="10">${shotTitle}</text>` : ''}
      <text x="${width / 2}" y="${height * 0.8}" text-anchor="middle" fill="#7f1d1d" font-size="8">Click to retry</text>
      <text x="${width / 2}" y="${height * 0.95}" text-anchor="middle" fill="#a3a3a3" font-size="6">${timestamp}</text>
    </svg>
  `.trim();
  
  return svgToDataUrl(svgContent);
}