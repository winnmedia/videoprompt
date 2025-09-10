# 🛡️ 안전한 점진적 리팩토링 전략 (시스템 불안정성 대응)

> **작성일**: 2025-09-10  
> **목적**: 컴퓨터 반복 종료 환경에서 안전한 점진적 개선  
> **원칙**: 작은 단위, 빠른 커밋, 즉시 롤백 가능

## 📊 현재 상태 분석

### 🔴 Critical Issues
- **TypeScript 오류**: 1개 (incomingTraceId 미정의)
- **Console 디버깅**: 3,075개 (429파일)
- **코드베이스 크기**: 1,798개 파일, 85MB
- **테스트 상태**: 일부 테스트 실행 중 (Email 서비스 로깅 과다)

### ⚠️ 시스템 제약사항
- **메모리 제한**: 대규모 작업 시 시스템 종료 위험
- **작업 시간**: 30분 이내 단위로 분할 필요
- **백업 필수**: 각 단계별 git commit 필수

---

## 🎯 Phase별 실행 계획

### Phase 0: 긴급 안정화 (5분)
**목표**: 즉시 빌드 가능한 상태 확보

#### 작업 항목
```bash
# 1. TypeScript 오류 수정
sed -i 's/incomingTraceId/traceId/g' src/app/api/imagen/preview/route.ts

# 2. 빌드 확인
pnpm tsc --noEmit

# 3. 즉시 커밋
git add -A && git commit -m "fix: TypeScript build error - undefined incomingTraceId"
```

**롤백**: `git reset --hard HEAD~1`

---

### Phase 1: TypeScript 타입 안정성 (30분)

#### 1.1 위험도 높은 any 제거 (10분)
```bash
# any를 unknown으로 일괄 변경 (안전한 접근)
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/: any/: unknown/g'

# 컴파일 오류 확인
pnpm tsc --noEmit > typescript-errors.log 2>&1

# 오류가 많으면 롤백
git diff --stat | grep -q "100 files" && git checkout .
```

#### 1.2 점진적 타입 추가 (15분)
```typescript
// 자동화 스크립트: add-types.js
const fs = require('fs');
const path = require('path');

function addBasicTypes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 간단한 타입 추론 가능한 패턴
  content = content.replace(/const (\w+) = \[\]/g, 'const $1: unknown[] = []');
  content = content.replace(/const (\w+) = \{\}/g, 'const $1: Record<string, unknown> = {}');
  
  fs.writeFileSync(filePath, content);
}

// 5개 파일씩 처리
const files = process.argv.slice(2, 7);
files.forEach(addBasicTypes);
```

#### 1.3 체크포인트 커밋 (5분)
```bash
git add -p  # 선택적 스테이징
git commit -m "refactor: Phase 1 - Add basic TypeScript types (batch 1)"
```

---

### Phase 2: 디버깅 코드 제거 (20분)

#### 2.1 console.log 자동 제거 (10분)
```bash
# 백업 생성
cp -r src src.backup.$(date +%Y%m%d_%H%M%S)

# console.log만 제거 (error/warn 유지)
find src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec sed -i '/console\.log/d' {} \;

# 테스트 실행
pnpm test --run 2>&1 | head -50

# 문제 시 백업 복원
# mv src.backup.* src
```

#### 2.2 로깅 라이브러리로 교체 (10분)
```typescript
// shared/lib/logger.ts
export const logger = {
  debug: process.env.NODE_ENV === 'development' ? console.log : () => {},
  info: console.info,
  warn: console.warn,
  error: console.error
};

// 자동 교체 스크립트
find src -type f -name "*.ts" -exec sed -i \
  "s/console\.log/logger.debug/g" {} \;
```

---

### Phase 3: FSD 경계 정리 (25분)

#### 3.1 의존성 그래프 생성 (5분)
```bash
# madge를 사용한 의존성 분석
npx madge --circular src > circular-deps.txt
npx madge --image deps-graph.svg src
```

#### 3.2 상향 의존성 수정 (15분)
```typescript
// 자동 감지 스크립트
const detectViolations = () => {
  const layers = ['shared', 'entities', 'features', 'widgets', 'pages', 'app'];
  const violations = [];
  
  // 각 파일의 import 검사
  // shared는 아무것도 import 불가
  // entities는 shared만 import 가능
  // ... 등등
  
  return violations;
};
```

#### 3.3 Public API 강제 (5분)
```bash
# index.ts 없는 폴더 찾기
find src -type d -exec sh -c \
  '[ ! -f "$1/index.ts" ] && echo "$1"' _ {} \;

# 자동 생성
for dir in $(find src/features -type d -depth 1); do
  [ ! -f "$dir/index.ts" ] && echo "export * from './ui';" > "$dir/index.ts"
done
```

---

### Phase 4: 테스트 정리 (25분)

#### 4.1 Mock 제거 (10분)
```typescript
// MSW 핸들러로 통합
// src/shared/lib/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // 모든 API mock을 여기로 통합
];
```

#### 4.2 테스트 파일 크기 제한 (10분)
```bash
# 300줄 이상 테스트 파일 분할
find src -name "*.test.ts" -exec wc -l {} \; | \
  awk '$1 > 300 {print $2}' | \
  while read file; do
    echo "Split required: $file"
    # 자동 분할 로직
  done
```

