/**
 * ConsistencyControls Widget
 *
 * 스토리보드 일관성 설정을 제어하는 컴포넌트
 * 스타일 선택, 일관성 레벨 조정, 참조 이미지 설정 기능 포함
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button, Card, Modal } from '../../shared/ui'
import logger from '../../shared/lib/logger'

/**
 * 일관성 설정 타입
 */
export interface ConsistencySettings {
  style: 'pencil' | 'rough' | 'monochrome' | 'colored'
  consistencyLevel: number // 1-10
  colorPalette?: string[]
  characterStyle?: 'realistic' | 'cartoon' | 'anime' | 'sketch'
  backgroundStyle?: 'detailed' | 'simple' | 'minimal'
  lightingStyle?: 'natural' | 'dramatic' | 'soft' | 'high-contrast'
  referenceImages: File[]
  maintainCharacters: boolean
  maintainEnvironment: boolean
  maintainColorScheme: boolean
}

/**
 * 일관성 컨트롤 속성
 */
export interface ConsistencyControlsProps {
  settings: ConsistencySettings
  onSettingsChange: (settings: ConsistencySettings) => void
  onApply?: (settings: ConsistencySettings) => void
  onReset?: () => void
  className?: string
  disabled?: boolean
  showAdvanced?: boolean
}

/**
 * 스타일 옵션 정의
 */
const styleOptions = [
  {
    value: 'pencil',
    label: '연필 스케치',
    description: '연필로 그린 것 같은 자연스러운 스케치 스타일',
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xMCAyMEwyMCAxMEwzMCAyMEwyMCAzMEwxMCAyMFoiIHN0cm9rZT0iIzMzMzMzMyIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+CjwvU3ZnPgo='
  },
  {
    value: 'rough',
    label: '러프 스케치',
    description: '빠르고 거친 스케치로 아이디어 전달에 집중',
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xMiAyMkwyMiAxMkwzMiAyMkwyMiAzMkwxMiAyMloiIHN0cm9rZT0iIzMzMzMzMyIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtZGFzaGFycmF5PSI0IDIiIGZpbGw9Im5vbmUiLz4KPC9zdmc+Cg=='
  },
  {
    value: 'monochrome',
    label: '흑백',
    description: '흑백으로 표현하여 형태와 명암에 집중',
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDAwMDAwIi8+CjxwYXRoIGQ9Ik0xMCAyMEwyMCAxMEwzMCAyMEwyMCAzMEwxMCAyMFoiIHN0cm9rZT0iI0ZGRkZGRiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSIjNDQ0NDQ0Ii8+CjwvU3ZnPgo='
  },
  {
    value: 'colored',
    label: '컬러',
    description: '풀 컬러로 완성도 높은 스토리보드',
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjBGOUZGIi8+CjxwYXRoIGQ9Ik0xMCAyMEwyMCAxMEwzMCAyMEwyMCAzMEwxMCAyMFoiIHN0cm9rZT0iIzM5OEVGMiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSIjRUJGOEZGIi8+CjwvU3ZnPgo='
  }
]

/**
 * 일관성 컨트롤 컴포넌트
 */
