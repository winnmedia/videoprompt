# 백업/복구 전략 설계서

## 개요
VideoPlanet 플랫폼의 데이터 보호 및 재해 복구를 위한 종합적인 백업/복구 전략

## 1. 백업 정책

### 1.1 데이터 분류 및 우선순위

#### 중요도 Level 1 (Critical) - RTO: 1시간, RPO: 15분
- **사용자 계정 데이터**: users, profiles
- **프로젝트 핵심 데이터**: projects, stories, scenarios
- **영상 생성 기록**: video_generations (진행 중인 작업)

#### 중요도 Level 2 (Important) - RTO: 4시간, RPO: 1시간
- **콘텐츠 라이브러리**: prompts, assets, brand_policies
- **협업 데이터**: feedbacks, versions
- **사용량 추적**: API 호출 기록, 스토리지 사용량

#### 중요도 Level 3 (Normal) - RTO: 24시간, RPO: 24시간
- **분석 데이터**: 성능 통계, 사용 패턴
- **로그 데이터**: 시스템 로그, 에러 로그

### 1.2 백업 스케줄

#### Point-in-Time Recovery (PITR)
```sql
-- Supabase 자동 PITR 설정 (7일 보관)
-- Settings > Database > Backups에서 활성화
-- 복구 가능 시점: 매 2분마다
```

#### 일일 전체 백업 (매일 02:00 KST)
```bash
#!/bin/bash
# daily-backup.sh

# 환경변수 설정
export SUPABASE_PROJECT_ID="your-project-id"
export SUPABASE_ACCESS_TOKEN="your-access-token"
export BACKUP_STORAGE="s3://videoplanet-backups/"

# 전체 데이터베이스 덤프
pg_dump "postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres" \
    --clean --if-exists --create \
    --file="backup_$(date +%Y%m%d_%H%M%S).sql"

# S3에 업로드
aws s3 cp backup_*.sql "${BACKUP_STORAGE}daily/" --storage-class STANDARD_IA

# 7일 이상 된 일일 백업 삭제
aws s3api list-objects-v2 --bucket "videoplanet-backups" --prefix "daily/" \
    --query 'Contents[?LastModified<`2024-01-01`].Key' --output text | \
    xargs -I {} aws s3 rm "s3://videoplanet-backups/{}"
```

#### 주간 아카이브 백업 (매주 일요일 01:00 KST)
```bash
#!/bin/bash
# weekly-archive.sh

# 주간 풀백업 생성
pg_dump "postgresql://..." \
    --clean --if-exists --create \
    --compress 9 \
    --file="archive_week_$(date +%Y_W%U).sql.gz"

# 장기 보관용 S3 Glacier로 업로드
aws s3 cp archive_week_*.sql.gz "${BACKUP_STORAGE}archive/" \
    --storage-class GLACIER

# 1년 이상 된 아카이브는 Deep Archive로 이동
aws s3api list-objects-v2 --bucket "videoplanet-backups" --prefix "archive/" \
    --query 'Contents[?LastModified<`2023-01-01`].Key' --output text | \
    xargs -I {} aws s3api copy-object \
        --copy-source "videoplanet-backups/{}" \
        --bucket "videoplanet-backups" \
        --key "{}" \
        --storage-class DEEP_ARCHIVE
```

### 1.3 Supabase Storage 백업
```bash
#!/bin/bash
# storage-backup.sh

# 에셋 파일 동기화
aws s3 sync "https://[project-id].supabase.co/storage/v1/object/public/" \
    "${BACKUP_STORAGE}assets/" \
    --exclude "*.tmp" \
    --exclude "cache/*"

# 중복 제거 및 압축
rclone dedupe "${BACKUP_STORAGE}assets/" --dedupe-mode newest
```

## 2. 복구 절차

### 2.1 부분 복구 (개별 테이블/레코드)

#### 단일 레코드 복구
```sql
-- 1. PITR을 이용한 특정 시점 복구
-- Supabase Dashboard > Database > Backups > Point in Time Recovery

-- 2. 백업에서 특정 데이터 추출
-- local 환경에서 백업 파일 복원 후 필요한 데이터만 추출
CREATE TEMP TABLE temp_recovery AS
SELECT * FROM backup_projects WHERE id = 'target-project-id';

-- 3. 프로덕션에 선택적 복원
INSERT INTO projects SELECT * FROM temp_recovery
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    updated_at = NOW();
```

