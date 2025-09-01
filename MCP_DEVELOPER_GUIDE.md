# 🚀 MCP Enhanced Testing - 개발자 가이드

## 📋 목차

1. [개요](#개요)
2. [설치 및 설정](#설치-및-설정)
3. [기본 사용법](#기본-사용법)
4. [테스트 작성 가이드](#테스트-작성-가이드)
5. [MCP 서버별 활용법](#mcp-서버별-활용법)
6. [성능 최적화](#성능-최적화)
7. [문제 해결](#문제-해결)
8. [CI/CD 통합](#cicd-통합)

## 🎯 개요

MCP Enhanced Testing은 **Model Context Protocol (MCP)** 서버들을 활용하여 웹서비스의 품질을 종합적으로 테스트하는 프레임워크입니다.

### ✨ 주요 특징

- **Playwright MCP**: 브라우저 자동화, 접근성, 성능 테스트
- **Context7 MCP**: 테스트 컨텍스트 관리, 메모리 최적화
- **Sequential Thinking MCP**: 복잡한 테스트 시나리오 분해, 의존성 관리
- **통합 테스트 매니저**: 모든 MCP 서버를 조율하여 종합 테스트 실행

### 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    IntegratedTestManager                    │
├─────────────────┬─────────────────┬─────────────────────────┤
│ BrowserTestMgr  │ ContextManager  │ SequentialTestMgr      │
│ (Playwright)    │ (Context7)      │ (Sequential Thinking)  │
├─────────────────┴─────────────────┴─────────────────────────┤
│                    MCP Servers                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │ Playwright  │ │  Context7   │ │ Sequential Thinking │  │
│  │    MCP      │ │     MCP     │ │        MCP          │  │
│  └─────────────┘ └─────────────┘ └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 설치 및 설정

### 1. 의존성 설치

```bash
# 프로젝트 루트에서
npm install

# Playwright 브라우저 설치
npx playwright install --with-deps
```

### 2. MCP 서버 상태 확인

```bash
# 모든 MCP 서버 상태 확인
npm run test:mcp

# 개별 MCP 서버 정보 확인
npm test -- src/__tests__/mcp-enhanced-testing.test.ts
```

### 3. 환경 변수 설정

```bash
# .env.local 파일에 추가
MCP_PERFORMANCE_TEST=true
MCP_LOAD_TEST=true
PLAYWRIGHT_BROWSERS_PATH=0
```

## 🚀 기본 사용법

### 1. 통합 테스트 매니저 초기화

```typescript
import { IntegratedTestManager } from '@/lib/mcp-servers/test-utils';

const testManager = new IntegratedTestManager();
```

### 2. 기본 테스트 실행

```typescript
const testSteps = [
  {
    type: 'accessibility' as const,
    name: '접근성 테스트',
    config: { includePerformance: true },
  },
  {
    type: 'responsive' as const,
    name: '반응형 테스트',
    config: {
      viewports: [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
      ],
    },
  },
];

const result = await testManager.runComprehensiveTest(
  'my-test',
  'http://localhost:3000',
  testSteps,
);

console.log('테스트 성공:', result.success);
console.log('결과 수:', result.results.length);
```

### 3. 테스트 결과 확인

```typescript
// 테스트 요약 가져오기
const summary = testManager.getTestSummary();
console.log('총 테스트:', summary.totalTests);
console.log('성공:', summary.passedTests);
console.log('실패:', summary.failedTests);

// 컨텍스트 정리
testManager.clearAllContexts();
```

## 📝 테스트 작성 가이드

### 1. 테스트 구조

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IntegratedTestManager } from '@/lib/mcp-servers/test-utils';

describe('내 기능 테스트', () => {
  let testManager: IntegratedTestManager;

  beforeAll(() => {
    testManager = new IntegratedTestManager();
  });

  afterAll(() => {
    testManager.clearAllContexts();
  });

  it('기능이 정상 작동해야 한다', async () => {
    const testSteps = [
      {
        type: 'accessibility' as const,
        name: '접근성 검사',
        config: { includePerformance: true },
      },
    ];

    const result = await testManager.runComprehensiveTest(
      'test-name',
      'http://localhost:3000',
      testSteps,
    );

    expect(result.success).toBe(true);
  });
});
```

### 2. 테스트 단계 타입

#### Accessibility Test

```typescript
{
  type: 'accessibility' as const,
  name: '접근성 테스트',
  config: {
    includePerformance: true,
    accessibilityRules: ['color-contrast', 'keyboard-navigation'],
    focusManagement: true
  }
}
```

#### Responsive Test

```typescript
{
  type: 'responsive' as const,
  name: '반응형 테스트',
  config: {
    viewports: [
      { width: 1920, height: 1080 }, // 데스크톱
      { width: 768, height: 1024 },  // 태블릿
      { width: 375, height: 667 }    // 모바일
    ]
  }
}
```

#### Form Test

```typescript
{
  type: 'form' as const,
  name: '폼 테스트',
  config: {
    formData: {
      username: 'testuser',
      email: 'test@example.com'
    },
    multiStep: true,
    validation: true
  }
}
```

#### Custom Test

```typescript
{
  type: 'custom' as const,
  name: '사용자 정의 테스트',
  config: {
    customLogic: 'my-custom-test',
    parameters: { key: 'value' }
  }
}
```

### 3. 테스트 설정 옵션

```typescript
const testConfig = {
  // 성능 테스트
  performance: {
    metrics: ['FCP', 'LCP', 'CLS', 'TTFB'],
    budget: {
      FCP: 2000, // 2초
      LCP: 4000, // 4초
      CLS: 0.1, // 0.1
    },
  },

  // 접근성 테스트
  accessibility: {
    rules: ['color-contrast', 'keyboard-navigation', 'screen-reader'],
    level: 'AA', // WCAG 2.1 AA 기준
  },

  // 반응형 테스트
  responsive: {
    viewports: [
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 },
    ],
    testSteps: ['step1', 'step2', 'step3'],
  },
};
```

## 🔌 MCP 서버별 활용법

### 1. Playwright MCP 활용

#### 브라우저 자동화

```typescript
// 페이지 접근성 테스트
const result = await testManager['browserManager'].testPageAccessibility(url);

// 폼 자동화 테스트
const formResult = await testManager['browserManager'].testFormAutomation(url, {
  username: 'test',
  password: 'test123',
});

// 반응형 디자인 테스트
const responsiveResult = await testManager['browserManager'].testResponsiveDesign(url, [
  { width: 1920, height: 1080 },
  { width: 768, height: 1024 },
]);
```

#### 성능 메트릭 수집

```typescript
const performanceResult = await testManager['browserManager'].testPageAccessibility(url, {
  includePerformance: true,
});

console.log('FCP:', performanceResult.metrics.FCP);
console.log('LCP:', performanceResult.metrics.LCP);
console.log('CLS:', performanceResult.metrics.CLS);
```

### 2. Context7 MCP 활용

#### 컨텍스트 관리

```typescript
const contextManager = testManager['contextManager'];

// 컨텍스트 생성
const context = contextManager.createContext('test-id', {
  url: 'http://localhost:3000',
  userAgent: 'Mozilla/5.0...',
});

// 단계 추가
contextManager.addStep('step1', { description: '첫 번째 단계' });
contextManager.addStep('step2', { description: '두 번째 단계' });

// 단계 실행
contextManager.startStep('step1');
// ... 테스트 로직 ...
contextManager.completeStep('step1', { result: 'success' });
```

#### 메모리 최적화

```typescript
// 주기적 컨텍스트 정리
for (let i = 0; i < 100; i++) {
  // ... 테스트 실행 ...

  if (i % 20 === 0) {
    testManager.clearAllContexts();
  }
}

// 메모리 사용량 모니터링
const memoryUsage = process.memoryUsage();
console.log('메모리 사용량:', memoryUsage.heapUsed / 1024 / 1024, 'MB');
```

### 3. Sequential Thinking MCP 활용

#### 복잡한 워크플로우

```typescript
const sequentialManager = testManager['sequentialManager'];

// 테스트 계획 생성
sequentialManager.createTestPlan('complex-workflow', '복잡한 워크플로우 테스트');

// 단계별 의존성 정의
sequentialManager.addTestStep('complex-workflow', 'init', '초기화', []);
sequentialManager.addTestStep('complex-workflow', 'process', '처리', ['init']);
sequentialManager.addTestStep('complex-workflow', 'validate', '검증', ['process']);
sequentialManager.addTestStep('complex-workflow', 'cleanup', '정리', ['validate']);

// 계획 실행
const result = await sequentialManager.executeTestPlan('complex-workflow', contextManager);
```

#### 병렬 테스트 관리

```typescript
// 병렬 테스트 실행
const testPromises = urls.map(async (url, index) => {
  return testManager.runComprehensiveTest(`parallel-test-${index}`, url, testSteps);
});

const results = await Promise.all(testPromises);
const successCount = results.filter((r) => r.success).length;
```

## ⚡ 성능 최적화

### 1. 병렬 실행 최적화

```typescript
// 동시 실행 수 제한
const concurrency = 5;
const chunks = [];

for (let i = 0; i < urls.length; i += concurrency) {
  chunks.push(urls.slice(i, i + concurrency));
}

for (const chunk of chunks) {
  const promises = chunk.map((url) => testManager.runComprehensiveTest('test', url, testSteps));

  const results = await Promise.all(promises);
  // 결과 처리
}
```

### 2. 메모리 관리

```typescript
// 주기적 가비지 컬렉션
if (global.gc) {
  setInterval(() => {
    global.gc();
    console.log('가비지 컬렉션 실행');
  }, 30000); // 30초마다
}

// 컨텍스트 크기 제한
const MAX_CONTEXTS = 100;
if (testManager['contextManager'].getAllContexts().length > MAX_CONTEXTS) {
  testManager.clearAllContexts();
}
```

### 3. 테스트 타임아웃 설정

```typescript
// 개별 테스트 타임아웃
const testSteps = [
  {
    type: 'accessibility' as const,
    name: '접근성 테스트',
    config: {
      timeout: 10000, // 10초
      retryCount: 3, // 3회 재시도
    },
  },
];
```

## 🐛 문제 해결

### 1. 일반적인 오류

#### MCP 서버 연결 실패

```bash
# MCP 서버 상태 확인
npm run test:mcp

# 개별 서버 테스트
npm test -- src/__tests__/mcp-enhanced-testing.test.ts
```

#### Playwright 브라우저 오류

```bash
# 브라우저 재설치
npx playwright install --with-deps

# 브라우저 경로 확인
echo $PLAYWRIGHT_BROWSERS_PATH
```

#### 메모리 부족 오류

```typescript
// Node.js 메모리 제한 증가
// package.json의 test 스크립트에 추가
"test": "node --max-old-space-size=4096 node_modules/.bin/vitest"

// 또는 환경 변수로 설정
export NODE_OPTIONS="--max-old-space-size=4096"
```

### 2. 디버깅 팁

#### 상세 로그 활성화

```typescript
// 테스트 실행 시 상세 로그
const result = await testManager.runComprehensiveTest('debug-test', url, testSteps, {
  debug: true,
  verbose: true,
});
```

#### 단계별 실행

```typescript
// 개별 단계 실행으로 문제 파악
for (const step of testSteps) {
  try {
    console.log(`단계 실행 중: ${step.name}`);
    const stepResult = await testManager.runComprehensiveTest('step-test', url, [step]);
    console.log(`단계 결과:`, stepResult);
  } catch (error) {
    console.error(`단계 실패: ${step.name}`, error);
  }
}
```

## 🔄 CI/CD 통합

### 1. GitHub Actions 설정

```yaml
# .github/workflows/mcp-testing.yml
name: MCP Testing

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  mcp-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:mcp:ci
```

### 2. 테스트 실행 명령어

```bash
# 모든 MCP 테스트 실행 (CI/CD용)
npm run test:mcp:ci

# 개별 테스트 스위트
npm run test:mcp:enhanced      # 기본 테스트
npm run test:mcp:integration   # 연동 테스트
npm run test:mcp:website       # 웹사이트 테스트
npm run test:mcp:performance   # 성능 테스트

# 전체 테스트 (로컬용)
npm run test:mcp:all
```

### 3. 테스트 결과 아티팩트

```yaml
# 테스트 결과 업로드
- name: Upload test results
  uses: actions/upload-artifact@v4
  with:
    name: mcp-test-results
    path: coverage/
    retention-days: 7
```

## 📚 추가 리소스

### 1. 관련 문서

- [MCP Enhanced Testing 개선사항](./MCP_TESTING_IMPROVEMENTS.md)
- [MCP 서버 설치 가이드](./MCP_SERVERS_README.md)
- [프로젝트 아키텍처](./ARCHITECTURE_FSD.md)

### 2. 유용한 명령어

```bash
# MCP 서버 상태 확인
npm run test:mcp

# 테스트 커버리지 확인
npm run test:coverage

# 특정 테스트 파일만 실행
npm test -- src/__tests__/mcp-real-website.test.ts

# 테스트 감시 모드
npm test -- --watch
```

### 3. 커뮤니티 지원

- **GitHub Issues**: 프로젝트 저장소의 Issues 탭
- **Discussions**: 기술적 질문 및 토론
- **Pull Requests**: 개선사항 제안

---

## 🎯 다음 단계

1. **실제 프로젝트 적용**: 이 가이드를 참고하여 프로젝트의 실제 페이지들에 테스트 적용
2. **성능 최적화**: 테스트 실행 시간 및 메모리 사용량 최적화
3. **커스텀 테스트**: 프로젝트 특성에 맞는 커스텀 테스트 시나리오 개발
4. **팀 교육**: 개발팀원들과 MCP 테스트 활용법 공유

---

**💡 팁**: 처음에는 간단한 테스트부터 시작하여 점진적으로 복잡한 시나리오를 추가하는 것을 권장합니다. MCP 서버들의 강력한 기능을 활용하여 웹서비스의 품질을 한 단계 높여보세요!
