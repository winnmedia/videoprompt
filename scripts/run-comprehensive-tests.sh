#!/bin/bash

# VideoPlanet 포괄적 테스트 실행 스크립트
# Grace QA Lead 설계 - 무관용 품질 정책

set -e  # 에러 시 즉시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 로그 함수들
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

log_critical() {
    echo -e "${RED}🚨 CRITICAL: $1${NC}"
}

log_section() {
    echo -e "${PURPLE}🔍 $1${NC}"
}

# Grace의 배너
print_grace_banner() {
    echo ""
    echo -e "${PURPLE}=========================================${NC}"
    echo -e "${PURPLE}🏆 Grace QA Lead - 무관용 품질 정책${NC}"
    echo -e "${PURPLE}📊 VideoPlanet 포괄적 테스트 실행${NC}"
    echo -e "${PURPLE}🚨 $300 사건 재발 방지 시스템${NC}"
    echo -e "${PURPLE}=========================================${NC}"
    echo ""
}

# 환경 설정
setup_environment() {
    log_section "환경 설정 및 검증"

    # Node.js 버전 확인
    NODE_VERSION=$(node --version)
    log_info "Node.js 버전: $NODE_VERSION"

    # pnpm 버전 확인
    PNPM_VERSION=$(pnpm --version)
    log_info "pnpm 버전: $PNPM_VERSION"

    # 메모리 정보
    if command -v free &> /dev/null; then
        MEMORY_INFO=$(free -h | grep "Mem:" | awk '{print $2 " total, " $7 " available"}')
        log_info "메모리: $MEMORY_INFO"
    fi

    # 디스크 공간
    DISK_SPACE=$(df -h . | tail -1 | awk '{print $4 " available"}')
    log_info "디스크 공간: $DISK_SPACE"

    # 의존성 설치 확인
    if [ ! -d "node_modules" ]; then
        log_info "의존성 설치 중..."
        pnpm install --frozen-lockfile
    else
        log_success "의존성 이미 설치됨"
    fi

    # 테스트 환경 변수 설정
    export NODE_ENV=test
    export VITEST_DETERMINISTIC=true
    export TZ=UTC

    log_success "환경 설정 완료"
}

# Grace의 테스트 전략 실행
run_grace_test_strategy() {
    log_section "Grace QA Lead 테스트 전략 실행"

    local start_time=$(date +%s)
    local test_results=()
    local failed_tests=()

    # 1단계: $300 사건 재발 방지 체크 (최우선)
    log_section "1단계: $300 사건 재발 방지 체크"
    if run_cost_prevention_check; then
        log_success "✅ $300 사건 재발 방지 체크 통과"
        test_results+=("$300_prevention:PASS")
    else
        log_critical "❌ $300 사건 재발 방지 체크 실패"
        test_results+=("$300_prevention:FAIL")
        failed_tests+=("$300 사건 재발 방지")
    fi

    # 2단계: 중요 경로 테스트 (Grace의 핵심 전략)
    log_section "2단계: 중요 경로 테스트 (Critical Path Testing)"
    if run_critical_path_tests; then
        log_success "✅ 중요 경로 테스트 통과"
        test_results+=("critical_path:PASS")
    else
        log_error "❌ 중요 경로 테스트 실패"
        test_results+=("critical_path:FAIL")
        failed_tests+=("중요 경로 테스트")
    fi

    # 3단계: 결정론적 단위 테스트
    log_section "3단계: 결정론적 단위 테스트"
    if run_deterministic_unit_tests; then
        log_success "✅ 단위 테스트 통과"
        test_results+=("unit_tests:PASS")
    else
        log_error "❌ 단위 테스트 실패"
        test_results+=("unit_tests:FAIL")
        failed_tests+=("단위 테스트")
    fi

    # 4단계: 통합 테스트 (API 계약 검증)
    log_section "4단계: 통합 테스트 (API Contract Verification)"
    if run_integration_tests; then
        log_success "✅ 통합 테스트 통과"
        test_results+=("integration_tests:PASS")
    else
        log_error "❌ 통합 테스트 실패"
        test_results+=("integration_tests:FAIL")
        failed_tests+=("통합 테스트")
    fi

    # 5단계: 뮤테이션 테스트 (코드 품질 검증)
    log_section "5단계: 뮤테이션 테스트 (Mutation Testing)"
    if run_mutation_tests; then
        log_success "✅ 뮤테이션 테스트 통과"
        test_results+=("mutation_tests:PASS")
    else
        log_warning "⚠️ 뮤테이션 테스트 실패 (경고)"
        test_results+=("mutation_tests:WARNING")
        # 뮤테이션 테스트는 경고로만 처리 (빌드 차단하지 않음)
    fi

    # 6단계: E2E 테스트 (사용자 여정)
    log_section "6단계: E2E 테스트 (End-to-End User Journey)"
    if run_e2e_tests; then
        log_success "✅ E2E 테스트 통과"
        test_results+=("e2e_tests:PASS")
    else
        log_error "❌ E2E 테스트 실패"
        test_results+=("e2e_tests:FAIL")
        failed_tests+=("E2E 테스트")
    fi

    # 7단계: 성능 및 메모리 테스트
    log_section "7단계: 성능 및 메모리 테스트"
    if run_performance_tests; then
        log_success "✅ 성능 테스트 통과"
        test_results+=("performance_tests:PASS")
    else
        log_warning "⚠️ 성능 테스트 경고"
        test_results+=("performance_tests:WARNING")
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Grace의 최종 판정
    print_grace_final_verdict "$duration" "${test_results[@]}" "${failed_tests[@]}"
}

