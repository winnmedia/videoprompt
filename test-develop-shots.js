// 12샷 분해 API 테스트 스크립트
const testDevelopShots = async () => {
  const testData = {
    structure4: [
      { title: "도입", summary: "평온한 일상 속에서 주인공이 등장하며 상황을 설정" },
      { title: "전개", summary: "예상치 못한 사건이 발생하며 갈등이 시작됨" },
      { title: "위기", summary: "갈등이 절정에 달하며 주인공이 중요한 선택에 직면" },
      { title: "해결", summary: "갈등이 해소되며 새로운 균형 상태에 도달" }
    ],
    genre: "drama",
    tone: "emotional"
  };

  try {
    const response = await fetch('http://localhost:3000/api/scenario/develop-shots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ API 호출 성공!');
      console.log('📊 생성된 12샷:');
      result.data.shots12.forEach((shot, index) => {
        console.log(`${index + 1}. [${shot.id}] ${shot.title}`);
        console.log(`   ${shot.description}\n`);
      });
      
      console.log('📋 메타데이터:');
      console.log(`- 장르: ${result.data.metadata.genre}`);
      console.log(`- 톤: ${result.data.metadata.tone}`);
      console.log(`- AI 모델: ${result.data.metadata.aiModel}`);
      console.log(`- 생성시간: ${result.data.metadata.generatedAt}`);
    } else {
      console.error('❌ API 호출 실패:', result.error);
    }
  } catch (error) {
    console.error('❌ 요청 오류:', error.message);
  }
};

// Node.js 환경에서 실행
if (typeof require !== 'undefined') {
  // fetch polyfill for Node.js
  const fetch = require('node-fetch');
  testDevelopShots();
} else {
  // 브라우저에서 실행
  testDevelopShots();
}