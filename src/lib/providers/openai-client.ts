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
    try {
      console.log('DEBUG: OpenAI 스토리 생성 시작:', {
        story: options.story.slice(0, 100),
        genre: options.genre,
        tone: options.tone,
      });

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

      // JSON 파싱 시도
      let parsedStructure;
      try {
        // JSON 블록 추출 (```json으로 감싸져 있을 수 있음)
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
        parsedStructure = JSON.parse(jsonString);
      } catch (parseError) {
        console.warn('DEBUG: OpenAI 응답 JSON 파싱 실패, 원문 반환:', parseError);
        parsedStructure = null;
      }

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
        hasStructure: !!parsedStructure,
      });

      return {
        ok: true,
        content,
        structure: parsedStructure,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          estimatedCost,
        },
        model: response.model,
      };

    } catch (error) {
      console.error('DEBUG: OpenAI 스토리 생성 실패:', error);
      return {
        ok: false,
        error: `OpenAI API 호출 실패: ${(error as Error).message}`,
      };
    }
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