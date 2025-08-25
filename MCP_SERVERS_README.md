# MCP (Model Context Protocol) 서버 설치 및 사용법

## 📋 개요

이 프로젝트에는 3가지 MCP 서버가 통합되어 있습니다:

1. **Playwright MCP** - 브라우저 자동화 및 E2E 테스트
2. **Context7 MCP** - 컨텍스트 관리 및 메모리 최적화
3. **Sequential Thinking MCP** - 순차적 사고 및 문제 해결

## 🚀 설치된 서버들

### 1. Playwright MCP (@microsoft/playwright-mcp)
- **설치 상태**: ✅ 완료
- **패키지**: `@playwright/mcp`
- **주요 기능**:
  - 브라우저 제어 (클릭, 타이핑, 네비게이션)
  - 스크린샷 및 PDF 생성
  - 폼 자동화 및 파일 업로드
  - 접근성 스냅샷
  - 네트워크 요청 모니터링

### 2. Context7 MCP (@upstash/context7)
- **설치 상태**: ✅ 완료
- **위치**: `src/lib/mcp-servers/context7/`
- **주요 기능**:
  - 대화 컨텍스트 압축 및 관리
  - 메모리 효율성 향상
  - 장기 대화 세션 지원
  - 컨텍스트 최적화

### 3. Sequential Thinking MCP (@modelcontextprotocol/server-sequential-thinking)
- **설치 상태**: ✅ 완료
- **위치**: `src/lib/mcp-servers/sequential-thinking/`
- **주요 기능**:
  - 복잡한 작업을 단계별로 분해
  - 논리적 사고 과정 지원
  - 체계적인 문제 해결
  - 순차적 추론

## 🔧 설정 파일

### mcp-servers.json
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp"],
      "env": {
        "PLAYWRIGHT_BROWSERS_PATH": "0"
      }
    },
    "context7": {
      "command": "node",
      "args": ["./src/lib/mcp-servers/context7/index.mjs", "--transport", "stdio"]
    },
    "sequential-thinking": {
      "command": "node",
      "args": ["./src/lib/mcp-servers/sequential-thinking/index.mjs", "--transport", "stdio"]
    }
  }
}
```

## 🧪 테스트

### MCP 서버 테스트 실행
```bash
npm run test:mcp
```

### 개별 서버 테스트
```bash
# Playwright MCP
npx @playwright/mcp --help

# Context7 MCP
node src/lib/mcp-servers/context7/index.mjs --help

# Sequential Thinking MCP
node src/lib/mcp-servers/sequential-thinking/index.mjs --transport stdio
```

## 📁 디렉토리 구조

```
src/lib/mcp-servers/
├── context7/
│   ├── index.mjs
│   ├── package.json
│   └── node_modules/
├── sequential-thinking/
│   ├── index.mjs
│   ├── package.json
│   └── node_modules/
└── index.ts
```

## 🔌 통합 방법

### TypeScript/JavaScript에서 사용
```typescript
import { 
  MCP_SERVERS, 
  checkAllMCPServers, 
  getMCPServerInfo 
} from '@/lib/mcp-servers';

// 사용 가능한 MCP 서버 목록
const availableServers = Object.keys(MCP_SERVERS);

// 모든 서버 상태 확인
const status = await checkAllMCPServers();

// 특정 서버 정보 가져오기
const playwrightInfo = getMCPServerInfo('playwright');
```

## 🎯 사용 사례

### Playwright MCP
- **E2E 테스트 자동화**: 웹사이트 테스트 자동화
- **스크린샷 생성**: 페이지 상태 캡처
- **폼 자동화**: 반복적인 데이터 입력 작업
- **접근성 테스트**: 웹 접근성 검증

### Context7 MCP
- **AI 대화 최적화**: 긴 대화 세션의 메모리 효율성
- **컨텍스트 압축**: 중요 정보만 유지하면서 메모리 절약
- **장기 세션 지원**: 연속적인 작업 흐름 유지

### Sequential Thinking MCP
- **복잡한 작업 분해**: 큰 작업을 작은 단계로 나누기
- **논리적 추론**: 체계적인 문제 해결 과정
- **작업 계획 수립**: 단계별 실행 계획 생성

## 🚨 주의사항

1. **의존성 관리**: 각 MCP 서버는 자체 `node_modules`를 가지고 있습니다.
2. **ES 모듈**: Context7과 Sequential Thinking MCP는 ES 모듈 형식입니다.
3. **권한**: 일부 기능은 적절한 권한이 필요할 수 있습니다.
4. **환경 변수**: Playwright MCP는 `PLAYWRIGHT_BROWSERS_PATH` 환경 변수를 사용합니다.

## 🔄 업데이트

### MCP 서버 업데이트
```bash
# Playwright MCP
npm update @playwright/mcp

# Context7 MCP (소스에서 재빌드)
git clone https://github.com/upstash/context7.git temp-context7
cd temp-context7 && npm install && npm run build
cp -r dist/* ../src/lib/mcp-servers/context7/
cp -r node_modules ../src/lib/mcp-servers/context7/

# Sequential Thinking MCP (소스에서 재빌드)
git clone https://github.com/modelcontextprotocol/servers.git temp-servers
cd temp-servers/src/sequentialthinking && npm install && npm run build
cp -r dist/* ../../../src/lib/mcp-servers/sequential-thinking/
```

## 📚 추가 리소스

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Context7](https://github.com/upstash/context7)
- [MCP Servers](https://github.com/modelcontextprotocol/servers)

## 🆘 문제 해결

### 일반적인 문제들

1. **모듈을 찾을 수 없음**: `node_modules` 디렉토리가 올바르게 복사되었는지 확인
2. **ES 모듈 오류**: `.mjs` 확장자 사용 확인
3. **권한 오류**: 실행 권한 확인 (`chmod +x`)
4. **의존성 충돌**: 각 서버의 `package.json` 확인

### 로그 확인
```bash
# 상세한 오류 정보
node --trace-warnings src/lib/mcp-servers/[server-name]/index.mjs

# 디버그 모드
DEBUG=* node src/lib/mcp-servers/[server-name]/index.mjs
```




