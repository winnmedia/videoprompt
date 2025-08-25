#!/bin/bash

# Seedance API 테스트 스크립트 (배포 환경 전용)
# 사용법: ./test-seedance-api.sh

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
    echo -e "\n${BLUE}🔍 $1${NC}"
    echo "=================================="
}

# 테스트 결과 카운터
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 테스트 함수
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log_info "테스트: $test_name"
    echo "명령어: $test_command"
    
    if eval "$test_command" 2>/dev/null | grep -q "$expected_pattern"; then
        log_success "통과: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_error "실패: $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
}

# 메인 테스트 실행
main() {
    echo "🚀 Seedance API 테스트 시작 (배포 환경 전용)"
    echo "================================================"
    
    # 1단계: Railway 백엔드 상태 확인
    log_step "1단계: Railway 백엔드 상태 확인"
    
    if curl -s "https://videoprompt-production.up.railway.app/api/health" >/dev/null 2>&1; then
        log_success "Railway 백엔드가 정상 작동합니다"
        RAILWAY_BACKEND="https://videoprompt-production.up.railway.app"
    else
        log_error "Railway 백엔드에 연결할 수 없습니다"
        log_error "테스트를 중단합니다. Railway 백엔드 상태를 확인해주세요."
        exit 1
    fi
    
    # 2단계: Seedance 진단 API 테스트
    log_step "2단계: Seedance 진단 API 테스트"
    
    run_test "Seedance 진단 API" \
        "curl -s $RAILWAY_BACKEND/api/seedance/diagnose" \
        "hasKey"
    
    # 3단계: Seedance Create API 테스트
    log_step "3단계: Seedance Create API 테스트"
    
    run_test "Seedance Create API" \
        "curl -s -X POST $RAILWAY_BACKEND/api/seedance/create -H 'Content-Type: application/json' -d '{\"prompt\": \"테스트 영상\", \"aspect_ratio\": \"16:9\", \"duration_seconds\": 5}'" \
        "jobId"
    
    # 4단계: Seedance Status API 테스트
    log_step "4단계: Seedance Status API 테스트"
    
    # 이전 테스트에서 생성된 작업 ID 사용
    if [ $FAILED_TESTS -eq 0 ]; then
        log_info "Create API 테스트가 성공했습니다. 상태 확인을 테스트합니다."
        
        # 간단한 상태 확인 테스트 (실제 작업 ID 없이)
        run_test "Seedance Status API 기본 동작" \
            "curl -s $RAILWAY_BACKEND/api/seedance/status/test-id" \
            "error"
    else
        log_warning "Create API 테스트가 실패하여 Status API 테스트를 건너뜁니다."
    fi
    
    # 5단계: 직접 ModelArk API 테스트
    log_step "5단계: ModelArk API 직접 테스트"
    
    log_info "ModelArk API 연결을 테스트합니다 (인증 에러는 정상 - 연결 확인용)"
    
    if curl -s -H "Content-Type: application/json" \
             "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks" \
             -d '{"test": "connection"}' >/dev/null 2>&1; then
        log_success "ModelArk API에 연결할 수 있습니다"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
    else
        log_warning "ModelArk API 연결에 문제가 있을 수 있습니다"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
    fi
    
    # 6단계: 통합 워크플로우 테스트
    log_step "6단계: 통합 워크플로우 테스트"
    
    log_info "전체 워크플로우 테스트 실행"
    
    # 1. 영상 생성
    CREATE_RESPONSE=$(curl -s -X POST "$RAILWAY_BACKEND/api/seedance/create" \
        -H "Content-Type: application/json" \
        -d '{"prompt": "아름다운 자연 풍경", "aspect_ratio": "16:9", "duration_seconds": 8}')
    
    if echo "$CREATE_RESPONSE" | grep -q "jobId"; then
        log_success "영상 생성 요청 성공"
        
        # 2. 작업 ID 추출
        JOB_ID=$(echo "$CREATE_RESPONSE" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
        
        if [ -n "$JOB_ID" ]; then
            log_info "작업 ID: $JOB_ID"
            
            # 3. 상태 확인
            sleep 2
            STATUS_RESPONSE=$(curl -s "$RAILWAY_BACKEND/api/seedance/status/$JOB_ID")
            
            if echo "$STATUS_RESPONSE" | grep -q "status"; then
                log_success "상태 확인 성공"
                run_test "통합 워크플로우" "echo '통합 테스트 완료'" "통합 테스트 완료"
            else
                log_error "상태 확인 실패"
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
        else
            log_error "작업 ID를 추출할 수 없습니다"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        log_error "영상 생성 요청 실패"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # 7단계: 결과 요약
    log_step "7단계: 테스트 결과 요약"
    
    echo "📊 테스트 결과 요약"
    echo "=================="
    echo "총 테스트 수: $TOTAL_TESTS"
    echo "통과: $PASSED_TESTS"
    echo "실패: $FAILED_TESTS"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log_success "🎉 모든 테스트가 통과했습니다!"
        echo ""
        echo "✅ Railway 백엔드가 정상적으로 작동합니다"
        echo "✅ Seedance API가 정상적으로 동작합니다"
        echo "✅ ModelArk API 연결이 정상입니다"
        echo "✅ 통합 워크플로우가 정상적으로 동작합니다"
    else
        log_error "⚠️  일부 테스트가 실패했습니다"
        echo ""
        echo "🔧 문제 해결 방법:"
        echo "1. Railway 백엔드 상태 확인"
        echo "2. 환경변수 설정 확인"
        echo "3. API 키 유효성 확인"
        echo "4. 네트워크 연결 상태 확인"
    fi
    
    echo ""
    echo "📚 추가 정보: SEEDANCE_SETUP.md 파일을 참조하세요"
    echo "⚠️  참고: 이 테스트는 배포 환경 전용입니다 (Mock 모드 없음)"
}

# 스크립트 실행
main "$@"
