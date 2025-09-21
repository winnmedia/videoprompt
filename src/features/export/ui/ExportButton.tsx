/**
 * Export Button 컴포넌트
 * FSD: features/export/ui
 */

'use client';

import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import type { ExportFormat } from '../types';

interface ExportButtonProps {
  onExport: (format: ExportFormat) => Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
  availableFormats?: ExportFormat[];
}

export function ExportButton({
  onExport,
  disabled = false,
  isLoading = false,
  className = '',
  variant = 'default',
  availableFormats = ['pdf', 'excel']
}: ExportButtonProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentFormat, setCurrentFormat] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setCurrentFormat(format);
    setIsDropdownOpen(false);

    try {
      await onExport(format);
    } finally {
      setCurrentFormat(null);
    }
  };

  const formatConfig = {
    pdf: {
      icon: FileText,
      label: 'PDF',
      description: '시나리오를 PDF 문서로 내보내기'
    },
    excel: {
      icon: FileSpreadsheet,
      label: 'Excel',
      description: '데이터를 Excel 스프레드시트로 내보내기'
    }
  };

  if (variant === 'compact') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={disabled || isLoading}
          className={`
            inline-flex items-center gap-2 px-3 py-2 text-sm font-medium
            bg-blue-600 text-white rounded-md hover:bg-blue-700
            disabled:bg-gray-300 disabled:cursor-not-allowed
            transition-colors duration-200
            ${className}
          `}
          aria-label="내보내기 옵션"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          내보내기
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <div className="py-1">
              {availableFormats.map((format) => {
                const config = formatConfig[format];
                const Icon = config.icon;
                const isCurrentlyLoading = currentFormat === format && isLoading;

                return (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    disabled={disabled || isLoading}
                    className="
                      w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700
                      hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors duration-150
                    "
                  >
                    {isCurrentlyLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span className="font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={disabled || isLoading}
        className={`
          inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
          bg-blue-600 text-white rounded-lg hover:bg-blue-700
          disabled:bg-gray-300 disabled:cursor-not-allowed
          transition-all duration-200 shadow-sm hover:shadow-md
          ${className}
        `}
        aria-label="내보내기 옵션 열기"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Download className="w-5 h-5" />
        )}
        내보내기
      </button>

      {isDropdownOpen && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />

          {/* 드롭다운 메뉴 */}
          <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-3 py-2">
                내보내기 형식 선택
              </div>

              {availableFormats.map((format) => {
                const config = formatConfig[format];
                const Icon = config.icon;
                const isCurrentlyLoading = currentFormat === format && isLoading;

                return (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    disabled={disabled || isLoading}
                    className="
                      w-full flex items-start gap-3 p-3 rounded-md
                      hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors duration-150 text-left
                    "
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {isCurrentlyLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      ) : (
                        <Icon className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {config.label} 형식으로 내보내기
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {config.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}