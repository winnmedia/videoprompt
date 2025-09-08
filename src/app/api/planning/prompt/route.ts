import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { logger } from '@/shared/lib/logger';
import { 
  validateByVersion, 
  detectPromptVersion,
  UniversalPromptSchema,
  CineGeniusV3PromptSchema 
} from '@/lib/schemas';
import { features } from '@/config/features';
import type { UniversalPrompt } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  
  try {
    const body = await req.json();
    const userId = getUserIdFromRequest(req);
    
    // 🔍 버전 자동 감지
    const promptVersion = detectPromptVersion(body);
    logger.info('prompt version detected', { version: promptVersion }, traceId);
    
    // 🚩 Feature Flag 체크
    if (promptVersion === '3.1' && !features.CINEGENIUS_V3) {
      logger.warn('CineGenius v3.1 feature disabled', {}, traceId);
      return failure('FEATURE_DISABLED', 'CineGenius v3.1 is currently disabled', 403, traceId);
    }
    
    // ✅ 버전별 검증 및 처리
    if (promptVersion === '3.1') {
      return await handleV3Prompt(body, userId, traceId);
    } else {
      return await handleLegacyPrompt(body, userId, traceId);
    }
    
  } catch (e: any) {
    logger.error('prompt create failed', { error: e?.message, stack: e?.stack }, traceId);
    return failure('VALIDATION_ERROR', e?.message || 'Invalid request data', 400, traceId);
  }
}

/**
 * CineGenius v3.1 프롬프트 처리
 */
async function handleV3Prompt(body: any, userId: string | null, traceId: string) {
  try {
    // 🧪 v3.1 스키마 검증
    const validatedData = CineGeniusV3PromptSchema.parse(body);
    
    // 📊 데이터베이스 저장
    const created = await prisma.prompt.create({
      data: {
        // 기존 필드들 (호환성 유지)
        scenarioId: validatedData.userInput.oneLineScenario ? 'temp-scenario-id' : 'default-scenario',
        metadata: {
          // Legacy 호환을 위한 기본 매핑
          project_name: validatedData.promptBlueprint.metadata.promptName,
          scene_description: validatedData.promptBlueprint.metadata.spatialContext.placeDescription,
          base_style: validatedData.promptBlueprint.metadata.baseStyle.visualStyle,
          genre: validatedData.promptBlueprint.metadata.baseStyle.genre,
          mood: validatedData.promptBlueprint.metadata.baseStyle.mood,
          quality: validatedData.promptBlueprint.metadata.baseStyle.quality,
          weather: validatedData.promptBlueprint.metadata.spatialContext.weather,
          lighting: validatedData.promptBlueprint.metadata.spatialContext.lighting,
          lens: validatedData.promptBlueprint.metadata.cameraSetting.primaryLens,
          camera_movement: validatedData.promptBlueprint.metadata.cameraSetting.dominantMovement,
          aspect_ratio: validatedData.promptBlueprint.metadata.deliverySpec.aspectRatio,
          // v3.1 전체 메타데이터도 저장
          v3_metadata: validatedData.promptBlueprint.metadata,
        },
        timeline: validatedData.promptBlueprint.timeline,
        negative: validatedData.finalOutput.negativePrompts,
        version: 3, // v3.1을 나타내는 정수
        
        // 🆕 v3.1 새 필드들
        project_id: validatedData.projectId,
        cinegenius_version: validatedData.version,
        user_input: validatedData.userInput,
        project_config: validatedData.projectConfig,
        generation_control: validatedData.generationControl,
        ai_analysis: validatedData.aiAnalysis || {},
        
        // 사용자 정보
        ...(userId ? { userId } : {}),
      },
    });
    
    logger.info('v3.1 prompt created', { 
      id: created.id, 
      projectId: validatedData.projectId,
      version: created.version 
    }, traceId);
    
    return success({ 
      id: created.id, 
      projectId: validatedData.projectId,
      version: created.version,
      cinegenius_version: '3.1'
    }, 201, traceId);
    
  } catch (error: any) {
    logger.error('v3.1 prompt creation failed', { 
      error: error?.message,
      issues: error?.issues // Zod validation errors
    }, traceId);
    
    throw new Error(`CineGenius v3.1 validation failed: ${error?.message}`);
  }
}

