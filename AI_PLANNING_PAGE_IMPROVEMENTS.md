# AI 기획 페이지 개선사항 제안

## 🎯 완료된 문제 해결
- **문제**: AI 기획 페이지에서 선택/입력 불가 현상
- **원인**: Next.js 빌드 시스템 오류 (manifest 파일 손상)
- **해결**: 빌드 캐시 재생성으로 모든 UI 요소 정상 복구

## 📋 구축된 테스트 자산
- `tests/e2e/planning-workflow.spec.ts`: 포괄적인 E2E 테스트 스위트
- `debug-planning-page.js`: 진단 도구

## 🚀 추가 개선사항 제안

### 1. 접근성 (Accessibility) 개선

#### 1.1 키보드 네비게이션 강화
```tsx
// 현재 문제: 프리셋 버튼들이 키보드로 접근하기 어려움
// 개선안: 방향키로 프리셋 간 이동 가능하도록 구현

const PresetButtons = () => {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
        setSelectedIndex((prev) => Math.min(prev + 1, PRESET_OPTIONS.length - 1));
        break;
      case 'ArrowLeft':
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          applyPreset(PRESET_OPTIONS[selectedIndex]);
        }
        break;
    }
  };

  return (
    <div role="radiogroup" aria-label="프리셋 선택" onKeyDown={handleKeyDown}>
      {PRESET_OPTIONS.map((preset, index) => (
        <button
          key={index}
          role="radio"
          aria-checked={selectedIndex === index}
          tabIndex={selectedIndex === index ? 0 : -1}
          onClick={() => applyPreset(preset)}
        >
          {preset.name}
        </button>
      ))}
    </div>
  );
};
```

#### 1.2 스크린 리더 지원 강화
```tsx
// 개선할 요소들
<select
  aria-label="톤앤매너 선택"
  aria-describedby="tone-help"
  value={planningData.tone}
  onChange={handleToneChange}
>
  <option value="">톤앤매너를 선택해주세요</option>
  {TONE_OPTIONS.map((tone) => (
    <option key={tone.value} value={tone.value}>
      {tone.label} - {tone.description}
    </option>
  ))}
</select>
<div id="tone-help" className="sr-only">
  영상의 전체적인 분위기와 느낌을 결정합니다
</div>
```

### 2. 사용자 경험 (UX) 개선

#### 2.1 실시간 유효성 검사
```tsx
// 현재: 다음 버튼 클릭 시에만 검증
// 개선안: 실시간 피드백으로 사용자 가이드

const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

const validateField = (field: string, value: string) => {
  const errors: Record<string, string> = {};

  switch (field) {
    case 'title':
      if (!value.trim()) errors.title = '제목을 입력해주세요';
      else if (value.length < 2) errors.title = '제목은 2자 이상 입력해주세요';
      break;
    case 'logline':
      if (!value.trim()) errors.logline = '로그라인을 입력해주세요';
      else if (value.length < 10) errors.logline = '로그라인은 10자 이상 입력해주세요';
      break;
  }

  setFieldErrors(prev => ({ ...prev, [field]: errors[field] || '' }));
};
```

#### 2.2 진행률 시각화 개선
```tsx
// 현재: 단순 백분율 표시
// 개선안: 각 단계별 세부 진행 상태

const getDetailedProgress = () => {
  const step1Progress = {
    title: !!planningData.title,
    logline: !!planningData.logline,
    tone: !!planningData.tone,
    genre: !!planningData.genre,
  };

  const completed = Object.values(step1Progress).filter(Boolean).length;
  const total = Object.keys(step1Progress).length;

  return {
    percentage: (completed / total) * 100,
    completedFields: completed,
    totalFields: total,
    nextRequired: Object.entries(step1Progress)
      .filter(([_, completed]) => !completed)
      .map(([field, _]) => field)[0]
  };
};
```

#### 2.3 저장 기능 강화
```tsx
// 현재: 마지막 단계에서만 저장
// 개선안: 자동 저장 + 임시 저장 기능

const useAutoSave = (data: PlanningData) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('planning-draft', JSON.stringify(data));
    }, 2000);

    return () => clearTimeout(timer);
  }, [data]);
};

// 페이지 로드 시 임시 저장 데이터 복구
const restoreDraft = () => {
  const draft = localStorage.getItem('planning-draft');
  if (draft) {
    const confirmed = window.confirm('이전에 작성하던 기획안을 불러올까요?');
    if (confirmed) {
      setPlanningData(JSON.parse(draft));
    }
  }
};
```

