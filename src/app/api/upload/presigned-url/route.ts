/**
 * S3 Presigned URL 생성 API
 * POST /api/upload/presigned-url
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { sanitizeFileName, isValidVideoFile, isFileSizeValid, formatFileSize } from '@/shared/lib/upload-utils';

// S3 관련 타입 정의 (실제 AWS SDK 사용 시 적절히 수정)
interface PresignedUrlRequest {
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadId?: string;
}

interface PresignedUrlResponse {
  success: boolean;
  uploadUrl?: string;
  downloadUrl?: string;
  uploadId?: string;
  expiresIn?: number;
  error?: string;
  message?: string;
}

// 지원되는 파일 타입
const SUPPORTED_FILE_TYPES = [
  // 비디오
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/avi',
  'video/x-msvideo',
  'video/3gpp',
  'video/x-ms-wmv',
  // 이미지
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // 문서
  'application/pdf',
  'text/plain',
  'application/json',
];

const MAX_FILE_SIZE = 600 * 1024 * 1024; // 600MB
const URL_EXPIRY_SECONDS = 3600; // 1시간

/**
 * S3 Presigned URL 생성 함수 (모킹)
 * 실제 운영에서는 AWS SDK를 사용하여 구현
 */
async function generatePresignedUrl(
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<{ uploadUrl: string; downloadUrl: string; uploadId: string }> {
  const uploadId = crypto.randomUUID();
  const sanitizedName = sanitizeFileName(fileName);
  const timestamp = Date.now();
  const s3Key = `uploads/${timestamp}_${sanitizedName}`;

  // 실제 S3 구현에서는 다음과 같이 작성:
  /*
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: s3Key,
    ContentType: fileType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: URL_EXPIRY_SECONDS,
  });
  */

  // 개발/테스트용 모킹 URL
  const uploadUrl = `https://mock-s3-bucket.s3.amazonaws.com/${s3Key}?uploadId=${uploadId}&expires=${Date.now() + URL_EXPIRY_SECONDS * 1000}`;
  const downloadUrl = `https://mock-s3-bucket.s3.amazonaws.com/${s3Key}`;

  return {
    uploadUrl,
    downloadUrl,
    uploadId,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<PresignedUrlResponse>> {
  try {
    // 요청 데이터 파싱
    const body: PresignedUrlRequest = await request.json();
    const { fileName, fileSize, fileType, uploadId } = body;

    logger.debug('Presigned URL 요청:', {
      fileName,
      fileSize: formatFileSize(fileSize),
      fileType,
      uploadId,
    });

    // 유효성 검사
    if (!fileName || !fileSize || !fileType) {
      return NextResponse.json({
        success: false,
        error: '파일명, 크기, 타입이 모두 필요합니다.',
      }, { status: 400 });
    }

    // 파일 타입 검증
    if (!SUPPORTED_FILE_TYPES.includes(fileType)) {
      return NextResponse.json({
        success: false,
        error: `지원하지 않는 파일 형식입니다: ${fileType}`,
      }, { status: 400 });
    }

    // 파일 크기 검증
    if (!isFileSizeValid(fileSize)) {
      return NextResponse.json({
        success: false,
        error: `파일 크기가 제한을 초과했습니다. 최대 ${formatFileSize(MAX_FILE_SIZE)}까지 업로드 가능합니다.`,
      }, { status: 400 });
    }

    // 파일명 검증 (보안)
    const sanitizedName = sanitizeFileName(fileName);
    if (sanitizedName !== fileName) {
      logger.debug('파일명이 안전하게 변경됨:', { original: fileName, sanitized: sanitizedName });
    }

    // S3 Presigned URL 생성
    const { uploadUrl, downloadUrl, uploadId: generatedUploadId } = await generatePresignedUrl(
      sanitizedName,
      fileType,
      fileSize
    );

    logger.info('✅ Presigned URL 생성 성공:', {
      fileName: sanitizedName,
      fileSize: formatFileSize(fileSize),
      uploadId: generatedUploadId,
      expiresIn: URL_EXPIRY_SECONDS,
    });

    return NextResponse.json({
      success: true,
      uploadUrl,
      downloadUrl,
      uploadId: generatedUploadId,
      expiresIn: URL_EXPIRY_SECONDS,
      message: 'Presigned URL이 생성되었습니다.',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    logger.error('❌ Presigned URL 생성 실패:', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json({
      success: false,
      error: '파일 업로드 URL 생성에 실패했습니다.',
      message: errorMessage,
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Upload Presigned URL API',
    endpoints: {
      'POST /api/upload/presigned-url': 'S3 Presigned URL 생성',
    },
    supportedTypes: SUPPORTED_FILE_TYPES,
    maxFileSize: formatFileSize(MAX_FILE_SIZE),
    urlExpirySeconds: URL_EXPIRY_SECONDS,
  });
}