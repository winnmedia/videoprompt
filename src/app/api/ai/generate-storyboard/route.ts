/**
 * Gemini 2.5 Flash를 활용한 스토리보드 이미지 생성 API
 * 
 * Gemini로 프롬프트를 최적화한 후 이미지 생성 서비스에 전달
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  buildImagePrompt, 
  validatePrompt,
  type ShotDescription,
  type VisualStyle 
} from '../../../../lib/utils/image-prompt-builder';

// 유틸리티 함수들
function exponentialBackoff(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 10000;
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 타입 정의
interface StoryboardRequest {
  shots: ShotDescription[];
  style: VisualStyle;
  options?: {
    quality?: 'standard' | 'high';
    format?: 'webp' | 'png' | 'jpeg';
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  };
}

interface ImageGenerationResult {
  shotId: string;
  imageData?: string;
  prompt: string;
  negativePrompt?: string;
  retryCount: number;
  error?: string;
}

interface StoryboardResponse {
  success: boolean;
  images: ImageGenerationResult[];
  errors?: string[];
  metadata: {
    totalShots: number;
    successfulShots: number;
    failedShots: number;
    processingTime: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: StoryboardRequest = await request.json();
    const { shots, style, options = {} } = body;

    // 입력 검증
    if (!shots || !Array.isArray(shots) || shots.length === 0) {
      return NextResponse.json({ 
        error: '최소 하나의 샷이 필요합니다.' 
      }, { status: 400 });
    }

    if (shots.length > 20) {
      return NextResponse.json({ 
        error: '한 번에 최대 20개의 샷만 처리할 수 있습니다.' 
      }, { status: 400 });
    }

    // API 키 확인
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiApiKey || geminiApiKey === 'your-actual-gemini-key') {
      return NextResponse.json({ 
        error: 'AI 서비스가 구성되지 않았습니다.' 
      }, { status: 503 });
    }


    // 각 샷 처리
    const results: ImageGenerationResult[] = [];
    const errors: string[] = [];

    for (const shot of shots) {
      
      try {
        // Step 1: Gemini로 프롬프트 최적화
        const optimizedData = await optimizePromptWithGemini(shot, style);
        
        // Step 2: 이미지 생성 (현재는 고급 플레이스홀더)
        const imageData = await generateImage(optimizedData, options);
        
        results.push({
          shotId: shot.id,
          imageData: imageData,
          prompt: optimizedData.optimizedPrompt,
          negativePrompt: optimizedData.negativePrompt,
          retryCount: 0
        });
        
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        
        results.push({
          shotId: shot.id,
          prompt: shot.description,
          retryCount: 0,
          error: errorMessage
        });
        
        errors.push(`샷 ${shot.id}: ${errorMessage}`);
      }
    }

    // 응답 생성
    const response: StoryboardResponse = {
      success: errors.length === 0,
      images: results,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalShots: shots.length,
        successfulShots: results.filter(r => r.imageData).length,
        failedShots: results.filter(r => r.error).length,
        processingTime: Date.now() - startTime
      }
    };


    return NextResponse.json(response);

  } catch (error) {
    
    return NextResponse.json({
      error: '스토리보드 생성 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

/**
 * Gemini를 사용한 프롬프트 최적화
 */
