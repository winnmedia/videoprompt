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
  
  // 프롬프트에서 핵심 키워드 추출
  const keywords = extractKeywords(optimizedPrompt);
  const colorScheme = extractColorScheme(optimizedPrompt);
  
  // SVG 생성
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colorScheme.primary};stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:${colorScheme.secondary};stop-opacity:0.9" />
        </linearGradient>
        <filter id="blur" x="0" y="0">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
        </filter>
      </defs>
      
      <!-- 배경 그라데이션 -->
      <rect width="${width}" height="${height}" fill="url(#grad1)"/>
      
      <!-- 프레임 테두리 -->
      <rect x="20" y="20" width="${width-40}" height="${height-40}" 
            fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      
      <!-- 메인 제목 -->
      <text x="50%" y="25%" font-family="'Helvetica Neue', Arial, sans-serif" 
            font-size="${Math.max(24, width/40)}" font-weight="bold" 
            fill="white" text-anchor="middle" opacity="0.95">
        🎬 STORYBOARD CONCEPT
      </text>
      
      <!-- 최적화된 프롬프트 (요약) -->
      <text x="50%" y="40%" font-family="'Helvetica Neue', Arial, sans-serif" 
            font-size="${Math.max(16, width/80)}" 
            fill="white" text-anchor="middle" opacity="0.8">
        ${truncateText(optimizedPrompt, 80)}
      </text>
      
      <!-- 키워드 태그들 -->
      ${keywords.slice(0, 4).map((keyword, i) => `
        <rect x="${50 + i * 150}" y="${height * 0.55}" width="140" height="30" 
              fill="rgba(255,255,255,0.2)" rx="15"/>
        <text x="${50 + i * 150 + 70}" y="${height * 0.55 + 20}" 
              font-family="Arial, sans-serif" font-size="14" 
              fill="white" text-anchor="middle" opacity="0.9">
          ${keyword}
        </text>
      `).join('')}
      
      <!-- Powered by Gemini 표시 -->
      <text x="50%" y="85%" font-family="Arial, sans-serif" 
            font-size="${Math.max(12, width/120)}" 
            fill="white" text-anchor="middle" opacity="0.6">
        🧠 Optimized with Gemini 2.5 Flash
      </text>
      
      <!-- 기술적 정보 -->
      <text x="50%" y="90%" font-family="Arial, sans-serif" 
            font-size="${Math.max(10, width/150)}" 
            fill="white" text-anchor="middle" opacity="0.5">
        Ready for: Midjourney • DALL-E • Stable Diffusion
      </text>
      
      <!-- 하단 정보 -->
      <text x="50%" y="95%" font-family="Arial, sans-serif" 
            font-size="${Math.max(10, width/150)}" 
            fill="white" text-anchor="middle" opacity="0.4">
        Aspect Ratio: ${aspectRatio} • Resolution: ${width}x${height}
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