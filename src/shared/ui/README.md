# Enhanced Error Handling UI Components

새로 개발된 에러 처리 UI 컴포넌트들은 시각적으로 명확하고 접근 가능한 에러 경험을 제공합니다.

## 🎯 주요 특징

- **접근성 우선**: ARIA 속성, 키보드 탐색, 스크린 리더 지원
- **시각적 명확성**: 상태별 색상, 아이콘, 애니메이션
- **사용자 경험**: 재시도, 취소, 진행률 표시
- **TDD 기반**: 철저한 테스트 커버리지

## 📋 컴포넌트 목록

### 1. ErrorMessage
다양한 유형의 메시지를 표시하는 범용 컴포넌트

```tsx
import { ErrorMessage } from '@/shared/ui';

// 기본 에러
<ErrorMessage
  message="네트워크 연결에 실패했습니다."
  variant="error"
/>

// 액션 버튼 포함
<ErrorMessage
  message="업로드에 실패했습니다."
  variant="error"
  actionLabel="재시도"
  onAction={() => retry()}
  onDismiss={() => close()}
/>

// 경고 메시지
<ErrorMessage
  message="입력 값을 확인해 주세요."
  variant="warning"
  size="sm"
/>
```

**Props:**
- `message`: 표시할 메시지
- `variant`: 'error' | 'warning' | 'info'
- `size`: 'sm' | 'md' | 'lg'
- `focusable`: 키보드 포커스 가능 여부
- `onDismiss`: 닫기 핸들러
- `actionLabel` / `onAction`: 액션 버튼

### 2. FileUploadProgress
파일 업로드 진행률과 상태를 표시

```tsx
import { FileUploadProgress } from '@/shared/ui';

<FileUploadProgress
  file={selectedFile}
  progress={65}
  status="uploading"
  onCancel={() => cancelUpload()}
/>

// 에러 상태
<FileUploadProgress
  file={failedFile}
  progress={30}
  status="error"
  error="파일 크기가 너무 큽니다."
  onRetry={() => retryUpload()}
/>
```

**Status Types:**
- `pending`: 업로드 대기
- `uploading`: 업로드 중
- `completed`: 완료
- `error`: 에러 발생
- `cancelled`: 취소됨

### 3. RetryButton
재시도 기능을 제공하는 스마트 버튼

```tsx
import { RetryButton } from '@/shared/ui';

// 기본 재시도
<RetryButton
  onRetry={() => apiCall()}
/>

// 제한된 재시도 + 지연
<RetryButton
  onRetry={() => apiCall()}
  maxRetries={3}
  delay={2000}
  showRetryCount={true}
  error="서버 응답이 없습니다."
/>

// 로딩 상태
<RetryButton
  onRetry={() => asyncOperation()}
  loading={isLoading}
  loadingLabel="처리 중..."
/>
```

**Features:**
- 최대 재시도 횟수 제한
- 재시도 간 지연 시간 (카운트다운 표시)
- 로딩 상태 관리
- 에러 메시지 표시

### 4. Enhanced Button
기존 버튼에 에러 상태와 접근성 개선 추가

```tsx
import { Button } from '@/shared/ui';

// 에러 상태 버튼
<Button
  error={true}
  errorMessage="처리 중 오류가 발생했습니다."
  onClick={handleClick}
>
  저장하기
</Button>

// 설명이 있는 버튼
<Button
  description="변경사항을 서버에 저장합니다."
  loadingText="저장 중..."
  loading={isSaving}
>
  저장
</Button>
```

## 🎨 사용 예제

### 완전한 파일 업로드 플로우

```tsx
function FileUploadDemo() {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    const uploadState = {
      file,
      progress: 0,
      status: 'uploading' as const
    };

    setFiles(prev => [...prev, uploadState]);

    try {
      await uploadFile(file, (progress) => {
        setFiles(prev => prev.map(f =>
          f.file === file ? { ...f, progress } : f
        ));
      });

      setFiles(prev => prev.map(f =>
        f.file === file ? { ...f, status: 'completed', progress: 100 } : f
      ));
    } catch (err) {
      setFiles(prev => prev.map(f =>
        f.file === file ? { ...f, status: 'error' } : f
      ));
      setError('업로드에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <ErrorMessage
          message={error}
          variant="error"
          onDismiss={() => setError(null)}
          actionLabel="다시 시도"
          onAction={() => retryAllFailed()}
        />
      )}

      {files.map((fileState, index) => (
        <FileUploadProgress
          key={index}
          file={fileState.file}
          progress={fileState.progress}
          status={fileState.status}
          onCancel={() => cancelUpload(fileState.file)}
          onRetry={() => handleUpload(fileState.file)}
          onRemove={() => removeFile(index)}
        />
      ))}
    </div>
  );
}
```

