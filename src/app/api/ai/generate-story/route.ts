import { NextRequest, NextResponse } from 'next/server';

// Exponential backoff 유틸리티
function exponentialBackoff(attempt: number): number {
  const baseDelay = 1000; // 1초
  const maxDelay = 10000; // 10초
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * 1000; // 지터 추가
}

// Sleep 유틸리티
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

    // Google Gemini API 키 확인 및 유효성 검증
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    console.log('[LLM] ========== 스토리 생성 시작 ==========');
    console.log(`[LLM] API 키 상태: ${geminiApiKey ? `존재 (길이: ${geminiApiKey.length})` : '없음'}`);
    console.log(`[LLM] 요청 파라미터:`);
    console.log(`  - story: "${story?.substring(0, 100)}..."`);
    console.log(`  - genre: "${genre}"`);
    console.log(`  - tone: "${tone}"`);
    console.log(`  - developmentMethod: "${developmentMethod}"`);
    console.log(`  - developmentIntensity: "${developmentIntensity}"`);

    // API 키 유효성 검증
    const isValidApiKey = geminiApiKey && 
                         geminiApiKey !== 'your-actual-gemini-key' && 
                         geminiApiKey.startsWith('AIza') && 
                         geminiApiKey.length >= 30;
    
    if (!isValidApiKey) {
      if (!geminiApiKey) {
        console.error('[LLM] ❌ 환경변수 GOOGLE_GEMINI_API_KEY가 설정되지 않음');
        return NextResponse.json({ 
          error: 'AI 서비스가 구성되지 않았습니다. 관리자에게 문의하세요.' 
        }, { status: 503 });
      } else if (geminiApiKey === 'your-actual-gemini-key') {
        console.error('[LLM] ❌ 플레이스홀더 API 키 감지');
        return NextResponse.json({ 
          error: 'AI 서비스가 올바르게 구성되지 않았습니다.' 
        }, { status: 503 });
      } else {
        console.error('[LLM] ❌ 잘못된 API 키 형식');
        return NextResponse.json({ 
          error: 'AI 서비스 구성 오류입니다.' 
        }, { status: 503 });
      }
    }

    console.log('[LLM] ✅ API 키 유효성 확인 완료');

    // LLM 호출 재시도 로직 (최대 3회)
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = exponentialBackoff(attempt - 1);
        console.log(`[LLM] 재시도 ${attempt + 1}/${MAX_RETRIES} - ${delay}ms 대기 중...`);
        await sleep(delay);
      }
      
      console.log(`[LLM] Gemini API 호출 시도 ${attempt + 1}/${MAX_RETRIES}...`);
      
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
                      text: `당신은 전문 스토리텔러입니다. 사용자가 제공한 기본 스토리를 창의적이고 흥미롭게 발전시켜 4단계 시나리오 구조를 만들어주세요.

[사용자의 기본 스토리]
${story}

[창작 지침]
1. 위 스토리를 기반으로 구체적이고 생생한 장면들을 창조해주세요
2. 각 단계마다 구체적인 장면 묘사, 실제 대사, 캐릭터의 행동을 포함해주세요
3. 전개 방식은 스토리텔링의 내부 구조로만 활용하고, 절대 직접 언급하지 마세요
4. 템플릿 같은 느낌이 아닌, 실제 영화나 드라마의 시놉시스처럼 작성해주세요
5. 사용자의 원래 스토리를 존중하되, 창의적으로 확장하고 디테일을 추가해주세요

[스토리 방향성 참고 - 직접 언급하지 말 것]
- 장르 분위기: ${genre}
- 톤앤매너: ${tone}
- 타겟 오디언스: ${target || '일반'}
- 내부 전개 구조: ${developmentMethod || '클래식 기승전결'}
- 전개 강도: ${developmentIntensity || '적당히'}
- 영상 길이: ${duration || '5분'}
- 포맷: ${format || '16:9'}
- 템포: ${tempo || '보통'}

[내부 구조 가이드 - 스토리 내에 자연스럽게 녹여낼 것]
${developmentMethod === '훅-몰입-반전-떡밥' ? 'Act1: 강렬한 시작으로 즉시 관심을 끌 것\nAct2: 빠른 템포로 몰입도를 극대화할 것\nAct3: 예상치 못한 반전을 만들 것\nAct4: 다음 이야기에 대한 궁금증을 남길 것' : 
developmentMethod === '귀납법' ? 'Act1: 첫 번째 구체적 상황을 제시할 것\nAct2: 유사한 두 번째 상황으로 패턴을 보여줄 것\nAct3: 세 번째 상황으로 패턴을 완성할 것\nAct4: 전체를 아우르는 의미를 도출할 것' :
developmentMethod === '연역법' ? 'Act1: 핵심 메시지나 상황을 먼저 제시할 것\nAct2: 이를 뒷받침하는 첫 번째 전개\nAct3: 추가적인 근거와 심화\nAct4: 메시지를 다시 한번 강조하며 마무리' :
developmentMethod === '다큐(인터뷰식)' ? 'Act1: 상황과 인물들을 소개할 것\nAct2: 첫 번째 관점에서 이야기를 전개할 것\nAct3: 다른 관점에서 이야기를 보여줄 것\nAct4: 전체적인 의미를 정리할 것' :
developmentMethod === '픽사스토리' ? 'Act1: 평범한 일상을 보여줄 것\nAct2: 반복되는 패턴을 보여줄 것\nAct3: 변화를 일으키는 사건을 발생시킬 것\nAct4: 그로 인한 변화와 성장을 보여줄 것' :
'Act1: 상황과 인물을 소개할 것\nAct2: 갈등과 문제를 심화시킬 것\nAct3: 절정의 순간을 만들 것\nAct4: 해결과 새로운 균형을 보여줄 것'}

[중요: 창의적이고 구체적인 내용 작성]
- 각 Act의 제목은 해당 장면을 잘 표현하는 창의적인 제목을 사용하세요
- description은 실제 일어나는 구체적인 사건과 장면을 2-3문장으로 생생하게 묘사하세요
- key_elements는 그 장면의 구체적인 요소들(대사, 행동, 시각적 요소 등)을 포함하세요
- emotional_arc는 캐릭터나 관객이 느끼는 실제 감정 변화를 구체적으로 표현하세요

다음 JSON 형식으로만 응답해주세요 (다른 설명 없이 JSON만):

{
  "structure": {
    "act1": {
      "title": "창의적인 Act 1 제목",
      "description": "구체적인 장면과 사건 묘사 (2-3문장)",
      "key_elements": ["구체적 요소1", "구체적 요소2", "구체적 요소3"],
      "emotional_arc": "실제 감정 변화"
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

[최종 지침]
1. 사용자의 원 스토리를 창의적으로 발전시키되, 핵심은 유지하세요
2. 각 Act는 구체적인 장면, 대사, 행동을 포함한 생생한 묘사여야 합니다
3. 템플릿이나 일반적인 설명이 아닌, 이 스토리만의 독특한 내용을 만들어주세요
4. 전개 방식이나 설정을 직접 언급하지 말고, 자연스럽게 스토리에 녹여내세요
5. JSON 형식을 정확히 지켜주세요`,
                    },
                  ],
                },
              ],
            }),
          },
        );

        console.log(`[LLM] API 응답 상태: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[LLM] API 오류 (${response.status}):`, errorText);
          
          // 429 (Rate Limit) 에러는 재시도 가치가 있음
          if (response.status === 429) {
            lastError = new Error(`Rate limit exceeded: ${errorText}`);
            continue;
          }
          
          // 400번대 에러는 재시도해도 해결 안됨
          if (response.status >= 400 && response.status < 500) {
            console.error('[LLM] 클라이언트 오류 - 재시도 불가');
            return NextResponse.json({ 
              error: 'AI 요청 형식 오류입니다. 입력 내용을 확인해주세요.' 
            }, { status: 400 });
          }
          
          // 500번대 에러는 재시도
          lastError = new Error(`Server error ${response.status}: ${errorText}`);
          continue;
        }
        
        const data = await response.json();
        console.log('[LLM] API 응답 수신:', { 
          candidates: data.candidates?.length || 0,
          hasContent: !!data.candidates?.[0]?.content,
          finishReason: data.candidates?.[0]?.finishReason
        });
        
        let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
          console.warn('[LLM] 응답에 텍스트가 없음');
          lastError = new Error('Empty response from API');
          continue;
        }
        
        console.log(`[LLM] 생성된 텍스트 길이: ${generatedText.length}`);
        
        // JSON 파싱 시도 (재시도 로직 포함)
        let parseAttempts = 0;
        while (parseAttempts < 2) {
          try {
            // JSON 마크다운 및 불필요한 텍스트 제거
            let cleanText = generatedText.trim();
            
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
            
            // JSON 파싱
            const parsedResponse = JSON.parse(cleanText);
            
            // 응답 구조 검증
            if (!parsedResponse.structure || 
                !parsedResponse.structure.act1 || 
                !parsedResponse.structure.act2 ||
                !parsedResponse.structure.act3 ||
                !parsedResponse.structure.act4) {
              throw new Error('Invalid response structure');
            }
            
            console.log('[LLM] ✅ JSON 파싱 및 검증 성공');
            console.log('[LLM] ========== 스토리 생성 완료 ==========');
            return NextResponse.json(parsedResponse);
            
          } catch (parseError) {
            parseAttempts++;
            console.error(`[LLM] JSON 파싱 시도 ${parseAttempts}/2 실패:`, parseError);
            
            if (parseAttempts >= 2) {
              console.error('[LLM] 원본 응답 (처음 1000자):', generatedText.substring(0, 1000));
              lastError = new Error(`JSON parsing failed: ${parseError}`);
              break;
            }
            
            // 간단한 정규식으로 JSON 추출 재시도
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);  
            if (jsonMatch) {
              generatedText = jsonMatch[0];
            } else {
              break;
            }
          }
        }
        
      } catch (apiError) {
        console.error(`[LLM] API 호출 실패 (시도 ${attempt + 1}/${MAX_RETRIES}):`, apiError);
        lastError = apiError as Error;
      }
    }
    
    // 모든 재시도 실패
    console.error('[LLM] ❌ 모든 재시도 실패');
    console.error('[LLM] 마지막 에러:', lastError);
    console.log('[LLM] ========== 스토리 생성 실패 ==========');
    
    return NextResponse.json({ 
      error: 'AI 스토리 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
      details: process.env.NODE_ENV === 'development' ? lastError?.message : undefined
    }, { status: 503 });
  } catch (error) {
    console.error('[LLM] ❌ 예상치 못한 오류:', error);
    console.log('[LLM] ========== 스토리 생성 실패 ==========');
    return NextResponse.json({ 
      error: '스토리 생성 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}

// 기본 구조 생성 함수는 제거됨 (LLM 강제화)
// 아래 함수는 더 이상 사용되지 않지만, 타입 체크를 위해 남겨둠
// @deprecated
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
