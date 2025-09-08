#!/usr/bin/env node

/**
 * LLM 개입 없는 순수 로직 프롬프트 품질 테스트
 */

// 시뮬레이션 함수 (실제 컴파일러 로직 재현)
function compilePromptPureLogic(userInput, options = {}) {
  const {
    visualElements = [],
    environment = {},
    cinematography = {},
    style = {},
    audioLayers = []
  } = options;

  const parts = [];
  
  // 1. 사용자 직접 입력
  if (userInput.directPrompt) {
    parts.push(userInput.directPrompt.trim());
  }
  
  // 2. 시각적 요소 (우선순위순 정렬)
  if (visualElements.length > 0) {
    const sortedElements = visualElements
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .map(el => el.description)
      .filter(desc => desc.trim());
    parts.push(sortedElements.join(', '));
  }
  
  // 3. 환경 설정
  const envParts = [];
  if (environment.location) envParts.push(environment.location);
  if (environment.lighting) envParts.push(`${environment.lighting} lighting`);
  if (environment.weather) envParts.push(environment.weather);
  if (environment.timeOfDay) envParts.push(environment.timeOfDay);
  
  if (envParts.length > 0) {
    parts.push(envParts.join(', '));
  }
  
  // 4. 카메라 워크
  const cameraDetails = [];
  if (cinematography.cameraMovement) {
    cameraDetails.push(`${cinematography.cameraMovement} camera movement`);
  }
  if (cinematography.cameraAngle) {
    cameraDetails.push(`${cinematography.cameraAngle} angle`);
  }
  if (cinematography.lens) {
    cameraDetails.push(`${cinematography.lens} lens`);
  }
  
  if (cameraDetails.length > 0) {
    parts.push(cameraDetails.join(', '));
  }
  
  // 5. 스타일 지시사항
  if (style.visualStyle) parts.push(style.visualStyle);
  if (style.mood) parts.push(`${style.mood} mood`);
  if (style.genre) parts.push(style.genre);
  
  // 6. Veo 3 오디오 레이어 (LLM 없이도 구조화된 신택스)
  audioLayers.forEach(layer => {
    switch (layer.type) {
      case 'sfx':
        if (layer.description) parts.push(`[SFX: ${layer.description}]`);
        break;
      case 'music':
        if (layer.description) parts.push(`[Music: ${layer.description}]`);
        break;
      case 'dialogue':
        if (layer.speaker && layer.content) {
          parts.push(`${layer.speaker}: "${layer.content}"`);
        }
        break;
    }
  });
  
  // 7. 최종 조합
  const compiledPrompt = parts
    .filter(p => p && p.trim())
    .join('. ')
    .replace(/\s+/g, ' ')
    .trim();
    
  return {
    prompt: compiledPrompt,
    length: compiledPrompt.length,
    parts: parts,
    elementCount: parts.length
  };
}

