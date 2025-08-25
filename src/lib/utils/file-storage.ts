import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// 파일 저장 설정
const STORAGE_CONFIG = {
  // 로컬 저장 경로
  LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH || './public/uploads',
  
  // 허용된 파일 확장자
  ALLOWED_EXTENSIONS: {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    video: ['.mp4', '.avi', '.mov', '.webm', '.mkv'],
    audio: ['.mp3', '.wav', '.ogg', '.aac']
  },
  
  // 최대 파일 크기 (바이트)
  MAX_FILE_SIZE: {
    image: 10 * 1024 * 1024, // 10MB
    video: 100 * 1024 * 1024, // 100MB
    audio: 50 * 1024 * 1024 // 50MB
  }
};

// 파일 타입 감지
export const detectFileType = (url: string): 'image' | 'video' | 'audio' | 'unknown' => {
  const extension = path.extname(url).toLowerCase();
  
  if (STORAGE_CONFIG.ALLOWED_EXTENSIONS.image.includes(extension)) {
    return 'image';
  } else if (STORAGE_CONFIG.ALLOWED_EXTENSIONS.video.includes(extension)) {
    return 'video';
  } else if (STORAGE_CONFIG.ALLOWED_EXTENSIONS.audio.includes(extension)) {
    return 'audio';
  }
  
  return 'unknown';
};

// 파일명 생성
export const generateFileName = (originalUrl: string, prefix: string = ''): string => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const extension = path.extname(originalUrl);
  const fileName = `${prefix}${timestamp}-${randomId}${extension}`;
  
  return fileName;
};

// 디렉토리 생성 (재귀적)
export const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
};

// URL에서 파일 다운로드
export const downloadFile = async (url: string): Promise<Buffer> => {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(60000) // 60초 타임아웃
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    throw new Error(`파일 다운로드 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 로컬 파일 시스템에 저장
export const saveFileLocally = async (
  fileBuffer: Buffer,
  fileName: string,
  subDirectory: string = ''
): Promise<string> => {
  try {
    // 저장 경로 생성
    const storagePath = path.join(STORAGE_CONFIG.LOCAL_STORAGE_PATH, subDirectory);
    await ensureDirectoryExists(storagePath);
    
    // 파일 저장
    const filePath = path.join(storagePath, fileName);
    await writeFile(filePath, fileBuffer);
    
    // 상대 경로 반환 (public 폴더 기준)
    const relativePath = path.relative('./public', filePath);
    return `/${relativePath.replace(/\\/g, '/')}`;
    
  } catch (error) {
    throw new Error(`로컬 파일 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 파일 정보 추출
export const extractFileInfo = (url: string, savedPath: string) => {
  const fileType = detectFileType(url);
  const fileName = path.basename(savedPath);
  const fileSize = fs.statSync(path.join('./public', savedPath)).size;
  
  return {
    originalUrl: url,
    savedPath,
    fileName,
    fileType,
    fileSize,
    savedAt: new Date().toISOString(),
    mimeType: getMimeType(fileType, path.extname(url))
  };
};

// MIME 타입 가져오기
const getMimeType = (fileType: string, extension: string): string => {
  const mimeTypes: Record<string, Record<string, string>> = {
    image: {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    },
    video: {
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska'
    },
    audio: {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.aac': 'audio/aac'
    }
  };
  
  return mimeTypes[fileType]?.[extension] || 'application/octet-stream';
};

// 파일 저장 메인 함수
export const saveFileFromUrl = async (
  url: string,
  prefix: string = '',
  subDirectory: string = ''
): Promise<{
  success: boolean;
  fileInfo?: any;
  error?: string;
}> => {
  try {
    // 파일 타입 확인
    const fileType = detectFileType(url);
    if (fileType === 'unknown') {
      return {
        success: false,
        error: '지원되지 않는 파일 형식입니다.'
      };
    }
    
    // 파일 다운로드
    const fileBuffer = await downloadFile(url);
    
    // 파일 크기 확인
    if (fileBuffer.length > STORAGE_CONFIG.MAX_FILE_SIZE[fileType as keyof typeof STORAGE_CONFIG.MAX_FILE_SIZE]) {
      return {
        success: false,
        error: `파일 크기가 너무 큽니다. 최대 ${STORAGE_CONFIG.MAX_FILE_SIZE[fileType as keyof typeof STORAGE_CONFIG.MAX_FILE_SIZE] / (1024 * 1024)}MB까지 지원됩니다.`
      };
    }
    
    // 파일명 생성
    const fileName = generateFileName(url, prefix);
    
    // 로컬에 저장
    const savedPath = await saveFileLocally(fileBuffer, fileName, subDirectory);
    
    // 파일 정보 추출
    const fileInfo = extractFileInfo(url, savedPath);
    
    return {
      success: true,
      fileInfo
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// 여러 파일 일괄 저장
export const saveMultipleFiles = async (
  urls: string[],
  prefix: string = '',
  subDirectory: string = ''
): Promise<{
  success: boolean;
  results: Array<{
    url: string;
    success: boolean;
    fileInfo?: any;
    error?: string;
  }>;
}> => {
  const results = [];
  
  for (const url of urls) {
    const result = await saveFileFromUrl(url, prefix, subDirectory);
    results.push({
      url,
      success: result.success,
      fileInfo: result.fileInfo,
      error: result.error
    });
  }
  
  const allSuccess = results.every(result => result.success);
  
  return {
    success: allSuccess,
    results
  };
};
