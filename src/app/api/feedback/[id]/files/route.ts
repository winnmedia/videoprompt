import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { logger } from '@/shared/lib/logger';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 응답 스키마 검증
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

const FeedbackFilesResponseSchema = z.array(FeedbackFileSchema);

type FeedbackFile = z.infer<typeof FeedbackFileSchema>;

/**
 * 피드백 ID에 연결된 모든 파일 조회
 */
async function getFeedbackFiles(feedbackId: string, traceId: string): Promise<FeedbackFile[]> {
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
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('DATABASE: Failed to fetch feedback files', error, {
        feedbackId,
        traceId
      });
      throw new Error(`피드백 파일 조회 실패: ${error.message}`);
    }

    // 응답 스키마 검증
    const validatedData = FeedbackFilesResponseSchema.parse(data || []);

    logger.info('DATABASE: Feedback files fetched successfully', {
      feedbackId,
      filesCount: validatedData.length,
      traceId
    });

    return validatedData;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('DATABASE: Invalid feedback files data structure', error, {
        feedbackId,
        traceId
      });
      throw new Error('피드백 파일 데이터 구조가 올바르지 않습니다.');
    }

    logger.error('DATABASE: Get feedback files failed', error as Error, {
      feedbackId,
      traceId
    });
    throw error;
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

/**
 * 파일 카테고리별 아이콘 매핑
 */
function getFileIcon(category: string): string {
  const iconMap: Record<string, string> = {
    video: '🎥',
    image: '🖼️',
    document: '📄'
  };
  return iconMap[category] || '📎';
}

// GET: 피드백 ID에 연결된 모든 파일 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: feedbackId } = await params;
    const traceId = getTraceId(request);

    logger.setContext({
      requestId: traceId,
      endpoint: `/api/feedback/${feedbackId}/files`,
      method: 'GET',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    logger.info('API: Feedback files fetch request started', {
      feedbackId,
      traceId
    });

    // 피드백 ID 검증
    if (!feedbackId || feedbackId.trim().length === 0) {
      logger.warn('API: Invalid feedback ID provided', {
        feedbackId,
        traceId
      });

      return NextResponse.json(
        failure(
          'INVALID_FEEDBACK_ID',
          '유효한 피드백 ID가 필요합니다.',
          400,
          undefined,
          traceId
        ),
        { status: 400 }
      );
    }

    // 피드백 파일 조회
    const files = await getFeedbackFiles(feedbackId, traceId);

    // 응답 데이터 변환 및 확장
    const enrichedFiles = files.map(file => ({
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
      icon: getFileIcon(file.file_category),
      uploadStatus: file.upload_status,
      uploadedBy: file.uploaded_by,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
      isDownloadable: file.upload_status === 'completed',
      downloadUrl: file.upload_status === 'completed' ? file.public_url : null
    }));

    // 카테고리별 통계
    const stats = {
      total: files.length,
      byCategory: {
        video: files.filter(f => f.file_category === 'video').length,
        image: files.filter(f => f.file_category === 'image').length,
        document: files.filter(f => f.file_category === 'document').length
      },
      totalSize: files.reduce((sum, f) => sum + f.file_size, 0),
      totalSizeFormatted: formatFileSize(files.reduce((sum, f) => sum + f.file_size, 0))
    };

    logger.info('API: Feedback files fetched successfully', {
      feedbackId,
      filesCount: files.length,
      stats,
      traceId
    });

    return NextResponse.json(
      success(
        {
          feedbackId,
          files: enrichedFiles,
          stats,
          pagination: {
            total: files.length,
            page: 1,
            limit: 100 // 현재는 페이지네이션 없이 모든 파일 반환
          }
        },
        '피드백 파일 목록을 성공적으로 조회했습니다.',
        traceId
      ),
      { status: 200 }
    );

  } catch (error: any) {
    const traceId = getTraceId(request);
    logger.error('API: Feedback files fetch request failed', error, {
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
        `피드백 파일 조회 중 오류가 발생했습니다: ${error.message}`,
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

// POST: 피드백에 여러 파일을 한 번에 업로드 (배치 업로드)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: feedbackId } = await params;
    const traceId = getTraceId(request);

    logger.setContext({
      requestId: traceId,
      endpoint: `/api/feedback/${feedbackId}/files`,
      method: 'POST',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    logger.info('API: Batch feedback files upload request started', {
      feedbackId,
      traceId
    });

    // 피드백 ID 검증
    if (!feedbackId || feedbackId.trim().length === 0) {
      return NextResponse.json(
        failure(
          'INVALID_FEEDBACK_ID',
          '유효한 피드백 ID가 필요합니다.',
          400,
          undefined,
          traceId
        ),
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const userId = formData.get('userId') as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json(
        failure(
          'NO_FILES_PROVIDED',
          '업로드할 파일이 없습니다.',
          400,
          undefined,
          traceId
        ),
        { status: 400 }
      );
    }

    if (files.length > 10) { // 배치 업로드 제한
      return NextResponse.json(
        failure(
          'TOO_MANY_FILES',
          '한 번에 최대 10개 파일까지 업로드할 수 있습니다.',
          400,
          undefined,
          traceId
        ),
        { status: 400 }
      );
    }

    logger.info('API: Processing batch file upload', {
      feedbackId,
      filesCount: files.length,
      userId,
      traceId
    });

    // 각 파일을 개별 업로드 API로 전달하여 처리
    const uploadResults = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // 개별 파일 업로드 (내부 함수 호출로 중복 방지)
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('feedbackId', feedbackId);
        if (userId) uploadFormData.append('userId', userId);

        const uploadRequest = new Request(request.url.replace('/files', '/upload'), {
          method: 'POST',
          body: uploadFormData,
          headers: {
            'x-trace-id': traceId,
            'user-agent': request.headers.get('user-agent') || ''
          }
        });

        // 내부 업로드 API 호출
        const uploadResponse = await fetch(uploadRequest);
        const uploadData = await uploadResponse.json();

        if (uploadResponse.ok && uploadData.success) {
          uploadResults.push({
            index: i,
            filename: file.name,
            result: uploadData.data
          });
        } else {
          errors.push({
            index: i,
            filename: file.name,
            error: uploadData.message || '업로드 실패'
          });
        }
      } catch (uploadError: any) {
        errors.push({
          index: i,
          filename: file.name,
          error: uploadError.message || '알 수 없는 오류'
        });
      }
    }

    const successCount = uploadResults.length;
    const errorCount = errors.length;

    logger.info('API: Batch upload completed', {
      feedbackId,
      totalFiles: files.length,
      successCount,
      errorCount,
      traceId
    });

    // 부분 성공도 성공으로 처리
    if (successCount > 0) {
      return NextResponse.json(
        success(
          {
            feedbackId,
            uploaded: uploadResults,
            errors: errors,
            summary: {
              total: files.length,
              success: successCount,
              failed: errorCount
            }
          },
          `${successCount}개 파일이 성공적으로 업로드되었습니다.${errorCount > 0 ? ` (${errorCount}개 실패)` : ''}`,
          traceId
        ),
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        failure(
          'ALL_UPLOADS_FAILED',
          '모든 파일 업로드에 실패했습니다.',
          500,
          undefined,
          traceId
        ),
        { status: 500 }
      );
    }

  } catch (error: any) {
    const traceId = getTraceId(request);
    logger.error('API: Batch feedback files upload failed', error, {
      traceId,
      errorMessage: error.message
    });

    return NextResponse.json(
      failure(
        'BATCH_UPLOAD_ERROR',
        `배치 파일 업로드 중 오류가 발생했습니다: ${error.message}`,
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