### API 호출 에러 처리

```tsx
function ApiCallExample() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callApi = async () => {
    setLoading(true);
    setError(null);

    try {
      await apiService.getData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={callApi}
        loading={loading}
        loadingText="데이터 로딩 중..."
        error={!!error}
        errorMessage={error}
        description="서버에서 최신 데이터를 가져옵니다."
      >
        데이터 새로고침
      </Button>

      {error && (
        <RetryButton
          onRetry={callApi}
          error={error}
          maxRetries={3}
          delay={1000}
          variant="destructive"
        />
      )}
    </div>
  );
}
```

## 🧪 테스트 가이드

모든 컴포넌트는 TDD로 개발되었으며, 다음과 같은 테스트를 포함합니다:

```bash
# 전체 테스트 실행
pnpm test src/shared/ui/

# 개별 컴포넌트 테스트
pnpm test src/shared/ui/ErrorMessage.test.tsx
pnpm test src/shared/ui/FileUploadProgress.test.tsx
pnpm test src/shared/ui/RetryButton.test.tsx
```

### 테스트 커버리지
- 렌더링 및 기본 동작
- 다양한 상태 변화
- 사용자 상호작용 (클릭, 키보드)
- 접근성 (ARIA, 포커스, 스크린 리더)
- 에러 처리 및 예외 상황

## 📚 Storybook

시각적 문서화 및 컴포넌트 테스트를 위해 Storybook 스토리가 제공됩니다:

```bash
# Storybook 실행
npm run storybook
```

- `Shared/UI/ErrorMessage`
- `Shared/UI/FileUploadProgress`
- `Shared/UI/RetryButton`

## 🎯 접근성 체크리스트

✅ **키보드 탐색**: 모든 인터랙티브 요소가 키보드로 접근 가능
✅ **스크린 리더**: 적절한 ARIA 레이블과 역할 정의
✅ **색상 대비**: WCAG 2.1 AA 기준 준수
✅ **포커스 관리**: 명확한 포커스 표시기
✅ **상태 알림**: aria-live로 동적 변경사항 알림
✅ **의미론적 HTML**: 적절한 HTML 요소 사용

## 🚀 성능 최적화

- **지연 로딩**: 조건부 렌더링으로 불필요한 렌더링 방지
- **메모이제이션**: React.memo, useMemo 적절히 활용
- **번들 크기**: 트리 셰이킹 지원으로 사용하지 않는 코드 제거
- **애니메이션**: CSS 애니메이션 사용으로 성능 최적화

## 🔧 커스터마이징

모든 컴포넌트는 Tailwind CSS와 CVA(Class Variance Authority)를 사용하여 쉽게 커스터마이징할 수 있습니다:

```tsx
// 커스텀 스타일 적용
<ErrorMessage
  message="커스텀 스타일 메시지"
  className="my-custom-error-style"
  variant="error"
/>

// CVA variants 확장 (필요 시)
const customErrorVariants = cva(
  "base-error-classes",
  {
    variants: {
      severity: {
        low: "text-yellow-600 bg-yellow-50",
        high: "text-red-600 bg-red-50"
      }
    }
  }
);
```

## 📝 마이그레이션 가이드

기존 컴포넌트에서 새로운 컴포넌트로 마이그레이션:

```tsx
// Before (기존 FormError)
<FormError>에러 메시지</FormError>

// After (새로운 ErrorMessage)
<ErrorMessage
  message="에러 메시지"
  variant="error"
/>

// Before (기본 Button)
<Button disabled={hasError}>버튼</Button>

// After (향상된 Button)
<Button
  error={hasError}
  errorMessage="에러가 발생했습니다."
>
  버튼
</Button>
```

---

이 컴포넌트들은 VideoPlanet 프로젝트의 FSD 아키텍처와 TDD 원칙을 따라 개발되었습니다.
문의사항이나 개선 제안이 있으시면 개발팀에 연락해 주세요.