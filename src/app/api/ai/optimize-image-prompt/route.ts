/**
 * Gemini 2.0 Flash Preview를 활용한 이미지 프롬프트 최적화 API
 *
 * 기본 스토리보드 설명을 Gemini 2.0으로 최적화하여
 * 외부 이미지 생성 서비스에 적합한 고품질 프롬프트로 변환
 * - 영화급 시네마토그래피 프롬프트
 * - 서비스별 특화 최적화
 * - 네거티브 프롬프트 자동 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getGeminiClient } from '@/shared/lib/gemini-client';
import { buildImagePromptOptimizationPrompt } from '@/shared/lib/prompts/storyboard-prompt-templates';
import { withAICache } from '@/shared/lib/ai-cache';

// Zod 스키마 정의
const PromptOptimizationRequestSchema = z.object({
  description: z.string()
    .min(1, '이미지 설명을 입력해주세요.')
    .max(2000, '이미지 설명은 2000자를 초과할 수 없습니다.'),
  style: z.object({
    visualStyle: z.string().optional(),
    genre: z.string().optional(),
    mood: z.string().optional(),
    cameraAngle: z.string().optional(),
    lighting: z.string().optional()
  }).optional().default({}),
  targetService: z.enum(['midjourney', 'dalle', 'stable-diffusion', 'general'])
    .optional()
    .default('stable-diffusion')
});

type PromptOptimizationRequest = z.infer<typeof PromptOptimizationRequestSchema>;

interface PromptOptimizationResponse {
  success: boolean;
  optimizedPrompt: string;
  negativePrompt: string;
  explanation?: string;
  metadata: {
    originalLength: number;
    optimizedLength: number;
    targetService: string;
    processingTime: number;
    model: string;
    generatedAt: string;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // 입력 데이터 검증
    const validationResult = PromptOptimizationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));

      return NextResponse.json({
        error: 'VALIDATION_ERROR',
        message: '입력 데이터가 올바르지 않습니다.',
        details: errorDetails
      }, { status: 400 });
    }

    const { description, style, targetService } = validationResult.data;

    if (process.env.NODE_ENV === 'development') {
      console.log('[Prompt Optimizer] ========== 시작 ==========');
      console.log('[Prompt Optimizer] Gemini 2.0 Flash Preview 사용');
      console.log(`[Prompt Optimizer] 요청: ${description.substring(0, 100)}...`);
      console.log(`[Prompt Optimizer] 대상 서비스: ${targetService}`);
      console.log(`[Prompt Optimizer] 스타일: ${JSON.stringify(style)}`);
    }

    try {
      // Gemini 2.0 클라이언트 초기화
      const geminiClient = getGeminiClient();

      // 이미지 프롬프트 최적화 프롬프트 생성
      const optimizationPrompt = buildImagePromptOptimizationPrompt(description, style, targetService);

      if (process.env.NODE_ENV === 'development') {
        console.log('[Prompt Optimizer] 최적화 프롬프트 생성 완료');
        console.log(`[Prompt Optimizer] 프롬프트 길이: ${optimizationPrompt.length} 문자`);
      }

      // AI 캐싱 적용: 동일한 입력에 대해 3시간 캐싱 (프롬프트 최적화는 자주 변경되지 않음)
      const cacheKey = { description, style, targetService };
      const optimizedText = await withAICache(
        cacheKey,
        async () => {
          return await geminiClient.generateContent({
            contents: [{
              parts: [{
                text: optimizationPrompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024
            }
          }, {
            rateLimitKey: 'prompt-optimization',
            maxRetries: 3,
            enableLogging: process.env.NODE_ENV === 'development'
          });
        },
        { ttl: 3 * 60 * 60 * 1000 } // 3시간 캐싱
      );

      // 응답 파싱
      const parsed = parseOptimizedPrompt(optimizedText);

      if (process.env.NODE_ENV === 'development') {
        console.log('[Prompt Optimizer] ✅ 프롬프트 최적화 완료');
        console.log(`[Prompt Optimizer] 최적화된 프롬프트: ${parsed.positive.substring(0, 150)}...`);
        console.log(`[Prompt Optimizer] 네거티브 프롬프트: ${parsed.negative}`);
      }

      const result: PromptOptimizationResponse = {
        success: true,
        optimizedPrompt: parsed.positive,
        negativePrompt: parsed.negative,
        explanation: parsed.explanation,
        metadata: {
          originalLength: description.length,
          optimizedLength: parsed.positive.length,
          targetService,
          processingTime: Date.now() - startTime,
          model: 'gemini-2.0-flash-exp',
          generatedAt: new Date().toISOString()
        }
      };

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Prompt Optimizer] 최적화 완료 (${result.metadata.processingTime}ms)`);
        console.log('[Prompt Optimizer] ========== 완료 ==========');
      }

      return NextResponse.json(result);

    } catch (geminiError: any) {
      console.error('[Prompt Optimizer] Gemini API 오류:', geminiError);

      // Gemini 에러를 사용자 친화적으로 변환
      let userMessage = 'AI 프롬프트 최적화에 실패했습니다. 잠시 후 다시 시도해주세요.';
      let statusCode = 503;

      if (geminiError.code === 'RATE_LIMIT_EXCEEDED') {
        userMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        statusCode = 429;
      } else if (geminiError.code === 'CONTENT_BLOCKED') {
        userMessage = '입력하신 내용이 안전 정책에 위배됩니다. 다른 내용으로 시도해주세요.';
        statusCode = 400;
      } else if (geminiError.code === 'BAD_REQUEST') {
        userMessage = '요청 형식이 올바르지 않습니다. 입력 내용을 확인해주세요.';
        statusCode = 400;
      }

      return NextResponse.json({
        error: geminiError.code || 'AI_OPTIMIZATION_ERROR',
        message: userMessage,
        details: process.env.NODE_ENV === 'development' ? geminiError.message : undefined
      }, { status: statusCode });
    }

  } catch (error) {
    console.error('[Prompt Optimizer] ❌ 예상치 못한 오류:', error);
    return NextResponse.json({
      error: 'INTERNAL_ERROR',
      message: 'AI 프롬프트 최적화 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

/**
 * Gemini 응답에서 프롬프트 파싱
 */
function parseOptimizedPrompt(text: string): {
  positive: string;
  negative: string;
  explanation: string;
} {
  const positiveMatch = text.match(/POSITIVE_PROMPT:\s*([\s\S]+?)(?=NEGATIVE_PROMPT:|$)/i);
  const negativeMatch = text.match(/NEGATIVE_PROMPT:\s*([\s\S]+?)(?=EXPLANATION:|$)/i);
  const explanationMatch = text.match(/EXPLANATION:\s*([\s\S]+)$/i);

  return {
    positive: positiveMatch?.[1]?.trim() || text.trim(),
    negative: negativeMatch?.[1]?.trim() || 'low quality, blurry, distorted, watermark, text, signature, amateur, phone camera, oversaturated, cartoon',
    explanation: explanationMatch?.[1]?.trim() || '프롬프트가 영화급 품질로 최적화되었습니다.'
  };
}