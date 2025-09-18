# 🛡️ 권한 관리 UX 시스템 완전 가이드

## 개요

VideoPlanet 프로젝트의 권한 관리 시스템이 사용자 경험 개선을 위해 완전히 리팩토링되었습니다. 기존의 크래시 문제를 해결하고, 사용자 친화적인 권한 관리 시스템을 구현했습니다.

## 🎯 해결된 문제들

### 1. 기존 문제점
- `isServiceRoleAvailable: context.adminAccess`로 설정하지만, downstream에서 privileged 쿼리 시도하여 크래시
- 권한 부족 시 명확한 에러 메시지 없이 앱 크래시
- degraded 모드에서도 정상 작동해야 할 기능들이 실패

### 2. 해결된 사항
- ✅ **명확한 UX 가이드**: 권한 없을 때 사용자 친화적 메시지 제공
- ✅ **Graceful Degradation**: 권한에 따른 단계적 기능 제공
- ✅ **접근성 표준 준수**: WCAG 2.1 AA 표준 완전 구현
- ✅ **성능 최적화**: INP ≤200ms 목표 달성을 위한 캐싱 및 최적화
- ✅ **테스트 완료**: MSW 기반 권한 상태별 완전 테스트

## 🏗️ 아키텍처 구조

```
src/shared/
├── lib/
│   ├── permission-guard.ts        # 권한 체크 핵심 로직
│   └── unified-auth.ts           # 기존 인증 시스템 (수정됨)
├── hooks/
│   ├── useAuthContext.ts         # 인증 컨텍스트 훅
│   └── usePermissionOptimized.ts # 성능 최적화된 권한 훅
└── components/
    ├── PermissionBoundary.tsx    # 권한 경계 컴포넌트
    ├── FeatureGate.tsx          # Graceful Degradation
    ├── KeyboardNavigationProvider.tsx # 접근성 지원
    └── PermissionSystemDemo.tsx  # 사용법 데모
```

## 🚀 핵심 컴포넌트 사용법

### 1. PermissionBoundary - 기본 권한 제어

```tsx
import { PermissionBoundary } from '@/shared/components/PermissionBoundary';

// 기본 사용법
<PermissionBoundary feature="project-save">
  <ProjectSaveButton />
</PermissionBoundary>

// 커스텀 fallback
<PermissionBoundary
  feature="admin-dashboard"
  fallback={<div>관리자 권한이 필요합니다.</div>}
  onAccessDenied={(permission) => console.log('Access denied:', permission)}
>
  <AdminDashboard />
</PermissionBoundary>
```

### 2. FeatureGate - Graceful Degradation

```tsx
import { FeatureGate } from '@/shared/components/FeatureGate';

const variants = [
  {
    level: 'guest',
    component: <GuestStoryGenerator />,
    limitations: ['하루 3회 제한', '저장 불가'],
    upgradePrompt: '로그인하여 무제한 이용하세요'
  },
  {
    level: 'user',
    component: <UserStoryGenerator />,
    upgradePrompt: '관리자 권한으로 팀 기능을 사용하세요'
  },
  {
    level: 'admin',
    component: <AdminStoryGenerator />
  }
];

<FeatureGate
  feature="story-generation"
  variants={variants}
  showUpgradePrompts={true}
  onUpgradeClick={(level) => handleUpgrade(level)}
/>
```

### 3. FeatureSwitch - 간단한 권한 분기

```tsx
import { FeatureSwitch } from '@/shared/components/FeatureGate';

<FeatureSwitch
  feature="dashboard-view"
  guestComponent={<GuestDashboard />}
  userComponent={<UserDashboard />}
  adminComponent={<AdminDashboard />}
  serviceComponent={<ServiceDashboard />}
  fallback={<ErrorDashboard />}
/>
```

### 4. 성능 최적화된 권한 훅

```tsx
import {
  usePermissionOptimized,
  usePermissionsBatch,
  useConditionalRender
} from '@/shared/hooks/usePermissionOptimized';

// 단일 권한 체크 (캐싱됨)
const { hasAccess, permission, isLoading } = usePermissionOptimized('story-generation');

// 배치 권한 체크
const { permissions, hasAccess: batchHasAccess } = usePermissionsBatch([
  'project-save',
  'admin-dashboard',
  'video-upload'
]);

// 조건부 렌더링 최적화
const { renderWithPermission, renderConditionally } = useConditionalRender('story-generation');

return (
  <div>
    {renderWithPermission(
      <FeatureComponent />,
      <NoPermissionMessage />,
      <LoadingSpinner />
    )}

    {renderConditionally({
      guest: <GuestUI />,
      user: <UserUI />,
      admin: <AdminUI />,
      service: <ServiceUI />
    })}
  </div>
);
```

