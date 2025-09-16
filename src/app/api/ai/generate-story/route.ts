import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateStoryWithOpenAI } from '@/lib/providers/openai-client';
import {
  createValidationErrorResponse,
  createErrorResponse,
  createSuccessResponse
} from '@/shared/schemas/api.schema';
import { getUserIdFromRequest } from '@/shared/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 스토리 생성 요청 스키마
const StoryGenerationSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(100, '제목은 100자 이하로 입력해주세요'),
  oneLineStory: z.string().min(1, '한 줄 스토리를 입력해주세요').max(200, '한 줄 스토리는 200자 이하로 입력해주세요'),
  toneAndManner: z.string().min(1, '톤앤매너를 선택해주세요'),
  genre: z.string().min(1, '장르를 선택해주세요'),
  target: z.string().min(1, '타겟 관객을 입력해주세요'),
  duration: z.string().default('60초'),
  format: z.string().default('16:9'),
  tempo: z.string().default('보통'),
  developmentMethod: z.string().default('클래식 기승전결'),
  developmentIntensity: z.string().default('보통'),
});

interface StoryStep {
  step: number;
  title: string;
  description: string;
  keyElements: string[];
  emotionalArc: string;
  duration?: string;
  visualDirection?: string;
}

// Gemini API를 사용한 스토리 생성
async function generateStoryWithGemini(data: z.infer<typeof StoryGenerationSchema>): Promise<{
  success: boolean;
  steps?: StoryStep[];
  usage?: any;
  model?: string;
  error?: string;
}> {
  const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!geminiApiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.');
  }

  const systemPrompt = `당신은 전문적인 영상 시나리오 작가입니다. 주어진 요구사항에 따라 체계적이고 창의적인 4단계 스토리 구조를 생성해주세요.

응답은 반드시 다음 JSON 형식으로 제공해주세요:

{
  "steps": [
    {
      "step": 1,
      "title": "1단계 제목",
      "description": "1단계 상세 설명 (2-3문장)",
      "keyElements": ["핵심요소1", "핵심요소2", "핵심요소3"],
      "emotionalArc": "감정 변화 설명",
      "duration": "예상 시간",
      "visualDirection": "시각적 연출 방향"
    },
    {
      "step": 2,
      "title": "2단계 제목",
      "description": "2단계 상세 설명 (2-3문장)",
      "keyElements": ["핵심요소1", "핵심요소2", "핵심요소3"],
      "emotionalArc": "감정 변화 설명",
      "duration": "예상 시간",
      "visualDirection": "시각적 연출 방향"
    },
    {
      "step": 3,
      "title": "3단계 제목",
      "description": "3단계 상세 설명 (2-3문장)",
      "keyElements": ["핵심요소1", "핵심요소2", "핵심요소3"],
      "emotionalArc": "감정 변화 설명",
      "duration": "예상 시간",
      "visualDirection": "시각적 연출 방향"
    },
    {
      "step": 4,
      "title": "4단계 제목",
      "description": "4단계 상세 설명 (2-3문장)",
      "keyElements": ["핵심요소1", "핵심요소2", "핵심요소3"],
      "emotionalArc": "감정 변화 설명",
      "duration": "예상 시간",
      "visualDirection": "시각적 연출 방향"
    }
  ]
}`;

  const userPrompt = `다음 조건에 맞는 영상 스토리를 생성해주세요:

제목: ${data.title}
한 줄 스토리: ${data.oneLineStory}
톤앤매너: ${data.toneAndManner}
장르: ${data.genre}
타겟 관객: ${data.target}
영상 길이: ${data.duration}
영상 비율: ${data.format}
템포: ${data.tempo}
전개 방식: ${data.developmentMethod}
전개 강도: ${data.developmentIntensity}

위 조건들을 모두 고려하여 매력적이고 논리적인 4단계 구조의 스토리를 만들어주세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
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
                  text: `${systemPrompt}\n\n${userPrompt}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API 오류 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('Gemini에서 응답을 받지 못했습니다');
    }

    // JSON 파싱 시도
    let parsedResult;
    try {
      // JSON 블록 추출 (```json으로 감싸져 있을 수 있음)
      const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/) || generatedText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : generatedText;
      parsedResult = JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error(`Gemini 응답 JSON 파싱 실패: ${parseError}`);
    }

    if (!parsedResult.steps || !Array.isArray(parsedResult.steps)) {
      throw new Error('Gemini 응답에서 steps 배열을 찾을 수 없습니다');
    }

    return {
      success: true,
      steps: parsedResult.steps,
      usage: result.usageMetadata,
      model: 'Gemini 2.0 Flash',
    };

  } catch (error) {
    console.error('DEBUG: Gemini 스토리 생성 실패:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('DEBUG: 스토리 생성 요청 수신:', {
      hasTitle: !!body.title,
      hasStory: !!body.oneLineStory,
      genre: body.genre,
      target: body.target,
    });

    // 입력 데이터 검증
    const validationResult = StoryGenerationSchema.safeParse(body);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));

      const primaryError = errorDetails[0];
      console.error('DEBUG: 스토리 생성 입력 검증 실패:', errorDetails);
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', primaryError ? primaryError.message : '입력 데이터가 올바르지 않습니다'),
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 사용자 인증 (선택적)
    let userId: string | null = null;
    try {
      const user = await getUserIdFromRequest(request);
      userId = user || null;
    } catch (authError) {
      console.log('DEBUG: 스토리 생성 인증 실패 (계속 진행):', authError);
    }

    console.log('DEBUG: 스토리 생성 시작 - Gemini 우선 시도');

    // 1단계: Gemini 2.0 Flash 시도 (주요)
    try {
      const geminiResult = await generateStoryWithGemini(data);

      if (geminiResult.success && geminiResult.steps) {
        console.log('DEBUG: Gemini 스토리 생성 성공:', {
          model: geminiResult.model,
          stepCount: geminiResult.steps.length,
          usage: geminiResult.usage,
        });

        const response = createSuccessResponse({
          steps: geminiResult.steps,
          metadata: {
            userId,
            provider: 'gemini',
            model: geminiResult.model,
            usage: geminiResult.usage,
            requestData: data,
            generatedAt: new Date().toISOString(),
          }
        });

        return NextResponse.json(response);
      }
    } catch (geminiError) {
      console.warn('DEBUG: Gemini 실패, OpenAI로 폴백:', geminiError);
    }

    // 2단계: OpenAI 폴백 시도
    console.log('DEBUG: OpenAI 폴백 시도');

    try {
      const openaiResult = await generateStoryWithOpenAI({
        story: data.oneLineStory,
        genre: data.genre,
        tone: data.toneAndManner,
        target: data.target,
        duration: data.duration,
        format: data.format,
        tempo: data.tempo,
        developmentMethod: data.developmentMethod,
        developmentIntensity: data.developmentIntensity,
      });

      if (openaiResult.ok && openaiResult.structure) {
        // OpenAI 응답을 표준 형식으로 변환
        const steps: StoryStep[] = [
          {
            step: 1,
            title: openaiResult.structure.act1?.title || '1막',
            description: openaiResult.structure.act1?.description || '',
            keyElements: openaiResult.structure.act1?.key_elements || [],
            emotionalArc: openaiResult.structure.act1?.emotional_arc || '',
          },
          {
            step: 2,
            title: openaiResult.structure.act2?.title || '2막',
            description: openaiResult.structure.act2?.description || '',
            keyElements: openaiResult.structure.act2?.key_elements || [],
            emotionalArc: openaiResult.structure.act2?.emotional_arc || '',
          },
          {
            step: 3,
            title: openaiResult.structure.act3?.title || '3막',
            description: openaiResult.structure.act3?.description || '',
            keyElements: openaiResult.structure.act3?.key_elements || [],
            emotionalArc: openaiResult.structure.act3?.emotional_arc || '',
          },
          {
            step: 4,
            title: openaiResult.structure.act4?.title || '4막',
            description: openaiResult.structure.act4?.description || '',
            keyElements: openaiResult.structure.act4?.key_elements || [],
            emotionalArc: openaiResult.structure.act4?.emotional_arc || '',
          },
        ];

        console.log('DEBUG: OpenAI 스토리 생성 성공:', {
          model: openaiResult.model,
          stepCount: steps.length,
          usage: openaiResult.usage,
        });

        const response = createSuccessResponse({
          steps,
          metadata: {
            userId,
            provider: 'openai',
            model: openaiResult.model,
            usage: openaiResult.usage,
            requestData: data,
            generatedAt: new Date().toISOString(),
            fallbackReason: 'Gemini API 실패',
          }
        });

        return NextResponse.json(response);
      }

      throw new Error(openaiResult.error || 'OpenAI 스토리 생성 실패');

    } catch (openaiError) {
      console.error('DEBUG: OpenAI 폴백도 실패:', openaiError);
    }

    // 모든 AI 서비스 실패 시 에러 반환
    return NextResponse.json(
      createErrorResponse(
        'ALL_AI_SERVICES_FAILED',
        'Gemini와 OpenAI 모든 스토리 생성 서비스가 현재 사용 불가능합니다. 잠시 후 다시 시도해주세요.'
      ),
      { status: 503 }
    );

  } catch (error) {
    console.error('DEBUG: 스토리 생성 라우트 예상치 못한 오류:', error);
    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        '스토리 생성 중 서버 오류가 발생했습니다'
      ),
      { status: 500 }
    );
  }
}

