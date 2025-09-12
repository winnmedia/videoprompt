/**
 * Jest 테스트 시퀀서
 * 
 * 목적: 데이터베이스 테스트의 실행 순서 제어
 * 의존성이 있는 테스트들을 올바른 순서로 실행
 */

const Sequencer = require('@jest/test-sequencer').default;

class DatabaseTestSequencer extends Sequencer {
  sort(tests) {
    // 테스트 실행 우선순위 정의
    const testPriority = {
      'migration-integrity.test.ts': 1,        // 기본 스키마 검증 (최우선)
      'schema-risk-scenarios.test.ts': 2,      // 위험 시나리오 (두 번째)
      'rollback-safety.test.ts': 3,            // 롤백 안전성 (세 번째)
      'api-contract-validation.test.ts': 4,    // API 계약 (마지막)
    };

    // 파일명 추출 및 우선순위 정렬
    return tests.sort((testA, testB) => {
      const fileNameA = testA.path.split('/').pop() || '';
      const fileNameB = testB.path.split('/').pop() || '';
      
      const priorityA = testPriority[fileNameA] || 999;
      const priorityB = testPriority[fileNameB] || 999;
      
      // 우선순위가 낮을수록 먼저 실행
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // 우선순위가 같으면 알파벳순
      return fileNameA.localeCompare(fileNameB);
    });
  }
}

module.exports = DatabaseTestSequencer;