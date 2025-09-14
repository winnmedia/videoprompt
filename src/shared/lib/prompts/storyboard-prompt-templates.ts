/**
 * 스토리보드 생성 프롬프트 템플릿
 *
 * Gemini 2.0 Flash Preview에 최적화된 스토리보드 생성
 * - 실제 콘티 구조 분석
 * - 카메라 앵글 및 조명 설정
 * - 영화적 구성 요소
 */

export interface StoryboardRequest {
  structure: any; // Story structure from generate-story API
  visualStyle: string;
  duration: string;
  aspectRatio: string;
  shotCount?: number;
}

export interface StoryboardShot {
  id: string;
  title: string;
  description: string;
  camera_angle: string;
  lighting: string;
  image_prompt: string;
  negative_prompt: string;
  duration: string;
  timing?: {
    start: number;
    end: number;
  };
}

/**
 * 스토리보드 생성 메인 프롬프트
 */
export function buildStoryboardPrompt(request: StoryboardRequest): string {
  const totalShots = request.shotCount || calculateOptimalShotCount(request.duration);
  const shotsPerAct = Math.ceil(totalShots / 4);

  return `## 🎬 AI 시네마틱 스토리보드 생성기

당신은 세계적인 영화 감독이자 시네마토그래퍼입니다. 주어진 스토리 구조를 바탕으로 전문적인 영화 스토리보드를 제작해야 합니다.

### 📝 스토리 구조 분석

**Act 1: ${request.structure.act1?.title || '시작'}**
${request.structure.act1?.description || ''}
핵심 요소: ${JSON.stringify(request.structure.act1?.key_elements || [])}

**Act 2: ${request.structure.act2?.title || '전개'}**
${request.structure.act2?.description || ''}
핵심 요소: ${JSON.stringify(request.structure.act2?.key_elements || [])}

**Act 3: ${request.structure.act3?.title || '절정'}**
${request.structure.act3?.description || ''}
핵심 요소: ${JSON.stringify(request.structure.act3?.key_elements || [])}

**Act 4: ${request.structure.act4?.title || '해결'}**
${request.structure.act4?.description || ''}
핵심 요소: ${JSON.stringify(request.structure.act4?.key_elements || [])}

### 🎯 제작 사양
- 📐 화면비: ${request.aspectRatio}
- ⏱️ 총 러닝타임: ${request.duration}
- 🎨 비주얼 스타일: ${request.visualStyle}
- 🎬 총 샷 수: ${totalShots}개 (Act당 약 ${shotsPerAct}개)

### 🎥 시네마틱 가이드라인

#### 카메라 앵글 분류
- **Extreme Wide Shot (EWS)**: 환경과 규모감 강조
- **Wide Shot (WS)**: 전체 상황과 캐릭터 관계
- **Medium Shot (MS)**: 대화와 상호작용
- **Close-Up (CU)**: 감정과 디테일
- **Extreme Close-Up (ECU)**: 극적 강조
- **Over-the-Shoulder**: 관점과 몰입감
- **Dutch Angle**: 불안감과 역동성

#### 조명 설정
- **Golden Hour**: 따뜻하고 로맨틱한 분위기
- **Blue Hour**: 신비롭고 서정적인 분위기
- **Hard Light**: 극적이고 대비가 강한 분위기
- **Soft Light**: 부드럽고 자연스러운 분위기
- **Backlighting**: 실루엣과 드라마틱한 효과
- **Side Lighting**: 형태와 질감 강조
- **High Key**: 밝고 긍정적인 분위기
- **Low Key**: 어둡고 신비로운 분위기

#### 구성 원칙
- **Rule of Thirds**: 시각적 균형과 흥미
- **Leading Lines**: 시선 유도와 역동성
- **Framing**: 집중과 몰입감
- **Symmetry**: 안정감과 격조
- **Depth of Field**: 주제 강조와 분위기

### 📋 JSON 응답 형식

다음 구조로 정확히 응답해주세요:

\`\`\`json
{
  "success": true,
  "shots": [
    {
      "id": "shot-001",
      "title": "[샷의 목적과 내용을 나타내는 제목]",
      "description": "[3-4문장의 구체적인 장면 설명. 인물의 행동, 감정, 환경 묘사 포함]",
      "camera_angle": "[위 가이드라인의 카메라 앵글 중 선택]",
      "lighting": "[위 가이드라인의 조명 설정 중 선택]",
      "image_prompt": "[영화급 품질의 상세한 이미지 생성 프롬프트. 다음 요소 포함: 주제, 구성, 색상, 분위기, 카메라 설정, 렌즈 효과]",
      "negative_prompt": "[피해야 할 요소들: 저품질, 흐림, 왜곡, 텍스트, 워터마크 등]",
      "duration": "[이 샷의 지속 시간 (예: 3초, 5초)]",
      "timing": {
        "start": 0,
        "end": 3
      }
    }
  ],
  "metadata": {
    "total_shots": ${totalShots},
    "estimated_duration": "${request.duration}",
    "visual_style": "${request.visualStyle}",
    "aspect_ratio": "${request.aspectRatio}",
    "production_notes": "[전체 스토리보드의 연출 의도와 특징]"
  }
}
\`\`\`

### 🎬 전문적 스토리보드 제작 요구사항

#### 1. 시각적 연속성 (Visual Continuity)
- Act 간의 자연스러운 전환과 흐름
- 일관된 색상 팔레트와 조명 톤
- 캐릭터와 오브젝트의 위치 연속성

#### 2. 감정적 아크 (Emotional Arc)
- 각 Act의 감정 변화를 시각적으로 표현
- 카메라 앵글로 심리상태 전달
- 조명으로 분위기와 긴장감 조절

#### 3. 리듬감 (Pacing)
- 액션 장면은 빠른 컷과 다양한 앵글
- 감정적 순간은 롱테이크와 클로즈업
- 전환 장면은 미디엄샷으로 안정감

#### 4. 이미지 프롬프트 품질 기준
- 영화급 시네마토그래피 수준
- 구체적인 카메라 설정 명시 (35mm, 85mm lens 등)
- 전문적인 조명 용어 사용
- 색상 그레이딩 지시사항 포함

#### 5. 샷 분배 전략
${generateShotDistributionGuide(totalShots, request.structure)}

### ⚠️ 중요 지침

✅ **반드시 포함할 요소:**
- 각 샷마다 명확한 시각적 목적
- 스토리 진행에 필수적인 정보 전달
- 영화적 품질의 구성과 조명
- 감정적 임팩트가 있는 순간들

❌ **피해야 할 요소:**
- 불필요하거나 반복적인 샷
- 기술적으로 불가능한 앵글
- 일관성 없는 비주얼 스타일
- 저품질 또는 아마추어적 구성

지금 전문적이고 영화적인 스토리보드를 제작해주세요!`;
}

