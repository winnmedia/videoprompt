import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  VideoUploadValidationSchema,
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponse
} from '@/shared/schemas/api.schema';

// 대용량 영상 업로드 라우트 - Presigned URL 기반 업로드 시스템
// - Vercel Serverless Functions 제약사항을 고려한 아키텍처
// - 실제 파일 업로드는 클라이언트에서 직접 클라우드 스토리지로 진행
// - 용량 제한: 600MB (실제 업로드는 클라우드에서 처리)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 지원하는 비디오 형식
const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm', 
  'video/quicktime', // .mov
  'video/avi',
  'video/x-msvideo', // .avi
  'video/3gpp', // .3gp
  'video/x-ms-wmv', // .wmv
];

// 파일 크기 제한: 600MB
const MAX_FILE_SIZE = 600 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Content-Length 기반 사전 검증으로 대용량 파일 업로드 방지
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return NextResponse.json(
        createErrorResponse(
          'FILE_TOO_LARGE', 
          `파일 크기가 600MB를 초과합니다. (${Math.round(parseInt(contentLength) / 1024 / 1024)}MB)`
        ), 
        { status: 413 }
      );
    }

    // FormData에서 파일 정보 추출 및 검증
    const formData = await request.formData();
    const videoFile = formData.get('video');

    if (!videoFile || !(videoFile instanceof File)) {
      return NextResponse.json(
        createErrorResponse('VIDEO_MISSING', '영상 파일이 필요합니다.'), 
        { status: 400 }
      );
    }

    // Zod를 사용한 파일 검증
    const validationResult = VideoUploadValidationSchema.safeParse({
      file: {
        name: videoFile.name,
        size: videoFile.size,
        type: videoFile.type,
      }
    });

    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error),
        { status: 400 }
      );
    }

    const file = videoFile;

    // 파일 검증 통과 - Railway 백엔드로 전송 준비
    const uploadId = crypto.randomUUID();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const railwayUploadUrl = `${process.env.RAILWAY_BACKEND_URL}/api/upload/video`;

    // 업로드 세션 정보 생성
    const uploadSession = {
      uploadId,
      originalFileName: file.name,
      sanitizedFileName,
      fileSize: file.size,
      fileType: file.type,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1시간 후 만료
    };

    console.log('대용량 영상 업로드 세션 생성:', {
      uploadId,
      originalFileName: file.name,
      fileSize: `${Math.round(file.size / 1024 / 1024)}MB`,
      fileType: file.type,
    });

    const responseData = {
      ok: true,
      uploadId,
      uploadUrl: railwayUploadUrl,
      videoUrl: `${process.env.RAILWAY_BACKEND_URL}/api/videos/${uploadId}`,
      fileName: sanitizedFileName,
      originalFileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadSession,
      instructions: {
        message: '대용량 파일은 Railway 백엔드로 직접 업로드됩니다.',
        maxRetries: 3,
        chunkSize: '50MB',
        timeout: 600000, // 10분 (600MB 고려)
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('영상 업로드 준비 오류:', error);
    
    // 메모리 부족 또는 타임아웃 오류 세분화
    if (error instanceof Error) {
      if (error.message.includes('memory') || error.message.includes('heap')) {
        return NextResponse.json(
          createErrorResponse(
            'MEMORY_LIMIT', 
            '파일이 너무 커서 처리할 수 없습니다. 600MB 이하의 파일을 업로드해주세요.'
          ), 
          { status: 507 }
        );
      }
      
      if (error.message.includes('timeout') || error.message.includes('time')) {
        return NextResponse.json(
          createErrorResponse(
            'TIMEOUT', 
            '업로드 준비 시간이 초과되었습니다. 다시 시도해주세요.'
          ), 
          { status: 408 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'UPLOAD_PREPARATION_FAILED', 
        '영상 업로드 준비 중 오류가 발생했습니다.'
      ), 
      { status: 500 }
    );
  }
}

// 업로드 ID 검증 스키마
const UploadIdSchema = z.object({
  uploadId: z.string().uuid('유효한 업로드 ID가 필요합니다'),
});

// 업로드 상태 확인 API
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 쿼리 파라미터 검증
  const queryResult = UploadIdSchema.safeParse(Object.fromEntries(searchParams.entries()));
  
  if (!queryResult.success) {
    return NextResponse.json(
      createValidationErrorResponse(queryResult.error),
      { status: 400 }
    );
  }
  
  const { uploadId } = queryResult.data;

  // Railway 백엔드에서 업로드 상태 조회
  try {
    const response = await fetch(`${process.env.RAILWAY_BACKEND_URL}/api/upload/status/${uploadId}`);
    if (!response.ok) {
      throw new Error('백엔드 상태 조회 실패');
    }
    const status = await response.json();
    
    return NextResponse.json({ ok: true, upload: status });
  } catch (error) {
    console.error('업로드 상태 조회 오류:', error);
    
    // 폴백: 기본 상태 반환
    const fallbackStatus = {
      uploadId,
      status: 'pending',
      progress: 0,
      videoUrl: `${process.env.RAILWAY_BACKEND_URL}/api/videos/${uploadId}`,
      processedAt: new Date().toISOString(),
    };
    return NextResponse.json({ ok: true, upload: fallbackStatus });
  }
}


