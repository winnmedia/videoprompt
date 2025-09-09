# 🚀 배포 체크리스트 - VideoPlanet

## 📋 배포 전 확인사항

### 1. 환경 변수 설정 확인

#### Vercel (Frontend)
- [ ] `DATABASE_URL` - PostgreSQL 연결 문자열 설정
- [ ] `JWT_SECRET` - 프로덕션용 시크릿 키 설정
- [ ] `SENDGRID_API_KEY` - SendGrid API 키 설정
- [ ] `DEFAULT_FROM_EMAIL` - 발신자 이메일 설정 (service@vlanet.net)
- [ ] `SENDGRID_FROM_NAME` - 발신자 이름 설정
- [ ] `SENDGRID_SANDBOX_MODE` - `false`로 설정 (프로덕션)
- [ ] `GOOGLE_GEMINI_API_KEY` - Gemini API 키 설정
- [ ] `NEXT_PUBLIC_APP_URL` - https://www.vridge.kr 설정
- [ ] `NEXT_PUBLIC_API_BASE` - https://videoprompt-production.up.railway.app 설정

#### Railway (Backend)
- [ ] `DATABASE_URL` - PostgreSQL 연결 문자열 설정
- [ ] `JWT_SECRET` - Vercel과 동일한 시크릿 키 설정
- [ ] `SENDGRID_API_KEY` - SendGrid API 키 설정
- [ ] `DEFAULT_FROM_EMAIL` - 발신자 이메일 설정

### 2. 데이터베이스 마이그레이션
```bash
# Railway 환경에서 실행
pnpm prisma migrate deploy
```

## 🧪 배포 후 테스트

### 1. 기본 연결 테스트
- [ ] 프론트엔드 URL 접속 확인 (https://www.vridge.kr)
- [ ] Railway 백엔드 헬스체크 확인
- [ ] 데이터베이스 연결 확인

### 2. 인증 시스템 테스트

#### 회원가입 플로우
1. [ ] `/auth/register` 페이지 접속
2. [ ] 회원가입 폼 입력
   - 이메일: 유효한 이메일 주소
   - 사용자명: 3자 이상
   - 비밀번호: 8자 이상
3. [ ] 회원가입 버튼 클릭
4. [ ] 성공 메시지 확인
5. [ ] 인증 이메일 수신 확인
6. [ ] 이메일의 인증 링크 클릭
7. [ ] 이메일 인증 완료 페이지 확인

#### 로그인 플로우
1. [ ] `/auth/login` 페이지 접속
2. [ ] 인증된 계정으로 로그인
3. [ ] JWT 토큰 발급 확인
4. [ ] 대시보드 리다이렉트 확인

#### 비밀번호 재설정 플로우
1. [ ] `/auth/forgot-password` 페이지 접속
2. [ ] 이메일 입력 및 제출
3. [ ] 비밀번호 재설정 이메일 수신 확인
4. [ ] 이메일의 재설정 링크 클릭
5. [ ] 새 비밀번호 설정
6. [ ] 새 비밀번호로 로그인 확인

### 3. 이메일 시스템 테스트
- [ ] SendGrid 대시보드에서 이메일 발송 로그 확인
- [ ] 이메일 템플릿 렌더링 확인
- [ ] 이메일 내 링크 작동 확인

### 4. 에러 처리 테스트
- [ ] 중복 이메일 회원가입 시도 → 409 에러 메시지 확인
- [ ] 잘못된 형식의 데이터 전송 → 400 에러 메시지 확인
- [ ] 존재하지 않는 이메일로 비밀번호 재설정 → 적절한 메시지 확인

## 🔍 모니터링

### 1. 로그 확인
```bash
# Vercel 로그
vercel logs --follow

# Railway 로그
railway logs
```

### 2. 에러 추적
- [ ] Vercel Functions 로그에서 에러 확인
- [ ] Railway 로그에서 백엔드 에러 확인
- [ ] SendGrid 대시보드에서 이메일 발송 실패 확인

### 3. 성능 모니터링
- [ ] 페이지 로드 시간 확인
- [ ] API 응답 시간 확인
- [ ] 데이터베이스 쿼리 성능 확인

## ⚠️ 문제 발생 시 대응

### 1. 401 Unauthorized 에러
- JWT_SECRET이 Vercel과 Railway에서 동일한지 확인
- 환경 변수가 제대로 로드되는지 확인

### 2. 500 Internal Server Error
- 데이터베이스 연결 문자열 확인
- SendGrid API 키 유효성 확인
- Railway/Vercel 로그 확인

### 3. 이메일 미발송
- SendGrid API 키 확인
- DEFAULT_FROM_EMAIL 도메인 인증 확인
- SENDGRID_SANDBOX_MODE가 false인지 확인
- SendGrid 대시보드에서 발송 로그 확인

## ✅ 최종 확인

- [ ] 모든 테스트 통과
- [ ] 에러 없이 정상 작동
- [ ] 성능 기준 충족
- [ ] 보안 설정 확인 완료

---

## 📝 배포 기록

| 날짜 | 버전 | 담당자 | 주요 변경사항 | 이슈 |
|------|------|--------|--------------|------|
| 2025-01-09 | v1.0.0 | - | SendGrid 이메일 인증 시스템 구현 | - |

---

> 💡 **팁**: 배포 후 최소 24시간 동안 모니터링을 유지하여 예상치 못한 문제를 조기에 발견하세요.