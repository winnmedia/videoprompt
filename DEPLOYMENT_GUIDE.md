# 🚀 배포 가이드 (Deployment Guide)

## 📋 개요

이 문서는 VideoPrompt 프로젝트의 배포 프로세스와 관련된 모든 정보를 포함합니다.

## 🏗️ 아키텍처

### Frontend (Vercel)
- **플랫폼**: Vercel
- **프로젝트**: vlanets-projects/videoprompt
- **도메인**: `https://videoprompt-{hash}-vlanets-projects.vercel.app`
- **배포 방식**: GitHub 연동 자동 배포

### Backend (Railway)
- **플랫폼**: Railway
- **프로젝트**: videoprompt-production
- **도메인**: `https://videoprompt-production.up.railway.app`
- **역할**: 외부 API 프록시 및 중계

## 🔄 배포 프로세스

### 1. 개발 워크플로우

```bash
# 1. 코드 수정
git add .
git commit -m "feat: 새로운 기능 추가"

# 2. GitHub 푸시 (자동 배포 트리거)
git push origin main

# 3. Vercel 자동 배포 시작
# - GitHub Actions 없음
# - Vercel이 직접 감지하여 배포
```

### 2. 배포 단계

#### Frontend 배포 (Vercel)
1. **GitHub 푸시 감지** → Vercel이 자동으로 새 배포 시작
2. **빌드 프로세스** → Next.js 프로덕션 빌드
3. **배포 검증** → 빌드 성공 시 자동 배포
4. **도메인 할당** → 새로운 해시 기반 URL 생성

#### Backend 상태 확인
```bash
# Railway 백엔드 상태 확인
curl https://videoprompt-production.up.railway.app/api/health

# 응답 예시
{
  "ok": true,
  "uptimeSec": 1234,
  "timestamp": "2025-08-25T12:00:00.000Z",
  "degraded": false
}
```

## 🛠️ 배포 명령어

### Vercel CLI 명령어

```bash
# 배포 목록 확인
vercel ls

# 최신 배포 상태 확인
vercel ls | head -5

# 특정 배포 로그 확인
vercel logs [deployment-url]

# 수동 배포 (필요시)
vercel --prod
```

### Git 명령어

```bash
# 현재 상태 확인
git status

# 모든 변경사항 추가
git add .

# 커밋
git commit -m "feat: 기능 설명"

# GitHub 푸시 (자동 배포 트리거)
git push origin main
```

## 📊 배포 모니터링

### 1. 배포 상태 확인

```bash
# 실시간 배포 상태
vercel ls | head -10

# 배포 상태 해석
● Ready     → 배포 성공
● Building  → 빌드 진행 중
● Error     → 배포 실패
● Queued    → 배포 대기 중
```

### 2. 배포 실패 시 대응

#### 빌드 실패
```bash
# 로컬 빌드 테스트
npm run build

# 타입 체크
npm run type-check

# 린트 체크
npm run lint
```

#### 배포 실패
```bash
# 배포 로그 확인
vercel logs [failed-deployment-url]

# 이전 성공 배포로 롤백
# Vercel 대시보드에서 수동 롤백
```

## 🔧 환경 설정

### Frontend 환경변수 (Vercel)
- `SEEDANCE_API_KEY`: Seedance API 키
- `SEEDANCE_MODEL`: 사용할 모델
- `SEEDANCE_API_BASE`: API 기본 URL
- `NEXT_PUBLIC_ENABLE_DEBUG`: 디버그 모드
- `LOCAL_STORAGE_PATH`: 로컬 저장소 경로

### Backend 환경변수 (Railway)
- Railway 대시보드에서 직접 설정
- 프론트엔드와 동일한 API 키 사용

## 📈 배포 최적화

### 1. 빌드 최적화
- **Next.js 최적화**: 자동 코드 스플리팅
- **이미지 최적화**: Next.js Image 컴포넌트 사용
- **번들 크기**: Tree shaking 및 코드 분할

### 2. 성능 모니터링
- **Core Web Vitals**: Vercel Analytics
- **API 응답 시간**: Railway 로그 모니터링
- **사용자 경험**: 실시간 성능 지표

## 🚨 문제 해결

### 일반적인 문제들

#### 1. 빌드 타임아웃
```bash
# 로컬 빌드 테스트
npm run build

# 메모리 부족 시
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

#### 2. API 연결 실패
```bash
# Railway 백엔드 상태 확인
curl https://videoprompt-production.up.railway.app/api/health

# 네트워크 연결 테스트
ping videoprompt-production.up.railway.app
```

#### 3. 환경변수 문제
```bash
# Vercel 환경변수 확인
vercel env ls

# 로컬 환경변수 확인
cat .env.local
```

## 📚 추가 리소스

### 공식 문서
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

### 유용한 도구
- **Vercel CLI**: `npm i -g vercel`
- **Railway CLI**: `npm i -g @railway/cli`
- **GitHub CLI**: `npm i -g gh`

## 🔄 배포 체크리스트

### 배포 전 체크
- [ ] 로컬 빌드 성공 (`npm run build`)
- [ ] 타입 체크 통과 (`npm run type-check`)
- [ ] 테스트 통과 (`npm test`)
- [ ] 커밋 메시지 명확성 확인

### 배포 후 체크
- [ ] Vercel 배포 상태 확인 (`vercel ls`)
- [ ] Railway 백엔드 상태 확인
- [ ] 주요 기능 동작 테스트
- [ ] 에러 로그 모니터링

---

**마지막 업데이트**: 2025-08-25
**버전**: 1.0.0
**담당자**: 개발팀
