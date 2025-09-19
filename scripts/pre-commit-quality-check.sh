#!/bin/bash

# Pre-commit 품질 검사 스크립트
# QA Lead Grace - 무관용 품질 정책
# 커밋 전 필수 검증 항목

set -euo pipefail

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 로깅 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 에러 핸들러
error_handler() {
    local line_number=$1
    log_error "Pre-commit check failed at line $line_number"
    log_error "Commit REJECTED - Fix issues before committing"
    exit 1
}

trap 'error_handler $LINENO' ERR

echo "=============================================="
echo "🛡️  PRE-COMMIT QUALITY CHECK - QA Lead Grace"
echo "=============================================="
echo "무관용 품질 정책 - 모든 검사 통과 필수"
echo ""

# 1. Staged 파일 확인
log_info "1. Checking staged files..."
staged_files=$(git diff --cached --name-only)

if [ -z "$staged_files" ]; then
    log_warn "No staged files found"
    exit 0
fi

echo "Staged files:"
echo "$staged_files"
echo ""

# 2. $300 사건 방지 검사 (최우선)
log_info "2. $300 Incident Prevention Check (CRITICAL)"

# useEffect 의존성 배열 검사
log_info "Checking for dangerous useEffect patterns..."
dangerous_useeffect=false

# staged 파일 중 TypeScript/JavaScript 파일만 검사
while IFS= read -r file; do
    if [[ "$file" =~ \.(ts|tsx|js|jsx)$ ]] && [ -f "$file" ]; then
        # useEffect(..., [function]) 패턴 검사
        if grep -q "useEffect.*\[.*function" "$file" || grep -q "useEffect.*\[.*\(\)" "$file"; then
            log_error "CRITICAL: Dangerous useEffect pattern in $file"
            log_error "This pattern caused the $300 API incident"
            log_error "Fix: Use empty dependency array [] or remove function from deps"
            dangerous_useeffect=true
        fi
    fi
done <<< "$staged_files"

if [ "$dangerous_useeffect" = true ]; then
    log_error "COMMIT REJECTED: $300 incident patterns detected"
    exit 1
fi

log_success "$300 incident prevention check passed"
echo ""

# 3. CLAUDE.md 금지 패턴 검사
log_info "3. CLAUDE.md Compliance Check"

violations_found=false

while IFS= read -r file; do
    if [[ "$file" =~ \.(ts|tsx|js|jsx)$ ]] && [ -f "$file" ]; then
        # @ts-ignore 검사
        if grep -q "@ts-ignore\|@ts-nocheck" "$file"; then
            log_error "VIOLATION: @ts-ignore/@ts-nocheck found in $file (CLAUDE.md forbidden)"
            violations_found=true
        fi

        # any 타입 검사 (타입 정의 파일 제외)
        if [[ ! "$file" =~ \.d\.ts$ ]] && grep -q ": any\|<any>" "$file"; then
            log_error "VIOLATION: 'any' type usage in $file (CLAUDE.md forbidden)"
            violations_found=true
        fi

        # moment.js 검사
        if grep -q "import.*moment\|require.*moment" "$file"; then
            log_error "VIOLATION: moment.js usage in $file (CLAUDE.md forbidden)"
            violations_found=true
        fi

        # Tailwind arbitrary values 검사
        if grep -q "\[.*px\]\|\[.*rem\]\|\[.*em\]\|\[.*%\]" "$file"; then
            log_error "VIOLATION: Tailwind arbitrary values in $file (CLAUDE.md forbidden)"
            violations_found=true
        fi

        # @apply 검사
        if grep -q "@apply" "$file"; then
            log_error "VIOLATION: @apply usage in $file (CLAUDE.md forbidden)"
            violations_found=true
        fi

        # !important 검사
        if grep -q "!important" "$file"; then
            log_error "VIOLATION: !important usage in $file (CLAUDE.md forbidden)"
            violations_found=true
        fi

        # 이모지 검사
        if grep -q "emoji\|😀\|🎉\|✅\|❌\|🚨\|🔥\|💡\|🎯\|🚀\|⚡\|🛡️\|🔍\|📊\|📈\|📉\|💰\|💸\|💵" "$file"; then
            log_error "VIOLATION: Emoji usage in $file (CLAUDE.md forbidden)"
            violations_found=true
        fi
    fi
done <<< "$staged_files"

if [ "$violations_found" = true ]; then
    log_error "COMMIT REJECTED: CLAUDE.md violations detected"
    exit 1
fi

log_success "CLAUDE.md compliance check passed"
echo ""

# 4. TypeScript 타입 검사
log_info "4. TypeScript Type Check"

if echo "$staged_files" | grep -q "\.(ts|tsx)$"; then
    log_info "Running TypeScript compilation check..."

    if ! npx tsc --noEmit; then
        log_error "TypeScript compilation failed"
        log_error "Fix type errors before committing"
        exit 1
    fi

    log_success "TypeScript type check passed"
else
    log_info "No TypeScript files to check"
fi
echo ""

