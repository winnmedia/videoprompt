'use client';

import React, { useCallback, useState, useRef } from 'react';
import { logger } from '@/shared/lib/logger';
import { Upload, X, File, Image, Video, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

// 파일 타입 정의
interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  url?: string;
  category?: 'video' | 'image' | 'document';
}

interface FileUploadDropzoneProps {
  feedbackId: string;
  userId?: string;
  onUploadComplete?: (files: UploadFile[]) => void;
  onUploadError?: (error: string) => void;
  maxFiles?: number;
  maxSizePerFile?: number; // bytes
  className?: string;
  disabled?: boolean;
}

const ACCEPTED_FILE_TYPES = {
  video: ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime', 'video/avi'],
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
};

const ALL_ACCEPTED_TYPES = [
  ...ACCEPTED_FILE_TYPES.video,
  ...ACCEPTED_FILE_TYPES.image,
  ...ACCEPTED_FILE_TYPES.document
];

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_MAX_FILES = 10;

/**
 * 파일 카테고리 분류
 */
function getFileCategory(mimeType: string): 'video' | 'image' | 'document' | 'unknown' {
  if (ACCEPTED_FILE_TYPES.video.includes(mimeType)) return 'video';
  if (ACCEPTED_FILE_TYPES.image.includes(mimeType)) return 'image';
  if (ACCEPTED_FILE_TYPES.document.includes(mimeType)) return 'document';
  return 'unknown';
}

/**
 * 파일 크기 포맷팅
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 파일 타입별 아이콘
 */
function getFileIcon(category: string) {
  switch (category) {
    case 'video':
      return <Video className="h-8 w-8 text-purple-600" />;
    case 'image':
      return <Image className="h-8 w-8 text-green-600" />;
    case 'document':
      return <FileText className="h-8 w-8 text-blue-600" />;
    default:
      return <File className="h-8 w-8 text-gray-600" />;
  }
}

