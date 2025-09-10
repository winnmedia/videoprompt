import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUser } from '@/shared/lib/auth';
import { 
  createValidationErrorResponse,
  createErrorResponse 
} from '@/shared/schemas/api.schema';

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

// Zod 스키마 정의
const StoryRequestSchema = z.object({
  story: z.string().min(10, '스토리는 최소 10자 이상이어야 합니다'),
  genre: z.string().min(1, '장르는 필수입니다'),
  tone: z.string().min(1, '톤앤매너는 필수입니다'),
  target: z.string().min(1, '타겟 관객은 필수입니다'),
  duration: z.string().optional(),
  format: z.string().optional(),
  tempo: z.string().optional(),
  developmentMethod: z.string().optional(),
  developmentIntensity: z.string().optional(),
  projectId: z.string().uuid().optional(),
  saveAsProject: z.boolean().optional(),
  projectTitle: z.string().optional(),
});

type StoryRequest = z.infer<typeof StoryRequestSchema>;

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
    const body = await request.json();
    
    // 입력 데이터 검증
    const validationResult = StoryRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error),
        { status: 400 }
      );
    }

    const { story, genre, tone, target, duration, format, tempo, developmentMethod, developmentIntensity, projectId, saveAsProject, projectTitle } = validationResult.data;

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
                      text: `## 창의적 시나리오 구축 작업

당신은 영화 감독이자 스토리텔러입니다. 주어진 원본 스토리를 바탕으로 풍성하고 몰입감 있는 시나리오를 창작해야 합니다.

### 핵심 스토리
${story}

### 창작 원칙
1. 원본 스토리는 출발점일 뿐입니다. 이를 확장하고 발전시켜 풍부한 서사를 만들어주세요.
2. 구체적인 장면 묘사, 생생한 대사, 시각적 디테일을 적극적으로 창작해주세요.
3. 메타 정보(장르, 톤, 전개방식 등)는 작품 속에서 자연스럽게 표현되어야 하며, 직접 언급하지 마세요.

### 시나리오 구성 방향
${(() => {
  // 전개 방식별 특화 가이드라인 동적 생성
  const methodGuides = {
    '훅-몰입-반전-떡밥': `
#### Act 1 - 강렬한 시작 (훅)
- 첫 10초 안에 관객을 사로잡을 충격적/호기심 유발 장면으로 시작
- 예: 예상치 못한 사건, 강렬한 비주얼, 수수께끼 같은 대사
- 구체적인 시각적 요소와 소리를 묘사하여 즉각적인 몰입 유도

#### Act 2 - 급속 전개 (몰입)
- 빠른 템포로 정보를 제공하며 긴장감 상승
- 캐릭터의 목표와 장애물을 명확히 제시
- 짧고 임팩트 있는 장면들을 연속 배치

#### Act 3 - 충격적 전환 (반전)
- 기존 설정을 뒤집는 예상 밖의 진실 공개
- 관객의 기대를 배반하는 플롯 트위스트
- 시각적/청각적 변화로 반전의 충격 극대화

#### Act 4 - 여운과 기대 (떡밥)
- 해결되지 않은 미스터리 암시
- 다음 이야기에 대한 궁금증 유발
- 열린 결말 또는 숨겨진 단서 배치`,
    
    '귀납법': `
#### Act 1 - 첫 번째 구체적 사례
- 특정 상황의 생생한 묘사와 인물의 경험
- 관찰 가능한 구체적 현상과 반응
- 예: "어느 화창한 아침, 김 씨는 카페에서..."

#### Act 2 - 두 번째 패턴 강화 사례
- 다른 시공간, 다른 인물의 유사한 경험
- 첫 사례와의 공통점을 은근히 드러냄
- 패턴의 반복을 통한 규칙성 암시

#### Act 3 - 세 번째 결정적 사례
- 가장 강력하고 명확한 예시 제시
- 앞선 사례들과의 연결고리 강화
- 결론을 향한 논리적 다리 역할

