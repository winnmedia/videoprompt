/**
 * Storyboard Batch Generation API Route
 *
 * 12개 숏트 일괄 생성 엔드포인트
 * 순차적 생성 (첫 이미지 → 참조 → 나머지), 진행률 실시간 업데이트
 * CLAUDE.md 준수: 비용 안전 미들웨어, JWT 검증, Supabase RLS
 */

import { NextRequest } from 'next/server';
import {
  withApiHandler,
  validateRequest,
  createSuccessResponse,
  handleCorsPreflightRequest,
} from '@/shared/api/planning-utils';
import {
  StoryboardBatchRequestSchema,
  validateCostSafety,
  type StoryboardBatchRequest,
  type StoryboardBatchResponse,
  type BatchGenerationProgress,
  type StoryboardGenerateResponse,
} from '@/shared/api/storyboard-schemas';
import { supabaseClient } from '@/shared/api/supabase-client';
import { seedreamClient } from '@/shared/lib/seedream-client';
import logger from '@/shared/lib/structured-logger';

// ===========================================
// OPTIONS 요청 처리 (CORS)
// ===========================================

export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

// ===========================================
// 배치 진행 상태 관리 클래스
// ===========================================

class BatchProgressManager {
  private static batches = new Map<string, BatchGenerationProgress>();

  static createBatch(batchId: string, totalFrames: number): BatchGenerationProgress {
    const progress: BatchGenerationProgress = {
      batchId,
      totalFrames,
      completedFrames: 0,
      failedFrames: 0,
      progress: 0,
      errors: [],
    };

    this.batches.set(batchId, progress);
    return progress;
  }

  static updateProgress(
    batchId: string,
    update: Partial<BatchGenerationProgress>
  ): BatchGenerationProgress | null {
    const current = this.batches.get(batchId);
    if (!current) return null;

    const updated = { ...current, ...update };
    updated.progress = (updated.completedFrames + updated.failedFrames) / updated.totalFrames;

    this.batches.set(batchId, updated);
    return updated;
  }

  static getBatch(batchId: string): BatchGenerationProgress | null {
    return this.batches.get(batchId) || null;
  }

  static deleteBatch(batchId: string): void {
    this.batches.delete(batchId);
  }
}

// ===========================================
// POST: 배치 생성 시작
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 요청 검증
    const requestData = await validateRequest(request, StoryboardBatchRequestSchema);

    // 2. 비용 안전 검증
    const costValidation = validateCostSafety.batchRequest(requestData);
    if (!costValidation.isValid) {
      throw new Error(`비용 안전 검증 실패: ${costValidation.errors.join(', ')}`);
    }

    logger.info('스토리보드 배치 생성 요청', {
      userId: user?.userId,
      component: 'StoryboardBatchAPI',
      metadata: {
        storyboardId: requestData.storyboardId,
        framesCount: requestData.frames.length,
        maxConcurrent: requestData.batchSettings?.maxConcurrent || 1,
        delayBetweenRequests: requestData.batchSettings?.delayBetweenRequests || 12000,
        hasConsistencyBase: !!requestData.consistencyBaseImage,
      },
    });

    try {
      // 3. 스토리보드 소유권 확인
      const { data: storyboard, error: storyboardError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboards')
          .select(`
            id,
            scenario_id,
            title,
            status,
            user_id,
            config,
            consistency_refs
          `)
          .eq('id', requestData.storyboardId)
          .eq('user_id', user!.userId)
          .eq('is_deleted', false)
          .single(),
        user!.userId,
        'get_storyboard'
      );

      if (storyboardError || !storyboard) {
        throw new Error('스토리보드를 찾을 수 없거나 접근 권한이 없습니다.');
      }

      // 4. 모든 씬 정보 조회 및 검증
      const sceneIds = requestData.frames.map(frame => frame.sceneId);
      const { data: scenes, error: scenesError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('scenes')
          .select(`
            id,
            scenario_id,
            title,
            description,
            order,
            location,
            characters,
            visual_elements
          `)
          .in('id', sceneIds)
          .eq('scenario_id', storyboard.scenario_id)
          .eq('user_id', user!.userId),
        user!.userId,
        'get_scenes'
      );

      if (scenesError || !scenes || scenes.length !== sceneIds.length) {
        throw new Error('일부 시나리오 씬을 찾을 수 없습니다.');
      }

      // 씬 데이터를 ID로 인덱싱
      const sceneMap = new Map(scenes.map(scene => [scene.id, scene]));

      // 5. 배치 레코드 생성
      const batchId = crypto.randomUUID();
      const startedAt = new Date().toISOString();

      const batchData = {
        id: batchId,
        storyboard_id: requestData.storyboardId,
        user_id: user!.userId,
        status: 'initiated',
        total_frames: requestData.frames.length,
        completed_frames: 0,
        failed_frames: 0,
        batch_settings: requestData.batchSettings || {
          maxConcurrent: 1,
          delayBetweenRequests: 12000,
          stopOnError: false,
          useConsistencyChain: true,
        },
        consistency_base_image: requestData.consistencyBaseImage,
        started_at: startedAt,
      };

      const { data: batch, error: batchError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboard_batches')
          .insert(batchData)
          .select('*')
          .single(),
        user!.userId,
        'create_batch'
      );

      if (batchError || !batch) {
        throw new Error('배치 생성 실패');
      }

      // 6. 진행 상태 관리자 초기화
      const progressManager = BatchProgressManager.createBatch(batchId, requestData.frames.length);

      // 7. 스토리보드 상태를 'in_progress'로 업데이트
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboards')
          .update({ status: 'in_progress' })
          .eq('id', requestData.storyboardId),
        user!.userId,
        'update_storyboard_status'
      );

      // 8. 배치 실행을 백그라운드로 시작 (Promise를 기다리지 않음)
      executeBatchGeneration(
        batchId,
        requestData,
        storyboard,
        sceneMap,
        user!.userId
      ).catch(error => {
        logger.error('배치 생성 백그라운드 실행 실패', error, {
          userId: user?.userId,
          component: 'StoryboardBatchAPI',
          metadata: { batchId, storyboardId: requestData.storyboardId },
        });
      });

      // 9. 즉시 응답 반환 (배치 시작됨)
      const response: StoryboardBatchResponse = {
        batchId,
        storyboardId: requestData.storyboardId,
        status: 'initiated',
        progress: progressManager,
        results: [],
        totalCost: 0,
        startedAt,
      };

      logger.logBusinessEvent('storyboard_batch_initiated', {
        userId: user?.userId,
        batchId,
        storyboardId: requestData.storyboardId,
        framesCount: requestData.frames.length,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
      });

    } catch (error) {
      logger.error(
        '스토리보드 배치 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryboardBatchAPI',
          metadata: {
            storyboardId: requestData.storyboardId,
            framesCount: requestData.frames.length,
          },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/storyboard/batch',
  }
);

