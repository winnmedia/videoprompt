/**
 * Gemini API Client (Temporarily Disabled)
 *
 * 한국어 문자열 인코딩 문제로 임시 비활성화
 * 추후 수정 예정
 */

// 임시 타입 정의
export interface StoryGenerationRequest {
  prompt: string
  genre?: string
  targetDuration?: number
  style?: string
  tone?: string
}

export interface StoryGenerationResponse {
  storyOutline: string
  scenes: any[]
  suggestedKeywords: string[]
  estimatedDuration: number
}

// 임시 구현
export class GeminiClient {
  static async generateStory(request: StoryGenerationRequest): Promise<StoryGenerationResponse> {
    console.warn('GeminiClient is temporarily disabled')

    return {
      storyOutline: `임시 스토리 아웃라인: ${request.prompt}`,
      scenes: [],
      suggestedKeywords: ['임시', '키워드'],
      estimatedDuration: request.targetDuration || 300
    }
  }
}

export default GeminiClient