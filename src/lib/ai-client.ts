import { ScenePrompt, Scene } from '@/types/api';
import { z } from 'zod';

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
  mood?: string;
  camera?: string;
  weather?: string;
  characters?: string[];
  actions?: string[];
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

const AIGenerationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    prompt: z.string(),
    enhancedPrompt: z.string(),
    suggestions: z.array(z.string()).default([]),
    metadata: z.record(z.any()).default({}),
  }),
});

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
      const systemPrompt = `You are an award‑winning film director and cinematic prompt architect. Respond in English ONLY.\nGenerate a detailed and creative scene prompt based on the following requirements:\n\n- Theme: ${request.theme || 'general'}\n- Audience: ${request.targetAudience || 'general'}\n- Style: ${request.style || 'natural'}\n- Aspect Ratio: ${request.aspectRatio || '16:9'}\n- Duration: ${request.duration || 2}s\n- Mood: ${request.mood || 'default'}\n- Camera: ${request.camera || 'default'} (use English camera terms like wide, tracking, POV, top view, dolly-in, long take, handheld, drone orbital)\n- Weather: ${request.weather || 'default'}\n- Characters: ${request.characters && request.characters.length ? request.characters.join(', ') : 'none'}\n- Actions: ${request.actions && request.actions.length ? request.actions.join(', ') : 'none'}\n\nInclude:\n1) Visual description (cinematic, photorealistic)\n2) Camera movement and angles\n3) Lighting and mood\n4) Color palette\n5) 5-10 keywords (English only)\n\nReturn as valid JSON.`;

      const userPrompt = `주제: ${request.prompt}\n\n위 주제에 맞는 장면을 생성해주세요.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
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
        const safe = AIGenerationResponseSchema.safeParse({
          success: true,
          data: {
            prompt: request.prompt,
            enhancedPrompt: parsed.enhancedPrompt || content,
            suggestions: parsed.suggestions || [],
            metadata: parsed.metadata || {},
          },
        });
        if (safe.success) return safe.data;
      } catch {}
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
      const systemPrompt = `Improve the existing prompt based on the user feedback. Respond in English ONLY. Make it more specific and visually clear.`;

      const userPrompt = `기존 프롬프트: ${existingPrompt}\n\n개선 요청: ${feedback}\n\n개선된 프롬프트를 제공해주세요.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
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
      const prompt = `You are an award‑winning film director and cinematic prompt architect. Respond in English ONLY.\n\nSubject: ${request.prompt}\nTheme: ${request.theme || 'general'}\nAudience: ${request.targetAudience || 'general'}\nStyle: ${request.style || 'natural'}\nAspect Ratio: ${request.aspectRatio || '16:9'}\nDuration: ${request.duration || 2}s\nMood: ${request.mood || 'default'}\nCamera: ${request.camera || 'default'} (use English camera terms like wide, tracking, POV, top view, dolly-in, long take, handheld, drone orbital)\nWeather: ${request.weather || 'default'}\nCharacters: ${request.characters && request.characters.length ? request.characters.join(', ') : 'none'}\nActions: ${request.actions && request.actions.length ? request.actions.join(', ') : 'none'}\n\nCreate a detailed and creative scene prompt. Include:\n1) Visual description\n2) Camera movement and angles\n3) Lighting and mood\n4) Color palette\n5) 5-10 keywords (English only)\n\nReturn as valid JSON.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: this.temperature,
              maxOutputTokens: this.maxOutputTokens,
            },
          }),
        },
      );

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
        const safe = AIGenerationResponseSchema.safeParse({
          success: true,
          data: {
            prompt: request.prompt,
            enhancedPrompt: parsed.enhancedPrompt || content,
            suggestions: parsed.suggestions || [],
            metadata: parsed.metadata || {},
          },
        });
        if (safe.success) return safe.data;
      } catch {}
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
      const prompt = `Existing prompt: ${existingPrompt}\n\nFeedback: ${feedback}\n\nImprove the prompt per the feedback in English ONLY. Make it more specific and visually clear.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: this.temperature,
              maxOutputTokens: this.maxOutputTokens,
            },
          }),
        },
      );

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

  async generateScenePrompt(
    request: AIGenerationRequest,
    preferredService: 'openai' | 'gemini' = 'openai',
  ): Promise<AIGenerationResponse> {
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

  async enhancePrompt(
    existingPrompt: string,
    feedback: string,
    preferredService: 'openai' | 'gemini' = 'openai',
  ): Promise<AIGenerationResponse> {
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

  async rewritePromptForImage(prompt: string, style?: string): Promise<string> {
    return await rewritePromptForImage(prompt);
  }

  async rewritePromptForSeedance(prompt: string, options?: string): Promise<string> {
    return await rewritePromptForSeedance(prompt, {
      aspectRatio: '16:9',
      duration: 5,
      style: 'cinematic',
    });
  }

  getCurrentModel(): string {
    if (this.openaiClient) return 'gpt-4';
    if (this.geminiClient) return 'gemini-pro';
    return 'mock';
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

  // Mock 모드: 키가 없거나 NEXT_PUBLIC_ENABLE_MOCK_API=true 인 경우
  const isMock =
    process.env.NEXT_PUBLIC_ENABLE_MOCK_API === 'true' ||
    (!config.openai.apiKey && !config.gemini.apiKey);
  if (isMock) {
    class MockManager {
      async generateScenePrompt(request: AIGenerationRequest): Promise<AIGenerationResponse> {
        return {
          success: true,
          data: {
            prompt: request.prompt,
            enhancedPrompt: `A detailed cinematic description of: ${request.prompt}. Use English camera terms, realistic lighting, and clear composition.`,
            suggestions: [
              'camera panning',
              'warm lighting',
              'rain ambience',
              'wet surface reflections',
            ],
            metadata: { mock: true },
          },
        };
      }
      async enhancePrompt(existingPrompt: string, feedback: string): Promise<AIGenerationResponse> {
        return {
          success: true,
          data: {
            prompt: existingPrompt,
            enhancedPrompt: `${existingPrompt} + ${feedback}`,
            suggestions: [],
            metadata: { mock: true },
          },
        };
      }
      async rewritePromptForImage(prompt: string, style?: string): Promise<string> {
        return `Enhanced image prompt: ${prompt} --style ${style || 'cinematic'} --quality high`;
      }
      async rewritePromptForSeedance(prompt: string, options?: string): Promise<string> {
        return `${prompt} --format video --duration 5 --aspect 16:9 --style cinematic`;
      }
      isServiceAvailable() {
        return true;
      }
      getAvailableServices() {
        return ['openai'] as ('openai' | 'gemini')[];
      }
      getCurrentModel() {
        return 'mock';
      }
    }
    // @ts-expect-error: 런타임 호환 Mock 매니저 반환
    return new MockManager();
  }

  return new AIServiceManager(config);
};

export default createAIServiceManager;

// --- Lightweight translator to English ---
export async function translateToEnglish(text: string): Promise<string> {
  const src = (text || '').trim();
  if (!src) return '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

  try {
    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are an award-winning film director adapting ideas into concise, natural English prompts. Output English only. No explanation. No quotes.',
            },
            { role: 'user', content: src },
          ],
          temperature: 0.2,
        }),
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return (content || src).trim();
    }

    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: `Translate to English only. No explanation.\n\n${src}` }] },
            ],
            generationConfig: { temperature: 0.2 },
          }),
        },
      );
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return (content || src).trim();
    }
  } catch (_) {}

  // Mock/No key: return source as-is
  return src;
}

