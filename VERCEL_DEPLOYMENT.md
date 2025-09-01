# 🚀 Vercel 자동 배포 설정 가이드

## 📋 사전 준비사항

### 1. Vercel 계정 및 프로젝트 생성

1. [Vercel](https://vercel.com)에 가입/로그인
2. "New Project" 클릭
3. GitHub 저장소 연결
4. 프로젝트 이름: `videoprompt`
5. Framework Preset: `Next.js`
6. "Deploy" 클릭

### 2. Vercel 프로젝트 설정에서 필요한 정보 수집

- **Vercel Token**: Settings → Tokens → Create
- **Organization ID**: Settings → General → Organization ID
- **Project ID**: Settings → General → Project ID

## 🔧 GitHub Secrets 설정

### GitHub 저장소에서 다음 Secrets 설정:

1. `Settings` → `Secrets and variables` → `Actions`
2. `New repository secret` 클릭하여 추가:

```bash
VERCEL_TOKEN=your_vercel_token_here
ORG_ID=your_organization_id_here
PROJECT_ID=your_project_id_here
```

## 🌍 환경변수 설정

### Vercel 대시보드에서 환경변수 설정:

1. 프로젝트 → `Settings` → `Environment Variables`
2. 다음 변수들을 추가:

```bash
# 필수
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app

# 선택사항 (자동 감지되지만 명시적으로 설정 가능)
NEXT_PUBLIC_API_BASE_URL=https://videoprompt-production.up.railway.app/api

# AI 서비스 API 키들
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
SEEDANCE_API_KEY=your_seedance_api_key
```

## 🔄 자동 배포 워크플로우

### GitHub Actions 워크플로우가 자동으로 실행됩니다:

#### **트리거 조건**:

- `main` 또는 `master` 브랜치에 푸시
- Pull Request 생성/업데이트

#### **실행 단계**:

1. ✅ 코드 체크아웃
2. 🔧 Node.js 20 설정
3. 📦 의존성 설치
4. 🧪 테스트 실행
5. 🏗️ 애플리케이션 빌드
6. 🚀 Vercel 배포
7. 💬 PR 코멘트 (Pull Request인 경우)

## 📱 배포 결과

### **Preview 배포** (Pull Request):

- URL: `https://videoprompt-git-{branch}-{username}.vercel.app`
- 자동으로 PR에 코멘트로 URL 제공

### **Production 배포** (main 브랜치):

- URL: `https://your-domain.vercel.app`
- 메인 도메인으로 자동 배포

## 🔍 배포 상태 확인

### **Vercel 대시보드**:

- [Vercel Dashboard](https://vercel.com/dashboard)
- 실시간 배포 상태 및 로그 확인
- 환경변수 관리
- 도메인 설정

### **GitHub Actions**:

- [Actions 탭](https://github.com/username/videoprompt/actions)
- 워크플로우 실행 상태 확인
- 배포 로그 및 에러 디버깅

## 🚨 문제 해결

### **배포 실패 시**:

1. GitHub Actions 로그 확인
2. Vercel 대시보드에서 에러 메시지 확인
3. 환경변수 설정 확인
4. API 키 유효성 검증

### **환경변수 문제**:

1. `NEXT_PUBLIC_` 접두사 확인
2. Vercel에서 환경변수 재설정
3. 프로젝트 재배포

### **API 연결 문제**:

1. Railway 백엔드 상태 확인
2. CORS 설정 확인
3. API 키 유효성 검증

## 🎯 최적화 팁

### **빌드 최적화**:

- `vercel.json`에서 함수 타임아웃 설정
- 불필요한 파일 `.vercelignore`에 추가
- 이미지 최적화 설정

### **성능 모니터링**:

- Vercel Analytics 활성화
- Core Web Vitals 모니터링
- 실시간 성능 메트릭 확인

## 📞 지원

### **문제 발생 시**:

1. GitHub Issues에 버그 리포트
2. Vercel Support 팀 문의
3. 프로젝트 문서 확인

---

**🎉 이제 GitHub에 푸시할 때마다 자동으로 Vercel에 배포됩니다!**
