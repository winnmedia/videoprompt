# Seedance API 설정 가이드

## 🚀 빠른 설정

### 1. 환경변수 파일 수정

`.env.local` 파일을 다음과 같이 수정하세요:

```bash
# 기존 설정 유지
SEEDANCE_API_KEY=1edd4a12-cd66-4df6-a89a-7ac129129602

# 🔴 이 부분을 수정하세요
SEEDANCE_API_BASE=https://ark.ap-southeast.bytepluses.com
SEEDANCE_MODEL=ep-20250821162311-7r559

# ❌ 이전 설정 제거
# MODELARK_API_BASE=https://api.byteplusapi.com
# SEEDANCE_API_URL_CREATE=https://api.byteplusapi.com/modelark/video_generation/tasks
# SEEDANCE_API_URL_STATUS=https://api.byteplusapi.com/modelark/video_generation/tasks/{id}
```

### 2. 서버 재시작

환경변수를 수정한 후 개발 서버를 재시작하세요:

```bash
# Ctrl+C로 서버 중지 후
npm run dev
```

## 🔧 상세 설정

### 필수 환경변수

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `SEEDANCE_API_KEY` | `1edd4a12-cd66-4df6-a89a-7ac129129602` | API 인증 키 |
| `SEEDANCE_API_BASE` | `https://ark.ap-southeast.bytepluses.com` | Ark v3 API 기본 URL |
| `SEEDANCE_MODEL` | `ep-20250821162311-7r559` | 엔드포인트 ID |

### 선택 환경변수

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `NEXT_PUBLIC_ENABLE_MOCK_API` | `false` | Mock 모드 활성화 |
| `SEEDANCE_WEBHOOK_SECRET` | - | 웹훅 서명 검증 |

## 🧪 테스트

### 1. API 상태 확인

브라우저에서 다음 URL을 확인하세요:
```
http://localhost:3000/api/seedance/diagnose
```

성공 응답:
```json
{
  "ok": true,
  "hasKey": true,
  "hasModel": true,
  "baseUrl": "https://ark.ap-southeast.bytepluses.com"
}
```

### 2. 시나리오 개발 모드 테스트

1. `/wizard` 페이지 접속
2. "시나리오 개발 모드" 탭 선택
3. 간단한 시나리오 입력
4. "시나리오 개발하기" 클릭
5. "영상 생성하기" 클릭

## ❌ 문제 해결

### 오류: "Seedance model/endpoint is not configured"

**원인**: `SEEDANCE_MODEL` 환경변수가 설정되지 않음

**해결**:
```bash
# .env.local에 추가
SEEDANCE_MODEL=ep-20250821162311-7r559
```

### 오류: "502 Bad Gateway"

**원인**: 잘못된 API 엔드포인트

**해결**:
```bash
# .env.local에서 수정
SEEDANCE_API_BASE=https://ark.ap-southeast.bytepluses.com
```

### 오류: "Failed to fetch"

**원인**: 네트워크 연결 문제 또는 잘못된 URL

**해결**:
1. 환경변수 확인
2. 서버 재시작
3. 네트워크 연결 상태 확인

## 📚 API 문서

- **Ark v3 API**: https://ark.ap-southeast.bytepluses.com/docs
- **BytePlus ModelArk**: https://www.byteplus.com/en/product/modelark

## 🔍 디버깅

### 로그 확인

개발 서버 콘솔에서 다음을 확인하세요:
- 환경변수 로드 상태
- API 요청/응답 로그
- 에러 메시지

### 네트워크 탭

브라우저 개발자 도구 > Network 탭에서:
- API 요청 URL
- 요청 헤더
- 응답 상태 코드
- 응답 본문



