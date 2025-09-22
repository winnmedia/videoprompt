/**
 * Prompt Generation Hook
 *
 * VLANET 프롬프트 생성 비즈니스 로직
 * CLAUDE.md 준수: FSD features 레이어, React Query 사용
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { convertScenarioToVLANETPrompt } from '../lib/shot-converter'
import type { Scenario } from '@/entities/scenario'
import type {
  VLANETPrompt,
  PromptGenerationInput,
  PromptGenerationResponse,
} from '@/entities/prompt'

interface UsePromptGenerationProps {
  scenario?: Scenario
}

/**
 * 프롬프트 생성 훅
 */
export function usePromptGeneration({ scenario }: UsePromptGenerationProps) {
  const queryClient = useQueryClient()

  // 프롬프트 생성 뮤테이션
  const generatePromptMutation = useMutation({
    mutationFn: async (input: PromptGenerationInput): Promise<PromptGenerationResponse> => {
      if (!scenario) {
        throw new Error('시나리오가 로드되지 않았습니다.')
      }

      const startTime = Date.now()

      try {
        // Shot converter를 사용하여 VLANET 프롬프트 생성
        const prompt = convertScenarioToVLANETPrompt(
          scenario,
          input.selectedShotIds,
          input.userPreferences
        )

        // API로 프롬프트 저장 및 검증
        const response = await fetch('/api/prompt/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            projectId: input.projectId,
            customPromptName: input.customPromptName,
          }),
        })

        if (!response.ok) {
          throw new Error('프롬프트 생성에 실패했습니다.')
        }

        const result = await response.json()
        const processingTime = Date.now() - startTime

        return {
          prompt: result.prompt,
          generatedAt: new Date().toISOString(),
          processingTimeMs: processingTime,
          warnings: result.warnings,
        }
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? error.message
            : '프롬프트 생성 중 오류가 발생했습니다.'
        )
      }
    },
    onSuccess: (data) => {
      // 성공 시 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      queryClient.invalidateQueries({ queryKey: ['prompt-history'] })
    },
  })

  // 프롬프트 히스토리 조회
  const promptHistoryQuery = useQuery({
    queryKey: ['prompt-history', scenario?.metadata.id],
    queryFn: async () => {
      if (!scenario?.metadata.id) return []

      const response = await fetch(
        `/api/prompt/history?scenarioId=${scenario.metadata.id}`
      )

      if (!response.ok) {
        throw new Error('프롬프트 히스토리 조회에 실패했습니다.')
      }

      return response.json()
    },
    enabled: !!scenario?.metadata.id,
  })

  // 프롬프트 프리뷰 생성 (로컬 처리)
  const generatePreview = (selectedShotIds: string[]): VLANETPrompt | null => {
    if (!scenario || selectedShotIds.length === 0) {
      return null
    }

    try {
      return convertScenarioToVLANETPrompt(scenario, selectedShotIds)
    } catch (error) {
      console.error('프리뷰 생성 오류:', error)
      return null
    }
  }

  // 프롬프트 삭제
  const deletePromptMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const response = await fetch(`/api/prompt/${promptId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('프롬프트 삭제에 실패했습니다.')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-history'] })
    },
  })

  // 프롬프트 업데이트
  const updatePromptMutation = useMutation({
    mutationFn: async ({
      promptId,
      updates,
    }: {
      promptId: string
      updates: Partial<VLANETPrompt>
    }) => {
      const response = await fetch(`/api/prompt/${promptId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('프롬프트 수정에 실패했습니다.')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-history'] })
    },
  })

  return {
    // 프롬프트 생성
    generatePrompt: generatePromptMutation.mutate,
    isGenerating: generatePromptMutation.isPending,
    generateError: generatePromptMutation.error,
    generateSuccess: generatePromptMutation.isSuccess,
    generatedPrompt: generatePromptMutation.data,

    // 프롬프트 히스토리
    promptHistory: promptHistoryQuery.data || [],
    isLoadingHistory: promptHistoryQuery.isLoading,
    historyError: promptHistoryQuery.error,

    // 프롬프트 프리뷰
    generatePreview,

    // 프롬프트 관리
    deletePrompt: deletePromptMutation.mutate,
    isDeleting: deletePromptMutation.isPending,
    updatePrompt: updatePromptMutation.mutate,
    isUpdating: updatePromptMutation.isPending,

    // 유틸리티
    reset: () => {
      generatePromptMutation.reset()
      deletePromptMutation.reset()
      updatePromptMutation.reset()
    },
  }
}