#!/usr/bin/env node
/**
 * VideoPlanet E2E Integration Test Suite
 * 핵심 기능 6단계 파이프라인 통합 테스트
 */

const https = require('https');
const fs = require('fs');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3002';
const TEST_EMAIL = 'e2e-test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

// 테스트 결과 저장
const testResults = {
  environment: {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    testUser: TEST_EMAIL
  },
  phases: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    duration: 0
  }
};

// 유틸리티 함수들
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (method, path, data = null, headers = {}) => {
  const startTime = Date.now();

  try {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    let body = null;
    if (data && method !== 'GET') {
      body = JSON.stringify(data);
    }

    const response = await fetch(url, {
      ...options,
      body
    });

    const responseTime = Date.now() - startTime;
    const responseData = await response.json();

    return {
      status: response.status,
      data: responseData,
      responseTime,
      success: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      responseTime: Date.now() - startTime,
      success: false
    };
  }
};

// 로그 함수
const log = (phase, message, status = 'info') => {
  const timestamp = new Date().toLocaleTimeString();
  const emoji = status === 'success' ? '✅' : status === 'error' ? '❌' : '🔍';
  console.log(`[${timestamp}] ${emoji} [${phase}] ${message}`);
};

// Phase 0: 환경 준비
async function setupEnvironment() {
  log('SETUP', '환경 준비 시작');

  // 테스트 계정 생성 시도 (이미 있으면 무시)
  const registerResult = await makeRequest('POST', '/api/auth/register', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    username: 'e2e-tester'
  });

  // 로그인하여 토큰 획득
  const loginResult = await makeRequest('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  if (!loginResult.success) {
    throw new Error(`로그인 실패: ${loginResult.data.error || 'Unknown error'}`);
  }

  const authToken = loginResult.data.data?.token || loginResult.data.token;
  if (!authToken) {
    throw new Error('인증 토큰을 받지 못했습니다');
  }

  log('SETUP', '인증 토큰 획득 성공');
  return authToken;
}

// Phase 1: 스토리 생성 테스트
async function testStoryGeneration(authToken) {
  log('STORY', '스토리 생성 테스트 시작');

  const storyPayload = {
    title: "E2E 테스트 영상",
    oneLineStory: "자동화 테스트를 위한 샘플 스토리입니다",
    toneAndManner: "professional",
    genre: "corporate",
    target: "developers",
    duration: "60초",
    format: "16:9",
    tempo: "보통",
    developmentMethod: "클래식 기승전결",
    developmentIntensity: "보통"
  };

  const result = await makeRequest('POST', '/api/ai/generate-story', storyPayload, {
    'Authorization': `Bearer ${authToken}`
  });

  testResults.phases.storyGeneration = {
    success: result.success,
    responseTime: result.responseTime,
    status: result.status,
    data: result.success ? result.data : null,
    error: result.success ? null : result.data
  };

  if (result.success) {
    log('STORY', `스토리 생성 성공 (${result.responseTime}ms)`, 'success');
    return result.data;
  } else {
    log('STORY', `스토리 생성 실패: ${result.data.error || 'Unknown error'}`, 'error');
    return null;
  }
}

// Phase 2: 스토리보드 생성 테스트
async function testStoryboardGeneration(authToken, storyData) {
  log('STORYBOARD', '스토리보드 생성 테스트 시작');

  const storyboardPayload = {
    structure: {
      act1: {
        title: "도입",
        description: "문제 제기 및 상황 설정",
        key_elements: ["문제 인식", "현재 상황"],
        visual_moments: ["주인공 등장", "문제 상황 묘사"]
      },
      act2: {
        title: "전개",
        description: "솔루션 탐색 과정",
        key_elements: ["해결책 모색", "장애물 등장"],
        visual_moments: ["탐색 과정", "시행착오"]
      },
      act3: {
        title: "절정",
        description: "핵심 기능 및 해결책 제시",
        key_elements: ["핵심 솔루션", "결정적 순간"],
        visual_moments: ["제품 시연", "문제 해결"]
      },
      act4: {
        title: "결말",
        description: "결과 및 행동 유도",
        key_elements: ["성과 확인", "CTA"],
        visual_moments: ["성공 장면", "행동 유도"]
      }
    },
    visualStyle: "Cinematic",
    duration: "60초",
    aspectRatio: "16:9"
  };

  const result = await makeRequest('POST', '/api/ai/generate-storyboard', storyboardPayload, {
    'Authorization': `Bearer ${authToken}`
  });

  testResults.phases.storyboardGeneration = {
    success: result.success,
    responseTime: result.responseTime,
    status: result.status,
    data: result.success ? result.data : null,
    error: result.success ? null : result.data
  };

  if (result.success) {
    log('STORYBOARD', `스토리보드 생성 성공 (${result.responseTime}ms)`, 'success');
    return result.data;
  } else {
    log('STORYBOARD', `스토리보드 생성 실패: ${result.data.error || 'Unknown error'}`, 'error');
    return null;
  }
}

// Phase 3: PDF 다운로드 테스트
async function testPdfExport(authToken, storyData, storyboardData) {
  log('PDF', 'PDF 다운로드 테스트 시작');

  const exportPayload = {
    scenario: storyData,
    shots: storyboardData?.shots || [],
    format: "pdf"
  };

  const result = await makeRequest('POST', '/api/planning/export', exportPayload, {
    'Authorization': `Bearer ${authToken}`
  });

  testResults.phases.pdfExport = {
    success: result.success,
    responseTime: result.responseTime,
    status: result.status,
    data: result.success ? result.data : null,
    error: result.success ? null : result.data
  };

  if (result.success) {
    log('PDF', `PDF 데이터 준비 성공 (${result.responseTime}ms)`, 'success');
    return result.data;
  } else {
    log('PDF', `PDF 생성 실패: ${result.data.error || 'Unknown error'}`, 'error');
    return null;
  }
}

