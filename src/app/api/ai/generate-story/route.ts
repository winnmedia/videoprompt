import { NextRequest, NextResponse } from 'next/server';

interface StoryRequest {
  story: string;
  genre: string;
  tone: string;
  target: string;
}

interface StoryStructure {
  act1: {
    title: string;
    description: string;
    key_elements: string[];
    emotional_arc: string;
  };
  act2: {
    title: string;
    description: string;
    key_elements: string[];
    emotional_arc: string;
  };
  act3: {
    title: string;
    description: string;
    key_elements: string[];
    emotional_arc: string;
  };
  act4: {
    title: string;
    description: string;
    key_elements: string[];
    emotional_arc: string;
  };
}

interface StoryResponse {
  structure: StoryStructure;
  visual_style: string[];
  mood_palette: string[];
  technical_approach: string[];
  target_audience_insights: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: StoryRequest = await request.json();
    const { story, genre, tone, target } = body;

    if (!story || !genre || !tone) {
      return NextResponse.json({ error: '스토리, 장르, 톤앤매너는 필수입니다.' }, { status: 400 });
    }

    // Google Gemini API 키 확인
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (geminiApiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
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
                      text: `다음 정보를 바탕으로 4단계 시나리오 구조를 생성해주세요:

스토리: ${story}
장르: ${genre}
톤앤매너: ${tone}
타겟 오디언스: ${target || '일반'}

다음 JSON 형식으로 응답해주세요:

{
  "structure": {
    "act1": {
      "title": "도입부 제목",
      "description": "도입부 설명 (2-3문장)",
      "key_elements": ["핵심 요소1", "핵심 요소2", "핵심 요소3"],
      "emotional_arc": "감정적 변화"
    },
    "act2": {
      "title": "전개부 제목", 
      "description": "전개부 설명 (2-3문장)",
      "key_elements": ["핵심 요소1", "핵심 요소2", "핵심 요소3"],
      "emotional_arc": "감정적 변화"
    },
    "act3": {
      "title": "위기부 제목",
      "description": "위기부 설명 (2-3문장)", 
      "key_elements": ["핵심 요소1", "핵심 요소2", "핵심 요소3"],
      "emotional_arc": "감정적 변화"
    },
    "act4": {
      "title": "해결부 제목",
      "description": "해결부 설명 (2-3문장)",
      "key_elements": ["핵심 요소1", "핵심 요소2", "핵심 요소3"], 
      "emotional_arc": "감정적 변화"
    }
  },
  "visual_style": ["영상미 스타일1", "영상미 스타일2"],
  "mood_palette": ["분위기1", "분위기2"],
  "technical_approach": ["기술적 접근1", "기술적 접근2"],
  "target_audience_insights": ["인사이트1", "인사이트2"]
}

각 액트는 영화의 3막 구조를 확장한 4단계로 구성하고, 각 단계마다 명확한 목적과 감정적 변화를 포함해야 합니다.`,
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
              console.error('JSON 파싱 실패:', parseError);
              // 파싱 실패 시 기본 구조 반환
              return NextResponse.json(generateDefaultStructure(story, genre, tone, target));
            }
          }
        }
      } catch (apiError) {
        console.error('Gemini API 호출 실패:', apiError);
      }
    }

    // API 키가 없거나 실패 시 기본 구조 반환
    return NextResponse.json(generateDefaultStructure(story, genre, tone, target));
  } catch (error) {
    console.error('스토리 생성 오류:', error);
    return NextResponse.json({ error: '스토리 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

function generateDefaultStructure(
  story: string,
  genre: string,
  tone: string,
  target: string,
): StoryResponse {
  // 장르별 기본 구조 템플릿
  const genreTemplates = {
    drama: {
      act1: {
        title: '도입',
        description: '주인공과 기본 상황 소개',
        emotional_arc: '평온 → 호기심',
      },
      act2: { title: '전개', description: '갈등과 문제 상황 발생', emotional_arc: '혼란 → 고민' },
      act3: { title: '위기', description: '최대 위기 상황 도달', emotional_arc: '절망 → 각오' },
      act4: { title: '해결', description: '문제 해결과 성장', emotional_arc: '희망 → 성취' },
    },
    comedy: {
      act1: {
        title: '도입',
        description: '유쾌한 상황과 캐릭터 소개',
        emotional_arc: '평온 → 즐거움',
      },
      act2: { title: '전개', description: '재미있는 사건들 발생', emotional_arc: '즐거움 → 웃음' },
      act3: { title: '위기', description: '웃픈 위기 상황', emotional_arc: '당황 → 재미' },
      act4: { title: '해결', description: '해피엔딩과 웃음', emotional_arc: '기쁨 → 만족' },
    },
    action: {
      act1: { title: '도입', description: '액션 영웅과 배경 소개', emotional_arc: '평온 → 긴장' },
      act2: { title: '전개', description: '첫 번째 액션과 갈등', emotional_arc: '긴장 → 흥분' },
      act3: { title: '위기', description: '최고조 액션과 위기', emotional_arc: '흥분 → 절박' },
      act4: { title: '해결', description: '최종 승리와 해결', emotional_arc: '절박 → 승리' },
    },
    romance: {
      act1: { title: '도입', description: '만남과 첫 인상', emotional_arc: '무관심 → 호기심' },
      act2: { title: '전개', description: '서로를 알아가는 과정', emotional_arc: '호기심 → 호감' },
      act3: { title: '위기', description: '오해와 갈등 발생', emotional_arc: '호감 → 고민' },
      act4: { title: '해결', description: '화해와 사랑의 승리', emotional_arc: '고민 → 사랑' },
    },
    mystery: {
      act1: { title: '도입', description: '수수께끼와 의문 상황', emotional_arc: '평온 → 호기심' },
      act2: { title: '전개', description: '단서 발견과 추리', emotional_arc: '호기심 → 집중' },
      act3: { title: '위기', description: '위험과 절박한 상황', emotional_arc: '집중 → 공포' },
      act4: { title: '해결', description: '진실 발견과 해결', emotional_arc: '공포 → 안도' },
    },
  };

  const template = genreTemplates[genre as keyof typeof genreTemplates] || genreTemplates.drama;

  return {
    structure: {
      act1: {
        ...template.act1,
        key_elements: [`${genre}적 요소 1`, `${genre}적 요소 2`, `${genre}적 요소 3`],
      },
      act2: {
        ...template.act2,
        key_elements: [`${genre}적 요소 1`, `${genre}적 요소 2`, `${genre}적 요소 3`],
      },
      act3: {
        ...template.act3,
        key_elements: [`${genre}적 요소 1`, `${genre}적 요소 2`, `${genre}적 요소 3`],
      },
      act4: {
        ...template.act4,
        key_elements: [`${genre}적 요소 1`, `${genre}적 요소 2`, `${genre}적 요소 3`],
      },
    },
    visual_style: ['Cinematic', 'Photorealistic'],
    mood_palette: [tone, 'Immersive'],
    technical_approach: ['Dynamic Camera', 'Emotional Lighting'],
    target_audience_insights: [`${target}에게 어필하는 요소`, '감정적 몰입도'],
  };
}
