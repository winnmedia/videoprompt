# Vercel 환경변수 설정 가이드

## 🚨 긴급: LLM 스토리 생성 기능 활성화

현재 **LLM이 스토리 개입하지 않는 문제**는 Vercel 환경변수 설정 누락으로 인한 것입니다.

### 문제 상황
- API는 정상 작동하지만 항상 기본 템플릿만 반환
- Gemini API 키가 프로덕션에서 플레이스홀더 값으로 설정됨
- 실제 LLM 호출이 실패하여 AI 개입 없음

## 즉시 해결 방법

### 1. Vercel 대시보드 접속
1. [Vercel Dashboard](https://vercel.com/dashboard) 로그인
2. `videoprompt` 프로젝트 선택
3. **Settings** → **Environment Variables** 메뉴

### 2. 환경변수 설정

#### 필수 환경변수 추가:

| Variable Name | Value | Environment |
|---|---|---|
| `GOOGLE_GEMINI_API_KEY` | `AIzaSyCaLdlYpOe-SwlFzq5gsCTR8fPr--77Lh4` | Production, Preview |
| `JWT_SECRET` | `videopromptsecurekey2024production` | Production, Preview |
| `DATABASE_URL` | `postgresql://postgres:password@postgres-production-4d2b.up.railway.app:5432/railway` | Production, Preview |
| `RAILWAY_BACKEND_URL` | `https://videoprompt-production.up.railway.app` | Production, Preview |

#### 선택적 환경변수:
| Variable Name | Value | Environment |
|---|---|---|
| `SEEDANCE_API_KEY` | `(실제 키 입력)` | Production, Preview |
| `VEO_API_KEY` | `(실제 키 입력)` | Production, Preview |
| `NEXT_PUBLIC_API_URL` | `https://www.vridge.kr` | Production, Preview |

### 3. 재배포 트리거
환경변수 설정 후:
1. **Deployments** 탭으로 이동
2. 최신 배포의 **⋯** 버튼 클릭
3. **Redeploy** 선택
4. **Use existing Build Cache** 체크 해제
5. **Redeploy** 실행

## 설정 검증

### 배포 완료 후 테스트:
```bash
# API 테스트 (실제 LLM 응답 확인)
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

### 성공 지표:
- ✅ `structure.act1.description`이 입력한 스토리를 반영
- ✅ 각 act의 내용이 선택한 전개 방식을 따름
- ✅ JSON 응답에 풍부한 스토리 내용 포함

## 추가 모니터링

### Vercel Functions 로그 확인:
1. Vercel 대시보드 → **Functions** 탭
2. `api/ai/generate-story` 함수 클릭
3. 최근 Invocations에서 에러 로그 확인

### 예상 로그 출력:
- **수정 전**: "Gemini API 호출 실패" 또는 "JSON 파싱 실패"
- **수정 후**: 정상적인 Gemini API 응답 로그

## 주의사항

⚠️ **보안**: API 키는 외부에 노출되지 않도록 주의
⚠️ **할당량**: Gemini API 무료 할당량 모니터링 필요
⚠️ **백업**: 환경변수 설정 백업 보관

---

**예상 해결 시간**: 환경변수 설정 후 5분 내 LLM 개입 정상화
**담당자**: 개발팀
**우선순위**: 🔥 긴급 (핵심 기능 영향)