#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/home/winnmedia/prompting/videoplanet"
PORT=3000
BASE="http://localhost:${PORT}"
LOGFILE="${ROOT}/dev-local.log"
STARTED_BY_SCRIPT=0

note() { echo "[api-smoke] $*"; }

kill_port() {
  if command -v fuser >/dev/null 2>&1; then fuser -k ${PORT}/tcp || true; fi
  pkill -f "next dev" || true
}

wait_health() {
  local tries=${1:-120}
  for i in $(seq 1 "$tries"); do
    if curl -sSf "${BASE}/api/health" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

start_server_if_needed() {
  if curl -sSf "${BASE}/api/health" >/dev/null 2>&1; then
    note "dev server already running on :${PORT}"
    return 0
  fi
  note "starting dev server on :${PORT}"
  kill_port || true
  (cd "$ROOT" && nohup npm run dev -- -p ${PORT} >"$LOGFILE" 2>&1 & echo $! > "${ROOT}/.dev.pid")
  STARTED_BY_SCRIPT=1
  wait_health 120 || { note "health check failed"; tail -n 120 "$LOGFILE" || true; exit 1; }
}

cleanup() {
  if [[ "$STARTED_BY_SCRIPT" == "1" ]]; then
    note "stopping dev server"
    if [[ -f "${ROOT}/.dev.pid" ]]; then
      PID=$(cat "${ROOT}/.dev.pid" || true)
      if [[ -n "${PID:-}" ]]; then kill "$PID" || true; fi
      rm -f "${ROOT}/.dev.pid"
    fi
    kill_port || true
  fi
}
trap cleanup EXIT

cd "$ROOT"

start_server_if_needed

note "HEALTH"
curl -sS "${BASE}/api/health" | sed -e 's/\x1b\[[0-9;]*m//g'
echo

note "IMAGEN PREVIEW (16:9 x1)"
IMAGEN_PAYLOAD='{"prompt":"smoke test cinematic image, 16:9","size":"1280x720","n":1}'
IMAGEN_RESP=$(curl -sS -X POST "${BASE}/api/imagen/preview" -H "Content-Type: application/json" -d "$IMAGEN_PAYLOAD" || true)
echo "$IMAGEN_RESP"
if ! echo "$IMAGEN_RESP" | grep -q '"ok":true'; then
  note "imagen preview failed"
  exit 2
fi

note "SEEDANCE CREATE"
SEEDANCE_PAYLOAD='{"prompt":"smoke test for seedance","aspect_ratio":"16:9","duration_seconds":2}'
SEEDANCE_RESP=$(curl -sS -X POST "${BASE}/api/seedance/create" -H "Content-Type: application/json" -d "$SEEDANCE_PAYLOAD" || true)
echo "$SEEDANCE_RESP"

# Extract jobId using node if available, else fallback to sed
JOB_ID=""
if command -v node >/dev/null 2>&1; then
  JOB_ID=$(node -e "const s=process.argv[1];try{const j=JSON.parse(s);console.log(j.jobId||j.raw?.jobId||j.raw?.id||'');}catch{console.log('');}" "$SEEDANCE_RESP")
fi
if [[ -z "$JOB_ID" ]]; then
  JOB_ID=$(printf "%s" "$SEEDANCE_RESP" | sed -n 's/.*"jobId":"\([^"]*\)".*/\1/p')
fi

if [[ -n "$JOB_ID" ]]; then
  note "SEEDANCE STATUS (jobId=$JOB_ID)"
  BACKOFF=1
  for i in $(seq 1 8); do
    STATUS=$(curl -sS "${BASE}/api/seedance/status/${JOB_ID}" || true)
    echo "$STATUS"
    if echo "$STATUS" | grep -Eq '"status":"(succeeded|completed)"|"videoUrl"'; then
      note "seedance finished"
      break
    fi
    sleep "$BACKOFF"; BACKOFF=$(( BACKOFF < 10 ? BACKOFF+1 : 10 ))
  done
else
  note "no jobId in create response; skipping status"
fi

note "DONE"


