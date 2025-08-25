import { NextRequest, NextResponse } from 'next/server';

interface StoryRequest {
  prompt: string;
  genre: string;
  tone: string[];
  target: string;
  duration: string;
  format: string;
  tempo: string;
  developmentMethod: string;
  developmentIntensity: string;
}

interface StoryStep {
  id: string;
  title: string;
  summary: string;
  content: string;
  goal: string;
  lengthHint: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: StoryRequest = await request.json();
    
    // 필수 필드 검증
    if (!body.prompt) {
      return NextResponse.json(
        { error: '프롬프트는 필수입니다.' },
        { status: 400 }
      );
    }

    // 실제 AI API 호출 시도 (Google Gemini 또는 OpenAI)
    let aiResponse;
    
    try {
      // Google Gemini API 시도
      if (process.env.GOOGLE_GEMINI_API_KEY) {
        aiResponse = await callGeminiAPI(body);
      } else if (process.env.OPENAI_API_KEY) {
        aiResponse = await callOpenAIAPI(body);
      } else {
        // API 키가 없으면 기본 템플릿 생성
        aiResponse = generateDefaultStory(body);
      }
    } catch (error) {
      console.error('AI API 호출 실패:', error);
      // API 실패 시 기본 템플릿 사용
      aiResponse = generateDefaultStory(body);
    }

    return NextResponse.json({
      success: true,
      steps: aiResponse.steps,
      provider: aiResponse.provider,
      note: aiResponse.note
    });

  } catch (error) {
    console.error('스토리 생성 API 오류:', error);
    return NextResponse.json(
      { error: '스토리 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function callGeminiAPI(request: StoryRequest) {
  const prompt = `
다음 요구사항에 맞는 4단계 스토리를 생성해주세요:

제목: ${request.prompt}
장르: ${request.genre}
톤앤매너: ${request.tone.join(', ')}
타겟: ${request.target}
분량: ${request.duration}
포맷: ${request.format}
템포: ${request.tempo}
전개 방식: ${request.developmentMethod}
전개 강도: ${request.developmentIntensity}

다음 JSON 형식으로 응답해주세요:
{
  "steps": [
    {
      "title": "기 (시작)",
      "summary": "상황 설정과 캐릭터 소개",
      "content": "구체적인 내용",
      "goal": "이 단계의 목표",
      "lengthHint": "전체의 20%"
    },
    {
      "title": "승 (전개)",
      "summary": "갈등과 문제의 심화",
      "content": "구체적인 내용",
      "goal": "이 단계의 목표",
      "lengthHint": "전체의 30%"
    },
    {
      "title": "전 (위기)",
      "summary": "절정과 최대 위기 상황",
      "content": "구체적인 내용",
      "goal": "이 단계의 목표",
      "lengthHint": "전체의 30%"
    },
    {
      "title": "결 (해결)",
      "summary": "갈등 해결과 마무리",
      "content": "구체적인 내용",
      "goal": "이 단계의 목표",
      "lengthHint": "전체의 20%"
    }
  ]
}
`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  const generatedText = data.candidates[0].content.parts[0].text;
  
  try {
    const parsed = JSON.parse(generatedText);
    return {
      steps: parsed.steps.map((step: any, index: number) => ({
        ...step,
        id: (index + 1).toString()
      })),
      provider: 'Google Gemini',
      note: 'AI가 생성한 스토리입니다.'
    };
  } catch (parseError) {
    // JSON 파싱 실패 시 기본 템플릿 사용
    return generateDefaultStory(request);
  }
}

async function callOpenAIAPI(request: StoryRequest) {
  const prompt = `
다음 요구사항에 맞는 4단계 스토리를 생성해주세요:

제목: ${request.prompt}
장르: ${request.genre}
톤앤매너: ${request.tone.join(', ')}
타겟: ${request.target}
분량: ${request.duration}
포맷: ${request.format}
템포: ${request.tempo}
전개 방식: ${request.developmentMethod}
전개 강도: ${request.developmentIntensity}

다음 JSON 형식으로 응답해주세요:
{
  "steps": [
    {
      "title": "기 (시작)",
      "summary": "상황 설정과 캐릭터 소개",
      "content": "구체적인 내용",
      "goal": "이 단계의 목표",
      "lengthHint": "전체의 20%"
    },
    {
      "title": "승 (전개)",
      "summary": "갈등과 문제의 심화",
      "content": "구체적인 내용",
      "goal": "이 단계의 목표",
      "lengthHint": "전체의 30%"
    },
    {
      "title": "전 (위기)",
      "summary": "절정과 최대 위기 상황",
      "content": "구체적인 내용",
      "goal": "이 단계의 목표",
      "lengthHint": "전체의 30%"
    },
    {
      "title": "결 (해결)",
      "summary": "갈등 해결과 마무리",
      "content": "구체적인 내용",
      "goal": "이 단계의 목표",
      "lengthHint": "전체의 20%"
    }
  ]
}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: '당신은 전문적인 시나리오 작가입니다. 요청에 따라 구조화된 스토리를 생성해주세요.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  const generatedText = data.choices[0].message.content;
  
  try {
    const parsed = JSON.parse(generatedText);
    return {
      steps: parsed.steps.map((step: any, index: number) => ({
        ...step,
        id: (index + 1).toString()
      })),
      provider: 'OpenAI GPT-4',
      note: 'AI가 생성한 스토리입니다.'
    };
  } catch (parseError) {
    // JSON 파싱 실패 시 기본 템플릿 사용
    return generateDefaultStory(request);
  }
}

function generateDefaultStory(request: StoryRequest) {
  const steps: StoryStep[] = [
    {
      id: '1',
      title: '기 (시작)',
      summary: '상황 설정과 캐릭터 소개',
      content: request.prompt,
      goal: '시청자의 관심을 끌고 기본 배경을 설정',
      lengthHint: '전체의 20%'
    },
    {
      id: '2',
      title: '승 (전개)',
      summary: '갈등과 문제의 심화',
      content: '갈등이 점진적으로 심화되며 긴장감 조성',
      goal: '스토리의 긴장감을 고조시키고 몰입도 증가',
      lengthHint: '전체의 30%'
    },
    {
      id: '3',
      title: '전 (위기)',
      summary: '절정과 최대 위기 상황',
      content: '갈등이 절정에 달하고 해결의 실마리 발견',
      goal: '극적인 순간을 연출하고 해결의 동기를 제공',
      lengthHint: '전체의 30%'
    },
    {
      id: '4',
      title: '결 (해결)',
      summary: '갈등 해결과 마무리',
      content: '모든 갈등이 해결되고 만족스러운 마무리',
      goal: '스토리를 완성하고 시청자에게 만족감 제공',
      lengthHint: '전체의 20%'
    }
  ];

  return {
    steps,
    provider: '기본 템플릿',
    note: 'AI API 호출에 실패하여 기본 템플릿을 사용했습니다.'
  };
}
