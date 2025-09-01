'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Icon } from './Icon';

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
  placeholder = '이미지를 업로드하세요'
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

  const handleFileUpload = useCallback(async (file: File) => {
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

      const response = await fetch('/api/upload/image', {
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
  }, [maxSize, onImageUploaded, onError]);

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
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
            ${isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
          `}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <Icon name="image" className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">{placeholder}</p>
              <p className="text-sm text-gray-500 mt-1">
                클릭하여 선택하거나 이미지를 여기에 드래그하세요
              </p>
              <p className="text-xs text-gray-400 mt-2">
                지원 형식: JPG, PNG, GIF (최대 {maxSize}MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="relative group">
            <img
              src={uploadedUrl || previewUrl || ''}
              alt="업로드된 이미지"
              className="w-full h-48 object-cover rounded-lg border border-gray-200"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                <button
                  onClick={handleClick}
                  className="px-3 py-2 bg-white text-gray-800 rounded-md hover:bg-gray-100 transition-colors text-sm"
                >
                  변경
                </button>
                <button
                  onClick={handleRemove}
                  className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                >
                  제거
                </button>
              </div>
            </div>
          </div>
          
          {isUploading && (
            <div className="absolute inset-0 bg-white bg-opacity-80 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">업로드 중...</p>
              </div>
            </div>
          )}
          
          {uploadedUrl && (
            <div className="mt-2 text-center">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <Icon name="check" className="w-3 h-3 mr-1" />
                업로드 완료
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}