// ===========================================
// GET: 배치 진행 상태 조회
// ===========================================

export const GET = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      throw new Error('배치 ID가 필요합니다.');
    }

    // 배치 소유권 확인
    const { data: batch, error: batchError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('storyboard_batches')
        .select('*')
        .eq('id', batchId)
        .eq('user_id', user!.userId)
        .single(),
      user!.userId,
      'get_batch'
    );

    if (batchError || !batch) {
      throw new Error('배치를 찾을 수 없거나 접근 권한이 없습니다.');
    }

    // 메모리에서 진행 상태 조회
    let progress = BatchProgressManager.getBatch(batchId);

    // 메모리에 없으면 DB에서 재구성
    if (!progress) {
      const { data: frames } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboard_frames')
          .select('id, status, scene_id')
          .eq('storyboard_id', batch.storyboard_id)
          .eq('batch_id', batchId),
        user!.userId,
        'get_batch_frames'
      );

      const completedFrames = frames?.filter(f => f.status === 'completed').length || 0;
      const failedFrames = frames?.filter(f => f.status === 'failed').length || 0;

      progress = {
        batchId,
        totalFrames: batch.total_frames,
        completedFrames,
        failedFrames,
        progress: (completedFrames + failedFrames) / batch.total_frames,
        errors: [],
      };
    }

    // 배치 결과 조회
    const { data: results } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('storyboard_frames')
        .select(`
          id,
          scene_id,
          status,
          image_url,
          thumbnail_url,
          generated_at,
          processing_time,
          cost
        `)
        .eq('storyboard_id', batch.storyboard_id)
        .eq('batch_id', batchId)
        .order('order'),
      user!.userId,
      'get_batch_results'
    );

    const batchResults: StoryboardGenerateResponse[] = (results || []).map(frame => ({
      frameId: frame.id,
      storyboardId: batch.storyboard_id,
      imageUrl: frame.image_url || '',
      thumbnailUrl: frame.thumbnail_url,
      generationId: `batch-${frame.id}`,
      status: frame.status,
      model: 'seedream-4.0',
      config: {
        model: 'seedream-4.0',
        aspectRatio: '16:9',
        quality: 'hd',
        style: 'cinematic',
      },
      prompt: {
        basePrompt: '',
        enhancedPrompt: '',
        styleModifiers: [],
        technicalSpecs: [],
      },
      generatedAt: frame.generated_at || new Date().toISOString(),
      processingTime: frame.processing_time,
      cost: frame.cost,
    }));

    const response: StoryboardBatchResponse = {
      batchId,
      storyboardId: batch.storyboard_id,
      status: batch.status,
      progress: progress,
      results: batchResults,
      totalCost: batchResults.reduce((sum, result) => sum + (result.cost || 0), 0),
      startedAt: batch.started_at,
      completedAt: batch.completed_at,
    };

    return createSuccessResponse(response, {
      userId: user?.userId,
    });
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/storyboard/batch',
  }
);

