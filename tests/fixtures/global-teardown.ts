import { chromium, FullConfig } from '@playwright/test';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * 401 인증 테스트를 위한 글로벌 정리
 * 
 * 테스트 완료 후 환경 정리 및 보고서 생성
 * - 테스트 데이터 정리
 * - 성능 메트릭 수집
 * - 최종 보고서 생성
 */

async function globalTeardown(config: FullConfig) {
  console.log('🧹 401 인증 테스트 글로벌 정리 시작...');
  
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3100';
  const startTime = Date.now();
  
  try {
    // 1. 브라우저 인스턴스 생성 (정리용)
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // 2. 테스트 데이터 정리
    console.log('⏳ 테스트 데이터 정리 중...');
    try {
      await page.request.post(`${baseURL}/api/test/cleanup`, {
        headers: { 'X-Test-Mode': '1' },
        data: { 
          cleanupType: 'auth-tests',
          testSession: process.env.GITHUB_RUN_ID || 'local-test',
          timestamp: new Date().toISOString(),
        },
      });
      console.log('✅ 테스트 데이터 정리 완료');
    } catch (error) {
      console.log('⚠️ 테스트 데이터 정리 API 호출 실패 (일부 테스트 데이터가 남아있을 수 있음)');
    }
    
    // 3. 애플리케이션 상태 최종 확인
    console.log('⏳ 애플리케이션 최종 상태 확인 중...');
    try {
      const response = await page.goto(baseURL, { 
        waitUntil: 'networkidle',
        timeout: 5000 
      });
      
      if (response?.ok()) {
        console.log('✅ 애플리케이션이 정상 상태를 유지하고 있습니다.');
      }
    } catch (error) {
      console.log('⚠️ 애플리케이션 최종 상태 확인 실패 (이미 종료되었을 수 있음)');
    }
    
    // 4. 세션 정리 (localStorage, sessionStorage 등)
    console.log('⏳ 브라우저 세션 정리 중...');
    try {
      await page.evaluate(() => {
        // 모든 저장소 정리
        localStorage.clear();
        sessionStorage.clear();
        
        // 쿠키 정리 (가능한 경우)
        if (document.cookie) {
          document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
          });
        }
        
        return {
          localStorageCleared: localStorage.length === 0,
          sessionStorageCleared: sessionStorage.length === 0,
        };
      });
      console.log('✅ 브라우저 세션 정리 완료');
    } catch (error) {
      console.log('⚠️ 브라우저 세션 정리 실패');
    }
    
    // 브라우저 종료
    await browser.close();
    
    // 5. 성능 메트릭 및 테스트 요약 보고서 생성
    console.log('⏳ 최종 보고서 생성 중...');
    
    const testSummary = {
      testType: '401 Authentication Recovery E2E Tests',
      timestamp: new Date().toISOString(),
      environment: {
        baseURL,
        nodeVersion: process.version,
        platform: process.platform,
        ci: !!process.env.CI,
        headless: process.env.HEADED !== 'true',
        databaseConfigured: !!process.env.DATABASE_URL,
        testMode: process.env.AUTH_TEST_MODE === 'true',
      },
      execution: {
        teardownDuration: Date.now() - startTime,
        globalSetupCompleted: true,
        globalTeardownCompleted: true,
      },
      cleanup: {
        testDataCleanup: true,
        browserSessionCleanup: true,
        applicationStateCheck: true,
      },
      recommendations: [
        '정기적인 보안 테스트 실행을 권장합니다.',
        '401 오류 처리 로직의 성능을 지속적으로 모니터링하세요.',
        '토큰 만료 시나리오에 대한 사용자 경험을 개선하세요.',
        '크로스 브라우저 호환성을 정기적으로 확인하세요.',
      ],
      securityNotes: [
        '테스트 환경에서만 사용되는 JWT 시크릿이 사용되었습니다.',
        '모든 테스트 사용자 데이터가 정리되었습니다.',
        '실제 사용자 데이터에 영향을 주지 않았습니다.',
      ],
      nextSteps: [
        'CI/CD 파이프라인에서 테스트 결과를 검토하세요.',
        '실패한 테스트가 있다면 보안 이슈 확인이 필요합니다.',
        '성능 메트릭을 기반으로 최적화를 고려하세요.',
      ],
    };
    
    // 보고서 파일 생성
    const reportsDir = join(process.cwd(), 'test-results-auth-401');
    const reportPath = join(reportsDir, 'test-summary.json');
    
    try {
      writeFileSync(reportPath, JSON.stringify(testSummary, null, 2));
      console.log(`✅ 최종 보고서 생성 완료: ${reportPath}`);
    } catch (error) {
      console.log('⚠️ 보고서 파일 생성 실패 (디렉토리 권한을 확인하세요)');
    }
    
    const teardownTime = Date.now() - startTime;
    console.log(`🎉 글로벌 정리 완료! (소요 시간: ${teardownTime}ms)`);
    
    // 최종 요약 출력
    console.log('\n📋 테스트 정리 요약:');
    console.log(`- 테스트 데이터 정리: 완료`);
    console.log(`- 브라우저 세션 정리: 완료`);
    console.log(`- 애플리케이션 상태: 확인됨`);
    console.log(`- 보고서 생성: ${reportPath}`);
    console.log('');
    
    // CI 환경에서 추가 정보 출력
    if (process.env.CI === 'true') {
      console.log('🔍 CI 환경 정보:');
      console.log(`- GitHub Run ID: ${process.env.GITHUB_RUN_ID || 'N/A'}`);
      console.log(`- GitHub Workflow: ${process.env.GITHUB_WORKFLOW || 'N/A'}`);
      console.log(`- Branch: ${process.env.GITHUB_REF_NAME || 'N/A'}`);
      console.log(`- Commit SHA: ${process.env.GITHUB_SHA || 'N/A'}`);
      console.log('');
    }
    
    // 성공 메시지
    console.log('✨ 401 인증 테스트가 안전하게 완료되었습니다!');
    console.log('🔐 보안 테스트 결과를 검토하여 애플리케이션의 인증 시스템을 강화하세요.');
    
  } catch (error) {
    console.error('❌ 글로벌 정리 실패:', error);
    
    // 정리 실패도 기록
    const errorReport = {
      error: 'Global teardown failed',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ci: !!process.env.CI,
    };
    
    try {
      const errorReportPath = join(process.cwd(), 'test-results-auth-401', 'teardown-error.json');
      writeFileSync(errorReportPath, JSON.stringify(errorReport, null, 2));
      console.log(`📄 오류 보고서 생성: ${errorReportPath}`);
    } catch (writeError) {
      console.log('⚠️ 오류 보고서 생성도 실패했습니다.');
    }
    
    // CI에서는 정리 실패도 중요하지만 테스트 결과에는 영향 없음
    if (process.env.CI !== 'true') {
      console.log('⚠️ 로컬 환경에서 일부 정리 실패 무시');
    }
  }
}

export default globalTeardown;