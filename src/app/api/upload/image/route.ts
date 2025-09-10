import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getUserIdFromRequest } from '@/shared/lib/auth';
import { 
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse 
} from '@/shared/schemas/api.schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 이미지 파일 검증 스키마
const ImageFileSchema = z.object({
  file: z.object({
    name: z.string().min(1, '파일명이 필요합니다'),
    size: z.number()
      .int()
      .min(1, '파일 크기가 0보다 커야 합니다')
      .max(10 * 1024 * 1024, '파일 크기가 10MB를 초과할 수 없습니다'),
    type: z.string().refine(
      (type) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type),
      '지원되지 않는 파일 형식입니다. JPG, PNG, WebP, GIF만 지원됩니다'
    ),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get('image');

    // File 타입 검증 (타입 캐스팅 제거)
    if (!fileEntry || typeof fileEntry === 'string') {
      return NextResponse.json(
        createErrorResponse('IMAGE_MISSING', '이미지 파일이 제공되지 않았습니다'),
        { status: 400 }
      );
    }

    const file = fileEntry as File;

    // Zod를 사용한 파일 검증
    const fileValidation = ImageFileSchema.safeParse({ file });
    
    if (!fileValidation.success) {
      return NextResponse.json(
        createValidationErrorResponse(fileValidation.error),
        { status: 400 }
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

      const responseData = {
        id: upload.id,
        imageUrl: upload.path, // 클라이언트에서 사용할 URL
        fileName: upload.filename,
        originalName: upload.originalName,
        fileSize: upload.size,
        fileType: upload.mimetype,
        createdAt: upload.createdAt.toISOString(),
      };

      return NextResponse.json(createSuccessResponse(responseData, '이미지가 성공적으로 업로드되었습니다'));
      
    } catch (fsError) {
      console.error('파일 시스템 오류:', fsError);
      
      // 파일 시스템 오류 시 적절한 에러 응답 반환
      return NextResponse.json(
        {
          error: 'FILE_STORAGE_ERROR',
          message: '이미지 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
          details: fsError instanceof Error ? fsError.message : 'Unknown storage error'
        },
        { status: 500 }
      );
        warning: '파일이 임시 위치에 저장되었습니다.',
      });
    }

  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    return NextResponse.json(
      createErrorResponse('UPLOAD_ERROR', '이미지 업로드 중 오류가 발생했습니다'),
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: '이미지 업로드 API입니다. POST 요청으로 이미지를 전송해주세요.' },
    { status: 200 },
  );
}