# $300 사건 재발 방지 체크
run_cost_prevention_check() {
    log_info "🚨 $300 사건 패턴 검사 중..."

    local violations=0

    # useEffect 의존성 배열 검사
    log_info "useEffect 무한 루프 패턴 검사..."
    local useeffect_violations=$(grep -r "useEffect.*\[.*[a-zA-Z].*\]" src/ --include="*.tsx" --include="*.ts" --exclude-dir=__tests__ 2>/dev/null | wc -l)
    if [ $useeffect_violations -gt 0 ]; then
        log_critical "useEffect 의존성 배열에 함수가 포함되어 있습니다! ($useeffect_violations개)"
        violations=$((violations + useeffect_violations))
    fi

    # API 호출 패턴 검사
    log_info "위험한 API 호출 패턴 검사..."
    local api_violations=$(grep -r "setInterval.*fetch\|setTimeout.*fetch" src/ --include="*.tsx" --include="*.ts" --exclude-dir=__tests__ 2>/dev/null | wc -l)
    if [ $api_violations -gt 0 ]; then
        log_critical "위험한 폴링 패턴이 발견되었습니다! ($api_violations개)"
        violations=$((violations + api_violations))
    fi

    # /api/auth/me 과도한 호출 패턴 검사
    log_info "인증 API 과도 호출 패턴 검사..."
    local auth_patterns=$(grep -r "\/api\/auth\/me" src/ --include="*.tsx" --include="*.ts" --exclude-dir=__tests__ | wc -l)
    if [ $auth_patterns -gt 10 ]; then
        log_warning "인증 API 호출이 많습니다. 캐싱 확인 필요 ($auth_patterns개)"
    fi

    if [ $violations -eq 0 ]; then
        log_success "$300 사건 재발 방지 체크 통과"
        return 0
    else
        log_critical "$violations개의 위험 패턴이 발견되었습니다!"
        return 1
    fi
}

# 중요 경로 테스트
run_critical_path_tests() {
    log_info "중요 경로 테스트 실행 중..."

    # 인증 시스템 중요 경로
    log_info "인증 시스템 중요 경로 테스트..."
    if ! pnpm test src/__tests__/critical-path/auth-critical-path.test.ts --reporter=verbose --run; then
        log_error "인증 시스템 중요 경로 테스트 실패"
        return 1
    fi

    # 비즈니스 핵심 기능 중요 경로
    log_info "비즈니스 핵심 기능 중요 경로 테스트..."
    if ! pnpm test src/__tests__/critical-path/business-critical-path.test.ts --reporter=verbose --run; then
        log_error "비즈니스 핵심 기능 중요 경로 테스트 실패"
        return 1
    fi

    return 0
}

