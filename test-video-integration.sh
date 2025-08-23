#!/bin/bash
set -euo pipefail

BASE=https://videoprompt-production.up.railway.app

echo "=== VideoPrompt 개별 동영상 생성 테스트 ==="
echo "Target: $BASE"
echo

# 1. Health Check
echo "1. Health Check"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")
echo "   HTTP Status: $STATUS"
echo

# 2. Veo 전용 동영상 생성 테스트
echo "2. Veo 전용 동영상 생성 테스트"
VEO_CREATE=$(curl -sS -X POST "$BASE/api/video/create" \
  -H 'Content-Type: application/json' \
  --data-binary '{"prompt":"A futuristic city at night with neon lights and flying cars","aspect_ratio":"16:9","duration":8,"provider":"veo","veoModel":"veo-3.0-generate-preview"}')
echo "$VEO_CREATE" | jq '.'
VEO_JOB=$(echo "$VEO_CREATE" | jq -r '.operationId // empty')
VEO_PROVIDER=$(echo "$VEO_CREATE" | jq -r '.provider // "unknown"')
echo "   Veo Job ID: $VEO_JOB"
echo "   Veo Provider: $VEO_PROVIDER"
echo

# 3. Seedance 전용 동영상 생성 테스트
echo "3. Seedance 전용 동영상 생성 테스트"
SEEDANCE_CREATE=$(curl -sS -X POST "$BASE/api/video/create" \
  -H 'Content-Type: application/json' \
  --data-binary '{"prompt":"A peaceful mountain landscape with flowing streams","aspect_ratio":"16:9","duration":5,"provider":"seedance"}')
echo "$SEEDANCE_CREATE" | jq '.'
SEEDANCE_JOB=$(echo "$SEEDANCE_CREATE" | jq -r '.operationId // empty')
SEEDANCE_PROVIDER=$(echo "$SEEDANCE_CREATE" | jq -r '.provider // "unknown"')
echo "   Seedance Job ID: $SEEDANCE_JOB"
echo "   Seedance Provider: $SEEDANCE_PROVIDER"
echo

# 4. Veo 상태 확인
if [ -n "${VEO_JOB:-}" ]; then
  echo "4. Veo 상태 확인"
  for i in $(seq 1 3); do
    echo "   Attempt $i/3..."
    VEO_STATUS=$(curl -sS "$BASE/api/video/status/$VEO_JOB?provider=veo")
    if echo "$VEO_STATUS" | jq -e . >/dev/null 2>&1; then
      echo "$VEO_STATUS" | jq -r '"   Veo Status: " + (.status // "unknown") + ", Progress: " + ((.progress // 0) | tostring) + "%"'
      VEO_STATE=$(echo "$VEO_STATUS" | jq -r '.status // empty')
      if [ "$VEO_STATE" = "succeeded" ] || [ "$VEO_STATE" = "failed" ]; then
        echo "$VEO_STATUS" | jq .
        break
      fi
    else
      echo "   Veo Non-JSON status response:" 
      echo "$VEO_STATUS" | sed -n '1,5p'
      break
    fi
    sleep 5
  done
fi

# 5. Seedance 상태 확인
if [ -n "${SEEDANCE_JOB:-}" ]; then
  echo "5. Seedance 상태 확인"
  for i in $(seq 1 3); do
    echo "   Attempt $i/3..."
    SEEDANCE_STATUS=$(curl -sS "$BASE/api/video/status/$SEEDANCE_JOB?provider=seedance")
    if echo "$SEEDANCE_STATUS" | jq -e . >/dev/null 2>&1; then
      echo "$SEEDANCE_STATUS" | jq -r '"   Seedance Status: " + (.status // "unknown") + ", Progress: " + ((.progress // 0) | tostring) + "%"'
      SEEDANCE_STATE=$(echo "$SEEDANCE_STATUS" | jq -r '.status // empty')
      if [ "$SEEDANCE_STATE" = "succeeded" ] || [ "$SEEDANCE_STATE" = "failed" ]; then
        echo "$SEEDANCE_STATUS" | jq .
        break
      fi
    else
      echo "   Seedance Non-JSON status response:" 
      echo "$SEEDANCE_STATUS" | sed -n '1,5p'
      break
    fi
    sleep 5
  done
fi

echo
echo "=== 테스트 완료 ==="
echo "📊 요약:"
echo "   - Veo API: $VEO_PROVIDER (Job: $VEO_JOB)"
echo "   - Seedance API: $SEEDANCE_PROVIDER (Job: $SEEDANCE_JOB)"
echo
echo "💡 사용법:"
echo "   - Veo 사용: provider='veo' 설정"
echo "   - Seedance 사용: provider='seedance' 설정"
echo "   - provider는 반드시 명시해야 함 (auto 선택 불가)"
