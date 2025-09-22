/**
 * 콘티 이미지 뷰어 컴포넌트
 * FSD: widgets/planning 레이어
 */

export interface ContiImageViewerProps {
  imageUrl?: string
  title?: string
  description?: string
  isLoading?: boolean
}

export function ContiImageViewer({
  imageUrl,
  title = '콘티 이미지',
  description,
  isLoading = false
}: ContiImageViewerProps) {
  if (isLoading) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!imageUrl) {
    return (
      <div className="w-full h-64 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500">
          <div className="text-lg mb-2">📸</div>
          <div className="text-sm">콘티 이미지가 없습니다</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <img
        src={imageUrl}
        alt={title}
        className="w-full h-auto rounded-lg shadow-sm"
      />
      {description && (
        <p className="mt-2 text-sm text-gray-600">{description}</p>
      )}
    </div>
  )
}