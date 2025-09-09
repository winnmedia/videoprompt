/**
 * Gemini를 활용한 이미지 프롬프트 최적화 API
 * 
 * 기본 스토리보드 설명을 Gemini로 최적화하여
 * 외부 이미지 생성 서비스에 적합한 고품질 프롬프트로 변환
 */

import { NextRequest, NextResponse } from 'next/server';

interface PromptOptimizationRequest {
  description: string;
  style?: {
    visualStyle?: string;
    genre?: string;
    mood?: string;
    cameraAngle?: string;
    lighting?: string;
  };
  targetService?: 'midjourney' | 'dalle' | 'stable-diffusion' | 'general';
}

interface PromptOptimizationResponse {
  success: boolean;
  optimizedPrompt: string;
  negativePrompt?: string;
  metadata: {
    originalLength: number;
    optimizedLength: number;
    targetService: string;
    processingTime: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: PromptOptimizationRequest = await request.json();
    const { description, style = {}, targetService = 'general' } = body;

    if (!description?.trim()) {
      return NextResponse.json({ 
        error: '이미지 설명이 필요합니다.' 
      }, { status: 400 });
    }

    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!geminiApiKey || geminiApiKey === 'your-actual-gemini-key') {
      return NextResponse.json({ 
        error: 'AI 서비스가 구성되지 않았습니다.' 
      }, { status: 503 });
    }

    console.log(`[Prompt Optimizer] 요청: ${description.substring(0, 100)}...`);
    console.log(`[Prompt Optimizer] 대상 서비스: ${targetService}`);

    // Gemini로 프롬프트 최적화
    const optimizationPrompt = buildOptimizationPrompt(description, style, targetService);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: optimizationPrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API 호출 실패: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('Gemini API 응답에서 텍스트를 찾을 수 없습니다');
    }

    // 응답 파싱
    const parsed = parseOptimizedPrompt(generatedText);
    
    const result: PromptOptimizationResponse = {
      success: true,
      optimizedPrompt: parsed.positive,
      negativePrompt: parsed.negative,
      metadata: {
        originalLength: description.length,
        optimizedLength: parsed.positive.length,
        targetService,
        processingTime: Date.now() - startTime
      }
    };

    console.log(`[Prompt Optimizer] 최적화 완료 (${result.metadata.processingTime}ms)`);
    console.log(`[Prompt Optimizer] 결과: ${result.optimizedPrompt.substring(0, 150)}...`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Prompt Optimizer] 오류:', error);
    
    return NextResponse.json({
      error: 'AI 프롬프트 최적화 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

/**
 * Gemini로 보낼 최적화 프롬프트 생성
 */
function buildOptimizationPrompt(
  description: string, 
  style: any, 
  targetService: string
): string {
  const serviceInstructions = {
    'midjourney': 'Midjourney 스타일의 상세하고 예술적인 프롬프트. 카메라 설정, 조명, 아트 스타일을 포함.',
    'dalle': 'DALL-E 3에 최적화된 명확하고 구체적인 프롬프트. 안전 가이드라인 준수.',
    'stable-diffusion': 'Stable Diffusion용 키워드 중심의 구조화된 프롬프트. 품질 태그 포함.',
    'general': '범용 이미지 생성 서비스에 적합한 균형잡힌 프롬프트.'
  };

  return `당신은 전문 이미지 프롬프트 엔지니어입니다. 주어진 스토리보드 설명을 ${targetService} 이미지 생성에 최적화된 고품질 프롬프트로 변환해주세요.

**원본 설명:**
${description}

**스타일 정보:**
- 비주얼 스타일: ${style.visualStyle || '미지정'}
- 장르: ${style.genre || '미지정'}
- 분위기: ${style.mood || '미지정'}
- 카메라 앵글: ${style.cameraAngle || '미지정'}
- 조명: ${style.lighting || '미지정'}

**최적화 가이드라인:**
${serviceInstructions[targetService as keyof typeof serviceInstructions]}

**출력 형식:**
POSITIVE_PROMPT: [최적화된 긍정 프롬프트]
NEGATIVE_PROMPT: [피해야 할 요소들]
EXPLANATION: [최적화 이유와 기술적 고려사항]

**요구사항:**
1. 영화적이고 전문적인 품질
2. 구체적인 시각적 디테일 포함
3. 카메라워크와 조명 설정 명시
4. 아트 스타일과 분위기 강조
5. 불필요한 텍스트나 워터마크 제거 지시

최적화된 프롬프트를 생성해주세요:`;
}

/**
 * Gemini 응답에서 프롬프트 파싱
 */
function parseOptimizedPrompt(text: string): {
  positive: string;
  negative: string;
  explanation: string;
} {
  const positiveMatch = text.match(/POSITIVE_PROMPT:\s*(.+?)(?=NEGATIVE_PROMPT:|$)/is);
  const negativeMatch = text.match(/NEGATIVE_PROMPT:\s*(.+?)(?=EXPLANATION:|$)/is);
  const explanationMatch = text.match(/EXPLANATION:\s*(.+)$/is);

  return {
    positive: positiveMatch?.[1]?.trim() || text.trim(),
    negative: negativeMatch?.[1]?.trim() || 'low quality, blurry, distorted, watermark, text, signature',
    explanation: explanationMatch?.[1]?.trim() || ''
  };
}