#### Act 4 - 보편적 결론
- 개별 사례들로부터 도출된 일반 법칙
- "결국, 모든 경우에서..."
- 시청자가 스스로 깨달음을 얻도록 유도`,
    
    '연역법': `
#### Act 1 - 명제 제시
- 핵심 주장이나 법칙을 명확히 선언
- 권위 있는 내레이션 또는 주인공의 확신에 찬 대사
- 예: "사랑은 모든 것을 극복한다"

#### Act 2 - 첫 번째 논증
- 명제를 뒷받침하는 강력한 증거 제시
- 구체적인 상황과 결과를 통한 입증
- 논리적 연결고리 명확화

#### Act 3 - 두 번째 심화 논증
- 다른 각도에서의 추가 증명
- 반대 논리에 대한 반박 포함
- 더 깊은 차원의 이해 제공

#### Act 4 - 종합과 재확인
- 모든 논증을 종합한 최종 결론
- 처음 명제의 타당성 재확인
- 강력한 마무리 메시지`,
    
    '다큐(인터뷰식)': `
#### Act 1 - 주제 도입과 화자 소개
- 다큐멘터리 스타일의 오프닝
- 인터뷰이의 배경과 신뢰성 확립
- 핵심 질문이나 탐구 주제 제시

#### Act 2 - 첫 번째 증언
- 개인적 경험담과 구체적 사례
- 감정적 호소와 팩트의 균형
- 실제 대화체를 사용한 생생함

#### Act 3 - 대조적 관점
- 다른 시각의 인터뷰이 등장
- 주제에 대한 다층적 이해 제공
- 갈등이나 긴장감 조성

#### Act 4 - 종합과 통찰
- 내레이터의 종합적 분석
- 인터뷰 내용의 의미 해석
- 시청자에게 던지는 화두`,
    
    '픽사스토리': `
#### Act 1 - "옛날 옛적에" (평범한 일상)
- 주인공의 안정적이고 반복적인 일상
- 세계관과 규칙 자연스럽게 소개
- 따뜻하고 친근한 분위기 조성

#### Act 2 - "매일 매일" (루틴과 갈망)
- 일상의 반복 속 숨겨진 욕구
- 작은 불만족이나 꿈의 암시
- 변화를 예고하는 미세한 신호들

#### Act 3 - "그러던 어느 날" (전환점)
- 일상을 깨뜨리는 특별한 사건
- 주인공의 선택의 순간
- 모험의 시작과 도전

#### Act 4 - "그 때문에" (새로운 균형)
- 사건이 가져온 변화와 성장
- 교훈이나 깨달음의 자연스러운 전달
- 더 나은 새로운 일상의 확립`,
    
    '클래식 기승전결': `
#### Act 1 - 기 (설정)
- 시공간 배경의 섬세한 묘사
- 주요 인물들의 성격과 관계 확립
- 일상 속 잠재된 갈등의 씨앗

#### Act 2 - 승 (전개)
- 갈등의 점진적 심화
- 인물 간 관계의 복잡화
- 긴장감의 단계적 상승

#### Act 3 - 전 (절정)
- 모든 갈등이 정점에 도달
- 결정적 대립과 선택의 순간
- 감정의 폭발과 극적 전환