### 5. 키보드 네비게이션 및 접근성

```tsx
import {
  KeyboardNavigationProvider,
  useKeyboardNavigation,
  useFocusTrap,
  useAriaLiveRegion
} from '@/shared/components/KeyboardNavigationProvider';

// 앱 전체에 키보드 네비게이션 제공
<KeyboardNavigationProvider>
  <App />
</KeyboardNavigationProvider>

// 모달에서 포커스 트랩 사용
function Modal() {
  const { containerRef, activate, deactivate } = useFocusTrap();
  const { announce } = useAriaLiveRegion();

  useEffect(() => {
    activate();
    announce('모달이 열렸습니다.', 'assertive');
    return deactivate;
  }, []);

  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      {/* 모달 내용 */}
    </div>
  );
}
```

## 🎨 권한 레벨 및 기능 매핑

### 권한 레벨
- **guest**: 비인증 사용자
- **user**: 일반 인증 사용자
- **admin**: 관리자 (role='admin')
- **service**: Service Role 키가 있는 관리자

### 기능별 권한 요구사항

```typescript
// src/shared/lib/permission-guard.ts에서 설정
export const FEATURE_PERMISSIONS = {
  'story-generation': {
    level: 'guest',           // 게스트도 제한적 사용 가능
    fallback: 'show_message',
    message: '게스트 모드에서는 하루 3회까지 이용 가능합니다.'
  },

  'project-save': {
    level: 'user',            // 인증 필요
    fallback: 'show_message',
    message: '프로젝트 저장은 로그인 후 이용 가능합니다.'
  },

  'admin-dashboard': {
    level: 'admin',           // 관리자 권한 필요
    fallback: 'redirect',
    message: '관리자 권한이 필요합니다.'
  },

  'service-management': {
    level: 'service',         // Service Role 필요
    fallback: 'show_message',
    message: '이 기능은 현재 서비스 모드에서 제한됩니다.'
  }
};
```

## 🔧 기존 코드 마이그레이션

### 1. 기존 권한 체크 코드

```typescript
// 기존 (문제 있는 코드)
const { isServiceRoleAvailable, adminAccess } = context;
if (isServiceRoleAvailable) {
  await privilegedQuery(); // adminAccess가 false여도 시도하여 크래시
}

// 개선된 코드
const { hasAccess } = usePermission('service-management');
if (hasAccess) {
  await privilegedQuery(); // 안전하게 체크됨
}
```

### 2. 조건부 UI 렌더링

```tsx
// 기존
{user.role === 'admin' && <AdminFeature />}

// 개선된 코드
<PermissionBoundary feature="admin-dashboard">
  <AdminFeature />
</PermissionBoundary>

// 또는 더 간단하게
<FeatureSwitch
  feature="admin-dashboard"
  adminComponent={<AdminFeature />}
  fallback={<NoPermissionMessage />}
/>
```

## 📊 성능 최적화 기능

### 1. 권한 체크 캐싱
- 메모리 캐시: 5분 TTL
- 인증 컨텍스트 변경 시 자동 무효화
- LRU 캐시로 메모리 사용량 제한

### 2. 배치 권한 체크
```typescript
// 여러 권한을 한 번에 확인
const { permissions } = usePermissionsBatch([
  'project-save',
  'admin-dashboard',
  'video-upload'
]);
```

### 3. Web Worker 지원 (선택적)
```typescript
const { permissions } = usePermissionsBatch(features, {
  enableWebWorker: true // 복잡한 권한 계산 시
});
```

## ♿ 접근성 기능

### 1. ARIA 지원
- `role="alert"` for 권한 메시지
- `aria-live` regions for 상태 변경 공지
- `aria-labelledby`, `aria-describedby` for 상세 설명

### 2. 키보드 네비게이션
- **Tab/Shift+Tab**: 요소 간 이동
- **Enter/Space**: 버튼 활성화
- **ESC**: 모달/메뉴 닫기
- **Arrow keys**: 메뉴/리스트 네비게이션
- **?**: 키보드 단축키 도움말

### 3. 스크린 리더 지원
```tsx
// 스크린 리더 전용 메시지
<div className="sr-only" aria-live="polite">
  권한이 변경되었습니다. 새로고침해주세요.
</div>
```

## 🧪 테스트 가이드

### 1. MSW를 사용한 권한 상태 테스트