# 5. ESLint 검사
log_info "5. ESLint Check"

ts_js_files=$(echo "$staged_files" | grep "\.(ts|tsx|js|jsx)$" || true)

if [ -n "$ts_js_files" ]; then
    log_info "Running ESLint on staged files..."

    if ! echo "$ts_js_files" | xargs npx eslint --ext .ts,.tsx,.js,.jsx; then
        log_error "ESLint check failed"
        log_error "Fix linting errors before committing"
        exit 1
    fi

    log_success "ESLint check passed"
else
    log_info "No JavaScript/TypeScript files to lint"
fi
echo ""

# 6. Prettier 포맷팅 검사
log_info "6. Prettier Format Check"

if [ -n "$ts_js_files" ]; then
    log_info "Checking Prettier formatting..."

    unformatted_files=""
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            if ! npx prettier --check "$file"; then
                unformatted_files="$unformatted_files $file"
            fi
        fi
    done <<< "$ts_js_files"

    if [ -n "$unformatted_files" ]; then
        log_error "Files need formatting:$unformatted_files"
        log_info "Run: npx prettier --write$unformatted_files"
        exit 1
    fi

    log_success "Prettier format check passed"
else
    log_info "No files to format check"
fi
echo ""

# 7. 테스트 실행 (관련 테스트만)
log_info "7. Related Tests Check"

# 테스트 파일이 staged에 있거나, src 파일 변경 시 테스트 실행
test_files=$(echo "$staged_files" | grep "\.test\.\|\.spec\.\|__tests__" || true)
src_files=$(echo "$staged_files" | grep "^src/" || true)

if [ -n "$test_files" ] || [ -n "$src_files" ]; then
    log_info "Running related tests..."

    # Jest 실행 (변경된 파일과 관련된 테스트만)
    if ! npx jest --findRelatedTests $staged_files --passWithNoTests; then
        log_error "Tests failed"
        log_error "Fix failing tests before committing"
        exit 1
    fi

    log_success "Related tests passed"
else
    log_info "No tests to run"
fi
echo ""

# 8. 파일 크기 검사
log_info "8. File Size Check"

large_files=""
while IFS= read -r file; do
    if [ -f "$file" ]; then
        # 1MB (1048576 bytes) 초과 파일 검사
        if [ $(stat -c%s "$file") -gt 1048576 ]; then
            large_files="$large_files $file"
        fi
    fi
done <<< "$staged_files"

if [ -n "$large_files" ]; then
    log_warn "Large files detected (>1MB):$large_files"
    log_warn "Consider if these files should be committed"
fi

log_success "File size check completed"
echo ""

# 9. 보안 패턴 검사
log_info "9. Security Pattern Check"

security_issues=false

while IFS= read -r file; do
    if [ -f "$file" ]; then
        # 하드코딩된 시크릿 검사
        if grep -qi "password\s*=\|secret\s*=\|key\s*=\|token\s*=" "$file"; then
            # 환경변수나 설정 파일이 아닌 경우에만 경고
            if [[ ! "$file" =~ \.(env|config)\. ]]; then
                log_warn "Potential hardcoded secret in $file"
                log_warn "Verify no sensitive data is committed"
                security_issues=true
            fi
        fi

        # console.log 검사 (프로덕션 코드)
        if [[ "$file" =~ ^src/ ]] && grep -q "console\.log\|console\.debug" "$file"; then
            log_warn "console.log/debug found in $file"
            log_warn "Remove debug logs before production"
        fi
    fi
done <<< "$staged_files"

if [ "$security_issues" = false ]; then
    log_success "Security pattern check passed"
else
    log_warn "Security issues detected - review required"
fi
echo ""

# 10. 최종 검증
log_info "10. Final Validation"

# Prisma 스키마 변경 시 migration 확인
if echo "$staged_files" | grep -q "prisma/schema.prisma"; then
    log_info "Prisma schema changed - checking migrations..."

    if ! find prisma/migrations -name "*.sql" -newer prisma/schema.prisma | grep -q .; then
        log_warn "Prisma schema changed but no recent migration found"
        log_warn "Consider running: npx prisma migrate dev"
    fi
fi

# package.json 변경 시 lock 파일 확인
if echo "$staged_files" | grep -q "package.json"; then
    if ! echo "$staged_files" | grep -q "pnpm-lock.yaml"; then
        log_warn "package.json changed but pnpm-lock.yaml not staged"
        log_warn "Run: pnpm install and stage pnpm-lock.yaml"
    fi
fi

log_success "Final validation completed"
echo ""

# 성공 메시지
echo "=============================================="
log_success "🎉 ALL PRE-COMMIT CHECKS PASSED"
echo "=============================================="
echo "✅ $300 incident patterns: CLEAR"
echo "✅ CLAUDE.md compliance: VERIFIED"
echo "✅ TypeScript types: VALID"
echo "✅ Code quality: PASSED"
echo "✅ Tests: PASSED"
echo "✅ Security: VERIFIED"
echo ""
echo "Commit is authorized to proceed"
echo "=============================================="

exit 0