#!/usr/bin/env node

/**
 * VideoPlanet 환경 변수 검증 스크립트
 *
 * 모든 필수 API 키와 설정이 올바르게 구성되었는지 확인합니다.
 */

const https = require('https');
const http = require('http');

// 환경 변수 로드
require('dotenv').config({ path: ['.env.local', '.env'] });

// 색상 출력을 위한 ANSI 코드
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class EnvironmentValidator {
  constructor() {
    this.results = [];
    this.totalChecks = 0;
    this.passedChecks = 0;
  }

  log(level, service, message, details = '') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'pass' ? `${colors.green}✓` :
                  level === 'warn' ? `${colors.yellow}⚠` :
                  level === 'fail' ? `${colors.red}✗` :
                  `${colors.blue}ℹ`;

    console.log(`${prefix} [${service}] ${message}${colors.reset}`);
    if (details) {
      console.log(`  ${colors.blue}${details}${colors.reset}`);
    }

    this.results.push({ level, service, message, details, timestamp });
    this.totalChecks++;
    if (level === 'pass') this.passedChecks++;
  }

  checkApiKey(name, value, description) {
    if (!value) {
      this.log('fail', 'ENV', `${name} is not set`, `Required for: ${description}`);
      return false;
    }

    if (value.length < 10) {
      this.log('warn', 'ENV', `${name} seems too short`, `Current length: ${value.length} characters`);
      return false;
    }

    if (value === 'your_api_key_here' || value === 'sk-your_openai_api_key_here') {
      this.log('fail', 'ENV', `${name} contains placeholder value`, 'Please set a real API key');
      return false;
    }

    this.log('pass', 'ENV', `${name} is properly configured`);
    return true;
  }

  async testApiEndpoint(url, headers = {}, expectedStatus = 200) {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'VideoPlanet-EnvValidator/1.0',
          ...headers
        },
        timeout: 10000
      };

      const req = client.request(options, (res) => {
        resolve({
          success: res.statusCode === expectedStatus,
          status: res.statusCode,
          statusText: res.statusMessage
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });

      req.end();
    });
  }

  async validateGeminiApi() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!this.checkApiKey('GOOGLE_GEMINI_API_KEY', apiKey, 'Story generation (primary)')) {
      return;
    }

    // Gemini API 엔드포인트 테스트
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
      const result = await this.testApiEndpoint(testUrl);
      if (result.success) {
        this.log('pass', 'Gemini', 'API connection successful');
      } else {
        this.log('fail', 'Gemini', `API test failed: ${result.error || result.status}`);
      }
    } catch (error) {
      this.log('fail', 'Gemini', `API test error: ${error.message}`);
    }
  }

  async validateOpenAiApi() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!this.checkApiKey('OPENAI_API_KEY', apiKey, 'Story generation (fallback)')) {
      this.log('warn', 'OpenAI', 'Fallback API not configured - will rely on Gemini only');
      return;
    }

    // OpenAI API 엔드포인트 테스트
    const headers = {
      'Authorization': `Bearer ${apiKey}`
    };

    try {
      const result = await this.testApiEndpoint('https://api.openai.com/v1/models', headers);
      if (result.success) {
        this.log('pass', 'OpenAI', 'API connection successful');
      } else {
        this.log('fail', 'OpenAI', `API test failed: ${result.error || result.status}`);
      }
    } catch (error) {
      this.log('fail', 'OpenAI', `API test error: ${error.message}`);
    }
  }

  async validateSeedreamApi() {
    const apiKey = process.env.SEEDREAM_API_KEY || process.env.MODELARK_API_KEY;
    const model = process.env.SEEDREAM_MODEL;
    const apiBase = process.env.SEEDREAM_API_BASE || 'https://ark.ap-southeast.bytepluses.com';

    if (!this.checkApiKey('SEEDREAM_API_KEY', apiKey, 'Image generation (SeeDream 4.0)')) {
      return;
    }

    if (!model) {
      this.log('fail', 'SeeDream', 'SEEDREAM_MODEL is not set', 'Model endpoint ID required (ep-...)');
      return;
    }

    if (!model.startsWith('ep-')) {
      this.log('warn', 'SeeDream', 'SEEDREAM_MODEL format unusual', 'Expected format: ep-xxxxxxxxx');
    } else {
      this.log('pass', 'SeeDream', 'Model endpoint ID properly configured');
    }

    // SeeDream API 베이스 URL 테스트
    try {
      const result = await this.testApiEndpoint(apiBase, {}, 200);
      if (result.success || result.status === 404) { // 404는 정상 (엔드포인트가 존재함)
        this.log('pass', 'SeeDream', 'API base URL is accessible');
      } else {
        this.log('fail', 'SeeDream', `API base URL test failed: ${result.error || result.status}`);
      }
    } catch (error) {
      this.log('fail', 'SeeDream', `API base URL error: ${error.message}`);
    }
  }

  async validateSeedanceApi() {
    const apiKey = process.env.SEEDANCE_API_KEY || process.env.MODELARK_API_KEY;
    const model = process.env.SEEDANCE_MODEL;
    const apiBase = process.env.SEEDANCE_API_BASE || 'https://ark.ap-southeast.bytepluses.com';

    if (!this.checkApiKey('SEEDANCE_API_KEY', apiKey, 'Video generation (SeeDance)')) {
      return;
    }

    if (!model) {
      this.log('fail', 'SeeDance', 'SEEDANCE_MODEL is not set', 'Model endpoint ID required (ep-...)');
      return;
    }

    if (!model.startsWith('ep-')) {
      this.log('warn', 'SeeDance', 'SEEDANCE_MODEL format unusual', 'Expected format: ep-xxxxxxxxx');
    } else {
      this.log('pass', 'SeeDance', 'Model endpoint ID properly configured');
    }

    // SeeDance API 베이스 URL 테스트
    try {
      const result = await this.testApiEndpoint(apiBase, {}, 200);
      if (result.success || result.status === 404) { // 404는 정상
        this.log('pass', 'SeeDance', 'API base URL is accessible');
      } else {
        this.log('fail', 'SeeDance', `API base URL test failed: ${result.error || result.status}`);
      }
    } catch (error) {
      this.log('fail', 'SeeDance', `API base URL error: ${error.message}`);
    }
  }

  async validateSupabaseBackend() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // SUPABASE_URL 검증
    if (!supabaseUrl) {
      this.log('fail', 'Supabase', 'SUPABASE_URL is not set', 'Required for Supabase Auth backend');
      return;
    }

    // URL 형식 검증
    try {
      const url = new URL(supabaseUrl);
      if (!url.hostname.includes('supabase.co')) {
        this.log('warn', 'Supabase', 'SUPABASE_URL format unusual', 'Expected *.supabase.co domain');
      } else {
        this.log('pass', 'Supabase', 'SUPABASE_URL format is valid');
      }
    } catch {
      this.log('fail', 'Supabase', 'SUPABASE_URL is not a valid URL', `Current value: ${supabaseUrl}`);
      return;
    }

    // SUPABASE_ANON_KEY 검증
    if (!supabaseAnonKey) {
      this.log('fail', 'Supabase', 'SUPABASE_ANON_KEY is not set', 'Required for Supabase client authentication');
      return;
    }

    // JWT 토큰 형식 검증 (eyJ로 시작하는 Base64 인코딩)
    if (!supabaseAnonKey.startsWith('eyJ')) {
      this.log('fail', 'Supabase', 'SUPABASE_ANON_KEY format invalid', 'Must be a JWT token starting with eyJ');
      return;
    } else {
      this.log('pass', 'Supabase', 'SUPABASE_ANON_KEY format is valid');
    }

    // SUPABASE_SERVICE_ROLE_KEY 검증 (선택사항)
    if (supabaseServiceKey) {
      if (!supabaseServiceKey.startsWith('eyJ')) {
        this.log('warn', 'Supabase', 'SUPABASE_SERVICE_ROLE_KEY format invalid', 'Should be a JWT token starting with eyJ');
      } else {
        this.log('pass', 'Supabase', 'SUPABASE_SERVICE_ROLE_KEY format is valid');
      }
    } else {
      this.log('warn', 'Supabase', 'SUPABASE_SERVICE_ROLE_KEY not set', 'Admin operations will be limited');
    }

    // Supabase API 연결 테스트
    try {
      const healthUrl = `${supabaseUrl}/rest/v1/`;
      const result = await this.testApiEndpoint(healthUrl, {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }, 200);

      if (result.success || result.status === 404) {
        this.log('pass', 'Supabase', 'API connection successful');
      } else {
        this.log('fail', 'Supabase', `API connection failed: ${result.error || result.status}`);
      }
    } catch (error) {
      this.log('fail', 'Supabase', `API connection error: ${error.message}`);
    }
  }

  validateOptionalSettings() {
    // 기타 설정 확인
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv) {
      this.log('pass', 'General', `NODE_ENV is set to: ${nodeEnv}`);
    } else {
      this.log('warn', 'General', 'NODE_ENV is not set', 'Defaulting to development mode');
    }

    // Database URL 확인 (있는 경우) - Supabase 전환으로 선택사항이 됨
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      this.log('pass', 'Database', 'DATABASE_URL is configured (legacy)');
    } else {
      this.log('info', 'Database', 'DATABASE_URL is not set', 'Using Supabase backend instead');
    }
  }

  printSummary() {
    console.log(`\n${colors.bold}=== 환경 변수 검증 결과 ===${colors.reset}`);
    console.log(`총 검사 항목: ${this.totalChecks}`);
    console.log(`통과: ${colors.green}${this.passedChecks}${colors.reset}`);
    console.log(`실패/경고: ${colors.red}${this.totalChecks - this.passedChecks}${colors.reset}`);

    const successRate = Math.round((this.passedChecks / this.totalChecks) * 100);
    console.log(`성공률: ${successRate >= 80 ? colors.green : successRate >= 60 ? colors.yellow : colors.red}${successRate}%${colors.reset}`);

    if (successRate >= 80) {
      console.log(`\n${colors.green}${colors.bold}✅ 환경 설정이 양호합니다!${colors.reset}`);
    } else if (successRate >= 60) {
      console.log(`\n${colors.yellow}${colors.bold}⚠️  일부 설정을 확인해주세요.${colors.reset}`);
    } else {
      console.log(`\n${colors.red}${colors.bold}❌ 환경 설정에 문제가 있습니다.${colors.reset}`);
    }

    console.log(`\n${colors.blue}설정 가이드: ENVIRONMENT_SETUP.md 참조${colors.reset}`);
  }

  async run() {
    console.log(`${colors.bold}${colors.blue}VideoPlanet 환경 변수 검증을 시작합니다...${colors.reset}\n`);

    // Supabase 백엔드 검증 (최우선)
    await this.validateSupabaseBackend();

    // AI API 검증
    await this.validateGeminiApi();
    await this.validateOpenAiApi();
    await this.validateSeedreamApi();
    await this.validateSeedanceApi();

    // 기타 설정 검증
    this.validateOptionalSettings();

    this.printSummary();

    // 종료 코드 설정
    const successRate = (this.passedChecks / this.totalChecks) * 100;
    process.exit(successRate >= 60 ? 0 : 1);
  }
}

// 스크립트 실행
if (require.main === module) {
  const validator = new EnvironmentValidator();
  validator.run().catch(error => {
    console.error(`${colors.red}검증 스크립트 실행 오류: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = EnvironmentValidator;