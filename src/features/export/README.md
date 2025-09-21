# Export 기능

VideoPlanet 프로젝트의 PDF/Excel 내보내기 기능을 제공합니다.

## 기능 개요

- **시나리오 PDF 내보내기**: 시나리오와 샷 목록을 깔끔한 PDF 문서로 생성
- **시나리오 Excel 내보내기**: 시나리오 데이터를 구조화된 Excel 파일로 생성
- **프롬프트 Excel 내보내기**: 프롬프트 데이터를 분석하기 쉬운 Excel 형태로 생성
- **진행 상태 표시**: 내보내기 과정을 시각적으로 표시
- **에러 처리**: 실패 시 재시도 옵션 제공

## 사용 방법

### 1. ExportActions 위젯 사용 (권장)

```tsx
import { ExportActions } from '@/widgets/export';

// 시나리오 내보내기
<ExportActions mode="scenario" />

// 프롬프트 내보내기
<ExportActions mode="prompt" />

// 컴팩트 버전
<ExportActions mode="scenario" variant="compact" />

// 커스텀 데이터 사용
<ExportActions
  mode="scenario"
  customData={myScenarioData}
/>
```

### 2. 개별 컴포넌트 사용

```tsx
import { ExportButton, ExportProgressModal, useExport } from '@/features/export';

function MyComponent() {
  const { exportState, exportScenario, isExporting } = useExport();
  const [showModal, setShowModal] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setShowModal(true);
    await exportScenario(scenarioData, format);
  };

  return (
    <>
      <ExportButton onExport={handleExport} />

      <ExportProgressModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        exportState={exportState}
      />
    </>
  );
}
```

### 3. 유틸리티 함수 직접 사용

```tsx
import {
  exportScenarioToPDF,
  exportScenarioToExcel,
  exportPromptToExcel
} from '@/features/export';

// PDF 내보내기
const result = await exportScenarioToPDF(scenarioData, {
  format: 'pdf',
  pageSize: 'A4',
  includeImages: true
});

// Excel 내보내기
const result = await exportScenarioToExcel(scenarioData);
```

## 데이터 형식

### ScenarioExportData

```typescript
interface ScenarioExportData {
  title: string;
  description?: string;
  shots: Array<{
    id: string;
    title: string;
    description: string;
    duration?: number;
    location?: string;
    characters?: string[];
    equipment?: string[];
    notes?: string;
  }>;
  metadata: {
    createdAt: string;
    createdBy?: string;
    projectId?: string;
    version?: string;
  };
}
```

### PromptExportData

```typescript
interface PromptExportData {
  projectName: string;
  prompts: Array<{
    id: string;
    title: string;
    content: string;
    type: 'system' | 'user' | 'assistant';
    category?: string;
    tags?: string[];
    createdAt: string;
    updatedAt?: string;
  }>;
  metadata: {
    totalPrompts: number;
    exportedAt: string;
    projectId?: string;
  };
}
```

## 파일 구조

```
src/features/export/
├── types.ts              # 타입 정의
├── utils/
│   ├── index.ts          # 유틸리티 public API
│   ├── pdf-generator.ts  # PDF 생성 로직
│   └── excel-generator.ts # Excel 생성 로직
├── ui/
│   ├── ExportButton.tsx      # 내보내기 버튼
│   └── ExportProgressModal.tsx # 진행 상태 모달
├── hooks/
│   └── useExport.ts      # Export 훅
└── index.ts              # Feature public API
```

## 테스트

```bash
# 유틸리티 테스트
pnpm test src/features/export/__tests__/export-utils.test.ts

# 훅 테스트
pnpm test src/features/export/__tests__/useExport.test.ts

# 컴포넌트 테스트
pnpm test src/features/export/__tests__/ExportButton.simple.test.tsx
```

## 기술 스택

- **PDF 생성**: jsPDF
- **Excel 생성**: xlsx (SheetJS)
- **상태 관리**: Redux Toolkit
- **UI**: Tailwind CSS + Lucide React Icons
- **타입 안전성**: TypeScript + Zod

## 성능 고려사항

- 클라이언트 사이드에서 파일 생성하여 서버 부하 최소화
- 대용량 데이터의 경우 청크 단위로 처리
- 진행률 표시로 사용자 경험 향상
- 에러 발생 시 재시도 옵션 제공

## 접근성

- 키보드 네비게이션 지원
- 스크린 리더 호환
- 적절한 ARIA 레이블 설정
- 색상 대비 및 시각적 피드백 제공