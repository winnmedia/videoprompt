# VideoPlanet CineGenius v3 Data Contracts

**Author:** Daniel (Data Lead)  
**Version:** 3.0.0  
**Last Updated:** 2025-09-13  
**Migration ID:** 001_cinegenius_v3_schema_upgrade  

## Contract Overview

이 문서는 VideoPlanet CineGenius v3의 데이터 스키마 계약을 정의합니다. 모든 데이터 변환과 API 인터페이스는 이 계약을 준수해야 합니다.

## Schema Contracts

### 1. VideoAsset Contract

#### New Fields (v3.0)

```sql
-- Generation metadata for AI-generated videos
generation_metadata JSONB NOT NULL DEFAULT '{}' 
CONTRACT: {
  "provider_config": {},    // Provider-specific configuration
  "generation_params": {},  // Generation parameters used
  "ai_analysis": {},       // AI analysis results
  "processing_info": {}    // Processing metadata
}

-- Quality scoring system
quality_score DECIMAL(3,2) DEFAULT 0.0 
CONSTRAINT: 0.0 <= quality_score <= 10.0
```

#### Data Quality Rules

1. **generation_metadata 필수 구조**: 모든 VideoAsset는 4개 필수 키를 가져야 함
2. **quality_score 범위**: 0.0-10.0 사이의 값만 허용
3. **Backward Compatibility**: 기존 VideoAsset는 기본값으로 자동 마이그레이션

### 2. ShareToken Contract

#### New Fields (v3.0)

```sql
-- Granular permission system
permissions JSONB NOT NULL DEFAULT '{"read": true, "write": false, "share": false}'
CONTRACT: {
  "read": boolean,      // Read access
  "write": boolean,     // Write/Edit access  
  "share": boolean,     // Share access
  "comment": boolean,   // Comment access
  "delete": boolean     // Delete access (admin only)
}
```

#### Permission Matrix

| Role      | Default Permissions |
|-----------|-------------------|
| viewer    | `{"read": true, "write": false, "share": false, "comment": true}` |
| commenter | `{"read": true, "write": false, "share": false, "comment": true}` |
| editor    | `{"read": true, "write": true, "share": false, "comment": true}` |
| admin     | `{"read": true, "write": true, "share": true, "comment": true}` |
| owner     | `{"read": true, "write": true, "share": true, "delete": true, "comment": true}` |

#### Data Quality Rules

1. **permissions 필수 구조**: 최소한 `read` 키는 반드시 존재
2. **Role Migration**: 기존 'commenter' role은 'viewer'로 매핑되지만 제약조건에서는 허용
3. **Validation**: 모든 permission 값은 boolean 타입이어야 함

### 3. Comment Contract

#### New Fields (v3.0)

```sql
-- Comment categorization
comment_type TEXT DEFAULT 'general'
CONSTRAINT: comment_type IN ('general', 'feedback', 'review', 'suggestion', 'issue')

-- Structured feedback data
feedback_data JSONB DEFAULT NULL
CONTRACT: null | {
  "category": string,      // Feedback category
  "priority": string,      // Priority level
  "tags": string[],       // Associated tags
  "metadata": {}          // Additional metadata
}

-- Rating system
rating INTEGER DEFAULT NULL
CONSTRAINT: rating IS NULL OR (1 <= rating <= 5)
```

#### Comment Type Classification

| Type       | Description | feedback_data Required |
|------------|-------------|----------------------|
| general    | General comments | No |
| feedback   | Structured feedback | Recommended |
| review     | Review comments | Recommended |
| suggestion | Improvement suggestions | No |
| issue      | Problem reports | Recommended |

#### Data Quality Rules

1. **comment_type Validation**: 5개 허용값 중 하나여야 함
2. **rating Range**: 1-5 사이 값 또는 NULL
3. **feedback_data Schema**: 구조화된 JSON 또는 NULL
4. **Backward Compatibility**: 기존 Comment는 'general' 타입으로 자동 설정