/**
 * Legacy 프롬프트 처리 (v2.x 호환성)
 */
async function handleLegacyPrompt(body: any, userId: string | null, traceId: string) {
  try {
    // 🧪 Legacy 스키마 검증
    const legacySchema = z.object({
      scenarioId: z.string().uuid(),
      metadata: z.any(),
      timeline: z.any(),
      negative: z.any().optional(),
      version: z.number().int().min(1).default(1),
    });
    
    const { scenarioId, metadata, timeline, negative, version } = legacySchema.parse(body);
    
    // 📊 데이터베이스 저장
    const created = await prisma.prompt.create({
      data: {
        scenarioId,
        metadata,
        timeline,
        ...(typeof negative !== 'undefined' ? { negative } : {}),
        version,
        
        // v2.x는 기본값 설정
        cinegenius_version: '2.0',
        
        // 사용자 정보
        ...(userId ? { userId } : {}),
      },
    });
    
    logger.info('legacy prompt created', { 
      id: created.id, 
      version: created.version 
    }, traceId);
    
    return success({ 
      id: created.id, 
      version: created.version,
      cinegenius_version: '2.0'
    }, 201, traceId);
    
  } catch (error: any) {
    logger.error('legacy prompt creation failed', { 
      error: error?.message 
    }, traceId);
    
    throw new Error(`Legacy prompt validation failed: ${error?.message}`);
  }
}

export async function GET(req: NextRequest) {
  const traceId = getTraceId(req);
  
  try {
    const scenarioIdParam = req.nextUrl.searchParams.get('scenarioId');
    const versionParam = req.nextUrl.searchParams.get('version'); // v3.1, v2.x 필터링
    const includeV3 = req.nextUrl.searchParams.get('includeV3') === 'true';
    const userId = getUserIdFromRequest(req);
    
    // 🔍 쿼리 조건 구성
    const whereCondition: any = {
      ...(scenarioIdParam ? { scenarioId: z.string().uuid().parse(scenarioIdParam) } : {}),
      ...(userId ? { userId } : {}), // 사용자별 필터링
    };
    
    // 버전별 필터링
    if (versionParam) {
      if (versionParam === '3.1') {
        whereCondition.cinegenius_version = '3.1';
      } else if (versionParam === '2.x') {
        whereCondition.OR = [
          { cinegenius_version: '2.0' },
          { cinegenius_version: null }, // 마이그레이션 이전 데이터
        ];
      }
    }
    
    // 📊 데이터베이스 조회
    const prompts = await prisma.prompt.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        scenarioId: true,
        metadata: true,
        timeline: true,
        negative: true,
        createdAt: true,
        updatedAt: true,
        
        // 🆕 v3.1 필드들 (존재하는 경우에만)
        project_id: true,
        cinegenius_version: true,
        user_input: true,
        project_config: true,
        generation_control: true,
        ai_analysis: true,
      },
    });
    
    // 🔄 응답 데이터 변환
    const transformedPrompts = prompts.map(prompt => {
      const isV3 = prompt.cinegenius_version === '3.1';
      
      if (isV3 && includeV3) {
        // v3.1 전체 데이터 구조로 응답
        return {
          version: '3.1',
          id: prompt.id,
          projectId: prompt.project_id,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt,
          
          // v3.1 구조 복원
          userInput: prompt.user_input,
          projectConfig: prompt.project_config,
          
          promptBlueprint: {
            metadata: (prompt.metadata as any)?.v3_metadata || convertLegacyMetadata(prompt.metadata),
            elements: extractElementsFromTimeline(prompt.timeline),
            timeline: prompt.timeline,
          },
          
          generationControl: prompt.generation_control,
          aiAnalysis: prompt.ai_analysis,
          
          finalOutput: {
            finalPromptText: '', // 필요시 별도 필드로 저장
            keywords: [], // 필요시 별도 추출
            negativePrompts: Array.isArray(prompt.negative) ? prompt.negative : [],
          },
        };
      } else {
        // Legacy 호환 응답
        return {
          id: prompt.id,
          version: prompt.version,
          scenarioId: prompt.scenarioId,
          metadata: prompt.metadata,
          timeline: prompt.timeline,
          negative: prompt.negative,
          createdAt: prompt.createdAt,
          
          // 추가 정보
          cinegenius_version: prompt.cinegenius_version || '2.0',
          ...(isV3 ? { projectId: prompt.project_id } : {}),
        };
      }
    });
    
    // 📈 통계 정보 추가
    const stats = {
      total: transformedPrompts.length,
      v3_count: transformedPrompts.filter((p: any) => p.version === '3.1' || p.cinegenius_version === '3.1').length,
      v2_count: transformedPrompts.filter((p: any) => p.version !== '3.1' && p.cinegenius_version !== '3.1').length,
    };
    
    logger.info('prompt list retrieved', { 
      count: transformedPrompts.length, 
      version_filter: versionParam,
      include_v3: includeV3,
      stats 
    }, traceId);
    
    return success({ 
      data: transformedPrompts, 
      stats 
    }, 200, traceId);
    
  } catch (e: any) {
    logger.error('prompt list failed', { error: e?.message, stack: e?.stack }, traceId);
    return failure('QUERY_ERROR', e?.message || 'Failed to retrieve prompts', 500, traceId);
  }
}

