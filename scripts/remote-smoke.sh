#!/usr/bin/env bash
set -euo pipefail

if [ -z "${PW_BASE_URL:-}" ] && [ -z "${RAILWAY_URL:-}" ]; then
  echo "Usage: PW_BASE_URL=https://your-app.railway.app $0" >&2
  exit 1
fi

export PW_BASE_URL=${PW_BASE_URL:-$RAILWAY_URL}
echo "[smoke] baseURL=$PW_BASE_URL"

# health
echo "[smoke] GET /api/health"
curl -fsS "$PW_BASE_URL/api/health" | jq . || curl -fsS "$PW_BASE_URL/api/health" || true

# imagen preview (mock fallback allowed)
echo "[smoke] POST /api/imagen/preview"
curl -fsS -X POST "$PW_BASE_URL/api/imagen/preview" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"sunset beach, cinematic","size":"768x768","n":1}' | jq . || true

# seedance create (mock if no API key)
echo "[smoke] POST /api/seedance/create"
CREATE=$(curl -fsS -X POST "$PW_BASE_URL/api/seedance/create" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"test cinematic scene","aspect_ratio":"16:9","duration_seconds":2}') || true
echo "$CREATE" | jq . || echo "$CREATE"

JOB=$(echo "$CREATE" | jq -r '.jobId // .raw.jobId // .raw.id // empty')
if [ -n "$JOB" ]; then
  echo "[smoke] GET /api/seedance/status/$JOB"
  curl -fsS "$PW_BASE_URL/api/seedance/status/$JOB" | jq . || true
else
  echo "[smoke] no job id returned"
fi

echo "[smoke] done"


