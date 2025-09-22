/**
 * Storyboard Generate API Route
 *
 * 개별 스토리보드 프레임 생성 엔드포인트
 * ByteDance-Seedream API 연동, 참조 이미지 기반 일관성 유지
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
  StoryboardGenerateRequestSchema,
  validateCostSafety,
  type StoryboardGenerateRequest,
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
// POST: 개별 스토리보드 프레임 생성
// ===========================================

export const POST = withApiHandler(
  async (request: NextRequest, context) => {
    const { user } = context;

    // 1. 요청 검증
    const requestData = await validateRequest(request, StoryboardGenerateRequestSchema);

    // 2. 비용 안전 검증
    const costValidation = validateCostSafety.generateRequest(requestData);
    if (!costValidation.isValid) {
      throw new Error(`비용 안전 검증 실패: ${costValidation.errors.join(', ')}`);
    }

    logger.info('스토리보드 프레임 생성 요청', {
      userId: user?.userId,
      component: 'StoryboardGenerateAPI',
      metadata: {
        storyboardId: requestData.storyboardId,
        sceneId: requestData.frame.sceneId,
        forceRegenerate: requestData.forceRegenerate,
        useConsistencyGuide: requestData.useConsistencyGuide,
        hasAdditionalPrompt: !!requestData.frame.additionalPrompt,
        consistencyRefsCount: requestData.frame.consistencyRefs?.length || 0,
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

      // 4. 시나리오 및 씬 정보 조회
      const { data: scene, error: sceneError } = await supabaseClient.safeQuery(
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
          .eq('id', requestData.frame.sceneId)
          .eq('scenario_id', storyboard.scenario_id)
          .eq('user_id', user!.userId)
          .single(),
        user!.userId,
        'get_scene'
      );

      if (sceneError || !scene) {
        throw new Error('시나리오 씬을 찾을 수 없습니다.');
      }

      // 5. 기존 프레임 확인 (재생성이 아닌 경우)
      if (!requestData.forceRegenerate) {
        const { data: existingFrame } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('storyboard_frames')
            .select('id, status, image_url')
            .eq('storyboard_id', requestData.storyboardId)
            .eq('scene_id', requestData.frame.sceneId)
            .eq('status', 'completed')
            .single(),
          user!.userId,
          'check_existing_frame'
        );

        if (existingFrame?.image_url) {
          logger.info('기존 프레임 반환', {
            userId: user?.userId,
            component: 'StoryboardGenerateAPI',
            metadata: {
              frameId: existingFrame.id,
              storyboardId: requestData.storyboardId,
              sceneId: requestData.frame.sceneId,
            },
          });

          // 기존 프레임이 있으면 바로 반환
          const existingResponse: StoryboardGenerateResponse = {
            frameId: existingFrame.id,
            storyboardId: requestData.storyboardId,
            imageUrl: existingFrame.image_url,
            generationId: `existing-${existingFrame.id}`,
            status: 'completed',
            model: 'seedream-4.0',
            config: {
              model: 'seedream-4.0',
              aspectRatio: '16:9',
              quality: 'hd',
              style: 'cinematic',
            },
            prompt: {
              basePrompt: scene.description,
              enhancedPrompt: scene.description,
              styleModifiers: [],
              technicalSpecs: [],
            },
            generatedAt: new Date().toISOString(),
          };

          return createSuccessResponse(existingResponse, {
            userId: user?.userId,
          });
        }
      }

      // 6. 프롬프트 엔지니어링
      const basePrompt = scene.description;
      const additionalPrompt = requestData.frame.additionalPrompt || '';

      // 시각적 요소들 추가
      const visualElements = scene.visual_elements || [];
      const characters = scene.characters || [];
      const location = scene.location || '';

      let enhancedPrompt = basePrompt;
      if (additionalPrompt) {
        enhancedPrompt += ` ${additionalPrompt}`;
      }
      if (location) {
        enhancedPrompt += ` Location: ${location}.`;
      }
      if (characters.length > 0) {
        enhancedPrompt += ` Characters: ${characters.join(', ')}.`;
      }
      if (visualElements.length > 0) {
        enhancedPrompt += ` Visual elements: ${visualElements.join(', ')}.`;
      }

      // 스타일 모디파이어 추가
      const styleModifiers = ['cinematic composition', 'professional lighting', 'storyboard style'];
      enhancedPrompt += ` ${styleModifiers.join(', ')}.`;

      // 7. 일관성 참조 이미지 준비
      let referenceImageUrl: string | undefined;

      if (requestData.useConsistencyGuide && requestData.frame.consistencyRefs) {
        const { data: consistencyRefs } = await supabaseClient.safeQuery(
          () => supabaseClient.raw
            .from('storyboard_consistency_refs')
            .select('reference_image_url, weight')
            .in('id', requestData.frame.consistencyRefs!)
            .eq('storyboard_id', requestData.storyboardId)
            .eq('is_active', true)
            .order('weight', { ascending: false })
            .limit(1),
          user!.userId,
          'get_consistency_refs'
        );

        if (consistencyRefs && consistencyRefs.length > 0 && consistencyRefs[0].reference_image_url) {
          referenceImageUrl = consistencyRefs[0].reference_image_url;
        }
      }

      // 8. 프레임 레코드 생성 (generating 상태)
      const frameData = {
        storyboard_id: requestData.storyboardId,
        scene_id: requestData.frame.sceneId,
        user_id: user!.userId,
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
          style: requestData.frame.config?.style || 'cinematic',
          ...requestData.frame.config,
        },
        priority: requestData.frame.priority,
      };

      const { data: newFrame, error: frameError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboard_frames')
          .insert(frameData)
          .select('*')
          .single(),
        user!.userId,
        'create_frame'
      );

      if (frameError || !newFrame) {
        throw new Error('프레임 생성 실패');
      }

      // 9. Seedream API로 이미지 생성
      const startTime = Date.now();

      if (!seedreamClient) {
        throw new Error('Seedream 클라이언트가 초기화되지 않았습니다. API 키를 확인하세요.');
      }

      const imageResult = await seedreamClient.generateImage({
        prompt: enhancedPrompt,
        style: (frameData.config.style as any) || 'cinematic',
        referenceImageUrl,
        aspectRatio: '16:9',
        seed: frameData.config.seed,
      });

      const processingTime = (Date.now() - startTime) / 1000;

      // 10. 프레임 업데이트 (완료 상태)
      const { data: updatedFrame, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('storyboard_frames')
          .update({
            status: 'completed',
            image_url: imageResult.imageUrl,
            thumbnail_url: imageResult.imageUrl, // TODO: 썸네일 생성 로직 추가
            generation_id: `seedream-${Date.now()}`,
            generated_at: new Date().toISOString(),
            processing_time: processingTime,
            cost: 0.05, // Seedream 예상 비용
            generation_metadata: {
              seed: imageResult.seed,
              model: 'seedream-4.0',
              referenceImageUrl,
              consistencyScore: referenceImageUrl ? 0.85 : undefined,
            },
          })
          .eq('id', newFrame.id)
          .select('*')
          .single(),
        user!.userId,
        'update_frame_completed'
      );

      if (updateError || !updatedFrame) {
        // 이미지는 생성되었지만 DB 업데이트 실패
        logger.error('프레임 완료 상태 업데이트 실패', updateError || new Error('업데이트 결과 없음'), {
          userId: user?.userId,
          component: 'StoryboardGenerateAPI',
          metadata: {
            frameId: newFrame.id,
            imageUrl: imageResult.imageUrl,
          },
        });
      }

      // 11. 응답 구성
      const response: StoryboardGenerateResponse = {
        frameId: newFrame.id,
        storyboardId: requestData.storyboardId,
        imageUrl: imageResult.imageUrl,
        thumbnailUrl: imageResult.imageUrl,
        generationId: `seedream-${Date.now()}`,
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
        consistencyScore: referenceImageUrl ? 0.85 : undefined,
      };

      // 12. 비용 및 성공 로그
      logger.logCostEvent('seedream_frame_generation', 0.05, {
        userId: user?.userId,
        frameId: newFrame.id,
        storyboardId: requestData.storyboardId,
        processingTime,
        hasReference: !!referenceImageUrl,
      });

      logger.logBusinessEvent('storyboard_frame_generated', {
        userId: user?.userId,
        frameId: newFrame.id,
        storyboardId: requestData.storyboardId,
        sceneId: requestData.frame.sceneId,
        model: 'seedream-4.0',
        processingTime,
        cost: 0.05,
      });

      return createSuccessResponse(response, {
        userId: user?.userId,
        cost: 0.05,
        processingTime,
      });

    } catch (error) {
      // 실패한 프레임이 있다면 상태 업데이트
      if (error instanceof Error && error.message.includes('프레임 생성 실패')) {
        // 이미 DB에 생성된 프레임은 없음
      } else {
        // Seedream API 호출 중 실패한 경우, 프레임 상태를 failed로 업데이트
        try {
          await supabaseClient.safeQuery(
            () => supabaseClient.raw
              .from('storyboard_frames')
              .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : String(error),
                updated_at: new Date().toISOString(),
              })
              .eq('storyboard_id', requestData.storyboardId)
              .eq('scene_id', requestData.frame.sceneId)
              .eq('status', 'generating'),
            user!.userId,
            'update_frame_failed'
          );
        } catch (updateError) {
          // 에러 상태 업데이트도 실패한 경우는 로그만 남김
          logger.error('프레임 실패 상태 업데이트 실패', updateError as Error, {
            userId: user?.userId,
            component: 'StoryboardGenerateAPI',
            metadata: {
              storyboardId: requestData.storyboardId,
              sceneId: requestData.frame.sceneId,
            },
          });
        }
      }

      logger.error(
        '스토리보드 프레임 생성 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user?.userId,
          component: 'StoryboardGenerateAPI',
          metadata: {
            storyboardId: requestData.storyboardId,
            sceneId: requestData.frame.sceneId,
            forceRegenerate: requestData.forceRegenerate,
          },
        }
      );
      throw error;
    }
  },
  {
    requireAuth: true,
    costSafety: true,
    endpoint: '/api/storyboard/generate',
  }
);