export default function FileUploadDropzone({
  feedbackId,
  userId,
  onUploadComplete,
  onUploadError,
  maxFiles = DEFAULT_MAX_FILES,
  maxSizePerFile = DEFAULT_MAX_SIZE,
  className,
  disabled = false
}: FileUploadDropzoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 파일 검증
   */
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // 1. 파일 타입 검증
    if (!ALL_ACCEPTED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: '지원하지 않는 파일 형식입니다. 비디오, 이미지, 문서 파일만 업로드 가능합니다.'
      };
    }

    // 2. 파일 크기 검증
    if (file.size > maxSizePerFile) {
      return {
        valid: false,
        error: `파일 크기가 ${formatFileSize(maxSizePerFile)}를 초과합니다.`
      };
    }

    // 3. 파일명 길이 검증
    if (file.name.length > 255) {
      return {
        valid: false,
        error: '파일명이 너무 깁니다. (최대 255자)'
      };
    }

    // 4. 위험한 파일명 패턴 검증
    const dangerousPatterns = [/\.\./g, /[<>:"|?*]/g, /[\x00-\x1f\x7f-\x9f]/g];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(file.name)) {
        return {
          valid: false,
          error: '파일명에 허용되지 않는 문자가 포함되어 있습니다.'
        };
      }
    }

    return { valid: true };
  }, [maxSizePerFile]);

  /**
   * 파일 추가 처리
   */
  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: UploadFile[] = [];
    const errors: string[] = [];

    // 배열로 변환
    const filesArray = Array.from(fileList);

    // 최대 파일 수 검증
    if (files.length + filesArray.length > maxFiles) {
      errors.push(`최대 ${maxFiles}개 파일까지만 업로드할 수 있습니다.`);
      return;
    }

    for (const file of filesArray) {
      // 중복 파일 검사
      if (files.some(f => f.file.name === file.name && f.file.size === file.size)) {
        errors.push(`'${file.name}' 파일이 이미 추가되어 있습니다.`);
        continue;
      }

      // 파일 검증
      const validation = validateFile(file);
      if (!validation.valid) {
        errors.push(`'${file.name}': ${validation.error}`);
        continue;
      }

      // 유효한 파일 추가
      const uploadFile: UploadFile = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        progress: 0,
        status: 'pending',
        category: getFileCategory(file.type)
      };

      newFiles.push(uploadFile);
    }

    if (errors.length > 0) {
      onUploadError?.(errors.join('\n'));
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, [files, maxFiles, validateFile, onUploadError]);

  /**
   * 드래그 앤 드롭 이벤트 핸들러
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  }, [disabled, handleFiles]);

  /**
   * 파일 선택 핸들러
   */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFiles(selectedFiles);
    }
    // 같은 파일을 다시 선택할 수 있도록 value 초기화
    e.target.value = '';
  }, [handleFiles]);

  /**
   * 파일 제거
   */
  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  /**
   * 모든 파일 제거
   */
  const clearAllFiles = useCallback(() => {
    setFiles([]);
  }, []);

  /**
   * 개별 파일 업로드
   */
  const uploadFile = useCallback(async (uploadFile: UploadFile): Promise<void> => {
    const formData = new FormData();
    formData.append('file', uploadFile.file);
    formData.append('feedbackId', feedbackId);
    if (userId) formData.append('userId', userId);

    try {
      // 진행률 시뮬레이션 시작
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      // XMLHttpRequest를 사용해서 진행률 추적
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // 진행률 추적
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setFiles(prev => prev.map(f =>
              f.id === uploadFile.id
                ? { ...f, progress: percentComplete }
                : f
            ));
          }
        });

        // 완료 처리
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.success) {
                setFiles(prev => prev.map(f =>
                  f.id === uploadFile.id
                    ? {
                        ...f,
                        status: 'completed',
                        progress: 100,
                        url: response.data.fileUrl
                      }
                    : f
                ));
                resolve();
              } else {
                throw new Error(response.message || '업로드 실패');
              }
            } catch (parseError) {
              reject(new Error('응답 파싱 실패'));
            }
          } else {
            reject(new Error(`HTTP Error: ${xhr.status}`));
          }
        });

        // 에러 처리
        xhr.addEventListener('error', () => {
          reject(new Error('네트워크 오류'));
        });

        // 요청 전송
        xhr.open('POST', '/api/feedback/upload');
        xhr.send(formData);
      });

    } catch (error) {
      // 에러 상태 업데이트
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? {
              ...f,
              status: 'error',
              progress: 0,
              error: error instanceof Error ? error.message : '알 수 없는 오류'
            }
          : f
      ));
      throw error;
    }
  }, [feedbackId, userId]);

  /**
   * 모든 파일 업로드
   */
  const uploadAllFiles = useCallback(async () => {
    if (isUploading || files.length === 0) return;

    setIsUploading(true);

    try {
      const pendingFiles = files.filter(f => f.status === 'pending');

      // 순차적 업로드 (병렬 업로드는 서버 부하 고려하여 제한)
      for (const file of pendingFiles) {
        try {
          await uploadFile(file);
        } catch (error) {
          logger.error(`File upload failed: ${file.file.name}`, error instanceof Error ? error : new Error(String(error)));
          // 개별 파일 실패는 전체 프로세스를 중단하지 않음
        }
      }

      // 업로드 완료된 파일들 콜백 호출
      const completedFiles = files.filter(f => f.status === 'completed');
      if (completedFiles.length > 0) {
        onUploadComplete?.(completedFiles);
      }

    } catch (error) {
      onUploadError?.('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  }, [files, isUploading, uploadFile, onUploadComplete, onUploadError]);

  /**
   * 실패한 파일 재시도
   */
  const retryFailedFiles = useCallback(async () => {
    const failedFiles = files.filter(f => f.status === 'error');

    for (const file of failedFiles) {
      try {
        await uploadFile(file);
      } catch (error) {
        logger.error(`Retry failed: ${file.file.name}`, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }, [files, uploadFile]);

  const hasFiles = files.length > 0;
  const hasPendingFiles = files.some(f => f.status === 'pending');
  const hasFailedFiles = files.some(f => f.status === 'error');
  const allCompleted = files.length > 0 && files.every(f => f.status === 'completed');

  return (
    <div className={cn('w-full', className)}>
      {/* 드롭존 */}
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          {
            'border-blue-300 bg-blue-50': isDragOver && !disabled,
            'border-gray-300 bg-gray-50': !isDragOver && !disabled,
            'border-gray-200 bg-gray-100 opacity-50': disabled,
            'hover:border-gray-400 hover:bg-gray-100': !disabled && !isDragOver
          }
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALL_ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <Upload className={cn(
            'h-12 w-12',
            isDragOver ? 'text-blue-600' : 'text-gray-400'
          )} />

          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900">
              {isDragOver ? '파일을 놓아주세요' : '파일을 드래그하거나 클릭하여 업로드'}
            </p>
            <p className="text-sm text-gray-500">
              비디오, 이미지, 문서 파일 지원 (최대 {formatFileSize(maxSizePerFile)}, {maxFiles}개까지)
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="mt-4"
          >
            파일 선택
          </Button>
        </div>
      </div>

      {/* 파일 목록 */}
      {hasFiles && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">
              업로드할 파일 ({files.length}개)
            </h4>
            <div className="flex gap-2">
              {hasFailedFiles && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={retryFailedFiles}
                  disabled={isUploading}
                >
                  <AlertCircle className="mr-1 h-4 w-4" />
                  재시도
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={clearAllFiles}
                disabled={isUploading}
              >
                모두 제거
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {files.map((uploadFile) => (
              <div
                key={uploadFile.id}
                className="flex items-center gap-3 rounded-lg border bg-white p-3"
              >
                {/* 파일 아이콘 */}
                <div className="flex-shrink-0">
                  {getFileIcon(uploadFile.category || 'unknown')}
                </div>

                {/* 파일 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {uploadFile.file.name}
                    </p>
                    <div className="flex items-center gap-2">
                      {/* 상태 아이콘 */}
                      {uploadFile.status === 'uploading' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      )}
                      {uploadFile.status === 'completed' && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      {uploadFile.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}

                      {/* 제거 버튼 */}
                      <button
                        onClick={() => removeFile(uploadFile.id)}
                        disabled={uploadFile.status === 'uploading'}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{formatFileSize(uploadFile.file.size)} • {uploadFile.category}</span>
                    {uploadFile.status === 'uploading' && (
                      <span>{uploadFile.progress}%</span>
                    )}
                  </div>

                  {/* 진행률 바 */}
                  {uploadFile.status === 'uploading' && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                    </div>
                  )}

                  {/* 에러 메시지 */}
                  {uploadFile.status === 'error' && uploadFile.error && (
                    <p className="mt-1 text-xs text-red-600">{uploadFile.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 업로드 버튼 */}
          {hasPendingFiles && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={uploadAllFiles}
                disabled={isUploading}
                className="min-w-32"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  `${files.filter(f => f.status === 'pending').length}개 파일 업로드`
                )}
              </Button>
            </div>
          )}

          {/* 완료 메시지 */}
          {allCompleted && (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 p-4 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">모든 파일이 성공적으로 업로드되었습니다!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}