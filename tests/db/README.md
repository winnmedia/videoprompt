# 🗄️ 데이터베이스 계약 검증 테스트 스위트

## 📋 개요

Benjamin이 발견한 계약 위반 사항들에 대한 체계적인 TDD 기반 테스트 전략입니다.

### 🚨 발견된 계약 위반 사항

1. **CineGenius v3 지원 SQL이 부분적으로만 적용됨**
   - VideoAsset: `generation_metadata`, `quality_score` 필드 누락
   - Comment: `comment_type`, `feedback_data`, `rating` 필드 누락
   - ShareToken: `permissions` 필드 누락

2. **MigrationLog 테이블이 존재하지 않음**
   - 마이그레이션 추적 불가능
   - 롤백 시 기준점 부재

3. **인덱스 및 제약조건 누락**
   - 성능 최적화 인덱스 부재
   - 데이터 무결성 제약조건 누락

4. **수동 마이그레이션 검증 프로세스 부재**
   - 자동화된 검증 시스템 없음
   - 프로덕션 데이터 보호 장치 부재

## 🧪 테스트 구조

### 핵심 원칙: TDD (Red → Green → Refactor)

```
tests/db/
├── migration-integrity.test.ts      # 마이그레이션 무결성 검증
├── schema-risk-scenarios.test.ts    # 스키마 변경 위험 시나리오
├── rollback-safety.test.ts          # 롤백 안전성 검증
├── api-contract-validation.test.ts  # API 계약 검증
├── jest.config.js                   # Jest 설정
├── jest.setup.ts                    # 전역 테스트 설정
├── setup.ts                         # 환경 변수 로딩
└── test-sequencer.js                # 테스트 실행 순서 제어
```

## 🚀 실행 방법

### 1. 로컬 실행

```bash
# 모든 DB 계약 테스트 실행
./scripts/db-contract-test.sh

# 파일 변경 감지 모드
./scripts/db-contract-test.sh --watch

# CI 모드 (엄격한 검증)
./scripts/db-contract-test.sh --ci

# 상세한 출력
./scripts/db-contract-test.sh --verbose
```

### 2. 개별 테스트 실행

```bash
# 마이그레이션 무결성만 검증
npx jest --config=tests/db/jest.config.js tests/db/migration-integrity.test.ts

# API 계약만 검증
npx jest --config=tests/db/jest.config.js tests/db/api-contract-validation.test.ts
```

### 3. CI/CD에서 자동 실행

GitHub Actions 워크플로우가 다음 상황에서 자동 실행됩니다:

- PR 생성/업데이트 시 (DB 관련 파일 변경 시)
- main/develop 브랜치 푸시 시
- 수동 실행 (`workflow_dispatch`)

## 🔍 테스트 상세 내용

### 1. migration-integrity.test.ts

**목적**: 마이그레이션의 완전성과 일관성 검증

```typescript
// RED 테스트 예시: 현재 실패하는 테스트들
test('generation_metadata 필드가 존재해야 함', async () => {
  // VideoAsset 테이블에 generation_metadata 필드가 없으므로 실패
  expect(dbColumns).toContain('generation_metadata');
});

test('MigrationLog 테이블이 존재해야 함', async () => {
  // MigrationLog 테이블이 존재하지 않으므로 실패
  expect(result.rows).toHaveLength(1);
});
```

**검증 항목**:
- CineGenius v3.1 새 필드들 존재 여부
- MigrationLog 테이블 및 스키마
- 인덱스 생성 상태
- 제약조건 설정
- 데이터 타입 일치성

### 2. schema-risk-scenarios.test.ts

**목적**: 스키마 변경으로 인한 위험 시나리오 사전 검증

```typescript
// 데이터 손실 방지 테스트
test('기존 NULL 데이터가 있는 필드에 NOT NULL 추가 시 충돌 검사', async () => {
  // 기존 데이터의 NULL 값 확인 후 제약조건 추가 위험성 평가
});

// 성능 영향 테스트  
test('대용량 테이블의 ALTER 작업 위험도 평가', async () => {
  // 테이블 크기 확인 후 락 시간 추정
});
```

**검증 항목**:
- 데이터 타입 변경 호환성
- NOT NULL 제약조건 추가 위험성
- 외래키 참조 무결성
- 인덱스 변경 성능 영향
- 대용량 테이블 ALTER 위험성
- 트랜잭션 충돌 및 데드락 위험

### 3. rollback-safety.test.ts

**목적**: 마이그레이션 실패 시 안전한 롤백 보장

```typescript
// 롤백 안전성 테스트
test('마이그레이션 실패 시 전체 트랜잭션이 롤백되어야 함', async () => {
  await pgClient.query('BEGIN');
  // 의도적 실패 후 롤백 검증
  await pgClient.query('ROLLBACK');
});
```

**검증 항목**:
- 트랜잭션 롤백 정상 동작
- 기존 데이터 보존
- 외래키 관계 유지
- 임시 객체 정리
- 롤백 성능 및 시간 제한
- 스키마 일관성 복구