async function optimizePromptWithGemini(
  shot: ShotDescription, 
  style: VisualStyle
): Promise<{ optimizedPrompt: string; negativePrompt: string }> {
  
  const response = await fetch('http://localhost:3000/api/ai/optimize-image-prompt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: shot.description,
      style: {
        visualStyle: style.visualStyle,
        genre: style.genre,
        mood: shot.mood,
        cameraAngle: shot.cameraAngle,
        lighting: shot.lighting
      },
      targetService: 'stable-diffusion' // 범용성을 위해 Stable Diffusion 사용
    })
  });

  if (!response.ok) {
    throw new Error(`프롬프트 최적화 실패: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || '프롬프트 최적화 실패');
  }

  return {
    optimizedPrompt: data.optimizedPrompt,
    negativePrompt: data.negativePrompt || 'low quality, blurry, distorted'
  };
}

/**
 * 이미지 생성 (현재는 고급 플레이스홀더)
 * TODO: 실제 이미지 생성 서비스 연동
 */
async function generateImage(
  promptData: { optimizedPrompt: string; negativePrompt: string },
  options: any
): Promise<string> {
  
  // 현재는 Gemini 최적화 프롬프트를 활용한 고급 플레이스홀더 생성
  // 실제 서비스 연동 시 이 함수를 교체
  
  return generateAdvancedPlaceholder(promptData, options);
}

/**
 * 고급 플레이스홀더 이미지 생성
 */
function generateAdvancedPlaceholder(
  promptData: { optimizedPrompt: string; negativePrompt: string },
  options: any
): string {
  const { optimizedPrompt } = promptData;
  const aspectRatio = options.aspectRatio || '16:9';
  
  // 종횡비에 따른 크기 설정
  const dimensions = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:3': { width: 1440, height: 1080 }
  };
  
  const { width, height } = dimensions[aspectRatio as keyof typeof dimensions] || dimensions['16:9'];
  
  // 프롬프트에서 키워드 추출 및 분석
  const keywords = extractKeywords(optimizedPrompt);
  const colorScheme = extractColorScheme(optimizedPrompt);
  const mood = extractMood(optimizedPrompt);

  // 영화적 구성 요소들
  const frameElements = generateFrameElements(optimizedPrompt, width, height);

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 영화적 배경 그라디언트 -->
        <radialGradient id="cinematicBg" cx="50%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:${colorScheme.primary};stop-opacity:0.9" />
          <stop offset="70%" style="stop-color:${colorScheme.secondary};stop-opacity:0.7" />
          <stop offset="100%" style="stop-color:#000;stop-opacity:0.9" />
        </radialGradient>

        <!-- 노이즈 패턴 (필름 질감) -->
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feBlend mode="multiply" in2="SourceGraphic"/>
        </filter>

        <!-- 글로우 효과 -->
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- 배경 -->
      <rect width="100%" height="100%" fill="url(#cinematicBg)"/>
      <rect width="100%" height="100%" fill="url(#cinematicBg)" opacity="0.1" filter="url(#noise)"/>

      <!-- 영화적 프레임 (상하단 레터박스) -->
      <rect x="0" y="0" width="100%" height="${height * 0.12}" fill="black" opacity="0.8"/>
      <rect x="0" y="${height * 0.88}" width="100%" height="${height * 0.12}" fill="black" opacity="0.8"/>

      <!-- 메인 컴포지션 프레임 -->
      <rect x="40" y="${height * 0.15}" width="${width-80}" height="${height * 0.7}"
            fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3" rx="8"/>

      ${frameElements}

      <!-- 영화적 제목 -->
      <text x="50%" y="8%" font-family="'Cinzel', 'Times New Roman', serif"
            font-size="${Math.max(28, width/35)}" font-weight="bold"
            fill="white" text-anchor="middle" opacity="0.95" filter="url(#glow)">
        🎬 CINEMATIC STORYBOARD
      </text>

      <!-- 씬 설명 -->
      <foreignObject x="60" y="${height * 0.2}" width="${width-120}" height="${height * 0.25}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="
          color: white;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: ${Math.max(14, width/80)}px;
          line-height: 1.4;
          text-align: center;
          padding: 20px;
          background: rgba(0,0,0,0.3);
          border-radius: 8px;
          backdrop-filter: blur(5px);
        ">
          <strong>${mood}</strong><br/>
          ${truncateText(optimizedPrompt, 120)}
        </div>
      </foreignObject>

      <!-- 카메라 정보 패널 -->
      <rect x="60" y="${height * 0.5}" width="${width-120}" height="${height * 0.25}"
            fill="rgba(0,0,0,0.4)" rx="8" stroke="rgba(255,255,255,0.2)"/>

      <!-- 캐스팅 & 키워드 -->
      <text x="50%" y="${height * 0.55}" font-family="Arial, sans-serif"
            font-size="${Math.max(12, width/100)}" font-weight="bold"
            fill="white" text-anchor="middle" opacity="0.9">
        🎭 VISUAL ELEMENTS
      </text>

      ${keywords.slice(0, 3).map((keyword, i) => `
        <rect x="${width/2 - 180 + i * 120}" y="${height * 0.58}" width="110" height="24"
              fill="rgba(255,255,255,0.15)" rx="12" stroke="rgba(255,255,255,0.3)"/>
        <text x="${width/2 - 125 + i * 120}" y="${height * 0.595}"
              font-family="Arial, sans-serif" font-size="11"
              fill="white" text-anchor="middle" opacity="0.9">
          ${keyword.toUpperCase()}
        </text>
      `).join('')}

      <!-- 기술 사양 -->
      <text x="50%" y="${height * 0.67}" font-family="'Courier New', monospace"
            font-size="${Math.max(10, width/120)}"
            fill="white" text-anchor="middle" opacity="0.7">
        📹 SHOT: ${aspectRatio} • 🎨 GRADE: ${colorScheme.primary.slice(1).toUpperCase()} • 🎬 READY FOR POST
      </text>

      <!-- 하단 크레딧 -->
      <text x="50%" y="96%" font-family="Arial, sans-serif"
            font-size="${Math.max(9, width/140)}"
            fill="white" text-anchor="middle" opacity="0.5">
        ⚡ AI-POWERED BY GEMINI 2.5 • OPTIMIZED FOR PROFESSIONAL IMAGE GENERATION
      </text>
    </svg>
  `;
  
  return 'data:image/svg+xml;base64,' + Buffer.from(svg.trim()).toString('base64');
}

/**
 * 프롬프트에서 핵심 키워드 추출
 */
function extractKeywords(prompt: string): string[] {
  const keywords = prompt
    .toLowerCase()
    .match(/\b(?:cinematic|dramatic|portrait|landscape|close-up|wide|macro|bokeh|vintage|modern|abstract|realistic|fantasy|sci-fi|noir|vibrant|muted|warm|cool|golden|blue|red|green)\b/g) || [];
  
  return [...new Set(keywords)].slice(0, 6);
}

/**
 * 프롬프트에서 색상 스키마 추출
 */
function extractColorScheme(prompt: string): { primary: string; secondary: string } {
  const colorMap: Record<string, { primary: string; secondary: string }> = {
    'golden': { primary: '#FFD700', secondary: '#FF8C00' },
    'blue': { primary: '#4169E1', secondary: '#1E90FF' },
    'red': { primary: '#DC143C', secondary: '#B22222' },
    'green': { primary: '#228B22', secondary: '#32CD32' },
    'purple': { primary: '#8A2BE2', secondary: '#9370DB' },
    'warm': { primary: '#FF6347', secondary: '#FFA500' },
    'cool': { primary: '#4682B4', secondary: '#5F9EA0' },
    'noir': { primary: '#2F2F2F', secondary: '#696969' },
    'vintage': { primary: '#D2691E', secondary: '#CD853F' }
  };
  
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [color, scheme] of Object.entries(colorMap)) {
    if (lowerPrompt.includes(color)) {
      return scheme;
    }
  }
  
  // 기본 시네마틱 컬러
  return { primary: '#4A5568', secondary: '#2D3748' };
}

