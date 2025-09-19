# ADR-002: Planning Model as Universal Entity Pattern

**Status**: Accepted
**Date**: 2025-01-18
**Authors**: Architecture Lead Arthur

## Context

VideoPlanet 프로젝트에서 Prisma 스키마와 FSD entities/planning 레이어 간 타입 불일치 문제가 발생했습니다:

### 문제 상황
1. **Scenario 모델에 projectId 필드 누락** - TypeScript 컴파일 오류
2. **Video 모델 부재** - prisma.video.create() 호출하지만 모델 없음
3. **Planning vs Scenario/Prompt/Video 모델 이중화** - 아키텍처 혼재
4. **Infrastructure 레이어 타입 불안전성** - 존재하지 않는 필드 참조

### 기술적 제약
- FSD 아키텍처 경계 준수 필수
- 기존 데이터 호환성 유지
- TypeScript 타입 안전성 보장
- Clean Architecture 원칙 준수

## Decision

**Planning Model을 Universal Entity Pattern으로 채택**하여 모든 planning 관련 엔티티를 통합 관리합니다.

### 선택한 해결책: Option A (Planning 모델 확장)

```sql
model Planning {
  id            String   @id @default(uuid())
  type          String   // scenario, video, story, prompt, image
  title         String
  content       Json     // 실제 콘텐츠 데이터 (JSON 형태)
  status        String   @default("draft")
  userId        String?  @map("user_id")
  projectId     String?  @map("project_id") // ✅ 새로 추가
  version       Int      @default(1)
  metadata      Json?    // 부가 메타데이터
  storage       Json?    // 저장소 상태 추적용 ✅ 새로 추가
  source        String?  // 소스 시스템 식별 ✅ 새로 추가
  storageStatus String?  @default("pending") @map("storage_status") // ✅ 새로 추가
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
}
```

### 고려했지만 채택하지 않은 대안들

#### Option B: 개별 모델 생성
```sql
-- Scenario 모델에 projectId 추가
ALTER TABLE "Scenario" ADD COLUMN "project_id" TEXT;

-- Video 모델 신규 생성
CREATE TABLE "Video" (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES "Project"(id),
  -- ... 기타 필드
);
```

**기각 이유**:
- 모델 증식으로 인한 복잡성 증가
- FSD entities/planning과 다중 테이블 매핑 복잡성
- 스키마 마이그레이션 리스크 증가

#### Option C: Separate Service Layer
```typescript
interface PlanningService {
  scenarios: ScenarioRepository;
  prompts: PromptRepository;
  videos: VideoRepository;
}
```

**기각 이유**:
- FSD 경계 위반 (entities가 복수 인프라 의존)
- Clean Architecture 원칙 위반
- 타입 안전성 보장 어려움

## Consequences

### Positive ✅

1. **FSD 경계 준수**
   ```typescript
   entities/planning/
   ├── types.ts              // Domain Models
   ├── model/services.ts     // Use Cases
   └── infrastructure/
       ├── prisma-repository.ts  // Planning 모델만 사용
       └── supabase-repository.ts // Planning 모델만 사용
   ```

2. **단일 진실 공급원 (Single Source of Truth)**
   - 모든 planning 데이터가 Planning 테이블에 중앙 집중
   - 타입별 content 필드로 구조화된 JSON 저장
   - projectId 연관관계 명확화

3. **타입 안전성 보장**
   ```typescript
   // Type-safe 매핑 구현
   private mapScenarioToPlanning(data: ScenarioContent) {
     return {
       type: 'scenario' as const,
       content: {
         story: data.story,
         genre: data.genre,
         // ... 완전한 타입 매핑
       }
     };
   }
   ```

4. **확장 가능성**
   - 새로운 planning 타입 추가 시 스키마 변경 불필요
   - JSON content로 유연한 데이터 구조 지원
   - 버전 관리 및 메타데이터 추가 용이

5. **운영 효율성**
   - 단일 테이블로 인한 쿼리 성능 최적화
   - 백업/복구 프로세스 단순화
   - 모니터링 및 로깅 일원화

### Negative ⚠️

1. **JSON 쿼리 제약**
   - PostgreSQL JSON 쿼리 성능 고려 필요
   - 복잡한 content 검색 시 인덱스 활용 제한

2. **스키마 진화 복잡성**
   - content 구조 변경 시 마이그레이션 복잡성
   - 타입별 스키마 검증 로직 필요

3. **개발자 학습 곡선**
   - Universal Entity Pattern 이해 필요
   - JSON 매핑 로직 복잡성 증가

### Mitigation Strategies 🛠️

1. **성능 최적화**
   ```sql
   -- JSON content 검색을 위한 GIN 인덱스
   CREATE INDEX idx_planning_content_gin ON planning USING gin(content);

   -- 자주 검색되는 필드들
   CREATE INDEX idx_planning_type_status ON planning(type, status);
   CREATE INDEX idx_planning_project_type ON planning(projectId, type);
   ```

2. **타입 안전성 강화**
   ```typescript
   // Zod 스키마로 content 검증
   const ScenarioContentSchema = z.object({
     story: z.string(),
     genre: z.string(),
     // ... 완전한 스키마 정의
   });
   ```

3. **마이그레이션 전략**
   ```typescript
   // 점진적 마이그레이션 지원
   interface PlanningContentV1 { /* legacy */ }
   interface PlanningContentV2 { /* current */ }

   function migrateContent(version: number, content: any) {
     // 버전별 마이그레이션 로직
   }
   ```

## Implementation Status

### ✅ Completed
- [x] Planning 모델 스키마 확장 (projectId, storage, storageStatus 추가)
- [x] Prisma Repository Planning 모델 기반 재구현
- [x] Supabase Repository title 필드 누락 수정
- [x] TypeScript 타입 안전성 확보
- [x] FSD 경계 검증 완료

### 🔄 Next Steps
- [ ] JSON content 스키마 Zod 검증 구현
- [ ] 성능 최적화 인덱스 생성
- [ ] 마이그레이션 스크립트 실행 테스트
- [ ] API 계층에서 Planning 모델 활용 검증

## References

- [FSD Architecture Guide](https://feature-sliced.design/)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [PostgreSQL JSON Performance](https://www.postgresql.org/docs/current/datatype-json.html)
- [Prisma Universal Pattern](https://www.prisma.io/docs/guides/database/advanced-database-tasks/data-modeling/polymorphism)

---

**Architecture Lead Arthur**
*"Short-term convenience never trumps architectural integrity."*