// ===========================================
// 배치 실행 로직 (백그라운드)
// ===========================================

async function executeBatchGeneration(
  batchId: string,
  requestData: StoryboardBatchRequest,
  storyboard: any,
  sceneMap: Map<string, any>,
  userId: string
): Promise<void> {
  let consistencyReferenceUrl = requestData.consistencyBaseImage;
  const settings = requestData.batchSettings || {
    maxConcurrent: 1,
    delayBetweenRequests: 12000,
    stopOnError: false,
    useConsistencyChain: true,
  };

  try {
    // 배치 상태를 'in_progress'로 업데이트
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('storyboard_batches')
        .update({ status: 'in_progress' })
        .eq('id', batchId),
      userId,
      'update_batch_in_progress'
    );

    const results: StoryboardGenerateResponse[] = [];
    let totalCost = 0;

    // 순차적으로 프레임 생성 (동시 처리 수 제한)
    for (let i = 0; i < requestData.frames.length; i++) {
      const frame = requestData.frames[i];
      const scene = sceneMap.get(frame.sceneId);

      if (!scene) {
        logger.error('씬을 찾을 수 없음', new Error(`Scene not found: ${frame.sceneId}`), {
          userId,
          component: 'StoryboardBatchExecution',
          metadata: { batchId, sceneId: frame.sceneId },
        });
        continue;
      }

      try {
        // 진행 상태 업데이트
        BatchProgressManager.updateProgress(batchId, {
          currentFrame: {
            frameId: `processing-${i}`,
            sceneId: frame.sceneId,
            status: 'generating',
            currentStep: `프레임 ${i + 1}/${requestData.frames.length} 생성 중`,
          },
          estimatedTimeRemaining: (requestData.frames.length - i) * 30, // 프레임당 30초 추정
        });

        // 지연 시간 적용 (첫 번째 프레임 제외)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, settings.delayBetweenRequests));
        }

        const result = await generateSingleFrame(
          batchId,
          frame,
          scene,
          storyboard,
          consistencyReferenceUrl,
          userId
        );

        results.push(result);
        totalCost += result.cost || 0;

        // 첫 번째 프레임이 완성되면 일관성 참조로 사용
        if (i === 0 && settings.useConsistencyChain && !consistencyReferenceUrl) {
          consistencyReferenceUrl = result.imageUrl;
        }

        // 진행 상태 업데이트
        BatchProgressManager.updateProgress(batchId, {
          completedFrames: i + 1,
          currentFrame: undefined,
        });

        logger.info(`배치 프레임 ${i + 1}/${requestData.frames.length} 완료`, {
          userId,
          component: 'StoryboardBatchExecution',
          metadata: {
            batchId,
            frameId: result.frameId,
            progress: (i + 1) / requestData.frames.length,
          },
        });

      } catch (error) {
        BatchProgressManager.updateProgress(batchId, {
          failedFrames: (BatchProgressManager.getBatch(batchId)?.failedFrames || 0) + 1,
          errors: [
            ...(BatchProgressManager.getBatch(batchId)?.errors || []),
            {
              frameId: `error-${i}`,
              code: 'GENERATION_FAILED',
              message: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            }
          ],
        });

        logger.error(`배치 프레임 ${i + 1} 생성 실패`, error as Error, {
          userId,
          component: 'StoryboardBatchExecution',
          metadata: { batchId, sceneId: frame.sceneId },
        });

        if (settings.stopOnError) {
          break;
        }
      }
    }

    // 배치 완료 처리
    const completedAt = new Date().toISOString();
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('storyboard_batches')
        .update({
          status: 'completed',
          completed_at: completedAt,
          total_cost: totalCost,
          completed_frames: results.length,
        })
        .eq('id', batchId),
      userId,
      'update_batch_completed'
    );

    // 스토리보드 상태 업데이트
    const allFramesCompleted = results.length === requestData.frames.length;
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('storyboards')
        .update({
          status: allFramesCompleted ? 'completed' : 'in_progress',
        })
        .eq('id', requestData.storyboardId),
      userId,
      'update_storyboard_final_status'
    );

    logger.logBusinessEvent('storyboard_batch_completed', {
      userId,
      batchId,
      storyboardId: requestData.storyboardId,
      completedFrames: results.length,
      totalFrames: requestData.frames.length,
      totalCost,
      allCompleted: allFramesCompleted,
    });

  } catch (error) {
    // 배치 실패 처리
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('storyboard_batches')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq('id', batchId),
      userId,
      'update_batch_failed'
    );

    logger.error('배치 실행 실패', error as Error, {
      userId,
      component: 'StoryboardBatchExecution',
      metadata: { batchId, storyboardId: requestData.storyboardId },
    });
  }
}

