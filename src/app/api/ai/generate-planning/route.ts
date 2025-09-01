import { NextRequest, NextResponse } from 'next/server';

interface PlanningRequest {
  title: string;
  logline: string;
  tone: string;
  genre: string;
  target: string;
  duration: string;
  format: string;
  tempo: string;
  developmentMethod: string;
  developmentIntensity: string;
}

interface PlanningResponse {
  summary: string;
  structure: string[];
  visualStyle: string;
  targetAudience: string;
  estimatedCost: string;
  timeline: string;
  keyElements: string[];
  productionNotes: string[];
  marketingStrategy: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: PlanningRequest = await request.json();
    const { title, logline, tone, genre, target, duration, format, tempo, developmentMethod, developmentIntensity } = body;

    if (!title || !logline || !genre) {
      return NextResponse.json(
        { error: '제목, 로그라인, 장르는 필수입니다.' },
        { status: 400 }
      );
    }

    // Google Gemini API 키 확인
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    if (geminiApiKey) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `다음 정보를 바탕으로 영상 제작을 위한 체계적인 기획안을 생성해주세요:

제목: ${title}
로그라인: ${logline}
톤앤매너: ${tone}
장르: ${genre}
타겟 오디언스: ${target}
분량: ${duration}초
포맷: ${format}
템포: ${tempo}
전개 방식: ${developmentMethod}
전개 강도: ${developmentIntensity}

다음 JSON 형식으로 응답해주세요:

{
  "summary": "기획안 요약 (2-3문장)",
  "structure": ["구조1", "구조2", "구조3", "구조4"],
  "visualStyle": "시각적 스타일",
  "targetAudience": "타겟 오디언스",
  "estimatedCost": "예상 비용 (낮음/중간/높음)",
  "timeline": "제작 기간",
  "keyElements": ["핵심 요소1", "핵심 요소2", "핵심 요소3"],
  "productionNotes": ["제작 노트1", "제작 노트2", "제작 노트3"],
  "marketingStrategy": ["마케팅 전략1", "마케팅 전략2"]
}

각 요소는 입력된 정보를 바탕으로 구체적이고 실용적인 내용으로 작성해주세요.`
              }]
            }]
          })
        });

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
              // 파싱 실패 시 기본 기획안 반환
              return NextResponse.json(generateDefaultPlanning(title, logline, genre, tone, target, duration, format, tempo, developmentMethod, developmentIntensity));
            }
          }
        }
      } catch (apiError) {
        console.error('Gemini API 호출 실패:', apiError);
      }
    }

    // API 키가 없거나 실패 시 기본 기획안 반환
    return NextResponse.json(generateDefaultPlanning(title, logline, genre, tone, target, duration, format, tempo, developmentMethod, developmentIntensity));

  } catch (error) {
    console.error('기획안 생성 오류:', error);
    return NextResponse.json(
      { error: '기획안 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function generateDefaultPlanning(
  title: string, 
  logline: string, 
  genre: string, 
  tone: string, 
  target: string, 
  duration: string, 
  format: string, 
  tempo: string, 
  developmentMethod: string, 
  developmentIntensity: string
): PlanningResponse {
  
  // 장르별 기본 구조 템플릿
  const genreStructures = {
    'drama': ['도입 (상황 설정)', '전개 (갈등 발생)', '위기 (절정)', '해결 (갈등 해소)'],
    'horror': ['평온 (일상)', '불안 (징조)', '공포 (절정)', '해결 (생존/패배)'],
    'sf': ['현실 (일상)', '발견 (새로운 요소)', '혼란 (변화)', '적응 (새로운 현실)'],
    'action': ['평온 (일상)', '위협 (위험)', '대응 (액션)', '승리 (해결)'],
    'advertisement': ['문제 (Pain Point)', '해결책 (Solution)', '증명 (Proof)', '행동 (Call to Action)'],
    'documentary': ['소개 (주제)', '탐구 (내용)', '분석 (의미)', '결론 (메시지)'],
    'comedy': ['일상 (평온)', '사건 (혼란)', '해결 (시도)', '결과 (웃음)'],
    'romance': ['만남 (첫인상)', '접근 (호감)', '갈등 (오해)', '화해 (사랑)']
  };

  // 전개 방식별 구조 조정
  const methodStructures = {
    'hook-immersion-reversal': ['강한 훅 (시작)', '몰입 (전개)', '반전 (위기)', '떡밥 (다음편 유도)'],
    'traditional': ['기 (도입)', '승 (전개)', '전 (위기)', '결 (해결)'],
    'inductive': ['구체적 사례1', '구체적 사례2', '일반적 패턴', '결론'],
    'deductive': ['일반적 원리', '적용 방법', '구체적 실행', '결과'],
    'documentary-interview': ['주제 소개', '인터뷰1', '인터뷰2', '종합 분석'],
    'pixar': ['일상 (평온)', '변화 (도전)', '성장 (시련)', '성취 (완성)']
  };

  // 전개 강도별 구조 확장
  const intensityMultiplier = {
    'minimal': 1,
    'moderate': 1.5,
    'rich': 2
  };

  const baseStructure = methodStructures[developmentMethod as keyof typeof methodStructures] || genreStructures[genre as keyof typeof genreStructures] || ['도입', '전개', '위기', '해결'];
  
  // 시각적 스타일 결정
  const visualStyles = {
    'drama': 'Cinematic, Moody',
    'horror': 'Dark, Atmospheric',
    'sf': 'Futuristic, Clean',
    'action': 'Dynamic, High-contrast',
    'advertisement': 'Bright, Professional',
    'documentary': 'Natural, Authentic',
    'comedy': 'Bright, Playful',
    'romance': 'Soft, Warm'
  };

  // 예상 비용 계산
  const costFactors = {
    'duration': parseInt(duration) > 60 ? '높음' : parseInt(duration) > 30 ? '중간' : '낮음',
    'format': format === 'live-action' ? '높음' : format === 'animation' ? '중간' : '낮음',
    'intensity': developmentIntensity === 'rich' ? '높음' : developmentIntensity === 'moderate' ? '중간' : '낮음'
  };

  const estimatedCost = costFactors.duration === '높음' || costFactors.format === '높음' || costFactors.intensity === '높음' ? '높음' : 
                       costFactors.duration === '중간' || costFactors.format === '중간' || costFactors.intensity === '중간' ? '중간' : '낮음';

  // 제작 기간 계산
  const timelineFactors = {
    'duration': parseInt(duration) > 60 ? 4 : parseInt(duration) > 30 ? 3 : 2,
    'format': format === 'live-action' ? 2 : format === 'animation' ? 1.5 : 1,
    'intensity': developmentIntensity === 'rich' ? 1.5 : developmentIntensity === 'moderate' ? 1 : 0.8
  };

  const totalWeeks = Math.ceil(timelineFactors.duration * timelineFactors.format * timelineFactors.intensity);
  const timeline = `${totalWeeks}-${totalWeeks + 1}주`;

  return {
    summary: `${title}은 ${genre} 장르의 ${duration}초 ${format} 형식으로, ${tone}한 톤앤매너와 ${developmentMethod} 전개 방식을 통해 ${target}에게 강력한 메시지를 전달하는 영상입니다.`,
    structure: baseStructure,
    visualStyle: visualStyles[genre as keyof typeof visualStyles] || 'Cinematic',
    targetAudience: target || '일반 시청자',
    estimatedCost,
    timeline,
    keyElements: [
      `${genre}적 요소와 ${tone}한 분위기`,
      `${format} 형식에 최적화된 구성`,
      `${tempo}한 템포로 ${developmentIntensity}한 전개`,
      `${target}에게 어필하는 핵심 메시지`
    ],
    productionNotes: [
      `${duration}초 분량에 맞는 핵심 메시지 집중`,
      `${format} 형식의 특성을 살린 제작 기법 활용`,
      `${tone}한 분위기를 위한 색감과 조명 설정`,
      `${developmentMethod} 구조에 따른 명확한 단계 구분`
    ],
    marketingStrategy: [
      `${target}이 주로 사용하는 플랫폼 중심 배포`,
      `${genre} 팬층을 타겟으로 한 홍보 전략`,
      `${tone}한 분위기를 강조한 시각적 마케팅`,
      `${developmentIntensity}한 전개를 활용한 관심 유도`
    ]
  };
}