/**
 * 최적 샷 수 계산
 */
function calculateOptimalShotCount(duration: string): number {
  const durationMap: Record<string, number> = {
    '30초': 8,
    '60초': 12,
    '90초': 16,
    '2분': 18,
    '3분': 24,
    '5분': 30
  };

  return durationMap[duration] || 12;
}

/**
 * 샷 분배 가이드 생성
 */
function generateShotDistributionGuide(totalShots: number, structure: any): string {
  const shotsPerAct = Math.ceil(totalShots / 4);

  return `
**Act 1 (${shotsPerAct}샷): 세팅과 훅**
- 환경 소개: Wide Shot 또는 Establishing Shot
- 캐릭터 등장: Medium Shot에서 Close-Up으로 점진적 접근
- 훅/사건: 임팩트 있는 앵글과 조명으로 강조

**Act 2 (${shotsPerAct}샷): 전개와 갈등**
- 관계 설정: Over-the-Shoulder와 Two Shot 활용
- 갈등 심화: 다양한 앵글로 긴장감 조성
- 정보 전달: Medium Shot과 Close-Up 조합

**Act 3 (${shotsPerAct}샷): 절정과 클라이막스**
- 절정 준비: Low Angle로 위압감 또는 High Angle로 취약함
- 클라이막스: Extreme Close-Up과 Wide Shot의 극적 대비
- 감정 폭발: Dutch Angle과 동적 구성

**Act 4 (${Math.floor(totalShots - shotsPerAct * 3)}샷): 해결과 여운**
- 해결: 안정적인 앵글로 균형 회복
- 변화 표현: Before/After 구성이나 시각적 대비
- 마무리: 여운을 남기는 의미있는 마지막 프레임`;
}

/**
 * 이미지 프롬프트 최적화를 위한 프롬프트
 */
