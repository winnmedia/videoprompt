# 🔧 Seedance API 401 오류 해결 가이드

## 📋 문제 요약

### 현재 오류
```json
{
  "error": {
    "code": "AuthenticationError",
    "message": "The API key format is incorrect",
    "type": "Unauthorized"
  }
}
```

### 근본 원인
- **API 키 형식 오류**: UUID 형식 키가 아닌 BytePlus 전용 토큰 필요
- **모델명 불일치**: 커스텀 엔드포인트 ID 대신 공식 모델명 사용 필요

## 🎯 BytePlus 콘솔에서 API 키 재설정

### 1단계: BytePlus 콘솔 접속
1. [BytePlus Console](https://console.byteplus.com) 접속
2. BytePlus 계정으로 로그인
3. **ModelArk** 서비스 선택

### 2단계: API 키 생성
1. 좌측 메뉴에서 **API Keys** 또는 **API Key Management** 선택
2. **Create API Key** 버튼 클릭
3. API 키 설정:
   - **Name**: `VideoPlanet-Production`
   - **Permissions**:
     - ✅ Video Generation
     - ✅ Content Generation
     - ✅ ModelArk Access
4. **Generate** 클릭

### 3단계: API 키 복사
- 생성된 API 키를 안전한 곳에 복사
- 형식: `ark_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 또는 긴 Base64 문자열
- ⚠️ **중요**: 이 키는 한 번만 표시되므로 즉시 저장

### 4단계: 모델 확인
지원되는 공식 모델 목록:
- `seedance-1-0-pro-250528` (프리미엄, 고품질)
- `seedance-1-0-lite-t2v-250428` (라이트, 텍스트→비디오)
- `seedance-1-0-lite-i2v-250428` (라이트, 이미지→비디오)

## 🔧 환경변수 수정

### `.env.local` 파일 업데이트
```bash
# ❌ 잘못된 설정 (현재)
SEEDANCE_API_KEY=007f7ffe-cefa-4343-adf9-607f9ae9a7c7  # UUID 형식
SEEDANCE_MODEL=ep-20250915111050-t59w6  # 커스텀 엔드포인트

# ✅ 올바른 설정 (수정 필요)
SEEDANCE_API_KEY=ark_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # BytePlus 토큰
SEEDANCE_MODEL=seedance-1-0-lite-t2v-250428  # 공식 모델명
SEEDANCE_API_BASE=https://ark.ap-southeast.bytepluses.com
```

### 환경변수 검증 스크립트 실행
```bash
node scripts/check-env.js
```

## 📊 코드 개선 사항 (이미 적용됨)

### 모델 선택 로직 개선
```typescript
// 공식 지원 모델 목록
const supportedModels = [
  'seedance-1-0-pro-250528',
  'seedance-1-0-lite-t2v-250428',
  'seedance-1-0-lite-i2v-250428'
];

// 스마트 모델 선택
// 1. 공식 모델명 우선
// 2. 엔드포인트 ID 대체 (레거시)
// 3. 기본값: seedance-1-0-lite-t2v-250428
```

## 🚀 즉시 해결 단계

### 1. API 키 교체
```bash
# 1. BytePlus 콘솔에서 새 API 키 생성
# 2. .env.local 파일 수정
SEEDANCE_API_KEY=<새로_생성한_키>
SEEDANCE_MODEL=seedance-1-0-lite-t2v-250428
```

### 2. 서버 재시작
```bash
# 개발 서버 재시작
pkill -f "pnpm dev"
pnpm dev
```

### 3. API 테스트
```bash
curl -X POST http://localhost:3002/api/seedance/create \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Professional AI demonstration video",
    "aspect_ratio": "16:9",
    "duration_seconds": 8
  }'
```

## ⚠️ 주의사항 및 제한

### 무료 토큰 제한
- BytePlus ModelArk는 **50만 토큰 무료** 제공
- 토큰 소진 후 자동으로 서비스 중단
- 계속 사용하려면 유료 플랜 전환 필요

### RPM (분당 요청) 제한
- 모델별로 다른 RPM 제한
- 제한 초과 시 일시적 차단
- 프로덕션 환경에서는 요청 간격 조절 필요

### 결과 보존 기간
- 생성된 비디오는 **24시간**만 보존
- 24시간 내에 다운로드/저장 필요

## 🎯 예상 결과

올바른 설정 후 기대 응답:
```json
{
  "success": true,
  "data": {
    "jobId": "task_xxxxxxxxxxxxxx",
    "status": "queued",
    "dashboardUrl": "https://...",
    "metadata": {
      "prompt": "Professional AI demonstration video",
      "duration": 8,
      "aspectRatio": "16:9",
      "requestedAt": "2025-09-15T20:45:00Z"
    }
  }
}
```

## 🔍 추가 디버깅

### 상태 조회 API
```bash
curl -X GET http://localhost:3002/api/seedance/status/task_xxxxxxxxxxxxxx \
  -H "Authorization: Bearer <API_KEY>"
```

### 로그 확인
```bash
# 서버 로그에서 상세 오류 확인
tail -f logs/app.log | grep -i seedance
```

### 공식 문서 참조
- [BytePlus ModelArk Video Generation](https://docs.byteplus.com/en/docs/ModelArk/1366799)
- [API Key Management](https://docs.byteplus.com/en/docs/ModelArk/1359520)

---
*작성일: 2025-09-15*
*최종 업데이트: 환경변수 템플릿 및 코드 개선 완료*