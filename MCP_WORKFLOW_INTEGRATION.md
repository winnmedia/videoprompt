# 🚀 MCP 테스트 워크플로우 통합 가이드

## 📋 목차

1. [개발 환경 설정](#개발-환경-설정)
2. [팀 워크플로우 통합](#팀-워크플로우-통합)
3. [Git 훅 설정](#git-훅-설정)
4. [CI/CD 파이프라인](#cicd-파이프라인)
5. [모니터링 및 최적화](#모니터링-및-최적화)
6. [문제 해결](#문제-해결)

## 🔧 개발 환경 설정

### 1.1 필수 환경 변수 설정

개발팀 모든 구성원이 다음 환경 변수를 설정해야 합니다:

```bash
# .env.local 파일에 추가
MCP_PERFORMANCE_TEST=true
MCP_LOAD_TEST=false  # 로컬에서는 비활성화
PLAYWRIGHT_BROWSERS_PATH=0
NODE_OPTIONS="--max-old-space-size=4096"

# MCP 서버 설정
MCP_SERVER_TIMEOUT=30000
MCP_CONTEXT_CLEANUP_INTERVAL=20
MCP_MAX_CONTEXTS=100
```

### 1.2 개발자 도구 설치

```bash
# 프로젝트 루트에서 실행
npm install

# Playwright 브라우저 설치
npx playwright install --with-deps

# MCP 서버 상태 확인
npm run test:mcp
```

### 1.3 IDE 설정 (VS Code)

`.vscode/settings.json` 파일 생성:

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "vitest.enable": true,
  "vitest.commandLine": "npm test",
  "files.associations": {
    "*.test.ts": "typescript"
  }
}
```

`.vscode/tasks.json` 파일 생성:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "MCP 서버 상태 확인",
      "type": "shell",
      "command": "npm run test:mcp",
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      }
    },
    {
      "label": "MCP 통합 테스트",
      "type": "shell",
      "command": "npm run test:mcp:ci",
      "group": "test",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      }
    }
  ]
}
```

## 👥 팀 워크플로우 통합

### 2.1 개발 프로세스 통합

#### 기능 개발 시 MCP 테스트 작성 가이드

1. **새로운 기능 개발 시**:

   ```bash
   # 기능 브랜치 생성
   git checkout -b feature/new-feature

   # 기능 구현
   # ...

   # MCP 테스트 작성
   # src/__tests__/feature-new-feature.mcp.test.ts
   ```

2. **MCP 테스트 템플릿**:

   ```typescript
   import { describe, it, expect, beforeAll, afterAll } from 'vitest';
   import { IntegratedTestManager } from '@/lib/mcp-servers/test-utils';

   describe('새로운 기능 MCP 테스트', () => {
     let testManager: IntegratedTestManager;

     beforeAll(() => {
       testManager = new IntegratedTestManager();
     });

     afterAll(() => {
       testManager.clearAllContexts();
     });

     it('새로운 기능이 정상 작동해야 한다', async () => {
       const testSteps = [
         {
           type: 'accessibility' as const,
           name: '접근성 테스트',
           config: { includePerformance: true },
         },
       ];

       const result = await testManager.runComprehensiveTest(
         'new-feature-test',
         'http://localhost:3000/new-feature',
         testSteps,
       );

       expect(result.success).toBe(true);
     });
   });
   ```

### 2.2 코드 리뷰 체크리스트

#### MCP 테스트 관련 체크리스트:

- [ ] MCP 테스트가 작성되었는가?
- [ ] 테스트가 실제 사용자 시나리오를 반영하는가?
- [ ] 접근성 테스트가 포함되었는가?
- [ ] 성능 테스트가 필요한 기능인가?
- [ ] 테스트 정리(cleanup)가 적절히 구현되었는가?

## 🔗 Git 훅 설정

### 3.1 Pre-commit 훅 설정

`.husky/pre-commit` 파일 생성:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 MCP 서버 상태 확인 중..."
npm run test:mcp

if [ $? -ne 0 ]; then
  echo "❌ MCP 서버 상태 확인 실패. 커밋을 중단합니다."
  exit 1
fi

echo "🧪 변경된 파일에 대한 MCP 테스트 실행 중..."
npm run test:mcp:enhanced

if [ $? -ne 0 ]; then
  echo "❌ MCP 테스트 실패. 커밋을 중단합니다."
  exit 1
fi

echo "✅ 모든 MCP 테스트 통과. 커밋을 진행합니다."
```

### 3.2 Pre-push 훅 설정

`.husky/pre-push` 파일 생성:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🚀 푸시 전 전체 MCP 테스트 실행 중..."
npm run test:mcp:ci

if [ $? -ne 0 ]; then
  echo "❌ MCP 테스트 실패. 푸시를 중단합니다."
  exit 1
fi

echo "✅ 모든 MCP 테스트 통과. 푸시를 진행합니다."
```

## 🔄 CI/CD 파이프라인

### 4.1 GitHub Actions 워크플로우 활성화

이미 생성된 `.github/workflows/mcp-testing.yml`을 활성화:

```yaml
# 추가 설정
env:
  MCP_PERFORMANCE_TEST: true
  MCP_LOAD_TEST: false # CI에서는 기본적으로 비활성화
  NODE_OPTIONS: '--max-old-space-size=4096'
```

### 4.2 브랜치 보호 규칙 설정

GitHub 저장소 설정에서:

1. **Settings** → **Branches** → **Add rule**
2. **Branch name pattern**: `main`, `develop`
3. **Require status checks to pass before merging** 체크
4. **Require branches to be up to date before merging** 체크
5. **Status checks**: `MCP Unit Tests`, `MCP Integration Tests` 선택

### 4.3 자동 배포 조건 설정

```yaml
# .github/workflows/deploy.yml에 추가
jobs:
  deploy:
    needs: [mcp-unit-tests, mcp-integration-tests]
    if: github.ref == 'refs/heads/main' && needs.mcp-unit-tests.result == 'success' && needs.mcp-integration-tests.result == 'success'
```

## 📊 모니터링 및 최적화

### 5.1 테스트 성능 모니터링

`scripts/monitor-mcp-performance.js` 생성:

```javascript
const fs = require('fs');
const path = require('path');

class MCPPerformanceMonitor {
  constructor() {
    this.metricsFile = path.join(__dirname, '../mcp-metrics.json');
    this.metrics = this.loadMetrics();
  }

  loadMetrics() {
    try {
      return JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
    } catch {
      return { testRuns: [], averages: {} };
    }
  }

  recordTestRun(testSuite, duration, passRate) {
    const timestamp = new Date().toISOString();
    this.metrics.testRuns.push({
      timestamp,
      testSuite,
      duration,
      passRate,
    });

    // 최근 30일 데이터만 유지
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.metrics.testRuns = this.metrics.testRuns.filter(
      (run) => new Date(run.timestamp) > thirtyDaysAgo,
    );

    this.calculateAverages();
    this.saveMetrics();
  }

  calculateAverages() {
    const suites = ['enhanced', 'integration', 'website', 'performance'];

    suites.forEach((suite) => {
      const suiteRuns = this.metrics.testRuns.filter((run) => run.testSuite === suite);
      if (suiteRuns.length > 0) {
        this.metrics.averages[suite] = {
          avgDuration: suiteRuns.reduce((sum, run) => sum + run.duration, 0) / suiteRuns.length,
          avgPassRate: suiteRuns.reduce((sum, run) => sum + run.passRate, 0) / suiteRuns.length,
          totalRuns: suiteRuns.length,
        };
      }
    });
  }

  saveMetrics() {
    fs.writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2));
  }

  generateReport() {
    console.log('📊 MCP 테스트 성능 리포트');
    console.log('================================');

    Object.entries(this.metrics.averages).forEach(([suite, avg]) => {
      console.log(`${suite.toUpperCase()}:`);
      console.log(`  평균 실행 시간: ${avg.avgDuration.toFixed(2)}ms`);
      console.log(`  평균 통과율: ${(avg.avgPassRate * 100).toFixed(1)}%`);
      console.log(`  총 실행 횟수: ${avg.totalRuns}회`);
      console.log('');
    });
  }
}

module.exports = MCPPerformanceMonitor;
```

### 5.2 알림 시스템 설정

`scripts/mcp-notification.js` 생성:

```javascript
const { WebhookClient } = require('discord.js');

class MCPNotificationService {
  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  }

  async notifyTestFailure(testSuite, failedTests, branch) {
    const message = {
      embeds: [
        {
          title: '❌ MCP 테스트 실패',
          description: `**브랜치**: ${branch}\n**테스트 스위트**: ${testSuite}\n**실패한 테스트**: ${failedTests}개`,
          color: 0xff0000,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    if (this.webhookUrl) {
      await this.sendDiscordNotification(message);
    }

    if (this.slackWebhookUrl) {
      await this.sendSlackNotification(testSuite, failedTests, branch);
    }
  }

  async notifyTestSuccess(testSuite, passedTests, branch) {
    const message = {
      embeds: [
        {
          title: '✅ MCP 테스트 성공',
          description: `**브랜치**: ${branch}\n**테스트 스위트**: ${testSuite}\n**통과한 테스트**: ${passedTests}개`,
          color: 0x00ff00,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    if (this.webhookUrl) {
      await this.sendDiscordNotification(message);
    }
  }

  async sendDiscordNotification(message) {
    try {
      const webhook = new WebhookClient({ url: this.webhookUrl });
      await webhook.send(message);
    } catch (error) {
      console.error('Discord 알림 전송 실패:', error);
    }
  }

  async sendSlackNotification(testSuite, failedTests, branch) {
    try {
      const response = await fetch(this.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `❌ MCP 테스트 실패: ${testSuite} (${failedTests}개 실패, 브랜치: ${branch})`,
        }),
      });
    } catch (error) {
      console.error('Slack 알림 전송 실패:', error);
    }
  }
}

module.exports = MCPNotificationService;
```

## 🔧 문제 해결

### 6.1 일반적인 문제 및 해결책

#### MCP 서버 연결 실패

```bash
# 해결 방법
npm run test:mcp
# 실패 시 MCP 서버 재설치
rm -rf src/lib/mcp-servers/*/node_modules
npm run setup:mcp-servers
```

#### 메모리 부족 오류

```bash
# Node.js 메모리 제한 증가
export NODE_OPTIONS="--max-old-space-size=8192"
npm run test:mcp:performance
```

#### 테스트 타임아웃

```bash
# 타임아웃 설정 증가
export MCP_SERVER_TIMEOUT=60000
npm run test:mcp:integration
```

### 6.2 성능 최적화 가이드

#### 병렬 테스트 최적화

```typescript
// 동시 실행 수 제한
const concurrency = Math.min(4, require('os').cpus().length);
const chunks = [];

for (let i = 0; i < testCases.length; i += concurrency) {
  chunks.push(testCases.slice(i, i + concurrency));
}

for (const chunk of chunks) {
  const promises = chunk.map((testCase) => runTest(testCase));
  await Promise.all(promises);
}
```

#### 메모리 관리

```typescript
// 주기적 정리
setInterval(() => {
  if (testManager.getContextCount() > 100) {
    testManager.clearAllContexts();
  }
}, 30000);
```

## 📈 확장 계획

### 7.1 단계별 확장 로드맵

1. **Phase 1**: 핵심 페이지 MCP 테스트 (완료)
2. **Phase 2**: API 엔드포인트 MCP 테스트
3. **Phase 3**: 모바일 반응형 MCP 테스트
4. **Phase 4**: 성능 회귀 테스트 자동화
5. **Phase 5**: 사용자 시나리오 기반 E2E 테스트

### 7.2 고급 기능 계획

- **시각적 회귀 테스트**: 스크린샷 비교
- **접근성 자동 감사**: WCAG 2.1 AA 준수 검증
- **성능 벤치마킹**: 경쟁사 대비 성능 비교
- **사용자 행동 시뮬레이션**: 실제 사용 패턴 기반 테스트

---

## 🎯 다음 단계

1. **즉시 실행**: 개발 환경 설정 및 팀 교육
2. **1주 내**: Git 훅 설정 및 CI/CD 활성화
3. **2주 내**: 모니터링 시스템 구축
4. **1개월 내**: 전체 워크플로우 안정화

이 가이드를 따라 단계적으로 진행하면 MCP 테스트가 개발 워크플로우에 자연스럽게 통합됩니다.
