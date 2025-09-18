# Vercel 배포 가이드 - VideoPlanet

## 🚨 긴급 수정 내역 (2025-09-18)

### 문제: Vercel 빌드 실패 - Prisma Client 타입 불일치
- **증상**: `prisma.planning.create`에서 `projectId` 필드 TypeScript 오류
- **원인**: Vercel 환경에서 prisma generate가 올바르게 실행되지 않음
- **해결**: 빌드 순서 개선 및 명령어 최적화

### 수정된 파일
1. **vercel.json**: `buildCommand` 개선
2. **package.json**: `vercel-build` 스크립트 추가
3. **환경변수**: 빌드 캐시 무효화

---

## Vercel 프로젝트 설정

### 1. 필수 환경변수 (Vercel Dashboard에서 설정)

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database
DIRECT_URL=postgresql://username:password@host:port/database

# NextAuth.js
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://your-app.vercel.app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Keys
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# 기타
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### 2. 빌드 설정 확인

Vercel 프로젝트에서 다음 설정이 적용되었는지 확인:

- **Install Command**: `pnpm install --frozen-lockfile`
- **Build Command**: `prisma generate && pnpm run vercel-build`
- **Output Directory**: `.next`
- **Node Version**: `20.x`

### 3. 빌드 순서 보장

현재 `vercel-build` 스크립트는 다음 순서로 실행됩니다:

```bash
prisma generate → prebuild → next build → postbuild
```

각 단계별 체크포인트:
1. **prisma generate**: Prisma Client 생성
2. **prebuild**: 보안 키 검증, 빌드 환경 확인
3. **next build**: Next.js 애플리케이션 빌드
4. **postbuild**: 빌드 검증 및 완료 확인

---

## 배포 전 체크리스트

### 로컬 환경 검증
```bash
# 1. TypeScript 컴파일 확인
pnpm run type-check

# 2. Prisma 스키마 검증
pnpm run prisma:generate

# 3. 빌드 테스트
pnpm run vercel-build

# 4. 품질 게이트 통과
pnpm run quality-gates
```

### Vercel 환경 검증
1. **환경변수 설정 완료**
2. **Database 연결 확인**
3. **API Keys 유효성 검증**
4. **도메인 설정 (필요시)**

---

## 트러블슈팅

### 빌드 실패 시 대응

#### 1. Prisma 관련 오류
```bash
# 증상: "Property 'projectId' does not exist on type..."
# 해결: 빌드 캐시 강제 초기화

# Vercel Dashboard에서:
# Settings → Functions → Clear Cache
# 또는 환경변수 FORCE_REBUILD 값 변경
```

#### 2. 환경변수 오류
```bash
# 증상: "Environment variable ... is not defined"
# 해결: Vercel Dashboard → Settings → Environment Variables 확인

# 필수 변수 누락 확인:
- DATABASE_URL
- DIRECT_URL
- NEXTAUTH_SECRET
```

#### 3. 빌드 타임아웃
```bash
# 증상: Build timeout after 20 minutes
# 해결: 빌드 최적화

# 1. 의존성 정리
pnpm prune

# 2. 캐시 최적화
# vercel.json의 buildCommand 확인
```

### 배포 후 검증

```bash
# 1. Health Check API 호출
curl https://your-app.vercel.app/api/health

# 2. Database 연결 확인
curl https://your-app.vercel.app/api/planning/health

# 3. 인증 시스템 확인
curl https://your-app.vercel.app/api/auth/me
```

---

## 성능 최적화

### 1. 빌드 시간 단축
- **Incremental Static Regeneration** 활용
- **컴포넌트 lazy loading** 적용
- **Bundle analyzer** 정기 실행

### 2. 런타임 최적화
- **API Routes 메모리 설정** (vercel.json 확인)
- **Database 커넥션 풀링**
- **캐싱 전략** 적용

### 3. 모니터링
- **Vercel Analytics** 활성화
- **Error Tracking** 설정
- **Performance Metrics** 추적

---

## 보안 설정

### 1. 환경변수 보안
- **Production 전용 키** 사용
- **IP 제한** (Database)
- **CORS 설정** 확인

### 2. API 보안
- **Rate Limiting** 적용
- **Authentication** 검증
- **Input Validation** 강화

---

## 연락처 및 지원

배포 관련 문제 발생 시:
1. **로그 확인**: Vercel Dashboard → Functions → View Logs
2. **이슈 보고**: GitHub Issues 또는 팀 채널
3. **긴급 상황**: Backend Lead Benjamin에게 직접 연락

**마지막 업데이트**: 2025-09-18
**담당자**: Backend Lead Benjamin