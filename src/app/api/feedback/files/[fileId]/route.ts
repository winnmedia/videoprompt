import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { logger, LogCategory } from '@/shared/lib/structured-logger';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_BUCKET = 'feedback-uploads';

// 파일 정보 스키마
const FeedbackFileSchema = z.object({
  id: z.string(),
  feedback_id: z.string(),
  filename: z.string(),
  original_name: z.string(),
  storage_path: z.string(),
  public_url: z.string(),
  mime_type: z.string(),
  file_size: z.number(),
  file_category: z.string(),
  upload_status: z.string(),
  uploaded_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

type FeedbackFile = z.infer<typeof FeedbackFileSchema>;

/**
 * 파일 ID로 피드백 파일 정보 조회
 */
async function getFeedbackFileById(fileId: string, traceId: string): Promise<FeedbackFile | null> {
  try {
    const supabase = await getSupabaseClientSafe('admin');

    const { data, error } = await supabase
      .from('feedback_files')
      .select(`
        id,
        feedback_id,
        filename,
        original_name,
        storage_path,
        public_url,
        mime_type,
        file_size,
        file_category,
        upload_status,
        uploaded_by,
        created_at,
        updated_at
      `)
      .eq('id', fileId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        logger.info(LogCategory.DATABASE, 'Feedback file not found', {
          fileId,
          traceId
        });
        return null;
      }

      logger.error(LogCategory.DATABASE, 'Failed to fetch feedback file', error, {
        fileId,
        traceId
      });
      throw new Error(`피드백 파일 조회 실패: ${error.message}`);
    }

    // 응답 스키마 검증
    const validatedData = FeedbackFileSchema.parse(data);

    logger.info(LogCategory.DATABASE, 'Feedback file fetched successfully', {
      fileId,
      filename: validatedData.filename,
      feedbackId: validatedData.feedback_id,
      traceId
    });

    return validatedData;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(LogCategory.DATABASE, 'Invalid feedback file data structure', error, {
        fileId,
        traceId
      });
      throw new Error('피드백 파일 데이터 구조가 올바르지 않습니다.');
    }

    logger.error(LogCategory.DATABASE, 'Get feedback file failed', error as Error, {
      fileId,
      traceId
    });
    throw error;
  }
}

/**
 * Supabase Storage에서 파일 삭제
 */
async function deleteFileFromStorage(storagePath: string, traceId: string): Promise<void> {
  try {
    const supabase = await getSupabaseClientSafe('admin');

    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .remove([storagePath]);

    if (error) {
      logger.error(LogCategory.DATABASE, 'Failed to delete file from storage', error, {
        storagePath,
        traceId
      });
      throw new Error(`스토리지 파일 삭제 실패: ${error.message}`);
    }

    logger.info(LogCategory.DATABASE, 'File deleted from storage successfully', {
      storagePath,
      traceId
    });
  } catch (error) {
    logger.error(LogCategory.DATABASE, 'Delete file from storage failed', error as Error, {
      storagePath,
      traceId
    });
    throw error;
  }
}

/**
 * 데이터베이스에서 파일 메타데이터 삭제
 */
async function deleteFileMetadata(fileId: string, traceId: string): Promise<void> {
  try {
    const supabase = await getSupabaseClientSafe('admin');

    const { error } = await supabase
      .from('feedback_files')
      .delete()
      .eq('id', fileId);

    if (error) {
      logger.error(LogCategory.DATABASE, 'Failed to delete file metadata', error, {
        fileId,
        traceId
      });
      throw new Error(`파일 메타데이터 삭제 실패: ${error.message}`);
    }

    logger.info(LogCategory.DATABASE, 'File metadata deleted successfully', {
      fileId,
      traceId
    });
  } catch (error) {
    logger.error(LogCategory.DATABASE, 'Delete file metadata failed', error as Error, {
      fileId,
      traceId
    });
    throw error;
  }
}