### 4. api-contract-validation.test.ts

**목적**: API 응답과 DB 스키마 간 계약 일치성 검증

```typescript
// API-DB 스키마 불일치 감지
test('VideoAsset API 응답이 새로운 DB 필드를 포함해야 함', async () => {
  // 현재 API는 generation_metadata를 반환하지 않으므로 실패
  expect(dbColumns).toContain('generation_metadata');
});
```

**검증 항목**:
- API 응답 스키마와 DB 스키마 일치성
- Zod 스키마와 Prisma 모델 동기화
- CineGenius v2.0 → v3.1 호환성
- JSONB 필드 구조 검증
- 버전별 API 계약 추적

## 📊 결정론적 테스트 보장

### Flaky Test 방지 조치

1. **고정된 데이터베이스 연결**
   - 테스트용 PostgreSQL 컨테이너 사용
   - 연결 풀 크기 제한 (1-5개)

2. **순차적 실행**
   - `maxWorkers: 1` 설정
   - 테스트 순서 강제 (`test-sequencer.js`)

3. **격리된 환경**
   - 각 테스트마다 독립적인 트랜잭션
   - 테스트 간 상태 공유 방지

4. **결정론적 검증**
   - 시간 의존적 테스트 배제
   - 랜덤 데이터 생성 금지

## 🛡️ 프로덕션 데이터 보호

### 안전장치

1. **읽기 전용 테스트**
   - 실제 데이터 변경 없음
   - 스키마 검증만 수행

2. **트랜잭션 롤백**
   - 모든 변경 사항 즉시 롤백
   - 테스트 후 원상복구

3. **환경 분리**
   - 테스트 전용 데이터베이스 사용
   - 프로덕션 환경과 완전 격리

## 🎯 품질 게이트

### 통과 기준

- ✅ 모든 테스트 통과 (100%)
- ✅ 실행 시간 30초 이내
- ✅ 메모리 사용량 제한 내
- ✅ 동시성 문제 없음

### 실패 시 조치

1. **즉시 차단**: PR 병합 차단
2. **자동 알림**: 슬랙/이메일 알림
3. **상세 로그**: 실패 원인 분석 리포트
4. **수정 가이드**: 구체적인 해결 방법 제시

## 🔧 설정 및 환경 변수

### 필수 환경 변수

```bash
# 데이터베이스 연결
DATABASE_URL=postgresql://username:password@host:port/database

# 테스트 환경 설정
NODE_ENV=test
LOG_LEVEL=error
```

### Jest 설정

```javascript
// tests/db/jest.config.js
module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1,           // 병렬 실행 비활성화
  testTimeout: 30000,      // 30초 타임아웃
  bail: 1,                 // 첫 실패 시 중단
  cache: false             // 캐시 비활성화
};
```

## 📈 성능 및 모니터링

### 성능 지표

- **테스트 실행 시간**: < 30초
- **메모리 사용량**: < 512MB
- **DB 연결 수**: < 5개
- **쿼리 실행 시간**: < 1초/쿼리

### 모니터링

```bash
# 테스트 성능 모니터링
./scripts/db-contract-test.sh --verbose 2>&1 | tee test-performance.log

# 느린 테스트 감지
grep "느린 테스트 감지" test-performance.log
```

## 🏃‍♀️ 빠른 시작

1. **환경 변수 설정**
   ```bash
   cp .env.example .env
   # DATABASE_URL 수정
   ```

2. **의존성 설치**
   ```bash
   pnpm install
   ```

3. **테스트 실행**
   ```bash
   ./scripts/db-contract-test.sh
   ```

4. **결과 확인**
   ```bash
   open test-results/db/db-contract-tests.html
   ```

## 🆘 문제 해결

### 자주 발생하는 문제

1. **데이터베이스 연결 실패**
   ```
   해결: DATABASE_URL 환경 변수 확인
   ```

2. **테스트 타임아웃**
   ```
   해결: 데이터베이스 성능 확인, 인덱스 최적화
   ```

3. **권한 오류**
   ```
   해결: PostgreSQL 사용자 권한 확인
   ```

### 로그 분석

```bash
# 상세한 오류 로그 확인
./scripts/db-contract-test.sh --verbose > debug.log 2>&1

# 특정 테스트 디버깅
npx jest --config=tests/db/jest.config.js tests/db/migration-integrity.test.ts --verbose
```

## 📞 지원 및 기여

문제가 발생하거나 개선사항이 있다면:

1. **이슈 생성**: GitHub Issues에 상세한 내용 작성
2. **PR 제출**: 수정사항이 있다면 Pull Request 생성
3. **문서 개선**: 사용법이나 설명 개선 제안

---

**⚡ Grace (QA Lead) 메시지**: 
*이 테스트 스위트는 Benjamin이 발견한 심각한 계약 위반 사항들을 체계적으로 검증합니다. 모든 테스트는 TDD Red 단계에서 시작하여 실제 문제를 감지할 수 있도록 설계되었습니다. 품질에 타협은 없습니다.*