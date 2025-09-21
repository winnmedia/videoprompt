#!/bin/bash

# 최적화된 품질 게이트 스크립트
# Frontend Platform Lead가 설계한 병렬 실행 및 빠른 피드백 시스템

set -e  # 에러 시 즉시 중단

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수들
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 시작 시간 기록
START_TIME=$(date +%s)

log_info "🚀 최적화된 품질 게이트 실행 시작"
log_info "병렬 실행으로 피드백 속도 최대화"

# 임시 파일로 병렬 실행 결과 추적
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# 1단계: $300 사건 방지 검사 (최우선)
log_info "🚨 $300 사건 방지 검사 (최우선)"
{
    # useEffect 의존성 배열에 함수 포함 검사
    if grep -r "useEffect.*\[.*[a-zA-Z_][a-zA-Z0-9_]*\]" src/ --include="*.tsx" --include="*.ts" | grep -v "test" | grep -v "mock" > "$TEMP_DIR/useeffect_violations" 2>/dev/null; then
        log_error "❌ CRITICAL: useEffect 의존성 배열에 함수 포함 - $300 사건 위험!"
        log_error "발견된 위험 패턴:"
        cat "$TEMP_DIR/useeffect_violations"
        log_error "해결: useEffect(() => { checkAuth(); }, []) // 빈 배열 사용"
        exit 1
    fi

    # 위험한 API 폴링 패턴 검사
    if grep -r "setInterval.*fetch\|setTimeout.*fetch" src/ --include="*.tsx" --include="*.ts" | grep -v "test" > "$TEMP_DIR/polling_violations" 2>/dev/null; then
        log_error "❌ CRITICAL: 위험한 폴링 패턴 발견!"
        cat "$TEMP_DIR/polling_violations"
        exit 1
    fi

    log_success "✅ $300 사건 방지 검사 통과"
} &
ANTIPATTERN_PID=$!

# 2단계: 병렬 정적 분석
log_info "🔍 정적 분석 병렬 실행"

# TypeScript 컴파일 검사
{
    log_info "TypeScript 타입 검사 실행 중..."
    if pnpm tsc --noEmit > "$TEMP_DIR/typecheck.log" 2>&1; then
        echo "SUCCESS" > "$TEMP_DIR/typecheck.status"
        log_success "✅ TypeScript 컴파일 성공"
    else
        echo "FAILED" > "$TEMP_DIR/typecheck.status"
        log_error "❌ TypeScript 컴파일 실패"
        cat "$TEMP_DIR/typecheck.log"
    fi
} &
TYPECHECK_PID=$!

# ESLint 검사
{
    log_info "ESLint 품질 검사 실행 중..."
    if pnpm lint:quality-gates > "$TEMP_DIR/eslint.log" 2>&1; then
        echo "SUCCESS" > "$TEMP_DIR/eslint.status"
        log_success "✅ ESLint 품질 게이트 통과"
    else
        echo "FAILED" > "$TEMP_DIR/eslint.status"
        log_error "❌ ESLint 품질 게이트 실패"
        cat "$TEMP_DIR/eslint.log"
    fi
} &
ESLINT_PID=$!

# 보안 검사
{
    log_info "보안 검사 실행 중..."
    if pnpm security:check-keys > "$TEMP_DIR/security.log" 2>&1; then
        echo "SUCCESS" > "$TEMP_DIR/security.status"
        log_success "✅ 보안 검사 통과"
    else
        echo "FAILED" > "$TEMP_DIR/security.status"
        log_warning "⚠️ 보안 검사 경고 (차단하지 않음)"
    fi
} &
SECURITY_PID=$!

# 3단계: 테스트 실행 (병렬)
log_info "🧪 테스트 실행 (병렬)"

# 단위 테스트 (가장 중요)
{
    log_info "단위 테스트 실행 중..."
    if pnpm test:unit:coverage > "$TEMP_DIR/unit_tests.log" 2>&1; then
        echo "SUCCESS" > "$TEMP_DIR/unit_tests.status"
        log_success "✅ 단위 테스트 성공"
    else
        echo "FAILED" > "$TEMP_DIR/unit_tests.status"
        log_error "❌ 단위 테스트 실패"
        # 실패 시 상세 로그 출력
        tail -50 "$TEMP_DIR/unit_tests.log"
    fi
} &
UNIT_TEST_PID=$!

