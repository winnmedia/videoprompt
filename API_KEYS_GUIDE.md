# 🔑 API 키 설정 가이드

## 현재 상태
- ✅ **Gemini API**: 정상 작동 중 (로컬 + 프로덕션 설정 필요)
- ⚠️ **Seedance API**: 플레이스홀더 키 → 실제 키 교체 필요
- ⚠️ **Veo3 API**: 플레이스홀더 키 → 실제 키 교체 필요

## 📍 즉시 해결 방법

### 1. Vercel 프로덕션 설정 (5분)
1. [Vercel Dashboard](https://vercel.com/dashboard) → `videoprompt` → **Settings** → **Environment Variables**
2. 환경변수 추가:
   ```
   GOOGLE_GEMINI_API_KEY = AIzaSyCaLdlYpOe-SwlFzq5gsCTR8fPr--77Lh4
   JWT_SECRET = videopromptsecurekey2024production
   DATABASE_URL = postgresql://postgres:password@postgres-production-4d2b.up.railway.app:5432/railway
   RAILWAY_BACKEND_URL = https://videoprompt-production.up.railway.app
   ```
3. **재배포**: Build Cache 체크 해제 → Redeploy

### 2. 실제 영상 생성을 위한 API 키 설정

#### Seedance API 키 획득
1. [Seedance 웹사이트](https://www.seedance.ai/) 방문
2. 개발자 계정 생성 및 API 키 발급
3. 환경변수 교체:
   ```bash
   # .env.local (로컬)
   SEEDANCE_API_KEY=실제_seedance_키
   
   # Vercel (프로덕션)
   SEEDANCE_API_KEY = 실제_seedance_키
   ```

#### Google Veo3 API 키 획득  
1. [Google AI Studio](https://makersuite.google.com/app/apikey) 방문
2. Veo API 액세스 신청 및 키 발급
3. 환경변수 교체:
   ```bash
   # .env.local (로컬)  
   VEO_API_KEY=실제_veo3_키
   
   # Vercel (프로덕션)
   VEO_API_KEY = 실제_veo3_키
   ```

## ✅ 검증 방법

### 테스트 스크립트 실행
```bash
# 로컬 테스트
node test-llm-intervention.js

# API 직접 테스트
curl -X POST https://www.vridge.kr/api/ai/generate-story \
  -H "Content-Type: application/json" \
  -d '{
    "story": "우주 탐험가가 미지의 행성을 발견한다",
    "genre": "SF", 
    "tone": "미스터리, 웅장함",
    "target": "일반",
    "developmentMethod": "훅-몰입-반전-떡밥"
  }'
```

### 성공 지표
- ✅ LLM 응답에서 "LLM 개입 완료" 로그 확인
- ✅ `structure.act1.description`이 입력 스토리를 반영
- ✅ 실제 영상 URL 반환 (Mock이 아닌)

## 🚀 결과 예상

**환경변수 설정 완료 후:**
- ✅ **100% 완전 작동**하는 AI 영상 제작 플랫폼
- ✅ 실제 Gemini LLM 스토리 생성
- ✅ 실제 Seedance/Veo3 영상 생성 
- ✅ 전체 워크플로우 정상화

**소요 시간**: 약 **10-15분** (API 키 발급 시간 제외)