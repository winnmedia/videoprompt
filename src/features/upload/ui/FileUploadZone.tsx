/**
 * 파일 업로드 존 컴포넌트
 * FSD Architecture - Features Layer
 */

'use client';

import { useCallback, useState, DragEvent } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useFileUpload, type UploadState } from '../hooks/useFileUpload';
import { formatFileSize } from '@/shared/lib/upload-utils';

interface FileUploadZoneProps {
  onUploadComplete?: (result: { downloadUrl: string; uploadId: string }) => void;
  onUploadError?: (error: string) => void;
  acceptedTypes?: string[];
  maxFileSize?: number;
  className?: string;
  disabled?: boolean;
  showProgress?: boolean;
}

export function FileUploadZone({
  onUploadComplete,
  onUploadError,
  acceptedTypes = ['video/*', 'image/*'],
  maxFileSize = 600 * 1024 * 1024, // 600MB
  className = '',
  disabled = false,
  showProgress = true,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { uploadState, uploadFile, cancelUpload, resetState, isUploading } = useFileUpload({
    onComplete: (result) => {
      onUploadComplete?.(result);
    },
    onError: (error) => {
      onUploadError?.(error);
    },
    validateFile: (file) => {
      // 파일 크기 검증
      if (file.size > maxFileSize) {
        return `파일 크기가 너무 큽니다. 최대 ${formatFileSize(maxFileSize)}까지 업로드 가능합니다.`;
      }

      // 파일 타입 검증
      if (acceptedTypes.length > 0) {
        const isAccepted = acceptedTypes.some(type => {
          if (type.endsWith('/*')) {
            return file.type.startsWith(type.slice(0, -1));
          }
          return file.type === type;
        });

        if (!isAccepted) {
          return `지원하지 않는 파일 형식입니다. 허용된 형식: ${acceptedTypes.join(', ')}`;
        }
      }

      return null;
    },
  });

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [disabled, isUploading]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    try {
      await uploadFile(file);
    } catch (error) {
      // 에러는 이미 useFileUpload에서 처리됨
    }
  }, [uploadFile]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleReset = useCallback(() => {
    resetState();
    setSelectedFile(null);
  }, [resetState]);

  const getStatusIcon = () => {
    switch (uploadState.status) {
      case 'uploading':
      case 'preparing':
        return <Loader2 className="w-6 h-6 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Upload className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusMessage = () => {
    switch (uploadState.status) {
      case 'preparing':
        return '업로드 준비 중...';
      case 'uploading':
        return uploadState.totalChunks && uploadState.currentChunk
          ? `청크 ${uploadState.currentChunk}/${uploadState.totalChunks} 업로드 중...`
          : '업로드 중...';
      case 'completed':
        return '업로드 완료!';
      case 'failed':
        return uploadState.error || '업로드 실패';
      case 'cancelled':
        return '업로드 취소됨';
      default:
        return '파일을 드래그하거나 클릭하여 선택하세요';
    }
  };

  const getZoneClassName = () => {
    const baseClass = `
      relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
      ${className}
    `;

    if (disabled) {
      return `${baseClass} border-gray-200 bg-gray-50 cursor-not-allowed`;
    }

    if (uploadState.status === 'completed') {
      return `${baseClass} border-green-300 bg-green-50`;
    }

    if (uploadState.status === 'failed') {
      return `${baseClass} border-red-300 bg-red-50`;
    }

    if (isDragOver) {
      return `${baseClass} border-blue-400 bg-blue-50`;
    }

    if (isUploading) {
      return `${baseClass} border-blue-300 bg-blue-50`;
    }

    return `${baseClass} border-gray-300 hover:border-gray-400 cursor-pointer`;
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div
        className={getZoneClassName()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (!disabled && !isUploading && uploadState.status !== 'completed') {
            document.getElementById('file-input')?.click();
          }
        }}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          disabled={disabled || isUploading}
        />

        <div className="space-y-4">
          {/* 아이콘 */}
          <div className="flex justify-center">
            {getStatusIcon()}
          </div>

          {/* 메인 메시지 */}
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900">
              {getStatusMessage()}
            </p>

            {selectedFile && uploadState.status !== 'idle' && (
              <div className="text-sm text-gray-600">
                <p className="font-medium">{selectedFile.name}</p>
                <p>{formatFileSize(selectedFile.size)}</p>
              </div>
            )}

            {uploadState.status === 'idle' && (
              <div className="text-sm text-gray-500 space-y-1">
                <p>최대 {formatFileSize(maxFileSize)}</p>
                <p>지원 형식: {acceptedTypes.join(', ')}</p>
              </div>
            )}
          </div>

          {/* 진행률 바 */}
          {showProgress && isUploading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{uploadState.progress}%</span>
                <span>
                  {formatFileSize(uploadState.uploadedBytes)} / {formatFileSize(uploadState.totalBytes)}
                </span>
              </div>
            </div>
          )}

          {/* 액션 버튼들 */}
          <div className="flex justify-center gap-2">
            {isUploading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  cancelUpload();
                }}
                className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
              >
                취소
              </button>
            )}

            {(uploadState.status === 'completed' || uploadState.status === 'failed' || uploadState.status === 'cancelled') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                다시 선택
              </button>
            )}
          </div>

          {/* 업로드 완료 시 다운로드 URL */}
          {uploadState.status === 'completed' && uploadState.downloadUrl && (
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 mb-2">업로드된 파일:</p>
              <a
                href={uploadState.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
              >
                {uploadState.downloadUrl}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 에러 메시지 */}
      {uploadState.status === 'failed' && uploadState.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-red-800">업로드 실패</h4>
              <p className="text-sm text-red-700 mt-1">{uploadState.error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}