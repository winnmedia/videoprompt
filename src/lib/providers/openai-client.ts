/**
 * OpenAI API Client for Story Generation
 *
 * Gemini 2.0 Flash의 대안으로 사용 가능한 OpenAI GPT 모델들
 * - GPT-4o Mini: $0.15/1M input + $0.60/1M output (권장)
 * - GPT-4o: $2.50/1M input + $10.00/1M output
 * - GPT-3.5 Turbo: $0.50/1M input + $1.50/1M output
 */

export interface OpenAIConfig {
  apiKey: string;
  model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo' | 'gpt-4';
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface OpenAIRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StoryGenerationOptions {
  story: string;
  genre: string;
  tone: string;
  target: string;
  duration?: string;
  format?: string;
  tempo?: string;
  developmentMethod?: string;
  developmentIntensity?: string;
}

export interface StoryGenerationResult {
  ok: boolean;
  content?: string;
  structure?: any;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number; // USD
  };
  error?: string;
  model?: string;
}

// 모델별 가격 (2025년 기준, USD per 1M tokens)
const MODEL_PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-4': { input: 30.00, output: 60.00 },
} as const;

// 비용 계산
function calculateCost(
  model: keyof typeof MODEL_PRICING,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  const inputCost = (promptTokens / 1000000) * pricing.input;
  const outputCost = (completionTokens / 1000000) * pricing.output;
  return inputCost + outputCost;
}

