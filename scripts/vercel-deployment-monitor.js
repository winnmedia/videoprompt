#!/usr/bin/env node

/**
 * Vercel 배포 모니터링 및 성능 추적 스크립트
 * Frontend Platform Lead - 배포 신뢰성 강화 도구
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 설정
const CONFIG = {
  // 모니터링 대상 URL
  PRODUCTION_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://videoprompt.vercel.app',

  // 성능 예산 (밀리초)
  PERFORMANCE_BUDGET: {
    TTFB: 800,      // Time To First Byte
    LCP: 2500,      // Largest Contentful Paint
    FCP: 1800,      // First Contentful Paint
    CLS: 0.1,       // Cumulative Layout Shift
    FID: 100,       // First Input Delay
  },

  // 알림 설정
  ALERT_WEBHOOK: process.env.SLACK_WEBHOOK_URL,
  DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK_URL,

  // 모니터링 간격 (초)
  MONITORING_INTERVAL: 300, // 5분

  // 실패 허용 임계값
  FAILURE_THRESHOLD: 3,
};

// 로깅 유틸리티
class Logger {
  static info(message) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  }

  static warn(message) {
    console.log(`[WARN] ${new Date().toISOString()} - ${message}`);
  }

  static error(message) {
    console.log(`[ERROR] ${new Date().toISOString()} - ${message}`);
  }

  static success(message) {
    console.log(`[SUCCESS] ${new Date().toISOString()} - ${message}`);
  }
}

// HTTP 요청 유틸리티
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const req = https.request(url, options, (res) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          responseTime: responseTime,
          timestamp: new Date().toISOString(),
        });
      });
    });

    req.on('error', (error) => {
      reject({
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject({
        error: 'Request timeout',
        timestamp: new Date().toISOString(),
      });
    });

    req.end();
  });
}

// 헬스 체크 실행
async function performHealthCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    url: CONFIG.PRODUCTION_URL,
    status: 'unknown',
    checks: {},
  };

  try {
    Logger.info(`🏥 헬스 체크 시작: ${CONFIG.PRODUCTION_URL}`);

    // 1. 메인 페이지 체크
    const mainPageCheck = await makeRequest(CONFIG.PRODUCTION_URL);
    results.checks.mainPage = {
      status: mainPageCheck.statusCode === 200 ? 'pass' : 'fail',
      responseTime: mainPageCheck.responseTime,
      statusCode: mainPageCheck.statusCode,
    };

    // 2. API 헬스 엔드포인트 체크
    const apiHealthUrl = `${CONFIG.PRODUCTION_URL}/api/health`;
    try {
      const apiHealthCheck = await makeRequest(apiHealthUrl);
      results.checks.apiHealth = {
        status: apiHealthCheck.statusCode === 200 ? 'pass' : 'fail',
        responseTime: apiHealthCheck.responseTime,
        statusCode: apiHealthCheck.statusCode,
      };
    } catch (error) {
      results.checks.apiHealth = {
        status: 'fail',
        error: error.error || 'Unknown error',
      };
    }

    // 3. 정적 자원 체크 (favicon)
    const faviconUrl = `${CONFIG.PRODUCTION_URL}/favicon.ico`;
    try {
      const faviconCheck = await makeRequest(faviconUrl);
      results.checks.staticAssets = {
        status: faviconCheck.statusCode === 200 ? 'pass' : 'fail',
        responseTime: faviconCheck.responseTime,
        statusCode: faviconCheck.statusCode,
      };
    } catch (error) {
      results.checks.staticAssets = {
        status: 'fail',
        error: error.error || 'Unknown error',
      };
    }

    // 4. 전체 상태 평가
    const allChecks = Object.values(results.checks);
    const passedChecks = allChecks.filter(check => check.status === 'pass');

    if (passedChecks.length === allChecks.length) {
      results.status = 'healthy';
      Logger.success(`✅ 모든 헬스 체크 통과 (${passedChecks.length}/${allChecks.length})`);
    } else if (passedChecks.length > 0) {
      results.status = 'degraded';
      Logger.warn(`⚠️ 일부 헬스 체크 실패 (${passedChecks.length}/${allChecks.length})`);
    } else {
      results.status = 'unhealthy';
      Logger.error(`❌ 모든 헬스 체크 실패 (${passedChecks.length}/${allChecks.length})`);
    }

    // 5. 성능 평가
    const mainPageResponseTime = results.checks.mainPage.responseTime;
    if (mainPageResponseTime > CONFIG.PERFORMANCE_BUDGET.TTFB) {
      Logger.warn(`⚠️ TTFB 성능 예산 초과: ${mainPageResponseTime}ms > ${CONFIG.PERFORMANCE_BUDGET.TTFB}ms`);
      results.performanceAlert = true;
    }

  } catch (error) {
    Logger.error(`❌ 헬스 체크 실행 중 오류: ${error.message}`);
    results.status = 'error';
    results.error = error.message;
  }

  return results;
}

// 알림 전송
async function sendAlert(results, alertType = 'health_check') {
  const alertData = {
    timestamp: results.timestamp,
    alertType: alertType,
    status: results.status,
    url: results.url,
    details: results.checks,
  };

  let alertMessage = '';
  let alertColor = '#36a64f'; // 녹색 (정상)

  switch (results.status) {
    case 'healthy':
      alertMessage = `✅ **배포 상태 정상**\n모든 헬스 체크 통과\n🌍 URL: ${results.url}`;
      alertColor = '#36a64f';
      break;
    case 'degraded':
      alertMessage = `⚠️ **배포 상태 저하**\n일부 서비스에 문제가 있습니다\n🌍 URL: ${results.url}`;
      alertColor = '#ff9f00';
      break;
    case 'unhealthy':
      alertMessage = `🚨 **배포 상태 심각**\n서비스가 정상적으로 작동하지 않습니다\n🌍 URL: ${results.url}`;
      alertColor = '#ff0000';
      break;
    default:
      alertMessage = `❓ **배포 상태 불명**\n모니터링 중 오류가 발생했습니다\n🌍 URL: ${results.url}`;
      alertColor = '#808080';
  }

  // 상세 정보 추가
  if (results.checks) {
    alertMessage += '\n\n**상세 검사 결과:**';
    Object.entries(results.checks).forEach(([checkName, checkResult]) => {
      const statusIcon = checkResult.status === 'pass' ? '✅' : '❌';
      const responseTime = checkResult.responseTime ? ` (${checkResult.responseTime}ms)` : '';
      alertMessage += `\n${statusIcon} ${checkName}${responseTime}`;
    });
  }

  // Slack 알림
  if (CONFIG.ALERT_WEBHOOK) {
    try {
      const slackPayload = JSON.stringify({
        attachments: [{
          color: alertColor,
          title: 'VideoPlanet 배포 모니터링',
          text: alertMessage,
          footer: 'Frontend Platform Lead',
          ts: Math.floor(Date.now() / 1000),
        }],
      });

      await sendWebhook(CONFIG.ALERT_WEBHOOK, slackPayload);
      Logger.info('📨 Slack 알림 전송 완료');
    } catch (error) {
      Logger.error(`❌ Slack 알림 전송 실패: ${error.message}`);
    }
  }

  // Discord 알림
  if (CONFIG.DISCORD_WEBHOOK) {
    try {
      const discordPayload = JSON.stringify({
        embeds: [{
          title: 'VideoPlanet 배포 모니터링',
          description: alertMessage,
          color: parseInt(alertColor.slice(1), 16),
          timestamp: results.timestamp,
          footer: {
            text: 'Frontend Platform Lead',
          },
        }],
      });

      await sendWebhook(CONFIG.DISCORD_WEBHOOK, discordPayload);
      Logger.info('📨 Discord 알림 전송 완료');
    } catch (error) {
      Logger.error(`❌ Discord 알림 전송 실패: ${error.message}`);
    }
  }
}

// 웹훅 전송 유틸리티
function sendWebhook(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Webhook 전송 실패: HTTP ${res.statusCode}`));
      }
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

// 결과 저장
function saveResults(results) {
  const resultsDir = path.join(__dirname, '..', 'monitoring-results');

  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const filename = `health-check-${Date.now()}.json`;
  const filepath = path.join(resultsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

  // 오래된 결과 파일 정리 (7일 이상)
  const files = fs.readdirSync(resultsDir);
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  files.forEach(file => {
    const filepath = path.join(resultsDir, file);
    const stats = fs.statSync(filepath);

    if (stats.mtime.getTime() < sevenDaysAgo) {
      fs.unlinkSync(filepath);
      Logger.info(`🗑️ 오래된 모니터링 결과 삭제: ${file}`);
    }
  });
}

// 메인 모니터링 함수
async function runMonitoring() {
  Logger.info('🚀 Vercel 배포 모니터링 시작');

  try {
    const results = await performHealthCheck();

    // 결과 저장
    saveResults(results);

    // 상태가 정상이 아닐 때만 알림 전송 (스팸 방지)
    if (results.status !== 'healthy') {
      await sendAlert(results);
    }

    // 성능 예산 초과 시 별도 알림
    if (results.performanceAlert) {
      Logger.warn('⚠️ 성능 예산 초과로 인한 별도 알림 필요');
      // 성능 관련 알림은 덜 빈번하게 (여기서는 로그만)
    }

    Logger.info('✅ 모니터링 주기 완료');

  } catch (error) {
    Logger.error(`❌ 모니터링 실행 중 오류: ${error.message}`);

    // 모니터링 자체 실패에 대한 알림
    const errorResults = {
      timestamp: new Date().toISOString(),
      status: 'monitoring_error',
      error: error.message,
      url: CONFIG.PRODUCTION_URL,
    };

    await sendAlert(errorResults, 'monitoring_error');
  }
}

// CLI 인터페이스
async function main() {
  const command = process.argv[2] || 'once';

  switch (command) {
    case 'once':
      Logger.info('📊 단발성 헬스 체크 실행');
      await runMonitoring();
      break;

    case 'continuous':
      Logger.info(`🔄 연속 모니터링 시작 (간격: ${CONFIG.MONITORING_INTERVAL}초)`);

      // 첫 실행
      await runMonitoring();

      // 주기적 실행
      setInterval(async () => {
        await runMonitoring();
      }, CONFIG.MONITORING_INTERVAL * 1000);

      break;

    case 'test-alert':
      Logger.info('🧪 테스트 알림 전송');
      const testResults = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        url: CONFIG.PRODUCTION_URL,
        checks: {
          test: { status: 'pass', responseTime: 123 },
        },
      };
      await sendAlert(testResults);
      break;

    case 'config':
      Logger.info('⚙️ 현재 설정:');
      console.log(JSON.stringify(CONFIG, null, 2));
      break;

    default:
      console.log(`
🛠️ Vercel 배포 모니터링 도구 사용법:

Commands:
  once        - 단발성 헬스 체크 실행 (기본값)
  continuous  - 연속 모니터링 시작
  test-alert  - 테스트 알림 전송
  config      - 현재 설정 출력

Environment Variables:
  NEXT_PUBLIC_APP_URL   - 모니터링 대상 URL
  SLACK_WEBHOOK_URL     - Slack 알림 웹훅 URL
  DISCORD_WEBHOOK_URL   - Discord 알림 웹훅 URL

Examples:
  node vercel-deployment-monitor.js once
  node vercel-deployment-monitor.js continuous
  node vercel-deployment-monitor.js test-alert
      `);
  }
}

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  Logger.info('🛑 모니터링 종료 중...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('🛑 모니터링 종료 중...');
  process.exit(0);
});

// 에러 핸들링
process.on('unhandledRejection', (reason, promise) => {
  Logger.error(`❌ 미처리 Promise 거부: ${reason}`);
});

process.on('uncaughtException', (error) => {
  Logger.error(`❌ 미처리 예외: ${error.message}`);
  process.exit(1);
});

// 실행
if (require.main === module) {
  main().catch(error => {
    Logger.error(`❌ 실행 중 오류: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  performHealthCheck,
  sendAlert,
  runMonitoring,
  CONFIG,
};