// ===========================================
// 개별 프레임 생성 함수
// ===========================================

async function generateSingleFrame(
  batchId: string,
  frame: any,
  scene: any,
  storyboard: any,
  consistencyReferenceUrl: string | undefined,
  userId: string
): Promise<StoryboardGenerateResponse> {
  // 프레임 데이터 준비
  const basePrompt = scene.description;
  const additionalPrompt = frame.additionalPrompt || '';

  let enhancedPrompt = basePrompt;
  if (additionalPrompt) {
    enhancedPrompt += ` ${additionalPrompt}`;
  }
  if (scene.location) {
    enhancedPrompt += ` Location: ${scene.location}.`;
  }
  if (scene.characters && scene.characters.length > 0) {
    enhancedPrompt += ` Characters: ${scene.characters.join(', ')}.`;
  }
  if (scene.visual_elements && scene.visual_elements.length > 0) {
    enhancedPrompt += ` Visual elements: ${scene.visual_elements.join(', ')}.`;
  }

  const styleModifiers = ['cinematic composition', 'professional lighting', 'storyboard style'];
  enhancedPrompt += ` ${styleModifiers.join(', ')}.`;

  // 프레임 레코드 생성
  const frameData = {
    storyboard_id: storyboard.id,
    scene_id: frame.sceneId,
    batch_id: batchId,
    user_id: userId,
    order: scene.order,
    title: scene.title,
    description: scene.description,
    status: 'generating',
    prompt_data: {
      basePrompt,
      enhancedPrompt,
      styleModifiers,
      technicalSpecs: ['16:9 aspect ratio', 'HD quality', 'storyboard frame'],
      additionalPrompt,
    },
    config: {
      model: 'seedream-4.0',
      aspectRatio: '16:9',
      quality: 'hd',
      style: frame.config?.style || 'cinematic',
      ...frame.config,
    },
    priority: frame.priority,
  };

  const { data: newFrame, error: frameError } = await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('storyboard_frames')
      .insert(frameData)
      .select('*')
      .single(),
    userId,
    'create_batch_frame'
  );

  if (frameError || !newFrame) {
    throw new Error('프레임 생성 실패');
  }

  // Seedream API로 이미지 생성
  if (!seedreamClient) {
    throw new Error('Seedream 클라이언트가 초기화되지 않았습니다.');
  }

  const startTime = Date.now();
  const imageResult = await seedreamClient.generateImage({
    prompt: enhancedPrompt,
    style: (frameData.config.style as any) || 'cinematic',
    referenceImageUrl: consistencyReferenceUrl,
    aspectRatio: '16:9',
    seed: frameData.config.seed,
  });

  const processingTime = (Date.now() - startTime) / 1000;

  // 프레임 업데이트
  await supabaseClient.safeQuery(
    () => supabaseClient.raw
      .from('storyboard_frames')
      .update({
        status: 'completed',
        image_url: imageResult.imageUrl,
        thumbnail_url: imageResult.imageUrl,
        generation_id: `seedream-batch-${Date.now()}`,
        generated_at: new Date().toISOString(),
        processing_time: processingTime,
        cost: 0.05,
        generation_metadata: {
          seed: imageResult.seed,
          model: 'seedream-4.0',
          consistencyReferenceUrl,
          consistencyScore: consistencyReferenceUrl ? 0.85 : undefined,
        },
      })
      .eq('id', newFrame.id),
    userId,
    'update_batch_frame_completed'
  );

  return {
    frameId: newFrame.id,
    storyboardId: storyboard.id,
    imageUrl: imageResult.imageUrl,
    thumbnailUrl: imageResult.imageUrl,
    generationId: `seedream-batch-${Date.now()}`,
    status: 'completed',
    model: 'seedream-4.0',
    config: frameData.config as any,
    prompt: {
      basePrompt,
      enhancedPrompt,
      styleModifiers,
      technicalSpecs: ['16:9 aspect ratio', 'HD quality', 'storyboard frame'],
      additionalPrompt,
    },
    generatedAt: new Date().toISOString(),
    processingTime,
    cost: 0.05,
    consistencyScore: consistencyReferenceUrl ? 0.85 : undefined,
  };
}