// OpenAI 클라이언트 클래스
export class OpenAIClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다. OPENAI_API_KEY 환경변수를 설정해주세요.');
    }
  }

  async generateText(request: OpenAIRequest): Promise<OpenAIResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'User-Agent': 'VideoPlanet-OpenAI-Client/1.0',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API 오류 (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async generateStory(options: StoryGenerationOptions): Promise<StoryGenerationResult> {
    return this.generateStoryWithRetry(options, 3);
  }

  private async generateStoryWithRetry(options: StoryGenerationOptions, maxRetries: number): Promise<StoryGenerationResult> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`DEBUG: OpenAI 스토리 생성 시작 (시도 ${attempt}/${maxRetries}):`, {
          story: options.story.slice(0, 100),
          genre: options.genre,
          tone: options.tone,
        });

        const result = await this.generateStoryAttempt(options);

        if (result.ok) {
          return result;
        }

        lastError = new Error(result.error);

        // 재시도 가능한 에러인지 확인
        if (!this.isRetryableError(result.error)) {
          break;
        }

        // 마지막 시도가 아니면 잠시 대기
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 지수 백오프
          console.log(`DEBUG: ${delayMs}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (error) {
        lastError = error;

        // 재시도 가능한 에러인지 확인
        if (!this.isRetryableError((error as Error).message)) {
          break;
        }

        // 마지막 시도가 아니면 잠시 대기
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`DEBUG: 에러 발생, ${delayMs}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // 모든 시도 실패
    console.error('DEBUG: OpenAI 스토리 생성 최종 실패:', lastError);
    return {
      ok: false,
      error: this.createUserFriendlyError(lastError),
    };
  }

  private async generateStoryAttempt(options: StoryGenerationOptions): Promise<StoryGenerationResult> {
    // 시스템 프롬프트 구성
    const systemPrompt = `당신은 전문적인 영상 시나리오 작가입니다. 주어진 요구사항에 따라 체계적이고 창의적인 스토리 구조를 생성해주세요.

응답은 반드시 다음 JSON 형식으로 제공해주세요:

{
  "structure": {
    "act1": {
      "title": "1막 제목",
      "description": "1막 상세 설명",
      "key_elements": ["핵심요소1", "핵심요소2", "핵심요소3"],
      "emotional_arc": "감정 변화"
    },
    "act2": {
      "title": "2막 제목",
      "description": "2막 상세 설명",
      "key_elements": ["핵심요소1", "핵심요소2", "핵심요소3"],
      "emotional_arc": "감정 변화"
    },
    "act3": {
      "title": "3막 제목",
      "description": "3막 상세 설명",
      "key_elements": ["핵심요소1", "핵심요소2", "핵심요소3"],
      "emotional_arc": "감정 변화"
    },
    "act4": {
      "title": "4막 제목",
      "description": "4막 상세 설명",
      "key_elements": ["핵심요소1", "핵심요소2", "핵심요소3"],
      "emotional_arc": "감정 변화"
    }
  },
  "visual_style": ["시각적스타일1", "시각적스타일2"],
  "mood_palette": ["분위기1", "분위기2"],
  "technical_approach": ["기술적접근1", "기술적접근2"],
  "target_audience_insights": ["타겟분석1", "타겟분석2"]
}`;

    // 사용자 프롬프트 구성
    const userPrompt = `다음 조건에 맞는 영상 스토리를 생성해주세요:

스토리: ${options.story}
장르: ${options.genre}
톤앤매너: ${options.tone}
타겟 관객: ${options.target}
영상 길이: ${options.duration || '60초'}
영상 비율: ${options.format || '16:9'}
템포: ${options.tempo || '보통'}
전개 방식: ${options.developmentMethod || '클래식 기승전결'}
전개 강도: ${options.developmentIntensity || '보통'}

위 조건들을 모두 고려하여 매력적이고 논리적인 4막 구조의 스토리를 만들어주세요.`;

    // OpenAI API 호출
    const response = await this.generateText({
      model: 'gpt-4o-mini', // 가장 비용 효율적인 모델
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      top_p: 0.9,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI에서 응답을 받지 못했습니다');
    }

    // 안전한 JSON 파싱 및 구조 검증
    const parseResult = this.safeParseStoryStructure(content);

    // 비용 계산
    const usage = response.usage;
    const estimatedCost = calculateCost(
      'gpt-4o-mini',
      usage.prompt_tokens,
      usage.completion_tokens
    );

    console.log('DEBUG: OpenAI 스토리 생성 성공:', {
      model: response.model,
      tokensUsed: usage.total_tokens,
      estimatedCost: `$${estimatedCost.toFixed(4)}`,
      hasStructure: parseResult.success,
      parseError: parseResult.error,
    });

    return {
      ok: true,
      content,
      structure: parseResult.data,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        estimatedCost,
      },
      model: response.model,
    };
  }

  private safeParseStoryStructure(content: string): { success: boolean; data?: any; error?: string } {
    try {
      // JSON 블록 추출 시도
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

      const parsed = JSON.parse(jsonString);

      // 기본 구조 검증 및 기본값 적용
      const hasValidStructure = parsed.structure &&
        parsed.structure.act1 &&
        parsed.structure.act2 &&
        parsed.structure.act3 &&
        parsed.structure.act4;

      // structure 키가 없는 경우 직접 act 키를 확인
      const hasDirectActStructure = !parsed.structure &&
        parsed.act1 &&
        parsed.act2 &&
        parsed.act3 &&
        parsed.act4;

      if (!hasValidStructure && !hasDirectActStructure) {
        console.warn('DEBUG: OpenAI 응답 구조 불완전, 기본값 적용');
        return {
          success: false,
          error: '4막 구조가 불완전합니다',
          data: this.createFallbackStructure(),
        };
      }

      // 직접 act 구조인 경우 structure 래퍼 추가
      if (hasDirectActStructure) {
        console.log('DEBUG: 직접 act 구조 감지, structure 래퍼 추가');
        return {
          success: true,
          data: {
            structure: {
              act1: parsed.act1,
              act2: parsed.act2,
              act3: parsed.act3,
              act4: parsed.act4,
            },
            visual_style: parsed.visual_style || ['기본 스타일'],
            mood_palette: parsed.mood_palette || ['기본 분위기'],
            technical_approach: parsed.technical_approach || ['기본 접근'],
            target_audience_insights: parsed.target_audience_insights || ['일반 시청자'],
          },
        };
      }

      return {
        success: true,
        data: parsed,
      };
    } catch (parseError) {
      console.warn('DEBUG: OpenAI 응답 JSON 파싱 실패, 기본 구조 반환:', parseError);
      return {
        success: false,
        error: `JSON 파싱 실패: ${(parseError as Error).message}`,
        data: this.createFallbackStructure(),
      };
    }
  }

  private createFallbackStructure() {
    return {
      structure: {
        act1: {
          title: 'AI 생성 스토리 - 1막',
          description: '스토리가 시작됩니다. 주인공과 상황을 소개합니다.',
          key_elements: ['주인공 등장', '배경 설정', '갈등 암시'],
          emotional_arc: '호기심과 기대감',
        },
        act2: {
          title: 'AI 생성 스토리 - 2막',
          description: '갈등이 심화되고 문제가 복잡해집니다.',
          key_elements: ['갈등 발생', '장애물 등장', '선택의 기로'],
          emotional_arc: '긴장감과 불안',
        },
        act3: {
          title: 'AI 생성 스토리 - 3막',
          description: '절정에 도달하며 모든 갈등이 폭발합니다.',
          key_elements: ['최대 위기', '결단의 순간', '행동'],
          emotional_arc: '극도의 긴장과 몰입',
        },
        act4: {
          title: 'AI 생성 스토리 - 4막',
          description: '갈등이 해결되고 이야기가 마무리됩니다.',
          key_elements: ['갈등 해결', '교훈', '새로운 시작'],
          emotional_arc: '카타르시스와 만족감',
        },
      },
      visual_style: ['감정적', '따뜻함'],
      mood_palette: ['희망적', '감동적'],
      technical_approach: ['클래식한 연출'],
      target_audience_insights: ['보편적 감정 어필'],
    };
  }

  private isRetryableError(errorMessage?: string): boolean {
    if (!errorMessage) return false;

    const retryableErrors = [
      'rate limit',
      'timeout',
      'network',
      '500',
      '502',
      '503',
      '504',
      'Internal server error',
      'Service unavailable',
      'Gateway timeout',
    ];

    return retryableErrors.some(error =>
      errorMessage.toLowerCase().includes(error.toLowerCase())
    );
  }

  private createUserFriendlyError(error: any): string {
    const errorMessage = error?.message || String(error);

    // 기술적 세부사항 숨기고 사용자 친화적 메시지로 변환
    if (errorMessage.includes('rate limit')) {
      return 'AI 서비스 사용량이 많습니다. 잠시 후 다시 시도해주세요.';
    }

    if (errorMessage.includes('invalid api key') || errorMessage.includes('unauthorized')) {
      return 'AI 서비스 연결에 문제가 있습니다. 관리자에게 문의해주세요.';
    }

    if (errorMessage.includes('content') && errorMessage.includes('policy')) {
      return '입력하신 내용이 AI 정책에 위배됩니다. 다른 내용으로 시도해주세요.';
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
    }

    if (errorMessage.includes('500') || errorMessage.includes('Internal server error')) {
      return 'AI 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
    }

    // 기본 에러 메시지 (기술적 세부사항 제거)
    return '스토리 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
}

