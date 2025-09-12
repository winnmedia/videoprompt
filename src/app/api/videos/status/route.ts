import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 메모리 기반 영상 저장소 (실제로는 데이터베이스 사용)
const videoStore: Map<string, any> = new Map();

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

// 영상 상태 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const videoId = searchParams.get('videoId');

    if (jobId) {
      // Seedance 작업 ID로 상태 조회
      try {
        const railwayBackend = 'https://videoprompt-production.up.railway.app';
        const res = await fetch(`${railwayBackend}/api/seedance/status/${jobId}`);

        if (res.ok) {
          const data = await res.json();
          return NextResponse.json(
            {
              ok: true,
              jobId,
              ...data,
            },
            { headers: corsHeaders },
          );
        }
      } catch (error) {
        console.error('Seedance status check failed:', error);
      }
    }

    if (videoId) {
      // 로컬 영상 ID로 상태 조회
      const video = videoStore.get(videoId);
      if (video) {
        return NextResponse.json(
          {
            ok: true,
            video,
          },
          { headers: corsHeaders },
        );
      }
    }

    // 모든 영상 목록 반환
    const videos = Array.from(videoStore.values());
    return NextResponse.json(
      {
        ok: true,
        videos,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('Video status API error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message,
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}

// 영상 상태 업데이트
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoId, status, videoUrl, thumbnailUrl, completedAt, error } = body;

    if (!videoId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'VIDEO_ID_REQUIRED',
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    // 기존 영상 정보 가져오기
    const existingVideo = videoStore.get(videoId) || {};

    // 상태 업데이트
    const updatedVideo = {
      ...existingVideo,
      id: videoId,
      status: status || existingVideo.status,
      videoUrl: videoUrl || existingVideo.videoUrl,
      thumbnailUrl: thumbnailUrl || existingVideo.thumbnailUrl,
      completedAt: completedAt || existingVideo.completedAt,
      error: error || existingVideo.error,
      updatedAt: new Date().toISOString(),
    };

    // 저장
    videoStore.set(videoId, updatedVideo);

    return NextResponse.json(
      {
        ok: true,
        video: updatedVideo,
        message: '영상 상태가 업데이트되었습니다.',
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('Video status update error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message,
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}

// 영상 정보 저장
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, prompt, provider, duration, aspectRatio, status = 'queued', jobId } = body;

    if (!id || !title || !prompt || !provider) {
      return NextResponse.json(
        {
          ok: false,
          error: 'MISSING_REQUIRED_FIELDS',
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const video = {
      id,
      title,
      prompt,
      provider,
      duration: duration || 5,
      aspectRatio: aspectRatio || '16:9',
      status,
      jobId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 저장
    videoStore.set(id, video);

    return NextResponse.json(
      {
        ok: true,
        video,
        message: '영상 정보가 저장되었습니다.',
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('Video save error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message,
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
