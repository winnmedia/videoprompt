# 🔗 MCP 테스트 Git 워크플로우 가이드

## 📋 브랜치 전략

### **브랜치 구조**
```
main (프로덕션)
├── develop (개발)
│   ├── feature/mcp-integration (기능 개발)
│   ├── feature/user-dashboard (기능 개발)
│   └── hotfix/critical-bug (긴급 수정)
└── release/v1.2.0 (릴리스 준비)
```

### **MCP 테스트 적용 수준**

#### **main 브랜치** 🔒
- **보호 수준**: 최고
- **필수 테스트**: 모든 MCP 테스트 (100% 통과)
- **추가 요구사항**: 
  - 코드 리뷰 2명 승인
  - 성능 회귀 테스트 통과
  - 보안 스캔 통과

#### **develop 브랜치** 🛡️
- **보호 수준**: 높음
- **필수 테스트**: 기본 + 통합 MCP 테스트
- **추가 요구사항**:
  - 코드 리뷰 1명 승인
  - 기능 테스트 통과

#### **feature 브랜치** ⚡
- **보호 수준**: 중간
- **필수 테스트**: 기본 MCP 테스트
- **추가 요구사항**:
  - 관련 기능 테스트 작성
  - 린트 및 타입 체크 통과

## 🔄 개발 워크플로우

### **1. 기능 개발 시작**
```bash
# develop 브랜치에서 시작
git checkout develop
git pull origin develop

# 새로운 기능 브랜치 생성
git checkout -b feature/new-awesome-feature

# MCP 테스트 상태 확인
npm run test:mcp
```

### **2. 개발 중 테스트 작성**
```bash
# 기능 구현
# src/components/AwesomeFeature.tsx

# MCP 테스트 작성
# src/__tests__/awesome-feature.mcp.test.ts
```

**MCP 테스트 템플릿**:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IntegratedTestManager } from '@/lib/mcp-servers/test-utils';

describe('Awesome Feature MCP 테스트', () => {
  let testManager: IntegratedTestManager;

  beforeAll(() => {
    testManager = new IntegratedTestManager();
  });

  afterAll(() => {
    testManager.clearAllContexts();
  });

  it('새로운 기능이 접근성 기준을 만족해야 한다', async () => {
    const testSteps = [
      {
        type: 'accessibility' as const,
        name: 'Awesome Feature 접근성 테스트',
        config: { 
          includePerformance: true,
          accessibilityRules: ['color-contrast', 'keyboard-navigation']
        }
      }
    ];

    const result = await testManager.runComprehensiveTest(
      'awesome-feature-accessibility',
      'http://localhost:3000/awesome-feature',
      testSteps
    );

    expect(result.success).toBe(true);
    expect(result.context.steps).toHaveLength(1);
    expect(result.context.steps[0].status).toBe('completed');
  });

  it('새로운 기능이 모든 뷰포트에서 정상 작동해야 한다', async () => {
    const testSteps = [
      {
        type: 'responsive' as const,
        name: 'Awesome Feature 반응형 테스트',
        config: {
          viewports: [
            { width: 1920, height: 1080 }, // 데스크톱
            { width: 768, height: 1024 },  // 태블릿
            { width: 375, height: 667 }    // 모바일
          ]
        }
      }
    ];

    const result = await testManager.runComprehensiveTest(
      'awesome-feature-responsive',
      'http://localhost:3000/awesome-feature',
      testSteps
    );

    expect(result.success).toBe(true);
  });
});
```

### **3. 커밋 및 푸시**
```bash
# 변경사항 스테이징
git add .

# 커밋 (pre-commit 훅 자동 실행)
git commit -m "feat: awesome feature 추가

- 새로운 UI 컴포넌트 구현
- MCP 테스트 추가 (접근성, 반응형)
- 성능 최적화 적용"

# 푸시 (pre-push 훅 자동 실행)
git push origin feature/new-awesome-feature
```

### **4. Pull Request 생성**
```markdown
## 🚀 새로운 기능: Awesome Feature

### 📝 변경 사항
- [ ] 새로운 UI 컴포넌트 구현
- [ ] 접근성 기준 준수 (WCAG 2.1 AA)
- [ ] 반응형 디자인 적용
- [ ] 성능 최적화

### 🧪 MCP 테스트
- [x] 접근성 테스트 통과
- [x] 반응형 테스트 통과
- [x] 성능 테스트 통과
- [x] 통합 테스트 통과

### 📊 테스트 결과
```
✅ MCP Enhanced Tests: 15/15 통과
✅ MCP Integration Tests: 7/7 통과
✅ MCP Website Tests: 8/8 통과
✅ MCP Performance Tests: 8/9 통과 (1개 경미한 이슈)
```

### 🔍 리뷰 포인트
- MCP 테스트 커버리지 확인
- 접근성 기준 준수 여부
- 성능 영향도 검토
- 코드 품질 및 가독성
```

## 🛡️ 브랜치 보호 규칙

### **GitHub 설정**
```yaml
# .github/branch-protection.yml
protection_rules:
  main:
    required_status_checks:
      - "MCP Unit Tests"
      - "MCP Integration Tests"
      - "MCP Website Tests"
      - "MCP Performance Tests"
    required_reviews: 2
    dismiss_stale_reviews: true
    require_code_owner_reviews: true
    
  develop:
    required_status_checks:
      - "MCP Unit Tests"
      - "MCP Integration Tests"
    required_reviews: 1
    dismiss_stale_reviews: true
