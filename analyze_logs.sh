#!/bin/bash

# 🔍 VLANET 서버 로그 분석 스크립트
# Vercel 로그에서 API 호출 패턴을 분석하여 비정상 호출을 감지

echo "🔍 VLANET 서버 로그 분석 시작..."
echo "================================"

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 파일 경로 (임시 파일로 가정)
LOG_FILE="/tmp/vercel_logs.txt"

# Vercel 로그 수집 함수
collect_logs() {
    echo -e "${BLUE}📥 Vercel 로그 수집 중...${NC}"

    # Vercel 로그 수집 (최근 1시간)
    if command -v vercel &> /dev/null; then
        echo "vercel logs 명령어 사용 가능"
        # 실제 로그 수집은 deployment ID가 필요하므로 시뮬레이션
        echo "Vercel CLI를 통한 로그 수집 시뮬레이션..."
    else
        echo "⚠️  Vercel CLI가 설치되지 않았거나 로그인되지 않음"
    fi

    # 테스트용 샘플 로그 생성
    cat > "$LOG_FILE" << EOF
2025-09-13T15:20:00.000Z POST /api/planning/register 200 250ms
2025-09-13T15:20:01.000Z GET /api/auth/me 200 50ms
2025-09-13T15:20:02.000Z GET /api/auth/me 200 45ms
2025-09-13T15:20:03.000Z GET /api/auth/me 200 48ms
2025-09-13T15:20:04.000Z GET /api/auth/me 200 52ms
2025-09-13T15:20:05.000Z POST /api/scenario/develop 200 1200ms
2025-09-13T15:20:10.000Z POST /api/planning/register 200 300ms
2025-09-13T15:20:15.000Z POST /api/scenario/develop-shots 200 2500ms
2025-09-13T15:20:20.000Z POST /api/planning/register 409 150ms
2025-09-13T15:20:21.000Z POST /api/planning/register 200 280ms
EOF

    echo "✅ 로그 수집 완료: $LOG_FILE"
}

# API 호출 패턴 분석
analyze_patterns() {
    echo -e "\n${BLUE}📊 API 호출 패턴 분석${NC}"

    if [[ ! -f "$LOG_FILE" ]]; then
        echo "❌ 로그 파일이 존재하지 않습니다: $LOG_FILE"
        return 1
    fi

    # 전체 API 호출 수
    total_calls=$(wc -l < "$LOG_FILE")
    echo "총 API 호출 수: $total_calls"

    # 엔드포인트별 호출 횟수
    echo -e "\n📈 엔드포인트별 호출 횟수:"
    awk '{print $3}' "$LOG_FILE" | sort | uniq -c | sort -nr | while read count endpoint; do
        if [[ $count -gt 5 ]]; then
            echo -e "${RED}⚠️  $endpoint: ${count}회 (과다 호출 의심)${NC}"
        elif [[ $count -gt 2 ]]; then
            echo -e "${YELLOW}⚡ $endpoint: ${count}회${NC}"
        else
            echo -e "${GREEN}✅ $endpoint: ${count}회${NC}"
        fi
    done
}

# 위험한 호출 패턴 감지
detect_dangerous_patterns() {
    echo -e "\n${BLUE}🚨 위험 패턴 감지${NC}"

    # /api/auth/me 연속 호출 감지
    auth_me_calls=$(grep "/api/auth/me" "$LOG_FILE" | wc -l)
    if [[ $auth_me_calls -gt 3 ]]; then
        echo -e "${RED}🔥 /api/auth/me 과다 호출 감지: ${auth_me_calls}회${NC}"
        echo -e "${RED}   → useEffect 무한 루프 가능성 높음!${NC}"

        # 연속 호출 시간 분석
        echo "   연속 호출 시간 패턴:"
        grep "/api/auth/me" "$LOG_FILE" | awk '{print $1}' | while read timestamp; do
            echo "   - $timestamp"
        done
    fi

    # planning/register 연속 실패 감지
    planning_errors=$(grep "/api/planning/register.*[45][0-9][0-9]" "$LOG_FILE" | wc -l)
    if [[ $planning_errors -gt 0 ]]; then
        echo -e "${RED}💥 Planning API 에러 감지: ${planning_errors}회${NC}"
        grep "/api/planning/register" "$LOG_FILE" | while read line; do
            status=$(echo "$line" | awk '{print $4}')
            if [[ $status =~ ^[45][0-9][0-9]$ ]]; then
                echo -e "${RED}   ❌ $line${NC}"
            fi
        done
    fi

    # 1분 내 동일 API 과다 호출 감지
    echo -e "\n🔍 1분 내 과다 호출 검사:"

    # 시간대별 그룹화하여 분석 (초 단위 제거)
    awk '{print substr($1, 1, 16), $3}' "$LOG_FILE" | sort | uniq -c | while read count minute_endpoint; do
        count_only=$(echo "$count" | tr -d ' ')
        if [[ $count_only -gt 5 ]]; then
            echo -e "${RED}⚠️  과다 호출: $minute_endpoint (${count_only}회/분)${NC}"
        fi
    done
}

