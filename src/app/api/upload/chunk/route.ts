/**
 * 청크 업로드 API
 * POST /api/upload/chunk
 * 대용량 파일의 청크별 업로드를 지원
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { formatFileSize } from '@/shared/lib/upload-utils';

interface ChunkUploadRequest {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  fileName: string;
  fileType: string;
  chunkHash?: string;
}

interface ChunkUploadResponse {
  success: boolean;
  chunkIndex?: number;
  uploadedChunks?: number[];
  isComplete?: boolean;
  assemblyUrl?: string;
  error?: string;
  message?: string;
}

// 청크 업로드 세션 저장소 (실제로는 Redis나 DB 사용)
const uploadSessions = new Map<string, {
  uploadId: string;
  fileName: string;
  fileType: string;
  totalChunks: number;
  uploadedChunks: Set<number>;
  createdAt: Date;
  lastActivity: Date;
}>();

/**
 * 업로드 세션 정리 (만료된 세션 제거)
 */
function cleanupExpiredSessions(): void {
  const now = new Date();
  const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24시간

  for (const [uploadId, session] of uploadSessions.entries()) {
    if (now.getTime() - session.lastActivity.getTime() > EXPIRY_TIME) {
      uploadSessions.delete(uploadId);
      logger.debug('만료된 업로드 세션 정리:', { uploadId });
    }
  }
}

/**
 * S3 멀티파트 업로드 초기화 (모킹)
 */
async function initializeMultipartUpload(
  uploadId: string,
  fileName: string,
  fileType: string
): Promise<string> {
  // 실제 S3 구현:
  /*
  const { S3Client, CreateMultipartUploadCommand } = await import('@aws-sdk/client-s3');

  const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const command = new CreateMultipartUploadCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: `uploads/${uploadId}_${fileName}`,
    ContentType: fileType,
  });

  const response = await s3Client.send(command);
  return response.UploadId!;
  */

  // 개발/테스트용 모킹
  return `mock-multipart-${uploadId}`;
}

/**
 * S3 멀티파트 업로드 완료 (모킹)
 */
async function completeMultipartUpload(
  uploadId: string,
  s3UploadId: string,
  chunks: number[]
): Promise<string> {
  // 실제 S3 구현:
  /*
  const { S3Client, CompleteMultipartUploadCommand } = await import('@aws-sdk/client-s3');

  const parts = chunks.map((chunkIndex) => ({
    ETag: `"etag-${chunkIndex}"`, // 실제로는 각 파트의 ETag 사용
    PartNumber: chunkIndex + 1,
  }));

  const command = new CompleteMultipartUploadCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: `uploads/${uploadId}_${fileName}`,
    UploadId: s3UploadId,
    MultipartUpload: { Parts: parts },
  });

  const response = await s3Client.send(command);
  return response.Location!;
  */

  // 개발/테스트용 모킹
  return `https://mock-s3-bucket.s3.amazonaws.com/uploads/${uploadId}`;
}