// Phase 4: 프롬프트 생성 테스트
async function testPromptGeneration(authToken) {
  log('PROMPT', '프롬프트 생성 테스트 시작');

  const result = await makeRequest('GET', '/api/planning/prompt', null, {
    'Authorization': `Bearer ${authToken}`
  });

  testResults.phases.promptGeneration = {
    success: result.success,
    responseTime: result.responseTime,
    status: result.status,
    data: result.success ? result.data : null,
    error: result.success ? null : result.data
  };

  if (result.success) {
    log('PROMPT', `프롬프트 조회 성공 (${result.responseTime}ms)`, 'success');
    return result.data;
  } else {
    log('PROMPT', `프롬프트 조회 실패: ${result.data.error || 'Unknown error'}`, 'error');
    return null;
  }
}

// Phase 5: 영상 생성 테스트
async function testVideoGeneration(authToken) {
  log('VIDEO', '영상 생성 테스트 시작');

  const videoPayload = {
    prompt: "Professional corporate video showcasing modern technology solutions, cinematic style, high quality",
    aspect_ratio: "16:9",
    duration_seconds: 8,
    quality: "standard",
    model: "seedance"
  };

  const result = await makeRequest('POST', '/api/seedance/create', videoPayload, {
    'Authorization': `Bearer ${authToken}`
  });

  testResults.phases.videoGeneration = {
    success: result.success,
    responseTime: result.responseTime,
    status: result.status,
    data: result.success ? result.data : null,
    error: result.success ? null : result.data
  };

  if (result.success) {
    log('VIDEO', `영상 생성 작업 시작 (${result.responseTime}ms)`, 'success');
    return result.data;
  } else {
    log('VIDEO', `영상 생성 실패: ${result.data.error || 'Unknown error'}`, 'error');
    return null;
  }
}

// Phase 6: 업로드 테스트
async function testVideoUpload(authToken) {
  log('UPLOAD', '비디오 업로드 테스트 시작');

  // 테스트용 더미 비디오 파일 생성 (실제로는 Blob 사용)
  const result = await makeRequest('GET', '/api/upload/video', null, {
    'Authorization': `Bearer ${authToken}`
  });

  testResults.phases.videoUpload = {
    success: result.success,
    responseTime: result.responseTime,
    status: result.status,
    data: result.success ? result.data : null,
    error: result.success ? null : result.data
  };

  if (result.success) {
    log('UPLOAD', `업로드 정보 조회 성공 (${result.responseTime}ms)`, 'success');
    return result.data;
  } else {
    log('UPLOAD', `업로드 테스트 실패: ${result.data.error || 'Unknown error'}`, 'error');
    return null;
  }
}

// 메인 테스트 실행 함수
async function runE2ETests() {
  const startTime = Date.now();
  console.log('🚀 VideoPlanet E2E 테스트 시작\n');

  try {
    // Phase 0: 환경 준비
    const authToken = await setupEnvironment();

    // Phase 1: 스토리 생성 테스트
    const storyData = await testStoryGeneration(authToken);
    await sleep(1000); // API 부하 방지

    // Phase 2: 스토리보드 생성 테스트
    const storyboardData = await testStoryboardGeneration(authToken, storyData);
    await sleep(1000);

    // Phase 3: PDF 다운로드 테스트
    const pdfData = await testPdfExport(authToken, storyData, storyboardData);
    await sleep(1000);

    // Phase 4: 프롬프트 생성 테스트
    const promptData = await testPromptGeneration(authToken);
    await sleep(1000);

    // Phase 5: 영상 생성 테스트
    const videoData = await testVideoGeneration(authToken);
    await sleep(1000);

    // Phase 6: 업로드 테스트
    const uploadData = await testVideoUpload(authToken);

  } catch (error) {
    log('ERROR', `테스트 실행 중 오류: ${error.message}`, 'error');
  }

  // 결과 집계
  const endTime = Date.now();
  testResults.summary.duration = endTime - startTime;

  for (const phase of Object.values(testResults.phases)) {
    testResults.summary.total++;
    if (phase.success) {
      testResults.summary.passed++;
    } else {
      testResults.summary.failed++;
    }
  }

  // 결과 출력
  console.log('\n📊 E2E 테스트 결과 요약');
  console.log('═'.repeat(50));
  console.log(`총 테스트: ${testResults.summary.total}`);
  console.log(`성공: ${testResults.summary.passed} ✅`);
  console.log(`실패: ${testResults.summary.failed} ❌`);
  console.log(`소요시간: ${testResults.summary.duration}ms`);
  console.log(`성공률: ${(testResults.summary.passed / testResults.summary.total * 100).toFixed(1)}%`);

  // 상세 결과
  console.log('\n📋 상세 결과:');
  Object.entries(testResults.phases).forEach(([phase, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${phase}: ${result.responseTime}ms (Status: ${result.status})`);
    if (!result.success && result.error) {
      console.log(`   ↳ 오류: ${result.error.error || result.error.message || JSON.stringify(result.error)}`);
    }
  });

  // 결과를 JSON 파일로 저장
  const reportPath = '/tmp/e2e-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📁 상세 리포트 저장: ${reportPath}`);

  return testResults;
}

// 스크립트가 직접 실행된 경우
if (require.main === module) {
  runE2ETests()
    .then(results => {
      process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 테스트 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { runE2ETests };