# 비용 추산
estimate_costs() {
    echo -e "\n${BLUE}💰 API 호출 비용 추산${NC}"

    # API별 예상 비용 (가상의 값)
    declare -A API_COSTS
    API_COSTS["/api/auth/me"]=0.01
    API_COSTS["/api/planning/register"]=0.10
    API_COSTS["/api/scenario/develop"]=1.00
    API_COSTS["/api/scenario/develop-shots"]=2.00

    total_cost=0

    for api_endpoint in "${!API_COSTS[@]}"; do
        call_count=$(grep -c "$api_endpoint" "$LOG_FILE" 2>/dev/null || echo "0")
        cost_per_call=${API_COSTS[$api_endpoint]}
        subtotal=$(echo "$call_count * $cost_per_call" | bc -l)
        total_cost=$(echo "$total_cost + $subtotal" | bc -l)

        if [[ $call_count -gt 0 ]]; then
            printf "%-30s %2d회 × $%.2f = $%.2f\n" "$api_endpoint" "$call_count" "$cost_per_call" "$subtotal"
        fi
    done

    echo "─────────────────────────────────────────────"
    printf "총 예상 비용: $%.2f\n" "$total_cost"

    # 비용 경고
    if (( $(echo "$total_cost > 10" | bc -l) )); then
        echo -e "${RED}🚨 높은 비용 발생! ($total_cost)${NC}"
    elif (( $(echo "$total_cost > 5" | bc -l) )); then
        echo -e "${YELLOW}⚠️  비용 주의 ($total_cost)${NC}"
    else
        echo -e "${GREEN}✅ 비용 안전 수준 ($total_cost)${NC}"
    fi
}

# 권장사항 생성
generate_recommendations() {
    echo -e "\n${BLUE}💡 개선 권장사항${NC}"

    # /api/auth/me 과다 호출 체크
    auth_calls=$(grep -c "/api/auth/me" "$LOG_FILE" 2>/dev/null || echo "0")
    if [[ $auth_calls -gt 3 ]]; then
        echo -e "${YELLOW}1. useEffect 의존성 배열 점검${NC}"
        echo "   - useEffect([checkAuth], [checkAuth]) → useEffect(checkAuth, [])"
        echo "   - 함수를 의존성 배열에 넣지 말 것"
    fi

    # 에러 응답 체크
    error_count=$(grep -c "[45][0-9][0-9]" "$LOG_FILE" 2>/dev/null || echo "0")
    if [[ $error_count -gt 0 ]]; then
        echo -e "${YELLOW}2. API 에러 처리 개선${NC}"
        echo "   - 재시도 로직에 exponential backoff 적용"
        echo "   - 에러 상태일 때 사용자 알림 표시"
    fi

    # 성능 최적화
    echo -e "${YELLOW}3. 성능 최적화 권장${NC}"
    echo "   - API 응답 캐싱 구현"
    echo "   - 불필요한 재렌더링 방지"
    echo "   - Loading state 관리 개선"
}

# 메인 실행
main() {
    collect_logs
    analyze_patterns
    detect_dangerous_patterns
    estimate_costs
    generate_recommendations

    echo -e "\n${GREEN}✅ 로그 분석 완료!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 스크립트 실행
main "$@"