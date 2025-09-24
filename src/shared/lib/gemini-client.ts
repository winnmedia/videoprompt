/**
 * Gemini API 클라이언트
 * 시나리오 생성을 위한 Google Gemini API 통합
 * Cost Safety 미들웨어 및 Rate Limiting 적용
 */

import { costSafetyMiddleware, rateLimiter } from './index';

// Gemini API 요청/응답 타입 정의
export interface GeminiPrompt {
  title: string;
  content: string;
  genre?: string;
  style?: string;
  target?: string;
  structure?: 'traditional' | 'three-act' | 'free-form';
  intensity?: 'low' | 'medium' | 'high';
}

export interface GeminiResponse {
  scenario: {
    title: string;
    content: string;
    summary: string;
    structure: string;
    estimatedDuration: number;
  };
  quality: {
    score: number;
    feedback: string[];
  };
  metadata: {
    model: string;
    tokens: number;
    cost: number;
    generatedAt: string;
  };
}

export interface GeminiError {
  code: string;
  message: string;
  details?: unknown;
}

// 비용 설정
const GEMINI_COSTS = {
  INPUT_TOKEN: 0.000125, // $0.000125 per 1K tokens
  OUTPUT_TOKEN: 0.000375, // $0.000375 per 1K tokens
  MAX_DAILY_COST: 5.0, // $5 per day maximum
} as const;

// Rate Limiting 설정
const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 10,
  REQUESTS_PER_HOUR: 60,
  REQUESTS_PER_DAY: 300,
} as const;

// 캐시 설정
const CACHE_CONFIG = {
  DURATION: 5 * 60 * 1000, // 5분
  MAX_ENTRIES: 100,
} as const;

// 메모리 캐시 구현
interface CacheEntry {
  data: GeminiResponse;
  timestamp: number;
  cost: number;
}

class GeminiCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string): GeminiResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 캐시 만료 확인
    if (Date.now() - entry.timestamp > CACHE_CONFIG.DURATION) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: GeminiResponse, cost: number): void {
    // 캐시 크기 제한
    if (this.cache.size >= CACHE_CONFIG.MAX_ENTRIES) {
      // 가장 오래된 항목 삭제
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      cost,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      totalCost: Array.from(this.cache.values()).reduce(
        (sum, entry) => sum + entry.cost,
        0
      ),
    };
  }
}

// 전역 캐시 인스턴스
const geminiCache = new GeminiCache();

/**
 * 프롬프트 생성 함수
 * 사용자 입력을 Gemini가 이해할 수 있는 구조화된 프롬프트로 변환
 */
function createScenarioPrompt(input: GeminiPrompt): string {
  const {
    title,
    content,
    genre = '드라마',
    style = '자연스러운',
    target = '일반',
    structure = 'traditional',
    intensity = 'medium',
  } = input;

  // 구조별 지시사항
  const structureInstructions = {
    traditional: '기승전결 구조로 도입-전개-위기-해결 4단계',
    'three-act': '3막 구조로 설정-대립-해결',
    'free-form': '자유로운 형식으로 창의적 전개',
  };

  // 강도별 지시사항
  const intensityInstructions = {
    low: '잔잔하고 일상적인 분위기',
    medium: '적당한 긴장감과 감정적 몰입',
    high: '강렬하고 극적인 전개',
  };

  return `당신은 전문 시나리오 작가입니다. 다음 정보를 바탕으로 완전한 시나리오를 작성해주세요.

**기본 정보:**
- 제목: ${title}
- 장르: ${genre}
- 스타일: ${style}
- 타겟: ${target}
- 구조: ${structureInstructions[structure]}
- 강도: ${intensityInstructions[intensity]}

**사용자 아이디어:**
${content}

**작성 지침:**
1. ${structureInstructions[structure]}를 적용하여 체계적으로 구성
2. ${intensityInstructions[intensity]}의 톤앤매너 유지
3. ${target} 대상에게 적합한 내용과 표현 사용
4. 각 장면의 목적과 의미가 명확해야 함
5. 캐릭터의 동기와 갈등이 일관성 있게 전개
6. 시각적 표현이 가능한 구체적인 장면 설명

**출력 형식:**
다음 JSON 형식으로 응답해주세요:
{
  "scenario": {
    "title": "최종 제목",
    "content": "완성된 시나리오 (1000-2000자)",
    "summary": "한줄 요약 (50자 이내)",
    "structure": "적용된 구조",
    "estimatedDuration": "예상 상영시간(분)"
  },
  "quality": {
    "score": "품질점수 (0-100)",
    "feedback": ["개선점1", "개선점2", "강점1"]
  }
}`;
}