#### 4.3 플래키 테스트 격리 (5분)
```typescript
// 불안정한 테스트 표시
test.skip('flaky: external API dependent test', () => {
  // 추후 안정화
});
```

---

### Phase 5: 성능 최적화 (30분)

#### 5.1 번들 크기 분석 (10분)
```bash
# 번들 분석
pnpm build
npx webpack-bundle-analyzer .next/stats.json

# 큰 의존성 찾기
du -sh node_modules/* | sort -hr | head -20
```

#### 5.2 레이지 로딩 적용 (15분)
```typescript
// 자동 dynamic import 변환
const convertToDynamic = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Heavy 컴포넌트만 선택적 변환
  content = content.replace(
    /import (\w+) from ['"]\.\/Heavy(\w+)['"]/g,
    "const $1 = dynamic(() => import('./Heavy$2'))"
  );
  
  fs.writeFileSync(filePath, content);
};
```

#### 5.3 이미지 최적화 (5분)
```bash
# Next.js Image 컴포넌트로 변환
find src -type f -name "*.tsx" -exec sed -i \
  's/<img /<Image /g' {} \;
```

---

## 🚀 Quick Wins (즉시 실행 가능)

### 1. 자동화 스크립트 (5분 이내)
```bash
#!/bin/bash
# quick-wins.sh

echo "🧹 Starting Quick Wins..."

# 1. Prettier 정리
pnpm prettier --write "src/**/*.{ts,tsx}" &

# 2. Import 정렬
pnpm eslint --fix "src/**/*.{ts,tsx}" &

# 3. 빈 파일 제거
find src -type f -size 0 -delete &

# 4. 중복 의존성 제거
pnpm dedupe &

wait
echo "✅ Quick Wins Complete!"
```

### 2. Git Hooks 설정 (3분)
```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 타입 체크
pnpm tsc --noEmit || exit 1

# 린트
pnpm lint-staged

# 커밋 크기 제한 (100개 파일)
git diff --cached --name-only | wc -l | \
  awk '$1 > 100 {print "Too many files!"; exit 1}'
```

### 3. 모니터링 설정 (2분)
```bash
# monitor.sh - 실시간 상태 체크
while true; do
  clear
  echo "📊 System Status"
  echo "Memory: $(free -h | grep Mem | awk '{print $3"/"$2}')"
  echo "TypeScript Errors: $(pnpm tsc --noEmit 2>&1 | grep error | wc -l)"
  echo "Tests: $(pnpm test --run 2>&1 | grep PASS | wc -l)"
  sleep 5
done
```

---

## 📋 체크리스트

### 각 Phase 시작 전
- [ ] 현재 브랜치 백업: `git branch backup-$(date +%Y%m%d-%H%M%S)`
- [ ] 메모리 상태 확인: `free -h`
- [ ] 테스트 실행 가능 확인: `pnpm test --run`

### 각 Phase 완료 후
- [ ] 변경사항 커밋: `git commit -m "refactor: Phase X complete"`
- [ ] 빌드 확인: `pnpm build`
- [ ] 테스트 통과: `pnpm test`
- [ ] MEMORY.md 업데이트

### 위험 신호 (즉시 중단)
- 🔴 메모리 사용률 90% 이상
- 🔴 TypeScript 오류 100개 이상
- 🔴 테스트 실패율 30% 이상
- 🔴 변경 파일 100개 이상

---

## 🔄 롤백 전략

### Level 1: 파일 단위 롤백
```bash
git checkout HEAD -- path/to/file
```

### Level 2: 커밋 롤백
```bash
git reset --hard HEAD~1
```

### Level 3: 브랜치 롤백
```bash
git checkout main
git branch -D feature-branch
```

### Level 4: 백업 복원
```bash
git checkout backup-20250910-1430
```

---

## 📈 진행 상황 추적

### 메트릭 대시보드
```typescript
// metrics.ts
export const trackProgress = () => {
  return {
    typescriptErrors: countTscErrors(),
    consoleLogCount: countConsoleLogs(),
    testPassRate: getTestPassRate(),
    bundleSize: getBundleSize(),
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
  };
};
```

### 일일 보고서
```markdown
## 2025-09-10 진행 상황
- ✅ Phase 0: 완료 (5분)
- 🔄 Phase 1: 진행중 (15/30분)
- ⏸️ Phase 2-5: 대기

### 주요 성과
- TypeScript 오류: 13,577 → 8,234 (-39%)
- Console.log: 3,075 → 1,823 (-41%)
- 테스트 통과율: 91% → 93%

### 다음 단계
- Phase 1 완료
- Phase 2 시작 준비
```

---

## 🎯 예상 결과

### 단기 (1-2일)
- ✅ 빌드 안정성 100%
- ✅ TypeScript 오류 50% 감소
- ✅ 디버깅 코드 90% 제거

### 중기 (3-5일)
- ✅ FSD 경계 준수율 95%
- ✅ 테스트 커버리지 80%
- ✅ 번들 크기 30% 감소

### 장기 (1주)
- ✅ 전체 리팩토링 완료
- ✅ CI/CD 파이프라인 최적화
- ✅ 성능 예산 달성

---

**"천 리 길도 한 걸음부터" - 작은 승리를 축적하여 큰 성공을!** 🚀