export function buildImagePromptOptimizationPrompt(
  description: string,
  style: {
    visualStyle?: string;
    genre?: string;
    mood?: string;
    cameraAngle?: string;
    lighting?: string;
  },
  targetService: string = 'stable-diffusion'
): string {
  const serviceInstructions = {
    'midjourney': 'Midjourney v6 스타일의 상세하고 예술적인 프롬프트. 카메라 설정, 조명, 아트 스타일을 포함하며 --ar, --style, --chaos 등의 파라미터 활용',
    'dalle': 'DALL-E 3에 최적화된 명확하고 구체적인 프롬프트. 안전 가이드라인을 준수하며 시각적 디테일 강조',
    'stable-diffusion': 'Stable Diffusion XL용 키워드 중심의 구조화된 프롬프트. 품질 태그와 네거티브 프롬프트 포함',
    'general': '범용 이미지 생성 서비스에 적합한 균형잡힌 프롬프트'
  };

  return `## 🎬 AI 시네마틱 이미지 프롬프트 최적화 엔진

당신은 전문 이미지 프롬프트 엔지니어입니다. 스토리보드 장면 설명을 ${targetService} 이미지 생성에 최적화된 영화급 품질의 프롬프트로 변환해주세요.

### 📝 원본 장면 설명
${description}

### 🎨 스타일 컨텍스트
- **비주얼 스타일**: ${style.visualStyle || '미지정'}
- **장르**: ${style.genre || '미지정'}
- **분위기**: ${style.mood || '미지정'}
- **카메라 앵글**: ${style.cameraAngle || '미지정'}
- **조명**: ${style.lighting || '미지정'}

### 🎯 ${targetService} 최적화 가이드라인
${serviceInstructions[targetService as keyof typeof serviceInstructions]}

### 📋 출력 형식

다음 형식으로 정확히 응답해주세요:

\`\`\`
POSITIVE_PROMPT: [최적화된 긍정 프롬프트]
NEGATIVE_PROMPT: [피해야 할 요소들]
EXPLANATION: [최적화 이유와 기술적 고려사항]
\`\`\`

### 🎬 영화급 품질 요구사항

#### 1. 기술적 품질 지시사항
- 카메라: "shot on RED camera, 35mm lens, shallow depth of field"
- 조명: "cinematic lighting, professional color grading"
- 해상도: "8K, ultra-detailed, photorealistic"

#### 2. 예술적 구성 요소
- 구성: "rule of thirds, leading lines, visual balance"
- 색상: "cinematic color palette, moody atmosphere"
- 텍스처: "film grain, cinematic quality"

#### 3. 장르별 특화 키워드
${generateGenreSpecificKeywords(style.genre)}

#### 4. 필수 제외 요소 (Negative Prompt)
- "low quality, blurry, distorted, amateur, phone camera"
- "watermark, text, signature, logo, frames"
- "oversaturated, cartoon, anime, sketch, painting"

### ⚠️ 최적화 원칙

✅ **강조해야 할 요소:**
- 영화적 조명과 구성
- 전문적인 카메라워크
- 사실적이고 디테일한 표현
- 감정적 임팩트

❌ **피해야 할 요소:**
- 만화나 일러스트 스타일
- 아마추어적 구성
- 과도한 필터나 효과
- 텍스트나 워터마크

지금 전문적인 이미지 프롬프트로 최적화해주세요!`;
}

/**
 * 장르별 특화 키워드 생성
 */
function generateGenreSpecificKeywords(genre?: string): string {
  const genreKeywords: Record<string, string> = {
    '드라마': '"emotional depth, realistic lighting, intimate framing, natural colors"',
    '액션': '"dynamic composition, high contrast, motion blur, dramatic angles"',
    '로맨스': '"soft lighting, warm tones, dreamy atmosphere, close-up intimacy"',
    '스릴러': '"dark shadows, high contrast, tension-filled composition, cool tones"',
    '코미디': '"bright lighting, vibrant colors, expressive framing, cheerful atmosphere"',
    '공포': '"low-key lighting, deep shadows, unsettling composition, desaturated colors"',
    'SF': '"futuristic lighting, neon accents, high-tech atmosphere, blue-cyan palette"',
    '판타지': '"magical lighting, ethereal atmosphere, rich colors, mystical composition"'
  };

  return genreKeywords[genre || ''] || '"cinematic quality, professional composition"';
}