### 3. 성능 최적화

#### 3.1 지연 로딩 (Lazy Loading)
```tsx
// 개선안: 각 단계를 별도 컴포넌트로 분리하여 필요할 때만 로드
const Step1 = lazy(() => import('./steps/Step1'));
const Step2 = lazy(() => import('./steps/Step2'));
const Step3 = lazy(() => import('./steps/Step3'));

const renderCurrentStep = () => (
  <Suspense fallback={<StepSkeleton />}>
    {currentStep === 1 && <Step1 />}
    {currentStep === 2 && <Step2 />}
    {currentStep === 3 && <Step3 />}
  </Suspense>
);
```

#### 3.2 메모이제이션 최적화
```tsx
// 현재: 매번 새로운 객체 생성으로 불필요한 리렌더링
// 개선안: useMemo와 useCallback 활용

const memoizedPresetOptions = useMemo(() => PRESET_OPTIONS, []);

const memoizedApplyPreset = useCallback((preset: PresetOption) => {
  setPlanningData(prev => ({ ...prev, ...preset.data }));
}, []);
```

### 4. 오류 처리 및 안정성

#### 4.1 전역 오류 경계 (Error Boundary)
```tsx
const PlanningErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="text-center p-8">
          <h2 className="text-xl font-semibold text-red-600 mb-4">
            문제가 발생했습니다
          </h2>
          <p className="text-gray-600 mb-4">
            기획 페이지에 일시적인 문제가 발생했습니다.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            페이지 새로고침
          </button>
        </div>
      }
      onError={(error) => {
        console.error('Planning page error:', error);
        // 에러 로깅 서비스로 전송
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

#### 4.2 네트워크 오류 처리
```tsx
// 개선안: 네트워크 상태 모니터링 및 재시도 로직
const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};
```

### 5. 빌드 안정성 확보

#### 5.1 빌드 헬스체크 스크립트
```bash
#!/bin/bash
# scripts/health-check.sh

echo "🔍 Next.js 빌드 상태 확인..."

# .next 디렉토리 존재 확인
if [ ! -d ".next" ]; then
    echo "❌ .next 디렉토리가 존재하지 않습니다"
    exit 1
fi

# 필수 manifest 파일들 확인
required_files=(
    ".next/routes-manifest.json"
    ".next/server/app-paths-manifest.json"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ 필수 파일이 없습니다: $file"
        echo "🔧 빌드를 다시 시작합니다..."
        rm -rf .next
        npm run build
        exit 0
    fi
done

echo "✅ 빌드 상태가 정상입니다"
```

#### 5.2 개발 환경 setup 자동화
```json
// package.json에 추가
{
  "scripts": {
    "dev:safe": "npm run health-check && npm run dev",
    "health-check": "bash scripts/health-check.sh",
    "reset-build": "rm -rf .next && npm run build"
  }
}
```

## 📊 우선순위 권장사항

### High Priority (즉시 적용 권장)
1. ✅ **빌드 헬스체크 스크립트** - 동일 문제 재발 방지
2. 🔧 **기본 접근성 개선** - ARIA 라벨 및 키보드 네비게이션
3. 💾 **자동 저장 기능** - 사용자 작업 내용 보호

### Medium Priority (다음 스프린트)
1. 📊 **실시간 유효성 검사** - 사용자 경험 개선
2. ⚡ **성능 최적화** - 컴포넌트 분리 및 메모이제이션
3. 🛡️ **오류 처리 강화** - Error Boundary 및 재시도 로직

### Low Priority (장기 개선)
1. 🎨 **시각적 피드백 개선** - 애니메이션 및 마이크로 인터랙션
2. 📱 **모바일 최적화** - 터치 인터랙션 개선
3. 🔄 **상태 관리 최적화** - Redux 또는 Zustand 도입 검토

## 🎯 결론

이번 작업으로 AI 기획 페이지의 핵심 문제를 완전히 해결했으며, 향후 확장 가능한 테스트 인프라와 진단 도구를 구축했습니다. 제안된 개선사항들을 단계적으로 적용하면 더욱 안정적이고 사용자 친화적인 기획 도구가 될 것입니다.