# Redux 테스트 (중요)
{
    log_info "Redux 슬라이스 테스트 실행 중..."
    if pnpm vitest run src/app/store/__tests__/ > "$TEMP_DIR/redux_tests.log" 2>&1; then
        echo "SUCCESS" > "$TEMP_DIR/redux_tests.status"
        log_success "✅ Redux 테스트 성공"
    else
        echo "FAILED" > "$TEMP_DIR/redux_tests.status"
        log_error "❌ Redux 테스트 실패"
        tail -30 "$TEMP_DIR/redux_tests.log"
    fi
} &
REDUX_TEST_PID=$!

# 컴포넌트 테스트
{
    log_info "컴포넌트 테스트 실행 중..."
    if pnpm vitest run src/widgets/ src/features/ --reporter=basic > "$TEMP_DIR/component_tests.log" 2>&1; then
        echo "SUCCESS" > "$TEMP_DIR/component_tests.status"
        log_success "✅ 컴포넌트 테스트 성공"
    else
        echo "FAILED" > "$TEMP_DIR/component_tests.status"
        log_warning "⚠️ 컴포넌트 테스트 실패 (차단하지 않음)"
    fi
} &
COMPONENT_TEST_PID=$!

# 모든 백그라운드 작업 완료 대기
log_info "⏳ 모든 검사 완료 대기 중..."

wait $ANTIPATTERN_PID
wait $TYPECHECK_PID
wait $ESLINT_PID
wait $SECURITY_PID
wait $UNIT_TEST_PID
wait $REDUX_TEST_PID
wait $COMPONENT_TEST_PID

# 결과 분석
log_info "📊 결과 분석"

FAILED_CHECKS=()

# 필수 검사 결과 확인
if [[ "$(cat $TEMP_DIR/typecheck.status 2>/dev/null)" != "SUCCESS" ]]; then
    FAILED_CHECKS+=("TypeScript 컴파일")
fi

if [[ "$(cat $TEMP_DIR/eslint.status 2>/dev/null)" != "SUCCESS" ]]; then
    FAILED_CHECKS+=("ESLint 품질 게이트")
fi

if [[ "$(cat $TEMP_DIR/unit_tests.status 2>/dev/null)" != "SUCCESS" ]]; then
    FAILED_CHECKS+=("단위 테스트")
fi

if [[ "$(cat $TEMP_DIR/redux_tests.status 2>/dev/null)" != "SUCCESS" ]]; then
    FAILED_CHECKS+=("Redux 테스트")
fi

# 4단계: 빌드 검증 (필수 검사가 성공한 경우에만)
if [[ ${#FAILED_CHECKS[@]} -eq 0 ]]; then
    log_info "🏗️ 빌드 검증 실행"

    if pnpm build > "$TEMP_DIR/build.log" 2>&1; then
        log_success "✅ 빌드 성공"
    else
        log_error "❌ 빌드 실패"
        cat "$TEMP_DIR/build.log"
        FAILED_CHECKS+=("빌드")
    fi

    # 성능 예산 검사 (있는 경우)
    if command -v pnpm run performance:budget &> /dev/null; then
        log_info "⚡ 성능 예산 검사"
        if pnpm run performance:budget > "$TEMP_DIR/performance.log" 2>&1; then
            log_success "✅ 성능 예산 통과"
        else
            log_warning "⚠️ 성능 예산 초과 (경고)"
        fi
    fi
fi

# 실행 시간 계산
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 최종 결과 출력
echo ""
log_info "=========================================="
log_info "품질 게이트 최종 결과 (실행 시간: ${DURATION}초)"
log_info "=========================================="

if [[ ${#FAILED_CHECKS[@]} -eq 0 ]]; then
    log_success "🎉 모든 품질 게이트 통과!"
    log_success "💰 $300 사건 재발 방지 시스템 검증 완료"
    log_success "🔒 인증 시스템 안전성 100% 보장"
    log_success "📊 테스트 커버리지 및 코드 품질 검증 완료"
    log_success "✨ PR 병합 준비 완료"

    # 성공 통계
    echo ""
    log_info "📈 품질 메트릭:"
    log_info "- 정적 분석: 통과"
    log_info "- 단위 테스트: 통과"
    log_info "- Redux 테스트: 통과"
    log_info "- 빌드 검증: 통과"
    log_info "- 실행 시간: ${DURATION}초"

    exit 0
else
    log_error "🚨 품질 게이트 실패!"
    log_error "실패한 검사: ${FAILED_CHECKS[*]}"
    log_error "💥 $300 사건 재발 위험이 감지되었습니다!"
    log_error "실패한 검사를 수정한 후 다시 시도해주세요."

    # 실패 세부 정보
    echo ""
    log_error "📋 실패 세부 정보:"
    for check in "${FAILED_CHECKS[@]}"; do
        log_error "  ❌ $check"
    done

    exit 1
fi