// GET 요청으로 서비스 상태 확인
export async function GET() {
  try {
    const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    const status = {
      service: 'Story Generation (Gemini + OpenAI)',
      status: 'operational',
      providers: {
        primary: {
          name: 'Gemini 2.0 Flash',
          available: !!geminiApiKey,
          priority: 1,
        },
        fallback: {
          name: 'OpenAI GPT-4o Mini',
          available: !!openaiApiKey,
          priority: 2,
        },
      },
      capabilities: {
        fourStepStructure: true,
        emotionalArc: true,
        visualDirection: true,
        keyElements: true,
        customGenre: true,
        targetAudience: true,
      },
      pricing: {
        gemini: 'Gemini 2.0 Flash: $0.10 input + $0.40 output per 1M tokens',
        openai: 'GPT-4o Mini: $0.15 input + $0.60 output per 1M tokens',
        recommendation: geminiApiKey ? 'Gemini (34% 저렴)' : 'OpenAI만 사용 가능',
      }
    };

    if (!geminiApiKey && !openaiApiKey) {
      status.status = 'configuration_error';
    }

    return NextResponse.json(status);

  } catch (error) {
    console.error('스토리 생성 상태 확인 오류:', error);
    return NextResponse.json({
      service: 'Story Generation',
      status: 'error',
      error: (error as Error).message,
    }, { status: 500 });
  }
}