import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: '이미지 파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '유효한 이미지 파일이 아닙니다.' }, { status: 400 });
    }

    // 파일 크기 검증 (10MB 제한)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '파일 크기가 너무 큽니다. 10MB 이하로 제한됩니다.' },
        { status: 400 },
      );
    }

    // 실제 프로덕션에서는 여기서 파일을 클라우드 스토리지에 업로드
    // 현재는 Mock 응답으로 처리
    const mockImageUrl = `https://via.placeholder.com/400x300/6366f1/ffffff?text=${encodeURIComponent(file.name)}`;

    // 파일 정보 로깅
    console.log('이미지 업로드:', {
      name: file.name,
      type: file.type,
      size: file.size,
      url: mockImageUrl,
    });

    return NextResponse.json({
      imageUrl: mockImageUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    return NextResponse.json({ error: '이미지 업로드 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { message: '이미지 업로드 API입니다. POST 요청으로 이미지를 전송해주세요.' },
    { status: 200 },
  );
}
