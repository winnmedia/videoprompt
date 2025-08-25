# 👥 MCP 테스트 팀 온보딩 가이드

## 📋 신규 팀원 체크리스트

### **1단계: 환경 설정** (30분)

- [ ] **시스템 요구사항 확인**
  - [ ] Node.js 18 이상 설치 확인
  - [ ] npm 최신 버전 설치 확인
  - [ ] Git 설치 확인

- [ ] **프로젝트 클론 및 설정**
  ```bash
  git clone [repository-url]
  cd videoprompt
  chmod +x scripts/setup-dev-environment.sh
  ./scripts/setup-dev-environment.sh
  ```

- [ ] **IDE 설정 (VS Code 권장)**
  - [ ] VS Code 설치
  - [ ] 필수 확장 프로그램 설치:
    - [ ] TypeScript and JavaScript Language Features
    - [ ] Vitest
    - [ ] ESLint
    - [ ] Prettier

### **2단계: MCP 테스트 이해** (45분)

- [ ] **MCP 서버 개념 학습**
  - [ ] [MCP_DEVELOPER_GUIDE.md](./MCP_DEVELOPER_GUIDE.md) 읽기
  - [ ] 3가지 MCP 서버 역할 이해:
    - [ ] Playwright MCP: 브라우저 자동화
    - [ ] Context7 MCP: 컨텍스트 관리
    - [ ] Sequential Thinking MCP: 순차적 사고

- [ ] **기본 테스트 실행**
  ```bash
  npm run test:mcp                # MCP 서버 상태 확인
  npm run test:mcp:enhanced       # 기본 테스트
  ```

- [ ] **테스트 결과 해석**
  - [ ] 성공/실패 메시지 이해
  - [ ] 성능 메트릭 해석
  - [ ] 에러 메시지 대응 방법

### **3단계: 실습** (60분)

- [ ] **간단한 MCP 테스트 작성**
  ```typescript
  // src/__tests__/my-first-mcp.test.ts
  import { describe, it, expect, beforeAll, afterAll } from 'vitest';
  import { IntegratedTestManager } from '@/lib/mcp-servers/test-utils';

  describe('내 첫 번째 MCP 테스트', () => {
    let testManager: IntegratedTestManager;

    beforeAll(() => {
      testManager = new IntegratedTestManager();
    });

    afterAll(() => {
      testManager.clearAllContexts();
    });

    it('메인 페이지 접근성을 테스트할 수 있다', async () => {
      const testSteps = [
        {
          type: 'accessibility' as const,
          name: '메인 페이지 접근성 테스트'
        }
      ];

      const result = await testManager.runComprehensiveTest(
        'my-first-test',
        'http://localhost:3000',
        testSteps
      );

      expect(result.success).toBe(true);
    });
  });
  ```

- [ ] **테스트 실행 및 결과 확인**
  ```bash
  npm test -- src/__tests__/my-first-mcp.test.ts
  ```

- [ ] **다양한 테스트 타입 실습**
  - [ ] 접근성 테스트
  - [ ] 반응형 테스트
  - [ ] 폼 테스트

### **4단계: 워크플로우 통합** (30분)

- [ ] **Git 훅 이해**
  - [ ] pre-commit 훅 동작 확인
  - [ ] pre-push 훅 동작 확인

- [ ] **브랜치 전략 이해**
  ```bash
  git checkout -b feature/my-feature
  # 개발 작업
  git add .
  git commit -m "feat: 새로운 기능 추가"  # MCP 테스트 자동 실행
  git push origin feature/my-feature      # 전체 MCP 테스트 실행
  ```

- [ ] **코드 리뷰 프로세스**
  - [ ] MCP 테스트 포함 여부 확인
  - [ ] 테스트 품질 검토 기준 이해

## 🎓 교육 자료

### **필수 읽기 자료**
1. [MCP_DEVELOPER_GUIDE.md](./MCP_DEVELOPER_GUIDE.md) - 상세한 사용법
2. [MCP_TESTING_IMPROVEMENTS.md](./MCP_TESTING_IMPROVEMENTS.md) - 개선 사항
3. [MCP_WORKFLOW_INTEGRATION.md](./MCP_WORKFLOW_INTEGRATION.md) - 워크플로우 통합

### **실습 예제**
- `src/__tests__/mcp-enhanced-testing.test.ts` - 기본 예제
- `src/__tests__/mcp-real-integration.test.ts` - 연동 예제
- `src/__tests__/mcp-real-website.test.ts` - 실제 웹사이트 예제

