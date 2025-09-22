# 관리자 대시보드 FSD 아키텍처 설계 요약

## 🏗️ 전체 아키텍처 개요

### FSD 레이어 구조
```
src/
├── entities/admin/          # 도메인 모델 (비즈니스 로직)
├── features/admin/          # 비즈니스 기능 (훅, 상태관리)
├── widgets/admin/           # UI 컴포넌트 (재사용 가능한 위젯)
├── shared/api/              # API 통신 (admin-api.ts)
└── shared/middleware/       # 미들웨어 (admin-auth.ts)
```

### 의존성 흐름 (단방향)
```
widgets/admin → features/admin → entities/admin → shared
```

## 📋 구현된 컴포넌트 목록

### 1. entities/admin (도메인 레이어)
**파일**: `/home/winnmedia/videoprompt/src/entities/admin/`

- **types.ts**: 핵심 도메인 타입 정의
  - `AdminUser`, `AdminProject`, `AdminVideoAsset`
  - `AdminMetrics`, `ProviderStatus`, `ErrorLogSummary`
  - `AdminAction`, `AuditLog`, `TableFilter`

- **model.ts**: 비즈니스 로직 유틸리티
  - `AdminMetricsCalculator`: 메트릭 계산 로직
  - `AdminActionValidator`: 액션 권한 검증
  - `TableFilterProcessor`: 필터링 로직
  - `AuditLogProcessor`: 감사 로그 처리
  - `ErrorAnalyzer`: 에러 분석 로직

### 2. features/admin (기능 레이어)
**파일**: `/home/winnmedia/videoprompt/src/features/admin/`

- **hooks/useAdminMetrics.ts**: 메트릭 조회 훅
  - $300 사건 방지: 1분 간격 캐싱
  - 자동 새로고침 (5분 주기)
  - 페이지 가시성 기반 제어

- **hooks/useUserManagement.ts**: 사용자 관리 훅
  - 페이지네이션, 필터링, 검색
  - 선택/액션 수행 기능
  - 권한 검증 통합

- **hooks/useProviderStatus.ts**: 제공자 상태 모니터링 훅
  - 실시간 상태 업데이트
  - 시스템 건전성 계산
  - 알림 시스템

- **store/admin-metrics-slice.ts**: Redux 상태 관리
  - RTK 2.0 기반 async thunk
  - 캐시 정책 통합
  - 에러 처리 표준화

### 3. widgets/admin (UI 레이어)
**파일**: `/home/winnmedia/videoprompt/src/widgets/admin/`

- **AdminDashboard.tsx**: 메인 대시보드
  - 5개 핵심 위젯 통합
  - 실시간 상태 모니터링
  - 반응형 그리드 레이아웃

- **UserOverview.tsx**: 사용자 개요 위젯
  - 총계, 증가율, 관리자 수, 게스트 비율
  - 시각적 메트릭 카드
  - 알림 시스템

- **AdminDataTable.tsx**: 재사용 가능한 테이블
  - 페이지네이션, 정렬, 필터링
  - 선택 기능, 액션 버튼
  - 가상화 지원 준비

- **AdminActionModal.tsx**: 안전 확인 모달
  - 위험도별 차등 확인 절차
  - 사유 입력 필수
  - 확인 텍스트 입력 (고위험 액션)

### 4. shared/api (API 레이어)
**파일**: `/home/winnmedia/videoprompt/src/shared/api/admin-api.ts`

- **AdminApiClient**: API 통신 클래스
  - $300 사건 방지: 5초 간격 중복 호출 차단
  - 표준화된 에러 처리
  - 인증 토큰 자동 관리
  - 감사 로그 통합

### 5. shared/middleware (보안 레이어)
**파일**: `/home/winnmedia/videoprompt/src/shared/middleware/admin-auth.ts`

- **adminAuthMiddleware**: 인증/권한 미들웨어
  - IP 화이트리스트 검증
  - JWT/API 키 이중 인증
  - 권한 기반 접근 제어
  - 감사 로그 자동 기록

## 🔒 보안 아키텍처

