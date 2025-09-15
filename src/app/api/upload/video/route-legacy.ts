import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';
import { success, failure, getTraceId } from '@/shared/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERCEL_FILE_SIZE_LIMIT = 4 * 1024 * 1024; // 4MB (Vercel 제한)
const RAILWAY_FILE_SIZE_LIMIT = 600 * 1024 * 1024; // 600MB (Railway 백엔드 제한)
const RAILWAY_BACKEND_URL = 'https://videoprompt-production.up.railway.app';
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'];

// Railway 백엔드로 대용량 파일 업로드를 프록시하는 함수
async function proxyToRailway(file: File, slot: string, token: string, traceId: string) {
  const formData = new FormData();
  formData.append('video', file);
  if (slot) formData.append('slot', slot);
  if (token) formData.append('token', token);

  try {
    const response = await fetch(`${RAILWAY_BACKEND_URL}/api/upload/video`, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Trace-ID': traceId,
        'X-Proxy-Source': 'vercel'
      },
      // 대용량 파일을 위한 타임아웃 설정 (10분)
      signal: AbortSignal.timeout(10 * 60 * 1000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Railway 업로드 실패: ${response.status} - ${errorData.message || response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('업로드 시간이 초과되었습니다. 파일 크기를 확인하고 다시 시도해주세요.');
    }
    throw new Error(`Railway 백엔드 연결 실패: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const traceId = getTraceId(request);

    // Rate Limiting
    const rateLimitResult = checkRateLimit(request, 'upload', RATE_LIMITS.upload);
    if (!rateLimitResult.allowed) {
      console.warn(`🚫 Rate limit exceeded for upload from IP: ${request.headers.get('x-forwarded-for') || '127.0.0.1'}`);

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
    const slot = formData.get('slot') as string;
    const token = formData.get('token') as string;

    if (!file) {
      return NextResponse.json(
        failure('MISSING_FILE', '업로드할 비디오 파일이 필요합니다.', 400, undefined, traceId),
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
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

    // 파일 크기 검증 - Railway 백엔드 한계 확인
    if (file.size > RAILWAY_FILE_SIZE_LIMIT) {
      return NextResponse.json(
        failure(
          'FILE_TOO_LARGE',
          `파일 크기가 너무 큽니다. 최대 ${RAILWAY_FILE_SIZE_LIMIT / (1024 * 1024)}MB까지 업로드 가능합니다.`,
          413,
          undefined,
          traceId
        ),
        { status: 413 }
      );
    }

    // 파일 크기에 따른 처리 방법 결정
    if (file.size > VERCEL_FILE_SIZE_LIMIT) {
      // 대용량 파일: Railway 백엔드로 프록시
      console.log(`📤 대용량 파일 (${(file.size / (1024 * 1024)).toFixed(2)}MB) Railway로 프록시 중...`);

      try {
        const railwayResponse = await proxyToRailway(file, slot, token, traceId);

        return NextResponse.json(
          success({
            ok: true,
            ...railwayResponse,
            uploadMethod: 'railway-proxy',
            metadata: {
              originalName: file.name,
              size: file.size,
              type: file.type,
              uploadedAt: new Date().toISOString(),
              processedBy: 'railway-backend'
            }
          }, 201, traceId)
        );
      } catch (railwayError: any) {
        console.error('Railway 프록시 실패:', railwayError);
        return NextResponse.json(
          failure(
            'RAILWAY_PROXY_ERROR',
            `대용량 파일 업로드 실패: ${railwayError.message}`,
            502,
            undefined,
            traceId
          ),
          { status: 502 }
        );
      }
    }

    // 소용량 파일: 로컬 Vercel에서 처리 (기존 로직)
    console.log(`📁 소용량 파일 (${(file.size / (1024 * 1024)).toFixed(2)}MB) 로컬 처리 중...`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileExtension = file.name.split('.').pop() || 'mp4';
    const fileName = `${randomUUID()}.${fileExtension}`;

    // 임시 저장소 경로 (프로덕션에서는 /tmp 사용)
    const uploadPath = join(process.cwd(), 'public', 'uploads', fileName);

    try {
      // 디렉토리가 없으면 생성하지 않고 에러 처리
      await writeFile(uploadPath, buffer);
    } catch (writeError) {
      console.error('파일 저장 실패:', writeError);
      return NextResponse.json(
        failure(
          'STORAGE_ERROR',
          '파일 저장에 실패했습니다. 서버 설정을 확인해주세요.',
          503,
          undefined,
          traceId
        ),
        { status: 503 }
      );
    }

    // 성공 응답
    const videoUrl = `/uploads/${fileName}`;

    return NextResponse.json(
      success({
        ok: true,
        videoUrl,
        slot,
        uploadMethod: 'vercel-local',
        metadata: {
          originalName: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          processedBy: 'vercel-frontend'
        }
      }, 201, traceId)
    );

  } catch (error: any) {
    const traceId = getTraceId(request);
    console.error('비디오 업로드 오류:', error);

    // 에러 타입별 처리
    if (error.code === 'LIMIT_FILE_SIZE') {
      return NextResponse.json(
        failure('FILE_TOO_LARGE', '파일 크기 제한을 초과했습니다.', 413, undefined, traceId),
        { status: 413 }
      );
    }

    if (error.code === 'ENOENT') {
      return NextResponse.json(
        failure('DIRECTORY_ERROR', '업로드 디렉토리를 찾을 수 없습니다.', 503, undefined, traceId),
        { status: 503 }
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
  }
}

// GET 요청으로 업로드 상태 확인
export async function GET() {
  return NextResponse.json({
    service: 'Video Upload (Hybrid)',
    status: 'operational',
    capabilities: {
      smallFiles: {
        maxSize: `${VERCEL_FILE_SIZE_LIMIT / (1024 * 1024)}MB`,
        handler: 'Vercel Frontend (빠른 처리)',
        storage: 'Local temporary storage'
      },
      largeFiles: {
        maxSize: `${RAILWAY_FILE_SIZE_LIMIT / (1024 * 1024)}MB`,
        handler: 'Railway Backend (대용량 처리)',
        storage: 'Railway backend storage'
      }
    },
    allowedTypes: ALLOWED_TYPES,
    architecture: {
      type: 'Hybrid Proxy System',
      description: '파일 크기에 따라 최적의 처리 방법 자동 선택',
      railwayBackend: RAILWAY_BACKEND_URL,
      timeout: '10 minutes for large files'
    }
  });
}