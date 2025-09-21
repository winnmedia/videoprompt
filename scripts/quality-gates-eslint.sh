#!/bin/bash

# ESLint 품질 게이트 스크립트
# CLAUDE.md Part 4.1: 품질 게이트 & CI 준수

set -e

echo "🔍 ESLint 품질 게이트 시작..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 카운터 초기화
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# 함수: 체크 결과 출력
check_result() {
    local description="$1"
    local result="$2"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    if [ "$result" -eq 0 ]; then
        echo -e "${GREEN}✅ $description${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ $description${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

# 1. 기본 ESLint 검사
echo -e "\n${BLUE}1. 기본 ESLint 검사${NC}"
if pnpm lint --quiet; then
    check_result "기본 ESLint 규칙 준수" 0
else
    check_result "기본 ESLint 규칙 준수" 1
fi

# 2. $300 방지 규칙 특별 검사
echo -e "\n${BLUE}2. $300 방지 규칙 특별 검사${NC}"
echo "useEffect 의존성 배열 함수 패턴 검사 중..."

# 위험 패턴 검색
DANGEROUS_PATTERNS=(
    "useEffect.*\[.*Function.*\]"
    "useEffect.*\[.*Handler.*\]"
    "useEffect.*\[.*Callback.*\]"
    "useEffect.*\[.*checkAuth.*\]"
    "useEffect.*\[.*authenticate.*\]"
    "useEffect.*\[.*fetchData.*\]"
)

DANGEROUS_FILES=()

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    while IFS= read -r -d '' file; do
        if grep -Pq "$pattern" "$file"; then
            DANGEROUS_FILES+=("$file")
        fi
    done < <(find src -name "*.tsx" -o -name "*.ts" -print0)
done

if [ ${#DANGEROUS_FILES[@]} -eq 0 ]; then
    check_result "$300 방지 규칙 - 위험 패턴 없음" 0
else
    echo -e "${RED}위험 패턴 발견된 파일들:${NC}"
    for file in "${DANGEROUS_FILES[@]}"; do
        echo "  - $file"
    done
    check_result "$300 방지 규칙 - 위험 패턴 발견" 1
fi

# 3. FSD 아키텍처 경계 검증
echo -e "\n${BLUE}3. FSD 아키텍처 경계 검증${NC}"

# 상향 의존성 검사
echo "상향 의존성 패턴 검사 중..."
FSD_VIOLATIONS=()

# entities에서 features로의 잘못된 import 검사
while IFS= read -r -d '' file; do
    if [[ "$file" == *"/entities/"* ]]; then
        if grep -q "@/features\|@/widgets\|@/pages\|@/app" "$file"; then
            FSD_VIOLATIONS+=("$file: entities에서 상위 레이어로의 잘못된 의존성")
        fi
    fi
done < <(find src/entities -name "*.tsx" -o -name "*.ts" -print0 2>/dev/null || true)

# features에서 widgets/pages로의 잘못된 import 검사
while IFS= read -r -d '' file; do
    if [[ "$file" == *"/features/"* ]]; then
        if grep -q "@/widgets\|@/pages\|@/app" "$file"; then
            FSD_VIOLATIONS+=("$file: features에서 상위 레이어로의 잘못된 의존성")
        fi
    fi
done < <(find src/features -name "*.tsx" -o -name "*.ts" -print0 2>/dev/null || true)

if [ ${#FSD_VIOLATIONS[@]} -eq 0 ]; then
    check_result "FSD 아키텍처 경계 준수" 0
else
    echo -e "${RED}FSD 위반 사항들:${NC}"
    for violation in "${FSD_VIOLATIONS[@]}"; do
        echo "  - $violation"
    done
    check_result "FSD 아키텍처 경계 준수" 1
fi

# 4. 금지된 패턴 검사
echo -e "\n${BLUE}4. 금지된 패턴 검사${NC}"

FORBIDDEN_PATTERNS=0

# moment.js 사용 검사
if grep -r "import.*moment\|from ['\"]moment['\"]" src/ --include="*.ts" --include="*.tsx" >/dev/null 2>&1; then
    echo -e "${RED}moment.js 사용 발견${NC}"
    FORBIDDEN_PATTERNS=$((FORBIDDEN_PATTERNS + 1))
fi

# console.log 사용 검사 (warn, error 제외)
if grep -r "console\.log\|console\.debug\|console\.info" src/ --include="*.ts" --include="*.tsx" >/dev/null 2>&1; then
    echo -e "${YELLOW}console.log 사용 발견 (경고)${NC}"
    # 이는 경고로만 처리
fi

# @ts-ignore 사용 검사
if grep -r "@ts-ignore\|@ts-nocheck" src/ --include="*.ts" --include="*.tsx" >/dev/null 2>&1; then
    echo -e "${RED}@ts-ignore 사용 발견${NC}"
    FORBIDDEN_PATTERNS=$((FORBIDDEN_PATTERNS + 1))
fi

# 임의 Tailwind 값 사용 검사
if grep -r "className.*\[.*\]" src/ --include="*.tsx" >/dev/null 2>&1; then
    echo -e "${YELLOW}Tailwind 임의 값 사용 발견 (검토 필요)${NC}"
fi

check_result "금지된 패턴 없음" $((FORBIDDEN_PATTERNS == 0 ? 0 : 1))

# 5. TypeScript 타입 검사
echo -e "\n${BLUE}5. TypeScript 타입 검사${NC}"
if pnpm type-check; then
    check_result "TypeScript 타입 안정성" 0
else
    check_result "TypeScript 타입 안정성" 1
fi

# 6. 순환 의존성 검사
echo -e "\n${BLUE}6. 순환 의존성 검사${NC}"
if pnpm dep:check; then
    check_result "순환 의존성 없음" 0
else
    check_result "순환 의존성 없음" 1
fi

# 결과 요약
echo -e "\n${BLUE}===========================================${NC}"
echo -e "${BLUE}ESLint 품질 게이트 결과 요약${NC}"
echo -e "${BLUE}===========================================${NC}"
echo -e "총 검사 항목: $TOTAL_CHECKS"
echo -e "${GREEN}통과: $PASSED_CHECKS${NC}"
echo -e "${RED}실패: $FAILED_CHECKS${NC}"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 모든 품질 게이트를 통과했습니다!${NC}"
    echo -e "${GREEN}배포 준비 완료 ✅${NC}"
    exit 0
else
    echo -e "\n${RED}💥 품질 게이트 실패!${NC}"
    echo -e "${RED}$FAILED_CHECKS개의 검사 항목이 실패했습니다.${NC}"
    echo -e "${RED}위의 문제들을 해결한 후 다시 시도하세요.${NC}"
    exit 1
fi