#!/bin/bash

# 프로덕션 환경 E2E 테스트 실행 스크립트
# TDD 원칙에 따라 실패하는 테스트부터 실행하여 현재 시스템 상태 파악

set -e

echo "🔍 프로덕션 환경 E2E 테스트 시작..."
echo "대상 URL: https://www.vridge.kr"
echo "=========================================="

# 테스트 결과 디렉토리 생성
mkdir -p test-results/production
mkdir -p playwright-report-production

# 현재 시간 기록
start_time=$(date +%s)

echo "📋 테스트 실행 계획:"
echo "1. 스모크 테스트 (기본 서비스 가용성)"
echo "2. 인증 플로우 테스트 (회원가입/로그인 API 검증)"  
echo "3. 네비게이션 테스트 (페이지 접근성 및 기본 기능)"
echo ""

# 1. 스모크 테스트 먼저 실행 (가장 빠르고 중요)
echo "🚨 1단계: 스모크 테스트 실행 (실패 예상)"
echo "목적: 기본적인 서비스 가용성 및 핵심 API 응답 확인"
pnpm playwright test tests/production/smoke-production.spec.ts --config=playwright.production.config.ts --reporter=list || {
    echo "❌ 스모크 테스트 실패 - 시스템에 심각한 문제가 있을 수 있습니다."
    echo "계속 진행하여 상세한 문제점을 파악합니다..."
}

echo ""
echo "🔐 2단계: 인증 플로우 테스트 실행 (실패 예상)"  
echo "목적: 회원가입/로그인 API의 405/500 에러 여부 확인"
pnpm playwright test tests/production/auth-production.spec.ts --config=playwright.production.config.ts --reporter=list || {
    echo "❌ 인증 테스트 실패 - API 엔드포인트 문제 확인 필요"
}

echo ""
echo "🧭 3단계: 네비게이션 테스트 실행"
echo "목적: 기본 페이지 로드 및 사용자 인터페이스 검증"
pnpm playwright test tests/production/navigation-production.spec.ts --config=playwright.production.config.ts --reporter=list || {
    echo "❌ 네비게이션 테스트 실패 - UI 또는 라우팅 문제 확인 필요"
}

# 테스트 완료 시간 계산
end_time=$(date +%s)
duration=$((end_time - start_time))
minutes=$((duration / 60))
seconds=$((duration % 60))

echo ""
echo "=========================================="
echo "✅ 프로덕션 E2E 테스트 완료"
echo "총 소요 시간: ${minutes}분 ${seconds}초"
echo ""

# 테스트 결과 요약 생성
echo "📊 테스트 결과 요약:"
echo "- 스모크 테스트: 기본 서비스 가용성 검증"
echo "- 인증 테스트: API 엔드포인트 응답 상태 검증" 
echo "- 네비게이션 테스트: 페이지 로드 및 기본 UI 검증"
echo ""

# HTML 리포트가 생성되었다면 경로 안내
if [ -d "playwright-report-production" ]; then
    echo "📋 상세 테스트 리포트:"
    echo "HTML 리포트: playwright-report-production/index.html"
    echo "JSON 결과: test-results-production.json"
    echo ""
    echo "리포트 보기: npx playwright show-report playwright-report-production"
fi

echo "🎯 다음 단계:"
echo "1. 실패한 테스트들을 분석하여 프로덕션 환경의 실제 문제점 파악"
echo "2. 405 에러: API 라우팅 설정 확인 필요"
echo "3. 500 에러: 서버 측 오류 로그 확인 필요"
echo "4. UI 문제: 프론트엔드 빌드 및 배포 상태 확인 필요"

exit 0