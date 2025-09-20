/**
 * Gemini 2.0 Flash Preview를 활용한 실제 스토리보드 생성 API
 *
 * 스토리 구조를 분석하여 전문적인 영화 스토리보드를 생성
 * - 실제 콘티 구조 분석
 * - 카메라 앵글 및 조명 설정
 * - 영화급 이미지 프롬프트 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getGeminiClient } from '@/shared/lib/gemini-client';
import {
  buildStoryboardPrompt,
  buildImagePromptOptimizationPrompt,
  type StoryboardRequest as StoryboardPromptRequest,
  type StoryboardShot
} from '@/shared/lib/prompts/storyboard-prompt-templates';
import { withAICache } from '@/shared/lib/ai-cache';

// Zod 스키마 정의
const StoryboardRequestSchema = z.object({
  structure: z.object({
    act1: z.object({
      title: z.string(),
      description: z.string(),
      key_elements: z.array(z.string()).optional(),
      visual_moments: z.array(z.string()).optional()
    }),
    act2: z.object({
      title: z.string(),
      description: z.string(),
      key_elements: z.array(z.string()).optional(),
      visual_moments: z.array(z.string()).optional()
    }),
    act3: z.object({
      title: z.string(),
      description: z.string(),
      key_elements: z.array(z.string()).optional(),
      visual_moments: z.array(z.string()).optional()
    }),
    act4: z.object({
      title: z.string(),
      description: z.string(),
      key_elements: z.array(z.string()).optional(),
      visual_moments: z.array(z.string()).optional()
    })
  }),
  visualStyle: z.string().default('Cinematic'),
  duration: z.string().default('60초'),
  aspectRatio: z.string().default('16:9'),
  shotCount: z.number().optional(),
  genre: z.string().optional(),
  tone: z.string().optional()
});

type StoryboardRequest = z.infer<typeof StoryboardRequestSchema>;

interface StoryboardResponse {
  success: boolean;
  shots: StoryboardShot[];
  errors?: string[];
  metadata: {
    total_shots: number;
    estimated_duration: string;
    visual_style: string;
    aspect_ratio: string;
    production_notes: string;
    model: string;
    generated_at: string;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // 입력 데이터 검증
    const validationResult = StoryboardRequestSchema.safeParse(body);
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

    const { structure, visualStyle, duration, aspectRatio, shotCount, genre, tone } = validationResult.data;

    if (process.env.NODE_ENV === 'development') {
      console.log('[Storyboard Generator] ========== 시작 ==========');
      console.log('[Storyboard Generator] Gemini 2.0 Flash Preview 사용');
      console.log(`[Storyboard Generator] 스타일: ${visualStyle}, 러닝타임: ${duration}`);
      console.log(`[Storyboard Generator] Act1: ${structure.act1.title}`);
    }

    try {
      // Gemini 2.0 클라이언트 초기화
      const geminiClient = getGeminiClient();

      // 스토리보드 프롬프트 생성 설정
      const promptRequest: StoryboardPromptRequest = {
        structure,
        visualStyle,
        duration,
        aspectRatio,
        shotCount
      };

      // 구조화된 스토리보드 프롬프트 생성
      const prompt = buildStoryboardPrompt(promptRequest);

      if (process.env.NODE_ENV === 'development') {
        console.log('[Storyboard Generator] 구조화된 프롬프트 생성 완료');
        console.log(`[Storyboard Generator] 프롬프트 길이: ${prompt.length} 문자`);
      }

      // AI 캐싱 적용: 동일한 입력에 대해 2시간 캐싱 (스토리보드는 큰 데이터이므로 적절한 캐싱 시간)
      const cacheKey = { structure, visualStyle, duration, aspectRatio, shotCount, genre, tone };
      const storyboardResponse = await withAICache(
        cacheKey,
        async () => {
          return await geminiClient.generateJSON({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192
            }
          }, {
            rateLimitKey: 'storyboard-generation',
            maxRetries: 3,
            enableLogging: process.env.NODE_ENV === 'development'
          });
        },
        { ttl: 2 * 60 * 60 * 1000 } // 2시간 캐싱
      );

      // 응답 구조 검증
      if (!storyboardResponse.shots || !Array.isArray(storyboardResponse.shots)) {
        throw new Error('Invalid storyboard structure from Gemini');
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[Storyboard Generator] ✅ 스토리보드 생성 완료');
        console.log(`[Storyboard Generator] 샷 개수: ${storyboardResponse.shots.length}`);
      }

      // 각 샷의 이미지 프롬프트 최적화 (병렬 처리)
      const errors: string[] = [];
      const optimizedShots: StoryboardShot[] = [];

      for (const shot of storyboardResponse.shots) {
        try {
          // 이미지 프롬프트 최적화
          const optimizationPrompt = buildImagePromptOptimizationPrompt(
            shot.description,
            {
              visualStyle,
              genre,
              mood: tone,
              cameraAngle: shot.camera_angle,
              lighting: shot.lighting
            },
            'stable-diffusion'
          );

          const optimizedPromptResponse = await geminiClient.generateContent({
            contents: [{
              parts: [{
                text: optimizationPrompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024
            }
          }, {
            rateLimitKey: 'prompt-optimization',
            enableLogging: false
          });

          // 프롬프트 파싱
          const parsed = parseOptimizedPrompt(optimizedPromptResponse);

          optimizedShots.push({
            ...shot,
            image_prompt: parsed.positive,
            negative_prompt: parsed.negative
          });

          if (process.env.NODE_ENV === 'development') {
            console.log(`[Storyboard Generator] 샷 ${shot.id} 이미지 프롬프트 최적화 완료`);
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          errors.push(`샷 ${shot.id}: 이미지 프롬프트 최적화 실패 - ${errorMessage}`);

          // 기본 프롬프트로 폴백
          optimizedShots.push({
            ...shot,
            image_prompt: `${shot.description}, ${visualStyle} style, ${shot.camera_angle}, ${shot.lighting}, cinematic quality, 8K, photorealistic`,
            negative_prompt: 'low quality, blurry, distorted, watermark, text, signature, amateur'
          });
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[Storyboard Generator] ========== 완료 ==========');
      }

      // 최종 응답 생성
      const response: StoryboardResponse = {
        success: errors.length === 0,
        shots: optimizedShots,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          total_shots: optimizedShots.length,
          estimated_duration: duration,
          visual_style: visualStyle,
          aspect_ratio: aspectRatio,
          production_notes: storyboardResponse.metadata?.production_notes ||
            `전문적인 영화 스토리보드 ${optimizedShots.length}샷 생성 완료. ${visualStyle} 스타일로 ${duration} 러닝타임에 최적화됨.`,
          model: 'gemini-2.0-flash-exp',
          generated_at: new Date().toISOString()
        }
      };

      return NextResponse.json(response);

    } catch (geminiError: any) {
      console.error('[Storyboard Generator] Gemini API 오류:', geminiError);

      // Gemini 에러를 사용자 친화적으로 변환
      let userMessage = 'AI 스토리보드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.';
      let statusCode = 503;

      if (geminiError.code === 'RATE_LIMIT_EXCEEDED') {
        userMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        statusCode = 429;
      } else if (geminiError.code === 'CONTENT_BLOCKED') {
        userMessage = '입력하신 내용이 안전 정책에 위배됩니다. 다른 내용으로 시도해주세요.';
        statusCode = 400;
      }

      return NextResponse.json({
        error: geminiError.code || 'AI_GENERATION_ERROR',
        message: userMessage,
        details: process.env.NODE_ENV === 'development' ? geminiError.message : undefined
      }, { status: statusCode });
    }

  } catch (error) {
    console.error('[Storyboard Generator] ❌ 예상치 못한 오류:', error);
    return NextResponse.json({
      error: 'INTERNAL_ERROR',
      message: '스토리보드 생성 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

/**
 * Gemini 응답에서 최적화된 프롬프트 파싱
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
    negative: negativeMatch?.[1]?.trim() || 'low quality, blurry, distorted, watermark, text, signature, amateur, phone camera',
    explanation: explanationMatch?.[1]?.trim() || ''
  };
}