// GET: 특정 파일 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const traceId = getTraceId(request);

    logger.setContext({
      requestId: traceId,
      endpoint: `/api/feedback/files/${fileId}`,
      method: 'GET',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    logger.info(LogCategory.API, 'Feedback file fetch request started', {
      fileId,
      traceId
    });

    // 파일 ID 검증
    if (!fileId || fileId.trim().length === 0) {
      logger.warn(LogCategory.API, 'Invalid file ID provided', {
        fileId,
        traceId
      });

      return NextResponse.json(
        failure(
          'INVALID_FILE_ID',
          '유효한 파일 ID가 필요합니다.',
          400,
          undefined,
          traceId
        ),
        { status: 400 }
      );
    }

    // 파일 정보 조회
    const file = await getFeedbackFileById(fileId, traceId);

    if (!file) {
      logger.warn(LogCategory.API, 'Feedback file not found', {
        fileId,
        traceId
      });

      return NextResponse.json(
        failure(
          'FILE_NOT_FOUND',
          '파일을 찾을 수 없습니다.',
          404,
          undefined,
          traceId
        ),
        { status: 404 }
      );
    }

    // 응답 데이터 변환
    const fileInfo = {
      id: file.id,
      feedbackId: file.feedback_id,
      filename: file.filename,
      originalName: file.original_name,
      storagePath: file.storage_path,
      publicUrl: file.public_url,
      mimeType: file.mime_type,
      fileSize: file.file_size,
      fileSizeFormatted: formatFileSize(file.file_size),
      category: file.file_category,
      uploadStatus: file.upload_status,
      uploadedBy: file.uploaded_by,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
      isDownloadable: file.upload_status === 'completed',
      downloadUrl: file.upload_status === 'completed' ? file.public_url : null
    };

    logger.info(LogCategory.API, 'Feedback file fetched successfully', {
      fileId,
      filename: file.filename,
      traceId
    });

    return NextResponse.json(
      success(
        fileInfo,
        '파일 정보를 성공적으로 조회했습니다.',
        traceId
      ),
      { status: 200 }
    );

  } catch (error: any) {
    const traceId = getTraceId(request);
    logger.error(LogCategory.API, 'Feedback file fetch request failed', error, {
      traceId,
      errorMessage: error.message
    });

    if (error instanceof ServiceConfigError) {
      return NextResponse.json(
        failure(
          'SERVICE_UNAVAILABLE',
          '데이터베이스 서비스를 사용할 수 없습니다.',
          503,
          undefined,
          traceId
        ),
        { status: 503 }
      );
    }

    return NextResponse.json(
      failure(
        'FETCH_ERROR',
        `파일 정보 조회 중 오류가 발생했습니다: ${error.message}`,
        500,
        undefined,
        traceId
      ),
      { status: 500 }
    );
  } finally {
    logger.clearContext();
  }
}

// DELETE: 특정 파일 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const traceId = getTraceId(request);

    logger.setContext({
      requestId: traceId,
      endpoint: `/api/feedback/files/${fileId}`,
      method: 'DELETE',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    logger.info(LogCategory.API, 'Feedback file delete request started', {
      fileId,
      traceId
    });

    // 파일 ID 검증
    if (!fileId || fileId.trim().length === 0) {
      logger.warn(LogCategory.API, 'Invalid file ID provided for deletion', {
        fileId,
        traceId
      });

      return NextResponse.json(
        failure(
          'INVALID_FILE_ID',
          '유효한 파일 ID가 필요합니다.',
          400,
          undefined,
          traceId
        ),
        { status: 400 }
      );
    }

    // 파일 정보 조회 (삭제 전 확인)
    const file = await getFeedbackFileById(fileId, traceId);

    if (!file) {
      logger.warn(LogCategory.API, 'File not found for deletion', {
        fileId,
        traceId
      });

      return NextResponse.json(
        failure(
          'FILE_NOT_FOUND',
          '삭제할 파일을 찾을 수 없습니다.',
          404,
          undefined,
          traceId
        ),
        { status: 404 }
      );
    }

    logger.info(LogCategory.API, 'Starting file deletion process', {
      fileId,
      filename: file.filename,
      storagePath: file.storage_path,
      feedbackId: file.feedback_id,
      traceId
    });

    // 1. 스토리지에서 파일 삭제
    try {
      await deleteFileFromStorage(file.storage_path, traceId);
    } catch (storageError) {
      // 스토리지 삭제 실패해도 메타데이터는 삭제하여 정리
      logger.warn(LogCategory.DATABASE, 'Storage deletion failed but continuing with metadata deletion', {
        fileId,
        storagePath: file.storage_path,
        error: storageError instanceof Error ? storageError.message : String(storageError),
        traceId
      });
    }

    // 2. 데이터베이스에서 메타데이터 삭제
    await deleteFileMetadata(fileId, traceId);

    logger.info(LogCategory.API, 'Feedback file deleted successfully', {
      fileId,
      filename: file.filename,
      feedbackId: file.feedback_id,
      traceId
    });

    return NextResponse.json(
      success(
        {
          deletedFile: {
            id: file.id,
            filename: file.filename,
            originalName: file.original_name,
            feedbackId: file.feedback_id,
            deletedAt: new Date().toISOString()
          }
        },
        '파일이 성공적으로 삭제되었습니다.',
        traceId
      ),
      { status: 200 }
    );

  } catch (error: any) {
    const traceId = getTraceId(request);
    logger.error(LogCategory.API, 'Feedback file delete request failed', error, {
      traceId,
      errorMessage: error.message
    });

    if (error instanceof ServiceConfigError) {
      return NextResponse.json(
        failure(
          'SERVICE_UNAVAILABLE',
          '데이터베이스 서비스를 사용할 수 없습니다.',
          503,
          undefined,
          traceId
        ),
        { status: 503 }
      );
    }

    return NextResponse.json(
      failure(
        'DELETE_ERROR',
        `파일 삭제 중 오류가 발생했습니다: ${error.message}`,
        500,
        undefined,
        traceId
      ),
      { status: 500 }
    );
  } finally {
    logger.clearContext();
  }
}

/**
 * 파일 크기를 읽기 쉬운 형태로 변환
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}