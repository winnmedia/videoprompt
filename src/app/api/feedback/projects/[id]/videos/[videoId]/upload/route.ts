/**
 * 영상 파일 업로드 API
 *
 * POST /api/feedback/projects/[id]/videos/[videoId]/upload - 영상 파일 업로드
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/shared/api/supabase-client';
import { generateUploadPath, extractVideoMetadata, createVideoThumbnail } from '@/shared/lib/video-utils';

// ===========================================
// POST - 영상 파일 업로드
// ===========================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; videoId: string } }
) {
  try {
    const projectId = params.id;
    const videoSlotId = params.videoId;

    // 사용자 인증 확인
    const user = await supabaseClient.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // FormData 파싱
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;

    if (!videoFile) {
      return NextResponse.json(
        { error: 'Video file is required' },
        { status: 400 }
      );
    }

    // 파일 크기 검증 (300MB)
    const maxFileSize = 300 * 1024 * 1024; // 300MB
    if (videoFile.size > maxFileSize) {
      return NextResponse.json(
        { error: 'File size exceeds 300MB limit' },
        { status: 413 }
      );
    }

    // 파일 타입 검증
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(videoFile.type)) {
      return NextResponse.json(
        { error: 'Unsupported video format. Allowed: MP4, WebM, MOV, AVI' },
        { status: 400 }
      );
    }

    // 영상 슬롯 및 권한 확인
    const { data: videoSlot, error: slotError } = await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('video_slots')
        .select(`
          id, slot_number, title, feedback_project_id,
          project:feedback_projects!feedback_project_id(
            id, title, max_video_slots,
            participants:feedback_participants!inner(role, status, permissions)
          )
        `)
        .eq('id', videoSlotId)
        .eq('feedback_project_id', projectId)
        .eq('project.participants.user_id', user.id)
        .eq('project.participants.status', 'active')
        .eq('is_deleted', false)
        .single(),
      user.id,
      'check_video_upload_permission'
    );

    if (slotError) {
      if (slotError.message.includes('No rows returned')) {
        return NextResponse.json(
          { error: 'Video slot not found or access denied' },
          { status: 404 }
        );
      }
      throw slotError;
    }

    // 업로드 권한 확인
    const userPermissions = (videoSlot as any).project?.participants?.[0]?.permissions;
    if (!userPermissions?.can_upload) {
      return NextResponse.json(
        { error: 'Upload permission required' },
        { status: 403 }
      );
    }

    // 업로드 세션 ID 생성
    const uploadSessionId = crypto.randomUUID();

    // 처리 상태 업데이트 (처리 시작)
    await supabaseClient.safeQuery(
      () => supabaseClient.raw
        .from('video_slots')
        .update({
          processing_status: 'processing',
          processing_progress: 10,
          upload_session_id: uploadSessionId,
        })
        .eq('id', videoSlotId),
      user.id,
      'update_video_processing_start'
    );

    try {
      // 1. 영상 파일을 Supabase Storage에 업로드
      const videoPath = generateUploadPath(projectId, videoSlotId, 'video', videoFile.name);

      const { data: uploadResult, error: uploadError } = await supabaseClient.uploadFile(
        'feedback-videos',
        videoPath,
        videoFile,
        {
          upsert: true,
          contentType: videoFile.type,
        }
      );

      if (uploadError) {
        throw new Error(`Failed to upload video: ${uploadError.message}`);
      }

      // 처리 진행률 업데이트
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_slots')
          .update({ processing_progress: 40 })
          .eq('id', videoSlotId),
        user.id,
        'update_video_processing_40'
      );

      // 2. 영상 메타데이터 추출
      const videoMetadata = await extractVideoMetadata(videoFile);

      // 처리 진행률 업데이트
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_slots')
          .update({ processing_progress: 60 })
          .eq('id', videoSlotId),
        user.id,
        'update_video_processing_60'
      );

      // 3. 썸네일 생성
      const thumbnailBlob = await createVideoThumbnail(videoFile);
      const thumbnailPath = generateUploadPath(projectId, videoSlotId, 'thumbnail', 'thumbnail.jpg');

      const { error: thumbnailError } = await supabaseClient.uploadFile(
        'feedback-thumbnails',
        thumbnailPath,
        thumbnailBlob,
        {
          upsert: true,
          contentType: 'image/jpeg',
        }
      );

      if (thumbnailError) {
        console.warn('Failed to upload thumbnail:', thumbnailError);
        // 썸네일 실패는 치명적이지 않음
      }

      // 처리 진행률 업데이트
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_slots')
          .update({ processing_progress: 80 })
          .eq('id', videoSlotId),
        user.id,
        'update_video_processing_80'
      );

      // 4. 영상 슬롯 정보 업데이트
      const { data: updatedSlot, error: updateError } = await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_slots')
          .update({
            video_file_path: uploadResult.path,
            video_file_size: videoFile.size,
            video_duration_seconds: videoMetadata.duration,
            video_mime_type: videoFile.type,
            thumbnail_file_path: thumbnailError ? null : thumbnailPath,
            thumbnail_file_size: thumbnailError ? null : thumbnailBlob.size,
            metadata: {
              original_filename: videoFile.name,
              upload_timestamp: new Date().toISOString(),
              video_codec: videoMetadata.codec,
              resolution: videoMetadata.resolution,
              bitrate: videoMetadata.bitrate,
              frame_rate: videoMetadata.frameRate,
            },
            processing_status: 'completed',
            processing_progress: 100,
          })
          .eq('id', videoSlotId)
          .select()
          .single(),
        user.id,
        'update_video_slot_completed'
      );

      if (updateError) {
        throw updateError;
      }

      // 5. 활동 로그 기록
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('feedback_activity_logs')
          .insert({
            feedback_project_id: projectId,
            target_type: 'video_slot',
            target_id: videoSlotId,
            action: 'video_uploaded',
            description: `Uploaded video to slot ${videoSlot.slot_number}: ${videoSlot.title}`,
            actor_user_id: user.id,
            metadata: {
              filename: videoFile.name,
              file_size: videoFile.size,
              duration_seconds: videoMetadata.duration,
              upload_session_id: uploadSessionId,
            },
          }),
        user.id,
        'log_video_upload'
      );

      // 6. 응답 데이터 구성
      const responseData = {
        id: updatedSlot.id,
        slot_number: updatedSlot.slot_number,
        title: updatedSlot.title,
        description: updatedSlot.description,
        has_video: true,
        video_duration_seconds: updatedSlot.video_duration_seconds,
        video_file_size: updatedSlot.video_file_size,
        video_mime_type: updatedSlot.video_mime_type,
        video_url: supabaseClient.getPublicUrl('feedback-videos', updatedSlot.video_file_path),
        thumbnail_url: updatedSlot.thumbnail_file_path
          ? supabaseClient.getPublicUrl('feedback-thumbnails', updatedSlot.thumbnail_file_path)
          : null,
        processing_status: updatedSlot.processing_status,
        processing_progress: updatedSlot.processing_progress,
        metadata: updatedSlot.metadata,
        upload_session_id: uploadSessionId,
        updated_at: updatedSlot.updated_at,
      };

      return NextResponse.json({
        success: true,
        data: responseData,
        message: 'Video uploaded and processed successfully',
      });

    } catch (processingError) {
      // 처리 실패 시 상태 업데이트
      await supabaseClient.safeQuery(
        () => supabaseClient.raw
          .from('video_slots')
          .update({
            processing_status: 'failed',
            processing_progress: 0,
            metadata: {
              error_message: processingError instanceof Error ? processingError.message : 'Unknown error',
              failed_at: new Date().toISOString(),
            },
          })
          .eq('id', videoSlotId),
        user.id,
        'update_video_processing_failed'
      );

      throw processingError;
    }

  } catch (error) {
    console.error('Video upload error:', error);

    // 에러 타입에 따른 적절한 응답
    if (error instanceof Error) {
      if (error.message.includes('File size')) {
        return NextResponse.json(
          { error: 'File size exceeds the allowed limit' },
          { status: 413 }
        );
      }
      if (error.message.includes('upload')) {
        return NextResponse.json(
          { error: 'Failed to upload video file' },
          { status: 500 }
        );
      }
      if (error.message.includes('metadata')) {
        return NextResponse.json(
          { error: 'Failed to process video metadata' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error during video upload' },
      { status: 500 }
    );
  }
}