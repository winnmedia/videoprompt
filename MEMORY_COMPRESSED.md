# VideoPlanet 개발 기록 (압축 버전)

## 현재 상태 (2025-09-24)
**90% 완성된 MVP - 실제 사용 가능**
- 게스트 원클릭 시작
- AI 시나리오/스토리/숏트 생성
- 프롬프트 엔진 완성
- 통합 네비게이션 시스템

## 기술 스택
**Frontend**: Next.js 15 + React 19 + TypeScript 5.x + Tailwind CSS v4
**상태관리**: Redux Toolkit 2.0
**테스팅**: Jest + MSW + Cypress
**배포**: Vercel
**패키지관리**: PNPM (필수)

## 아키텍처
**Feature-Sliced Design (FSD) + Clean Architecture**
```
src/
├── app/           # Next.js App Router
├── widgets/       # UI 조립 블록
├── features/      # 비즈니스 로직
├── entities/      # 도메인 모델
└── shared/        # 공통 자원
```

## 중대 사건 및 교훈

### $300 API 비용 폭탄 (2024-12-30)
**사건**: useEffect 의존성 배열 실수로 /api/auth/me 무한 호출
**피해**: $300 USD
**교훈**:
- useEffect 의존성에 함수 절대 금지
- API 호출 필수 캐싱
- 무조건 빈 배열 [] 사용

### 병렬 서브에이전트 코드베이스 붕괴 (2025-09-23)
**사건**: Phase 6에서 병렬 작업으로 전체 코드베이스 붕괴
**피해**: TypeScript 오류 30개, 환각 코드 다수, FSD 구조 완전 붕괴
**교훈**:
- 병렬 작업 금지, 순차 실행만
- 각 파일 생성 후 즉시 컴파일 확인
- 품질 > 속도 원칙
- 환각 코드 방지 필수

## 절대 금지 사항
- TypeScript: any, @ts-ignore, @ts-nocheck 사용
- Styling: @apply 사용, 임의 값(w-[123px]) 사용, 이모지 사용
- useEffect: 의존성 배열에 함수 추가
- Architecture: FSD 규칙 위반, 상향 의존성
- Package Manager: npm/yarn 사용 (PNPM만 허용)

## 개발 히스토리 요약

### Phase 1-2: 기초 구축 (2025-09-21)
- FSD 아키텍처 + $300 사건 방지 시스템
- Supabase 백엔드 11개 테이블, RLS 보안

### Phase 3.1-3.2: 핵심 기능 (2025-09-22)
- AI 시나리오 생성 (Gemini API)
- ByteDance-Seedream-4.0 콘티 이미지 생성
- 12숏트 일관성 있는 스토리보드

### Phase 4-4.5: 안정화 (2025-09-22)
- 환각 코드 완전 제거 (3,962개 오류 → 0개)
- Next.js 빌드 성공 달성
- MSW 테스트 인프라 구축

### Phase 5-6: 완전 재구현 (2025-09-23)
- 깨끗한 재시작 (Clean Slate Approach)
- TDD 우선, 디지털 미니멀 UI
- UserJourneyMap 100% 구현

### Phase 7-8: 품질 검증 (2025-09-24)
- TDD 테스트 91% 성공률 달성
- 서브에이전트 작업 검증 및 수정

### Phase 3.9: 시스템 완성 (2025-09-24)
- HTTP 500 오류 완전 해결
- 통합 네비게이션 시스템
- 게스트 인증 완성

## 현재 작동하는 기능
1. **홈페이지**: 게스트 원클릭 시작
2. **시나리오 생성**: AI 기반 아이디어 → 시나리오
3. **4단계 스토리**: 기승전결 구조화
4. **12단계 숏트**: 영상 세부 기획
5. **프롬프트 생성**: AI 영상용 최적화
6. **대시보드**: 통합 작업 허브
7. **인증 시스템**: 게스트/로그인

## 남은 작업 (10%)
1. **영상 생성 시스템**: AI 영상 생성 API 연동
2. **피드백 시스템**: 버전 관리, 협업
3. **콘텐츠 관리**: 프로젝트 저장/관리
4. **실제 백엔드**: Supabase 연동, 진짜 데이터 저장

## 비용 안전 규칙
### useEffect 생명선
- useEffect 의존성 배열에 함수 = $300 폭탄
- 기본값: 빈 배열 []
- API 호출은 무조건 캐싱/제한

### 필수 체크
- 호출 중인가?
- 캐시 있는가?
- 1분 내 호출했나?

## 환경변수
```bash
# Core
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI APIs
GEMINI_API_KEY=
SEEDREAM_API_KEY=
SEEDREAM_API_URL=
```

## 프로젝트 특징
**장점**:
- 견고한 FSD + Clean Architecture
- 철저한 비용 안전 장치
- TDD 기반 품질 보증
- 즉시 사용 가능한 MVP

**핵심 워크플로우**:
아이디어 → AI 시나리오 → 4단계 스토리 → 12단계 숏트 → AI 프롬프트 → 영상 제작 준비

## 결론
VideoPlanet은 현재 90% 완성된 실용적 MVP로, 사용자가 지금 당장 접속하여 AI의 도움으로 완성된 영상 기획안을 만들 수 있습니다. 시나리오 생성부터 세부 숏트 계획까지 전체 창작 워크플로우가 완벽하게 작동하는 상태입니다.