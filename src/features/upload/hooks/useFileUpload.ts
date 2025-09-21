/**
 * 파일 업로드 훅
 * FSD Architecture - Features Layer
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { logger } from '@/shared/lib/logger';
import { safeFetch } from '@/shared/lib/api-retry';
import {
  isValidVideoFile,
  isFileSizeValid,
  formatFileSize,
  createFileChunks,
  calculateProgress,
  createUploadSession,
  calculateFileChecksum,
  DEFAULT_CHUNK_SIZE,
  type UploadProgress,
  type UploadSession,
} from '@/shared/lib/upload-utils';

export interface UploadState {
  status: 'idle' | 'preparing' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  currentChunk?: number;
  totalChunks?: number;
  uploadUrl?: string;
  downloadUrl?: string;
  error?: string;
  session?: UploadSession;
}

interface UseFileUploadOptions {
  chunkSize?: number;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (result: { downloadUrl: string; uploadId: string }) => void;
  onError?: (error: string) => void;
  validateFile?: (file: File) => string | null; // 커스텀 파일 검증
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    onProgress,
    onComplete,
    onError,
    validateFile,
  } = options;

  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    uploadedBytes: 0,
    totalBytes: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const updateState = useCallback((updates: Partial<UploadState>) => {
    setUploadState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetState = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setUploadState({
      status: 'idle',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: 0,
    });
  }, []);

  const validateFileInput = useCallback((file: File): string | null => {
    // 커스텀 검증 함수가 있으면 우선 실행
    if (validateFile) {
      const customError = validateFile(file);
      if (customError) return customError;
    }

    // 기본 검증
    if (!isFileSizeValid(file.size)) {
      return `파일 크기가 너무 큽니다. 최대 ${formatFileSize(600 * 1024 * 1024)}까지 업로드 가능합니다.`;
    }

    // 비디오 파일 타입 검증 (필요시)
    if (file.type.startsWith('video/') && !isValidVideoFile(file)) {
      return '지원하지 않는 비디오 형식입니다.';
    }

    return null;
  }, [validateFile]);

  const getPresignedUrl = useCallback(async (file: File): Promise<{
    uploadUrl: string;
    downloadUrl: string;
    uploadId: string;
  }> => {
    const response = await safeFetch('/api/upload/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Presigned URL 생성 실패');
    }

    const data = await response.json();
    return {
      uploadUrl: data.uploadUrl,
      downloadUrl: data.downloadUrl,
      uploadId: data.uploadId,
    };
  }, []);

  const uploadToS3 = useCallback(async (file: File, uploadUrl: string, signal: AbortSignal) => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`S3 업로드 실패: ${response.status} ${response.statusText}`);
    }

    return response;
  }, []);

  const uploadChunked = useCallback(async (
    file: File,
    uploadId: string,
    signal: AbortSignal
  ) => {
    const chunks = createFileChunks(file, chunkSize);
    const totalChunks = chunks.length;

    updateState({
      totalChunks,
      currentChunk: 0,
    });

    let uploadedBytes = 0;

    for (let i = 0; i < chunks.length; i++) {
      if (signal.aborted) {
        throw new Error('업로드가 취소되었습니다.');
      }

      const chunk = chunks[i];
      const chunkData = await chunk.data; // ArrayBuffer Promise 해결

      // FormData로 청크와 메타데이터 전송
      const formData = new FormData();
      formData.append('chunk', new Blob([chunkData], { type: file.type }));
      formData.append('metadata', JSON.stringify({
        uploadId,
        chunkIndex: i,
        totalChunks,
        chunkSize: chunkData.byteLength,
        fileName: file.name,
        fileType: file.type,
      }));

      const response = await safeFetch('/api/upload/chunk', {
        method: 'POST',
        body: formData,
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `청크 ${i + 1} 업로드 실패`);
      }

      const result = await response.json();

      uploadedBytes += chunkData.byteLength;
      const progress = calculateProgress(uploadedBytes, file.size);

      updateState({
        progress: progress.percentage,
        uploadedBytes,
        currentChunk: i + 1,
      });

      onProgress?.(progress);

      // 업로드 완료 확인
      if (result.isComplete) {
        return result.assemblyUrl;
      }
    }

    throw new Error('청크 업로드가 완료되지 않았습니다.');
  }, [chunkSize, updateState, onProgress]);

  const confirmUpload = useCallback(async (
    uploadId: string,
    fileName: string,
    fileSize: number,
    fileType: string
  ): Promise<string> => {
    const response = await safeFetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        fileName,
        fileSize,
        fileType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '업로드 완료 확인 실패');
    }

    const data = await response.json();
    return data.fileUrl;
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    try {
      // 파일 검증
      const validationError = validateFileInput(file);
      if (validationError) {
        throw new Error(validationError);
      }

      // 업로드 세션 생성
      const session = createUploadSession(file);

      // 업로드 시작
      updateState({
        status: 'preparing',
        totalBytes: file.size,
        uploadedBytes: 0,
        progress: 0,
        session,
      });

      // AbortController 생성
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      logger.debug('파일 업로드 시작:', {
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        fileType: file.type,
        uploadId: session.uploadId,
      });

      let downloadUrl: string;

      // 파일 크기에 따라 업로드 방식 결정
      if (file.size > chunkSize) {
        // 청크 업로드 (대용량 파일)
        logger.debug('청크 업로드 모드 사용');

        updateState({ status: 'uploading' });

        const assemblyUrl = await uploadChunked(file, session.uploadId, signal);
        downloadUrl = assemblyUrl || await confirmUpload(
          session.uploadId,
          file.name,
          file.size,
          file.type
        );
      } else {
        // 일반 S3 업로드 (소용량 파일)
        logger.debug('일반 업로드 모드 사용');

        updateState({ status: 'uploading' });

        const { uploadUrl, downloadUrl: presignedDownloadUrl, uploadId } = await getPresignedUrl(file);
        await uploadToS3(file, uploadUrl, signal);

        downloadUrl = await confirmUpload(uploadId, file.name, file.size, file.type);
      }

      // 완료 처리
      updateState({
        status: 'completed',
        progress: 100,
        uploadedBytes: file.size,
        downloadUrl,
      });

      logger.info('✅ 파일 업로드 완료:', {
        fileName: file.name,
        uploadId: session.uploadId,
        downloadUrl,
      });

      onComplete?.({
        downloadUrl,
        uploadId: session.uploadId,
      });

      return { downloadUrl, uploadId: session.uploadId };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '업로드 실패';

      updateState({
        status: error instanceof Error && error.message.includes('취소') ? 'cancelled' : 'failed',
        error: errorMessage,
      });

      logger.error('❌ 파일 업로드 실패:', error instanceof Error ? error : new Error(String(error)));

      onError?.(errorMessage);

      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    validateFileInput,
    updateState,
    chunkSize,
    uploadChunked,
    getPresignedUrl,
    uploadToS3,
    confirmUpload,
    onComplete,
    onError,
  ]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    updateState({
      status: 'cancelled',
      error: '업로드가 취소되었습니다.',
    });

    logger.debug('업로드 취소됨');
  }, [updateState]);

  return {
    uploadState,
    uploadFile,
    cancelUpload,
    resetState,
    isUploading: uploadState.status === 'uploading' || uploadState.status === 'preparing',
    isCompleted: uploadState.status === 'completed',
    isFailed: uploadState.status === 'failed',
    isCancelled: uploadState.status === 'cancelled',
  };
}