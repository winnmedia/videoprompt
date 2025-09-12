import { chromium, FullConfig } from '@playwright/test';

/**
 * 401 인증 테스트를 위한 글로벌 설정
 * 
 * TDD 원칙 및 빌드 결정론성 확보를 위한 전역 설정
 * - 테스트 환경 초기화
 * - 데이터베이스 상태 검증
 * - 성능 기준 설정
 */

async function globalSetup(config: FullConfig) {
  console.log('🚀 401 인증 테스트 글로벌 설정 시작...');
  
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3100';
  const startTime = Date.now();
  
  try {
    // 1. 브라우저 인스턴스 생성 (헬스 체크용)
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // 2. 애플리케이션 헬스 체크
    console.log('⏳ 애플리케이션 헬스 체크 중...');
    
    let healthCheckPassed = false;
    let attempts = 0;
    const maxAttempts = 30; // 30초 대기
    
    while (!healthCheckPassed && attempts < maxAttempts) {
      try {
        const response = await page.goto(baseURL, { 
          waitUntil: 'networkidle',
          timeout: 5000 
        });
        
        if (response?.ok()) {
          healthCheckPassed = true;
          console.log('✅ 애플리케이션이 정상적으로 응답합니다.');
        }
      } catch (error) {
        attempts++;
        console.log(`⏳ 애플리케이션 시작 대기 중... (${attempts}/${maxAttempts})`);
        await page.waitForTimeout(1000);
      }
    }
    
    if (!healthCheckPassed) {
      throw new Error(`애플리케이션이 ${maxAttempts}초 내에 시작되지 않았습니다.`);
    }
    
    // 3. 데이터베이스 연결 확인 (선택적)
    if (process.env.DATABASE_URL) {
      try {
        console.log('⏳ 데이터베이스 연결 확인 중...');
        
        // API를 통한 데이터베이스 헬스 체크
        const dbHealthResponse = await page.request.get(`${baseURL}/api/health/db`);
        if (dbHealthResponse.ok()) {
          console.log('✅ 데이터베이스 연결이 정상입니다.');
        } else {
          console.log('⚠️ 데이터베이스 헬스 체크 API가 없습니다. (선택사항)');
        }
      } catch (error) {
        console.log('⚠️ 데이터베이스 연결 확인 실패 (테스트는 계속 진행)');
      }
    }
    
    // 4. 필수 API 엔드포인트 확인
    console.log('⏳ 필수 API 엔드포인트 확인 중...');
    const criticalEndpoints = [
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/me',
    ];
    
    for (const endpoint of criticalEndpoints) {
      try {
        // OPTIONS 요청으로 엔드포인트 존재 확인
        const response = await page.request.fetch(`${baseURL}${endpoint}`, {
          method: 'OPTIONS',
        });
        // 404가 아니면 엔드포인트가 존재한다고 가정
        if (response.status() !== 404) {
          console.log(`✅ ${endpoint} 엔드포인트 확인됨`);
        } else {
          console.log(`⚠️ ${endpoint} 엔드포인트 없음`);
        }
      } catch (error) {
        console.log(`⚠️ ${endpoint} 엔드포인트 확인 실패`);
      }
    }
    
    // 5. 테스트 데이터 정리 (이전 테스트 데이터 제거)
    console.log('⏳ 테스트 데이터 정리 중...');
    try {
      // 테스트용 사용자 데이터 정리 API 호출 (있다면)
      await page.request.post(`${baseURL}/api/test/cleanup`, {
        headers: { 'X-Test-Mode': '1' },
        data: { cleanupType: 'auth-tests' },
      });
      console.log('✅ 테스트 데이터 정리 완료');
    } catch (error) {
      console.log('⚠️ 테스트 데이터 정리 API 없음 (선택사항)');
    }
    
    // 6. 성능 기준 설정 확인
    console.log('⏳ 성능 기준 확인 중...');
    const performanceTest = await page.evaluate(() => {
      const startTime = performance.now();
      // 간단한 DOM 조작으로 기본 성능 확인
      document.body.innerHTML = '<div>Performance Test</div>';
      return performance.now() - startTime;
    });
    
    if (performanceTest > 100) {
      console.log(`⚠️ 기본 성능이 예상보다 느립니다: ${performanceTest.toFixed(2)}ms`);
    } else {
      console.log(`✅ 기본 성능 확인: ${performanceTest.toFixed(2)}ms`);
    }
    
    // 브라우저 종료
    await browser.close();
    
    const setupTime = Date.now() - startTime;
    console.log(`🎉 글로벌 설정 완료! (소요 시간: ${setupTime}ms)`);
    
    // 환경 정보 출력
    console.log('\n📊 테스트 환경 정보:');
    console.log(`- Base URL: ${baseURL}`);
    console.log(`- Node 버전: ${process.version}`);
    console.log(`- 플랫폼: ${process.platform}`);
    console.log(`- CI 환경: ${process.env.CI ? 'Yes' : 'No'}`);
    console.log(`- 헤드리스 모드: ${process.env.HEADED !== 'true' ? 'Yes' : 'No'}`);
    console.log(`- 데이터베이스: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ 글로벌 설정 실패:', error);
    
    // CI 환경에서는 설정 실패 시 테스트 중단
    if (process.env.CI === 'true') {
      throw error;
    } else {
      console.log('⚠️ 로컬 환경에서 일부 설정 실패 무시하고 테스트 계속 진행');
    }
  }
}

export default globalSetup;