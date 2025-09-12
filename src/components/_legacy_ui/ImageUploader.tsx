'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Icon } from '@/shared/ui';
import { safeFetch } from '@/shared/lib/api-retry';

interface ImageUploaderProps {
  onImageUploaded: (imageUrl: string) => void;
  onError?: (error: string) => void;
  className?: string;
  accept?: string;
  maxSize?: number; // MB 단위
  placeholder?: string;
}

export function ImageUploader({
  onImageUploaded,
  onError,
  className = '',
  accept = 'image/*',
  maxSize = 10,
  placeholder = '이미지를 업로드하세요',
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileUpload = useCallback(
    async (file: File) => {
      // 파일 타입 검증
      if (!file.type.startsWith('image/')) {
        const errorMsg = '유효한 이미지 파일이 아닙니다.';
        onError?.(errorMsg);
        return;
      }

      // 파일 크기 검증
      const maxSizeBytes = maxSize * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        const errorMsg = `파일 크기가 너무 큽니다. ${maxSize}MB 이하로 제한됩니다.`;
        onError?.(errorMsg);
        return;
      }

      // 미리보기 생성
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // 서버에 업로드
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await safeFetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('업로드 실패');
        }

        const data = await response.json();
        setUploadedUrl(data.imageUrl);
        onImageUploaded(data.imageUrl);
      } catch (error) {
        console.error('이미지 업로드 오류:', error);
        const errorMsg = '이미지 업로드 중 오류가 발생했습니다.';
        onError?.(errorMsg);
        setPreviewUrl(null);
      } finally {
        setIsUploading(false);
      }
    },
    [maxSize, onImageUploaded, onError],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    setUploadedUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {!previewUrl && !uploadedUrl ? (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all
            ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
          `}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Icon name="image" className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">{placeholder}</p>
              <p className="mt-1 text-sm text-gray-500">
                클릭하여 선택하거나 이미지를 여기에 드래그하세요
              </p>
              <p className="mt-2 text-xs text-gray-400">
                지원 형식: JPG, PNG, GIF (최대 {maxSize}MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="group relative">
            <img
              src={uploadedUrl || previewUrl || ''}
              alt="업로드된 이미지"
              className="h-48 w-full rounded-lg border border-gray-200 object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black bg-opacity-0 transition-all group-hover:bg-opacity-30">
              <div className="flex space-x-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={handleClick}
                  className="rounded-md bg-white px-3 py-2 text-sm text-gray-800 transition-colors hover:bg-gray-100"
                >
                  변경
                </button>
                <button
                  onClick={handleRemove}
                  className="rounded-md bg-danger-600 px-3 py-2 text-sm text-white transition-colors hover:bg-danger-700"
                >
                  제거
                </button>
              </div>
            </div>
          </div>

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white bg-opacity-80">
              <div className="text-center">
                <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-600">업로드 중...</p>
              </div>
            </div>
          )}

          {uploadedUrl && (
            <div className="mt-2 text-center">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                <Icon name="check" className="mr-1 h-3 w-3" />
                업로드 완료
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
