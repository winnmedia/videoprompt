# 📊 VideoPlanet 데이터 모델 활용 전략

**Data Lead: Daniel**
**작성일**: 2025-09-18
**버전**: v1.0

## 🎯 전략적 결정: Planning 모델 통합 활용

### 📋 현재 상황 분석

#### **기존 모델들**
```prisma
// 1. 전용 모델들 (타입별 특화)
model Scenario {
  id         String   @id @default(uuid())
  title      String
  logline    String?
  projectId  String?  // ⚠️ 마이그레이션 필요
  // ... 시나리오 특화 필드들
}

model Story {
  id           String   @id @default(uuid())
  title        String
  oneLineStory String
  // ... 스토리 특화 필드들
}

// 2. 통합 모델 (범용 활용)
model Planning {
  id            String   @id @default(uuid())
  type          String   // scenario, video, story, prompt, image
  title         String
  content       Json     // 실제 콘텐츠 데이터
  projectId     String?  // ✅ 이미 존재
  // ... 통합 관리 필드들
}
```

## ⚖️ 전략적 의사결정

### **결정: Planning 모델 중심 통합 전략 채택**

#### **핵심 이유**
1. **스키마 일관성**: Planning 모델에 이미 `projectId` 필드 존재
2. **확장성**: 새로운 콘텐츠 타입 추가 시 스키마 변경 불필요
3. **데이터 무결성**: 단일 모델로 관리하여 일관성 보장
4. **개발 효율성**: 중복된 CRUD 로직 제거

### **마이그레이션 전략**

#### **Phase 1: Scenario → Planning 데이터 이관**
```sql
-- 기존 Scenario 데이터를 Planning으로 이관
INSERT INTO "planning" (
    id, type, title, content, status, user_id, project_id,
    version, created_at, updated_at
)
SELECT
    id,
    'scenario' as type,
    title,
    jsonb_build_object(
        'logline', logline,
        'structure4', structure4,
        'shots12', shots12,
        'pdf_url', pdf_url,
        'created_by', created_by
    ) as content,
    'completed' as status,
    user_id,
    project_id,  -- 마이그레이션 후 사용 가능
    version,
    created_at,
    updated_at
FROM "Scenario"
WHERE NOT EXISTS (
    SELECT 1 FROM "planning" p
    WHERE p.id = "Scenario".id
);
```

#### **Phase 2: Story → Planning 데이터 이관**
```sql
-- 기존 Story 데이터를 Planning으로 이관
INSERT INTO "planning" (
    id, type, title, content, status, user_id,
    version, created_at, updated_at
)
SELECT
    id,
    'story' as type,
    title,
    jsonb_build_object(
        'one_line_story', one_line_story,
        'genre', genre,
        'tone', tone,
        'target', target,
        'structure', structure
    ) as content,
    'completed' as status,
    user_id,
    1 as version,
    created_at,
    updated_at
FROM "Story"
WHERE NOT EXISTS (
    SELECT 1 FROM "planning" p
    WHERE p.id = "Story".id
);
```

## 🏗️ 통합 데이터 구조

### **Planning 모델 Content 스키마**

```typescript
// 타입별 Content 구조 정의
interface ScenarioContent {
  logline?: string;
  structure4?: any;
  shots12?: any;
  pdf_url?: string;
  created_by?: string;
}

interface StoryContent {
  one_line_story: string;
  genre: string;
  tone?: string;
  target?: string;
  structure?: any;
}

interface VideoContent {
  provider: string;
  url?: string;
  duration?: number;
  aspect_ratio: string;
  generation_metadata: any;
}

interface PromptContent {
  metadata: any;
  timeline: any;
  negative?: any;
  ai_analysis?: any;
  cinegenius_version?: string;
  generation_control?: any;
  user_input?: any;
}

// 통합 타입
type PlanningContent =
  | ScenarioContent
  | StoryContent
  | VideoContent
  | PromptContent;
```

## 🔄 API 계층 전략

### **DTO → Planning 변환 계층**

```typescript
// src/shared/api/dto-transformers.ts

export class PlanningTransformer {
  static scenarioToPlanning(scenario: ScenarioDTO): PlanningCreateDTO {
    return {
      type: 'scenario',
      title: scenario.title,
      content: {
        logline: scenario.logline,
        structure4: scenario.structure4,
        shots12: scenario.shots12,
        pdf_url: scenario.pdfUrl,
        created_by: scenario.createdBy
      },
      projectId: scenario.projectId,
      userId: scenario.userId,
      status: 'completed'
    };
  }

  static planningToScenario(planning: Planning): ScenarioDTO {
    const content = planning.content as ScenarioContent;
    return {
      id: planning.id,
      title: planning.title,
      logline: content.logline,
      structure4: content.structure4,
      shots12: content.shots12,
      pdfUrl: content.pdf_url,
      createdBy: content.created_by,
      projectId: planning.projectId,
      userId: planning.userId,
      version: planning.version,
      createdAt: planning.createdAt,
      updatedAt: planning.updatedAt
    };
  }

  static storyToPlanning(story: StoryDTO): PlanningCreateDTO {
    return {
      type: 'story',
      title: story.title,
      content: {
        one_line_story: story.oneLineStory,
        genre: story.genre,
        tone: story.tone,
        target: story.target,
        structure: story.structure
      },
      userId: story.userId,
      status: 'completed'
    };
  }
}
```