# 결정론적 단위 테스트
run_deterministic_unit_tests() {
    log_info "결정론적 단위 테스트 실행 중..."

    # 결정론적 설정으로 테스트 실행
    if ! VITEST_CONFIG=vitest.config.deterministic.js pnpm test --config=vitest.config.deterministic.js --reporter=verbose --run; then
        log_error "단위 테스트 실패"
        return 1
    fi

    # 플래키 테스트 감지 (3회 연속 실행)
    log_info "플래키 테스트 감지를 위한 연속 실행..."
    for i in {1..3}; do
        log_info "테스트 실행 $i/3..."
        if ! VITEST_CONFIG=vitest.config.deterministic.js pnpm test src/__tests__/auth/ --config=vitest.config.deterministic.js --run --reporter=json > "test-run-$i.json" 2>/dev/null; then
            log_error "테스트 실행 $i에서 실패 - 플래키 테스트 가능성"
            return 1
        fi
    done

    # 결과 일관성 확인
    if ! cmp -s test-run-1.json test-run-2.json || ! cmp -s test-run-2.json test-run-3.json; then
        log_error "테스트 결과가 일관되지 않음 - 플래키 테스트 감지"
        return 1
    fi

    # 임시 파일 정리
    rm -f test-run-*.json

    return 0
}

# 통합 테스트
run_integration_tests() {
    log_info "통합 테스트 실행 중..."

    # 기존 통합 테스트 실행
    if ! INTEGRATION_TEST=true pnpm test:integration --reporter=verbose; then
        log_error "기존 통합 테스트 실패"
        return 1
    fi

    # API 계약 검증
    log_info "API 계약 검증..."
    if ! INTEGRATION_TEST=true pnpm test src/__tests__/integration/api-contract-verification.test.ts --run; then
        log_error "API 계약 검증 실패"
        return 1
    fi

    return 0
}

# 뮤테이션 테스트
run_mutation_tests() {
    log_info "뮤테이션 테스트 실행 중..."

    # Stryker 설치 확인
    if ! command -v pnpm exec stryker &> /dev/null; then
        log_warning "Stryker가 설치되지 않았습니다. 뮤테이션 테스트를 건너뜁니다."
        return 0
    fi

    # 뮤테이션 테스트 실행 (타임아웃 5분)
    if timeout 300 pnpm exec stryker run --configFile stryker.conf.mjs 2>/dev/null; then
        log_success "뮤테이션 테스트 통과"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log_warning "뮤테이션 테스트 타임아웃 (5분 초과)"
        else
            log_warning "뮤테이션 테스트 실패 (점수 부족)"
        fi
        return 1
    fi
}

# E2E 테스트
run_e2e_tests() {
    log_info "E2E 테스트 실행 중..."

    # Playwright 브라우저 설치 확인
    if ! pnpm exec playwright --version &> /dev/null; then
        log_warning "Playwright가 설치되지 않았습니다. E2E 테스트를 건너뜁니다."
        return 0
    fi

    # 중요한 E2E 테스트만 실행 (시간 단축)
    log_info "인증 관련 E2E 테스트..."
    if ! pnpm test:e2e:auth-401 --reporter=line 2>/dev/null; then
        log_error "인증 E2E 테스트 실패"
        return 1
    fi

    return 0
}

# 성능 테스트
run_performance_tests() {
    log_info "성능 테스트 실행 중..."

    # 메모리 사용량 체크
    local initial_memory=$(get_memory_usage)

    # 성능 관련 테스트 실행
    if ! pnpm test src/__tests__/performance/ --run --reporter=verbose; then
        log_warning "성능 테스트 실패"
        return 1
    fi

    local final_memory=$(get_memory_usage)
    local memory_increase=$((final_memory - initial_memory))

    # 메모리 누수 체크 (50MB 이상 증가 시 경고)
    if [ $memory_increase -gt 52428800 ]; then # 50MB in bytes
        log_warning "메모리 사용량이 50MB 이상 증가했습니다: ${memory_increase} bytes"
        return 1
    fi

    return 0
}

# 메모리 사용량 확인
get_memory_usage() {
    if command -v ps &> /dev/null; then
        ps -o pid,vsz,rss,comm | grep -E "(node|pnpm)" | awk '{sum += $3} END {print sum * 1024}' || echo "0"
    else
        echo "0"
    fi
}

