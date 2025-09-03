import { NextRequest, NextResponse } from 'next/server';

// 간단한 영상 업로드 Mock 라우트
// - form-data 필드명: "video"
// - 타입 검사: video/*
// - 용량 제한: 200MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'VIDEO_MISSING', message: '영상 파일이 필요합니다.' }, { status: 400 });
    }

    if (!file.type || !file.type.startsWith('video/')) {
      return NextResponse.json({ ok: false, error: 'INVALID_TYPE', message: '유효한 영상 파일이 아닙니다.' }, { status: 400 });
    }

    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
      return NextResponse.json({ ok: false, error: 'FILE_TOO_LARGE', message: '파일 크기가 200MB를 초과합니다.' }, { status: 413 });
    }

    // 실제 환경에서는 클라우드 스토리지로 업로드 후 URL 반환
    // 현재는 파일명을 포함한 Mock URL 반환
    const mockVideoUrl = `https://example.com/videos/${encodeURIComponent(file.name)}`;

    console.log('영상 업로드:', { name: file.name, type: file.type, size: file.size, url: mockVideoUrl });

    return NextResponse.json({ ok: true, videoUrl: mockVideoUrl, fileName: file.name, fileSize: file.size, fileType: file.type });
  } catch (error) {
    console.error('영상 업로드 오류:', error);
    return NextResponse.json({ ok: false, error: 'UPLOAD_FAILED', message: '영상 업로드 중 오류가 발생했습니다.' }, { status: 500 });
  }
}