### **서비스 레이어 통합**

```typescript
// src/entities/planning/infrastructure/planning.service.ts

export class PlanningService {
  // 타입별 조회 메서드
  async getScenarios(projectId?: string): Promise<ScenarioDTO[]> {
    const plannings = await this.repository.findMany({
      where: {
        type: 'scenario',
        ...(projectId && { projectId })
      }
    });

    return plannings.map(PlanningTransformer.planningToScenario);
  }

  async getStories(userId?: string): Promise<StoryDTO[]> {
    const plannings = await this.repository.findMany({
      where: {
        type: 'story',
        ...(userId && { userId })
      }
    });

    return plannings.map(PlanningTransformer.planningToStory);
  }

  // 통합 생성 메서드
  async createContent<T>(
    type: string,
    data: T,
    transformer: (data: T) => PlanningCreateDTO
  ): Promise<Planning> {
    const planningData = transformer(data);
    return await this.repository.create(planningData);
  }
}
```

## 📊 데이터 품질 관리

### **스키마 검증 (Zod)**

```typescript
// src/shared/schemas/planning-content.schema.ts

import { z } from 'zod';

export const ScenarioContentSchema = z.object({
  logline: z.string().optional(),
  structure4: z.any().optional(),
  shots12: z.any().optional(),
  pdf_url: z.string().url().optional(),
  created_by: z.string().optional()
});

export const StoryContentSchema = z.object({
  one_line_story: z.string().min(1),
  genre: z.string().min(1),
  tone: z.string().optional(),
  target: z.string().optional(),
  structure: z.any().optional()
});

export const PlanningContentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scenario'),
    content: ScenarioContentSchema
  }),
  z.object({
    type: z.literal('story'),
    content: StoryContentSchema
  }),
  // ... 다른 타입들
]);
```

### **데이터 일관성 검증**

```sql
-- 정기적 데이터 품질 검증 쿼리
-- 1. 타입별 데이터 개수 확인
SELECT
    type,
    COUNT(*) as count,
    COUNT(project_id) as with_project,
    COUNT(*) - COUNT(project_id) as orphaned
FROM planning
GROUP BY type;

-- 2. Content 구조 검증
SELECT
    type,
    COUNT(*) as total,
    COUNT(CASE WHEN content ? 'title' THEN 1 END) as has_title,
    COUNT(CASE WHEN jsonb_typeof(content) = 'object' THEN 1 END) as valid_json
FROM planning
GROUP BY type;

-- 3. 참조 무결성 검증
SELECT
    p.type,
    COUNT(*) as invalid_refs
FROM planning p
LEFT JOIN "Project" pr ON p.project_id = pr.id
WHERE p.project_id IS NOT NULL AND pr.id IS NULL
GROUP BY p.type;
```

## 🚀 마이그레이션 실행 순서

### **1단계: Scenario 테이블 업데이트 (완료)**
- ✅ `project_id` 컬럼 추가
- ✅ 외래키 제약조건 설정
- ✅ 인덱스 생성

### **2단계: Planning 통합 준비**
```bash
# Scenario → Planning 데이터 이관
psql $DATABASE_URL -f scripts/migrate-scenario-to-planning.sql

# Story → Planning 데이터 이관
psql $DATABASE_URL -f scripts/migrate-story-to-planning.sql
```

### **3단계: API 레이어 업데이트**
- 기존 `/api/planning/scenario` 엔드포인트를 Planning 기반으로 변경
- 기존 `/api/planning/stories` 엔드포인트를 Planning 기반으로 변경
- 하위 호환성을 위한 응답 형식 유지

### **4단계: 점진적 전환**
- 새로운 데이터는 Planning 모델로만 저장
- 기존 Scenario/Story 테이블은 읽기 전용으로 유지
- 6개월 후 기존 테이블 제거 검토

## 💡 혜택 및 성과

### **즉시 효과**
1. **개발 속도 향상**: 새로운 콘텐츠 타입 추가 시 스키마 변경 불필요
2. **데이터 일관성**: 단일 모델로 관리하여 중복 및 불일치 제거
3. **쿼리 성능**: 통합된 인덱스로 복합 조회 성능 향상

### **장기적 효과**
1. **유지보수성**: 단일 모델에 대한 CRUD 로직으로 복잡성 감소
2. **확장성**: 새로운 기능 요구사항에 유연하게 대응
3. **데이터 분석**: 통합된 데이터로 크로스 분석 가능

## ⚠️ 위험 요소 및 대응

### **위험 요소**
1. **스키마 복잡성**: JSON 필드의 구조 관리 복잡성
2. **타입 안전성**: 런타임 타입 검증 필요성
3. **쿼리 성능**: JSON 필드 검색 시 성능 이슈

### **대응 방안**
1. **스키마 문서화**: 타입별 Content 구조 명확히 정의
2. **Zod 검증**: 런타임 타입 안전성 보장
3. **인덱스 최적화**: JSON 필드에 GIN 인덱스 활용

---

**Data Lead Daniel의 권고**: Planning 모델 통합 전략은 현재 상황에서 가장 효율적이고 안전한 접근법입니다. 기존 데이터 보전과 함께 미래 확장성을 동시에 확보할 수 있습니다.