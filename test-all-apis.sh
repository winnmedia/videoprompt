#!/bin/bash

echo "🚀 VideoPlanet API 통합 테스트 시작"
echo "=================================="

BASE_URL="https://videoprompt-production.up.railway.app"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 테스트 결과 카운터
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 테스트 함수
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${BLUE}🧪 테스트: $test_name${NC}"
    
    # 명령 실행
    local result
    result=$(eval "$command" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ] && echo "$result" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ 성공${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ 실패${NC}"
        echo "출력: $result"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo -e "\n${YELLOW}1. 헬스체크 및 기본 접근성 테스트${NC}"
run_test "메인 페이지 접근" "curl -sS '$BASE_URL/' | grep -q 'VideoPlanet'" "VideoPlanet"

echo -e "\n${YELLOW}2. 이미지 생성 API 테스트${NC}"
run_test "Google Imagen 이미지 생성" "curl -sS -X POST '$BASE_URL/api/imagen/preview' -H 'Content-Type: application/json' --data-binary '{\"prompt\":\"A beautiful sunset\",\"size\":\"1024x1024\",\"n\":1,\"provider\":\"imagen\"}' | jq -r '.ok'" "true"
run_test "OpenAI DALL-E 이미지 생성" "curl -sS -X POST '$BASE_URL/api/imagen/preview' -H 'Content-Type: application/json' --data-binary '{\"prompt\":\"A futuristic city\",\"size\":\"1024x1024\",\"n\":1,\"provider\":\"dalle\"}' | jq -r '.ok'" "true"

echo -e "\n${YELLOW}3. 동영상 생성 API 테스트${NC}"
run_test "Google Veo 동영상 생성" "curl -sS -X POST '$BASE_URL/api/veo/create' -H 'Content-Type: application/json' --data-binary '{\"prompt\":\"A futuristic city at night\",\"aspectRatio\":\"16:9\",\"duration\":8,\"model\":\"veo-3.0-generate-preview\"}' | jq -r '.ok'" "true"
run_test "Seedance 동영상 생성" "curl -sS -X POST '$BASE_URL/api/seedance/create' -H 'Content-Type: application/json' --data-binary '{\"prompt\":\"A beautiful landscape\",\"aspect_ratio\":\"16:9\",\"duration_seconds\":8}' | jq -r '.ok'" "true"

echo -e "\n${YELLOW}4. 통합 동영상 API 테스트${NC}"
run_test "통합 Veo 동영상 생성" "curl -sS -X POST '$BASE_URL/api/video/create' -H 'Content-Type: application/json' --data-binary '{\"prompt\":\"A magical forest\",\"provider\":\"veo\",\"aspectRatio\":\"16:9\",\"duration\":8}' | jq -r '.ok'" "true"
run_test "통합 Seedance 동영상 생성" "curl -sS -X POST '$BASE_URL/api/video/create' -H 'Content-Type: application/json' --data-binary '{\"prompt\":\"A space adventure\",\"provider\":\"seedance\",\"aspectRatio\":\"16:9\",\"duration\":8}' | jq -r '.ok'" "true"

echo -e "\n${YELLOW}5. CORS 정책 테스트${NC}"
run_test "CORS 헤더 확인" "curl -sS -H 'Origin: https://example.com' '$BASE_URL/api/imagen/preview' -X OPTIONS | grep -q 'Access-Control-Allow-Origin'" "Access-Control-Allow-Origin"

echo -e "\n${YELLOW}6. 위저드 페이지 접근성 테스트${NC}"
run_test "위저드 페이지 접근" "curl -sS '$BASE_URL/wizard' | grep -q 'AI 모델 선택'" "AI 모델 선택"

echo -e "\n=================================="
echo -e "📊 테스트 결과 요약"
echo -e "총 테스트: ${TOTAL_TESTS}"
echo -e "${GREEN}성공: ${PASSED_TESTS}${NC}"
echo -e "${RED}실패: ${FAILED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 모든 테스트 통과!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  일부 테스트 실패${NC}"
    exit 1
fi
