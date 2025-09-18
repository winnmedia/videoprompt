#!/bin/bash

# ============================================================================
# 🔒 Planning 이중 저장소 품질 게이트 스크립트
# CI/CD 파이프라인에서 Planning 데이터 계약과 품질을 검증
# ============================================================================

set -e  # 에러 발생 시 즉시 종료
set -u  # 정의되지 않은 변수 사용 시 에러

# 색상 정의
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

log_separator() {
    echo -e "${BLUE}============================================================================${NC}"
}

# 스크립트 시작
log_separator
log_info "Planning 이중 저장소 품질 게이트 시작"
log_info "실행 시간: $(date '+%Y-%m-%d %H:%M:%S')"
log_separator

# 환경 변수 확인
log_info "환경 변수 검증 중..."

REQUIRED_VARS=(
    "DATABASE_URL"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
)

OPTIONAL_VARS=(
    "SUPABASE_SERVICE_ROLE_KEY"
)

# 필수 환경 변수 확인
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        log_error "필수 환경 변수 $var가 설정되지 않았습니다"
        exit 1
    else
        log_success "✓ $var 설정됨"
    fi
done

# 선택적 환경 변수 확인 (Service Role Key)
for var in "${OPTIONAL_VARS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        log_warning "⚠ $var가 설정되지 않음 (Graceful Degradation 모드)"
    else
        log_success "✓ $var 설정됨"
    fi
done

# 결과 추적 변수
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# 테스트 결과 기록 함수
record_test_result() {
    local test_name="$1"
    local exit_code="$2"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [[ $exit_code -eq 0 ]]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        log_success "✓ $test_name 통과"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        log_error "✗ $test_name 실패 (종료 코드: $exit_code)"
    fi
}

# 1. 데이터 계약 검증 테스트
log_separator
log_info "1. Planning 데이터 계약 검증 테스트 실행"
log_separator

if npm test -- src/__tests__/data-quality/planning-contract-verification.test.ts --passWithNoTests; then
    record_test_result "Planning 데이터 계약 검증" 0
else
    record_test_result "Planning 데이터 계약 검증" 1
fi

# 2. API 통합 테스트
log_separator
log_info "2. Planning API 통합 테스트 실행"
log_separator

if npm test -- src/__tests__/data-quality/planning-api-integration.test.ts --passWithNoTests; then
    record_test_result "Planning API 통합 테스트" 0
else
    record_test_result "Planning API 통합 테스트" 1
fi

# 3. 스키마 검증 테스트
log_separator
log_info "3. Planning 스키마 검증 테스트 실행"
log_separator

# TypeScript 컴파일 검증
if npx tsc --noEmit --project tsconfig.json; then
    record_test_result "TypeScript 컴파일 검증" 0
else
    record_test_result "TypeScript 컴파일 검증" 1
fi

# Zod 스키마 검증
if node -e "
try {
    const { validatePlanningContent, createMockScenarioContent } = require('./src/shared/contracts/planning.contract.ts');
    const mockData = createMockScenarioContent();
    const result = validatePlanningContent(mockData);
    if (!result.success) {
        console.error('스키마 검증 실패:', result.error);
        process.exit(1);
    }
    console.log('Zod 스키마 검증 성공');
} catch (error) {
    console.error('Zod 스키마 로드 실패:', error.message);
    process.exit(1);
}
"; then
    record_test_result "Zod 스키마 검증" 0
else
    record_test_result "Zod 스키마 검증" 1
fi

# 4. 데이터베이스 스키마 검증
log_separator
log_info "4. 데이터베이스 스키마 검증"
log_separator

# Prisma 스키마 검증
if npx prisma validate; then
    record_test_result "Prisma 스키마 검증" 0
else
    record_test_result "Prisma 스키마 검증" 1
fi

# Prisma 클라이언트 생성 테스트
if npx prisma generate --silent; then
    record_test_result "Prisma 클라이언트 생성" 0
else
    record_test_result "Prisma 클라이언트 생성" 1
fi

# 5. 성능 및 품질 메트릭 수집
log_separator
log_info "5. 성능 및 품질 메트릭 수집"
log_separator

# 번들 크기 체크 (Planning 관련 모듈)
if command -v bundlesize >/dev/null 2>&1; then
    if bundlesize; then
        record_test_result "번들 크기 검증" 0
    else
        record_test_result "번들 크기 검증" 1
    fi
else
    log_warning "bundlesize 도구가 설치되지 않음 (선택적 검증)"
    WARNINGS=$((WARNINGS + 1))
fi

