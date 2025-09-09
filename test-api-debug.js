// API 클라이언트 디버깅 스크립트
const { ApiClient } = require('./src/test/api-client.ts');

async function testApiClient() {
  console.log('🔍 API 클라이언트 디버깅 테스트');
  
  const client = new ApiClient('http://localhost:3001', { timeout: 5000 });
  
  try {
    console.log('📡 헬스 체크 API 호출 중...');
    const response = await client.get('/api/health');
    
    console.log('✅ API 응답:', {
      ok: response.ok,
      data: response.data,
      message: response.message,
      error: response.error,
    });
  } catch (error) {
    console.error('❌ API 호출 실패:', error.message);
    console.error('스택 트레이스:', error.stack);
  }
}

// 직접 fetch 테스트
async function testDirectFetch() {
  console.log('🌐 직접 fetch 테스트');
  
  try {
    const response = await fetch('http://localhost:3001/api/health');
    console.log('✅ fetch 응답 상태:', response.status, response.statusText);
    console.log('✅ fetch 응답 헤더:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('✅ fetch 응답 본문:', text);
    
    const data = JSON.parse(text);
    console.log('✅ 파싱된 데이터:', data);
  } catch (error) {
    console.error('❌ 직접 fetch 실패:', error.message);
  }
}

async function runTests() {
  await testDirectFetch();
  console.log('---');
  await testApiClient();
}

runTests();