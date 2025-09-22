/**
 * VideoControls Widget
 *
 * 영상 제어 및 피드백 컴포넌트 (18단계 UserJourneyMap)
 * - 피드백, 재생성, 다운로드 버튼
 * - 접근성 WCAG 2.1 AA 준수
 * - 반응형 디자인
 */

import { useState } from 'react'

export interface VideoControlsProps {
  /** 비디오 URL */
  videoUrl?: string
  /** 비디오 제목 */
  videoTitle?: string
  /** 재생성 가능 여부 */
  canRegenerate?: boolean
  /** 다운로드 가능 여부 */
  canDownload?: boolean
  /** 공유 가능 여부 */
  canShare?: boolean
  /** 피드백 제출 콜백 */
  onFeedbackSubmit?: (feedback: VideoFeedback) => void
  /** 재생성 콜백 */
  onRegenerate?: () => void
  /** 다운로드 콜백 */
  onDownload?: () => void
  /** 공유 콜백 */
  onShare?: () => void
  /** 로딩 상태 */
  isLoading?: boolean
}

export interface VideoFeedback {
  rating: number
  comment: string
  categories: string[]
}

interface FeedbackCategory {
  id: string
  label: string
  description: string
}

const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  {
    id: 'quality',
    label: '영상 품질',
    description: '화질, 프레임, 안정성',
  },
  {
    id: 'content',
    label: '콘텐츠 정확성',
    description: '프롬프트 반영도, 스토리보드 일치도',
  },
  {
    id: 'style',
    label: '스타일',
    description: '색감, 분위기, 효과',
  },
  {
    id: 'motion',
    label: '움직임',
    description: '전환, 애니메이션, 역동성',
  },
  {
    id: 'overall',
    label: '전체적 만족도',
    description: '종합적인 완성도',
  },
]

