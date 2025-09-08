#!/usr/bin/env node

/**
 * LLM 개입 테스트 스크립트
 * 
 * 용도: 
 * - 로컬/프로덕션에서 실제 LLM 개입 여부 확인
 * - API 키 설정 상태 및 Gemini API 호출 결과 검증
 * - 기본 템플릿 vs LLM 생성 결과 구분
 */

const TEST_SCENARIOS = [
  {
    name: '기본 드라마 테스트',
    request: {
      story: '어린 소녀가 마법의 숲에서 잃어버린 부모를 찾아간다',
      genre: '드라마',
      tone: '감성적, 따뜻함',
      target: '가족',
      developmentMethod: '클래식 기승전결'
    }
  },
  {
    name: '훅-몰입-반전 테스트',
    request: {
      story: '평범한 직장인이 어느 날 갑자기 시간을 되돌릴 수 있는 능력을 얻는다',
      genre: 'SF',
      tone: '미스터리, 긴장감',
      target: '일반',
      developmentMethod: '훅-몰입-반전-떡밥'
    }
  },
  {
    name: '픽사스토리 테스트',
    request: {
      story: '로봇이 버려진 지구에서 마지막 식물을 발견한다',
      genre: '애니메이션',
      tone: '희망적, 감동적',
      target: '전체관람가',
      developmentMethod: '픽사스토리'
    }
  }
];

const ENDPOINTS = {
  local: 'http://localhost:3000/api/ai/generate-story',
  production: 'https://www.vridge.kr/api/ai/generate-story'
};

async function testLLMIntervention(endpoint, scenario) {
  console.log(`\n🧪 테스트: ${scenario.name}`);
  console.log(`📍 엔드포인트: ${endpoint}`);
  console.log(`📝 스토리: "${scenario.request.story}"`);
  console.log(`⚙️  전개방식: ${scenario.request.developmentMethod}`);

  try {
    const startTime = Date.now();
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(scenario.request)
    });

    const responseTime = Date.now() - startTime;
    console.log(`⏱️  응답시간: ${responseTime}ms`);

    if (!response.ok) {
      console.log(`❌ HTTP 오류: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`📄 오류 내용: ${errorText.substring(0, 200)}`);
      return false;
    }

    const data = await response.json();

    // LLM 개입 여부 판단 로직
    const isLLMGenerated = analyzeLLMIntervention(data, scenario.request);
    
    console.log(`🤖 LLM 개입: ${isLLMGenerated ? '✅ 성공' : '❌ 실패 (기본 템플릿)'}`);
    
    if (isLLMGenerated) {
      console.log(`🎯 생성 결과 품질:`);
      console.log(`   - Act1: "${data.structure.act1.description}"`);
      console.log(`   - 감정변화: ${data.structure.act1.emotional_arc}`);
      console.log(`   - 시각스타일: [${data.visual_style?.join(', ') || 'N/A'}]`);
    } else {
      console.log(`📋 기본 템플릿 사용됨:`);
      console.log(`   - 제목: ${data.structure.act1.title}`);
      console.log(`   - 설명: ${data.structure.act1.description}`);
    }

    return isLLMGenerated;

  } catch (error) {
    console.log(`💥 네트워크 오류: ${error.message}`);
    return false;
  }
}

function analyzeLLMIntervention(response, request) {
  // 기본 템플릿 패턴 확인
  const defaultPatterns = [
    '주인공과 기본 상황 소개',
    '갈등과 문제 상황 발생',
    '최대 위기 상황 도달',
    '문제 해결과 성장'
  ];

  const structure = response.structure;
  if (!structure) return false;

  // 1. 기본 템플릿 패턴 매칭 확인
  const act2Description = structure.act2?.description || '';
  const isDefaultTemplate = defaultPatterns.some(pattern => 
    act2Description.includes(pattern)
  );

  if (isDefaultTemplate) {
    return false; // 기본 템플릿
  }

  // 2. 사용자 입력 스토리 반영 여부
  const userStory = request.story;
  const act1Description = structure.act1?.description || '';
  const storyWords = userStory.split(' ').filter(word => word.length > 1);
  const containsUserStory = storyWords.some(word => 
    act1Description.includes(word) || 
    structure.act2?.description?.includes(word) ||
    structure.act3?.description?.includes(word)
  );

  // 3. 전개방식 특화 내용 확인
  const method = request.developmentMethod;
  const methodKeywords = {
    '훅-몰입-반전-떡밥': ['훅', '몰입', '반전', '떡밥', '충격'],
    '픽사스토리': ['옛날', '매일', '어느 날', '때문에', '변화'],
    '귀납법': ['사례', '패턴', '결론', '종합'],
    '연역법': ['결론', '근거', '재확인'],
    '다큐': ['인터뷰', '도입', '마무리']
  };

  const keywords = methodKeywords[method] || [];
  const hasMethodSpecific = keywords.some(keyword =>
    JSON.stringify(structure).includes(keyword)
  );

  // 4. 감정 변화의 다양성
  const emotionalArcs = [
    structure.act1?.emotional_arc,
    structure.act2?.emotional_arc, 
    structure.act3?.emotional_arc,
    structure.act4?.emotional_arc
  ].filter(Boolean);

  const hasVariedEmotions = new Set(emotionalArcs).size > 2;

  // LLM 생성 여부 종합 판단
  const llmIndicators = [
    containsUserStory,
    hasMethodSpecific, 
    hasVariedEmotions,
    !isDefaultTemplate
  ];

  const llmScore = llmIndicators.filter(Boolean).length;
  return llmScore >= 2; // 2개 이상 조건 만족 시 LLM 생성으로 판단
}

async function runAllTests() {
  console.log('🚀 LLM 개입 테스트 시작\n');
  console.log('='.repeat(60));

  for (const [env, endpoint] of Object.entries(ENDPOINTS)) {
    console.log(`\n🌍 환경: ${env.toUpperCase()}`);
    console.log('='.repeat(40));

    let successCount = 0;
    
    for (const scenario of TEST_SCENARIOS) {
      const success = await testLLMIntervention(endpoint, scenario);
      if (success) successCount++;
      
      // 테스트 간 간격
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n📊 ${env} 결과: ${successCount}/${TEST_SCENARIOS.length} 성공`);
    
    if (successCount === 0) {
      console.log(`💡 해결방법:`);
      if (env === 'production') {
        console.log(`   1. Vercel 환경변수 GOOGLE_GEMINI_API_KEY 설정`);
        console.log(`   2. Vercel 재배포 실행`);
        console.log(`   3. 자세한 로그는 Vercel Functions 탭에서 확인`);
      } else {
        console.log(`   1. .env.local 파일의 GOOGLE_GEMINI_API_KEY 확인`);
        console.log(`   2. API 키가 'AIza'로 시작하는지 확인`);
        console.log(`   3. 로컬 서버 재시작`);
      }
    }
  }

  console.log('\n🏁 테스트 완료');
}

// 스크립트 실행
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testLLMIntervention, analyzeLLMIntervention };