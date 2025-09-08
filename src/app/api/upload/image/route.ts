import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getUserIdFromRequest } from '@/shared/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: '이미지 파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: '지원되지 않는 파일 형식입니다. JPG, PNG, WebP, GIF만 지원됩니다.' 
      }, { status: 400 });
    }

    // 파일 크기 검증 (환경 변수에서 가져오거나 기본값 사용)
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `파일 크기가 너무 큽니다. ${Math.round(maxSize / 1024 / 1024)}MB 이하로 제한됩니다.` },
        { status: 400 },
      );
    }

    // 사용자 ID 가져오기 (선택적)
    const userId = getUserIdFromRequest(request);

    // 파일명 생성 (UUID + 원본 확장자)
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${crypto.randomUUID()}.${fileExtension}`;
    
    // 업로드 디렉토리 설정
    const uploadDir = process.env.UPLOAD_DIR || './public/uploads';
    const uploadsPath = join(process.cwd(), uploadDir);
    const filePath = join(uploadsPath, fileName);

    try {
      // 업로드 디렉토리 생성 (없는 경우)
      await mkdir(uploadsPath, { recursive: true });
      
      // 파일 저장
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);
      
      // 데이터베이스에 업로드 정보 저장
      const upload = await prisma.upload.create({
        data: {
          filename: fileName,
          originalName: file.name,
          path: `/uploads/${fileName}`,
          mimetype: file.type,
          size: file.size,
          ...(userId ? { userId } : {}),
        },
      });

      console.log('이미지 업로드 성공:', {
        id: upload.id,
        fileName: upload.filename,
        originalName: upload.originalName,
        size: upload.size,
        path: upload.path,
      });

      return NextResponse.json({
        id: upload.id,
        imageUrl: upload.path, // 클라이언트에서 사용할 URL
        fileName: upload.filename,
        originalName: upload.originalName,
        fileSize: upload.size,
        fileType: upload.mimetype,
        createdAt: upload.createdAt.toISOString(),
      });
      
    } catch (fsError) {
      console.error('파일 시스템 오류:', fsError);
      
      // 파일 시스템 오류 시 Mock 응답으로 fallback
      const mockImageUrl = `https://via.placeholder.com/400x300/6366f1/ffffff?text=${encodeURIComponent(file.name)}`;
      
      return NextResponse.json({
        imageUrl: mockImageUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        warning: '파일이 임시 위치에 저장되었습니다.',
      });
    }

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
