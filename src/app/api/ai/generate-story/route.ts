import { NextRequest, NextResponse } from 'next/server';

interface StoryRequest {
  story: string;
  genre: string;
  tone: string;
  target: string;
  duration?: string;
  format?: string;
  tempo?: string;
  developmentMethod?: string;
  developmentIntensity?: string;
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
    const { story, genre, tone, target, duration, format, tempo, developmentMethod, developmentIntensity } = body;

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
                      text: `다음 스토리를 바탕으로 4단계 시나리오 구조를 생성해주세요:

스토리: ${story}

다음 설정을 참고하여 스토리 전개 방향을 설정하되, 이 설정들을 직접 언급하지 말고 스토리의 자연스러운 전개에만 집중해주세요:
- 장르 방향: ${genre}
- 톤앤매너: ${tone}
- 타겟 오디언스: ${target || '일반'}
- 전개 방식: ${developmentMethod || '클래식 기승전결'}
- 전개 강도: ${developmentIntensity || '적당히'}
- 영상 길이: ${duration || '5분'}
- 포맷: ${format || '16:9'}
- 템포: ${tempo || '보통'}

전개 방식에 따른 구조:
${developmentMethod === '훅-몰입-반전-떡밥' ? '- 훅: 강한 시작으로 즉시 주목 끌기\n- 몰입: 빠른 템포로 스토리 몰입도 극대화\n- 반전: 예상 밖 전개로 충격과 놀라움\n- 떡밥: 다음 이야기에 대한 기대감 조성' : 
developmentMethod === '귀납법' ? '- 사례 1: 첫 번째 구체적 사례 제시\n- 사례 2: 두 번째 사례로 패턴 강화\n- 사례 3: 세 번째 사례로 결론 준비\n- 결론: 사례들을 종합한 일반적 결론' :
developmentMethod === '연역법' ? '- 결론 제시: 먼저 결론이나 주장을 명확히 제시\n- 근거 1: 첫 번째 근거와 논리적 설명\n- 근거 2: 두 번째 근거와 추가 설명\n- 재확인: 결론 재강조와 마무리' :
developmentMethod === '다큐(인터뷰식)' ? '- 도입부: 주제 소개와 인터뷰 대상자 소개\n- 인터뷰 1: 첫 번째 핵심 인터뷰\n- 인터뷰 2: 두 번째 관점의 인터뷰\n- 마무리: 내레이션과 결론' :
developmentMethod === '픽사스토리' ? '- 옛날 옛적에: 평범한 일상의 소개\n- 매일: 반복되는 일상의 패턴\n- 그러던 어느 날: 일상을 바꾸는 사건 발생\n- 때문에: 사건의 결과와 변화' :
'- 기: 상황 설정과 캐릭터 소개\n- 승: 갈등과 문제의 심화\n- 전: 절정과 최대 위기 상황\n- 결: 갈등 해결과 마무리'}

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

각 액트는 선택된 전개 방식에 따라 구성하고, 각 단계마다 명확한 목적과 감정적 변화를 포함해야 합니다. 
사용자가 선택한 설정들(장르, 톤앤매너, 전개 방식 등)을 직접 언급하지 말고, 이 설정들이 스토리의 방향과 분위기를 자연스럽게 이끌어가도록 해주세요.`,
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
              return NextResponse.json(generateDefaultStructure(story, genre, tone, target, developmentMethod));
            }
          }
        }
      } catch (apiError) {
        console.error('Gemini API 호출 실패:', apiError);
      }
    }

    // API 키가 없거나 실패 시 기본 구조 반환
    return NextResponse.json(generateDefaultStructure(story, genre, tone, target, developmentMethod));
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
  developmentMethod?: string,
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

  // 전개 방식별 구조 생성
  let structure;
  
  switch (developmentMethod) {
    case '훅-몰입-반전-떡밥':
      structure = {
        act1: {
          title: '훅 (강한 시작)',
          description: '시청자의 관심을 즉시 끄는 강렬한 오프닝으로 시작',
          key_elements: ['강렬한 첫 장면', '즉시 몰입되는 상황', '호기심 유발 요소'],
          emotional_arc: '평온 → 강한 관심',
        },
        act2: {
          title: '몰입 (빠른 전개)',
          description: '빠른 템포로 스토리 몰입도 극대화',
          key_elements: ['핵심 갈등 제시', '캐릭터 동기 명확화', '빠른 전개'],
          emotional_arc: '관심 → 몰입',
        },
        act3: {
          title: '반전 (예상 밖 전개)',
          description: '예상과 다른 방향으로 스토리 전개',
          key_elements: ['예상 밖 전개', '충격적 반전', '새로운 관점'],
          emotional_arc: '몰입 → 충격',
        },
        act4: {
          title: '떡밥 (후속 기대)',
          description: '다음 이야기에 대한 기대감 조성',
          key_elements: ['미해결 요소', '다음 에피소드 힌트', '지속적 관심 유발'],
          emotional_arc: '충격 → 기대',
        },
      };
      break;
      
    case '귀납법':
      structure = {
        act1: {
          title: '사례 1',
          description: '첫 번째 구체적인 사례를 제시',
          key_elements: ['구체적 사례', '상황 설정', '관심 유발'],
          emotional_arc: '무관심 → 관심',
        },
        act2: {
          title: '사례 2',
          description: '두 번째 사례로 패턴을 강화',
          key_elements: ['유사한 사례', '패턴 인식', '연관성 발견'],
          emotional_arc: '관심 → 이해',
        },
        act3: {
          title: '사례 3',
          description: '세 번째 사례로 결론을 준비',
          key_elements: ['마지막 사례', '패턴 완성', '결론 준비'],
          emotional_arc: '이해 → 확신',
        },
        act4: {
          title: '결론',
          description: '사례들을 종합한 일반적 결론',
          key_elements: ['종합 분석', '일반화', '메시지 전달'],
          emotional_arc: '확신 → 깨달음',
        },
      };
      break;
      
    case '연역법':
      structure = {
        act1: {
          title: '결론 제시',
          description: '먼저 결론이나 주장을 명확히 제시',
          key_elements: ['명확한 주장', '방향성 제시', '관심 집중'],
          emotional_arc: '무관심 → 관심',
        },
        act2: {
          title: '근거 1',
          description: '첫 번째 근거와 논리적 설명',
          key_elements: ['첫 번째 근거', '논리적 설명', '신뢰성 구축'],
          emotional_arc: '관심 → 신뢰',
        },
        act3: {
          title: '근거 2',
          description: '두 번째 근거와 추가 설명',
          key_elements: ['두 번째 근거', '추가 설명', '설득력 강화'],
          emotional_arc: '신뢰 → 확신',
        },
        act4: {
          title: '재확인',
          description: '결론 재강조와 마무리',
          key_elements: ['결론 재강조', '종합 정리', '메시지 강화'],
          emotional_arc: '확신 → 확고함',
        },
      };
      break;
      
    case '다큐(인터뷰식)':
      structure = {
        act1: {
          title: '도입부',
          description: '주제 소개와 인터뷰 대상자 소개',
          key_elements: ['주제 소개', '인터뷰 대상자', '배경 설명'],
          emotional_arc: '무관심 → 관심',
        },
        act2: {
          title: '인터뷰 1',
          description: '첫 번째 핵심 인터뷰',
          key_elements: ['주요 인물 인터뷰', '경험담', '신뢰성 확보'],
          emotional_arc: '관심 → 몰입',
        },
        act3: {
          title: '인터뷰 2',
          description: '두 번째 관점의 인터뷰',
          key_elements: ['다른 관점', '균형 잡힌 시각', '객관성 확보'],
          emotional_arc: '몰입 → 이해',
        },
        act4: {
          title: '마무리',
          description: '내레이션과 결론',
          key_elements: ['내레이션', '종합 결론', '여운 남기기'],
          emotional_arc: '이해 → 깨달음',
        },
      };
      break;
      
    case '픽사스토리':
      structure = {
        act1: {
          title: '옛날 옛적에',
          description: '평범한 일상의 소개',
          key_elements: ['평범한 일상', '주인공 소개', '공감대 형성'],
          emotional_arc: '무관심 → 공감',
        },
        act2: {
          title: '매일',
          description: '반복되는 일상의 패턴',
          key_elements: ['일상적 패턴', '캐릭터 성격', '안정감'],
          emotional_arc: '공감 → 친근함',
        },
        act3: {
          title: '그러던 어느 날',
          description: '일상을 바꾸는 사건 발생',
          key_elements: ['특별한 사건', '전환점', '갈등 시작'],
          emotional_arc: '친근함 → 긴장',
        },
        act4: {
          title: '때문에',
          description: '사건의 결과와 변화',
          key_elements: ['변화와 성장', '해결', '새로운 일상'],
          emotional_arc: '긴장 → 만족',
        },
      };
      break;
      
    default:
      // 기본 기승전결 구조
      const template = genreTemplates[genre as keyof typeof genreTemplates] || genreTemplates.drama;
      structure = {
        act1: {
          ...template.act1,
          key_elements: ['상황 설정', '캐릭터 소개', '기본 배경'],
        },
        act2: {
          ...template.act2,
          key_elements: ['갈등 시작', '문제 심화', '긴장감 조성'],
        },
        act3: {
          ...template.act3,
          key_elements: ['절정 상황', '최대 위기', '해결 실마리'],
        },
        act4: {
          ...template.act4,
          key_elements: ['갈등 해결', '성장과 변화', '만족스러운 마무리'],
        },
      };
  }

  return {
    structure,
    visual_style: ['Cinematic', 'Photorealistic'],
    mood_palette: [tone, 'Immersive'],
    technical_approach: ['Dynamic Camera', 'Emotional Lighting'],
    target_audience_insights: [`${target}에게 어필하는 요소`, '감정적 몰입도'],
  };
}