export function ConsistencyControls({
  settings,
  onSettingsChange,
  onApply,
  onReset,
  className = '',
  disabled = false,
  showAdvanced = false
}: ConsistencyControlsProps) {
  // 로컬 상태 (미적용 설정)
  const [localSettings, setLocalSettings] = useState<ConsistencySettings>(settings)
  const [showPreview, setShowPreview] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // 설정이 변경되었는지 확인
  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(localSettings)
  }, [settings, localSettings])

  /**
   * 로컬 설정 업데이트
   */
  const updateLocalSetting = useCallback(<K extends keyof ConsistencySettings>(
    key: K,
    value: ConsistencySettings[K]
  ) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  /**
   * 설정 적용
   */
  const handleApply = useCallback(() => {
    onSettingsChange(localSettings)
    onApply?.(localSettings)
    logger.info('일관성 설정 적용', { settings: localSettings })
  }, [localSettings, onSettingsChange, onApply])

  /**
   * 설정 초기화
   */
  const handleReset = useCallback(() => {
    const defaultSettings: ConsistencySettings = {
      style: 'pencil',
      consistencyLevel: 5,
      colorPalette: [],
      characterStyle: 'realistic',
      backgroundStyle: 'detailed',
      lightingStyle: 'natural',
      referenceImages: [],
      maintainCharacters: true,
      maintainEnvironment: true,
      maintainColorScheme: true
    }

    setLocalSettings(defaultSettings)
    onReset?.()
    logger.info('일관성 설정 초기화')
  }, [onReset])

  /**
   * 참조 이미지 추가
   */
  const handleAddReferenceImages = useCallback((files: FileList) => {
    const validFiles: File[] = []

    Array.from(files).forEach(file => {
      // 이미지 파일 검증
      if (!file.type.startsWith('image/')) {
        logger.warn('이미지가 아닌 파일 무시', { fileName: file.name, fileType: file.type })
        return
      }

      // 파일 크기 검증 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        logger.warn('파일 크기 초과', { fileName: file.name, fileSize: file.size })
        return
      }

      validFiles.push(file)
    })

    if (validFiles.length > 0) {
      updateLocalSetting('referenceImages', [...localSettings.referenceImages, ...validFiles])
      logger.info('참조 이미지 추가', { count: validFiles.length })
    }
  }, [localSettings.referenceImages, updateLocalSetting])

  /**
   * 참조 이미지 제거
   */
  const handleRemoveReferenceImage = useCallback((index: number) => {
    const newImages = localSettings.referenceImages.filter((_, i) => i !== index)
    updateLocalSetting('referenceImages', newImages)
    logger.info('참조 이미지 제거', { index })
  }, [localSettings.referenceImages, updateLocalSetting])

  /**
   * 드래그 앤 드롭 핸들러
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleAddReferenceImages(files)
    }
  }, [handleAddReferenceImages])

  /**
   * 일관성 레벨에 따른 설명
   */
  const consistencyDescription = useMemo(() => {
    const level = localSettings.consistencyLevel
    if (level <= 3) return '빠른 생성, 낮은 일관성'
    if (level <= 7) return '균형 잡힌 품질과 속도'
    return '높은 일관성, 느린 생성'
  }, [localSettings.consistencyLevel])

  // 외부 설정 변경 시 로컬 설정 동기화
  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  return (
    <Card className={`p-6 space-y-6 ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-neutral-900">
          일관성 설정
        </h3>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowPreview(true)}
            variant="outline"
            size="sm"
            disabled={disabled}
            data-testid="preview-settings-button"
          >
            미리보기
          </Button>

          {hasChanges && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              변경사항 있음
            </span>
          )}
        </div>
      </div>

      {/* 스타일 선택 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-neutral-700">
          렌더링 스타일
        </label>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {styleOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateLocalSetting('style', option.value as any)}
              disabled={disabled}
              className={`
                relative p-3 rounded-lg border-2 transition-all duration-200 text-left
                ${localSettings.style === option.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              data-testid={`style-option-${option.value}`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={option.preview}
                  alt=""
                  className="w-8 h-8 rounded"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-neutral-900">
                    {option.label}
                  </h4>
                  <p className="text-xs text-neutral-600 line-clamp-2">
                    {option.description}
                  </p>
                </div>
              </div>

              {localSettings.style === option.value && (
                <div className="absolute top-2 right-2">
                  <div className="w-4 h-4 bg-primary-600 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 일관성 레벨 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-neutral-700">
            일관성 레벨
          </label>
          <span className="text-sm font-medium text-primary-600">
            {localSettings.consistencyLevel}/10
          </span>
        </div>

        <div className="space-y-2">
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={localSettings.consistencyLevel}
            onChange={(e) => updateLocalSetting('consistencyLevel', parseInt(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={localSettings.consistencyLevel}
            aria-label={`일관성 레벨 ${localSettings.consistencyLevel}/10`}
            data-testid="consistency-level-slider"
          />

          <div className="flex justify-between text-xs text-neutral-500">
            <span>빠름</span>
            <span className="text-neutral-700 font-medium">{consistencyDescription}</span>
            <span>정확함</span>
          </div>
        </div>
      </div>

      {/* 참조 이미지 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-neutral-700">
            참조 이미지 ({localSettings.referenceImages.length}/5)
          </label>

          {localSettings.referenceImages.length > 0 && (
            <button
              onClick={() => updateLocalSetting('referenceImages', [])}
              disabled={disabled}
              className="text-xs text-red-600 hover:text-red-800 focus:outline-none disabled:opacity-50"
            >
              모두 제거
            </button>
          )}
        </div>

        {/* 드래그 앤 드롭 영역 */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-4 transition-colors
            ${dragActive ? 'border-primary-500 bg-primary-50' : 'border-neutral-300'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          data-testid="reference-image-dropzone"
        >
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => e.target.files && handleAddReferenceImages(e.target.files)}
            disabled={disabled || localSettings.referenceImages.length >= 5}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            data-testid="reference-image-input"
          />

          <div className="text-center">
            <svg className="w-8 h-8 text-neutral-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-neutral-600">
              {localSettings.referenceImages.length >= 5
                ? '최대 5개까지 업로드 가능합니다'
                : '이미지를 드래그하거나 클릭하여 업로드'
              }
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              PNG, JPG, WEBP (최대 5MB)
            </p>
          </div>
        </div>

        {/* 업로드된 이미지 목록 */}
        {localSettings.referenceImages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {localSettings.referenceImages.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square bg-neutral-100 rounded-lg overflow-hidden">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`참조 이미지 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                <button
                  onClick={() => handleRemoveReferenceImage(index)}
                  disabled={disabled}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                  aria-label={`참조 이미지 ${index + 1} 제거`}
                >
                  <svg className="w-3 h-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <p className="text-xs text-neutral-600 mt-1 truncate">
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 고급 설정 */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-neutral-200">
          <h4 className="text-md font-medium text-neutral-900">고급 설정</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 캐릭터 스타일 */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-700">
                캐릭터 스타일
              </label>
              <select
                value={localSettings.characterStyle}
                onChange={(e) => updateLocalSetting('characterStyle', e.target.value as any)}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                data-testid="character-style-select"
              >
                <option value="realistic">사실적</option>
                <option value="cartoon">카툰</option>
                <option value="anime">애니메이션</option>
                <option value="sketch">스케치</option>
              </select>
            </div>

            {/* 배경 스타일 */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-700">
                배경 스타일
              </label>
              <select
                value={localSettings.backgroundStyle}
                onChange={(e) => updateLocalSetting('backgroundStyle', e.target.value as any)}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                data-testid="background-style-select"
              >
                <option value="detailed">상세함</option>
                <option value="simple">간단함</option>
                <option value="minimal">최소한</option>
              </select>
            </div>

            {/* 조명 스타일 */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-700">
                조명 스타일
              </label>
              <select
                value={localSettings.lightingStyle}
                onChange={(e) => updateLocalSetting('lightingStyle', e.target.value as any)}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                data-testid="lighting-style-select"
              >
                <option value="natural">자연광</option>
                <option value="dramatic">드라마틱</option>
                <option value="soft">부드러움</option>
                <option value="high-contrast">고대비</option>
              </select>
            </div>
          </div>

          {/* 일관성 유지 옵션 */}
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-neutral-700">일관성 유지</h5>

            <div className="space-y-2">
              {[
                { key: 'maintainCharacters', label: '캐릭터 외형 유지' },
                { key: 'maintainEnvironment', label: '환경/배경 일관성' },
                { key: 'maintainColorScheme', label: '색상 팔레트 유지' }
              ].map((option) => (
                <label key={option.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings[option.key as keyof ConsistencySettings] as boolean}
                    onChange={(e) => updateLocalSetting(option.key as any, e.target.checked)}
                    disabled={disabled}
                    className="w-4 h-4 text-primary-600 bg-white border-neutral-300 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
                    data-testid={`${option.key}-checkbox`}
                  />
                  <span className="text-sm text-neutral-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          onClick={handleApply}
          disabled={disabled || !hasChanges}
          className="flex-1"
          data-testid="apply-settings-button"
        >
          설정 적용
        </Button>

        <Button
          onClick={handleReset}
          variant="outline"
          disabled={disabled}
          data-testid="reset-settings-button"
        >
          초기화
        </Button>
      </div>

      {/* 설정 미리보기 모달 */}
      {showPreview && (
        <Modal
          open={true}
          onClose={() => setShowPreview(false)}
          title="일관성 설정 미리보기"
          className="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-neutral-700">렌더링 스타일:</span>
                <p className="text-neutral-600">
                  {styleOptions.find(opt => opt.value === localSettings.style)?.label}
                </p>
              </div>

              <div>
                <span className="font-medium text-neutral-700">일관성 레벨:</span>
                <p className="text-neutral-600">
                  {localSettings.consistencyLevel}/10 ({consistencyDescription})
                </p>
              </div>

              <div>
                <span className="font-medium text-neutral-700">참조 이미지:</span>
                <p className="text-neutral-600">
                  {localSettings.referenceImages.length}개
                </p>
              </div>

              {showAdvanced && (
                <>
                  <div>
                    <span className="font-medium text-neutral-700">캐릭터 스타일:</span>
                    <p className="text-neutral-600">{localSettings.characterStyle}</p>
                  </div>

                  <div>
                    <span className="font-medium text-neutral-700">배경 스타일:</span>
                    <p className="text-neutral-600">{localSettings.backgroundStyle}</p>
                  </div>

                  <div>
                    <span className="font-medium text-neutral-700">조명 스타일:</span>
                    <p className="text-neutral-600">{localSettings.lightingStyle}</p>
                  </div>
                </>
              )}
            </div>

            {localSettings.referenceImages.length > 0 && (
              <div>
                <h4 className="font-medium text-neutral-700 mb-2">참조 이미지</h4>
                <div className="grid grid-cols-3 gap-2">
                  {localSettings.referenceImages.map((file, index) => (
                    <div key={index} className="aspect-square bg-neutral-100 rounded overflow-hidden">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`참조 이미지 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </Card>
  )
}