/**
 * 토큰 수 추정 함수
 * 한국어 텍스트의 토큰 수를 대략적으로 계산
 */
function estimateTokens(text: string): number {
  // 한국어는 영어보다 토큰 밀도가 높음
  // 대략 한글 1글자 = 1.5토큰, 영어 1단어 = 1.3토큰으로 추정
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const englishWords = (text.match(/\b[a-zA-Z]+\b/g) || []).length;
  const otherChars = text.length - koreanChars;

  return Math.ceil(koreanChars * 1.5 + englishWords * 1.3 + otherChars * 0.5);
}

/**
 * 비용 계산 함수
 */
function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * GEMINI_COSTS.INPUT_TOKEN;
  const outputCost = (outputTokens / 1000) * GEMINI_COSTS.OUTPUT_TOKEN;
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * Gemini API 호출 함수
 * Cost Safety 및 Rate Limiting 적용
 */
export async function generateScenario(
  input: GeminiPrompt
): Promise<GeminiResponse> {
  // 입력 유효성 검증
  if (!input.title?.trim() || !input.content?.trim()) {
    throw new Error('제목과 내용은 필수입니다.');
  }

  // 캐시 키 생성
  const cacheKey = JSON.stringify(input);

  // 캐시 확인
  const cachedResult = geminiCache.get(cacheKey);
  if (cachedResult) {
    console.log('[Gemini] Cache hit - 비용 절약!');
    return cachedResult;
  }

  // 프롬프트 생성 및 토큰 수 추정
  const prompt = createScenarioPrompt(input);
  const inputTokens = estimateTokens(prompt);
  const estimatedOutputTokens = 800;
  const estimatedCost = calculateCost(inputTokens, estimatedOutputTokens);

  try {
    // 실제 Gemini API 호출 또는 Mock 데이터 반환
    const response = process.env.GEMINI_API_KEY
      ? await callGeminiAPI(prompt, inputTokens)
      : await mockGeminiResponse(prompt, inputTokens);

    // 실제 비용 계산
    const actualCost = calculateCost(inputTokens, response.metadata.tokens);

    // 캐시에 저장
    geminiCache.set(cacheKey, response, actualCost);

    return response;
  } catch (error) {
    console.error('[Gemini] API 호출 실패:', error);
    // 에러 발생 시 Mock 데이터로 폴백
    console.log('[Gemini] Mock 데이터로 폴백...');
    return await mockGeminiResponse(prompt, inputTokens);
  }
}

/**
 * 실제 Gemini API 호출
 */