// 싱글톤 인스턴스
let openaiClient: OpenAIClient | null = null;

export function getOpenAIClient(): OpenAIClient {
  if (!openaiClient) {
    openaiClient = new OpenAIClient();
  }
  return openaiClient;
}

// 편의 함수
export async function generateStoryWithOpenAI(
  options: StoryGenerationOptions
): Promise<StoryGenerationResult> {
  const client = getOpenAIClient();
  return client.generateStory(options);
}

// 모델별 비용 비교 함수
export function compareModelCosts(promptTokens: number, completionTokens: number) {
  const models = Object.keys(MODEL_PRICING) as Array<keyof typeof MODEL_PRICING>;

  return models.map(model => ({
    model,
    cost: calculateCost(model, promptTokens, completionTokens),
    pricing: MODEL_PRICING[model],
  })).sort((a, b) => a.cost - b.cost);
}

// Gemini와 비용 비교
export function compareWithGemini(promptTokens: number, completionTokens: number) {
  // Gemini 2.0 Flash: $0.10 input + $0.40 output per 1M tokens
  const geminiCost = (promptTokens / 1000000) * 0.10 + (completionTokens / 1000000) * 0.40;
  const openaiCosts = compareModelCosts(promptTokens, completionTokens);

  return {
    gemini: {
      model: 'Gemini 2.0 Flash',
      cost: geminiCost,
      pricing: { input: 0.10, output: 0.40 },
    },
    openai: openaiCosts,
    recommendation: geminiCost < openaiCosts[0].cost ? 'Gemini' : openaiCosts[0].model,
    savings: geminiCost < openaiCosts[0].cost
      ? `Gemini이 ${((openaiCosts[0].cost - geminiCost) / openaiCosts[0].cost * 100).toFixed(1)}% 저렴`
      : `${openaiCosts[0].model}이 ${((geminiCost - openaiCosts[0].cost) / geminiCost * 100).toFixed(1)}% 저렴`,
  };
}