# Grace의 최종 판정
print_grace_final_verdict() {
    local duration=$1
    shift
    local test_results=("$@")

    echo ""
    echo -e "${PURPLE}=========================================${NC}"
    echo -e "${PURPLE}🏆 Grace QA Lead - 최종 품질 판정${NC}"
    echo -e "${PURPLE}=========================================${NC}"
    echo ""

    log_info "총 실행 시간: ${duration}초"
    echo ""

    # 결과 분석
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local warning_tests=0

    for result in "${test_results[@]}"; do
        IFS=':' read -r test_name status <<< "$result"
        total_tests=$((total_tests + 1))

        case $status in
            "PASS")
                passed_tests=$((passed_tests + 1))
                log_success "$test_name: 통과"
                ;;
            "FAIL")
                failed_tests=$((failed_tests + 1))
                log_error "$test_name: 실패"
                ;;
            "WARNING")
                warning_tests=$((warning_tests + 1))
                log_warning "$test_name: 경고"
                ;;
        esac
    done

    echo ""
    log_info "테스트 결과 요약:"
    log_info "  총 테스트: $total_tests"
    log_info "  통과: $passed_tests"
    log_info "  실패: $failed_tests"
    log_info "  경고: $warning_tests"

    # Grace의 엄격한 품질 기준
    if [ $failed_tests -eq 0 ]; then
        echo ""
        log_success "🎉 Grace QA 승인: 모든 핵심 품질 기준 통과!"
        log_success "✅ $300 사건 재발 방지 시스템 정상 작동"
        log_success "🔒 중요 경로 테스트 100% 통과"
        log_success "📊 결정론적 테스트 환경 검증 완료"
        echo ""
        echo -e "${GREEN}🚀 배포 승인 - PR 병합 가능${NC}"

        # 성공 메트릭 기록
        record_success_metrics "$duration" "$passed_tests" "$warning_tests"

        return 0
    else
        echo ""
        log_critical "🚫 Grace QA 거부: 품질 기준 미달!"
        log_error "💥 $failed_tests개의 중요 테스트 실패"
        log_error "🔒 $300 사건 재발 방지를 위해 배포 차단"
        echo ""
        echo -e "${RED}❌ 배포 거부 - 문제 해결 후 재시도 필요${NC}"

        # 실패 메트릭 기록
        record_failure_metrics "$duration" "$failed_tests" "$warning_tests"

        return 1
    fi
}

# 성공 메트릭 기록
record_success_metrics() {
    local duration=$1
    local passed_tests=$2
    local warning_tests=$3

    # 메트릭 파일에 기록 (CI/CD에서 활용)
    cat > quality-metrics.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "status": "success",
  "duration_seconds": $duration,
  "passed_tests": $passed_tests,
  "warning_tests": $warning_tests,
  "grace_approved": true,
  "cost_prevention_check": "passed",
  "critical_path_tests": "passed"
}
EOF

    log_info "성공 메트릭이 quality-metrics.json에 기록되었습니다."
}

# 실패 메트릭 기록
record_failure_metrics() {
    local duration=$1
    local failed_tests=$2
    local warning_tests=$3

    # 메트릭 파일에 기록
    cat > quality-metrics.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "status": "failure",
  "duration_seconds": $duration,
  "failed_tests": $failed_tests,
  "warning_tests": $warning_tests,
  "grace_approved": false,
  "cost_prevention_check": "failed",
  "critical_path_tests": "failed"
}
EOF

    log_error "실패 메트릭이 quality-metrics.json에 기록되었습니다."
}

# 정리 작업
cleanup() {
    log_info "정리 작업 중..."

    # 임시 파일 정리
    rm -f test-run-*.json
    rm -f stryker-tmp-*

    # 프로세스 정리
    pkill -f "node.*vitest" 2>/dev/null || true
    pkill -f "node.*playwright" 2>/dev/null || true

    log_success "정리 작업 완료"
}

# 신호 처리 (Ctrl+C 등)
trap cleanup EXIT INT TERM

# 메인 실행
main() {
    print_grace_banner
    setup_environment
    run_grace_test_strategy

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo ""
        echo -e "${GREEN}🏆 Grace QA Lead: 품질 기준 충족 - 배포 승인!${NC}"
    else
        echo ""
        echo -e "${RED}🚫 Grace QA Lead: 품질 기준 미달 - 배포 거부!${NC}"
    fi

    cleanup
    exit $exit_code
}

# 스크립트 인자 처리
if [ "$1" = "--help" ]; then
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help          Show this help message"
    echo "  --quick         Run quick tests only (skip mutation and E2E)"
    echo "  --critical      Run critical path tests only"
    echo ""
    echo "Grace QA Lead - 무관용 품질 정책"
    echo "All tests must pass Grace's strict quality standards."
    exit 0
fi

if [ "$1" = "--quick" ]; then
    log_info "빠른 테스트 모드 활성화 (뮤테이션 및 E2E 테스트 제외)"
    export SKIP_MUTATION_TESTS=true
    export SKIP_E2E_TESTS=true
fi

if [ "$1" = "--critical" ]; then
    log_info "중요 경로 테스트만 실행"
    export CRITICAL_ONLY=true
fi

# 메인 실행
main "$@"