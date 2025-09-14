# VideoPlanet Vercel 환경 변수 설정 가이드

## 🚨 필수 환경 변수

### 데이터베이스
```bash
DATABASE_URL=postgresql://username:password@host:port/database
```
- Railway PostgreSQL 연결 문자열
- 형식: `postgresql://` 또는 `postgres://`로 시작해야 함
- 없으면 앱이 시작되지 않음 (503 에러 발생)

### JWT 인증
```bash
JWT_SECRET=your_secure_jwt_secret_here
JWT_REFRESH_SECRET=your_secure_refresh_secret_here
```
- 최소 32자 이상의 안전한 랜덤 문자열 사용
- 프로덕션과 개발 환경에서 다른 값 사용 권장

### API 서비스
```bash
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
SEEDANCE_API_KEY=your_seedance_api_key
VEO_API_KEY=your_veo_api_key
```
- 영상 생성을 위한 외부 API 키들
- 없으면 해당 기능 사용 불가

### 백엔드 URL
```bash
RAILWAY_BACKEND_URL=https://videoprompt-production.up.railway.app
NEXT_PUBLIC_API_BASE=https://videoprompt-production.up.railway.app
```
- Railway 백엔드 서버 URL
- `NEXT_PUBLIC_` 접두사가 있는 것은 클라이언트에서 접근 가능

### 이메일 서비스 (SendGrid)
```bash
SENDGRID_API_KEY=your_sendgrid_api_key
DEFAULT_FROM_EMAIL=service@vlanet.net
SENDGRID_FROM_NAME=VideoPlanet Service
SENDGRID_SANDBOX_MODE=false
```

## 🎯 기능 플래그 (Feature Flags)

### CineGenius v3.1 기능 (기본 활성화)
```bash
NEXT_PUBLIC_ENABLE_CINEGENIUS_V3=true
NEXT_PUBLIC_ENABLE_STYLE_FUSION=true
```

### 전문가 모드 (선택적)
```bash
NEXT_PUBLIC_ENABLE_EXPERT_MODE=false
```

### 개발 중인 기능들 (비활성화)
```bash
NEXT_PUBLIC_ENABLE_SMPTE_TIMECODE=false
NEXT_PUBLIC_ENABLE_MULTI_AUDIO_LAYERS=false
NEXT_PUBLIC_ENABLE_CONTINUITY_CONTROL=false
NEXT_PUBLIC_ENABLE_GENERATION_CONTROL=false
```

## 🔧 Vercel 설정 방법

1. Vercel Dashboard → Project Settings → Environment Variables
2. 각 환경별 설정:
   - **Production**: 실제 서비스용 값
   - **Preview**: 스테이징/테스트용 값
   - **Development**: 로컬 개발용 값

## ⚠️ 보안 주의사항

1. **절대 GitHub에 실제 API 키 커밋 금지**
2. **JWT Secret은 강력한 랜덤 문자열 사용**
3. **환경별로 다른 DATABASE_URL 사용**
4. **SendGrid 키는 최소 권한만 부여**

## 🏥 헬스체크

환경 변수 설정 후 다음 엔드포인트로 확인:
```bash
curl https://www.vridge.kr/api/health
```

정상적이면 다음과 같은 응답:
```json
{
  "status": "healthy",
  "environment": {
    "DATABASE_URL": true,
    "NODE_ENV": "production"
  },
  "services": {
    "database": {"status": "healthy"},
    "app": "healthy"
  }
}
```

## 🚨 트러블슈팅

### DATABASE_URL 오류
- 증상: 503 에러, "데이터베이스 연결 실패"
- 해결: Railway에서 정확한 연결 문자열 복사

### API 키 오류
- 증상: 401/403 에러
- 해결: 각 서비스에서 유효한 키 재발급

### CORS 오류
- 증상: 브라우저 콘솔에 CORS 에러
- 해결: NEXT_PUBLIC_API_BASE 확인