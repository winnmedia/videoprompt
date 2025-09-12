#!/usr/bin/env node

/**
 * 환경변수 검증 스크립트
 * Vercel 배포 전 환경변수 형식을 검증합니다.
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '../.env.production');

const validators = {
  GOOGLE_GEMINI_API_KEY: (value) => {
    if (!value) return { valid: false, error: 'API 키가 설정되지 않음' };
    if (value === 'your-actual-gemini-key') return { valid: false, error: '플레이스홀더 값임' };
    if (!value.startsWith('AIza')) return { valid: false, error: 'AIza로 시작해야 함' };
    if (value.length < 30) return { valid: false, error: '길이가 너무 짧음 (최소 30자)' };
    if (value.startsWith('yAIza')) return { valid: false, error: '첫 글자에 "y" 오타 있음' };
    return { valid: true };
  },
  
  JWT_SECRET: (value) => {
    if (!value) return { valid: false, error: 'JWT Secret이 설정되지 않음' };
    if (value.length < 32) return { valid: false, error: '길이가 너무 짧음 (최소 32자)' };
    return { valid: true };
  },
  
  DATABASE_URL: (value) => {
    if (!value) return { valid: false, error: 'DATABASE_URL이 설정되지 않음' };
    if (!value.startsWith('postgresql://')) return { valid: false, error: 'PostgreSQL URL 형식이 아님' };
    return { valid: true };
  },
  
  SENDGRID_API_KEY: (value) => {
    if (!value) return { valid: false, error: 'SendGrid API 키가 설정되지 않음' };
    if (!value.startsWith('SG.')) return { valid: false, error: 'SG.로 시작해야 함' };
    return { valid: true };
  }
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 환경변수 파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const envVars = {};
  
  content.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      envVars[key.trim()] = value.trim();
    }
  });
  
  return envVars;
}

function validateEnvironment() {
  console.log('🔍 환경변수 검증 시작...\n');
  
  const envVars = parseEnvFile(ENV_FILE);
  let hasErrors = false;
  
  Object.entries(validators).forEach(([key, validator]) => {
    const value = envVars[key];
    const result = validator(value);
    
    if (result.valid) {
      console.log(`✅ ${key}: 유효함`);
    } else {
      console.error(`❌ ${key}: ${result.error}`);
      if (value) {
        console.error(`   현재값: ${value.substring(0, 20)}...`);
      }
      hasErrors = true;
    }
  });
  
  if (hasErrors) {
    console.error('\n💥 환경변수 검증 실패! 위의 오류를 수정한 후 다시 시도하세요.');
    process.exit(1);
  } else {
    console.log('\n✅ 모든 환경변수가 유효합니다!');
    process.exit(0);
  }
}

// 스크립트 실행
if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment, validators };