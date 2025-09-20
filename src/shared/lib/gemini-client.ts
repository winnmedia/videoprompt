import { logger } from './logger';

/**
 * Gemini 2.0 Flash Preview Client
 *
 * 모든 Gemini API 호출을 위한 중앙집중화된 클라이언트
 * - Exponential backoff 재시도
 * - Rate limiting
 * - 에러 분류 및 처리
 * - 로깅 및 모니터링
 */

export interface GeminiConfig {
  apiKey: string;
  model: 'gemini-2.0-flash-exp' | 'gemini-1.5-flash';
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
}

export interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  };
}

export interface GeminiError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

// 재시도 가능한 HTTP 상태 코드
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// Exponential backoff 유틸리티
function exponentialBackoff(attempt: number): number {
  const baseDelay = 1000; // 1초
  const maxDelay = 30000; // 30초
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * 1000; // 지터 추가
}

// Sleep 유틸리티
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gemini API 클라이언트 클래스
 */
export class GeminiClient {
  private config: Required<GeminiConfig>;
  private rateLimitWindow = new Map<string, { count: number; resetTime: number }>();
  private readonly MAX_REQUESTS_PER_MINUTE = 60;
  private readonly MAX_RETRIES = 3;

  constructor(config: GeminiConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'gemini-2.0-flash-exp',
      temperature: config.temperature ?? 0.7,
      topK: config.topK ?? 40,
      topP: config.topP ?? 0.95,
      maxOutputTokens: config.maxOutputTokens ?? 8192
    };