export function VideoControls({
  videoUrl,
  videoTitle = '생성된 영상',
  canRegenerate = true,
  canDownload = true,
  canShare = true,
  onFeedbackSubmit,
  onRegenerate,
  onDownload,
  onShare,
  isLoading = false,
}: VideoControlsProps) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  // 피드백 모달 열기
  const openFeedbackModal = () => {
    setShowFeedbackModal(true)
    setFeedbackRating(0)
    setFeedbackComment('')
    setSelectedCategories([])
  }

  // 피드백 모달 닫기
  const closeFeedbackModal = () => {
    setShowFeedbackModal(false)
  }

  // 카테고리 선택/해제
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  // 피드백 제출
  const handleFeedbackSubmit = async () => {
    if (feedbackRating === 0) {
      alert('별점을 선택해주세요.')
      return
    }

    setIsSubmittingFeedback(true)

    try {
      const feedback: VideoFeedback = {
        rating: feedbackRating,
        comment: feedbackComment.trim(),
        categories: selectedCategories,
      }

      await onFeedbackSubmit?.(feedback)
      closeFeedbackModal()
    } catch (error) {
      console.error('피드백 제출 오류:', error)
      alert('피드백 제출 중 오류가 발생했습니다.')
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  // 파일 다운로드
  const handleDownload = async () => {
    if (!videoUrl) return

    try {
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${videoTitle}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      onDownload?.()
    } catch (error) {
      console.error('다운로드 오류:', error)
      alert('다운로드 중 오류가 발생했습니다.')
    }
  }

  // 공유하기
  const handleShare = async () => {
    if (!videoUrl) return

    try {
      if (navigator.share) {
        await navigator.share({
          title: videoTitle,
          url: videoUrl,
        })
      } else {
        // 폴백: 클립보드에 복사
        await navigator.clipboard.writeText(videoUrl)
        alert('링크가 클립보드에 복사되었습니다.')
      }
      onShare?.()
    } catch (error) {
      console.error('공유 오류:', error)
    }
  }

  return (
    <>
      {/* 메인 컨트롤 */}
      <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
        {/* 제목 및 설명 */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-neutral-900">영상 생성 완료</h2>
          <p className="text-neutral-600">
            생성된 영상을 확인하고 피드백을 남겨주세요
          </p>
        </div>

        {/* 주요 액션 버튼들 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 피드백 버튼 */}
          <button
            onClick={openFeedbackModal}
            disabled={isLoading}
            className={`
              flex items-center justify-center space-x-2 px-6 py-4 rounded-lg border font-medium transition-all duration-150
              ${isLoading
                ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed'
                : 'bg-white text-neutral-700 border-neutral-300 hover:border-primary-300 hover:bg-primary-50 focus:ring-2 focus:ring-primary-500'
              }
            `}
            aria-describedby="feedback-help"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10m0 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m0 0v8a2 2 0 002 2h6a2 2 0 002-2V8" />
            </svg>
            <span>피드백 남기기</span>
          </button>

          {/* 재생성 버튼 */}
          <button
            onClick={onRegenerate}
            disabled={!canRegenerate || isLoading}
            className={`
              flex items-center justify-center space-x-2 px-6 py-4 rounded-lg font-medium transition-all duration-150
              ${!canRegenerate || isLoading
                ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                : 'bg-warning-500 text-white hover:bg-warning-600 focus:ring-2 focus:ring-warning-500'
              }
            `}
            aria-describedby="regenerate-help"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>다시 생성하기</span>
          </button>

          {/* 다운로드 버튼 */}
          <button
            onClick={handleDownload}
            disabled={!canDownload || isLoading || !videoUrl}
            className={`
              flex items-center justify-center space-x-2 px-6 py-4 rounded-lg font-medium transition-all duration-150
              ${!canDownload || isLoading || !videoUrl
                ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                : 'bg-success-500 text-white hover:bg-success-600 focus:ring-2 focus:ring-success-500'
              }
            `}
            aria-describedby="download-help"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>다운로드</span>
          </button>
        </div>

        {/* 부가 액션 버튼들 */}
        <div className="flex justify-center space-x-4">
          {/* 공유 버튼 */}
          {canShare && (
            <button
              onClick={handleShare}
              disabled={isLoading || !videoUrl}
              className={`
                flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150
                ${isLoading || !videoUrl
                  ? 'text-neutral-400 cursor-not-allowed'
                  : 'text-neutral-600 hover:text-primary-600 hover:bg-primary-50'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              <span>공유하기</span>
            </button>
          )}
        </div>

        {/* 도움말 텍스트 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-neutral-500">
          <div id="feedback-help" className="text-center">
            영상에 대한 의견을 남겨주세요
          </div>
          <div id="regenerate-help" className="text-center">
            같은 설정으로 새로 생성합니다
          </div>
          <div id="download-help" className="text-center">
            MP4 파일로 저장합니다
          </div>
        </div>
      </div>

      {/* 피드백 모달 */}
      {showFeedbackModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-labelledby="feedback-modal-title"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b">
              <h3 id="feedback-modal-title" className="text-lg font-semibold text-neutral-900">
                영상 피드백
              </h3>
              <button
                onClick={closeFeedbackModal}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded"
                aria-label="모달 닫기"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-6 space-y-6">
              {/* 별점 평가 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">
                  전체적인 만족도를 평가해주세요 <span className="text-error-500">*</span>
                </label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setFeedbackRating(star)}
                      className={`p-1 rounded transition-colors ${
                        star <= feedbackRating
                          ? 'text-warning-500'
                          : 'text-neutral-300 hover:text-warning-400'
                      }`}
                      aria-label={`${star}점`}
                    >
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-neutral-500">
                  {feedbackRating === 0 && '별점을 선택해주세요'}
                  {feedbackRating === 1 && '매우 불만족'}
                  {feedbackRating === 2 && '불만족'}
                  {feedbackRating === 3 && '보통'}
                  {feedbackRating === 4 && '만족'}
                  {feedbackRating === 5 && '매우 만족'}
                </p>
              </div>

              {/* 개선 영역 선택 */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-neutral-700">
                  개선이 필요한 영역을 선택해주세요 (복수 선택 가능)
                </label>
                <div className="space-y-2">
                  {FEEDBACK_CATEGORIES.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-start space-x-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-neutral-900">
                          {category.label}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {category.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 상세 의견 */}
              <div className="space-y-2">
                <label
                  htmlFor="feedback-comment"
                  className="block text-sm font-medium text-neutral-700"
                >
                  상세한 의견 (선택사항)
                </label>
                <textarea
                  id="feedback-comment"
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="영상에 대한 구체적인 의견이나 개선 제안을 남겨주세요..."
                  className="w-full h-24 px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  maxLength={500}
                />
                <div className="text-xs text-neutral-500 text-right">
                  {feedbackComment.length}/500
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex justify-end space-x-3 p-6 border-t bg-neutral-50">
              <button
                onClick={closeFeedbackModal}
                disabled={isSubmittingFeedback}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleFeedbackSubmit}
                disabled={feedbackRating === 0 || isSubmittingFeedback}
                className={`
                  px-4 py-2 text-sm font-medium rounded-md transition-colors
                  ${feedbackRating === 0 || isSubmittingFeedback
                    ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                  }
                `}
              >
                {isSubmittingFeedback ? '제출 중...' : '피드백 제출'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}