export async function POST(request: NextRequest): Promise<NextResponse<ChunkUploadResponse>> {
  try {
    // 만료된 세션 정리
    cleanupExpiredSessions();

    // FormData에서 청크 데이터 파싱
    const formData = await request.formData();
    const chunkData = formData.get('chunk') as File;
    const metadata = formData.get('metadata') as string;

    if (!chunkData || !metadata) {
      return NextResponse.json({
        success: false,
        error: '청크 데이터 또는 메타데이터가 없습니다.',
      }, { status: 400 });
    }

    const chunkInfo: ChunkUploadRequest = JSON.parse(metadata);
    const { uploadId, chunkIndex, totalChunks, chunkSize, fileName, fileType, chunkHash } = chunkInfo;

    logger.debug('청크 업로드 요청:', {
      uploadId,
      chunkIndex,
      totalChunks,
      chunkSize: formatFileSize(chunkSize),
      fileName,
      fileType,
    });

    // 세션 확인 또는 생성
    let session = uploadSessions.get(uploadId);
    if (!session) {
      // 새 세션 생성
      session = {
        uploadId,
        fileName,
        fileType,
        totalChunks,
        uploadedChunks: new Set(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      uploadSessions.set(uploadId, session);

      // S3 멀티파트 업로드 초기화
      await initializeMultipartUpload(uploadId, fileName, fileType);

      logger.debug('새 업로드 세션 생성:', { uploadId, totalChunks });
    } else {
      session.lastActivity = new Date();
    }

    // 청크 중복 확인
    if (session.uploadedChunks.has(chunkIndex)) {
      logger.debug('이미 업로드된 청크:', { uploadId, chunkIndex });

      return NextResponse.json({
        success: true,
        chunkIndex,
        uploadedChunks: Array.from(session.uploadedChunks),
        isComplete: session.uploadedChunks.size === totalChunks,
        message: '이미 업로드된 청크입니다.',
      });
    }

    // 청크 해시 검증 (선택사항)
    if (chunkHash) {
      const chunkBuffer = await chunkData.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', chunkBuffer);
      const calculatedHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (calculatedHash !== chunkHash) {
        logger.debug('청크 해시 불일치:', { uploadId, chunkIndex, expected: chunkHash, calculated: calculatedHash });

        return NextResponse.json({
          success: false,
          error: '청크 데이터가 손상되었습니다.',
        }, { status: 400 });
      }
    }

    // 실제 S3 청크 업로드는 여기서 수행
    // 지금은 성공으로 간주
    session.uploadedChunks.add(chunkIndex);

    const isComplete = session.uploadedChunks.size === totalChunks;

    logger.debug('청크 업로드 성공:', {
      uploadId,
      chunkIndex,
      uploadedCount: session.uploadedChunks.size,
      totalChunks,
      isComplete,
    });

    // 모든 청크가 업로드되면 멀티파트 업로드 완료
    let assemblyUrl: string | undefined;
    if (isComplete) {
      const sortedChunks = Array.from(session.uploadedChunks).sort((a, b) => a - b);
      assemblyUrl = await completeMultipartUpload(
        uploadId,
        `mock-multipart-${uploadId}`,
        sortedChunks
      );

      // 세션 정리
      uploadSessions.delete(uploadId);

      logger.info('✅ 멀티파트 업로드 완료:', {
        uploadId,
        fileName,
        totalChunks,
        assemblyUrl,
      });
    }

    return NextResponse.json({
      success: true,
      chunkIndex,
      uploadedChunks: Array.from(session.uploadedChunks),
      isComplete,
      assemblyUrl,
      message: isComplete
        ? '모든 청크 업로드 완료'
        : `청크 ${chunkIndex + 1}/${totalChunks} 업로드 완료`,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    logger.error('❌ 청크 업로드 실패:', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json({
      success: false,
      error: '청크 업로드에 실패했습니다.',
      message: errorMessage,
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');

  if (uploadId) {
    // 특정 업로드 세션 상태 조회
    const session = uploadSessions.get(uploadId);

    if (!session) {
      return NextResponse.json({
        error: '업로드 세션을 찾을 수 없습니다.',
      }, { status: 404 });
    }

    return NextResponse.json({
      uploadId: session.uploadId,
      fileName: session.fileName,
      totalChunks: session.totalChunks,
      uploadedChunks: Array.from(session.uploadedChunks),
      progress: Math.round((session.uploadedChunks.size / session.totalChunks) * 100),
      isComplete: session.uploadedChunks.size === session.totalChunks,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    });
  }

  // 전체 세션 통계
  return NextResponse.json({
    message: 'Chunk Upload API',
    endpoints: {
      'POST /api/upload/chunk': '청크 업로드',
      'GET /api/upload/chunk?uploadId=xxx': '업로드 진행상황 조회',
    },
    activeSessions: uploadSessions.size,
    totalSessions: Array.from(uploadSessions.values()).length,
  });
}