#### 테이블 전체 복구
```sql
-- 1. 테이블 백업 생성
CREATE TABLE projects_backup AS SELECT * FROM projects;

-- 2. 백업에서 복원
TRUNCATE projects;
INSERT INTO projects SELECT * FROM backup_file_projects;

-- 3. 데이터 무결성 검증
SELECT
    COUNT(*) as total_count,
    COUNT(DISTINCT user_id) as unique_users,
    MIN(created_at) as oldest_project,
    MAX(created_at) as newest_project
FROM projects;
```

### 2.2 전체 복구 (재해 복구)

#### 새로운 Supabase 인스턴스 생성
```bash
# 1. 새 Supabase 프로젝트 생성
supabase projects create "videoplanet-recovery"

# 2. 마이그레이션 실행
supabase db reset --db-url "postgresql://..."

# 3. 백업 데이터 복원
psql "postgresql://..." < "backup_latest.sql"

# 4. 스토리지 복원
aws s3 sync "${BACKUP_STORAGE}assets/" \
    "https://[new-project-id].supabase.co/storage/v1/object/public/"
```

#### 롤백 절차
```sql
-- 1. 현재 상태 스냅샷 생성
CREATE SCHEMA recovery_snapshot;
SELECT clone_schema('public', 'recovery_snapshot');

-- 2. 백업에서 복원
\i backup_file.sql

-- 3. 검증 실패 시 롤백
DROP SCHEMA public CASCADE;
ALTER SCHEMA recovery_snapshot RENAME TO public;
```

### 2.3 데이터 무결성 검증

#### 자동 검증 스크립트
```sql
-- integrity-check.sql
DO $$
DECLARE
    check_result RECORD;
    error_count INTEGER := 0;
BEGIN
    -- 1. 참조 무결성 검증
    FOR check_result IN
        SELECT
            conname,
            (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = conname
            )) as violation_count
        FROM pg_constraint WHERE contype = 'f'
    LOOP
        IF check_result.violation_count > 0 THEN
            RAISE WARNING 'Foreign key constraint violation: %', check_result.conname;
            error_count := error_count + 1;
        END IF;
    END LOOP;

    -- 2. 데이터 일관성 검증
    -- 프로젝트-스토리 관계
    IF EXISTS (
        SELECT 1 FROM stories s
        LEFT JOIN projects p ON s.project_id = p.id
        WHERE p.id IS NULL
    ) THEN
        RAISE WARNING 'Orphaned stories found';
        error_count := error_count + 1;
    END IF;

    -- 영상 생성-시나리오 관계
    IF EXISTS (
        SELECT 1 FROM video_generations vg
        LEFT JOIN scenarios sc ON vg.scenario_id = sc.id
        WHERE sc.id IS NULL
    ) THEN
        RAISE WARNING 'Orphaned video generations found';
        error_count := error_count + 1;
    END IF;

    -- 3. 사용자 권한 검증
    IF EXISTS (
        SELECT 1 FROM users WHERE role NOT IN ('admin', 'user', 'guest')
    ) THEN
        RAISE WARNING 'Invalid user roles found';
        error_count := error_count + 1;
    END IF;

    -- 결과 출력
    IF error_count = 0 THEN
        RAISE NOTICE 'Data integrity check passed successfully';
    ELSE
        RAISE WARNING 'Data integrity check failed with % errors', error_count;
    END IF;
END $$;
```

## 3. 복구 리허설

### 3.1 월간 복구 테스트 절차

#### 테스트 환경 설정
```bash
#!/bin/bash
# monthly-dr-test.sh

# 1. 테스트 환경 초기화
export TEST_PROJECT_ID="videoplanet-dr-test"
supabase projects create "$TEST_PROJECT_ID"

# 2. 최신 백업 복원
LATEST_BACKUP=$(aws s3 ls s3://videoplanet-backups/daily/ | sort | tail -n 1 | awk '{print $4}')
aws s3 cp "s3://videoplanet-backups/daily/$LATEST_BACKUP" ./test_backup.sql

# 3. 데이터 복원
psql "postgresql://postgres:[password]@db.$TEST_PROJECT_ID.supabase.co:5432/postgres" < test_backup.sql

# 4. 기능 테스트
npm run test:e2e:recovery

# 5. 성능 벤치마크
pgbench -h db.$TEST_PROJECT_ID.supabase.co -U postgres -d postgres -c 10 -j 2 -t 1000

# 6. 정리
supabase projects delete "$TEST_PROJECT_ID"
```

