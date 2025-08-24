#!/bin/bash

# MCP 개발 환경 설정 스크립트
# 팀원들이 쉽게 MCP 테스트 환경을 구축할 수 있도록 도와주는 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${BLUE}🔧 $1${NC}"
}

echo "🚀 MCP 개발 환경 설정 시작"
echo "================================"

# 1단계: 시스템 요구사항 확인
log_step "1단계: 시스템 요구사항 확인"

# Node.js 버전 확인
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_info "Node.js 버전: $NODE_VERSION"
    
    # Node.js 18 이상 확인
    if [[ "$NODE_VERSION" < "v18" ]]; then
        log_error "Node.js 18 이상이 필요합니다. 현재 버전: $NODE_VERSION"
        exit 1
    fi
else
    log_error "Node.js가 설치되지 않았습니다."
    exit 1
fi

# npm 버전 확인
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    log_info "npm 버전: $NPM_VERSION"
else
    log_error "npm이 설치되지 않았습니다."
    exit 1
fi

log_success "시스템 요구사항 확인 완료"

# 2단계: 프로젝트 의존성 설치
log_step "2단계: 프로젝트 의존성 설치"

if [ -f "package.json" ]; then
    log_info "package.json 발견. 의존성을 설치합니다..."
    npm install
    log_success "의존성 설치 완료"
else
    log_error "package.json 파일을 찾을 수 없습니다. 프로젝트 루트에서 실행하세요."
    exit 1
fi

# 3단계: Playwright 브라우저 설치
log_step "3단계: Playwright 브라우저 설치"

log_info "Playwright 브라우저를 설치합니다..."
npx playwright install --with-deps

if [ $? -eq 0 ]; then
    log_success "Playwright 브라우저 설치 완료"
else
    log_warning "Playwright 브라우저 설치에 문제가 있을 수 있습니다."
fi

# 4단계: 환경 변수 설정
log_step "4단계: 환경 변수 설정"

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
    log_info "$ENV_FILE 파일을 생성합니다..."
    cat > "$ENV_FILE" << EOF
# MCP 테스트 환경 변수
MCP_PERFORMANCE_TEST=true
MCP_LOAD_TEST=false
PLAYWRIGHT_BROWSERS_PATH=0
NODE_OPTIONS="--max-old-space-size=4096"

# MCP 서버 설정
MCP_SERVER_TIMEOUT=30000
MCP_CONTEXT_CLEANUP_INTERVAL=20
MCP_MAX_CONTEXTS=100

# 개발 환경 설정
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF
    log_success "$ENV_FILE 파일 생성 완료"
else
    log_info "$ENV_FILE 파일이 이미 존재합니다."
    
    # 필요한 환경 변수가 있는지 확인
    if ! grep -q "MCP_PERFORMANCE_TEST" "$ENV_FILE"; then
        log_info "MCP 관련 환경 변수를 추가합니다..."
        cat >> "$ENV_FILE" << EOF

# MCP 테스트 환경 변수 (자동 추가)
MCP_PERFORMANCE_TEST=true
MCP_LOAD_TEST=false
PLAYWRIGHT_BROWSERS_PATH=0
NODE_OPTIONS="--max-old-space-size=4096"

# MCP 서버 설정
MCP_SERVER_TIMEOUT=30000
MCP_CONTEXT_CLEANUP_INTERVAL=20
MCP_MAX_CONTEXTS=100
EOF
        log_success "MCP 환경 변수 추가 완료"
    fi
fi

# 5단계: VS Code 설정 (선택사항)
log_step "5단계: VS Code 설정 (선택사항)"

if command -v code &> /dev/null; then
    log_info "VS Code가 설치되어 있습니다. 프로젝트 설정을 구성합니다..."
    
    # .vscode 디렉토리 생성
    mkdir -p .vscode
    
    # settings.json 생성
    cat > .vscode/settings.json << EOF
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "vitest.enable": true,
  "vitest.commandLine": "npm test",
  "files.associations": {
    "*.test.ts": "typescript"
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
EOF
    
    # tasks.json 생성
    cat > .vscode/tasks.json << EOF
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
    },
    {
      "label": "개발 서버 시작",
      "type": "shell",
      "command": "npm run dev",
      "group": "build",
      "isBackground": true,
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      }
    }
  ]
}
EOF
    
    log_success "VS Code 설정 완료"
else
    log_info "VS Code가 설치되지 않았습니다. 건너뜁니다."
fi

# 6단계: MCP 서버 상태 확인
log_step "6단계: MCP 서버 상태 확인"

log_info "MCP 서버 상태를 확인합니다..."
if npm run test:mcp > /dev/null 2>&1; then
    log_success "모든 MCP 서버가 정상 작동합니다"
else
    log_warning "일부 MCP 서버에 문제가 있을 수 있습니다. 수동으로 확인해보세요: npm run test:mcp"
fi

# 7단계: 기본 테스트 실행
log_step "7단계: 기본 테스트 실행"

log_info "기본 MCP 테스트를 실행합니다..."
if npm run test:mcp:enhanced > /dev/null 2>&1; then
    log_success "기본 MCP 테스트가 성공했습니다"
else
    log_warning "기본 MCP 테스트에 문제가 있을 수 있습니다. 수동으로 확인해보세요: npm run test:mcp:enhanced"
fi

# 8단계: Git 훅 설정 (선택사항)
log_step "8단계: Git 훅 설정 (선택사항)"

if [ -d ".git" ]; then
    log_info "Git 저장소가 감지되었습니다. Husky 설정을 확인합니다..."
    
    if command -v husky &> /dev/null; then
        log_info "Husky가 설치되어 있습니다. Git 훅을 설정합니다..."
        
        # pre-commit 훅 생성
        mkdir -p .husky
        cat > .husky/pre-commit << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 MCP 서버 상태 확인 중..."
npm run test:mcp

if [ $? -ne 0 ]; then
  echo "❌ MCP 서버 상태 확인 실패. 커밋을 중단합니다."
  exit 1
fi

echo "🧪 기본 MCP 테스트 실행 중..."
npm run test:mcp:enhanced

if [ $? -ne 0 ]; then
  echo "❌ MCP 테스트 실패. 커밋을 중단합니다."
  exit 1
fi

echo "✅ 모든 MCP 테스트 통과. 커밋을 진행합니다."
EOF
        
        chmod +x .husky/pre-commit
        log_success "Git pre-commit 훅 설정 완료"
    else
        log_info "Husky가 설치되지 않았습니다. Git 훅 설정을 건너뜁니다."
    fi
else
    log_info "Git 저장소가 아닙니다. Git 훅 설정을 건너뜁니다."
fi

# 완료 메시지
echo ""
echo "================================"
log_success "MCP 개발 환경 설정 완료!"
echo ""
echo "📊 다음 명령어로 MCP 테스트를 실행할 수 있습니다:"
echo "   npm run test:mcp                # MCP 서버 상태 확인"
echo "   npm run test:mcp:enhanced       # 기본 MCP 테스트"
echo "   npm run test:mcp:integration    # 실제 MCP 연동 테스트"
echo "   npm run test:mcp:website        # 웹사이트 MCP 테스트"
echo "   npm run test:mcp:performance    # MCP 성능 테스트"
echo "   npm run test:mcp:ci             # 모든 MCP 테스트"
echo ""
echo "🔧 개발 서버 시작:"
echo "   npm run dev"
echo ""
echo "📚 자세한 내용은 MCP_DEVELOPER_GUIDE.md를 참조하세요"
echo ""
echo "🎉 이제 MCP 테스트를 활용한 개발을 시작할 수 있습니다!"

