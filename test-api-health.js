#!/usr/bin/env node

/**
 * API 헬스체크 스크립트
 * 모든 핵심 API 엔드포인트의 기본적인 작동을 테스트합니다.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function testEndpoint(endpoint, method = 'GET', body = null, description = '') {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();

    console.log(`✅ ${method} ${endpoint} - ${response.status} ${description}`);
    
    if (response.status >= 400) {
      console.log(`   Error: ${data.error || data.message || 'Unknown error'}`);
    }
    
    return { success: response.status < 400, status: response.status, data };
  } catch (error) {
    console.log(`❌ ${method} ${endpoint} - Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runHealthCheck() {
  console.log('🔍 VideoPrompt API Health Check');
  console.log('================================');

  const tests = [
    // 기본 헬스체크
    ['/api/health', 'GET', null, '- Basic health check'],
    
    // 스토리 관련 API
    ['/api/planning/stories', 'GET', null, '- Get stories list'],
    ['/api/ai/generate-story', 'POST', {
      story: 'Test story',
      genre: 'Drama',
      tone: 'Neutral',
      target: 'General'
    }, '- Generate story structure'],
    
    // 프롬프트 관련 API
    ['/api/planning/prompt', 'GET', null, '- Get prompts list'],
    
    // 비디오 자산 API
    ['/api/planning/video-assets', 'GET', null, '- Get video assets'],
    
    // 업로드 API (GET으로 정보 확인)
    ['/api/upload/image', 'GET', null, '- Image upload info'],
    
    // 인증 관련 API (무효한 데이터로 테스트)
    ['/api/auth/register', 'POST', {
      email: 'test@example.com',
      username: 'testuser',
      password: 'testpassword123'
    }, '- User registration'],
  ];

  let passed = 0;
  let failed = 0;

  for (const [endpoint, method, body, description] of tests) {
    const result = await testEndpoint(endpoint, method, body, description);
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
    
    // 각 테스트 사이에 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n📊 Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All API endpoints are working correctly!');
  } else {
    console.log('\n⚠️  Some endpoints need attention. Check the logs above.');
  }
}

// 스크립트 실행
runHealthCheck().catch(console.error);