#### 테스트 체크리스트
- [ ] 데이터 복원 완료 시간 측정
- [ ] 모든 테이블 레코드 수 검증
- [ ] 핵심 기능 동작 확인
- [ ] API 응답 시간 측정
- [ ] 파일 업로드/다운로드 테스트
- [ ] 사용자 인증 기능 테스트

### 3.2 성능 지표 모니터링

#### 복구 시간 목표 (RTO)
```sql
-- 복구 시간 측정 함수
CREATE OR REPLACE FUNCTION measure_recovery_time()
RETURNS TABLE(
    operation TEXT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'schema_restore'::TEXT,
        NOW() - INTERVAL '1 hour',
        NOW(),
        INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
```

#### 복구 지점 목표 (RPO)
```sql
-- 데이터 손실 측정
CREATE OR REPLACE FUNCTION calculate_data_loss(backup_timestamp TIMESTAMP)
RETURNS TABLE(
    table_name TEXT,
    records_lost INTEGER,
    data_loss_minutes INTEGER
) AS $$
BEGIN
    -- 백업 시점 이후 생성된 레코드 계산
    RETURN QUERY
    SELECT
        'projects'::TEXT,
        COUNT(*)::INTEGER,
        EXTRACT(MINUTES FROM NOW() - backup_timestamp)::INTEGER
    FROM projects
    WHERE created_at > backup_timestamp;
END;
$$ LANGUAGE plpgsql;
```

## 4. 모니터링 및 알림

### 4.1 백업 상태 모니터링
```typescript
// backup-monitor.ts
interface BackupStatus {
  lastBackupTime: Date;
  backupSize: number;
  status: 'success' | 'failed' | 'in_progress';
  retentionCompliance: boolean;
}

async function checkBackupHealth(): Promise<BackupStatus> {
  // S3에서 최신 백업 정보 조회
  const latestBackup = await s3.listObjectsV2({
    Bucket: 'videoplanet-backups',
    Prefix: 'daily/',
    MaxKeys: 1
  }).promise();

  return {
    lastBackupTime: latestBackup.Contents?.[0]?.LastModified || new Date(0),
    backupSize: latestBackup.Contents?.[0]?.Size || 0,
    status: 'success',
    retentionCompliance: true
  };
}
```

### 4.2 알림 설정
```sql
-- 백업 실패 알림 함수
CREATE OR REPLACE FUNCTION notify_backup_failure(error_message TEXT)
RETURNS VOID AS $$
BEGIN
    -- Slack 웹훅 호출 (HTTP 확장 필요)
    PERFORM http_post(
        'https://hooks.slack.com/services/...',
        jsonb_build_object(
            'text', '🚨 백업 실패: ' || error_message,
            'channel', '#alerts',
            'username', 'VideoplanetDB'
        )::TEXT,
        'application/json'
    );
END;
$$ LANGUAGE plpgsql;
```

## 5. 보안 및 규정 준수

### 5.1 암호화
- **전송 중 암호화**: TLS 1.3
- **저장 시 암호화**: AES-256 (AWS S3 SSE-S3)
- **백업 파일 암호화**: GPG 암호화

### 5.2 접근 제어
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT:role/VideoplanetBackupRole"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::videoplanet-backups/*"
    }
  ]
}
```

### 5.3 감사 로그
```sql
-- 백업/복구 작업 로그 테이블
CREATE TABLE backup_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_type TEXT NOT NULL, -- 'backup', 'restore', 'test'
    user_id UUID REFERENCES users(id),
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    status TEXT, -- 'success', 'failed', 'in_progress'
    details JSONB,
    error_message TEXT
);
```

## 6. 비용 최적화

### 6.1 스토리지 계층화
- **Hot**: 7일간 STANDARD
- **Warm**: 30일간 STANDARD_IA
- **Cold**: 1년간 GLACIER
- **Archive**: 1년 이후 DEEP_ARCHIVE

### 6.2 중복 제거
```bash
# 중복 파일 제거로 스토리지 비용 절약
rclone dedupe s3:videoplanet-backups --dedupe-mode newest --dry-run
```

이 백업/복구 전략은 CLAUDE.md의 비용 안전 규칙을 준수하며, $300 사건과 같은 예기치 못한 비용 발생을 방지하는 모니터링 체계를 포함합니다.