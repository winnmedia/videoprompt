# 🔧 환경변수 설정 가이드

## 📋 목차
1. [개요](#개요)
2. [필수 환경변수](#필수-환경변수)
3. [플랫폼별 설정 방법](#플랫폼별-설정-방법)
4. [문제 해결](#문제-해결)
5. [보안 주의사항](#보안-주의사항)

---

## 개요

VideoPlanet 프로젝트가 올바르게 작동하기 위해서는 다음 환경변수들이 필수적으로 설정되어야 합니다.

## 필수 환경변수

### 🗄️ 데이터베이스
```env
# PostgreSQL 연결 문자열
DATABASE_URL=postgresql://username:password@host:port/database
```

### 🔐 인증
```env
# JWT 시크릿 키 (최소 32자 이상의 랜덤 문자열 권장)
JWT_SECRET=your-super-secure-jwt-secret-key-here
```

### 📧 이메일 서비스 (SendGrid)
```env
# SendGrid API 키
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 발신자 이메일 (도메인 인증 필요)
DEFAULT_FROM_EMAIL=service@yourdomain.com

# 발신자 이름 (선택사항)
SENDGRID_FROM_NAME=VideoPlanet Service

# 샌드박스 모드 (프로덕션에서는 false)
SENDGRID_SANDBOX_MODE=false
```

### 🤖 AI 서비스
```env
# Google Gemini API 키
GOOGLE_GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 🌐 애플리케이션 URL
```env
# 프론트엔드 URL (Vercel에 배포된 Next.js 앱)
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# 백엔드 API URL (Railway에 배포된 백엔드 서버)
NEXT_PUBLIC_API_BASE=https://api.yourdomain.com
```

### 🎬 비디오 생성 서비스 (선택사항)
```env
SEEDANCE_API_KEY=your-seedance-api-key
VEO_API_KEY=your-veo-api-key
```

---

## 플랫폼별 설정 방법

### 1. Vercel (Frontend)

#### 방법 1: Vercel Dashboard
1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. 프로젝트 선택
3. Settings → Environment Variables
4. 각 환경변수 추가:
   - Key: 환경변수 이름
   - Value: 환경변수 값
   - Environment: Production / Preview / Development 선택
5. Save

#### 방법 2: Vercel CLI
```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 환경변수 설정
vercel env add SENDGRID_API_KEY production
vercel env add JWT_SECRET production
# ... 나머지 환경변수들
```

### 2. Railway (Backend)

#### Railway Dashboard
1. [Railway Dashboard](https://railway.app/dashboard) 접속
2. 프로젝트 선택
3. Variables 탭 클릭
4. RAW Editor 또는 개별 추가:
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
SENDGRID_API_KEY=...
DEFAULT_FROM_EMAIL=...
```
5. Deploy 자동 트리거

### 3. 로컬 개발 환경

#### `.env.local` 파일 생성
```bash
# 프로젝트 루트에 .env.local 파일 생성
cp .env.example .env.local

# 파일 편집
nano .env.local
```

#### 예시 `.env.local`:
```env
# 데이터베이스 (로컬 PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/videoprompt

# JWT Secret (개발용)
JWT_SECRET=development-secret-key-for-local-testing

# SendGrid (개발 환경에서는 선택사항)
SENDGRID_API_KEY=SG.your-actual-api-key
DEFAULT_FROM_EMAIL=dev@localhost.com
SENDGRID_SANDBOX_MODE=true

# Google Gemini
GOOGLE_GEMINI_API_KEY=AIza...

# URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE=https://videoprompt-production.up.railway.app
```

---

## 문제 해결

### 🚨 일반적인 오류와 해결 방법

#### 1. "DATABASE_URL environment variable is not set"
- **원인**: DATABASE_URL이 설정되지 않음
- **해결**: 
  - Vercel/Railway에서 DATABASE_URL 환경변수 확인
  - Railway PostgreSQL 서비스가 실행 중인지 확인

#### 2. "SendGrid configuration error: Missing SENDGRID_API_KEY"
- **원인**: SendGrid API 키가 없음
- **해결**:
  - SendGrid 계정에서 API 키 생성
  - 환경변수에 SENDGRID_API_KEY 추가
  - 개발 환경에서는 이메일 기능 없이도 작동 가능

#### 3. 401 Unauthorized 에러
- **원인**: JWT_SECRET이 설정되지 않음
- **해결**:
  - JWT_SECRET 환경변수 설정
  - 프로덕션과 개발 환경의 JWT_SECRET이 다른지 확인

#### 4. 500 Internal Server Error
- **원인**: 다양한 서버 측 오류
- **해결**:
  - Vercel Functions 로그 확인
  - Railway 로그 확인
  - 환경변수 누락 여부 체크

### 📝 환경변수 체크리스트

배포 전 다음 항목들을 확인하세요:

- [ ] DATABASE_URL이 올바른 PostgreSQL 연결 문자열인가?
- [ ] JWT_SECRET이 충분히 안전한 랜덤 문자열인가?
- [ ] SendGrid API 키가 유효한가?
- [ ] DEFAULT_FROM_EMAIL의 도메인이 SendGrid에서 인증되었는가?
- [ ] NEXT_PUBLIC_APP_URL이 실제 도메인을 가리키는가?
- [ ] 프로덕션에서 SENDGRID_SANDBOX_MODE=false로 설정되었는가?

---

## 보안 주의사항

### ⚠️ 절대 하지 말아야 할 것들

1. **환경변수를 코드에 하드코딩하지 마세요**
   ```javascript
   // ❌ 잘못된 예
   const apiKey = "SG.actual-api-key-here";
   
   // ✅ 올바른 예
   const apiKey = process.env.SENDGRID_API_KEY;
   ```

2. **`.env` 파일을 Git에 커밋하지 마세요**
   - `.env.local`, `.env.production` 등은 `.gitignore`에 포함
   - `.env.example`만 커밋

3. **민감한 정보를 로그에 출력하지 마세요**
   ```javascript
   // ❌ 잘못된 예
   console.log('API Key:', process.env.SENDGRID_API_KEY);
   
   // ✅ 올바른 예
   console.log('SendGrid configured:', !!process.env.SENDGRID_API_KEY);
   ```

### 🔒 보안 베스트 프랙티스

1. **강력한 JWT_SECRET 사용**
   ```bash
   # 안전한 랜덤 키 생성
   openssl rand -base64 32
   ```

2. **환경별 다른 값 사용**
   - 개발/스테이징/프로덕션 환경에 다른 API 키 사용
   - 특히 JWT_SECRET은 환경별로 다르게 설정

3. **정기적인 키 로테이션**
   - API 키는 3-6개월마다 갱신
   - 유출 의심 시 즉시 변경

4. **최소 권한 원칙**
   - SendGrid API 키는 메일 발송 권한만 부여
   - 데이터베이스 사용자는 필요한 최소 권한만 부여

---

## 추가 리소스

- [Vercel 환경변수 문서](https://vercel.com/docs/environment-variables)
- [Railway 환경변수 가이드](https://docs.railway.app/develop/variables)
- [SendGrid API 키 생성](https://docs.sendgrid.com/ui/account-and-settings/api-keys)
- [PostgreSQL 연결 문자열 형식](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)

---

> 📌 **도움이 필요하신가요?**  
> 환경변수 설정에 문제가 있다면 프로젝트 관리자에게 문의하세요.