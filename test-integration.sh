#!/bin/bash
set -euo pipefail

BASE=https://videoprompt-production.up.railway.app

echo "=== VideoPrompt Integration Test ==="
echo "Target: $BASE"
echo

# 1. Health Check
echo "1. Health Check"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")
echo "   HTTP Status: $STATUS"
echo

# 2. Image Preview Test
echo "2. Image Preview Test (OpenAI LLM / DALL·E)"
PREVIEW=$(curl -sS -X POST "$BASE/api/imagen/preview" \
  -H 'Content-Type: application/json' \
  --data-binary '{"prompt":"A cinematic sunset scene at the beach with golden hour lighting","size":"1280x720","n":1}')
echo "$PREVIEW" | jq -r 'if .ok then "   Success: Image preview generated" else "   Failed: " + .error end'
echo

# 3. Seedance Video Creation
echo "3. Seedance Video Creation"
CREATE=$(curl -sS -X POST "$BASE/api/seedance/create" \
  -H 'Content-Type: application/json' \
  --data-binary '{"prompt":"A cinematic sunset scene at the beach","aspect_ratio":"16:9","duration_seconds":3}')
echo "$CREATE" | jq '.'
JOB=$(echo "$CREATE" | jq -r '.jobId // .raw.id // empty')
echo "   Job ID: $JOB"
echo

# 4. Video Status Check (if job created)
if [ -n "${JOB:-}" ]; then
  echo "4. Video Status Check"
  for i in $(seq 1 5); do
    echo "   Attempt $i/5..."
    STATUS=$(curl -sS "$BASE/api/seedance/status/$JOB")
    if echo "$STATUS" | jq -e . >/dev/null 2>&1; then
      echo "$STATUS" | jq -r '"   Status: " + (.status // "unknown") + ", Progress: " + ((.progress // 0) | tostring) + "%"'
      STATE=$(echo "$STATUS" | jq -r '.status // empty')
      if [ "$STATE" = "succeeded" ] || [ "$STATE" = "failed" ]; then
        echo "$STATUS" | jq .
        break
      fi
    else
      echo "   Non-JSON status response:" 
      echo "$STATUS" | sed -n '1,5p'
    
      break
    fi
    sleep 3
  done
fi

echo
echo "=== Test Complete ==="
