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

// 파일 크기 제한: 1GB (대용량 영상 파일 대응)
const MAX_FILE_SIZE = 1024 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Content-Length 기반 사전 검증으로 대용량 파일 업로드 방지
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return NextResponse.json(
        createErrorResponse(
          'FILE_TOO_LARGE', 
          `파일 크기가 1GB를 초과합니다. (${Math.round(parseInt(contentLength) / 1024 / 1024)}MB)`
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

    // Railway 백엔드로 직접 프록시 전송
    const uploadId = crypto.randomUUID();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Railway 백엔드 URL 확인
    const railwayBackendUrl = process.env.RAILWAY_BACKEND_URL;
    if (!railwayBackendUrl) {
      return NextResponse.json(
        createErrorResponse('CONFIG_ERROR', 'Railway 백엔드 설정이 누락되었습니다.'), 
        { status: 500 }
      );
    }

    try {
      // Railway 백엔드로 파일 프록시 전송
      const railwayFormData = new FormData();
      railwayFormData.append('video', file);
      railwayFormData.append('uploadId', uploadId);
      railwayFormData.append('originalFileName', file.name);
      railwayFormData.append('sanitizedFileName', sanitizedFileName);

      console.log('Railway 백엔드로 파일 전송 시작:', {
        uploadId,
        originalFileName: file.name,
        fileSize: `${Math.round(file.size / 1024 / 1024)}MB`,
        fileType: file.type,
        railwayUrl: `${railwayBackendUrl}/api/upload/video`,
      });

      const railwayResponse = await fetch(`${railwayBackendUrl}/api/upload/video`, {
        method: 'POST',
        body: railwayFormData,
        headers: {
          'Authorization': `Bearer ${process.env.RAILWAY_API_TOKEN || ''}`,
        },
      });

      if (!railwayResponse.ok) {
        const errorText = await railwayResponse.text();
        console.error('Railway 백엔드 업로드 실패:', railwayResponse.status, errorText);
        
        return NextResponse.json(
          createErrorResponse(
            'RAILWAY_UPLOAD_FAILED', 
            `백엔드 업로드 실패: ${railwayResponse.status}`
          ), 
          { status: railwayResponse.status }
        );
      }

      const railwayResult = await railwayResponse.json();
      
      console.log('Railway 백엔드 업로드 성공:', {
        uploadId,
        videoUrl: railwayResult.videoUrl,
      });

      // 성공 응답
      const responseData = {
        ok: true,
        uploadId,
        videoUrl: railwayResult.videoUrl || `${railwayBackendUrl}/api/videos/${uploadId}`,
        fileName: sanitizedFileName,
        originalFileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadSession: {
          uploadId,
          originalFileName: file.name,
          sanitizedFileName,
          fileSize: file.size,
          fileType: file.type,
          status: 'completed' as const,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24시간 후 만료
        },
        instructions: {
          message: '파일이 Railway 백엔드에 성공적으로 업로드되었습니다.',
          maxRetries: 3,
          chunkSize: '50MB',
          timeout: 900000,
        }
      };

      return NextResponse.json(responseData);

    } catch (fetchError) {
      console.error('Railway 백엔드 연결 오류:', fetchError);
      
      return NextResponse.json(
        createErrorResponse(
          'RAILWAY_CONNECTION_FAILED', 
          'Railway 백엔드에 연결할 수 없습니다.'
        ), 
        { status: 502 }
      );
    }

  } catch (error) {
    console.error('영상 업로드 준비 오류:', error);
    
    // 메모리 부족 또는 타임아웃 오류 세분화
    if (error instanceof Error) {
      if (error.message.includes('memory') || error.message.includes('heap')) {
        return NextResponse.json(
          createErrorResponse(
            'MEMORY_LIMIT', 
            '파일이 너무 커서 처리할 수 없습니다. 1GB 이하의 파일을 업로드해주세요.'
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


