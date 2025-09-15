import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { supabase } from '@/lib/supabase';
import { logger, LogCategory } from '@/shared/lib/structured-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB (Supabase 기본 제한)
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'];
const SUPABASE_BUCKET = 'videos'; // Supabase Storage 버킷명

/**
 * Supabase Storage로 비디오 파일 업로드
 * 기존 하이브리드 시스템을 Supabase Storage 단일 시스템으로 전환
 */
async function uploadToSupabaseStorage(
  file: File,
  slot: string | null,
  traceId: string
): Promise<{
  url: string;
  path: string;
  metadata: any;
}> {
  const fileExtension = file.name.split('.').pop() || 'mp4';
  const fileName = `${randomUUID()}.${fileExtension}`;

  // 폴더 구조: videos/{year}/{month}/{filename}
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const filePath = `${year}/${month}/${fileName}`;

  logger.debug(LogCategory.API, 'Uploading to Supabase Storage', {
    fileName,
    filePath,
    fileSize: file.size,
    fileType: file.type,
    slot,
    traceId
  });

  try {
    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        cacheControl: '3600', // 1시간 캐시
        upsert: false // 같은 이름이면 실패하도록 설정
      });

    if (error) {
      logger.error(LogCategory.DATABASE, 'Supabase Storage upload failed', error, {
        filePath,
        fileName,
        fileSize: file.size,
        traceId
      });
      throw new Error(`Supabase Storage 업로드 실패: ${error.message}`);
    }

    // 공개 URL 생성
    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(filePath);

    if (!publicUrlData.publicUrl) {
      throw new Error('Supabase Storage 공개 URL 생성 실패');
    }

    logger.info(LogCategory.DATABASE, 'Supabase Storage upload successful', {
      filePath: data.path,
      publicUrl: publicUrlData.publicUrl,
      fileSize: file.size,
      traceId
    });

    return {
      url: publicUrlData.publicUrl,
      path: data.path,
      metadata: {
        originalName: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        processedBy: 'supabase-storage',
        bucket: SUPABASE_BUCKET,
        slot: slot || null
      }
    };
  } catch (uploadError: any) {
    logger.error(LogCategory.DATABASE, 'File upload to Supabase failed', uploadError, {
      fileName,
      filePath,
      traceId
    });
    throw new Error(`파일 업로드 실패: ${uploadError.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const traceId = getTraceId(request);

    // 로깅 컨텍스트 설정
    logger.setContext({
      requestId: traceId,
      endpoint: '/api/upload/video',
      method: 'POST',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    logger.info(LogCategory.API, 'Video upload request started (Supabase)', {
      traceId,
    });

    // Rate Limiting
    const rateLimitResult = checkRateLimit(request, 'upload', RATE_LIMITS.upload);
    if (!rateLimitResult.allowed) {
      logger.warn(LogCategory.API, 'Rate limit exceeded for upload', {
        ip: request.headers.get('x-forwarded-for') || '127.0.0.1',
        retryAfter: rateLimitResult.retryAfter,
        traceId
      });

      const response = NextResponse.json(
        failure(
          'RATE_LIMIT_EXCEEDED',
          '업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          429,
          `retryAfter: ${rateLimitResult.retryAfter}`,
          traceId
        ),
        { status: 429 }
      );

      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    const formData = await request.formData();
    const file = formData.get('video') as File;
    const slot = formData.get('slot') as string | null;

    if (!file) {
      logger.warn(LogCategory.API, 'Missing video file in upload request', { traceId });
      return NextResponse.json(
        failure('MISSING_FILE', '업로드할 비디오 파일이 필요합니다.', 400, undefined, traceId),
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      logger.warn(LogCategory.API, 'Invalid file type', {
        fileType: file.type,
        allowedTypes: ALLOWED_TYPES,
        traceId
      });

      return NextResponse.json(
        failure(
          'INVALID_FILE_TYPE',
          `지원되지 않는 파일 형식입니다. 지원 형식: ${ALLOWED_TYPES.join(', ')}`,
          415,
          undefined,
          traceId
        ),
        { status: 415 }
      );
    }

    // 파일 크기 검증
    if (file.size > SUPABASE_FILE_SIZE_LIMIT) {
      logger.warn(LogCategory.API, 'File too large', {
        fileSize: file.size,
        limit: SUPABASE_FILE_SIZE_LIMIT,
        fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
        traceId
      });

      return NextResponse.json(
        failure(
          'FILE_TOO_LARGE',
          `파일 크기가 너무 큽니다. 최대 ${SUPABASE_FILE_SIZE_LIMIT / (1024 * 1024)}MB까지 업로드 가능합니다.`,
          413,
          undefined,
          traceId
        ),
        { status: 413 }
      );
    }

    logger.info(LogCategory.API, 'File validation passed, starting upload', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
      fileType: file.type,
      slot,
      traceId
    });

    // Supabase Storage로 업로드
    try {
      const uploadResult = await uploadToSupabaseStorage(file, slot, traceId);

      logger.info(LogCategory.API, 'Video upload completed successfully', {
        url: uploadResult.url,
        path: uploadResult.path,
        fileSize: file.size,
        traceId
      });

      // 성공 응답
      return NextResponse.json(
        success({
          ok: true,
          videoUrl: uploadResult.url,
          storagePath: uploadResult.path,
          slot,
          uploadMethod: 'supabase-storage',
          metadata: uploadResult.metadata
        }, 201, traceId)
      );
    } catch (uploadError: any) {
      logger.error(LogCategory.API, 'Supabase upload failed', uploadError, {
        fileName: file.name,
        fileSize: file.size,
        traceId
      });

      return NextResponse.json(
        failure(
          'SUPABASE_UPLOAD_ERROR',
          `Supabase Storage 업로드 실패: ${uploadError.message}`,
          502,
          undefined,
          traceId
        ),
        { status: 502 }
      );
    }

  } catch (error: any) {
    const traceId = getTraceId(request);
    logger.error(LogCategory.API, 'Video upload request failed', error, {
      traceId,
      errorMessage: error.message
    });

    // 에러 타입별 처리
    if (error.code === 'LIMIT_FILE_SIZE') {
      return NextResponse.json(
        failure('FILE_TOO_LARGE', '파일 크기 제한을 초과했습니다.', 413, undefined, traceId),
        { status: 413 }
      );
    }

    if (error.message?.includes('FormData')) {
      return NextResponse.json(
        failure('INVALID_REQUEST', '올바르지 않은 요청 형식입니다.', 400, undefined, traceId),
        { status: 400 }
      );
    }

    return NextResponse.json(
      failure(
        'UPLOAD_ERROR',
        `비디오 업로드 중 오류가 발생했습니다: ${error.message}`,
        500,
        undefined,
        traceId
      ),
      { status: 500 }
    );
  } finally {
    // 컨텍스트 정리
    logger.clearContext();
  }
}

// GET 요청으로 업로드 상태 확인
export async function GET() {
  try {
    // Supabase Storage 상태 확인
    const { data: buckets, error } = await supabase.storage.listBuckets();

    const isStorageAvailable = !error && buckets?.some(bucket => bucket.name === SUPABASE_BUCKET);

    return NextResponse.json({
      service: 'Video Upload (Supabase Storage)',
      status: isStorageAvailable ? 'operational' : 'degraded',
      capabilities: {
        storage: {
          provider: 'Supabase Storage',
          bucket: SUPABASE_BUCKET,
          maxSize: `${SUPABASE_FILE_SIZE_LIMIT / (1024 * 1024)}MB`,
          features: ['Public URLs', 'CDN', 'Automatic optimization']
        }
      },
      allowedTypes: ALLOWED_TYPES,
      architecture: {
        type: 'Supabase Storage Direct Upload',
        description: '모든 파일을 Supabase Storage에 직접 업로드',
        advantages: [
          'Built-in CDN',
          'Automatic file optimization',
          'Scalable storage',
          'Global edge distribution'
        ]
      },
      storageHealth: {
        bucketsAvailable: buckets?.length || 0,
        targetBucket: SUPABASE_BUCKET,
        targetBucketExists: isStorageAvailable
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      service: 'Video Upload (Supabase Storage)',
      status: 'error',
      error: error.message
    }, { status: 503 });
  }
}