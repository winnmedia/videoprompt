import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';

interface InsertRequest {
  shotTitle: string;
  shotDescription: string;
  genre?: string;
  tone?: string;
  context?: string;
}

interface InsertShot {
  id: string;
  purpose: string;
  description: string;
  framing: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: InsertRequest = await request.json();
    const { shotTitle, shotDescription, genre = 'drama', tone = 'neutral', context = '' } = body;

    if (!shotTitle || !shotDescription) {
      return NextResponse.json({ error: '샷 제목과 설명은 필수입니다.' }, { status: 400 });
    }

    // Google Gemini API 키 확인
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (geminiApiKey) {
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
                      text: `다음 영상 샷에 대한 5개의 인서트 샷을 추천해주세요:

샷 제목: ${shotTitle}
샷 설명: ${shotDescription}
장르: ${genre}
톤: ${tone}
컨텍스트: ${context || '없음'}

인서트 샷은 메인 샷을 보완하고 영상의 품질을 향상시키는 역할을 합니다. 
다음과 같은 목적을 고려하여 추천해주세요:

1. 정보 보강: 중요한 정보나 디테일을 강조
2. 감정 표현: 캐릭터의 감정이나 반응 표현  
3. 분위기 조성: 장면의 분위기나 톤 강화
4. 리듬 조절: 영상의 템포와 흐름 조절
5. 관계 강조: 캐릭터나 요소 간의 관계 표현

다음 JSON 형식으로 응답해주세요:

{
  "insertShots": [
    {
      "id": "insert-1",
      "purpose": "목적 (예: 정보 보강)",
      "description": "구체적인 인서트 샷 설명 (1-2문장)",
      "framing": "프레이밍 (예: 클로즈업, 미디엄 샷, 와이드 샷 등)"
    },
    {
      "id": "insert-2", 
      "purpose": "목적",
      "description": "설명", 
      "framing": "프레이밍"
    },
    {
      "id": "insert-3",
      "purpose": "목적",
      "description": "설명",
      "framing": "프레이밍" 
    },
    {
      "id": "insert-4",
      "purpose": "목적", 
      "description": "설명",
      "framing": "프레이밍"
    },
    {
      "id": "insert-5",
      "purpose": "목적",
      "description": "설명", 
      "framing": "프레이밍"
    }
  ]
}

각 인서트 샷은 메인 샷과 조화를 이루면서도 고유한 가치를 제공해야 합니다.`,
                    },
                  ],
                },
              ],
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          const generatedText = data.candidates[0]?.content?.parts[0]?.text;

          if (generatedText) {
            try {
              // JSON 파싱 시도
              const parsedResponse = JSON.parse(generatedText);
              return NextResponse.json(parsedResponse);
            } catch (parseError) {
              logger.error('JSON 파싱 실패', parseError instanceof Error ? parseError : new Error(String(parseError)));
              // 파싱 실패 시 기본 인서트 샷 반환
              return NextResponse.json({
                insertShots: generateDefaultInsertShots(shotTitle, shotDescription)
              });
            }
          }
        }
      } catch (apiError) {
        logger.error('Gemini API 호출 실패', apiError instanceof Error ? apiError : new Error(String(apiError)));
      }
    }

    // API 키가 없거나 실패 시 기본 인서트 샷 반환
    return NextResponse.json({
      insertShots: generateDefaultInsertShots(shotTitle, shotDescription)
    });
    
  } catch (error) {
    logger.error('인서트 샷 생성 오류:', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: '인서트 샷 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

function generateDefaultInsertShots(shotTitle: string, shotDescription: string): InsertShot[] {
  return [
    {
      id: `insert-${Date.now()}-1`,
      purpose: '정보 보강',
      description: `${shotTitle}의 핵심 요소를 강조하는 클로즈업 샷`,
      framing: '클로즈업',
    },
    {
      id: `insert-${Date.now()}-2`,
      purpose: '감정 표현',
      description: '등장인물의 표정이나 반응을 포착하는 샷',
      framing: '타이트 샷',
    },
    {
      id: `insert-${Date.now()}-3`,
      purpose: '분위기 조성',
      description: '장면의 전체적인 분위기를 보여주는 환경 샷',
      framing: '미디엄 샷',
    },
    {
      id: `insert-${Date.now()}-4`,
      purpose: '리듬 조절',
      description: '영상의 흐름을 조절하는 디테일 샷',
      framing: '익스트림 클로즈업',
    },
    {
      id: `insert-${Date.now()}-5`,
      purpose: '관계 강조',
      description: '대상 간의 관계나 상호작용을 보여주는 샷',
      framing: '투샷',
    },
  ];
}