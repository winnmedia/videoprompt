#!/bin/bash

# VideoPlanet 품질 게이트 실행 스크립트
# $300 사건 재발 방지를 위한 완전한 품질 검증

set -e  # 에러 시 즉시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# 배너 출력
print_banner() {
    echo ""
    echo "========================================="
    echo "🛡️  VideoPlanet 품질 게이트 검증"
    echo "🚨 $300 사건 재발 방지 시스템"
    echo "========================================="
    echo ""
}

# 환경 검사 + 통합된 환경변수 검증
check_environment() {
    log_info "환경 검사 중..."

    # Node.js 버전 확인
    if ! command -v node &> /dev/null; then
        log_error "Node.js가 설치되지 않았습니다."
        exit 1
    fi

    # pnpm 확인
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm이 설치되지 않았습니다."
        exit 1
    fi

    # 의존성 설치 확인
    if [ ! -d "node_modules" ]; then
        log_info "의존성 설치 중..."
        pnpm install --frozen-lockfile
    fi

    # 통합된 환경변수 검증 스크립트 실행
    log_info "🔧 통합 환경변수 검증 시스템 실행 중..."
    if [ -f "scripts/validate-env-realtime.ts" ]; then
        if npx tsx scripts/validate-env-realtime.ts; then
            log_success "✅ 환경변수 검증 통과 (강화된 시스템)"
        else
            log_critical "❌ 환경변수 검증 실패 - $300 사건 위험!"
            log_error "필수 환경변수 설정이나 형식에 문제가 있습니다"
            exit 1
        fi
    else
        log_warning "환경변수 검증 스크립트를 찾을 수 없습니다"
    fi

    log_success "환경 검사 완료"
}