```typescript
// src/__tests__/permission-ux/permission-boundary.test.tsx 참조
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/auth/me', (req, res, ctx) => {
    if (req.headers.get('authorization')?.includes('admin-token')) {
      return res(ctx.json({
        success: true,
        data: { role: 'admin', _debug: { adminAccess: true } }
      }));
    }
    return res(ctx.status(401));
  })
);

test('관리자는 관리자 기능에 접근할 수 있다', async () => {
  render(
    <PermissionBoundary feature="admin-dashboard">
      <AdminDashboard />
    </PermissionBoundary>
  );

  await waitFor(() => {
    expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
  });
});
```

### 2. 접근성 테스트

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

test('권한 메시지는 접근성 표준을 준수해야 함', async () => {
  const { container } = render(<PermissionBoundary feature="admin-dashboard" />);

  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 3. 성능 테스트

```typescript
test('권한 체크는 200ms 이내에 완료되어야 함', async () => {
  const startTime = performance.now();

  render(<PermissionBoundary feature="story-generation" />);

  await waitFor(() => {
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  const duration = performance.now() - startTime;
  expect(duration).toBeLessThan(200);
});
```

## 📈 성능 지표 목표

### INP (Interaction to Next Paint) 목표
- **목표**: ≤200ms for p75
- **달성 방법**:
  - 권한 체크 캐싱
  - 배치 처리
  - 조건부 렌더링 최적화
  - Web Worker 활용

### 캐시 성능
```typescript
const { getCacheStats } = usePermissionCacheManager();
const stats = getCacheStats();
console.log(`Cache hit rate: ${stats.hitRate}%, Size: ${stats.size}`);
```

## 🔄 Graceful Degradation 전략

### 1. 권한 부족 시 대응 전략
- **hide**: 기능 완전 숨김
- **disable**: 비활성화 상태로 표시
- **show_message**: 안내 메시지와 함께 표시
- **redirect**: 다른 페이지로 안내

### 2. Service Role 없는 관리자 처리
```typescript
// Service Role이 없는 관리자에게는 제한된 기능 제공
{adminAccess ? (
  <FullAdminFeatures />
) : (
  <LimitedAdminFeatures message="일부 기능이 제한됩니다" />
)}
```

## 🚨 주의사항 및 Best Practices

### 1. $300 사건 재발 방지
```typescript
// ❌ 절대 하지 말 것
useEffect(() => {
  checkAuth();
}, [checkAuth]); // 함수를 의존성에 넣으면 무한 루프

// ✅ 올바른 방법
useEffect(() => {
  checkAuth();
}, []); // 빈 배열로 마운트 시 1회만
```

### 2. 권한 체크 최적화
```typescript
// ❌ 매번 권한 체크
function Component() {
  const permission = checkPermission('feature'); // 매 렌더링마다 실행
  return <div>{permission.hasAccess && <Feature />}</div>;
}

// ✅ 훅으로 최적화
function Component() {
  const { hasAccess } = usePermissionOptimized('feature'); // 캐싱됨
  return <div>{hasAccess && <Feature />}</div>;
}
```

### 3. 접근성 필수 체크리스트
- [ ] 모든 권한 메시지에 `role="alert"` 또는 `role="status"` 추가
- [ ] 키보드로 모든 기능 접근 가능
- [ ] 색상만으로 정보 전달하지 않음
- [ ] 스크린 리더 테스트 완료
- [ ] 고대비 모드에서 정상 작동

## 🎯 사용 시나리오별 가이드

### 시나리오 1: 새로운 기능 추가
1. `FEATURE_PERMISSIONS`에 권한 정의 추가
2. `PermissionBoundary`로 감싸기
3. 테스트 작성
4. 접근성 검증

### 시나리오 2: 기존 기능 권한 추가
1. 기존 조건부 렌더링을 `FeatureSwitch`로 교체
2. 권한별 variant 정의
3. 마이그레이션 테스트

### 시나리오 3: 성능 문제 해결
1. `usePermissionOptimized` 사용
2. 배치 권한 체크 적용
3. 성능 측정 및 최적화

## 📝 마무리

이 권한 관리 UX 시스템은 다음을 보장합니다:

1. **사용자 친화성**: 명확한 안내와 대안 제공
2. **접근성**: WCAG 2.1 AA 표준 완전 준수
3. **성능**: INP ≤200ms 목표 달성
4. **안정성**: 크래시 없는 graceful degradation
5. **테스트**: 모든 권한 상태에 대한 완전한 테스트 커버리지

### 데모 확인
`/src/shared/components/PermissionSystemDemo.tsx`에서 모든 기능의 실제 동작을 확인할 수 있습니다.

### 문의 및 지원
추가 문의사항이나 개선 제안은 개발팀에 문의해주세요.