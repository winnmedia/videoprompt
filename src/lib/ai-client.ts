import { ScenePrompt, Scene } from '@/types/api';

// AI 서비스 타입 정의
export interface AIServiceConfig {
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  gemini: {
    apiKey: string;
    model: string;
    temperature: number;
    maxOutputTokens: number;
  };
}

export interface AIGenerationRequest {
  prompt: string;
  style?: string;
  aspectRatio?: string;
  duration?: number;
  theme?: string;
  targetAudience?: string;
}

export interface AIGenerationResponse {
  success: boolean;
  data?: {
    prompt: string;
    enhancedPrompt: string;
    suggestions: string[];
    metadata: Record<string, any>;
  };
  error?: string;
}

// OpenAI 클라이언트
class OpenAIClient {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: AIServiceConfig['openai']) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
  }

  async generateScenePrompt(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    try {
      const systemPrompt = `당신은 전문적인 영상 시나리오 작가입니다. 
다음 요구사항에 맞는 상세하고 창의적인 장면 프롬프트를 생성해주세요:

- 테마: ${request.theme || '일반'}
- 대상: ${request.targetAudience || '전체'}
- 스타일: ${request.style || '자연스러운'}
- 화면비: ${request.aspectRatio || '16:9'}
- 지속시간: ${request.duration || 2}초

프롬프트는 다음 요소를 포함해야 합니다:
1. 장면의 시각적 묘사
2. 카메라 움직임과 앵글
3. 조명과 분위기
4. 색상 팔레트
5. 키워드 5-10개

응답은 JSON 형식으로 제공해주세요.`;

      const userPrompt = `주제: ${request.prompt}

위 주제에 맞는 장면을 생성해주세요.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: this.maxTokens,
          temperature: this.temperature,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // JSON 파싱 시도
      try {
        const parsed = JSON.parse(content);
        return {
          success: true,
          data: {
            prompt: request.prompt,
            enhancedPrompt: parsed.enhancedPrompt || content,
            suggestions: parsed.suggestions || [],
            metadata: parsed.metadata || {},
          },
        };
      } catch {
        // JSON 파싱 실패 시 일반 텍스트로 처리
        return {
          success: true,
          data: {
            prompt: request.prompt,
            enhancedPrompt: content,
            suggestions: [],
            metadata: {},
          },
        };
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async enhancePrompt(existingPrompt: string, feedback: string): Promise<AIGenerationResponse> {
    try {
      const systemPrompt = `기존 프롬프트를 사용자 피드백에 따라 개선해주세요.
더 구체적이고 시각적으로 명확하게 만들어주세요.`;

      const userPrompt = `기존 프롬프트: ${existingPrompt}

개선 요청: ${feedback}

개선된 프롬프트를 제공해주세요.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: this.maxTokens,
          temperature: this.temperature,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      return {
        success: true,
        data: {
          prompt: existingPrompt,
          enhancedPrompt: content || existingPrompt,
          suggestions: [],
          metadata: {},
        },
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Gemini AI 클라이언트
class GeminiClient {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxOutputTokens: number;

  constructor(config: AIServiceConfig['gemini']) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.temperature = config.temperature;
    this.maxOutputTokens = config.maxOutputTokens;
  }

  async generateScenePrompt(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    try {
      const prompt = `당신은 전문적인 영상 시나리오 작가입니다.

주제: ${request.prompt}
테마: ${request.theme || '일반'}
대상: ${request.targetAudience || '전체'}
스타일: ${request.style || '자연스러운'}
화면비: ${request.aspectRatio || '16:9'}
지속시간: ${request.duration || 2}초

위 요구사항에 맞는 상세하고 창의적인 장면 프롬프트를 생성해주세요.
프롬프트는 다음 요소를 포함해야 합니다:
1. 장면의 시각적 묘사
2. 카메라 움직임과 앵글
3. 조명과 분위기
4. 색상 팔레트
5. 키워드 5-10개

JSON 형식으로 응답해주세요.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: this.temperature,
            maxOutputTokens: this.maxOutputTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error('No content received from Gemini');
      }

      // JSON 파싱 시도
      try {
        const parsed = JSON.parse(content);
        return {
          success: true,
          data: {
            prompt: request.prompt,
            enhancedPrompt: parsed.enhancedPrompt || content,
            suggestions: parsed.suggestions || [],
            metadata: parsed.metadata || {},
          },
        };
      } catch {
        // JSON 파싱 실패 시 일반 텍스트로 처리
        return {
          success: true,
          data: {
            prompt: request.prompt,
            enhancedPrompt: content,
            suggestions: [],
            metadata: {},
          },
        };
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async enhancePrompt(existingPrompt: string, feedback: string): Promise<AIGenerationResponse> {
    try {
      const prompt = `기존 프롬프트: ${existingPrompt}

개선 요청: ${feedback}

기존 프롬프트를 사용자 피드백에 따라 개선해주세요.
더 구체적이고 시각적으로 명확하게 만들어주세요.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: this.temperature,
            maxOutputTokens: this.maxOutputTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      return {
        success: true,
        data: {
          prompt: existingPrompt,
          enhancedPrompt: content || existingPrompt,
          suggestions: [],
          metadata: {},
        },
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// AI 서비스 매니저
export class AIServiceManager {
  private openaiClient: OpenAIClient | null = null;
  private geminiClient: GeminiClient | null = null;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
    
    if (config.openai.apiKey) {
      this.openaiClient = new OpenAIClient(config.openai);
    }
    
    if (config.gemini.apiKey) {
      this.geminiClient = new GeminiClient(config.gemini);
    }
  }

  async generateScenePrompt(request: AIGenerationRequest, preferredService: 'openai' | 'gemini' = 'openai'): Promise<AIGenerationResponse> {
    // 선호하는 서비스가 사용 가능한지 확인
    if (preferredService === 'openai' && this.openaiClient) {
      const result = await this.openaiClient.generateScenePrompt(request);
      if (result.success) return result;
    }
    
    if (preferredService === 'gemini' && this.geminiClient) {
      const result = await this.geminiClient.generateScenePrompt(request);
      if (result.success) return result;
    }

    // 선호 서비스 실패 시 다른 서비스 시도
    if (preferredService === 'openai' && this.geminiClient) {
      return await this.geminiClient.generateScenePrompt(request);
    }
    
    if (preferredService === 'gemini' && this.openaiClient) {
      return await this.openaiClient.generateScenePrompt(request);
    }

    // 모든 서비스 실패
    return {
      success: false,
      error: 'No AI service available',
    };
  }

  async enhancePrompt(existingPrompt: string, feedback: string, preferredService: 'openai' | 'gemini' = 'openai'): Promise<AIGenerationResponse> {
    if (preferredService === 'openai' && this.openaiClient) {
      const result = await this.openaiClient.enhancePrompt(existingPrompt, feedback);
      if (result.success) return result;
    }
    
    if (preferredService === 'gemini' && this.geminiClient) {
      const result = await this.geminiClient.enhancePrompt(existingPrompt, feedback);
      if (result.success) return result;
    }

    // 선호 서비스 실패 시 다른 서비스 시도
    if (preferredService === 'openai' && this.geminiClient) {
      return await this.geminiClient.enhancePrompt(existingPrompt, feedback);
    }
    
    if (preferredService === 'gemini' && this.openaiClient) {
      return await this.openaiClient.enhancePrompt(existingPrompt, feedback);
    }

    return {
      success: false,
      error: 'No AI service available',
    };
  }

  isServiceAvailable(service: 'openai' | 'gemini'): boolean {
    if (service === 'openai') return !!this.openaiClient;
    if (service === 'gemini') return !!this.geminiClient;
    return false;
  }

  getAvailableServices(): ('openai' | 'gemini')[] {
    const services: ('openai' | 'gemini')[] = [];
    if (this.openaiClient) services.push('openai');
    if (this.geminiClient) services.push('gemini');
    return services;
  }
}

// 기본 설정으로 AI 서비스 매니저 생성
export const createAIServiceManager = (): AIServiceManager => {
  const config: AIServiceConfig = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
      maxTokens: 2000,
      temperature: 0.7,
    },
    gemini: {
      apiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
      model: 'gemini-pro',
      temperature: 0.7,
      maxOutputTokens: 2000,
    },
  };

  return new AIServiceManager(config);
};

export default createAIServiceManager;