# $300 사건 방지 검사 - 강화된 TDD 기반 버전
check_infinite_loop_patterns() {
    log_info "🚨 $300 사건 방지 검사 시작 (Grace QA Lead 무관용 정책)..."

    # 1. 새로운 TDD 기반 비용 방지 시스템 테스트
    log_info "TDD 기반 비용 방지 시스템 검증..."
    if ! pnpm test src/__tests__/quality-gates/cost-prevention.test.ts --silent; then
        log_critical "TDD 비용 방지 시스템 테스트 실패!"
        return 1
    fi

    # 2. 실제 코드베이스 스캔
    log_info "코드베이스 전체 스캔 실행..."
    local react_files=($(find src/ -name "*.tsx" -o -name "*.ts" | grep -v __tests__ | head -30))

    if [ ${#react_files[@]} -eq 0 ]; then
        log_warning "검사할 React/TypeScript 파일이 없습니다."
        return 0
    fi

    local violations=0
    local total_estimated_cost=0

    # TypeScript로 정교한 분석 수행
    log_info "TypeScript 기반 정교한 패턴 분석..."
    for file in "${react_files[@]}"; do
        log_info "분석 중: $file"

        # 새로운 TypeScript 분석기 사용
        if ! npx tsx scripts/cost-prevention-analyzer.ts "$file" > /tmp/cost_analysis.json 2>&1; then
            log_warning "파일 분석 중 오류: $file"
            continue
        fi

        # JSON 결과 파싱
        if [ -f "/tmp/cost_analysis.json" ]; then
            local file_result=$(node -e "
                try {
                    const fs = require('fs');
                    const result = JSON.parse(fs.readFileSync('/tmp/cost_analysis.json', 'utf8'));
                    if (result.isRisky) {
                        console.log('RISKY:' + result.estimatedCost + ':' + result.violations.join(','));
                    } else {
                        console.log('SAFE');
                    }
                } catch(e) {
                    console.log('ERROR');
                }
            " 2>/dev/null)

            if [[ "$file_result" == RISKY:* ]]; then
                log_critical "💥 $300 위험 패턴 감지: $file"
                local cost=$(echo "$file_result" | cut -d: -f2)
                local violation_types=$(echo "$file_result" | cut -d: -f3)
                log_error "  예상 비용: \$$cost/day"
                log_error "  위반 유형: $violation_types"
                violations=$((violations + 1))
                total_estimated_cost=$((total_estimated_cost + cost))
            else
                log_info "✅ $file - 안전함"
            fi

            rm -f /tmp/cost_analysis.json
        fi
    done

    # 3. 백업 패턴 검사 (기존 시스템)
    log_info "백업 정규식 패턴 검사..."

    # useEffect 위험 패턴
    local useeffect_violations=$(grep -r "useEffect.*\[.*[a-zA-Z].*\]" src/ --include="*.tsx" --include="*.ts" --exclude-dir=__tests__ 2>/dev/null | wc -l)
    if [ "$useeffect_violations" -gt 0 ]; then
        log_warning "$useeffect_violations개의 기본 useEffect 패턴 검출됨"
    fi

    # 위험한 폴링 패턴
    if grep -r "setInterval.*fetch\|setTimeout.*fetch" src/ --include="*.tsx" --include="*.ts" --exclude-dir=__tests__ 2>/dev/null; then
        log_critical "위험한 폴링 패턴이 발견되었습니다!"
        violations=$((violations + 1))
        total_estimated_cost=$((total_estimated_cost + 200))
    fi

    # 4. Grace의 무관용 정책 적용
    if [ $violations -eq 0 ]; then
        log_success "$300 사건 방지 검사 통과 - Grace QA 승인 ✅"
    else
        log_critical "$violations개의 위험 패턴 발견!"
        log_critical "총 예상 비용: \$$total_estimated_cost/day"
        log_error "Grace QA Lead: 무관용 정책 위반 - 즉시 수정 필요!"
        log_error "배포 차단: 비용 위험이 $100/day를 초과합니다."
        return 1
    fi

    # 정리
    rm -f /tmp/cost_analysis.json /tmp/loop_check.log
}

# 타입 검사
run_type_check() {
    log_info "TypeScript 타입 검사 중..."
    if pnpm run type-check; then
        log_success "타입 검사 통과"
    else
        log_error "타입 검사 실패"
        return 1
    fi
}

# 린팅
run_lint() {
    log_info "ESLint 검사 중..."
    if pnpm run lint; then
        log_success "린팅 통과"
    else
        log_error "린팅 실패"
        return 1
    fi
}

# 인증 시스템 테스트
run_auth_tests() {
    log_info "🔐 인증 시스템 테스트 실행 중..."

    # useEffect 무한 루프 회귀 방지 테스트
    log_info "$300 사건 회귀 방지 테스트..."
    if ! pnpm test src/__tests__/auth/useEffect-infinite-loop-prevention.test.ts --silent; then
        log_error "useEffect 무한 루프 회귀 방지 테스트 실패"
        return 1
    fi

    # /api/auth/me 401 루프 방지 테스트
    log_info "/api/auth/me 401 루프 방지 테스트..."
    if ! pnpm test src/__tests__/auth/auth-me-401-loop-prevention.test.ts --silent; then
        log_error "/api/auth/me 401 루프 방지 테스트 실패"
        return 1
    fi

    # 기존 API 호출 모니터링 테스트
    log_info "API 호출 모니터링 테스트..."
    if ! pnpm test src/__tests__/auth/api-call-monitoring.test.ts --silent; then
        log_error "API 호출 모니터링 테스트 실패"
        return 1
    fi

    # 최종 무한 루프 방지 검증 테스트
    log_info "🚨 최종 $300 사건 방지 검증..."
    if ! pnpm test src/__tests__/quality-gates/infinite-loop-prevention-final.test.ts --silent; then
        log_error "최종 $300 사건 방지 검증 실패"
        return 1
    fi

    # 기존 에러 핸들링 테스트
    log_info "401/400 에러 핸들링 테스트..."
    if ! pnpm test src/__tests__/auth/error-handling-401-400.test.ts --silent; then
        log_error "401/400 에러 핸들링 테스트 실패"
        return 1
    fi

    # 토큰 갱신 실패 시나리오 테스트
    log_info "토큰 갱신 실패 시나리오 테스트..."
    if ! pnpm test src/__tests__/auth/token-refresh-failure.test.ts --silent; then
        log_error "토큰 갱신 실패 시나리오 테스트 실패"
        return 1
    fi

    log_success "인증 시스템 테스트 통과"
}

# Planning 저장소 테스트
run_planning_tests() {
    log_info "📊 Planning 이중 저장소 테스트 실행 중..."

    # 이중 저장소 품질 검증 테스트
    log_info "Planning 이중 저장소 품질 검증..."
    if ! pnpm test src/__tests__/planning/dual-storage-quality-verification.test.ts --silent; then
        log_error "Planning 이중 저장소 품질 검증 실패"
        return 1
    fi

    log_success "Planning 저장소 테스트 통과"
}

# Seedance 연동 테스트
run_seedance_tests() {
    log_info "🎬 Seedance API 연동 테스트 실행 중..."

    # $300 사건 방지: 하드코딩 키 완전 박멸 테스트
    log_info "🚨 Seedance 하드코딩 키 방지 테스트..."
    if ! pnpm test seedance-hardcoded-key-prevention --silent; then
        log_error "Seedance 하드코딩 키 방지 테스트 실패"
        return 1
    fi

    # 프로덕션 환경 503 에러 처리 테스트
    log_info "Seedance 프로덕션 에러 시나리오 테스트..."
    if ! pnpm test seedance-production-error-scenarios --silent; then
        log_error "Seedance 프로덕션 에러 시나리오 테스트 실패"
        return 1
    fi

    # API 통합 테스트
    log_info "Seedance API 통합 테스트..."
    if ! INTEGRATION_TEST=true pnpm test seedance-api-integration --silent; then
        log_error "Seedance API 통합 테스트 실패"
        return 1
    fi

    # API 키 검증 품질 테스트 (기존)
    log_info "Seedance API 키 검증 품질 테스트..."
    if ! pnpm test src/__tests__/seedance/api-key-validation-quality.test.ts --silent; then
        log_error "Seedance API 키 검증 품질 테스트 실패"
        return 1
    fi

    log_success "Seedance 연동 테스트 통과"
}

# 통합 테스트 및 데이터 일관성 검사
run_integration_tests() {
    log_info "🔗 통합 테스트 및 데이터 일관성 검사 중..."

    # Supabase null 에러 회귀 방지 테스트
    log_info "Supabase null 에러 회귀 방지 테스트..."
    if ! INTEGRATION_TEST=true pnpm test src/__tests__/integration/supabase-null-error-prevention.test.ts --silent; then
        log_error "Supabase null 에러 회귀 방지 테스트 실패"
        return 1
    fi

    # 데이터 저장 일관성 트랜잭션 테스트
    log_info "데이터 저장 일관성 트랜잭션 테스트..."
    if ! INTEGRATION_TEST=true pnpm test src/__tests__/integration/data-consistency-transaction.test.ts --silent; then
        log_error "데이터 저장 일관성 트랜잭션 테스트 실패"
        return 1
    fi

    # Seedance API 키 검증 및 Mock 전환 테스트
    log_info "Seedance API 키 검증 및 Mock 전환 테스트..."
    if ! INTEGRATION_TEST=true pnpm test src/__tests__/integration/seedance-api-key-validation.test.ts --silent; then
        log_error "Seedance API 키 검증 및 Mock 전환 테스트 실패"
        return 1
    fi

    # 환경변수 시나리오별 테스트
    log_info "환경변수 시나리오별 테스트..."
    if ! INTEGRATION_TEST=true pnpm test src/__tests__/integration/environment-variable-scenarios.test.ts --silent; then
        log_error "환경변수 시나리오별 테스트 실패"
        return 1
    fi

    log_success "통합 테스트 및 데이터 일관성 검사 통과"
}

# API 안전성 검사
run_api_safety_check() {
    log_info "📊 API 안전성 검사 중..."

    # 기존 API 계약 검증 테스트
    log_info "API 계약 검증 테스트..."
    if ! INTEGRATION_TEST=true pnpm test src/__tests__/integration/api-contract-verification.test.ts --silent; then
        log_error "API 계약 검증 테스트 실패"
        return 1
    fi

    # 플래키 테스트 감지 (3회 실행하여 일관성 확인)
    log_info "플래키 테스트 감지 (3회 실행)..."
    for i in {1..3}; do
        log_info "테스트 실행 $i/3..."
        if ! pnpm test src/__tests__/auth/ --silent; then
            log_error "테스트 $i 실행에서 실패 - 플래키 테스트 가능성"
            return 1
        fi
    done

    # 무한 루프 감지 추가 검증 (중요한 테스트)
    log_info "무한 루프 감지 추가 검증..."
    for i in {1..2}; do
        log_info "무한 루프 방지 테스트 실행 $i/2..."
        if ! pnpm test src/__tests__/auth/useEffect-infinite-loop-prevention.test.ts src/__tests__/auth/auth-me-401-loop-prevention.test.ts --silent; then
            log_error "무한 루프 방지 테스트 $i 실행에서 실패"
            return 1
        fi
    done

    log_success "API 안전성 검사 통과"
}

# 성능 검사
run_performance_check() {
    log_info "⚡ 성능 회귀 검사 중..."

    # 메모리 누수 검사
    log_info "메모리 누수 검사..."
    if node --expose-gc -e "
        const { execSync } = require('child_process');
        const initialMemory = process.memoryUsage().heapUsed;

        try {
            execSync('pnpm test src/__tests__/auth/ --silent', { stdio: 'pipe' });
        } catch (e) {
            console.error('테스트 실행 실패');
            process.exit(1);
        }

        if (global.gc) global.gc();
        const finalMemory = process.memoryUsage().heapUsed;
        const leakage = finalMemory - initialMemory;

        console.log(\`메모리 사용량 변화: \${(leakage / 1024 / 1024).toFixed(2)}MB\`);

        if (leakage > 50 * 1024 * 1024) {
            console.error('메모리 누수 감지: 50MB 초과');
            process.exit(1);
        }
    "; then
        log_success "메모리 누수 검사 통과"
    else
        log_error "메모리 누수 검사 실패"
        return 1
    fi
}

# 보안 검사
run_security_check() {
    log_info "🛡️ 보안 검사 중..."

    # 민감 정보 노출 검사
    log_info "민감 정보 노출 검사..."
    local security_violations=0

    # 하드코딩된 비밀번호 검사
    if grep -r -i "password.*=.*['\"]" src/ --exclude-dir=__tests__ 2>/dev/null | grep -v "placeholder\|example\|test\|mock"; then
        log_error "하드코딩된 비밀번호 발견"
        security_violations=$((security_violations + 1))
    fi

    # 하드코딩된 API 키 검사
    if grep -r -i "api_key.*=.*['\"]" src/ --exclude-dir=__tests__ 2>/dev/null | grep -v "placeholder\|example\|test\|mock"; then
        log_error "하드코딩된 API 키 발견"
        security_violations=$((security_violations + 1))
    fi

    # 의존성 취약점 검사
    log_info "의존성 취약점 검사..."
    if ! pnpm audit --audit-level moderate; then
        log_warning "의존성 취약점이 발견되었습니다. 확인이 필요합니다."
        security_violations=$((security_violations + 1))
    fi

    if [ $security_violations -eq 0 ]; then
        log_success "보안 검사 통과"
    else
        log_error "보안 검사에서 $security_violations개의 문제가 발견되었습니다."
        return 1
    fi
}

# 아키텍처 검사
run_architecture_check() {
    log_info "🏗️ FSD 아키텍처 규칙 검증 중..."

    local arch_violations=0

    # 상향 의존성 검사
    log_info "상향 의존성 검사..."

    # shared 레이어가 상위 레이어를 import하는지 확인
    if grep -r "from.*features\|from.*widgets\|from.*pages" src/shared/ 2>/dev/null; then
        log_error "FSD 규칙 위반: shared 레이어가 상위 레이어를 import"
        arch_violations=$((arch_violations + 1))
    fi

    # entities 레이어가 상위 레이어를 import하는지 확인
    if grep -r "from.*widgets\|from.*pages" src/entities/ 2>/dev/null; then
        log_error "FSD 규칙 위반: entities 레이어가 상위 레이어를 import"
        arch_violations=$((arch_violations + 1))
    fi

    if [ $arch_violations -eq 0 ]; then
        log_success "아키텍처 규칙 검증 통과"
    else
        log_error "아키텍처 규칙에서 $arch_violations개의 위반이 발견되었습니다."
        return 1
    fi
}

# Grace의 무관용 Mutation Testing (TDD 품질 검증)
run_mutation_tests() {
    log_info "🧬 Grace QA Lead Mutation Testing 실행 중 (무관용 정책)..."

    # Stryker 설치 확인
    if ! command -v npx stryker &> /dev/null || ! pnpm list @stryker-mutator/core &> /dev/null; then
        log_error "Stryker Mutation Testing이 설치되지 않았습니다!"
        log_error "설치 명령: pnpm add -D @stryker-mutator/core @stryker-mutator/vitest-runner @stryker-mutator/typescript-checker"
        return 1
    fi

    # 사전 검증: 기본 테스트가 모두 통과하는지 확인
    log_info "Mutation Testing 사전 검증 (모든 테스트 통과 필수)..."
    if ! pnpm test --run --silent; then
        log_critical "기본 테스트가 실패했습니다. Mutation Testing 차단!"
        log_error "Grace 규칙: 모든 테스트가 통과해야 Mutation Testing 진행 가능"
        return 1
    fi

    # $300 사건 방지 시스템부터 Mutation Testing
    log_info "🚨 $300 방지 시스템 Mutation Testing (최우선)..."

    # 임시 설정 파일 생성 (핵심 시스템만)
    local critical_config="stryker-critical.conf.mjs"
    cat > "$critical_config" << 'EOF'
export default {
  packageManager: 'pnpm',
  reporters: ['clear-text', 'progress'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: [
    'scripts/cost-prevention-detector.ts',
  ],
  thresholds: {
    high: 95,
    low: 85,
    break: 80  // Grace의 최소 기준
  },
  timeoutMS: 180000, // 3분 (빠른 피드백)
  tempDirName: 'stryker-critical-tmp',
  logLevel: 'warn'
};
EOF

    # 핵심 시스템 Mutation Testing 실행
    if npx stryker run --configFile "$critical_config"; then
        log_success "🚨 $300 방지 시스템 Mutation Testing 통과!"
        rm -f "$critical_config"
    else
        log_critical "$300 방지 시스템 Mutation Score 80% 미만!"
        log_error "Grace QA: 배포 즉시 차단 - 핵심 시스템 품질 미달"
        rm -f "$critical_config"
        return 1
    fi

    # CI 환경에서는 전체 Mutation Testing 건너뛰기 (시간 절약)
    if [ "$CI" = "true" ] && [ "$1" = "--quick" ]; then
        log_info "CI 환경: 핵심 시스템 Mutation Testing만 실행 완료"
        return 0
    fi

    # 전체 시스템 Mutation Testing (로컬 환경 또는 풀 검증)
    log_info "전체 시스템 Mutation Testing 실행..."

    # 보고서 디렉토리 생성
    mkdir -p reports/mutation

    # 기존 stryker.conf.mjs 사용
    if npx stryker run; then
        local mutation_score=$(node -e "
            try {
                const fs = require('fs');
                const report = JSON.parse(fs.readFileSync('reports/mutation/mutation-report.json', 'utf8'));
                console.log(Math.round(report.thresholds.break));
            } catch(e) {
                console.log('0');
            }
        " 2>/dev/null)

        if [ "$mutation_score" -ge 80 ]; then
            log_success "전체 Mutation Testing 통과 (Score: ${mutation_score}%)"
        else
            log_error "Mutation Score ${mutation_score}% < 80% (Grace 기준 미달)"
            return 1
        fi
    else
        log_error "전체 Mutation Testing 실패"
        return 1
    fi

    # 품질 보고서 생성
    log_info "Mutation Testing 품질 보고서 생성..."
    if [ -f "reports/mutation/mutation-report.html" ]; then
        log_success "HTML 보고서: reports/mutation/mutation-report.html"
    fi

    # Grace의 추가 검증: 플래키 테스트 탐지
    log_info "Grace 추가 검증: Mutation Testing 중 플래키 테스트 탐지..."
    if grep -i "timeout\|flaky\|intermittent" reports/mutation/mutation-report.json 2>/dev/null; then
        log_critical "Mutation Testing 중 플래키 패턴 감지!"
        log_error "Grace 무관용 정책: 플래키 테스트는 즉시 수정 필요"
        return 1
    fi

    log_success "🏆 Grace QA Mutation Testing 완전 통과!"
}

# 전체 테스트 실행
run_full_tests() {
    log_info "🔄 전체 테스트 스위트 실행 중..."

    # 커버리지 포함 전체 테스트
    if INTEGRATION_TEST=true pnpm test --coverage; then
        log_success "전체 테스트 통과"
    else
        log_error "전체 테스트 실패"
        return 1
    fi

    # 커버리지 임계값 확인
    log_info "커버리지 임계값 확인 중..."
    local coverage_file="coverage/coverage-summary.json"

    if [ -f "$coverage_file" ]; then
        # Node.js로 커버리지 파싱 및 검증
        local coverage_check=$(node -e "
            const fs = require('fs');
            const coverage = JSON.parse(fs.readFileSync('$coverage_file', 'utf8'));
            const total = coverage.total;

            const lines = total.lines.pct;
            const functions = total.functions.pct;
            const branches = total.branches.pct;
            const statements = total.statements.pct;

            console.log(\`Lines: \${lines}%, Functions: \${functions}%, Branches: \${branches}%, Statements: \${statements}%\`);

            // 임계값 설정
            const MIN_COVERAGE = 85;

            if (lines < MIN_COVERAGE || functions < MIN_COVERAGE || branches < MIN_COVERAGE || statements < MIN_COVERAGE) {
                console.error(\`커버리지가 \${MIN_COVERAGE}% 미만입니다!\`);
                process.exit(1);
            }

            console.log('커버리지 임계값 통과');
        " 2>&1)

        if [ $? -eq 0 ]; then
            log_success "커버리지 임계값 통과: $coverage_check"
        else
            log_error "커버리지 임계값 실패: $coverage_check"
            return 1
        fi
    else
        log_warning "커버리지 파일을 찾을 수 없습니다. 건너뜁니다."
    fi
}

# 빌드 검증
run_build_check() {
    log_info "🏗️ 프로덕션 빌드 검증 중..."

    if pnpm run build; then
        log_success "빌드 검증 통과"
    else
        log_error "빌드 검증 실패"
        return 1
    fi
}

# 메인 실행 함수
main() {
    print_banner

    local start_time=$(date +%s)
    local failed_checks=()

    # 각 검사 실행 (단계별)
    check_environment || failed_checks+=("환경 검사")
    check_infinite_loop_patterns || failed_checks+=("$300 사건 방지 검사")
    run_type_check || failed_checks+=("타입 검사")
    run_lint || failed_checks+=("린팅")

    # 핵심 도메인 테스트
    run_auth_tests || failed_checks+=("인증 시스템 테스트")
    run_planning_tests || failed_checks+=("Planning 저장소 테스트")
    run_seedance_tests || failed_checks+=("Seedance 연동 테스트")

    # 통합 및 품질 검사
    run_integration_tests || failed_checks+=("통합 테스트 및 데이터 일관성 검사")
    run_api_safety_check || failed_checks+=("API 안전성 검사")
    run_performance_check || failed_checks+=("성능 검사")
    run_security_check || failed_checks+=("보안 검사")
    run_architecture_check || failed_checks+=("아키텍처 검사")
    run_full_tests || failed_checks+=("전체 테스트")
    run_mutation_tests || failed_checks+=("뮤테이션 테스트")
    run_build_check || failed_checks+=("빌드 검증")

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    echo "========================================="
    echo "📊 품질 게이트 검증 결과"
    echo "========================================="
    echo "실행 시간: ${duration}초"
    echo ""

    if [ ${#failed_checks[@]} -eq 0 ]; then
        log_success "모든 품질 게이트 통과! 🎉"
        log_success "인증 시스템 안전성이 검증되었습니다."
        log_success "$300 사건 재발 방지 시스템이 정상 작동합니다."
        echo ""
        echo "✅ PR 병합 가능"
        exit 0
    else
        log_critical "품질 게이트 실패!"
        log_error "실패한 검사: ${failed_checks[*]}"
        echo ""
        log_error "🚨 PR 병합 불가 - 실패한 검사를 수정한 후 다시 시도해주세요."
        exit 1
    fi
}

# 스크립트 실행
main "$@"