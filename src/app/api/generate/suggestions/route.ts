import { NextRequest } from 'next/server';
import { extractSceneComponents } from '@/lib/ai-client';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { logger } from '@/shared/lib/logger';
import { z } from 'zod';

const SuggestionsRequestSchema = z.object({
  metadata: z.object({
    prompt_name: z.string(),
    base_style: z.array(z.string()),
    aspect_ratio: z.string(),
    room_description: z.string(),
    camera_setup: z.string(),
    weather: z.string().optional(),
    lighting: z.string().optional(),
    primary_lens: z.string().optional(),
    dominant_movement: z.string().optional(),
    material: z.string().optional(),
  }),
  elements: z.object({
    characters: z.array(z.object({
      description: z.string(),
      reference_image_url: z.string().optional(),
    })),
    core_objects: z.array(z.object({
      description: z.string(),
      reference_image_url: z.string().optional(),
    })),
  }),
  timeline: z.array(z.object({
    id: z.string(),
    timestamp: z.string(),
    action: z.string(),
    audio: z.string(),
  })),
  negative_prompts: z.array(z.string()),
  keywords: z.array(z.string()),
});

export async function POST(request: NextRequest) {
  const traceId = getTraceId(request);
  
  try {
    logger.info('Starting AI suggestions generation', {
      traceId,
      endpoint: '/api/generate/suggestions'
    });

    const body = await request.json();
    const validatedData = SuggestionsRequestSchema.parse(body);

    const startTime = Date.now();

    // AI를 통해 키워드와 네거티브 프롬프트 생성
    const sceneComponents = await extractSceneComponents({
      scenario: `${validatedData.metadata.room_description}. Characters: ${validatedData.elements.characters.map(c => c.description).join(', ')}. Objects: ${validatedData.elements.core_objects.map(o => o.description).join(', ')}.`,
      theme: validatedData.metadata.base_style.join(', '),
      style: validatedData.metadata.base_style[0] || 'cinematic',
      aspectRatio: validatedData.metadata.aspect_ratio,
      durationSec: validatedData.timeline.length * 2, // 타임라인 길이 기반으로 추정
      mood: validatedData.metadata.lighting || 'neutral',
      camera: validatedData.metadata.camera_setup,
      weather: validatedData.metadata.weather || 'clear',
    });

    const elapsedMs = Date.now() - startTime;

    // 기존 키워드와 AI 추천을 결합하여 중복 제거
    const existingKeywords = new Set(validatedData.keywords);
    const newKeywords = sceneComponents.keywords.filter(
      keyword => !existingKeywords.has(keyword)
    );

    // 기존 네거티브 프롬프트와 AI 추천을 결합하여 중복 제거
    const existingNegatives = new Set(validatedData.negative_prompts);
    const newNegatives = sceneComponents.negative_prompts.filter(
      negative => !existingNegatives.has(negative)
    );

    const suggestions = {
      keywords: [...newKeywords.slice(0, 8)], // 최대 8개의 새로운 키워드
      negative_prompts: [...newNegatives.slice(0, 5)], // 최대 5개의 새로운 네거티브 프롬프트
      enhanced_timeline: sceneComponents.timelineBeats.map((beat, index) => ({
        id: `enhanced_${index}`,
        timestamp: `${index * 2}s`,
        action: beat.action,
        audio: beat.audio,
      })),
    };

    logger.info('AI suggestions generated successfully', {
      traceId,
      elapsedMs,
      keywordCount: suggestions.keywords.length,
      negativeCount: suggestions.negative_prompts.length,
      timelineCount: suggestions.enhanced_timeline.length,
    });

    return success(suggestions, { traceId });

  } catch (error) {
    logger.error('AI suggestions generation failed', {
      traceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof z.ZodError) {
      return failure('VALIDATION_ERROR', 'Invalid request data', { traceId }, 400);
    }

    return failure('AI_GENERATION_ERROR', 'Failed to generate AI suggestions', { traceId }, 500);
  }
}