#### Act 4 - 결 (해결)
- 갈등의 해소와 새로운 균형
- 인물들의 변화와 성장
- 여운을 남기는 마무리`
  };
  
  const selectedMethod = developmentMethod && developmentMethod in methodGuides 
    ? developmentMethod as keyof typeof methodGuides
    : '클래식 기승전결';
  return methodGuides[selectedMethod];
})()}

### 창작 요구사항

#### 1. 구체적 장면 묘사
- 각 Act마다 최소 2-3개의 구체적인 시각적 장면을 묘사하세요
- 카메라 앵글, 조명, 색감 등을 암시적으로 포함하세요
- 예시: "비 오는 거리, 네온사인이 반사된 웅덩이를 밟으며 걷는 발걸음"

#### 2. 생동감 있는 대사
- 캐릭터의 개성이 드러나는 대사를 창작하세요
- 설명적 대사보다 행동을 유발하는 대사를 사용하세요
- 침묵과 비언어적 소통도 활용하세요

#### 3. 감각적 디테일
- 시각뿐 아니라 청각, 촉각적 요소도 포함하세요
- 음향 효과, 음악의 분위기를 암시하세요
- 공간감과 시간의 흐름을 느끼게 하세요

#### 4. 감정 곡선 설계
- 각 Act의 감정적 온도와 리듬을 다르게 설정하세요
- 긴장과 이완, 기대와 충족의 균형을 맞추세요
- 관객의 감정 여정을 의식적으로 설계하세요

### 창작 컨텍스트 (내부 참고용)
<context>
장르 지향: ${genre}
정서적 톤: ${tone}
관객층 고려사항: ${target || '일반'}
서사 강도: ${developmentIntensity || '적당히'}
상영 시간: ${duration || '5분'}
화면 비율: ${format || '16:9'}
리듬감: ${tempo || '보통'}
</context>

### JSON 응답 형식

다음 JSON 형식으로만 응답해주세요 (다른 설명 없이 JSON만):

{
  "structure": {
    "act1": {
      "title": "[창의적이고 호기심을 자극하는 제목]",
      "description": "[3-5문장의 구체적이고 시각적인 장면 묘사. 인물의 행동, 환경, 분위기를 생생하게 표현]",
      "key_elements": [
        "[구체적인 시각적 요소나 오브젝트]",
        "[핵심 대사나 사운드]",
        "[감정이나 분위기를 전달하는 디테일]"
      ],
      "emotional_arc": "[이 장면에서 관객이 느낄 감정의 변화 과정]",
      "visual_moments": [
        "[기억에 남을 구체적 비주얼 순간 1]",
        "[기억에 남을 구체적 비주얼 순간 2]"
      ],
      "dialogue_sample": "[이 Act의 톤을 보여주는 대표 대사 한 줄]"
    },
    "act2": {
      "title": "[전개를 암시하는 흥미로운 제목]",
      "description": "[3-5문장의 역동적인 전개 묘사. 갈등의 심화, 관계의 변화, 사건의 진행을 구체적으로]",
      "key_elements": [
        "[갈등을 보여주는 구체적 행동]",
        "[관계 변화를 나타내는 상호작용]",
        "[긴장감을 높이는 시각적/청각적 요소]"
      ],
      "emotional_arc": "[긴장감이 어떻게 축적되는지 설명]",
      "visual_moments": [
        "[드라마틱한 시각적 전환점]",
        "[감정을 전달하는 클로즈업 순간]"
      ],
      "dialogue_sample": "[갈등이나 긴장을 드러내는 핵심 대사]"
    },
    "act3": {
      "title": "[절정의 긴장감을 담은 제목]",
      "description": "[3-5문장의 극적인 순간 묘사. 모든 것이 걸린 순간, 선택, 대립, 폭발적 감정을 세밀하게]",
      "key_elements": [
        "[클라이막스의 핵심 행동]",
        "[극적 반전이나 깨달음의 순간]",
        "[시각적/감정적 정점]"
      ],
      "emotional_arc": "[감정의 정점과 전환점 설명]",
      "visual_moments": [
        "[가장 인상적인 비주얼 클라이막스]",
        "[감정 폭발의 시각화]"
      ],
      "dialogue_sample": "[작품의 핵심 메시지를 담은 결정적 대사]"
    },
    "act4": {
      "title": "[여운을 남기는 마무리 제목]",
      "description": "[3-5문장의 해결과 새로운 시작 묘사. 변화된 상황, 깨달음, 미래への 암시를 섬세하게]",
      "key_elements": [
        "[변화를 보여주는 구체적 디테일]",
        "[새로운 균형이나 관계]",
        "[여운을 남기는 마지막 이미지]"
      ],
      "emotional_arc": "[카타르시스에서 여운으로 이어지는 감정 흐름]",
      "visual_moments": [
        "[변화를 상징하는 시각적 대비]",
        "[마지막 인상적인 프레임]"
      ],
      "dialogue_sample": "[여운을 남기거나 주제를 정리하는 마지막 대사]"
    }
  },
  "visual_style": [
    "[이 작품만의 독특한 시각적 특징 1]",
    "[일관된 비주얼 톤을 만드는 요소 2]",
    "[기억에 남을 시각적 모티프 3]"
  ],
  "mood_palette": [
    "[전체적인 정서적 색채 1]",
    "[작품을 관통하는 감정 톤 2]",
    "[독특한 분위기 요소 3]"
  ],
  "technical_approach": [
    "[촬영 기법이나 연출 스타일 1]",
    "[편집 리듬이나 전환 방식 2]",
    "[사운드 디자인 특징 3]"
  ],
  "target_audience_insights": [
    "[이 관객층이 특히 공감할 요소]",
    "[관객의 기대를 충족시키는 방법]",
    "[관객과의 정서적 연결 포인트]"
  ],
  "core_themes": [
    "[작품이 탐구하는 핵심 주제 1]",
    "[은유적으로 전달되는 메시지 2]"
  ],
  "signature_elements": [
    "[이 작품만의 독특한 서사 장치]",
    "[반복되는 시각적/청각적 모티프]"
  ]
}

### 최종 지침
- 모든 설명은 "보여주기(show)"로 작성하고 "말하기(tell)"를 피하세요
- 추상적 설명보다 구체적 행동과 이미지로 표현하세요
- 각 Act가 독립적으로도 흥미롭고, 전체적으로는 유기적으로 연결되도록 하세요
- 원본 스토리의 핵심은 유지하되, 창의적으로 확장하고 발전시키세요
- 템플릿이나 일반적인 설명이 아닌, 이 스토리만의 독특한 내용을 만들어주세요
- 전개 방식이나 설정을 직접 언급하지 말고, 자연스럽게 스토리에 녹여내세요
- JSON 형식을 정확히 지켜주세요`,
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
            
            // Save to database if requested
            let savedProject = null;
            if (saveAsProject || projectId) {
              try {
                // Get user for authentication
                const user = await getUser(request);
                if (user) {
                  const scenarioData = {
                    title: projectTitle || parsedResponse.structure.act1.title,
                    story,
                    genre,
                    tone,
                    target,
                    duration,
                    format,
                    tempo,
                    developmentMethod,
                    developmentIntensity,
                    structure: parsedResponse
                  };

                  if (projectId) {
                    // Update existing project
                    savedProject = await prisma.project.update({
                      where: { 
                        id: projectId,
                        userId: user.id // Ensure user owns the project
                      },
                      data: {
                        scenario: scenarioData,
                        status: 'processing',
                        updatedAt: new Date()
                      }
                    });
                    console.log(`[LLM] ✅ 기존 프로젝트 업데이트: ${projectId}`);
                  } else {
                    // Create new project
                    savedProject = await prisma.project.create({
                      data: {
                        title: projectTitle || `${genre} 스토리: ${parsedResponse.structure.act1.title}`,
                        description: `AI 생성 스토리 - ${tone} 톤앤매너`,
                        userId: user.id,
                        scenario: scenarioData,
                        status: 'draft',
                        tags: JSON.stringify([genre, tone, target])
                      }
                    });
                    console.log(`[LLM] ✅ 새 프로젝트 생성: ${savedProject.id}`);
                  }
                } else {
                  console.log('[LLM] ⚠️ 미인증 사용자 - 프로젝트 저장 건너뜀');
                }
              } catch (dbError) {
                console.error('[LLM] ❌ 데이터베이스 저장 실패:', dbError);
                // Continue without failing the whole request
              }
            }
            
            console.log('[LLM] ========== 스토리 생성 완료 ==========');
            
            // Return response with project info if saved
            const response = {
              ...parsedResponse,
              project: savedProject ? {
                id: savedProject.id,
                title: savedProject.title,
                saved: true
              } : null
            };
            
            return NextResponse.json(response);
            
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
