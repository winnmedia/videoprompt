/**
 * 업로드 완료 확인 API
 * POST /api/upload/complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { formatFileSize } from '@/shared/lib/upload-utils';

interface UploadCompleteRequest {
  uploadId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  s3Key?: string;
  checksum?: string;
}

interface UploadCompleteResponse {
  success: boolean;
  fileUrl?: string;
  message?: string;
  error?: string;
  metadata?: {
    uploadId: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    status: 'completed' | 'failed';
  };
}

/**
 * S3 파일 존재 여부 확인 (모킹)
 * 실제 운영에서는 AWS SDK를 사용하여 구현
 */
async function verifyFileExists(s3Key: string): Promise<boolean> {
  // 실제 S3 구현:
  /*
  const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');

  const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: s3Key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
  */

  // 개발/테스트용 모킹 - 항상 true 반환
  await new Promise(resolve => setTimeout(resolve, 100)); // 네트워크 지연 시뮬레이션
  return true;
}

/**
 * 업로드 메타데이터를 데이터베이스에 저장
 */
async function saveUploadMetadata(uploadData: UploadCompleteRequest): Promise<void> {
  // 실제로는 Supabase나 다른 데이터베이스에 저장
  logger.debug('업로드 메타데이터 저장:', {
    uploadId: uploadData.uploadId,
    fileName: uploadData.fileName,
    fileSize: formatFileSize(uploadData.fileSize),
    fileType: uploadData.fileType,
  });

  // TODO: Supabase에 업로드 기록 저장
  /*
  const { data, error } = await supabase
    .from('file_uploads')
    .insert([
      {
        upload_id: uploadData.uploadId,
        file_name: uploadData.fileName,
        file_size: uploadData.fileSize,
        file_type: uploadData.fileType,
        s3_key: uploadData.s3Key,
        checksum: uploadData.checksum,
        status: 'completed',
        uploaded_at: new Date().toISOString(),
      }
    ]);

  if (error) {
    throw new Error(`DB 저장 실패: ${error.message}`);
  }
  */
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadCompleteResponse>> {
  try {
    // 요청 데이터 파싱
    const body: UploadCompleteRequest = await request.json();
    const { uploadId, fileName, fileSize, fileType, s3Key, checksum } = body;

    logger.debug('업로드 완료 확인 요청:', {
      uploadId,
      fileName,
      fileSize: formatFileSize(fileSize),
      fileType,
      s3Key,
      hasChecksum: !!checksum,
    });

    // 필수 데이터 검증
    if (!uploadId || !fileName || !fileSize || !fileType) {
      return NextResponse.json({
        success: false,
        error: '필수 데이터가 누락되었습니다.',
      }, { status: 400 });
    }

    // S3Key 생성 (전달되지 않은 경우)
    const finalS3Key = s3Key || `uploads/${Date.now()}_${fileName}`;

    // S3에서 파일 존재 여부 확인
    const fileExists = await verifyFileExists(finalS3Key);

    if (!fileExists) {
      logger.debug('❌ S3에서 파일을 찾을 수 없음:', { s3Key: finalS3Key });

      return NextResponse.json({
        success: false,
        error: '업로드된 파일을 확인할 수 없습니다.',
        metadata: {
          uploadId,
          fileName,
          fileSize,
          uploadedAt: new Date().toISOString(),
          status: 'failed' as const,
        },
      }, { status: 404 });
    }

    // 메타데이터 저장
    await saveUploadMetadata({
      uploadId,
      fileName,
      fileSize,
      fileType,
      s3Key: finalS3Key,
      checksum,
    });

    // 파일 URL 생성
    const fileUrl = `https://mock-s3-bucket.s3.amazonaws.com/${finalS3Key}`;

    logger.info('✅ 업로드 완료 확인 성공:', {
      uploadId,
      fileName,
      fileSize: formatFileSize(fileSize),
      fileUrl,
    });

    return NextResponse.json({
      success: true,
      fileUrl,
      message: '파일 업로드가 성공적으로 완료되었습니다.',
      metadata: {
        uploadId,
        fileName,
        fileSize,
        uploadedAt: new Date().toISOString(),
        status: 'completed' as const,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    logger.error('❌ 업로드 완료 확인 실패:', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json({
      success: false,
      error: '업로드 완료 확인에 실패했습니다.',
      message: errorMessage,
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Upload Complete API',
    endpoints: {
      'POST /api/upload/complete': '업로드 완료 확인 및 메타데이터 저장',
    },
    requiredFields: ['uploadId', 'fileName', 'fileSize', 'fileType'],
    optionalFields: ['s3Key', 'checksum'],
  });
}