/**
 * 텍스트 자르기
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * 프롬프트에서 무드/분위기 추출
 */
function extractMood(prompt: string): string {
  const moodMap: Record<string, string> = {
    'dark': 'DARK & MYSTERIOUS',
    'bright': 'BRIGHT & UPLIFTING',
    'dramatic': 'DRAMATIC TENSION',
    'romantic': 'ROMANTIC ATMOSPHERE',
    'action': 'HIGH-ENERGY ACTION',
    'horror': 'SUSPENSEFUL HORROR',
    'comedy': 'LIGHTHEARTED COMEDY',
    'sci-fi': 'FUTURISTIC SCI-FI',
    'fantasy': 'MAGICAL FANTASY',
    'noir': 'NOIR AESTHETIC'
  };

  const lowerPrompt = prompt.toLowerCase();

  for (const [key, mood] of Object.entries(moodMap)) {
    if (lowerPrompt.includes(key)) {
      return mood;
    }
  }

  return 'CINEMATIC SCENE';
}

/**
 * 프레임 내부 구성 요소 생성
 */
function generateFrameElements(prompt: string, width: number, height: number): string {
  const elements = [];

  // 규칙 of 3rds 가이드라인
  const frameWidth = width - 80;
  const frameHeight = height * 0.7;
  const frameX = 40;
  const frameY = height * 0.15;

  // 수직선들 (규칙 of 3rds)
  elements.push(`
    <line x1="${frameX + frameWidth/3}" y1="${frameY}"
          x2="${frameX + frameWidth/3}" y2="${frameY + frameHeight}"
          stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="5,5"/>
    <line x1="${frameX + frameWidth*2/3}" y1="${frameY}"
          x2="${frameX + frameWidth*2/3}" y2="${frameY + frameHeight}"
          stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="5,5"/>
  `);

  // 수평선들
  elements.push(`
    <line x1="${frameX}" y1="${frameY + frameHeight/3}"
          x2="${frameX + frameWidth}" y2="${frameY + frameHeight/3}"
          stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="5,5"/>
    <line x1="${frameX}" y1="${frameY + frameHeight*2/3}"
          x2="${frameX + frameWidth}" y2="${frameY + frameHeight*2/3}"
          stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="5,5"/>
  `);

  // 포커스 포인트 표시
  const focusX = frameX + frameWidth/3;
  const focusY = frameY + frameHeight/3;
  elements.push(`
    <circle cx="${focusX}" cy="${focusY}" r="8"
            fill="none" stroke="rgba(255,255,0,0.6)" stroke-width="2"/>
    <circle cx="${focusX}" cy="${focusY}" r="4"
            fill="rgba(255,255,0,0.3)"/>
  `);

  return elements.join('');
}