// --- Image prompt rewriter (LLM-assisted static composition) ---
export async function rewritePromptForImage(imagePrompt: string): Promise<string> {
  const src = (imagePrompt || '').trim();
  if (!src) return '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY || '';
  const fallback = src;
  try {
    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content:
                'You are an award-winning still photographer and image prompt architect. Rewrite the user prompt into a single-image prompt optimized for Imagen/SDXL style: static composition, clear subject, framing (shot/lens implied), lighting, color grading, background, and 6-12 concise tags. English only. No extra commentary.',
            },
            { role: 'user', content: src },
          ],
        }),
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return (content || fallback).trim();
    }
    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Rewrite for a single static image prompt. English only. No commentary.\n\n${src}`,
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.4 },
          }),
        },
      );
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return (content || fallback).trim();
    }
  } catch (_) {}
  return fallback;
}

// --- Seedance video prompt rewriter (LLM-assisted video optimization) ---
export async function rewritePromptForSeedance(
  videoPrompt: string,
  options?: {
    aspectRatio?: string;
    duration?: number;
    style?: string;
  },
): Promise<string> {
  const src = (videoPrompt || '').trim();
  if (!src) return '';

  const openaiKey = process.env.OPENAI_API_KEY || '';
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY || '';
  const fallback = src;

  const aspectRatio = options?.aspectRatio || '16:9';
  const duration = options?.duration || 3;
  const style = options?.style || 'cinematic';

  try {
    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: `You are an expert video prompt architect for Seedance/ModelArk video generation. Optimize the user prompt for video creation with these requirements:
