# 비디오 피드백 시스템 테스트 가이드

이 문서는 VideoPlanet 비디오 피드백 시스템의 종합적인 테스트 스위트에 대한 가이드입니다.

## 📋 테스트 개요

비디오 피드백 시스템 테스트는 다음 주요 영역을 커버합니다:

### 1. 비디오 업로드 기능
- 유효한 비디오 파일 업로드
- 파일 크기 제한 (200MB) 검증
- 파일 타입 검증 (video/* 만 허용)
- 메타데이터 추출 및 검증

### 2. 팀 초대 및 공유 시스템
- 뷰어/댓글 작성자 권한 토큰 생성
- 토큰 유효성 검증 및 만료 처리
- ID 기반 초대 및 게스트 초대
- 역할 기반 권한 시스템

### 3. 댓글 시스템
- 기본 댓글 작성 및 조회
- 타임코드 기반 댓글 (예: @TC01:23.456)
- 권한 기반 댓글 작성 제어
- 댓글 스레딩 및 답글 기능

### 4. 실시간 협업 기능
- 댓글 실시간 폴링 (5초 간격)
- 다중 사용자 동시 접속 시뮬레이션
- 토큰 유효성 실시간 검증
- 네트워크 오류 복구 처리

### 5. UI 사용자 경험
- 기본 페이지 렌더링 및 상호작용
- 키보드 접근성 (Tab 탐색, T 키 단축키)
- ARIA 레이블 및 스크린 리더 지원
- 반응형 레이아웃 검증

## 🚀 테스트 실행 방법

### 전체 테스트 스위트 실행
```bash
pnpm run test:video-feedback:all
```

### 개별 테스트 실행

#### API 기능 테스트
```bash
pnpm run test:video-feedback
```

#### UI 통합 테스트
```bash
pnpm run test:video-feedback:ui
```

#### E2E 테스트 (준비 중)
```bash
pnpm run test:video-feedback:e2e
```

## 📁 테스트 파일 구조

```
src/__tests__/
├── video-feedback-core.test.ts         # API 기능 테스트
├── video-feedback-ui-simple.test.tsx   # UI 통합 테스트
├── video-feedback-e2e.test.ts         # E2E 테스트 (Playwright)
├── video-feedback-system.test.ts      # 원본 테스트 (MSW 1.x 용)
└── video-feedback-ui-integration.test.tsx # 원본 UI 테스트 (MSW 1.x 용)
```

## 🔧 테스트 기술 스택

### 테스트 프레임워크
- **Vitest**: 빠른 단위 및 통합 테스트
- **Playwright**: E2E 테스트 및 브라우저 자동화
- **React Testing Library**: React 컴포넌트 테스트
- **MSW 2.x**: API 모킹 및 네트워크 인터셉션

### 주요 기능
- **TDD 방식**: 실패하는 테스트부터 작성
- **결정론적 테스트**: 실제 네트워크 호출 없이 모든 시나리오 테스트
- **타입 안전성**: TypeScript로 모든 테스트 코드 작성
- **접근성 테스트**: A11y 및 키보드 탐색 검증

## 📊 테스트 결과 예시

### API 테스트 (21개 테스트)
```
✓ 비디오 업로드 기능 (5개)
✓ 공유 토큰 관리 API (5개) 
✓ 댓글 시스템 API (6개)
✓ 실시간 협업 기능 (3개)
✓ 오류 처리 및 복구 (2개)
```

### UI 테스트 (19개 테스트)
```
✓ 기본 UI 렌더링 (3개)
✓ 사용자 인터랙션 (4개)
✓ 키보드 상호작용 (2개)
✓ 접근성 (4개)
✓ 오류 처리 (2개)
✓ 반응형 및 상태 관리 (2개)
✓ 성능 및 최적화 (2개)
```

## 🎯 테스트 시나리오

### 핵심 워크플로우
1. **비디오 업로드** → 파일 검증 → 메타데이터 추출
2. **공유 링크 생성** → 토큰 발급 → 권한 설정
3. **팀원 초대** → 토큰 검증 → 접근 권한 확인
4. **댓글 작성** → 권한 확인 → 타임코드 처리
5. **실시간 협업** → 댓글 폴링 → 다중 사용자 동기화

### 오류 시나리오
- 네트워크 연결 실패
- 토큰 만료 처리  
- 권한 부족 상황
- 파일 업로드 제한 초과
- 부분적 데이터 손실 복구

## 🔍 테스트 품질 지표

### 성능 기준
- API 응답 시간: < 2초
- UI 렌더링 시간: < 500ms
- 대용량 댓글 목록 처리: < 1초

### 신뢰성 기준
- 테스트 재현성: 100% (플래키 테스트 0%)
- 네트워크 모킹: 모든 외부 API 호출 차단
- 타입 안전성: 컴파일 오류 0개

## 🛠️ 개발 워크플로우 통합

### PR 체크리스트
- [ ] API 기능 테스트 통과
- [ ] UI 통합 테스트 통과  
- [ ] 접근성 테스트 통과
- [ ] 타입 검사 통과 (`tsc --noEmit`)
- [ ] ESLint 검사 통과

### CI/CD 파이프라인
```bash
# 테스트 단계별 실행
pnpm run typecheck
pnpm run lint
pnpm run test:video-feedback
pnpm run test:video-feedback:ui
# pnpm run test:video-feedback:e2e (프로덕션)
```

## 📝 테스트 작성 가이드

### API 테스트 작성
```typescript
it('새로운 기능을 테스트한다', async () => {
  // MSW 핸들러 설정
  server.use(
    http.post('/api/new-feature', () => {
      return HttpResponse.json({ ok: true, data: expectedResult });
    })
  );

  // 테스트 실행
  const response = await fetch('/api/new-feature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData),
  });

  // 검증
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.ok).toBe(true);
});
```

### UI 테스트 작성
```typescript
it('사용자가 새로운 작업을 수행할 수 있다', async () => {
  const user = userEvent.setup();
  render(<TestComponent />);

  // 사용자 액션
  await user.type(screen.getByLabelText('입력 필드'), '테스트 입력');
  await user.click(screen.getByText('제출'));

  // 결과 검증
  await waitFor(() => {
    expect(screen.getByText('성공 메시지')).toBeInTheDocument();
  });
});
```

## 🚨 주의사항

### MSW 버전 호환성
- MSW 2.x 문법 사용: `http.post()` → `HttpResponse.json()`
- 이전 MSW 1.x 테스트 파일들은 참고용으로 보관

### 테스트 격리
- 각 테스트는 독립적으로 실행 가능해야 함
- `beforeEach`에서 상태 초기화
- Mock 함수는 `afterEach`에서 리셋

### 비동기 처리
- `waitFor`를 사용하여 비동기 상태 변화 대기
- 타임아웃 설정으로 무한 대기 방지
- Promise 기반 API는 `async/await` 사용

## 📈 향후 개선 계획

### E2E 테스트 확장
- 실제 브라우저 환경에서 전체 워크플로우 테스트
- 다중 브라우저 호환성 검증
- 성능 회귀 테스트 자동화

### 테스트 커버리지 향상
- 엣지 케이스 추가 발굴
- 접근성 테스트 강화
- 국제화(i18n) 테스트 추가

### 모니터링 통합
- 테스트 결과 메트릭 수집
- 실패 패턴 분석 및 알림
- 성능 벤치마크 자동화

---

**문의사항이나 개선 제안이 있으시면 팀 내 슬랙 채널 또는 GitHub Issues를 통해 공유해 주세요!** 🚀