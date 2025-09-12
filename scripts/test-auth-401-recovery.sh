#!/bin/bash

# 401 인증 오류 해결 E2E 테스트 실행 스크립트
# VideoPlanet - Robert (Frontend Platform Lead)
# 
# 이 스크립트는 401 인증 오류 시나리오를 체계적으로 테스트하여
# 빌드 결정론성과 피드백 속도를 최대화합니다.

set -euo pipefail

# 스크립트 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_PORT=${TEST_PORT:-3100}
TEST_TIMEOUT=${TEST_TIMEOUT:-30000}

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 에러 핸들러
error_handler() {
    local line_no=$1
    log_error "스크립트가 라인 $line_no에서 실패했습니다."
    cleanup
    exit 1
}

trap 'error_handler $LINENO' ERR

# 정리 함수
cleanup() {
    log_info "정리 작업 중..."
    
    # 백그라운드 프로세스 종료
    if [[ -n "${APP_PID:-}" ]]; then
        log_info "애플리케이션 프로세스 종료 중 (PID: $APP_PID)"
        kill "$APP_PID" 2>/dev/null || true
        wait "$APP_PID" 2>/dev/null || true
    fi
    
    # 테스트 포트에서 실행 중인 프로세스 정리
    log_info "포트 $TEST_PORT 정리 중"
    lsof -ti:$TEST_PORT | xargs -r kill -9 2>/dev/null || true
    
    log_info "정리 완료"
}

# 종료 시 정리
trap cleanup EXIT INT TERM

# 의존성 확인
check_dependencies() {
    log_info "의존성 확인 중..."
    
    # Node.js 버전 확인
    if ! command -v node &> /dev/null; then
        log_error "Node.js가 설치되어 있지 않습니다."
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="20.0.0"
    
    if ! printf '%s\n%s\n' "$required_version" "$node_version" | sort -V -C; then
        log_error "Node.js 버전이 $required_version 이상이어야 합니다. 현재: v$node_version"
        exit 1
    fi
    
    # pnpm 확인
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm이 설치되어 있지 않습니다."
        exit 1
    fi
    
    # Playwright 브라우저 확인
    if ! pnpm exec playwright --version &> /dev/null; then
        log_warning "Playwright가 설치되어 있지 않습니다. 설치를 진행합니다."
        pnpm exec playwright install chromium
    fi
    
    log_success "의존성 확인 완료"
}

# 환경 변수 설정
setup_environment() {
    log_info "테스트 환경 설정 중..."
    
    export NODE_ENV=test
    export AUTH_TEST_MODE=true
    export JWT_SECRET="${JWT_SECRET:-test-secret-401-recovery-do-not-use-in-production}"
    export DATABASE_URL="${DATABASE_URL:-postgresql://test:test@localhost:5432/test}"
    export NEXT_PUBLIC_APP_URL="http://localhost:$TEST_PORT"
    export PW_BASE_URL="http://localhost:$TEST_PORT"
    
    log_info "환경 변수:"
    log_info "  NODE_ENV: $NODE_ENV"
    log_info "  TEST_PORT: $TEST_PORT"
    log_info "  DATABASE_URL: $DATABASE_URL"
    log_info "  NEXT_PUBLIC_APP_URL: $NEXT_PUBLIC_APP_URL"
    
    log_success "환경 설정 완료"
}

# 데이터베이스 준비
setup_database() {
    log_info "테스트 데이터베이스 설정 중..."
    
    # Prisma 생성 및 마이그레이션
    pnpm prisma:generate
    
    # 개발 환경에서는 db push 사용 (마이그레이션 파일 없을 경우)
    if [[ "${CI:-false}" == "true" ]]; then
        pnpm prisma migrate deploy
    else
        pnpm db:push || {
            log_warning "db:push 실패, migrate deploy 시도 중..."
            pnpm prisma migrate deploy || {
                log_error "데이터베이스 설정 실패"
                exit 1
            }
        }
    fi
    
    log_success "데이터베이스 설정 완료"
}

