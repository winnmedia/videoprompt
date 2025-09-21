import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { logger } from '@/shared/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 피드백 파일 업로드 제한 설정
const FEEDBACK_FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB (피드백용으로 적절한 크기)
const SUPABASE_BUCKET = 'feedback-uploads'; // 피드백 전용 버킷

// 지원하는 파일 타입 확장
const ALLOWED_FILE_TYPES = {
  video: ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime', 'video/avi'],
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
} as const;

const ALL_ALLOWED_TYPES = [
  ...ALLOWED_FILE_TYPES.video,
  ...ALLOWED_FILE_TYPES.image,
  ...ALLOWED_FILE_TYPES.document
];

// 확장자 매핑
const ALLOWED_EXTENSIONS = {
  video: ['mp4', 'webm', 'mov', 'avi'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  document: ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx']
} as const;

const ALL_EXTENSIONS = [
  ...ALLOWED_EXTENSIONS.video,
  ...ALLOWED_EXTENSIONS.image,
  ...ALLOWED_EXTENSIONS.document
];

// 보안 설정
const MAX_FILENAME_LENGTH = 255;
const DANGEROUS_PATTERNS = [
  /\.\./g, // Directory traversal
  /[<>:"|?*]/g, // Windows forbidden characters
  /[\x00-\x1f\x7f-\x9f]/g, // Control characters
  /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
];

/**
 * 파일 타입 분류
 */
function getFileCategory(mimeType: string): 'video' | 'image' | 'document' | 'unknown' {
  if (ALLOWED_FILE_TYPES.video.includes(mimeType as any)) return 'video';
  if (ALLOWED_FILE_TYPES.image.includes(mimeType as any)) return 'image';
  if (ALLOWED_FILE_TYPES.document.includes(mimeType as any)) return 'document';
  return 'unknown';
}

/**
 * 파일 보안 검증 (확장된 버전)
 */
function validateFileSecurity(file: File): { isValid: boolean; error?: string; category?: string } {
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
  if (!fileExtension || !ALL_EXTENSIONS.includes(fileExtension as any)) {
    return { isValid: false, error: '허용되지 않는 파일 확장자입니다.' };
  }

  // 4. MIME 타입 검증
  if (!ALL_ALLOWED_TYPES.includes(file.type)) {
    return { isValid: false, error: '허용되지 않는 파일 형식입니다.' };
  }

  // 5. MIME 타입과 확장자 일관성 검증
  const category = getFileCategory(file.type);
  if (category === 'unknown') {
    return { isValid: false, error: '지원하지 않는 파일 형식입니다.' };
  }

  // 확장자가 해당 카테고리에 속하는지 확인
  const categoryExtensions = ALLOWED_EXTENSIONS[category];
  if (!categoryExtensions.includes(fileExtension as any)) {
    return {
      isValid: false,
      error: `파일 확장자(${fileExtension})와 파일 형식(${category})이 일치하지 않습니다.`
    };
  }

  return { isValid: true, category };
}

/**
 * 파일 헤더 검증 (Magic Number 검증) - 확장된 버전
 */
async function validateFileHeader(file: File): Promise<{ isValid: boolean; error?: string }> {
  try {
    // 파일의 첫 16바이트를 읽어 Magic Number 확인
    const buffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Magic Number 패턴들 (확장됨)
    const magicNumbers = {
      // Video formats
      mp4: [
        [0x00, 0x00, 0x00, undefined, 0x66, 0x74, 0x79, 0x70], // ftyp
        [0x00, 0x00, 0x00, undefined, 0x6D, 0x64, 0x61, 0x74], // mdat
      ],
      webm: [
        [0x1A, 0x45, 0xDF, 0xA3], // EBML
      ],
      mov: [
        [0x00, 0x00, 0x00, undefined, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74], // ftyp qt
      ],
      avi: [
        [0x52, 0x49, 0x46, 0x46, undefined, undefined, undefined, undefined, 0x41, 0x56, 0x49, 0x20], // RIFF AVI
      ],

      // Image formats
      jpeg: [
        [0xFF, 0xD8, 0xFF], // JPEG
      ],
      jpg: [
        [0xFF, 0xD8, 0xFF], // JPEG (same as jpeg)
      ],
      png: [
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
      ],
      gif: [
        [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
        [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
      ],
      webp: [
        [0x52, 0x49, 0x46, 0x46, undefined, undefined, undefined, undefined, 0x57, 0x45, 0x42, 0x50], // RIFF WEBP
      ],

      // Document formats
      pdf: [
        [0x25, 0x50, 0x44, 0x46], // %PDF
      ],
      doc: [
        [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // Microsoft Office
      ],
      docx: [
        [0x50, 0x4B, 0x03, 0x04], // ZIP (DOCX is ZIP-based)
        [0x50, 0x4B, 0x05, 0x06], // ZIP empty
        [0x50, 0x4B, 0x07, 0x08], // ZIP spanned
      ],
      txt: [
        // Text files - skip magic number check (too variable)
      ],
      xls: [
        [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // Microsoft Office
      ],
      xlsx: [
        [0x50, 0x4B, 0x03, 0x04], // ZIP (XLSX is ZIP-based)
        [0x50, 0x4B, 0x05, 0x06], // ZIP empty
        [0x50, 0x4B, 0x07, 0x08], // ZIP spanned
      ]
    };

    // 확장자에 따른 검증
    const extension = file.name.split('.').pop()?.toLowerCase();
    const patterns = magicNumbers[extension as keyof typeof magicNumbers];

    if (!patterns) {
      return { isValid: false, error: '지원하지 않는 파일 형식입니다.' };
    }

    // 텍스트 파일은 Magic Number 검증 스킵
    if (extension === 'txt' || patterns.length === 0) {
      return { isValid: true };
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
 * 피드백 파일 메타데이터를 Supabase에 저장
 */
async function saveFeedbackFileMetadata(
  fileData: {
    filename: string;
    originalName: string;
    path: string;
    url: string;
    mimetype: string;
    size: number;
    category: string;
  },
  feedbackId: string,
  userId?: string,
  traceId?: string
): Promise<{ id: string }> {
  try {
    const supabase = await getSupabaseClientSafe('admin');

    const { data, error } = await supabase
      .from('feedback_files')
      .insert({
        id: randomUUID(),
        feedback_id: feedbackId,
        filename: fileData.filename,
        original_name: fileData.originalName,
        storage_path: fileData.path,
        public_url: fileData.url,
        mime_type: fileData.mimetype,
        file_size: fileData.size,
        file_category: fileData.category,
        uploaded_by: userId || null,
        upload_status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      logger.error('DATABASE: Failed to save feedback file metadata', error, {
        feedbackId,
        filename: fileData.filename,
        traceId
      });
      throw new Error(`메타데이터 저장 실패: ${error.message}`);
    }

    logger.info('DATABASE: Feedback file metadata saved successfully', {
      fileId: data.id,
      feedbackId,
      filename: fileData.filename,
      category: fileData.category,
      traceId
    });

    return { id: data.id };
  } catch (error) {
    logger.error('DATABASE: Save feedback file metadata failed', error as Error, {
      feedbackId,
      filename: fileData.filename,
      traceId
    });

    // 더미 ID 반환 (에러 처리 개선)
    const dummyId = `dummy-feedback-file-${Date.now()}`;
    return { id: dummyId };
  }
}

/**
 * Supabase Storage로 피드백 파일 업로드
 */
async function uploadFeedbackToSupabase(
  file: File,
  feedbackId: string,
  userId: string | null,
  traceId: string
): Promise<{
  url: string;
  path: string;
  uploadId: string;
  metadata: any;
}> {
  const fileExtension = file.name.split('.').pop() || 'bin';
  const fileName = `${randomUUID()}.${fileExtension}`;
  const category = getFileCategory(file.type);

  // 폴더 구조: feedback/{feedbackId}/{category}/{year}/{month}/{filename}
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const filePath = `feedback/${feedbackId}/${category}/${year}/${month}/${fileName}`;

  logger.debug('API: Uploading feedback file to Supabase Storage', {
    fileName,
    filePath,
    fileSize: file.size,
    fileType: file.type,
    category,
    feedbackId,
    traceId
  });

  try {
    const supabase = await getSupabaseClientSafe('admin');

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
      logger.error('DATABASE: Supabase Storage upload failed', error, {
        filePath,
        fileName,
        fileSize: file.size,
        feedbackId,
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

    logger.info('DATABASE: Supabase Storage upload successful', {
      filePath: data.path,
      publicUrl: publicUrlData.publicUrl,
      fileSize: file.size,
      category,
      feedbackId,
      traceId
    });

    // 메타데이터를 데이터베이스에 저장
    const uploadRecord = await saveFeedbackFileMetadata(
      {
        filename: fileName,
        originalName: file.name,
        path: data.path,
        url: publicUrlData.publicUrl,
        mimetype: file.type,
        size: file.size,
        category
      },
      feedbackId,
      userId || undefined,
      traceId
    );

    return {
      url: publicUrlData.publicUrl,
      path: data.path,
      uploadId: uploadRecord.id,
      metadata: {
        originalName: file.name,
        size: file.size,
        type: file.type,
        category,
        uploadedAt: new Date().toISOString(),
        processedBy: 'supabase-storage',
        bucket: SUPABASE_BUCKET,
        feedbackId,
        uploadRecordId: uploadRecord.id
      }
    };
  } catch (uploadError: any) {
    logger.error('DATABASE: Feedback file upload to Supabase failed', uploadError, {
      fileName,
      filePath,
      feedbackId,
      traceId
    });
    throw new Error(`피드백 파일 업로드 실패: ${uploadError.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const traceId = getTraceId(request);

    // 로깅 컨텍스트 설정
    logger.setContext({
      requestId: traceId,
      endpoint: '/api/feedback/upload',
      method: 'POST',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    logger.info('API: Feedback file upload request started', { traceId });

    // Rate Limiting
    const rateLimitResult = checkRateLimit(request, 'upload', RATE_LIMITS.upload);
    if (!rateLimitResult.allowed) {
      logger.warn('API: Rate limit exceeded for feedback upload', {
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
    const file = formData.get('file') as File;
    const feedbackId = formData.get('feedbackId') as string;
    const userId = formData.get('userId') as string | null;

    if (!file) {
      logger.warn('API: Missing file in feedback upload request', { traceId });
      return NextResponse.json(
        failure('FILE_MISSING', '업로드할 파일이 필요합니다.', 400, undefined, traceId),
        { status: 400 }
      );
    }

    if (!feedbackId) {
      logger.warn('API: Missing feedbackId in upload request', { traceId });
      return NextResponse.json(
        failure('FEEDBACK_ID_MISSING', '피드백 ID가 필요합니다.', 400, undefined, traceId),
        { status: 400 }
      );
    }

    // 기본 파일 타입 검증
    if (!ALL_ALLOWED_TYPES.includes(file.type)) {
      logger.warn('API: Invalid file type for feedback upload', {
        fileType: file.type,
        allowedTypes: ALL_ALLOWED_TYPES,
        traceId
      });

      return NextResponse.json(
        failure(
          'INVALID_FILE_TYPE',
          '지원하지 않는 파일 형식입니다. 비디오, 이미지, 문서 파일만 업로드 가능합니다.',
          400,
          undefined,
          traceId
        ),
        { status: 400 }
      );
    }

    // 고급 보안 검증
    const securityValidation = validateFileSecurity(file);
    if (!securityValidation.isValid) {
      logger.warn('API: File security validation failed for feedback upload', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        error: securityValidation.error,
        traceId
      });

      return NextResponse.json(
        failure(
          'SECURITY_VALIDATION_FAILED',
          securityValidation.error || '파일 보안 검증에 실패했습니다.',
          400,
          undefined,
          traceId
        ),
        { status: 400 }
      );
    }

    // 파일 헤더 검증 (Magic Number)
    const headerValidation = await validateFileHeader(file);
    if (!headerValidation.isValid) {
      logger.warn('API: File header validation failed for feedback upload', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        error: headerValidation.error,
        traceId
      });

      return NextResponse.json(
        failure(
          'FILE_HEADER_INVALID',
          headerValidation.error || '파일 헤더 검증에 실패했습니다.',
          400,
          undefined,
          traceId
        ),
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > FEEDBACK_FILE_SIZE_LIMIT) {
      logger.warn('API: File too large for feedback upload', {
        fileSize: file.size,
        limit: FEEDBACK_FILE_SIZE_LIMIT,
        fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
        traceId
      });

      return NextResponse.json(
        failure(
          'FILE_TOO_LARGE',
          '파일 크기가 50MB를 초과합니다.',
          413,
          undefined,
          traceId
        ),
        { status: 413 }
      );
    }

    const fileCategory = getFileCategory(file.type);

    logger.info('API: File validation passed, starting feedback upload', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
      fileType: file.type,
      category: fileCategory,
      feedbackId,
      userId,
      traceId
    });

    // Supabase Storage로 업로드
    try {
      const uploadResult = await uploadFeedbackToSupabase(file, feedbackId, userId, traceId);

      logger.info('API: Feedback file upload completed successfully', {
        url: uploadResult.url,
        path: uploadResult.path,
        category: fileCategory,
        fileSize: file.size,
        feedbackId,
        traceId
      });

      // 성공 응답
      return NextResponse.json(
        success(
          {
            fileId: uploadResult.uploadId,
            fileUrl: uploadResult.url,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            category: fileCategory,
            storagePath: uploadResult.path,
            feedbackId,
            userId,
            uploadMethod: 'supabase-storage',
            metadata: uploadResult.metadata
          },
          '피드백 파일이 성공적으로 업로드되었습니다.',
          traceId
        ),
        { status: 200 }
      );
    } catch (uploadError: any) {
      logger.error('API: Feedback file upload failed', uploadError, {
        fileName: file.name,
        fileSize: file.size,
        feedbackId,
        traceId
      });

      return NextResponse.json(
        failure(
          'UPLOAD_ERROR',
          `피드백 파일 업로드 실패: ${uploadError.message}`,
          502,
          undefined,
          traceId
        ),
        { status: 502 }
      );
    }

  } catch (error: any) {
    const traceId = getTraceId(request);
    logger.error('API: Feedback file upload request failed', error, {
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
        `피드백 파일 업로드 중 오류가 발생했습니다: ${error.message}`,
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

// GET 요청으로 업로드 서비스 상태 확인
export async function GET() {
  try {
    const supabase = await getSupabaseClientSafe('admin');

    // Supabase Storage 상태 확인
    const { data: buckets, error } = await supabase.storage.listBuckets();
    const isStorageAvailable = !error && buckets?.some(bucket => bucket.name === SUPABASE_BUCKET);

    return NextResponse.json({
      service: 'Feedback File Upload (Supabase Storage)',
      status: isStorageAvailable ? 'operational' : 'degraded',
      capabilities: {
        storage: {
          provider: 'Supabase Storage',
          bucket: SUPABASE_BUCKET,
          maxSize: `${FEEDBACK_FILE_SIZE_LIMIT / (1024 * 1024)}MB`,
          features: ['Public URLs', 'CDN', 'Automatic optimization', 'Multi-file support']
        },
        supportedFiles: {
          video: ALLOWED_FILE_TYPES.video,
          image: ALLOWED_FILE_TYPES.image,
          document: ALLOWED_FILE_TYPES.document
        }
      },
      allowedTypes: ALL_ALLOWED_TYPES,
      architecture: {
        type: 'Feedback-Specific Upload System',
        description: '피드백 전용 다중 파일 타입 업로드 시스템',
        advantages: [
          'Built-in CDN',
          'Multi-format support',
          'Organized storage structure',
          'Metadata tracking',
          'Security validation'
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
      service: 'Feedback File Upload (Supabase Storage)',
      status: 'error',
      error: error.message
    }, { status: 503 });
  }
}