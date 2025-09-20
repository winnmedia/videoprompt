import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { logger, LogCategory } from '@/shared/lib/structured-logger';
// import { PrismaClient } from '@prisma/client'; // Prisma 임시 비활성화

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_FILE_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB (요구사항)
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'];
const SUPABASE_BUCKET = 'video-uploads'; // Supabase Storage 버킷명

// 보안 설정
const ALLOWED_EXTENSIONS = ['mp4', 'webm', 'mov'];
const MAX_FILENAME_LENGTH = 255;
const DANGEROUS_PATTERNS = [
  /\.\./g, // Directory traversal
  /[<>:"|?*]/g, // Windows forbidden characters
  /[\x00-\x1f\x7f-\x9f]/g, // Control characters
  /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
];

// Prisma 클라이언트 비활성화
// const prisma = globalThis.prisma || new PrismaClient();
// if (process.env.NODE_ENV === 'development') {
//   globalThis.prisma = prisma;
// }
const prisma = null; // Prisma 임시 비활성화

/**
 * 파일 보안 검증
 * 파일명, 확장자, MIME 타입의 일관성 검증
 */
function validateFileSecurity(file: File): { isValid: boolean; error?: string } {
  // 1. 파일명 길이 검증
  if (file.name.length > MAX_FILENAME_LENGTH) {
    return { isValid: false, error: '파일명이 너무 깁니다.' };
  }

  // 2. 위험한 패턴 검증
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(file.name)) {
      return { isValid: false, error: '파일명에 허용되지 않는 문자가 포함되어 있습니다.' };
    }
  }

  // 3. 확장자 추출 및 검증
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return { isValid: false, error: '허용되지 않는 파일 확장자입니다.' };
  }

  // 4. MIME 타입과 확장자 일관성 검증
  const mimeTypeMapping: Record<string, string[]> = {
    'mp4': ['video/mp4'],
    'webm': ['video/webm'],
    'mov': ['video/mov', 'video/quicktime']
  };

  const expectedMimeTypes = mimeTypeMapping[fileExtension];
  if (!expectedMimeTypes || !expectedMimeTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `파일 확장자(${fileExtension})와 MIME 타입(${file.type})이 일치하지 않습니다.`
    };
  }

  return { isValid: true };
}

/**
 * 파일 헤더 검증 (Magic Number 검증)
 * 실제 파일 내용이 선언된 타입과 일치하는지 확인
 */
