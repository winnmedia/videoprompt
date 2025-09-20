# VideoPlanet 안전한 마이그레이션 실행 가이드

## 📋 실행 전 체크리스트

### 1. 환경 확인
- [ ] 프로덕션 환경에 대한 데이터베이스 백업 완료
- [ ] 데이터베이스 연결 권한 확인 (DDL 권한 필요)
- [ ] 다운타임 허용 시간 확보 (예상 실행 시간: 5-10분)

### 2. 연결 정보 확인
```bash
# DATABASE_URL 확인
echo $DATABASE_URL

# 연결 테스트
psql $DATABASE_URL -c "SELECT version();"
```

## 🚀 실행 방법

### 방법 1: Prisma를 통한 실행 (권장)
```bash
# 1. 개발환경에서 스키마 검증
pnpm exec prisma db pull

# 2. 마이그레이션 상태 확인
pnpm exec prisma migrate status

# 3. 통합 마이그레이션 실행
psql $DATABASE_URL < scripts/unified-migration-safe.sql
```

### 방법 2: 직접 PostgreSQL 실행
```bash
# 1. 연결 테스트
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Project\";"

# 2. 마이그레이션 실행
psql $DATABASE_URL -f scripts/unified-migration-safe.sql

# 3. 실행 결과 확인
psql $DATABASE_URL -c "SELECT * FROM \"MigrationLog\" WHERE migration_id = 'unified_migration_2025_01_18';"
```

## 📊 실행 후 검증

### 1. 스키마 동기화 확인
```bash
# Prisma 스키마 업데이트
pnpm exec prisma db pull

# 스키마 차이점 확인
git diff prisma/schema.prisma
```

### 2. 데이터 무결성 검증
```sql
-- 1. Scenario 테이블 검증
SELECT
    COUNT(*) as total_scenarios,
    COUNT(project_id) as linked_scenarios,
    COUNT(*) - COUNT(project_id) as orphaned_scenarios
FROM "Scenario";

-- 2. 외래키 제약조건 확인
SELECT
    COUNT(*) as invalid_references
FROM "Scenario" s
LEFT JOIN "Project" p ON s.project_id = p.id
WHERE s.project_id IS NOT NULL AND p.id IS NULL;

-- 3. 새로운 컬럼 확인
\d "Scenario"
\d "Video"
\d "Prompt"
```

### 3. 성능 인덱스 확인
```sql
-- 인덱스 존재 확인
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('Scenario', 'Video', 'Prompt')
AND indexname LIKE 'idx_%';
```

## 🔄 롤백 절차 (긴급시)

### 1. 즉시 롤백 실행
```sql
-- 마이그레이션 파일 내 롤백 스크립트 주석 해제 후 실행
-- (unified-migration-safe.sql 파일 하단 참조)
```

### 2. 백업에서 복원
```bash
# 전체 데이터베이스 백업에서 복원 (최종 수단)
pg_restore -d $DATABASE_URL backup_before_migration.dump
```

## ⚠️ 주의사항

### 트랜잭션 제한
- PostgreSQL DDL은 자동으로 커밋됨
- 각 단계별 안전성 검증 로직 포함됨
- 실패 시 부분 롤백 가능

### 데이터 손실 방지
- 모든 기존 데이터는 백업 테이블에 보관
- `IF NOT EXISTS` 조건으로 중복 실행 방지
- 외래키 제약조건은 `ON DELETE SET NULL`로 안전하게 설정

### 성능 영향
- 인덱스 생성으로 일시적 성능 저하 가능
- 대용량 테이블의 경우 실행 시간 연장 가능
- 운영 중 실행 시 읽기 전용 모드 권장

## 📞 문제 발생시 연락처
- Backend Lead: Benjamin
- 긴급 상황시 즉시 롤백 실행 후 보고