- Aspect ratio: ${aspectRatio}
- Duration: ${duration} seconds
- Style: ${style}
- Focus on: dynamic movement, camera motion, temporal flow, visual continuity
- Include: scene transitions, motion cues, timing beats
- Avoid: static composition terms, single-frame descriptions
- Output: concise, vivid English video prompt
- No commentary, just the optimized prompt`,
            },
            { role: 'user', content: src },
          ],
        }),
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return (content || fallback).trim();
    }
    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Optimize this prompt for ${duration}s video generation (${aspectRatio}, ${style} style). Focus on motion, camera movement, and temporal flow. English only.\n\n${src}`,
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.3 },
          }),
        },
      );
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return (content || fallback).trim();
    }
  } catch (_) {}
  return fallback;
}

// --- Unified prompt transformation service ---
export interface PromptTransformationOptions {
  target: 'image' | 'video';
  aspectRatio?: string;
  duration?: number;
  style?: string;
  quality?: 'standard' | 'high' | 'ultra';
}

export async function transformPromptForTarget(
  originalPrompt: string,
  options: PromptTransformationOptions,
): Promise<string> {
  const { target, aspectRatio, duration, style, quality } = options;

  if (target === 'image') {
    return await rewritePromptForImage(originalPrompt);
  } else if (target === 'video') {
    return await rewritePromptForSeedance(originalPrompt, { aspectRatio, duration, style });
  }

  return originalPrompt;
}

// Extract rich scene components to fill JSON fields precisely
export async function extractSceneComponents(input: {
  scenario: string;
  theme?: string;
  style?: string;
  aspectRatio?: string;
  durationSec?: number;
  mood?: string;
  camera?: string;
  weather?: string;
}): Promise<{
  key_elements: string[];
  assembled_elements: string[];
  negative_prompts: string[];
  keywords: string[];
  timelineBeats: { action: string; audio: string }[];
}> {
  const duration = input.durationSec ?? 8;
  const beats = Math.max(1, Math.floor(duration / 2));
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

  const system = 'You are a film prompt structurer. Output ONLY valid JSON matching the schema.';
  const user = `Compose structured components in English for a cinematic scene. Return JSON with fields: {
  key_elements: string[]; // essential objects/events, 6-10
  assembled_elements: string[]; // surfaces/lighting/prop textures, 3-5
  negative_prompts: string[]; // safe constraints, 3-8
  keywords: string[]; // 8-12 concise English tags
  timelineBeats: { action: string; audio: string }[]; // exactly ${beats} items, 2s per beat
}

Context:
- Scenario: ${input.scenario}
- Theme: ${input.theme}
- Style: ${input.style}
- Aspect: ${input.aspectRatio}
- Duration: ${duration}s
- Mood: ${input.mood}
- Camera: ${input.camera}
- Weather: ${input.weather}

Guidelines:
- Use concise, vivid English.
- timelineBeats.action: one sentence describing the visual beat.
- timelineBeats.audio: one sentence listing sound design cues.
- No extra commentary.`;

  try {
    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return JSON.parse(content);
    }
    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
            generationConfig: { temperature: 0.3 },
          }),
        },
      );
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return JSON.parse(content);
    }
  } catch (e) {
    // fallthrough to mock
  }

  // Mock fallback
  const mockBeats = Array.from({ length: beats }).map((_, i) => ({
    action: [
      'Wide establishing with rain on surfaces',
      'Sniper dot triggers panic',
      'Briefcase grab and rooftop chase',
      'Helicopter light sweeps; pan up',
    ][Math.min(i, 3)],
    audio: [
      'heavy rain, distant siren',
      'laser whine, gunshots, shouts',
      'footsteps, metal clank, wind',
      'chopper blades, spotlight hum, bass swell',
    ][Math.min(i, 3)],
  }));
  return {
    key_elements: [
      'opposing groups',
      'metal briefcase',
      'sniper laser dot',
      'gunfire',
      'helicopter spotlight',
      'rooftop sprint',
    ],
    assembled_elements: ['reflective puddles', 'glowing lock panel', 'fog beam'],
    negative_prompts: ['no blood', 'no text', 'no supernatural'],
    keywords: [
      'rooftop',
      'briefcase exchange',
      'sniper ambush',
      'helicopter chase',
      'rain cinematic',
      'thriller sfx',
    ],
    timelineBeats: mockBeats,
  };
}