    this.validateConfig();
  }

  /**
   * 설정 유효성 검증
   */
  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('Gemini API 키가 필요합니다');
    }

    if (this.config.apiKey === 'your-actual-gemini-key') {
      throw new Error('유효한 Gemini API 키를 설정해주세요');
    }

    if (!this.config.apiKey.startsWith('AIza')) {
      throw new Error('올바른 Gemini API 키 형식이 아닙니다');
    }
  }

  /**
   * Rate limiting 확인
   */
  private checkRateLimit(key: string = 'default'): boolean {
    const now = Date.now();
    const windowStart = now - 60000; // 1분 윈도우

    let rateLimitInfo = this.rateLimitWindow.get(key);

    if (!rateLimitInfo || rateLimitInfo.resetTime < windowStart) {
      rateLimitInfo = { count: 0, resetTime: now + 60000 };
      this.rateLimitWindow.set(key, rateLimitInfo);
    }

    if (rateLimitInfo.count >= this.MAX_REQUESTS_PER_MINUTE) {
      return false;
    }

    rateLimitInfo.count++;
    return true;
  }

  /**
   * Gemini API 호출
   */
  async generateContent(
    request: GeminiRequest,
    options?: {
      rateLimitKey?: string;
      maxRetries?: number;
      enableLogging?: boolean;
    }
  ): Promise<string> {
    const {
      rateLimitKey = 'default',
      maxRetries = this.MAX_RETRIES,
      enableLogging = process.env.NODE_ENV === 'development'
    } = options || {};

    // Rate limiting 확인
    if (!this.checkRateLimit(rateLimitKey)) {
      throw this.createError(
        'Rate limit exceeded. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    // 요청에 기본 설정 병합
    const finalRequest: GeminiRequest = {
      ...request,
      generationConfig: {
        temperature: this.config.temperature,
        topK: this.config.topK,
        topP: this.config.topP,
        maxOutputTokens: this.config.maxOutputTokens,
        ...request.generationConfig
      }
    };

    let lastError: GeminiError | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = exponentialBackoff(attempt - 1);
        if (enableLogging) {
          logger.info(`[Gemini] Retry attempt ${attempt} after ${delay}ms delay`);
        }
        await sleep(delay);
      }

      try {
        if (enableLogging) {
          logger.info(`[Gemini] API call attempt ${attempt + 1}/${maxRetries}`);
          logger.info(`[Gemini] Model: ${this.config.model}`);
          logger.info(`[Gemini] Token limit: ${this.config.maxOutputTokens}`);
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://www.vridge.kr',
            },
            body: JSON.stringify(finalRequest),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          const error = this.createError(
            `API call failed: ${response.status} ${response.statusText}`,
            response.status,
            this.getErrorCode(response.status),
            { responseText: errorText }
          );

          // 재시도 가능한 에러인지 확인
          if (RETRYABLE_STATUS_CODES.includes(response.status)) {
            lastError = error;
            continue;
          }

          // 클라이언트 에러는 재시도하지 않음
          throw error;
        }

        const data: GeminiResponse = await response.json();

        if (enableLogging) {
          logger.info('[Gemini] API response received', {
            candidates: data.candidates?.length || 0,
            hasContent: !!data.candidates?.[0]?.content,
            finishReason: data.candidates?.[0]?.finishReason
          });
        }

        // 안전성 필터링 확인
        if (data.promptFeedback?.blockReason) {
          throw this.createError(
            'Content was blocked by safety filters',
            400,
            'CONTENT_BLOCKED',
            { blockReason: data.promptFeedback.blockReason }
          );
        }

        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
          const error = this.createError(
            'Empty response from Gemini API',
            500,
            'EMPTY_RESPONSE',
            { finishReason: data.candidates?.[0]?.finishReason }
          );
          lastError = error;
          continue;
        }

        if (enableLogging) {
          logger.info(`[Gemini] Success! Generated ${generatedText.length} characters`);
        }

        return generatedText;

      } catch (error) {
        if (enableLogging) {
          console.error(`[Gemini] Attempt ${attempt + 1} failed:`, error);
        }
        lastError = error as GeminiError;
      }
    }

    // 모든 재시도 실패
    throw lastError || this.createError('All retry attempts failed', 503, 'MAX_RETRIES_EXCEEDED');
  }

  /**
   * JSON 응답을 위한 특수 메서드
   */
  async generateJSON<T = any>(
    request: GeminiRequest,
    options?: {
      rateLimitKey?: string;
      maxRetries?: number;
      enableLogging?: boolean;
    }
  ): Promise<T> {
    const rawResponse = await this.generateContent(request, options);

    // JSON 파싱 시도
    let parseAttempts = 0;
    let cleanText = rawResponse.trim();

    while (parseAttempts < 3) {
      try {
        // 코드 블록 제거
        if (cleanText.includes('```')) {
          cleanText = cleanText.replace(/```json\s*/gi, '');
          cleanText = cleanText.replace(/```\s*/g, '');
        }

        // JSON 시작과 끝 찾기
        const jsonStart = cleanText.indexOf('{');
        const jsonEnd = cleanText.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
        }

        return JSON.parse(cleanText);

      } catch (parseError) {
        parseAttempts++;

        if (parseAttempts >= 3) {
          throw this.createError(
            'Failed to parse JSON response from Gemini',
            500,
            'JSON_PARSE_ERROR',
            { rawResponse: rawResponse.substring(0, 1000), parseError }
          );
        }

        // 간단한 정규식으로 JSON 추출 재시도
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanText = jsonMatch[0];
        } else {
          break;
        }
      }
    }

    throw this.createError(
      'Could not extract valid JSON from response',
      500,
      'JSON_EXTRACTION_ERROR',
      { rawResponse }
    );
  }

  /**
   * 에러 생성 유틸리티
   */
  private createError(
    message: string,
    status?: number,
    code?: string,
    details?: any
  ): GeminiError {
    const error = new Error(message) as GeminiError;
    error.status = status;
    error.code = code;
    error.details = details;
    return error;
  }

  /**
   * HTTP 상태 코드에서 에러 코드 추출
   */
  private getErrorCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT'
    };

    return codeMap[status] || 'UNKNOWN_ERROR';
  }

  /**
   * 클라이언트 상태 정보
   */
  getStatus() {
    return {
      model: this.config.model,
      rateLimits: Object.fromEntries(this.rateLimitWindow.entries()),
      maxTokens: this.config.maxOutputTokens
    };
  }
}

/**
 * 싱글톤 Gemini 클라이언트 인스턴스 생성
 */
export function createGeminiClient(): GeminiClient {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY environment variable is required');
  }

  return new GeminiClient({
    apiKey,
    model: 'gemini-2.0-flash-exp',
    maxOutputTokens: 8192,
    temperature: 0.7
  });
}

/**
 * 기본 클라이언트 인스턴스 (lazy initialization)
 */
let defaultClient: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!defaultClient) {
    defaultClient = createGeminiClient();
  }
  return defaultClient;
}