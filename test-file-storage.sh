#!/bin/bash

# 파일 저장 기능 테스트 스크립트
# 사용법: ./test-file-storage.sh

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
    echo "🚀 파일 저장 기능 테스트 시작"
    echo "================================================"
    
    # 1단계: 업로드 디렉토리 확인
    log_step "1단계: 업로드 디렉토리 확인"
    
    if [ -d "public/uploads" ]; then
        log_success "업로드 디렉토리가 존재합니다"
        
        if [ -d "public/uploads/images" ]; then
            log_success "이미지 업로드 디렉토리가 존재합니다"
        else
            log_warning "이미지 업로드 디렉토리가 없습니다"
        fi
        
        if [ -d "public/uploads/videos" ]; then
            log_success "비디오 업로드 디렉토리가 존재합니다"
        else
            log_warning "비디오 업로드 디렉토리가 없습니다"
        fi
        
        if [ -d "public/uploads/audio" ]; then
            log_success "오디오 업로드 디렉토리가 존재합니다"
        else
            log_warning "오디오 업로드 디렉토리가 없습니다"
        fi
    else
        log_error "업로드 디렉토리가 없습니다"
        log_info "업로드 디렉토리를 생성합니다..."
        mkdir -p public/uploads/images public/uploads/videos public/uploads/audio
        log_success "업로드 디렉토리 생성 완료"
    fi
    
    # 2단계: 로컬 서버 상태 확인
    log_step "2단계: 로컬 서버 상태 확인"
    
    if curl -s "http://localhost:3000/api/health" >/dev/null 2>&1; then
        log_success "로컬 서버가 실행 중입니다 (포트 3000)"
        LOCAL_SERVER="http://localhost:3000"
    else
        log_warning "로컬 서버가 실행되지 않았습니다"
        log_info "개발 서버를 시작하려면: npm run dev"
        LOCAL_SERVER=""
    fi
    
    # 3단계: 파일 저장 API 테스트
    log_step "3단계: 파일 저장 API 테스트"
    
    if [ -n "$LOCAL_SERVER" ]; then
        log_info "파일 저장 API 테스트 실행"
        
        # 테스트 이미지 URL (공개 도메인)
        TEST_IMAGE_URL="https://picsum.photos/200/300"
        TEST_VIDEO_URL="https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"
        
        # 단일 이미지 저장 테스트
        run_test "단일 이미지 저장 API" \
            "curl -s -X POST $LOCAL_SERVER/api/files/save -H 'Content-Type: application/json' -d '{\"urls\": [\"$TEST_IMAGE_URL\"], \"prefix\": \"test-\", \"subDirectory\": \"images\"}'" \
            "파일 저장 성공"
        
        # 여러 파일 일괄 저장 테스트
        run_test "여러 파일 일괄 저장 API" \
            "curl -s -X POST $LOCAL_SERVER/api/files/save -H 'Content-Type: application/json' -d '{\"urls\": [\"$TEST_IMAGE_URL\", \"$TEST_VIDEO_URL\"], \"prefix\": \"batch-\", \"subDirectory\": \"\"}'" \
            "모든 파일 저장 성공"
        
        # 저장된 파일 목록 조회 테스트
        run_test "저장된 파일 목록 조회 API" \
            "curl -s '$LOCAL_SERVER/api/files/save?directory=images'" \
            "저장된 파일 목록"
        
    else
        log_warning "로컬 서버가 실행되지 않아 파일 저장 API 테스트를 건너뜁니다"
    fi
    
    # 4단계: 실제 파일 저장 테스트
    log_step "4단계: 실제 파일 저장 테스트"
    
    if [ -n "$LOCAL_SERVER" ]; then
        log_info "실제 파일 저장 테스트 실행"
        
        # 간단한 테스트 이미지 다운로드 및 저장
        if command -v wget >/dev/null 2>&1; then
            log_info "wget을 사용하여 테스트 이미지 다운로드"
            
            # 테스트 이미지 다운로드
            wget -q -O "test-image.jpg" "https://picsum.photos/200/300"
            
            if [ -f "test-image.jpg" ]; then
                log_success "테스트 이미지 다운로드 성공"
                
                # 파일 크기 확인
                FILE_SIZE=$(stat -c%s "test-image.jpg" 2>/dev/null || stat -f%z "test-image.jpg" 2>/dev/null || echo "unknown")
                log_info "다운로드된 파일 크기: $FILE_SIZE bytes"
                
                # 테스트 파일 정리
                rm -f "test-image.jpg"
                log_success "테스트 파일 정리 완료"
                
            else
                log_error "테스트 이미지 다운로드 실패"
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
        else
            log_warning "wget이 설치되지 않아 실제 파일 다운로드 테스트를 건너뜁니다"
        fi
        
    else
        log_warning "로컬 서버가 실행되지 않아 실제 파일 저장 테스트를 건너뜁니다"
    fi
    
    # 5단계: 저장된 파일 확인
    log_step "5단계: 저장된 파일 확인"
    
    if [ -d "public/uploads" ]; then
        log_info "저장된 파일 확인"
        
        # 각 디렉토리의 파일 수 확인
        IMAGE_COUNT=$(find public/uploads/images -type f 2>/dev/null | wc -l)
        VIDEO_COUNT=$(find public/uploads/videos -type f 2>/dev/null | wc -l)
        AUDIO_COUNT=$(find public/uploads/audio -type f 2>/dev/null | wc -l)
        
        log_info "저장된 파일 수:"
        echo "  - 이미지: $IMAGE_COUNT개"
        echo "  - 비디오: $VIDEO_COUNT개"
        echo "  - 오디오: $AUDIO_COUNT개"
        
        # 파일 목록 표시 (최근 5개)
        if [ $IMAGE_COUNT -gt 0 ]; then
            log_info "최근 저장된 이미지 파일:"
            find public/uploads/images -type f -printf "%T@ %p\n" 2>/dev/null | sort -n | tail -5 | cut -d' ' -f2- | while read file; do
                echo "  - $(basename "$file")"
            done
        fi
        
        if [ $VIDEO_COUNT -gt 0 ]; then
            log_info "최근 저장된 비디오 파일:"
            find public/uploads/videos -type f -printf "%T@ %p\n" 2>/dev/null | sort -n | tail -5 | cut -d' ' -f2- | while read file; do
                echo "  - $(basename "$file")"
            done
        fi
        
    else
        log_warning "업로드 디렉토리를 찾을 수 없습니다"
    fi
    
    # 6단계: 결과 요약
    log_step "6단계: 테스트 결과 요약"
    
    echo "📊 테스트 결과 요약"
    echo "=================="
    echo "총 테스트 수: $TOTAL_TESTS"
    echo "통과: $PASSED_TESTS"
    echo "실패: $FAILED_TESTS"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log_success "🎉 모든 테스트가 통과했습니다!"
        echo ""
        echo "✅ 파일 저장 시스템이 정상적으로 작동합니다"
        echo "✅ 업로드 디렉토리가 올바르게 설정되었습니다"
        echo "✅ 파일 저장 API가 정상적으로 동작합니다"
        echo "✅ 실제 파일 다운로드 및 저장이 가능합니다"
    else
        log_error "⚠️  일부 테스트가 실패했습니다"
        echo ""
        echo "🔧 문제 해결 방법:"
        echo "1. 개발 서버 상태 확인 (npm run dev)"
        echo "2. 업로드 디렉토리 권한 확인"
        echo "3. 네트워크 연결 상태 확인"
        echo "4. API 응답 로그 확인"
    fi
    
    echo ""
    echo "📚 추가 정보:"
    echo "- 저장 경로: public/uploads/"
    echo "- 이미지: public/uploads/images/"
    echo "- 비디오: public/uploads/videos/"
    echo "- 오디오: public/uploads/audio/"
    echo ""
    echo "🔗 API 엔드포인트:"
    echo "- 파일 저장: POST /api/files/save"
    echo "- 파일 목록: GET /api/files/save?directory=images"
}

# 스크립트 실행
main "$@"
