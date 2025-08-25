#!/usr/bin/env node

/**
 * MCP 테스트 알림 서비스
 * 테스트 실패, 성능 저하, 시스템 이슈에 대한 알림을 다양한 채널로 전송합니다.
 */

const fs = require('fs');
const path = require('path');

class MCPNotificationService {
  constructor() {
    this.config = this.loadConfig();
    this.templates = this.loadTemplates();
  }

  loadConfig() {
    const configPath = path.join(__dirname, '../mcp-notification-config.json');
    
    try {
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (error) {
      console.warn('알림 설정 파일 로드 실패:', error.message);
    }

    // 기본 설정
    return {
      channels: {
        slack: {
          enabled: !!process.env.SLACK_WEBHOOK_URL,
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: '#mcp-testing',
          username: 'MCP Bot'
        },
        discord: {
          enabled: !!process.env.DISCORD_WEBHOOK_URL,
          webhookUrl: process.env.DISCORD_WEBHOOK_URL,
          username: 'MCP Bot'
        },
        email: {
          enabled: !!process.env.EMAIL_SERVICE_API_KEY,
          apiKey: process.env.EMAIL_SERVICE_API_KEY,
          from: 'mcp-testing@yourcompany.com',
          to: ['team@yourcompany.com']
        },
        teams: {
          enabled: !!process.env.TEAMS_WEBHOOK_URL,
          webhookUrl: process.env.TEAMS_WEBHOOK_URL
        }
      },
      rules: {
        testFailure: {
          enabled: true,
          severity: 'high',
          channels: ['slack', 'discord']
        },
        performanceDegradation: {
          enabled: true,
          severity: 'medium',
          channels: ['slack']
        },
        systemAlert: {
          enabled: true,
          severity: 'high',
          channels: ['slack', 'email']
        },
        dailyReport: {
          enabled: true,
          severity: 'low',
          channels: ['slack'],
          schedule: '09:00'
        }
      }
    };
  }

  loadTemplates() {
    return {
      slack: {
        testFailure: {
          color: 'danger',
          title: '🚨 MCP 테스트 실패',
          fields: [
            { title: '테스트 스위트', value: '{testSuite}', short: true },
            { title: '실패한 테스트', value: '{failedCount}/{totalCount}', short: true },
            { title: '브랜치', value: '{branch}', short: true },
            { title: '커밋', value: '{commit}', short: true }
          ]
        },
        performanceDegradation: {
          color: 'warning',
          title: '⚠️ MCP 테스트 성능 저하',
          fields: [
            { title: '테스트 스위트', value: '{testSuite}', short: true },
            { title: '실행 시간', value: '{duration}초', short: true },
            { title: '이전 평균', value: '{previousAvg}초', short: true },
            { title: '증가율', value: '{increasePercent}%', short: true }
          ]
        },
        systemAlert: {
          color: 'danger',
          title: '🔥 MCP 시스템 알림',
          fields: [
            { title: '알림 유형', value: '{alertType}', short: true },
            { title: '심각도', value: '{severity}', short: true },
            { title: '메시지', value: '{message}', short: false }
          ]
        },
        dailyReport: {
          color: 'good',
          title: '📊 MCP 테스트 일일 리포트',
          fields: [
            { title: '총 실행 횟수', value: '{totalRuns}회', short: true },
            { title: '평균 성공률', value: '{avgPassRate}%', short: true },
            { title: '평균 실행 시간', value: '{avgDuration}초', short: true },
            { title: '알림 수', value: '{alertCount}개', short: true }
          ]
        }
      },
      discord: {
        testFailure: {
          title: '🚨 MCP 테스트 실패',
          color: 0xff0000,
          description: '**테스트 스위트**: {testSuite}\n**실패**: {failedCount}/{totalCount}\n**브랜치**: {branch}\n**커밋**: {commit}'
        },
        performanceDegradation: {
          title: '⚠️ MCP 테스트 성능 저하',
          color: 0xffa500,
          description: '**테스트 스위트**: {testSuite}\n**실행 시간**: {duration}초\n**증가율**: {increasePercent}%'
        },
        systemAlert: {
          title: '🔥 MCP 시스템 알림',
          color: 0xff0000,
          description: '**유형**: {alertType}\n**심각도**: {severity}\n**메시지**: {message}'
        }
      },
      email: {
        testFailure: {
          subject: '[MCP Alert] 테스트 실패 - {testSuite}',
          html: `
            <h2>🚨 MCP 테스트 실패</h2>
            <p><strong>테스트 스위트:</strong> {testSuite}</p>
            <p><strong>실패한 테스트:</strong> {failedCount}/{totalCount}</p>
            <p><strong>브랜치:</strong> {branch}</p>
            <p><strong>커밋:</strong> {commit}</p>
            <p><strong>시간:</strong> {timestamp}</p>
            <h3>실패한 테스트 목록:</h3>
            <ul>{failedTestsList}</ul>
            <p><a href="{buildUrl}">빌드 로그 보기</a></p>
          `
        },
        systemAlert: {
          subject: '[MCP Alert] 시스템 알림 - {alertType}',
          html: `
            <h2>🔥 MCP 시스템 알림</h2>
            <p><strong>알림 유형:</strong> {alertType}</p>
            <p><strong>심각도:</strong> {severity}</p>
            <p><strong>메시지:</strong> {message}</p>
            <p><strong>시간:</strong> {timestamp}</p>
          `
        }
      }
    };
  }

  async sendNotification(type, data, channels = null) {
    const rule = this.config.rules[type];
    if (!rule || !rule.enabled) {
      return { success: false, reason: 'Rule disabled or not found' };
    }

    const targetChannels = channels || rule.channels;
    const results = [];

    for (const channel of targetChannels) {
      if (this.config.channels[channel]?.enabled) {
        try {
          const result = await this.sendToChannel(channel, type, data);
          results.push({ channel, success: true, result });
        } catch (error) {
          console.error(`${channel} 알림 전송 실패:`, error.message);
          results.push({ channel, success: false, error: error.message });
        }
      }
    }

    return { success: results.some(r => r.success), results };
  }

  async sendToChannel(channel, type, data) {
    switch (channel) {
      case 'slack':
        return await this.sendSlackNotification(type, data);
      case 'discord':
        return await this.sendDiscordNotification(type, data);
      case 'email':
        return await this.sendEmailNotification(type, data);
      case 'teams':
        return await this.sendTeamsNotification(type, data);
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }

  async sendSlackNotification(type, data) {
    const config = this.config.channels.slack;
    const template = this.templates.slack[type];
    
    if (!template) {
      throw new Error(`Slack template not found for type: ${type}`);
    }

    const payload = {
      channel: config.channel,
      username: config.username,
      attachments: [{
        color: template.color,
        title: this.replaceTemplate(template.title, data),
        fields: template.fields.map(field => ({
          title: field.title,
          value: this.replaceTemplate(field.value, data),
          short: field.short
        })),
        footer: 'MCP Testing System',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    return { status: 'sent', timestamp: new Date().toISOString() };
  }

  async sendDiscordNotification(type, data) {
    const config = this.config.channels.discord;
    const template = this.templates.discord[type];
    
    if (!template) {
      throw new Error(`Discord template not found for type: ${type}`);
    }

    const payload = {
      username: config.username,
      embeds: [{
        title: this.replaceTemplate(template.title, data),
        description: this.replaceTemplate(template.description, data),
        color: template.color,
        timestamp: new Date().toISOString()
      }]
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    return { status: 'sent', timestamp: new Date().toISOString() };
  }

  async sendEmailNotification(type, data) {
    const config = this.config.channels.email;
    const template = this.templates.email[type];
    
    if (!template) {
      throw new Error(`Email template not found for type: ${type}`);
    }

    // 실제 이메일 서비스 API 호출 (예: SendGrid, AWS SES 등)
    // 여기서는 로그만 출력
    console.log('📧 이메일 알림 전송:');
    console.log(`  받는 사람: ${config.to.join(', ')}`);
    console.log(`  제목: ${this.replaceTemplate(template.subject, data)}`);
    console.log(`  내용: ${this.replaceTemplate(template.html, data)}`);

    return { status: 'sent', timestamp: new Date().toISOString() };
  }

  async sendTeamsNotification(type, data) {
    const config = this.config.channels.teams;
    
    // Microsoft Teams 메시지 카드 형식
    const payload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": type === 'testFailure' ? "FF0000" : type === 'performanceDegradation' ? "FFA500" : "0078D4",
      "summary": `MCP ${type} 알림`,
      "sections": [{
        "activityTitle": `MCP ${type} 알림`,
        "activitySubtitle": data.message || '',
        "facts": Object.entries(data).map(([key, value]) => ({
          "name": key,
          "value": String(value)
        }))
      }]
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Teams API error: ${response.status}`);
    }

    return { status: 'sent', timestamp: new Date().toISOString() };
  }

  replaceTemplate(template, data) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  // 테스트 실패 알림
  async notifyTestFailure(testSuite, failedTests, totalTests, branch = 'unknown', commit = 'unknown') {
    const data = {
      testSuite,
      failedCount: failedTests.length,
      totalCount: totalTests,
      branch,
      commit,
      timestamp: new Date().toISOString(),
      failedTestsList: failedTests.map(test => `<li>${test.name}: ${test.error}</li>`).join(''),
      buildUrl: process.env.BUILD_URL || '#'
    };

    return await this.sendNotification('testFailure', data);
  }

  // 성능 저하 알림
  async notifyPerformanceDegradation(testSuite, currentDuration, previousAvg) {
    const increasePercent = ((currentDuration - previousAvg) / previousAvg * 100).toFixed(1);
    
    const data = {
      testSuite,
      duration: (currentDuration / 1000).toFixed(1),
      previousAvg: (previousAvg / 1000).toFixed(1),
      increasePercent,
      timestamp: new Date().toISOString()
    };

    return await this.sendNotification('performanceDegradation', data);
  }

  // 시스템 알림
  async notifySystemAlert(alertType, severity, message) {
    const data = {
      alertType,
      severity,
      message,
      timestamp: new Date().toISOString()
    };

    return await this.sendNotification('systemAlert', data);
  }

  // 일일 리포트 알림
  async notifyDailyReport(report) {
    const data = {
      totalRuns: report.summary.totalRuns,
      avgPassRate: (report.summary.avgPassRate * 100).toFixed(1),
      avgDuration: (report.summary.avgDuration / 1000).toFixed(1),
      alertCount: report.summary.totalAlerts,
      timestamp: new Date().toISOString()
    };

    return await this.sendNotification('dailyReport', data);
  }

  // 설정 파일 생성
  saveConfig() {
    const configPath = path.join(__dirname, '../mcp-notification-config.json');
    try {
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
      console.log('✅ 알림 설정 파일 저장 완료:', configPath);
    } catch (error) {
      console.error('❌ 알림 설정 파일 저장 실패:', error.message);
    }
  }

  // 테스트 알림 전송
  async testNotifications() {
    console.log('🧪 알림 시스템 테스트 중...\n');

    const testData = {
      testSuite: 'enhanced',
      failedCount: 2,
      totalCount: 15,
      branch: 'feature/test-notifications',
      commit: 'abc123',
      timestamp: new Date().toISOString()
    };

    try {
      const result = await this.sendNotification('testFailure', testData, ['slack']);
      console.log('✅ 테스트 알림 전송 결과:', result);
    } catch (error) {
      console.error('❌ 테스트 알림 전송 실패:', error.message);
    }
  }
}

// CLI 인터페이스
if (require.main === module) {
  const service = new MCPNotificationService();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'test':
      service.testNotifications();
      break;
    case 'config':
      service.saveConfig();
      break;
    case 'notify':
      const type = process.argv[3];
      const data = JSON.parse(process.argv[4] || '{}');
      service.sendNotification(type, data)
        .then(result => console.log('알림 전송 결과:', result))
        .catch(error => console.error('알림 전송 실패:', error));
      break;
    default:
      console.log('사용법:');
      console.log('  node mcp-notification-service.js test     # 알림 시스템 테스트');
      console.log('  node mcp-notification-service.js config   # 설정 파일 생성');
      console.log('  node mcp-notification-service.js notify <type> <data>  # 알림 전송');
  }
}

module.exports = MCPNotificationService;