# 애플리케이션 빌드
build_application() {
    log_info "애플리케이션 빌드 중..."
    
    # TypeScript 타입 체크
    log_info "TypeScript 타입 체크 실행 중..."
    pnpm tsc --noEmit
    
    # 린트 체크
    log_info "ESLint 체크 실행 중..."
    pnpm lint --max-warnings=0
    
    # 빌드 실행
    log_info "Next.js 빌드 실행 중..."
    pnpm build
    
    log_success "애플리케이션 빌드 완료"
}

# 애플리케이션 시작
start_application() {
    log_info "테스트용 애플리케이션 시작 중... (포트: $TEST_PORT)"
    
    # 포트 정리
    lsof -ti:$TEST_PORT | xargs -r kill -9 2>/dev/null || true
    sleep 2
    
    # 애플리케이션 백그라운드 실행
    pnpm start --port $TEST_PORT &
    APP_PID=$!
    
    log_info "애플리케이션 PID: $APP_PID"
    
    # 애플리케이션 준비 대기
    log_info "애플리케이션 준비 대기 중..."
    local max_attempts=30
    local attempt=0
    
    while ! curl -sf "http://localhost:$TEST_PORT" > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [[ $attempt -gt $max_attempts ]]; then
            log_error "애플리케이션이 $max_attempts초 내에 시작되지 않았습니다."
            exit 1
        fi
        sleep 1
    done
    
    log_success "애플리케이션 시작 완료 (http://localhost:$TEST_PORT)"
}

# 헬스 체크
health_check() {
    log_info "애플리케이션 헬스 체크 실행 중..."
    
    # 기본 페이지 응답 확인
    if curl -sf "http://localhost:$TEST_PORT" > /dev/null; then
        log_success "기본 페이지 응답 정상"
    else
        log_error "기본 페이지 응답 실패"
        exit 1
    fi
    
    # API 엔드포인트 확인 (인증 불필요)
    if curl -sf "http://localhost:$TEST_PORT/api/health" > /dev/null 2>&1; then
        log_success "헬스 체크 API 응답 정상"
    else
        log_warning "헬스 체크 API 응답 없음 (선택사항)"
    fi
}

# 401 인증 테스트 실행
run_auth_tests() {
    log_info "401 인증 오류 E2E 테스트 실행 중..."
    
    local test_results_dir="$PROJECT_ROOT/test-results-auth-401"
    mkdir -p "$test_results_dir"
    
    # 테스트 실행 (상세 옵션 적용)
    local test_command="pnpm exec playwright test tests/e2e/auth-401-recovery.spec.ts"
    test_command="$test_command --output-dir=$test_results_dir"
    test_command="$test_command --reporter=list,html,json"
    test_command="$test_command --timeout=$TEST_TIMEOUT"
    test_command="$test_command --workers=1" # 인증 테스트는 순차 실행
    
    # CI 환경에서는 추가 옵션
    if [[ "${CI:-false}" == "true" ]]; then
        test_command="$test_command --reporter=github"
    fi
    
    # 디버그 모드
    if [[ "${DEBUG:-false}" == "true" ]]; then
        test_command="$test_command --debug"
    fi
    
    # 헤드리스 모드 (기본값)
    if [[ "${HEADED:-false}" != "true" ]]; then
        test_command="$test_command --headed=false"
    fi
    
    log_info "테스트 실행 명령어: $test_command"
    
    # 테스트 실행
    if eval "$test_command"; then
        log_success "401 인증 테스트 통과!"
        
        # 테스트 결과 요약
        if [[ -f "$test_results_dir/results.json" ]]; then
            log_info "테스트 결과 요약:"
            local passed=$(jq -r '.stats.expected // 0' "$test_results_dir/results.json")
            local failed=$(jq -r '.stats.unexpected // 0' "$test_results_dir/results.json")
            local skipped=$(jq -r '.stats.skipped // 0' "$test_results_dir/results.json")
            
            log_success "  통과: $passed"
            log_info "  실패: $failed"
            log_info "  건너뜀: $skipped"
        fi
        
    else
        log_error "401 인증 테스트 실패!"
        
        # 실패 시 디버그 정보 출력
        log_info "디버그 정보:"
        log_info "  테스트 결과 디렉토리: $test_results_dir"
        log_info "  애플리케이션 로그는 백그라운드에서 실행 중입니다."
        
        # 테스트 보고서가 있으면 경로 안내
        if [[ -f "$test_results_dir/playwright-report/index.html" ]]; then
            log_info "  HTML 보고서: file://$test_results_dir/playwright-report/index.html"
        fi
        
        return 1
    fi
}

