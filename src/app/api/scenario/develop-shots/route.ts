import { NextRequest, NextResponse } from 'next/server';
import { 
  DevelopShotsRequestSchema,
  DevelopShotsResponseSchema,
  type DevelopShotsRequest,
  type DevelopShotsResponse,
} from '@/shared/schemas/story.schema';
import { 
  createValidationErrorResponse,
  createErrorResponse 
} from '@/shared/schemas/api.schema';

// Shot 타입 정의
type Shot = {
  id: string;
  title: string;
  description: string;
};

// Gemini API를 사용하여 12샷 분해 생성
async function generateTwelveShotsWithGemini(
  structure4: DevelopShotsRequest['structure4'],
  genre: string,
  tone: string,
): Promise<Shot[]> {
  const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
  
  if (!geminiApiKey) {
    throw new Error('Google Gemini API 키가 설정되지 않았습니다');
  }

  const prompt = `다음 4단계 구성을 12개의 세부 샷으로 분해해주세요. 각 단계를 3개의 샷으로 나누어 총 12개의 샷을 만들어주세요.

4단계 구성:
${structure4.map((step, index) => `${index + 1}. ${step.title}: ${step.summary}`).join('\n')}

장르: ${genre}
톤앤매너: ${tone}

각 샷은 다음 형식의 JSON으로 반환해주세요:

{
  "shots": [
    {
      "id": "shot-1",
      "title": "샷 제목",
      "description": "샷에 대한 구체적인 설명 (카메라 앵글, 동작, 분위기 등)"
    }
  ]
}

요구사항:
1. 각 단계마다 정확히 3개의 샷 (총 12개)
2. 각 샷은 이전 샷과 자연스럽게 연결되어야 함
3. ${genre} 장르와 ${tone} 톤앤매너에 맞는 연출
4. 실제 촬영이 가능한 구체적이고 현실적인 설명
5. 카메라 워크(와이드샷, 클로즈업, 미디엄샷 등) 포함
6. id는 "shot-1"부터 "shot-12"까지 순서대로 생성

JSON만 반환해주세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
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
            maxOutputTokens: 2048,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('Gemini API에서 응답을 받지 못했습니다');
    }

    // JSON 파싱 시도
    try {
      // JSON 블록 추출 (```json ... ``` 형태 처리)
      const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : generatedText;
      
      const parsed = JSON.parse(jsonText);
      
      if (!parsed.shots || !Array.isArray(parsed.shots)) {
        throw new Error('응답 형식이 올바르지 않습니다');
      }

      // 스키마 검증
      const validatedShots = parsed.shots.map((shot: any, index: number) => {
        const shotData = {
          id: shot.id || `shot-${index + 1}`,
          title: shot.title || `샷 ${index + 1}`,
          description: shot.description || '샷 설명',
        };
        
        // 간단한 유효성 검사
        if (!shotData.id || !shotData.title || !shotData.description) {
          throw new Error(`샷 ${index + 1} 필수 필드가 누락되었습니다`);
        }
        
        return shotData;
      });

      // 정확히 12개 샷이 있는지 확인
      if (validatedShots.length !== 12) {
        throw new Error(`12개의 샷이 필요하지만 ${validatedShots.length}개가 생성되었습니다`);
      }

      return validatedShots;
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      throw new Error(`응답 파싱 실패: ${parseError instanceof Error ? parseError.message : '알 수 없는 오류'}`);
    }
  } catch (error) {
    console.error('Gemini API 호출 오류:', error);
    throw error;
  }
}

// 폴백용 기본 12샷 생성
function generateDefaultTwelveShots(
  structure4: DevelopShotsRequest['structure4'],
  genre: string,
  tone: string,
): Shot[] {
  const shots: Shot[] = [];
  
  structure4.forEach((step, stepIndex) => {
    const baseId = stepIndex * 3;
    
    // 각 단계를 3개 샷으로 분해
    const stepShots = [
      {
        id: `shot-${baseId + 1}`,
        title: `${step.title} - 도입`,
        description: `${step.summary}을 위한 설정 샷. 와이드 앵글로 상황을 보여주며 ${tone}한 분위기를 연출합니다.`,
      },
      {
        id: `shot-${baseId + 2}`,
        title: `${step.title} - 전개`, 
        description: `${step.summary}의 핵심 순간. 미디엄 샷으로 인물의 감정과 행동을 포착하며 ${genre} 장르의 특성을 살립니다.`,
      },
      {
        id: `shot-${baseId + 3}`,
        title: `${step.title} - 마무리`,
        description: `${step.summary}을 완성하는 클로즈업 샷. 디테일에 집중하여 ${tone}한 감정을 강화합니다.`,
      },
    ];
    
    shots.push(...stepShots);
  });
  
  return shots;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 입력 데이터 검증
    const validationResult = DevelopShotsRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error),
        { status: 400 },
      );
    }

    const { structure4, genre, tone } = validationResult.data;

    let shots12: Shot[];

    try {
      // Gemini API로 12샷 생성 시도
      shots12 = await generateTwelveShotsWithGemini(structure4, genre, tone);
    } catch (apiError) {
      console.warn('Gemini API 호출 실패, 기본 생성 모드로 전환:', apiError);
      
      // 폴백: 기본 12샷 생성
      shots12 = generateDefaultTwelveShots(structure4, genre, tone);
    }

    const responseData: DevelopShotsResponse = {
      timestamp: new Date().toISOString(),
      success: true,
      data: {
        shots12,
        metadata: {
          originalStructure: structure4,
          genre,
          tone,
          generatedAt: new Date().toISOString(),
          aiModel: process.env.GOOGLE_GEMINI_API_KEY ? 'gemini-1.5-flash' : 'fallback',
        },
      },
    };

    // 응답 데이터 검증
    const responseValidation = DevelopShotsResponseSchema.safeParse(responseData);
    
    if (!responseValidation.success) {
      console.error('응답 데이터 검증 실패:', responseValidation.error);
      return NextResponse.json(
        createErrorResponse('RESPONSE_VALIDATION_ERROR', '응답 데이터 형식이 올바르지 않습니다'),
        { status: 500 }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('12샷 분해 API 오류:', error);

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';

    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', errorMessage),
      { status: 500 },
    );
  }
}