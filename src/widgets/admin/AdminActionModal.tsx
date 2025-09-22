/**
 * Admin Action Modal Widget
 *
 * 관리자 액션 수행 시 안전 확인을 위한 모달 컴포넌트입니다.
 * 위험도에 따른 차등적 확인 절차를 제공합니다.
 */

'use client';

import { useState, useCallback } from 'react';
import { AdminActionValidator } from '../../entities/admin';
import type { AdminActionType } from '../../entities/admin';

interface AdminActionModalProps {
  /** 모달 표시 여부 */
  isOpen: boolean;
  /** 액션 타입 */
  actionType: AdminActionType;
  /** 대상 리소스 타입 */
  targetType: string;
  /** 대상 리소스 ID */
  targetId: string;
  /** 대상 리소스 이름 (사용자 이메일, 프로젝트 제목 등) */
  targetName?: string;
  /** 로딩 상태 */
  loading?: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** 액션 확인 콜백 */
  onConfirm: (reason?: string) => void;
}

/**
 * 관리자 액션 확인 모달
 */
export function AdminActionModal({
  isOpen,
  actionType,
  targetType,
  targetId,
  targetName,
  loading = false,
  onClose,
  onConfirm
}: AdminActionModalProps) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');

  // 액션 위험도 및 설명
  const actionRisk = AdminActionValidator.assessActionRisk(actionType);
  const actionDescription = AdminActionValidator.generateActionDescription({
    type: actionType,
    targetType,
    targetId
  } as any);

  // 높은 위험도 액션의 경우 확인 텍스트 입력 요구
  const requiresConfirmation = actionRisk === 'high';
  const confirmationText = `${actionType.toUpperCase()}`;

  /**
   * 확인 버튼 클릭
   */
  const handleConfirm = useCallback(() => {
    // 높은 위험도 액션의 경우 확인 텍스트 검증
    if (requiresConfirmation && confirmText !== confirmationText) {
      alert(`확인을 위해 "${confirmationText}"를 정확히 입력해주세요.`);
      return;
    }

    onConfirm(reason.trim() || undefined);
  }, [reason, confirmText, confirmationText, requiresConfirmation, onConfirm]);

  /**
   * 모달 초기화
   */
  const handleClose = useCallback(() => {
    setReason('');
    setConfirmText('');
    onClose();
  }, [onClose]);

  // 모달이 열려있지 않으면 렌더링 안 함
  if (!isOpen) return null;

  // 위험도별 스타일
  const getRiskStyles = () => {
    switch (actionRisk) {
      case 'high':
        return {
          headerBg: 'bg-red-500',
          borderColor: 'border-red-200',
          buttonBg: 'bg-red-600 hover:bg-red-700',
          iconColor: 'text-red-600'
        };
      case 'medium':
        return {
          headerBg: 'bg-yellow-500',
          borderColor: 'border-yellow-200',
          buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
          iconColor: 'text-yellow-600'
        };
      default:
        return {
          headerBg: 'bg-blue-500',
          borderColor: 'border-blue-200',
          buttonBg: 'bg-blue-600 hover:bg-blue-700',
          iconColor: 'text-blue-600'
        };
    }
  };

  const styles = getRiskStyles();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 오버레이 */}
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />

        {/* 모달 컨테이너 */}
        <div className="inline-block align-bottom bg-white rounded-lg border text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* 헤더 */}
          <div className={`${styles.headerBg} px-6 py-4`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {actionRisk === 'high' ? (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-white">
                  관리자 액션 확인
                </h3>
                <p className="text-sm text-white opacity-90">
                  {actionRisk === 'high' ? '위험한 액션입니다' :
                   actionRisk === 'medium' ? '주의가 필요한 액션입니다' :
                   '액션을 수행합니다'}
                </p>
              </div>
            </div>
          </div>

          {/* 본문 */}
          <div className="px-6 py-4">
            {/* 액션 정보 */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">액션 정보</h4>
              <div className="bg-gray-50 rounded-md p-3 space-y-2">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">액션:</span>
                  <span className="ml-2 text-gray-900">{actionDescription}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">대상:</span>
                  <span className="ml-2 text-gray-900">
                    {targetName || targetId} ({targetType})
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">위험도:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    actionRisk === 'high' ? 'bg-red-100 text-red-800' :
                    actionRisk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {actionRisk === 'high' ? '높음' :
                     actionRisk === 'medium' ? '보통' : '낮음'}
                  </span>
                </div>
              </div>
            </div>

            {/* 사유 입력 */}
            <div className="mb-4">
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                사유 {actionRisk !== 'low' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="액션을 수행하는 이유를 입력해주세요..."
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={actionRisk !== 'low'}
              />
            </div>

            {/* 높은 위험도 액션의 경우 확인 텍스트 입력 */}
            {requiresConfirmation && (
              <div className="mb-4">
                <label htmlFor="confirmText" className="block text-sm font-medium text-gray-700 mb-2">
                  확인 텍스트 <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-gray-600 mb-2">
                  계속하려면 <code className="bg-gray-100 px-1 py-0.5 rounded text-red-600 font-mono">
                    {confirmationText}
                  </code>를 입력해주세요.
                </p>
                <input
                  id="confirmText"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={confirmationText}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>
            )}

            {/* 경고 메시지 */}
            {actionRisk === 'high' && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800">주의사항</h4>
                    <p className="text-sm text-red-700 mt-1">
                      이 액션은 되돌릴 수 없습니다. 신중하게 검토한 후 진행해주세요.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={
                loading ||
                (actionRisk !== 'low' && !reason.trim()) ||
                (requiresConfirmation && confirmText !== confirmationText)
              }
              className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${styles.buttonBg}`}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  처리 중...
                </div>
              ) : (
                '확인'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}