# ESLint 검증 (Planning 관련 파일)
if npx eslint "src/entities/planning/**/*.ts" "src/app/api/planning/**/*.ts" "src/shared/contracts/planning.contract.ts" --quiet; then
    record_test_result "ESLint 코드 품질 검증" 0
else
    record_test_result "ESLint 코드 품질 검증" 1
fi

# 6. 보안 검사
log_separator
log_info "6. 보안 검사"
log_separator

# 하드코딩된 시크릿 체크
if npm audit --audit-level=high; then
    record_test_result "npm 보안 감사" 0
else
    record_test_result "npm 보안 감사" 1
fi

# Planning 관련 파일의 하드코딩된 키 검사
HARDCODED_PATTERNS=(
    "sk-[a-zA-Z0-9]{32,}"  # API 키 패턴
    "postgres://.*:.*@"     # 데이터베이스 URL
    "supabase.*\.supabase\.co" # Supabase URL
)

HARDCODED_FOUND=false
for pattern in "${HARDCODED_PATTERNS[@]}"; do
    if grep -r -E "$pattern" src/entities/planning/ src/app/api/planning/ src/shared/contracts/planning.contract.ts 2>/dev/null; then
        log_error "하드코딩된 시크릿 발견: $pattern"
        HARDCODED_FOUND=true
    fi
done

if [[ "$HARDCODED_FOUND" == "false" ]]; then
    record_test_result "하드코딩된 시크릿 검사" 0
else
    record_test_result "하드코딩된 시크릿 검사" 1
fi

# 7. 계약 위반 보고서 생성
log_separator
log_info "7. 계약 위반 보고서 생성"
log_separator

REPORT_FILE="planning-quality-report-$(date +%Y%m%d-%H%M%S).json"

cat > "$REPORT_FILE" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "summary": {
        "total_tests": $TOTAL_TESTS,
        "passed_tests": $PASSED_TESTS,
        "failed_tests": $FAILED_TESTS,
        "warnings": $WARNINGS,
        "success_rate": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
    },
    "environment": {
        "database_url_set": $([ -n "${DATABASE_URL:-}" ] && echo "true" || echo "false"),
        "supabase_url_set": $([ -n "${SUPABASE_URL:-}" ] && echo "true" || echo "false"),
        "service_role_key_set": $([ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && echo "true" || echo "false"),
        "degradation_mode": $([ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && echo "true" || echo "false")
    },
    "test_categories": {
        "data_contracts": "$([ $FAILED_TESTS -eq 0 ] && echo "passed" || echo "failed")",
        "api_integration": "$([ $FAILED_TESTS -eq 0 ] && echo "passed" || echo "failed")",
        "schema_validation": "$([ $FAILED_TESTS -eq 0 ] && echo "passed" || echo "failed")",
        "security_checks": "$([ $FAILED_TESTS -eq 0 ] && echo "passed" || echo "failed")"
    }
}
EOF

log_success "품질 보고서 생성: $REPORT_FILE"

# 8. 최종 결과 요약
log_separator
log_info "최종 품질 게이트 결과"
log_separator

echo ""
echo "📊 테스트 결과 요약:"
echo "   총 테스트: $TOTAL_TESTS"
echo "   통과: $PASSED_TESTS"
echo "   실패: $FAILED_TESTS"
echo "   경고: $WARNINGS"
echo ""

if [[ $FAILED_TESTS -eq 0 ]]; then
    log_success "🎉 모든 Planning 품질 게이트 통과!"
    echo ""
    echo "✅ 데이터 계약 준수"
    echo "✅ API 통합 검증 완료"
    echo "✅ 스키마 무결성 확인"
    echo "✅ 보안 검사 통과"
    echo ""

    if [[ $WARNINGS -gt 0 ]]; then
        log_warning "경고 $WARNINGS개가 있지만 배포 가능"
    fi

    echo "🚀 Planning 이중 저장소 시스템 배포 준비 완료"
    exit 0
else
    log_error "💥 Planning 품질 게이트 실패 - 배포 차단"
    echo ""
    echo "❌ 실패한 테스트: $FAILED_TESTS개"
    echo "⚠️ 경고: $WARNINGS개"
    echo ""
    echo "🔧 수정 후 다시 실행하세요:"
    echo "   1. 실패한 테스트 로그 확인"
    echo "   2. 데이터 계약 위반 사항 수정"
    echo "   3. 보안 이슈 해결"
    echo "   4. 스키마 검증 오류 수정"
    echo ""
    echo "📋 상세 보고서: $REPORT_FILE"

    exit 1
fi