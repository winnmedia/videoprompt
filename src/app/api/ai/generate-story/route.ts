import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUser } from '@/shared/lib/auth';
import { 
  createValidationErrorResponse,
  createErrorResponse 
} from '@/shared/schemas/api.schema';
import { withCors } from '@/shared/lib/cors';

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

// Zod 스키마 정의 - 400 에러 방지를 위해 관대한 검증 + 기본값 제공
const StoryRequestSchema = z.object({
  story: z.string()
    .transform(val => val?.trim() || '')
    .refine(val => val.length >= 1, {
      message: '스토리를 입력해주세요 (최소 1자)'
    })
    .default('영상 시나리오를 만들어주세요'),
  genre: z.string()
    .transform(val => val?.trim() || '드라마')
    .default('드라마'),
  tone: z.string()
    .transform(val => {
      const cleanVal = val?.trim();
      // 빈 문자열이나 null/undefined 처리 강화
      return (!cleanVal || cleanVal === '') ? '일반적' : cleanVal;
    })
    .default('일반적'),
  target: z.string()
    .transform(val => val?.trim() || '일반 시청자')
    .default('일반 시청자'),
  duration: z.string().optional().default('60초'),
  format: z.string().optional().default('16:9'),
  tempo: z.string().optional().default('보통'),
  developmentMethod: z.string().optional().default('클래식 기승전결'),
  developmentIntensity: z.string().optional().default('보통'),
  projectId: z.string().uuid().optional(),
  saveAsProject: z.boolean().optional().default(false),
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

export const POST = withCors(async (request: NextRequest) => {
  try {
    const body = await request.json();
    
    // 데이터베이스 사용 가능 여부 런타임 체크
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    
    // 입력 데이터 검증
    const validationResult = StoryRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues.map((issue: any) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      
      // 첫 번째 에러 메시지를 우선으로 표시
      const primaryError = errorDetails[0];
      const userMessage = primaryError ? primaryError.message : '필수 정보가 누락되었습니다. 모든 필드를 입력했는지 확인해주세요.';
      
      return NextResponse.json({
        error: 'VALIDATION_ERROR',
        message: userMessage,
        details: errorDetails,
        userMessage
      }, { status: 400 });
    }

    const { story, genre, tone, target, duration, format, tempo, developmentMethod, developmentIntensity, projectId, saveAsProject, projectTitle } = validationResult.data;

    // Google Gemini API 키 확인 및 유효성 검증
    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    // 스토리 생성 시작
    // API 키 상태 확인 및 파라미터 검증

    // API 키 유효성 검증 (길이 조건 제거 - Gemini API 키는 가변 길이)
    const isValidApiKey = geminiApiKey && 
                         geminiApiKey !== 'your-actual-gemini-key' && 
                         geminiApiKey.startsWith('AIza');
    
    if (!isValidApiKey) {
      if (!geminiApiKey) {
        // Production에서는 로그 최소화
        if (process.env.NODE_ENV === 'development') {
        }
        return NextResponse.json({ 
          error: 'LLM_CONFIG_ERROR',
          message: 'AI 서비스 구성 오류: API 키가 설정되지 않음',
          userMessage: 'AI 스토리 생성이 일시적으로 불가능합니다. 잠시 후 다시 시도해주세요.'
        }, { status: 400 });
      } else if (geminiApiKey === 'your-actual-gemini-key') {
        if (process.env.NODE_ENV === 'development') {
        }
        return NextResponse.json({ 
          error: 'LLM_CONFIG_ERROR',
          message: 'AI 서비스 구성 오류: API 키가 플레이스홀더로 설정됨',
          userMessage: 'AI 스토리 생성이 일시적으로 불가능합니다. 관리자에게 문의하세요.'
        }, { status: 400 });
      } else {
        if (process.env.NODE_ENV === 'development') {
        }
        return NextResponse.json({ 
          error: 'LLM_CONFIG_ERROR',
          message: `AI 서비스 구성 오류: API 키 형식이 잘못됨 (${geminiApiKey?.substring(0, 10)}...)`,
          userMessage: 'AI 스토리 생성이 일시적으로 불가능합니다. 관리자에게 문의하세요.'
        }, { status: 400 });
      }
    }

    // Development 환경에서만 성공 로그
    if (process.env.NODE_ENV === 'development') {
    }

    // LLM 호출 재시도 로직 (최대 2회로 제한하여 무한 에러 방지)
    const MAX_RETRIES = 3; // 안정성을 위해 재시도 횟수 증가
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = exponentialBackoff(attempt - 1);
        // 재시도 대기
        await sleep(delay);
      }
      
      if (process.env.NODE_ENV === 'development') {
      }
      
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://www.vridge.kr',
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
${developmentIntensity === '강하게' ? `
- 첫 5초 안에 관객을 충격에 빠뜨릴 극적인 장면 (폭발, 비명, 급작스런 사건)
- 예상치 못한 극단적 상황: 추락, 배신, 죽음의 위기
- 강렬한 색상 대비와 급격한 사운드 변화로 감각적 충격 극대화
- 수수께끼보다는 직접적이고 원시적인 자극으로 즉각 몰입 유도` : `
- 첫 10초 안에 관객을 사로잡을 충격적/호기심 유발 장면으로 시작
- 예: 예상치 못한 사건, 강렬한 비주얼, 수수께끼 같은 대사
- 구체적인 시각적 요소와 소리를 묘사하여 즉각적인 몰입 유도`}

#### Act 2 - 급속 전개 (몰입)
${developmentIntensity === '강하게' ? `
- 숨막히는 연속적 사건으로 관객이 숨 쉴 틈 없는 전개
- 극단적 선택의 연속, 돌이킬 수 없는 결정들의 나열
- 감정의 롤러코스터: 희망과 절망의 급격한 교차
- 시각적 강도 증폭: 클로즈업, 빠른 컷, 극적 조명` : `
- 빠른 템포로 정보를 제공하며 긴장감 상승
- 캐릭터의 목표와 장애물을 명확히 제시
- 짧고 임팩트 있는 장면들을 연속 배치`}

#### Act 3 - 충격적 전환 (반전)
${developmentIntensity === '강하게' ? `
- 관객의 모든 예상을 산산조각 내는 충격적 진실 폭로
- 캐릭터와 관객 모두에게 정신적 충격을 주는 극적 반전
- 시각적 폭력: 급격한 색상 변화, 화면 분열, 왜곡된 사운드
- 감정의 폭발: 분노, 절망, 배신감의 극한 표현` : `
- 기존 설정을 뒤집는 예상 밖의 진실 공개
- 관객의 기대를 배반하는 플롯 트위스트
- 시각적/청각적 변화로 반전의 충격 극대화`}

#### Act 4 - 여운과 기대 (떡밥)
${developmentIntensity === '강하게' ? `
- 해결된 듯 보이지만 더 큰 의문을 남기는 불안한 결말
- 관객을 불편하게 만드는 미해결 갈등의 암시
- 강박적 궁금증을 유발하는 클리프행어
- 마지막 프레임까지 긴장감을 놓지 않는 연출` : `
- 해결되지 않은 미스터리 암시
- 다음 이야기에 대한 궁금증 유발
- 열린 결말 또는 숨겨진 단서 배치`}`,
    
    '귀납법': `
#### Act 1 - 첫 번째 구체적 사례
${developmentIntensity === '강하게' ? `
- 극단적이고 충격적인 상황의 생생한 묘사로 시작
- 감정적 트라우마나 인생을 바꾼 결정적 사건
- 예: "그날 밤, 모든 것이 무너졌다..."
- 강렬한 감각적 디테일로 관객을 즉시 상황 속으로 끌어들임` : `
- 특정 상황의 생생한 묘사와 인물의 경험
- 관찰 가능한 구체적 현상과 반응
- 예: "어느 화창한 아침, 김 씨는 카페에서..."`}

#### Act 2 - 두 번째 패턴 강화 사례
${developmentIntensity === '강하게' ? `
- 첫 번째보다 더 극적이고 파괴적인 유사 사건
- 패턴의 어두운 면, 돌이킬 수 없는 결과들
- 대조적 감정: 첫 사례의 희망 → 두 번째 사례의 절망
- 관객이 불안감을 느끼도록 하는 점진적 강도 증가` : `
- 다른 시공간, 다른 인물의 유사한 경험
- 첫 사례와의 공통점을 은근히 드러냄
- 패턴의 반복을 통한 규칙성 암시`}

#### Act 3 - 세 번째 결정적 사례
${developmentIntensity === '강하게' ? `
- 가장 충격적이고 돌이킬 수 없는 파국적 사례
- 앞선 패턴들이 만들어낸 최악의 시나리오
- 관객의 모든 예상을 뛰어넘는 극한 상황
- 시각적/청각적 충격으로 클라이막스 연출` : `
- 가장 강력하고 명확한 예시 제시
- 앞선 사례들과의 연결고리 강화
- 결론을 향한 논리적 다리 역할`}

#### Act 4 - 보편적 결론
${developmentIntensity === '강하게' ? `
- 충격적 사례들이 밝혀낸 잔혹한 진실
- 관객을 불편하게 만드는 날카로운 현실 직시
- "결국, 우리 모두는..." (암울하고 도발적 메시지)
- 쉽게 잊혀지지 않는 강렬한 여운` : `
- 개별 사례들로부터 도출된 일반 법칙
- "결국, 모든 경우에서..."
- 시청자가 스스로 깨달음을 얻도록 유도`}`,
    
    '연역법': `
#### Act 1 - 명제 제시
${developmentIntensity === '강하게' ? `
- 도발적이고 논란의 여지가 있는 대담한 주장 선언
- 권위에 도전하는 혁명적 관점 또는 금기시된 진실
- 예: "사랑은 인간을 파괴하는 가장 잔혹한 감정이다"
- 관객의 기존 믿음을 뒤흔드는 충격적 시작` : `
- 핵심 주장이나 법칙을 명확히 선언
- 권위 있는 내레이션 또는 주인공의 확신에 찬 대사
- 예: "사랑은 모든 것을 극복한다"`}

#### Act 2 - 첫 번째 논증
${developmentIntensity === '강하게' ? `
- 명제를 뒷받침하는 충격적이고 극단적인 증거
- 일반적 통념을 산산조각 내는 잔혹한 현실
- 감정적 충격과 논리적 설득력의 동시 공격
- 관객의 방어기제를 무너뜨리는 압도적 사례` : `
- 명제를 뒷받침하는 강력한 증거 제시
- 구체적인 상황과 결과를 통한 입증
- 논리적 연결고리 명확화`}

#### Act 3 - 두 번째 심화 논증
${developmentIntensity === '강하게' ? `
- 더욱 극단적이고 논박 불가능한 증거 추가
- 반대 의견을 완전히 분쇄하는 압도적 논리
- 관객의 마지막 저항을 무너뜨리는 결정적 타격
- 지적/감정적 항복을 유도하는 강력한 설득` : `
- 다른 각도에서의 추가 증명
- 반대 논리에 대한 반박 포함
- 더 깊은 차원의 이해 제공`}

#### Act 4 - 종합과 재확인
${developmentIntensity === '강하게' ? `
- 논증의 파괴력을 극대화한 충격적 결론
- 관객의 세계관을 완전히 뒤바꾸는 혁명적 깨달음
- 처음 명제가 진실임을 압도적으로 입증
- 관객을 불편하고 혼란스럽게 만드는 강력한 마무리` : `
- 모든 논증을 종합한 최종 결론
- 처음 명제의 타당성 재확인
- 강력한 마무리 메시지`}`,
    
    '다큐(인터뷰식)': `
#### Act 1 - 주제 도입과 화자 소개
${developmentIntensity === '강하게' ? `
- 충격적 사실이나 스캔들로 시작하는 긴급 보도 스타일
- 금기시된 진실을 폭로하겠다는 인터뷰이의 용기 있는 결단
- 생명을 위협하는 수준의 민감한 주제나 은폐된 사건
- 관객을 즉시 긴장 상태로 만드는 위험한 분위기` : `
- 다큐멘터리 스타일의 오프닝
- 인터뷰이의 배경과 신뢰성 확립
- 핵심 질문이나 탐구 주제 제시`}

#### Act 2 - 첫 번째 증언
${developmentIntensity === '강하게' ? `
- 트라우마틱한 개인사와 충격적 폭로
- 감정적 붕괴와 눈물, 분노의 날것 그대로 노출
- 사회적 금기를 깨는 용기 있는 고백
- 인터뷰이의 목소리 떨림과 극도의 긴장감` : `
- 개인적 경험담과 구체적 사례
- 감정적 호소와 팩트의 균형
- 실제 대화체를 사용한 생생함`}

#### Act 3 - 대조적 관점
${developmentIntensity === '강하게' ? `
- 정면으로 충돌하는 적대적 증언과 반박
- 진실을 둘러싼 첨예한 대립과 논쟁
- 서로를 거짓말쟁이로 몰아가는 격렬한 공방
- 어느 쪽이 진실인지 혼란스러운 극한 갈등` : `
- 다른 시각의 인터뷰이 등장
- 주제에 대한 다층적 이해 제공
- 갈등이나 긴장감 조성`}

#### Act 4 - 종합과 통찰
${developmentIntensity === '강하게' ? `
- 충격적 진실이 드러나며 모든 것이 뒤바뀌는 순간
- 관객이 예상하지 못한 반전과 추가 폭로
- 해결되지 않은 미스터리와 더 큰 음모의 암시
- 시청자를 불안하게 만드는 열린 결말` : `
- 내레이터의 종합적 분석
- 인터뷰 내용의 의미 해석`}
- 시청자에게 던지는 화두`,
    
    '픽사스토리': `
#### Act 1 - "옛날 옛적에" (평범한 일상)
${developmentIntensity === '강하게' ? `
- 겉으로는 평범하지만 내재된 위험이나 불안 요소
- 주인공의 깊은 상처나 트라우마가 스며든 일상
- 밝은 외관 아래 숨겨진 어두운 진실이나 비밀
- 언제 터질지 모르는 시한폭탄 같은 긴장감` : `
- 주인공의 안정적이고 반복적인 일상
- 세계관과 규칙 자연스럽게 소개
- 따뜻하고 친근한 분위기 조성`}

#### Act 2 - "매일 매일" (루틴과 갈망)
${developmentIntensity === '강하게' ? `
- 억압된 욕망과 절망적 갈증의 점진적 폭로
- 일상에 균열을 만드는 강박적 행동이나 환상
- 주인공을 옥죄는 현실의 잔혹함과 한계
- 폭발 직전의 감정적 압박과 내적 갈등` : `
- 일상의 반복 속 숨겨진 욕구
- 작은 불만족이나 꿈의 암시
- 변화를 예고하는 미세한 신호들`}

#### Act 3 - "그러던 어느 날" (전환점)
${developmentIntensity === '강하게' ? `
- 삶을 완전히 뒤바꾸는 충격적이고 돌이킬 수 없는 사건
- 극단적 선택을 강요하는 절체절명의 순간
- 모든 것을 잃을 수도 있는 위험천만한 모험
- 과거의 자아를 죽이고 새롭게 태어나는 극적 변화` : `
- 일상을 깨뜨리는 특별한 사건
- 주인공의 선택의 순간
- 모험의 시작과 도전`}

#### Act 4 - "그 때문에" (새로운 균형)
${developmentIntensity === '강하게' ? `
- 고통스럽지만 필연적인 성장과 깨달음
- 상실과 희생을 통해 얻은 진정한 자유
- 과거로 돌아갈 수 없는 돌이킬 수 없는 변화
- 씁쓸하지만 깊이 있는 성숙한 결말` : `
- 사건이 가져온 변화와 성장
- 교훈이나 깨달음의 자연스러운 전달
- 더 나은 새로운 일상의 확립`}`,
    
    '클래식 기승전결': `
#### Act 1 - 기 (설정)
${developmentIntensity === '강하게' ? `
- 불길한 전조와 긴장감 넘치는 배경 설정
- 주요 인물들의 어두운 과거와 숨겨진 동기
- 폭발적 갈등을 예고하는 위험한 관계 구조
- 평온함 속에 도사린 파멸의 기운` : `
- 시공간 배경의 섬세한 묘사
- 주요 인물들의 성격과 관계 확립
- 일상 속 잠재된 갈등의 씨앗`}

#### Act 2 - 승 (전개)
${developmentIntensity === '강하게' ? `
- 걷잡을 수 없이 악화되는 극단적 갈등
- 인물 간의 적대적 대립과 배신의 연쇄
- 파국으로 치닫는 급격한 상황 악화
- 긴장감이 극한으로 치솟는 위기의 연속` : `
- 갈등의 점진적 심화
- 인물 간 관계의 복잡화
- 긴장감의 단계적 상승`}

#### Act 3 - 전 (절정)
${developmentIntensity === '강하게' ? `
- 모든 것이 파멸로 향하는 폭발적 클라이막스
- 생사를 가르는 극한의 대결과 선택
- 돌이킬 수 없는 파괴적 결과를 낳는 행동
- 감정과 이성이 완전히 붕괴하는 극한 상황` : `
- 모든 갈등이 정점에 도달
- 결정적 대립과 선택의 순간
- 감정의 폭발과 극적 전환`}

#### Act 4 - 결 (해결)
${developmentIntensity === '강하게' ? `
- 파괴 후의 폐허와 상처받은 인물들
- 희생과 상실을 통한 깊고 아픈 깨달음
- 완전한 회복이 불가능한 영원한 변화
- 비극적이지만 숙명적인 운명의 수용` : `
- 갈등의 해소와 새로운 균형
- 인물들의 변화와 성장
- 여운을 남기는 마무리`}`
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
서사 강도: ${developmentIntensity === '강하게' ? '극단적 - 관객을 압도하고 충격에 빠뜨리는 수준' : developmentIntensity === '부드럽게' ? '온화함 - 자극적이지 않고 편안한 수준' : '보통 - 적당한 긴장감 유지'}
상영 시간: ${duration || '5분'}
화면 비율: ${format || '16:9'}
리듬감: ${tempo || '보통'}
전개 방식: ${developmentMethod} ${developmentIntensity === '강하게' ? '(극대화된 강도로 적용)' : ''}
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

        if (process.env.NODE_ENV === 'development') {
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          if (process.env.NODE_ENV === 'development') {
          }
          
          // 429 (Rate Limit) 에러는 재시도 가치가 있음
          if (response.status === 429) {
            lastError = new Error(`Rate limit exceeded: ${errorText}`);
            continue;
          }
          
          // 400번대 에러는 재시도해도 해결 안됨
          if (response.status >= 400 && response.status < 500) {
            if (process.env.NODE_ENV === 'development') {
            }
            return NextResponse.json({ 
              error: 'AI 요청 형식 오류입니다. 입력 내용을 확인해주세요.' 
            }, { status: 400 });
          }
          
          // 500번대 에러는 재시도
          lastError = new Error(`Server error ${response.status}: ${errorText}`);
          continue;
        }
        
        const data = await response.json();
        if (process.env.NODE_ENV === 'development') {
          console.log('[LLM] API 응답 수신:', { 
            candidates: data.candidates?.length || 0,
            hasContent: !!data.candidates?.[0]?.content,
            finishReason: data.candidates?.[0]?.finishReason
          });
        }
        
        let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
          if (process.env.NODE_ENV === 'development') {
          }
          lastError = new Error('Empty response from API');
          continue;
        }
        
        if (process.env.NODE_ENV === 'development') {
        }
        
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
            
            if (process.env.NODE_ENV === 'development') {
              console.log('[LLM] ✅ JSON 파싱 및 검증 성공');
            }
            
            // Save to database if requested
            let savedProject = null;
            if (saveAsProject || projectId) {
              try {
                // 🔐 보안 강화: 인증된 사용자만 DB 저장 허용
                let user = null;
                try {
                  user = await getUser(request);
                } catch (authError) {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[LLM] 인증 실패 - DB 저장 거부:', authError);
                  }
                }

                if (!user) {
                  console.warn('🚨 미인증 사용자 - DB 저장 거부');
                  // 인증되지 않은 사용자는 DB 저장 없이 AI 결과만 반환
                } else if (hasDatabaseUrl) {
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
                        metadata: scenarioData,
                        status: 'processing',
                        updatedAt: new Date()
                      }
                    });
                    // 기존 프로젝트 업데이트
                  } else {
                    // Create new project
                    savedProject = await prisma.project.create({
                      data: {
                        title: projectTitle || `${genre} 스토리: ${parsedResponse.structure.act1.title}`,
                        description: `AI 생성 스토리 - ${tone} 톤앤매너`,
                        userId: user.id,
                        metadata: scenarioData,
                        status: 'draft',
                        tags: JSON.stringify([genre, tone, target])
                      }
                    });
                    // 새 프로젝트 생성
                  }
                } else {
                  if (process.env.NODE_ENV === 'development') {
                    if (!hasDatabaseUrl) {
                      console.log('[LLM] ⚠️ DATABASE_URL 없음 - 프로젝트 저장 건너뜀');
                    }
                  }
                }
              } catch (dbError) {
                if (process.env.NODE_ENV === 'development') {
                  console.error('[LLM] ❌ 데이터베이스 저장 실패:', dbError);
                }
                // Continue without failing the whole request
              }
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.log('[LLM] ========== 스토리 생성 완료 ==========');
            }
            
            // Return response with project info if saved
            const response = {
              ...parsedResponse,
              project: savedProject ? {
                id: savedProject.id,
                title: savedProject.title,
                saved: true as const
              } : undefined
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
});

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
