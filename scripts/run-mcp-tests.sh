#!/bin/bash

# MCP 서버들을 활용한 테스트 실행 스크립트
# 이 스크립트는 MCP 서버들이 정상 작동하는지 확인하고 테스트를 실행합니다.

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

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")/.."

echo "🚀 MCP Enhanced Testing 시작"
echo "================================"

# 1단계: MCP 서버 상태 확인
log_step "1단계: MCP 서버 상태 확인"
if npm run test:mcp > /dev/null 2>&1; then
    log_success "모든 MCP 서버가 정상 작동합니다"
else
    log_error "일부 MCP 서버에 문제가 있습니다"
    log_info "MCP 서버 상태를 수동으로 확인해보세요: npm run test:mcp"
    exit 1
fi

# 2단계: 기본 테스트 실행
log_step "2단계: 기본 MCP 테스트 실행"
if npm test -- src/__tests__/mcp-enhanced-testing.test.ts; then
    log_success "기본 MCP 테스트가 성공했습니다"
else
    log_warning "기본 MCP 테스트에 일부 실패가 있습니다"
fi

# 3단계: 실제 MCP 서버 연동 테스트 실행
log_step "3단계: 실제 MCP 서버 연동 테스트 실행"
log_info "이 테스트는 실제 MCP 서버들과 연동하여 실행됩니다"
log_info "테스트 실행 시간이 오래 걸릴 수 있습니다"

# 개발 서버가 실행 중인지 확인
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    log_warning "개발 서버가 실행되지 않았습니다. 테스트를 건너뜁니다"
    log_info "개발 서버를 시작하려면: npm run dev"
else
    log_info "개발 서버가 실행 중입니다. 실제 연동 테스트를 시작합니다"
    
    if npm test -- src/__tests__/mcp-real-integration.test.ts; then
        log_success "실제 MCP 서버 연동 테스트가 성공했습니다"
    else
        log_warning "실제 MCP 서버 연동 테스트에 일부 실패가 있습니다"
    fi
fi

# 4단계: 실제 웹서비스 테스트 실행
log_step "4단계: 실제 웹서비스 테스트 실행"
log_info "이 테스트는 프로젝트의 실제 페이지들을 테스트합니다"

if npm test -- src/__tests__/mcp-real-website.test.ts; then
    log_success "실제 웹서비스 테스트가 성공했습니다"
else
    log_warning "실제 웹서비스 테스트에 일부 실패가 있습니다"
fi

# 5단계: MCP 성능 테스트 실행
log_step "5단계: MCP 성능 테스트 실행"
log_info "이 테스트는 MCP 서버들의 성능과 부하를 테스트합니다"

if npm test -- src/__tests__/mcp-performance.test.ts; then
    log_success "MCP 성능 테스트가 성공했습니다"
else
    log_warning "MCP 성능 테스트에 일부 실패가 있습니다"
fi

# 6단계: 테스트 결과 요약
log_step "6단계: 테스트 결과 요약"

# 테스트 커버리지 확인
if [ -f "coverage/lcov-report/index.html" ]; then
    log_info "테스트 커버리지 리포트가 생성되었습니다: coverage/lcov-report/index.html"
fi

# 테스트 결과 파일 확인
if [ -f "test-results" ]; then
    log_info "테스트 결과가 저장되었습니다: test-results/"
fi

echo ""
echo "================================"
log_success "MCP Enhanced Testing 완료!"
echo ""
echo "📊 다음 명령어로 테스트를 실행할 수 있습니다:"
echo "   npm test -- src/__tests__/mcp-enhanced-testing.test.ts"
echo "   npm test -- src/__tests__/mcp-real-integration.test.ts"
echo "   npm test -- src/__tests__/mcp-real-website.test.ts"
echo "   npm test -- src/__tests__/mcp-performance.test.ts"
echo ""
echo "🚀 통합 테스트 실행:"
echo "   npm run test:mcp:ci"
echo ""
echo "🔧 MCP 서버 상태 확인:"
echo "   npm run test:mcp"
echo ""
echo "📚 자세한 내용은 MCP_SERVERS_README.md를 참조하세요"