### 접근 제어 계층
1. **IP 레벨**: 화이트리스트 기반 접근 제어
2. **인증 레벨**: JWT 토큰 + API 키 이중 검증
3. **권한 레벨**: 세분화된 권한 시스템
4. **감사 레벨**: 모든 액션 로깅 (PII 제외)

### PII 보호 정책
- IP 주소 해싱 저장
- 이메일 도메인만 보존
- 민감 정보 자동 마스킹
- 로그 데이터 암호화

## 🚀 성능 최적화

### 캐싱 전략
```typescript
const CACHE_POLICIES = {
  metrics: 5 * 60 * 1000,        // 5분
  providerStatus: 30 * 1000,     // 30초
  userList: 2 * 60 * 1000,       // 2분
  auditLogs: 10 * 60 * 1000      // 10분
};
```

### $300 사건 방지 조치
- API 호출 간격 제한 (최소 5초)
- useEffect 의존성 배열 고정
- 중복 요청 자동 차단
- 캐시 우선 정책

### 대용량 데이터 처리
- 서버 사이드 페이지네이션
- 가상화 스크롤링 준비
- 인덱스 기반 검색/필터링

## 📊 API 계약 명세

### 엔드포인트 구조
```
GET  /api/admin/metrics              # 대시보드 메트릭
GET  /api/admin/users                # 사용자 목록
GET  /api/admin/projects             # 프로젝트 목록
GET  /api/admin/video-assets         # 비디오 에셋 목록
GET  /api/admin/health/providers     # 제공자 상태
GET  /api/admin/logs/errors          # 에러 로그
POST /api/admin/actions              # 관리자 액션
GET  /api/admin/audit-logs           # 감사 로그
```

### 표준 응답 형식
```typescript
interface AdminApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  pagination?: PaginationInfo;
  timestamp: Date;
}
```

## 🧪 테스트 전략

### TDD 적용 범위
- entities/admin 모델 로직
- features/admin 훅 기능
- API 클라이언트 에러 처리
- 보안 미들웨어 검증

### 테스트 카테고리
1. **단위 테스트**: 계산 로직, 유틸리티
2. **통합 테스트**: 훅-스토어 상호작용
3. **E2E 테스트**: 전체 워크플로우
4. **보안 테스트**: 인증/권한 우회 시도

## 📈 확장성 고려사항

### 수평 확장
- 마이크로서비스 아키텍처 호환
- API 게이트웨이 연동 준비
- 캐시 분산 전략

### 기능 확장
- RBAC 시스템 도입 준비
- 다국어 지원 인프라
- 테마 시스템 확장

## 🔍 완성도 검증 체크리스트

### ✅ FSD 아키텍처 준수
- [x] 단방향 의존성 흐름
- [x] 레이어별 책임 분리
- [x] Public API 인터페이스

### ✅ 보안 요구사항
- [x] IP 기반 접근 제어
- [x] 이중 인증 시스템
- [x] 감사 로그 시스템
- [x] PII 보호 정책

### ✅ 성능 요구사항
- [x] $300 사건 방지 조치
- [x] 캐싱 전략 구현
- [x] 대용량 데이터 처리 준비

### ✅ 사용성 요구사항
- [x] 5개 핵심 위젯 구현
- [x] 재사용 가능한 컴포넌트
- [x] 반응형 디자인

### ✅ 확장성 요구사항
- [x] 타입 안전성 확보
- [x] 모듈화된 구조
- [x] 테스트 가능한 설계

## 📝 다음 단계

1. **API 라우트 구현**: Next.js API 라우트 생성
2. **데이터베이스 연동**: Supabase 테이블 설계
3. **실제 데이터 통합**: 기존 entities와 연결
4. **테스트 코드 작성**: TDD 기반 품질 검증
5. **성능 모니터링**: 실제 환경 배포 및 최적화

이 설계는 VideoPlanet의 FSD 아키텍처 원칙을 준수하면서도 확장 가능하고 유지보수가 용이한 관리자 대시보드를 구현합니다.