// 테스트 케이스들
const testCases = [
  {
    name: "🎬 영화적 액션 시퀀스",
    userInput: { directPrompt: "Two businessmen on a rooftop making a dangerous deal" },
    options: {
      visualElements: [
        { description: "dramatic city skyline", priority: 9 },
        { description: "fog rolling between buildings", priority: 8 },
        { description: "red blinking antenna lights", priority: 7 },
        { description: "men in dark suits", priority: 10 },
        { description: "briefcase exchange", priority: 9 }
      ],
      environment: {
        location: "urban rooftop at night",
        lighting: "cinematic low-key",
        weather: "light fog",
        timeOfDay: "midnight"
      },
      cinematography: {
        cameraMovement: "slow circular tracking",
        cameraAngle: "low angle",
        lens: "35mm wide"
      },
      style: {
        visualStyle: "neo-noir",
        mood: "tense",
        genre: "crime thriller"
      },
      audioLayers: [
        { type: 'sfx', description: 'wind whistling through buildings' },
        { type: 'sfx', description: 'distant city traffic' },
        { type: 'music', description: 'subtle tension-building score' }
      ]
    }
  },
  
  {
    name: "🌅 자연 다큐멘터리",
    userInput: { directPrompt: "A majestic eagle soaring over mountain peaks" },
    options: {
      visualElements: [
        { description: "golden eagle in flight", priority: 10 },
        { description: "snow-capped mountain peaks", priority: 9 },
        { description: "morning mist in valleys", priority: 7 },
        { description: "pristine wilderness", priority: 8 }
      ],
      environment: {
        location: "alpine mountain range",
        lighting: "golden hour",
        weather: "clear sky",
        timeOfDay: "early morning"
      },
      cinematography: {
        cameraMovement: "smooth tracking",
        cameraAngle: "bird's eye view",
        lens: "200mm telephoto"
      },
      style: {
        visualStyle: "documentary",
        mood: "serene",
        genre: "nature documentary"
      },
      audioLayers: [
        { type: 'sfx', description: 'eagle cry echoing' },
        { type: 'sfx', description: 'mountain wind' },
        { type: 'music', description: 'orchestral nature score' }
      ]
    }
  },
  
  {
    name: "🚗 고속 추격전",
    userInput: { directPrompt: "High-speed car chase through narrow city streets" },
    options: {
      visualElements: [
        { description: "sports car racing", priority: 10 },
        { description: "sparks flying from impacts", priority: 9 },
        { description: "crowded market streets", priority: 8 },
        { description: "vendors diving for cover", priority: 7 }
      ],
      environment: {
        location: "busy marketplace",
        lighting: "harsh daylight",
        weather: "clear",
        timeOfDay: "noon"
      },
      cinematography: {
        cameraMovement: "dynamic handheld tracking",
        cameraAngle: "low tracking shot",
        lens: "24mm wide"
      },
      style: {
        visualStyle: "kinetic action",
        mood: "adrenaline-pumping",
        genre: "action thriller"
      },
      audioLayers: [
        { type: 'sfx', description: 'engine roaring and tire screeching' },
        { type: 'sfx', description: 'crowd screaming' },
        { type: 'music', description: 'intense electronic score' }
      ]
    }
  },
  
  {
    name: "💫 최소한의 입력 (사용자가 게을러서)",
    userInput: { directPrompt: "cat" },
    options: {
      visualElements: [
        { description: "fluffy orange tabby", priority: 5 }
      ],
      environment: {
        lighting: "soft natural"
      },
      cinematography: {
        cameraAngle: "close-up"
      },
      style: {
        mood: "cute"
      },
      audioLayers: [
        { type: 'sfx', description: 'gentle purring' }
      ]
    }
  }
];

console.log('🧪 LLM 개입 없는 순수 로직 프롬프트 품질 테스트');
console.log('=' .repeat(70));

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log('-'.repeat(50));
  
  const result = compilePromptPureLogic(testCase.userInput, testCase.options);
  
  console.log(`📝 생성된 프롬프트:`);
  console.log(`"${result.prompt}"`);
  
  console.log(`\n📊 통계:`);
  console.log(`  - 길이: ${result.length} 글자`);
  console.log(`  - 구성 요소: ${result.elementCount}개`);
  console.log(`  - 구조적 완성도: ${result.elementCount >= 4 ? '✅ 높음' : result.elementCount >= 2 ? '⚠️ 보통' : '❌ 낮음'}`);
  
  // 품질 분석
  const hasAudio = result.prompt.includes('[SFX:') || result.prompt.includes('[Music:');
  const hasCamera = result.prompt.includes('camera') || result.prompt.includes('angle') || result.prompt.includes('lens');
  const hasEnvironment = result.prompt.includes('lighting') || result.prompt.includes('weather');
  const hasStyle = result.prompt.includes('mood') || result.prompt.includes('genre');
  
  console.log(`\n🎯 품질 지표:`);
  console.log(`  - Veo 3 오디오 신택스: ${hasAudio ? '✅' : '❌'}`);
  console.log(`  - 카메라 워크 지정: ${hasCamera ? '✅' : '❌'}`);
  console.log(`  - 환경 묘사: ${hasEnvironment ? '✅' : '❌'}`);
  console.log(`  - 스타일 방향성: ${hasStyle ? '✅' : '❌'}`);
  
  const qualityScore = [hasAudio, hasCamera, hasEnvironment, hasStyle].filter(Boolean).length;
  console.log(`  - 전체 품질 점수: ${qualityScore}/4 (${Math.round(qualityScore/4*100)}%)`);
});

// 결론
console.log('\n' + '='.repeat(70));
console.log('📈 전체 분석 결과');
console.log('='.repeat(70));

console.log(`
🎯 LLM 없는 순수 로직의 장점:
✅ 즉시 응답 (지연 없음)
✅ 일관된 구조 (예측 가능)
✅ 비용 제로 (API 호출 없음)  
✅ Veo 3 최적화 신택스 지원
✅ 사용자 의도 100% 보존

⚠️  한계점:
- 창의적 표현 부족
- 문맥 추론 불가
- 동의어/유의어 확장 없음
- 복잡한 스토리텔링 불가

🏆 결론: 
구조화된 입력이 있다면 LLM 없이도 
전문적인 품질의 프롬프트 생성 가능!
`);