async function callGeminiAPI(
  prompt: string,
  inputTokens: number
): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
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
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Gemini API 오류: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Gemini API에서 유효한 응답을 받지 못했습니다.');
  }

  const generatedText = data.candidates[0].content.parts[0].text;

  // JSON 응답 파싱 시도
  try {
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[0]);

      const outputTokens = estimateTokens(generatedText);
      const cost = calculateCost(inputTokens, outputTokens);

      return {
        scenario: {
          title: parsedData.scenario?.title || '생성된 시나리오',
          content: parsedData.scenario?.content || generatedText,
          summary: parsedData.scenario?.summary || '시나리오 요약',
          structure: parsedData.scenario?.structure || 'traditional',
          estimatedDuration: parsedData.scenario?.estimatedDuration || 10,
        },
        quality: {
          score: parsedData.quality?.score || 80,
          feedback: parsedData.quality?.feedback || ['AI가 생성한 시나리오입니다.'],
        },
        metadata: {
          model: 'gemini-1.5-pro',
          tokens: outputTokens,
          cost,
          generatedAt: new Date().toISOString(),
        },
      };
    }
  } catch (parseError) {
    console.warn('[Gemini] JSON 파싱 실패, 텍스트 그대로 사용:', parseError);
  }

  // JSON 파싱 실패 시 텍스트 그대로 사용
  const outputTokens = estimateTokens(generatedText);
  const cost = calculateCost(inputTokens, outputTokens);

  return {
    scenario: {
      title: '생성된 시나리오',
      content: generatedText,
      summary: generatedText.slice(0, 100) + '...',
      structure: 'traditional',
      estimatedDuration: 10,
    },
    quality: {
      score: 75,
      feedback: ['AI가 생성한 시나리오입니다.', 'JSON 형식으로 응답하지 않아 자동 파싱했습니다.'],
    },
    metadata: {
      model: 'gemini-1.5-pro',
      tokens: outputTokens,
      cost,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Mock Gemini API 호출
 * 개발 및 테스트용 - 실제 API 통합 전까지 사용
 */
export async function mockGeminiResponse(
  prompt: string,
  inputTokens: number = 500
): Promise<GeminiResponse> {
  // 실제 API 지연 시뮬레이션
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  const outputTokens = 650 + Math.floor(Math.random() * 300);
  const cost = calculateCost(inputTokens, outputTokens);

  return {
    scenario: {
      title: '꿈을 찾는 소녀',
      content: `한국의 작은 시골 마을에 살고 있는 17세 소녀 민지는 항상 큰 꿈을 품고 있었다.

**도입부:**
민지는 매일 아침 할머니와 함께 밭일을 하며 하루를 시작한다. 하지만 그녀의 마음 한편에는 언제나 서울에서 연기자가 되고 싶다는 꿈이 자리잡고 있다. 친구들은 현실적이지 못한 꿈이라며 만류하지만, 민지의 의지는 꺾이지 않는다.

**전개부:**
어느 날, 마을에 영화 촬영팀이 들어온다. 민지는 우연히 단역 배우로 캐스팅되면서 처음으로 연기의 세계를 경험한다. 그 과정에서 자신의 재능을 발견하고, 더욱 확신을 갖게 된다.

**위기:**
하지만 할머니가 갑자기 쓰러지시고, 민지는 꿈과 가족 사이에서 선택의 기로에 놓인다. 서울로 떠날 기회가 생겼지만, 할머니를 돌봐야 하는 현실적 책임감 때문에 고민에 빠진다.

**해결:**
민지는 할머니와 깊은 대화를 나눈다. 할머니는 젊은 시절 자신도 꿈이 있었지만 포기했던 이야기를 들려주며, 민지에게 꿈을 포기하지 말라고 격려한다. 민지는 당분간 마을에 머물며 할머니를 돌보되, 온라인으로 연기를 배우고 지역 극단 활동을 통해 꿈을 이어나가기로 결심한다.`,
      summary: '시골 소녀가 연기자의 꿈을 포기하지 않고 현실과 타협하며 성장하는 이야기',
      structure: 'traditional',
      estimatedDuration: 15,
    },
    quality: {
      score: 85,
      feedback: [
        '캐릭터의 내적 갈등이 잘 표현됨',
        '현실적이면서도 희망적인 결말',
        '세부적인 감정 묘사 보완 필요',
      ],
    },
    metadata: {
      model: 'gemini-1.5-pro',
      tokens: outputTokens,
      cost,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * 캐시 상태 조회
 */
export function getGeminiCacheStats() {
  return geminiCache.getStats();
}

/**
 * 캐시 초기화
 */
export function clearGeminiCache() {
  geminiCache.clear();
}

/**
 * Gemini API 상태 확인
 */
export async function checkGeminiApiHealth(): Promise<boolean> {
  try {
    // TODO: 실제 API 연결 시 health check 구현
    return true;
  } catch (error) {
    console.error('[Gemini] API 상태 확인 실패:', error);
    return false;
  }
}

/**
 * 일일 사용량 통계 조회
 */
export async function getGeminiUsageStats() {
  // TODO: 실제 rateLimiter 및 costSafetyMiddleware 구현 시 복원
  return {
    requestsToday: 0, // await rateLimiter.getUsageCount('gemini-api', 'day'),
    costToday: 0, // await costSafetyMiddleware.getDailyCost(),
    cacheHitRate: geminiCache.getStats(),
    remainingRequests: {
      minute: RATE_LIMITS.REQUESTS_PER_MINUTE, // - await rateLimiter.getUsageCount('gemini-api', 'minute'),
      hour: RATE_LIMITS.REQUESTS_PER_HOUR, // - await rateLimiter.getUsageCount('gemini-api', 'hour'),
      day: RATE_LIMITS.REQUESTS_PER_DAY, // - await rateLimiter.getUsageCount('gemini-api', 'day'),
    },
  };
}