/**
 * Legacy 메타데이터를 v3.1 형식으로 변환 (간단한 매핑)
 */
function convertLegacyMetadata(metadata: any) {
  if (!metadata) return null;
  
  return {
    promptName: metadata.project_name || 'Legacy Prompt',
    baseStyle: {
      visualStyle: metadata.base_style || '',
      genre: metadata.genre || 'Drama',
      mood: metadata.mood || 'Neutral',
      quality: metadata.quality || '4K',
      styleFusion: {
        styleA: metadata.base_style || '',
        styleB: metadata.base_style || '',
        ratio: 1.0,
      },
    },
    spatialContext: {
      placeDescription: metadata.scene_description || metadata.room_description || '',
      weather: metadata.weather || 'Clear',
      lighting: metadata.lighting || 'Daylight (Midday)',
    },
    cameraSetting: {
      primaryLens: metadata.camera_setup || metadata.lens || '35mm (Natural)',
      dominantMovement: metadata.camera_movement || 'Static Shot',
    },
    deliverySpec: {
      durationMs: 8000, // 기본값
      aspectRatio: metadata.aspect_ratio || '16:9',
    },
  };
}

/**
 * 타임라인에서 요소들 추출 (간단한 추출)
 */
function extractElementsFromTimeline(timeline: any) {
  if (!Array.isArray(timeline)) {
    return { characters: [], coreObjects: [] };
  }
  
  const characters: string[] = [];
  const objects: string[] = [];
  
  // 타임라인에서 언급된 요소들 추출 (단순 예시)
  timeline.forEach((segment: any, index: number) => {
    if (segment.action || segment.visualDirecting) {
      const text = segment.action || segment.visualDirecting;
      // 간단한 키워드 추출 (실제로는 더 정교한 NLP 필요)
      if (text.includes('person') || text.includes('character')) {
        characters.push(`Character from segment ${index}`);
      }
    }
  });
  
  return {
    characters: characters.map((desc, i) => ({ id: `char_${i}`, description: desc })),
    coreObjects: objects.map((desc, i) => ({ id: `obj_${i}`, description: desc })),
  };
}
