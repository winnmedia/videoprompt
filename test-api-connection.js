#!/usr/bin/env node
/**
 * Story Generation API 연결 테스트 스크립트
 * 수정된 safeFetch 함수의 URL 라우팅 검증
 */

// 환경변수 설정 시뮬레이션
process.env.NEXT_PUBLIC_API_BASE = 'https://videoprompt-production.up.railway.app';

// Node.js v18+ 내장 fetch 사용

// 간단한 URL 결합 테스트
function testUrlCombination() {
  console.log('🔍 URL 결합 테스트');
  
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE;
  const relativePath = '/api/ai/generate-story';
  
  const fullUrl = relativePath.startsWith('http') ? relativePath : 
    `${baseUrl || 'https://videoprompt-production.up.railway.app'}${relativePath}`;
  
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Relative Path: ${relativePath}`);
  console.log(`Full URL: ${fullUrl}`);
  console.log(`✅ URL 결합 정상`);
  
  return fullUrl;
}

// API 연결 테스트
async function testApiConnection() {
  const fullUrl = testUrlCombination();
  
  console.log('\n🚀 API 연결 테스트 시작...');
  
  const testPayload = {
    story: '우주에서 길을 잃은 로봇이 지구로 돌아가는 이야기',
    genre: 'SF',
    tone: '감동적',
    target: '일반 관객',
    duration: '60초',
    format: '16:9',
    tempo: '보통',
    developmentMethod: '클래식 기승전결',
    developmentIntensity: '보통'
  };
  
  try {
    const startTime = Date.now();
    console.log(`📡 요청 전송: ${fullUrl}`);
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
      timeout: 60000 // 60초 타임아웃
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`📊 응답 상태: ${response.status} ${response.statusText}`);
    console.log(`⏱️ 소요 시간: ${(duration / 1000).toFixed(2)}초`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API 연결 성공!');
      console.log(`📝 스토리 단계 수: ${data.structure ? Object.keys(data.structure).length : 0}`);
      console.log(`🎬 첫 번째 단계: ${data.structure?.act1?.title || 'N/A'}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ API 오류: ${response.status} - ${errorText.substring(0, 200)}...`);
      return false;
    }
    
  } catch (error) {
    console.error(`💥 연결 실패:`, error.message);
    return false;
  }
}

// 메인 실행
async function main() {
  console.log('='.repeat(60));
  console.log('🔧 Story Generation API 연결 진단 도구');
  console.log('='.repeat(60));
  
  try {
    const success = await testApiConnection();
    
    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('🎉 진단 결과: API 연결 정상!');
      console.log('✨ Story Generation API가 올바르게 작동하고 있습니다.');
    } else {
      console.log('🚨 진단 결과: API 연결 문제 발견');
      console.log('🔧 Railway 백엔드 상태를 확인해주세요.');
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ 테스트 실행 실패:', error.message);
  }
}

// 실행
if (require.main === module) {
  main();
}

module.exports = { testUrlCombination, testApiConnection };