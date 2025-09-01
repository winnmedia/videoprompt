import { NextRequest, NextResponse } from 'next/server';

interface PromptRequest {
  story: string;
  scenario: {
    genre: string;
    tone: string;
    structure: any;
  };
  visual_preferences: {
    style: string[];
    mood: string[];
    technical: string[];
  };
  target_audience: string;
}

interface PromptResponse {
  base_style: {
    visual_style: string[];
    genre: string[];
    mood: string[];
    quality: string[];
    director_style?: string[];
  };
  spatial_context: {
    weather: string[];
    lighting: string[];
  };
  camera_setting: {
    primary_lens: string[];
    dominant_movement: string[];
  };
  core_object: {
    material: string[];
  };
  timeline: {
    angle: string[];
    move: string[];
    pacing: string[];
    audio_quality: string[];
  };
  final_prompt: string;
  negative_prompt: string;
  keywords: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: PromptRequest = await request.json();
    const { story, scenario, visual_preferences, target_audience } = body;

    if (!story || !scenario) {
      return NextResponse.json({ error: '스토리와 시나리오는 필수입니다.' }, { status: 400 });
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
                      text: `다음 정보를 바탕으로 영상 제작을 위한 체계적인 프롬프트를 생성해주세요:

스토리: ${story}
장르: ${scenario.genre}
톤앤매너: ${scenario.tone}
타겟 오디언스: ${target_audience}
시각적 선호도: ${visual_preferences.style.join(', ')}

INSTRUCTION.md의 요구사항에 따라 다음 JSON 형식으로 응답해주세요:

{
  "base_style": {
    "visual_style": ["Photorealistic", "Cinematic"],
    "genre": ["Action-Thriller", "Modern Drama"],
    "mood": ["Tense", "Moody"],
    "quality": ["4K", "IMAX Quality"],
    "director_style": ["Christopher Nolan style"]
  },
  "spatial_context": {
    "weather": ["Clear", "Overcast"],
    "lighting": ["Golden Hour", "Blue Hour"]
  },
  "camera_setting": {
    "primary_lens": ["24mm Wide-angle", "50mm Standard"],
    "dominant_movement": ["Smooth Tracking", "Static Shot"]
  },
  "core_object": {
    "material": ["Brushed Metal", "Transparent Glass"]
  },
  "timeline": {
    "angle": ["Wide Shot", "Medium Shot", "Close Up"],
    "move": ["Pan Left", "Dolly In", "Tracking Follow"],
    "pacing": ["Real-time", "Slow-motion (0.5x)"],
    "audio_quality": ["Clear", "Crisp"]
  },
  "final_prompt": "최종 프롬프트 텍스트",
  "negative_prompt": "제외할 요소들",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}

각 카테고리는 INSTRUCTION.md에 정의된 옵션 중에서 선택하고, 스토리와 장르에 맞는 적절한 조합을 만들어주세요.`,
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
              // 파싱 실패 시 기본 프롬프트 반환
              return NextResponse.json(
                generateDefaultPrompt(story, scenario, visual_preferences, target_audience),
              );
            }
          }
        }
      } catch (apiError) {
        console.error('Gemini API 호출 실패:', apiError);
      }
    }

    // API 키가 없거나 실패 시 기본 프롬프트 반환
    return NextResponse.json(
      generateDefaultPrompt(story, scenario, visual_preferences, target_audience),
    );
  } catch (error) {
    console.error('프롬프트 생성 오류:', error);
    return NextResponse.json({ error: '프롬프트 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

function generateDefaultPrompt(
  story: string,
  scenario: any,
  visual_preferences: any,
  target_audience: string,
): PromptResponse {
  // 장르별 기본 프롬프트 템플릿
  const genreTemplates = {
    drama: {
      visual_style: ['Photorealistic', 'Cinematic'],
      mood: ['Moody', 'Serene'],
      lighting: ['Golden Hour', 'Blue Hour'],
      lens: ['50mm Standard', '85mm Portrait'],
      movement: ['Static Shot', 'Smooth Tracking'],
    },
    comedy: {
      visual_style: ['Modern', 'Cinematic'],
      mood: ['Energetic', 'Light'],
      lighting: ['Daylight', 'Studio Lighting'],
      lens: ['24mm Wide-angle', '35mm Standard'],
      movement: ['Handheld', 'Zoom'],
    },
    action: {
      visual_style: ['Hyperrealistic', 'Cinematic'],
      mood: ['Tense', 'Energetic'],
      lighting: ['Studio Lighting', 'Dynamic'],
      lens: ['16mm Fisheye', '24mm Wide-angle'],
      movement: ['Shaky Handheld', 'Crane Shot'],
    },
    romance: {
      visual_style: ['Cinematic', 'Vintage Film'],
      mood: ['Warm', 'Serene'],
      lighting: ['Golden Hour', 'Soft'],
      lens: ['85mm Portrait', '135mm Telephoto'],
      movement: ['Smooth Tracking', 'Static Shot'],
    },
    mystery: {
      visual_style: ['Cinematic', 'Anamorphic'],
      mood: ['Moody', 'Gritty'],
      lighting: ['Blue Hour', 'Flickering Light'],
      lens: ['50mm Standard', '85mm Portrait'],
      movement: ['Static Shot', 'Slow Pan'],
    },
  };

  const template =
    genreTemplates[scenario.genre as keyof typeof genreTemplates] || genreTemplates.drama;

  // 스토리에서 키워드 추출
  const storyKeywords = story
    .split(' ')
    .filter((word) => word.length > 3)
    .slice(0, 5);

  // 최종 프롬프트 생성
  const finalPrompt = `${story} - ${template.visual_style[0]} style, ${template.mood[0]} mood, ${template.lighting[0]} lighting, ${template.lens[0]} lens, ${template.movement[0]} movement, 4K quality, cinematic composition`;

  return {
    base_style: {
      visual_style: template.visual_style,
      genre: [scenario.genre, 'Modern'],
      mood: template.mood,
      quality: ['4K', 'IMAX Quality'],
      director_style: ['Professional style'],
    },
    spatial_context: {
      weather: ['Clear', 'Overcast'],
      lighting: template.lighting,
    },
    camera_setting: {
      primary_lens: template.lens,
      dominant_movement: template.movement,
    },
    core_object: {
      material: ['Brushed Metal', 'Transparent Glass', 'Matte Plastic'],
    },
    timeline: {
      angle: ['Wide Shot', 'Medium Shot', 'Close Up'],
      move: ['Pan Left', 'Dolly In', 'Tracking Follow'],
      pacing: ['Real-time', 'Slow-motion (0.5x)'],
      audio_quality: ['Clear', 'Crisp'],
    },
    final_prompt: finalPrompt,
    negative_prompt: 'blurry, low quality, distorted, unrealistic, amateur',
    keywords: [...storyKeywords, scenario.genre, template.mood[0], 'cinematic', 'professional'],
  };
}
