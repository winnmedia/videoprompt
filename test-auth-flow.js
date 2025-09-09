#!/usr/bin/env node

/**
 * 이메일 인증 시스템 통합 테스트
 * SendGrid API와 인증 플로우를 테스트합니다.
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

// 테스트용 사용자 정보
const testUser = {
  email: `test${Date.now()}@example.com`,
  username: `testuser${Date.now()}`,
  password: 'TestPassword123!'
};

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, type = 'info') {
  const color = {
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    info: colors.blue
  }[type] || colors.reset;
  
  console.log(`${color}${message}${colors.reset}`);
}

async function testEndpoint(name, method, path, body = null) {
  log(`\n📋 Testing: ${name}`, 'info');
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const data = await response.json();
    
    if (response.ok && data.ok) {
      log(`✅ ${name}: SUCCESS`, 'success');
      console.log('Response:', JSON.stringify(data, null, 2));
      return data;
    } else {
      log(`❌ ${name}: FAILED (${response.status})`, 'error');
      console.log('Error:', JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    log(`❌ ${name}: ERROR - ${error.message}`, 'error');
    return null;
  }
}

async function runTests() {
  log('\n🚀 Starting Email Authentication System Tests', 'info');
  log('=' . repeat(50), 'info');
  
  // 1. 회원가입 테스트
  log('\n1️⃣ REGISTER NEW USER', 'info');
  const registerResult = await testEndpoint(
    'User Registration',
    'POST',
    '/api/auth/register',
    testUser
  );
  
  if (registerResult) {
    log('📧 Check your email for verification link', 'warning');
    log(`   Email: ${testUser.email}`, 'warning');
  }
  
  // 2. 로그인 시도 (이메일 미인증 상태)
  log('\n2️⃣ LOGIN ATTEMPT (UNVERIFIED)', 'info');
  await testEndpoint(
    'Login (Unverified)',
    'POST',
    '/api/auth/login',
    {
      email: testUser.email,
      password: testUser.password
    }
  );
  
  // 3. 인증 메일 재발송 테스트
  log('\n3️⃣ RESEND VERIFICATION EMAIL', 'info');
  await testEndpoint(
    'Resend Verification',
    'POST',
    '/api/auth/resend-verification',
    {
      email: testUser.email
    }
  );
  
  // 4. 비밀번호 재설정 요청 테스트
  log('\n4️⃣ PASSWORD RESET REQUEST', 'info');
  await testEndpoint(
    'Forgot Password',
    'POST',
    '/api/auth/forgot-password',
    {
      email: testUser.email
    }
  );
  
  // 5. API 헬스 체크
  log('\n5️⃣ EMAIL SERVICE HEALTH CHECK', 'info');
  await testEndpoint(
    'Email Service Status',
    'GET',
    '/api/email/send'
  );
  
  // 결과 요약
  log('\n' + '=' . repeat(50), 'info');
  log('📊 TEST SUMMARY', 'info');
  log(`   Test User: ${testUser.username}`, 'info');
  log(`   Test Email: ${testUser.email}`, 'info');
  log(`   Timestamp: ${new Date().toISOString()}`, 'info');
  log('\n✨ All tests completed!', 'success');
  log('📬 Check the test email inbox for verification and reset emails', 'warning');
}

// 테스트 실행
runTests().catch(error => {
  log(`\n💥 Test suite failed: ${error.message}`, 'error');
  process.exit(1);
});