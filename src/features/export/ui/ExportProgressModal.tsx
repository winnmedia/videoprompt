/**
 * Export Progress Modal 컴포넌트
 * FSD: features/export/ui
 */

'use client';

import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Download, FileText, FileSpreadsheet } from 'lucide-react';
import type { ExportState, ExportFormat } from '../types';

interface ExportProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportState: ExportState;
  format?: ExportFormat;
  fileName?: string;
  onRetry?: () => void;
  onDownload?: () => void;
}

export function ExportProgressModal({
  isOpen,
  onClose,
  exportState,
  format,
  fileName,
  onRetry,
  onDownload
}: ExportProgressModalProps) {
  // 완료 시 자동 닫기 (5초 후)
  useEffect(() => {
    if (exportState.status === 'completed') {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [exportState.status, onClose]);

  if (!isOpen) return null;

  const formatIcon = {
    pdf: FileText,
    excel: FileSpreadsheet
  };

  const Icon = format ? formatIcon[format] : Download;

  const getStatusConfig = () => {
    switch (exportState.status) {
      case 'preparing':
        return {
          title: '내보내기 준비 중...',
          message: '데이터를 준비하고 있습니다.',
          color: 'blue',
          showProgress: true
        };
      case 'generating':
        return {
          title: '파일 생성 중...',
          message: format === 'pdf' ? 'PDF 문서를 생성하고 있습니다.' : 'Excel 파일을 생성하고 있습니다.',
          color: 'blue',
          showProgress: true
        };
      case 'downloading':
        return {
          title: '다운로드 중...',
          message: '파일을 다운로드하고 있습니다.',
          color: 'blue',
          showProgress: true
        };
      case 'completed':
        return {
          title: '내보내기 완료!',
          message: fileName ? `${fileName} 파일이 성공적으로 생성되었습니다.` : '파일이 성공적으로 생성되었습니다.',
          color: 'green',
          showProgress: false
        };
      case 'error':
        return {
          title: '내보내기 실패',
          message: exportState.error || '알 수 없는 오류가 발생했습니다.',
          color: 'red',
          showProgress: false
        };
      default:
        return {
          title: '대기 중...',
          message: '내보내기를 준비하고 있습니다.',
          color: 'gray',
          showProgress: false
        };
    }
  };

  const statusConfig = getStatusConfig();
  const progress = exportState.progress || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={exportState.status === 'completed' || exportState.status === 'error' ? onClose : undefined}
      />

      {/* 모달 콘텐츠 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-lg
              ${statusConfig.color === 'blue' ? 'bg-blue-100 text-blue-600' : ''}
              ${statusConfig.color === 'green' ? 'bg-green-100 text-green-600' : ''}
              ${statusConfig.color === 'red' ? 'bg-red-100 text-red-600' : ''}
              ${statusConfig.color === 'gray' ? 'bg-gray-100 text-gray-600' : ''}
            `}>
              {exportState.status === 'completed' ? (
                <CheckCircle className="w-6 h-6" />
              ) : exportState.status === 'error' ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <Icon className="w-6 h-6" />
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {statusConfig.title}
            </h2>
          </div>

          {(exportState.status === 'completed' || exportState.status === 'error') && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="모달 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 콘텐츠 */}
        <div className="space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            {statusConfig.message}
          </p>

          {/* 진행률 바 */}
          {statusConfig.showProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>진행률</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`
                    h-2 rounded-full transition-all duration-300 ease-out
                    ${statusConfig.color === 'blue' ? 'bg-blue-600' : 'bg-gray-400'}
                  `}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 액션 버튼들 */}
          <div className="flex gap-3 pt-4">
            {exportState.status === 'error' && onRetry && (
              <button
                onClick={onRetry}
                className="
                  flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg
                  hover:bg-blue-700 transition-colors font-medium text-sm
                "
              >
                다시 시도
              </button>
            )}

            {exportState.status === 'completed' && onDownload && (
              <button
                onClick={onDownload}
                className="
                  flex-1 px-4 py-2 bg-green-600 text-white rounded-lg
                  hover:bg-green-700 transition-colors font-medium text-sm
                  flex items-center justify-center gap-2
                "
              >
                <Download className="w-4 h-4" />
                다시 다운로드
              </button>
            )}

            {(exportState.status === 'completed' || exportState.status === 'error') && (
              <button
                onClick={onClose}
                className="
                  flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg
                  hover:bg-gray-200 transition-colors font-medium text-sm
                "
              >
                닫기
              </button>
            )}
          </div>
        </div>

        {/* 자동 닫기 알림 */}
        {exportState.status === 'completed' && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-700 text-center">
              이 창은 5초 후 자동으로 닫힙니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}