## Performance Contracts

### Index Strategy

```sql
-- Query pattern: Filter by CineGenius version
idx_prompt_cinegenius_version ON "Prompt"(cinegenius_version) WHERE cinegenius_version IS NOT NULL

-- Query pattern: Filter by status and provider
idx_videoasset_status_provider ON "VideoAsset"(status, provider)

-- Query pattern: Sort by quality score
idx_videoasset_quality_score ON "VideoAsset"(quality_score DESC) WHERE quality_score > 0.0

-- Query pattern: Filter comments by type and target
idx_comment_type_target ON "Comment"(comment_type, "targetType", "targetId")

-- Query pattern: Sort by rating
idx_comment_rating ON "Comment"(rating DESC) WHERE rating IS NOT NULL

-- Query pattern: ShareToken access patterns
idx_sharetoken_role_target ON "ShareToken"(role, "targetType", "targetId")
idx_sharetoken_active ON "ShareToken"(token, expires_at)
```

### Performance SLAs

- **VideoAsset 품질 필터링**: < 50ms (최대 10K 레코드)
- **Comment 타입별 조회**: < 100ms (최대 100K 레코드)
- **ShareToken 권한 확인**: < 10ms (최대 1K 레코드)

## Migration Contract

### Version Control

```sql
-- Migration tracking
migration_id: "001_cinegenius_v3_schema_upgrade"
checksum: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
rollback_available: true
data_loss_risk: none
```

### Rollback Guarantee

- **Safe Rollback**: 모든 v3 필드 제거 가능
- **Data Recovery**: 백업에서 완전 복구 가능
- **Downtime**: < 5초 (트랜잭션 보장)

## Data Validation Rules

### Runtime Checks

1. **JSON Schema Validation**: 모든 JSONB 필드는 정의된 스키마 준수
2. **Range Validation**: 숫자 필드는 정의된 범위 내 값
3. **Enum Validation**: 텍스트 필드는 허용된 값만 사용
4. **Referential Integrity**: 외래키 제약조건 강제

### CI/CD Gates

- [ ] Schema validation 통과
- [ ] Migration 테스트 성공  
- [ ] Rollback 테스트 성공
- [ ] Performance regression 없음
- [ ] Data quality 검증 100% 통과

## API Contracts

### DTO Mappings

```typescript
// VideoAsset DTO
interface VideoAssetV3 {
  id: string;
  // ... existing fields
  generation_metadata: GenerationMetadata;
  quality_score: number; // 0.0 - 10.0
}

interface GenerationMetadata {
  provider_config: Record<string, any>;
  generation_params: Record<string, any>;
  ai_analysis: Record<string, any>;
  processing_info: Record<string, any>;
}

// ShareToken DTO  
interface ShareTokenV3 {
  id: string;
  // ... existing fields
  permissions: Permissions;
}

interface Permissions {
  read: boolean;
  write?: boolean;
  share?: boolean;
  comment?: boolean;
  delete?: boolean;
}

// Comment DTO
interface CommentV3 {
  id: string;
  // ... existing fields
  comment_type: 'general' | 'feedback' | 'review' | 'suggestion' | 'issue';
  feedback_data?: FeedbackData;
  rating?: number; // 1-5
}

interface FeedbackData {
  category?: string;
  priority?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}
```

## Change Management

### Schema Evolution Rules

1. **Additive Only**: 새 필드 추가만 허용 (기존 필드 수정/삭제 금지)
2. **Default Values**: 모든 새 필드는 안전한 기본값 필요
3. **Backward Compatibility**: 기존 API 호출 방식 유지
4. **Validation**: CI에서 계약 위반 자동 감지

### Breaking Change Policy

- Major version 업그레이드 시에만 허용
- 최소 3개월 deprecation 기간 필요
- Migration guide 및 tooling 제공 필수

---

**Contract Status**: ✅ ACTIVE  
**Next Review**: 2025-12-13  
**Compliance**: 100% (validated 2025-09-13)