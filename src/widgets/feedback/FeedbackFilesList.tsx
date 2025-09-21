'use client';

import React, { useEffect, useState } from 'react';
import { File, Image, Video, FileText, Download, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

// 파일 타입 정의
interface FeedbackFile {
  id: string;
  feedbackId: string;
  filename: string;
  originalName: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
  fileSizeFormatted: string;
  category: string;
  icon: string;
  uploadStatus: string;
  uploadedBy?: string;
  createdAt: string;
  isDownloadable: boolean;
  downloadUrl?: string;
}

interface FeedbackFilesStats {
  total: number;
  byCategory: {
    video: number;
    image: number;
    document: number;
  };
  totalSize: number;
  totalSizeFormatted: string;
}

interface FeedbackFilesListProps {
  feedbackId: string;
  className?: string;
  onRefresh?: () => void;
}

/**
 * 파일 타입별 아이콘
 */
function getFileIcon(category: string) {
  switch (category) {
    case 'video':
      return <Video className="h-5 w-5 text-purple-600" />;
    case 'image':
      return <Image className="h-5 w-5 text-green-600" />;
    case 'document':
      return <FileText className="h-5 w-5 text-blue-600" />;
    default:
      return <File className="h-5 w-5 text-gray-600" />;
  }
}

/**
 * 파일 다운로드 처리
 */
function handleFileDownload(file: FeedbackFile) {
  if (!file.isDownloadable || !file.downloadUrl) return;

  // 새 탭에서 파일 열기 (다운로드)
  const link = document.createElement('a');
  link.href = file.downloadUrl;
  link.download = file.originalName;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 파일 삭제 처리
 */
async function handleFileDelete(file: FeedbackFile, onRefresh: () => void) {
  if (!confirm(`'${file.originalName}' 파일을 삭제하시겠습니까?`)) return;

  try {
    const response = await fetch(`/api/feedback/files/${file.id}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (result.success) {
      alert('파일이 성공적으로 삭제되었습니다.');
      onRefresh(); // 목록 새로고침
    } else {
      throw new Error(result.message || '삭제 실패');
    }
  } catch (error) {
    console.error('File delete error:', error);
    alert(`파일 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

export default function FeedbackFilesList({
  feedbackId,
  className,
  onRefresh
}: FeedbackFilesListProps) {
  const [files, setFiles] = useState<FeedbackFile[]>([]);
  const [stats, setStats] = useState<FeedbackFilesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 피드백 파일 목록 조회
   */
  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/feedback/${feedbackId}/files`);
      const result = await response.json();

      if (result.success) {
        setFiles(result.data.files || []);
        setStats(result.data.stats || null);
      } else {
        throw new Error(result.message || '파일 목록 조회 실패');
      }
    } catch (error) {
      console.error('Fetch files error:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setFiles([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 새로고침 핸들러
   */
  const handleRefresh = () => {
    fetchFiles();
    onRefresh?.();
  };

  // 컴포넌트 마운트 시 파일 목록 조회
  useEffect(() => {
    if (feedbackId) {
      fetchFiles();
    }
  }, [feedbackId]);

  if (loading) {
    return (
      <div className={cn('rounded-lg border bg-white p-4', className)}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">파일 목록 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('rounded-lg border bg-white p-4', className)}>
        <div className="flex items-center justify-center py-8 text-red-600">
          <AlertCircle className="h-6 w-6" />
          <span className="ml-2">{error}</span>
        </div>
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-white', className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h3 className="font-semibold text-gray-900">첨부 파일</h3>
          {stats && (
            <p className="text-sm text-gray-500">
              {stats.total}개 파일 • {stats.totalSizeFormatted}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* 통계 (파일이 있을 때만) */}
      {stats && stats.total > 0 && (
        <div className="border-b p-4">
          <div className="flex gap-4 text-sm">
            {stats.byCategory.video > 0 && (
              <div className="flex items-center gap-1">
                <Video className="h-4 w-4 text-purple-600" />
                <span>{stats.byCategory.video}개</span>
              </div>
            )}
            {stats.byCategory.image > 0 && (
              <div className="flex items-center gap-1">
                <Image className="h-4 w-4 text-green-600" />
                <span>{stats.byCategory.image}개</span>
              </div>
            )}
            {stats.byCategory.document > 0 && (
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>{stats.byCategory.document}개</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 파일 목록 */}
      <div className="p-4">
        {files.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <File className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2">아직 업로드된 파일이 없습니다.</p>
            <p className="text-sm">파일 업로드 버튼을 클릭하여 파일을 추가해보세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-md border p-3 hover:bg-gray-50 transition-colors"
              >
                {/* 파일 아이콘 */}
                <div className="flex-shrink-0">
                  {getFileIcon(file.category)}
                </div>

                {/* 파일 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {file.originalName}
                    </p>
                    <div className="flex items-center gap-1">
                      {/* 다운로드 버튼 */}
                      {file.isDownloadable && (
                        <button
                          onClick={() => handleFileDownload(file)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="다운로드"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      )}

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleFileDelete(file, handleRefresh)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{file.fileSizeFormatted} • {file.category}</span>
                    {file.uploadedBy && (
                      <span>by {file.uploadedBy}</span>
                    )}
                  </div>

                  {/* 업로드 상태 */}
                  {file.uploadStatus !== 'completed' && (
                    <div className="mt-1">
                      <span className={cn(
                        'inline-block px-2 py-1 text-xs rounded-full',
                        {
                          'bg-yellow-100 text-yellow-800': file.uploadStatus === 'pending',
                          'bg-blue-100 text-blue-800': file.uploadStatus === 'uploading',
                          'bg-red-100 text-red-800': file.uploadStatus === 'error',
                        }
                      )}>
                        {file.uploadStatus === 'pending' && '대기 중'}
                        {file.uploadStatus === 'uploading' && '업로드 중'}
                        {file.uploadStatus === 'error' && '업로드 실패'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}