### **참고 자료**
- [Playwright 공식 문서](https://playwright.dev/)
- [Vitest 공식 문서](https://vitest.dev/)
- [Model Context Protocol 사양](https://modelcontextprotocol.io/)

## 🤝 멘토링 프로그램

### **1주차: 기초 학습**
- **목표**: MCP 테스트 개념 이해 및 환경 설정
- **멘토 세션**: 2시간 (개념 설명 + 실습)
- **과제**: 간단한 MCP 테스트 3개 작성

### **2주차: 실전 적용**
- **목표**: 실제 기능에 MCP 테스트 적용
- **멘토 세션**: 1시간 (코드 리뷰 + 피드백)
- **과제**: 담당 기능에 MCP 테스트 추가

### **3주차: 고급 활용**
- **목표**: 성능 테스트 및 복잡한 시나리오 작성
- **멘토 세션**: 1시간 (고급 기능 + 최적화)
- **과제**: 성능 테스트 및 통합 테스트 작성

### **4주차: 독립 작업**
- **목표**: 독립적으로 MCP 테스트 작성 및 유지보수
- **멘토 세션**: 30분 (질의응답 + 피드백)
- **평가**: 독립적인 MCP 테스트 작성 능력 평가

## 📊 역량 평가 기준

### **기초 레벨** (1-2주차)
- [ ] MCP 서버 역할 설명 가능
- [ ] 기본 테스트 작성 및 실행 가능
- [ ] 테스트 결과 해석 가능
- [ ] 환경 설정 문제 해결 가능

### **중급 레벨** (3주차)
- [ ] 다양한 테스트 타입 활용 가능
- [ ] 성능 테스트 작성 가능
- [ ] 복잡한 시나리오 분해 가능
- [ ] 테스트 최적화 방법 이해

### **고급 레벨** (4주차)
- [ ] 독립적인 테스트 설계 가능
- [ ] 팀원 멘토링 가능
- [ ] 테스트 프레임워크 개선 제안 가능
- [ ] 문제 해결 및 디버깅 능숙

## 🔧 문제 해결 가이드

### **자주 발생하는 문제**

#### 1. MCP 서버 연결 실패
```bash
# 해결 방법
npm run test:mcp
# 실패 시
rm -rf node_modules
npm install
npx playwright install --with-deps
```

#### 2. 테스트 타임아웃
```bash
# 환경 변수 설정
export MCP_SERVER_TIMEOUT=60000
npm run test:mcp:enhanced
```

#### 3. 메모리 부족
```bash
# Node.js 메모리 증가
export NODE_OPTIONS="--max-old-space-size=8192"
npm run test:mcp:performance
```

### **도움 요청 방법**

1. **Slack 채널**: `#mcp-testing`
2. **이슈 트래커**: GitHub Issues
3. **멘토 연락**: 직접 메시지 또는 회의 요청
4. **문서 참조**: 먼저 관련 문서 확인

## 📅 온보딩 일정

### **1일차** (4시간)
- 09:00-10:30: 환경 설정 및 기본 개념
- 10:45-12:00: MCP 서버 이해 및 실습
- 13:00-14:30: 첫 번째 테스트 작성
- 14:45-16:00: 질의응답 및 피드백

### **1주차** (매일 1시간)
- 월: 접근성 테스트 실습
- 화: 반응형 테스트 실습
- 수: 폼 테스트 실습
- 목: 성능 테스트 실습
- 금: 통합 테스트 실습

### **2-4주차** (주 2회, 각 1시간)
- 실제 프로젝트 적용
- 코드 리뷰 및 피드백
- 고급 기능 학습
- 독립 작업 평가

## ✅ 온보딩 완료 체크리스트

### **기술적 역량**
- [ ] MCP 테스트 독립적 작성 가능
- [ ] 다양한 테스트 타입 활용 가능
- [ ] 성능 최적화 방법 이해
- [ ] 문제 해결 능력 보유

### **프로세스 이해**
- [ ] Git 워크플로우 숙지
- [ ] 코드 리뷰 기준 이해
- [ ] CI/CD 파이프라인 이해
- [ ] 팀 협업 방식 숙지

### **문서화**
- [ ] 작성한 테스트 문서화
- [ ] 학습 노트 정리
- [ ] 개선 제안 사항 정리
- [ ] 후임자를 위한 팁 정리

---

**🎉 온보딩 완료 후에는 MCP 테스트 전문가로서 팀의 품질 향상에 기여할 수 있습니다!**



