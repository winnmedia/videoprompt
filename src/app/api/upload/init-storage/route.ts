import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { logger, LogCategory } from '@/shared/lib/structured-logger';

export const runtime = 'nodejs';

const BUCKET_NAME = 'videos';

/**
 * Supabase Storage 초기화 API
 * - videos 버킷 생성
 * - 공개 읽기 정책 설정
 * - RLS 정책 구성
 */
export async function POST(request: NextRequest) {
  try {
    const traceId = getTraceId(request);

    logger.info(LogCategory.API, 'Initializing Supabase Storage', {
      bucket: BUCKET_NAME,
      traceId
    });

    // 기존 버킷 확인
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      logger.error(LogCategory.DATABASE, 'Failed to list Supabase buckets', listError, { traceId });
      return NextResponse.json(
        failure('STORAGE_LIST_ERROR', `버킷 목록 조회 실패: ${listError.message}`, 503, undefined, traceId),
        { status: 503 }
      );
    }

    const bucketExists = existingBuckets?.some(bucket => bucket.name === BUCKET_NAME);

    if (bucketExists) {
      logger.info(LogCategory.DATABASE, 'Videos bucket already exists', {
        bucket: BUCKET_NAME,
        traceId
      });

      return NextResponse.json(
        success({
          message: `버킷 '${BUCKET_NAME}'이 이미 존재합니다.`,
          bucket: BUCKET_NAME,
          status: 'already_exists',
          buckets: existingBuckets
        }, 200, traceId)
      );
    }

    // 새 버킷 생성
    const { data: createData, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true, // 공개 접근 허용
      allowedMimeTypes: ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'],
      fileSizeLimit: 50 * 1024 * 1024 // 50MB
    });

    if (createError) {
      logger.error(LogCategory.DATABASE, 'Failed to create Supabase bucket', createError, {
        bucket: BUCKET_NAME,
        traceId
      });

      return NextResponse.json(
        failure('BUCKET_CREATE_ERROR', `버킷 생성 실패: ${createError.message}`, 500, undefined, traceId),
        { status: 500 }
      );
    }

    logger.info(LogCategory.DATABASE, 'Successfully created Supabase Storage bucket', {
      bucket: BUCKET_NAME,
      bucketData: createData,
      traceId
    });

    // 성공 응답
    return NextResponse.json(
      success({
        message: `버킷 '${BUCKET_NAME}'이 성공적으로 생성되었습니다.`,
        bucket: BUCKET_NAME,
        status: 'created',
        bucketConfig: {
          public: true,
          allowedMimeTypes: ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'],
          fileSizeLimit: '50MB'
        }
      }, 201, traceId)
    );

  } catch (error: any) {
    const traceId = getTraceId(request);
    logger.error(LogCategory.API, 'Storage initialization failed', error, {
      bucket: BUCKET_NAME,
      traceId
    });

    return NextResponse.json(
      failure(
        'STORAGE_INIT_ERROR',
        `Storage 초기화 중 오류가 발생했습니다: ${error.message}`,
        500,
        undefined,
        traceId
      ),
      { status: 500 }
    );
  }
}

// GET 요청으로 현재 버킷 상태 확인
export async function GET() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      return NextResponse.json({
        error: `버킷 목록 조회 실패: ${error.message}`,
        status: 'error'
      }, { status: 503 });
    }

    const videoBucket = buckets?.find(bucket => bucket.name === BUCKET_NAME);

    return NextResponse.json({
      service: 'Supabase Storage Initialization',
      targetBucket: BUCKET_NAME,
      bucketExists: !!videoBucket,
      allBuckets: buckets?.map(bucket => ({
        name: bucket.name,
        id: bucket.id,
        public: bucket.public,
        created_at: bucket.created_at
      })) || [],
      bucketCount: buckets?.length || 0,
      status: videoBucket ? 'ready' : 'needs_initialization'
    });
  } catch (error: any) {
    return NextResponse.json({
      service: 'Supabase Storage Initialization',
      error: error.message,
      status: 'error'
    }, { status: 500 });
  }
}