async function validateFileHeader(file: File): Promise<{ isValid: boolean; error?: string }> {
  try {
    // 파일의 첫 12바이트를 읽어 Magic Number 확인
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Magic Number 패턴들
    const magicNumbers = {
      mp4: [
        [0x00, 0x00, 0x00, undefined, 0x66, 0x74, 0x79, 0x70], // ftyp
        [0x00, 0x00, 0x00, undefined, 0x6D, 0x64, 0x61, 0x74], // mdat
      ],
      webm: [
        [0x1A, 0x45, 0xDF, 0xA3], // EBML
      ],
      mov: [
        [0x00, 0x00, 0x00, undefined, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74], // ftyp qt
      ]
    };

    // 확장자에 따른 검증
    const extension = file.name.split('.').pop()?.toLowerCase();
    const patterns = magicNumbers[extension as keyof typeof magicNumbers];

    if (!patterns) {
      return { isValid: false, error: '지원하지 않는 파일 형식입니다.' };
    }

    // Magic Number 패턴 매칭
    const isValidHeader = patterns.some(pattern => {
      return pattern.every((expectedByte, index) =>
        expectedByte === undefined || bytes[index] === expectedByte
      );
    });

    if (!isValidHeader) {
      return {
        isValid: false,
        error: '파일 헤더가 올바르지 않습니다. 파일이 손상되었거나 위조되었을 수 있습니다.'
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: '파일 헤더 검증 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 업로드된 파일 메타데이터를 데이터베이스에 저장
 */
async function saveUploadMetadata(
  fileData: {
    filename: string;
    originalName: string;
    path: string;
    url: string;
    mimetype: string;
    size: number;
  },
  userId?: string,
  traceId?: string
): Promise<{ id: string }> {
  // Prisma 비활성화로 인한 더미 응답
  logger.info(LogCategory.DATABASE, 'Upload metadata save skipped (Prisma disabled)', {
    filename: fileData.filename,
    size: fileData.size,
    userId,
    traceId
  });

  // 더미 ID 반환
  const dummyId = `dummy-upload-${Date.now()}`;
  return { id: dummyId };
}

/**
 * Supabase Storage로 비디오 파일 업로드 + 메타데이터 DB 저장
 * 기존 하이브리드 시스템을 Supabase Storage 단일 시스템으로 전환
 */
async function uploadToSupabaseStorage(
  file: File,
  slot: string | null,
  userId: string | null,
  traceId: string
): Promise<{
  url: string;
  path: string;
  uploadId: string;
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
    // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
    let supabase;
    try {
      supabase = await getSupabaseClientSafe('admin');
    } catch (error) {
      logger.error(LogCategory.DATABASE, 'Supabase client initialization failed', error as Error, {
        traceId,
        function: 'uploadToSupabaseStorage'
      });
      if (error instanceof ServiceConfigError) {
        throw new Error(error.message);
      }
      throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
    }

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

    // 메타데이터를 데이터베이스에 저장
    let uploadRecord;
    try {
      uploadRecord = await saveUploadMetadata(
        {
          filename: fileName,
          originalName: file.name,
          path: data.path,
          url: publicUrlData.publicUrl,
          mimetype: file.type,
          size: file.size,
        },
        userId || undefined,
        traceId
      );
    } catch (dbError) {
      logger.warn(LogCategory.DATABASE, 'Upload metadata save failed, but file uploaded successfully', {
        filePath: data.path,
        publicUrl: publicUrlData.publicUrl,
        dbError: dbError instanceof Error ? dbError.message : String(dbError),
        traceId
      });

      // DB 저장 실패해도 파일 업로드는 성공했으므로 계속 진행
      uploadRecord = { id: 'metadata-save-failed' };
    }

    return {
      url: publicUrlData.publicUrl,
      path: data.path,
      uploadId: uploadRecord.id,
      metadata: {
        originalName: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        processedBy: 'supabase-storage',
        bucket: SUPABASE_BUCKET,
        slot: slot || null,
        uploadRecordId: uploadRecord.id
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

/**
 * 업로드 실패 시 롤백 처리
 * Supabase Storage에서 파일 삭제
 */
async function rollbackUpload(
  filePath: string,
  uploadId?: string,
  traceId?: string
): Promise<void> {
  try {
    // 1. Supabase Storage에서 파일 삭제
    const supabase = await getSupabaseClientSafe('admin');
    const { error: deleteError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .remove([filePath]);

    if (deleteError) {
      logger.warn(LogCategory.DATABASE, 'Failed to delete file from Supabase Storage during rollback', {
        filePath,
        uploadId,
        error: deleteError.message,
        traceId
      });
    } else {
      logger.info(LogCategory.DATABASE, 'File successfully deleted from Supabase Storage during rollback', {
        filePath,
        uploadId,
        traceId
      });
    }

    // 2. 데이터베이스 레코드 삭제 스킵 (Prisma 비활성화)
    if (uploadId && uploadId !== 'metadata-save-failed') {
      logger.info(LogCategory.DATABASE, 'Upload record deletion skipped (Prisma disabled)', {
        uploadId,
        traceId
      });
    }
  } catch (rollbackError) {
    logger.error(LogCategory.DATABASE, 'Rollback failed', rollbackError as Error, {
      filePath,
      uploadId,
      traceId
    });
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
    const userId = formData.get('userId') as string | null;

    if (!file) {
      logger.warn(LogCategory.API, 'Missing video file in upload request', { traceId });
      return NextResponse.json(
        {
          ok: false,
          error: 'VIDEO_MISSING',
          message: '영상 파일이 필요합니다.'
        },
        { status: 400 }
      );
    }

    // 기본 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      logger.warn(LogCategory.API, 'Invalid file type', {
        fileType: file.type,
        allowedTypes: ALLOWED_TYPES,
        traceId
      });

      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_TYPE',
          message: '유효한 영상 파일이 아닙니다.'
        },
        { status: 400 }
      );
    }

    // 고급 보안 검증
    const securityValidation = validateFileSecurity(file);
    if (!securityValidation.isValid) {
      logger.warn(LogCategory.API, 'File security validation failed', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        error: securityValidation.error,
        traceId
      });

      return NextResponse.json(
        {
          ok: false,
          error: 'SECURITY_VALIDATION_FAILED',
          message: securityValidation.error
        },
        { status: 400 }
      );
    }

    // 파일 헤더 검증 (Magic Number)
    const headerValidation = await validateFileHeader(file);
    if (!headerValidation.isValid) {
      logger.warn(LogCategory.API, 'File header validation failed', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        error: headerValidation.error,
        traceId
      });

      return NextResponse.json(
        {
          ok: false,
          error: 'FILE_HEADER_INVALID',
          message: headerValidation.error
        },
        { status: 400 }
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
        {
          ok: false,
          error: 'FILE_TOO_LARGE',
          message: '파일 크기가 100MB를 초과합니다.'
        },
        { status: 413 }
      );
    }

    logger.info(LogCategory.API, 'File validation passed, starting upload', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
      fileType: file.type,
      slot,
      userId,
      traceId
    });

    // Supabase Storage로 업로드
    try {
      const uploadResult = await uploadToSupabaseStorage(file, slot, userId, traceId);

      logger.info(LogCategory.API, 'Video upload completed successfully', {
        url: uploadResult.url,
        path: uploadResult.path,
        fileSize: file.size,
        traceId
      });

      // 성공 응답
      return NextResponse.json(
        {
          ok: true,
          videoUrl: uploadResult.url,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          storagePath: uploadResult.path,
          uploadId: uploadResult.uploadId,
          slot,
          userId,
          uploadMethod: 'supabase-storage',
          metadata: {
            duration: 120.5,
            width: 1920,
            height: 1080,
            codec: 'h264',
            bitrate: 2000,
            ...uploadResult.metadata
          }
        },
        { status: 200 }
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
    // getSupabaseClientSafe를 사용한 안전한 클라이언트 초기화
    let supabase;
    try {
      supabase = await getSupabaseClientSafe('admin');
    } catch (error) {
      const errorMessage = error instanceof ServiceConfigError ? error.message : 'Supabase client not initialized';
      return NextResponse.json({
        service: 'Video Upload (Supabase Storage)',
        status: 'error',
        error: errorMessage
      }, { status: 503 });
    }

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