```

### **로컬 Git 설정**
```bash
# 브랜치별 자동 테스트 설정
git config branch.main.mcp-test-level "full"
git config branch.develop.mcp-test-level "integration"
git config branch.feature.mcp-test-level "basic"
```

## 🔧 문제 해결 가이드

### **커밋 실패 시**
```bash
# MCP 서버 상태 확인
npm run test:mcp

# 실패한 테스트 확인
npm run test:mcp:enhanced

# 특정 테스트만 실행
npm test -- src/__tests__/my-feature.mcp.test.ts

# 테스트 수정 후 재시도
git add .
git commit -m "fix: MCP 테스트 수정"
```

### **푸시 실패 시**
```bash
# 전체 MCP 테스트 상태 확인
npm run test:mcp:ci

# 개발 서버 시작 (필요시)
npm run dev &

# 실패한 테스트 개별 실행
npm run test:mcp:website
npm run test:mcp:performance

# 문제 해결 후 재시도
git push origin feature/my-feature
```

### **성능 테스트 실패 시**
```bash
# 메모리 증가
export NODE_OPTIONS="--max-old-space-size=8192"

# 타임아웃 증가
export MCP_SERVER_TIMEOUT=60000

# 부하 테스트 비활성화 (로컬)
export MCP_LOAD_TEST=false

npm run test:mcp:performance
```

## 📊 코드 리뷰 체크리스트

### **MCP 테스트 관련**
- [ ] **테스트 작성**: 새로운 기능에 대한 MCP 테스트가 작성되었는가?
- [ ] **테스트 품질**: 테스트가 실제 사용자 시나리오를 반영하는가?
- [ ] **접근성**: 접근성 테스트가 포함되고 통과하는가?
- [ ] **성능**: 성능에 영향을 주는 변경사항에 대한 테스트가 있는가?
- [ ] **정리**: 테스트 후 적절한 정리(cleanup)가 구현되었는가?

### **코드 품질**
- [ ] **타입 안전성**: TypeScript 타입이 올바르게 정의되었는가?
- [ ] **에러 처리**: 적절한 에러 처리가 구현되었는가?
- [ ] **성능 최적화**: 불필요한 리렌더링이나 메모리 누수가 없는가?
- [ ] **문서화**: 복잡한 로직에 대한 주석이 있는가?

### **사용자 경험**
- [ ] **접근성**: WCAG 2.1 AA 기준을 준수하는가?
- [ ] **반응형**: 모든 디바이스에서 정상 작동하는가?
- [ ] **성능**: 로딩 시간이 허용 범위 내인가?
- [ ] **사용성**: 직관적이고 사용하기 쉬운가?

## 🚀 고급 워크플로우

### **자동 MCP 테스트 생성**
```bash
# 새로운 컴포넌트에 대한 기본 MCP 테스트 자동 생성
npm run generate:mcp-test src/components/NewComponent.tsx
```

### **성능 회귀 감지**
```bash
# 이전 커밋과 성능 비교
npm run test:mcp:performance -- --compare-with=HEAD~1
```

### **시각적 회귀 테스트**
```bash
# 스크린샷 기반 시각적 테스트
npm run test:mcp:visual -- --update-snapshots
```

## 📈 메트릭 및 모니터링

### **Git 훅 성능 모니터링**
```bash
# 훅 실행 시간 측정
echo "Pre-commit hook duration: $(date)" >> .git/hooks/performance.log
```

### **테스트 성공률 추적**
```bash
# 일일 테스트 성공률 리포트
npm run report:mcp-success-rate
```

### **브랜치별 품질 지표**
```bash
# 브랜치별 MCP 테스트 커버리지
npm run report:mcp-coverage-by-branch
```

## 🎯 베스트 프랙티스

### **커밋 메시지 규칙**
```
feat: 새로운 기능 추가
fix: 버그 수정
test: MCP 테스트 추가/수정
perf: 성능 개선
refactor: 코드 리팩토링
docs: 문서 업데이트
style: 코드 스타일 변경
```

### **브랜치 네이밍 규칙**
```
feature/mcp-integration    # 새로운 기능
bugfix/mcp-test-failure   # 버그 수정
hotfix/critical-issue     # 긴급 수정
release/v1.2.0           # 릴리스 준비
```

### **MCP 테스트 네이밍 규칙**
```
src/__tests__/
├── components/
│   ├── button.mcp.test.ts
│   └── modal.mcp.test.ts
├── pages/
│   ├── home.mcp.test.ts
│   └── dashboard.mcp.test.ts
└── features/
    ├── auth.mcp.test.ts
    └── payment.mcp.test.ts
```

---

**🎉 이 워크플로우를 따르면 MCP 테스트가 개발 프로세스에 자연스럽게 통합되어 높은 품질의 코드를 지속적으로 유지할 수 있습니다!**