# 성능 메트릭 수집
collect_performance_metrics() {
    log_info "성능 메트릭 수집 중..."
    
    local metrics_file="$PROJECT_ROOT/test-results-auth-401/performance-metrics.json"
    
    # 간단한 성능 메트릭 수집
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
        echo "  \"test_duration_seconds\": $SECONDS,"
        echo "  \"application_port\": $TEST_PORT,"
        echo "  \"node_version\": \"$(node --version)\","
        echo "  \"memory_usage\": {"
        echo "    \"rss\": \"$(ps -o rss= -p $APP_PID 2>/dev/null || echo 0) KB\""
        echo "  },"
        echo "  \"environment\": {"
        echo "    \"ci\": ${CI:-false},"
        echo "    \"node_env\": \"$NODE_ENV\""
        echo "  }"
        echo "}"
    } > "$metrics_file"
    
    log_success "성능 메트릭 수집 완료: $metrics_file"
}

# 메인 실행 함수
main() {
    log_info "=== 401 인증 오류 해결 E2E 테스트 시작 ==="
    log_info "시작 시각: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    log_info "프로젝트 루트: $PROJECT_ROOT"
    
    cd "$PROJECT_ROOT"
    
    # 단계별 실행
    check_dependencies
    setup_environment
    setup_database
    build_application
    start_application
    health_check
    run_auth_tests
    collect_performance_metrics
    
    log_success "=== 모든 테스트가 성공적으로 완료되었습니다! ==="
    log_info "완료 시각: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    log_info "총 실행 시간: $SECONDS초"
}

# 도움말
show_help() {
    cat << EOF
401 인증 오류 해결 E2E 테스트 스크립트

사용법: $0 [옵션]

옵션:
  --port PORT          테스트 포트 (기본값: 3100)
  --timeout TIMEOUT    테스트 타임아웃 (밀리초, 기본값: 30000)
  --headed             브라우저 GUI 모드로 실행
  --debug              디버그 모드로 실행
  --help               이 도움말 표시

환경 변수:
  TEST_PORT           테스트 포트 설정
  TEST_TIMEOUT        테스트 타임아웃 설정
  DEBUG               디버그 모드 (true/false)
  HEADED              헤드 모드 (true/false)
  CI                  CI 환경 여부 (true/false)
  JWT_SECRET          JWT 비밀키
  DATABASE_URL        데이터베이스 URL

예제:
  $0                                # 기본 실행
  $0 --port 3200 --headed          # 포트 3200, GUI 모드
  DEBUG=true $0                     # 디버그 모드
  HEADED=true $0 --timeout 60000    # GUI 모드, 60초 타임아웃

EOF
}

# 명령행 인자 처리
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            TEST_PORT="$2"
            shift 2
            ;;
        --timeout)
            TEST_TIMEOUT="$2"
            shift 2
            ;;
        --headed)
            export HEADED=true
            shift
            ;;
        --debug)
            export DEBUG=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "알 수 없는 옵션: $1"
            show_help
            exit 1
            ;;
    esac
done

# 메인 함수 실행
main "$@"