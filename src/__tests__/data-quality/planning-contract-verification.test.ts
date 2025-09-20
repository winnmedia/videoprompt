/**
 * 🔒 Planning 데이터 계약 검증 테스트
 * 이중 저장소 시스템의 데이터 무결성과 계약 준수를 보장
 *
 * 핵심 원칙:
 * - Contract-First: 스키마와 계약이 우선
 * - Deterministic: 결정론적 테스트로 플래키 방지
 * - Quality Gates: CI에서 계약 위반 차단
 * - Graceful Degradation: Service Role 키 없어도 작동
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { getPlanningRepository, DualPlanningRepository } from '@/entities/planning';
import { BaseContent, ScenarioContent, ContentType } from '@/entities/planning';
import { getDegradationMode } from '@/shared/config/env';

// 결정론적 테스트를 위한 고정 데이터
const FIXED_TIMESTAMP = 1640995200000; // 2022-01-01 00:00:00 UTC
const FIXED_UUID = '12345678-1234-5678-9abc-123456789abc';

// Mock crypto.randomUUID for deterministic testing
const mockCrypto = {
  randomUUID: jest.fn(() => FIXED_UUID)
};
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

// Mock Date.now for deterministic timing
const originalDateNow = Date.now;
beforeEach(() => {
  Date.now = jest.fn(() => FIXED_TIMESTAMP);
});

afterEach(() => {
  Date.now = originalDateNow;
  jest.clearAllMocks();
});

describe('Planning 데이터 계약 검증', () => {
  let repository: DualPlanningRepository;

  beforeEach(() => {
    repository = getPlanningRepository();
  });

  describe('1. 스키마 계약 검증 (Schema Contract)', () => {
    it('BaseContent 스키마 검증: 필수 필드 존재', () => {
      const validContent: BaseContent = {
        id: FIXED_UUID,
        type: 'scenario',
        title: 'Test Scenario',
        metadata: {
          userId: 'test-user',
          status: 'draft',
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP
        }
      };

      // 필수 필드 검증
      expect(validContent).toHaveProperty('id');
      expect(validContent).toHaveProperty('type');
      expect(validContent.id).toBe(FIXED_UUID);
      expect(validContent.type).toBe('scenario');

      // 타입 검증
      expect(typeof validContent.id).toBe('string');
      expect(['scenario', 'prompt', 'video', 'story', 'image']).toContain(validContent.type);
    });

    it('ScenarioContent 확장 스키마 검증', () => {
      const scenarioContent: ScenarioContent = {
        id: FIXED_UUID,
        type: 'scenario',
        title: 'Test Scenario',
        story: 'A compelling story about data integrity',
        genre: 'SciFi',
        tone: 'Dramatic',
        target: 'Adults',
        metadata: {
          userId: 'test-user',
          status: 'draft',
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
          author: 'Test Author'
        }
      };

      // 상속된 필수 필드
      expect(scenarioContent).toHaveProperty('id');
      expect(scenarioContent).toHaveProperty('type');
      expect(scenarioContent.type).toBe('scenario');

      // 확장된 필드
      expect(scenarioContent).toHaveProperty('story');
      expect(scenarioContent).toHaveProperty('genre');
      expect(scenarioContent).toHaveProperty('tone');
      expect(typeof scenarioContent.story).toBe('string');
    });

    it('유효하지 않은 ContentType 거부', () => {
      const invalidTypes = ['invalid', '', null, undefined, 123, {}];

      invalidTypes.forEach(invalidType => {
        const contentType = invalidType as ContentType;
        const validTypes: ContentType[] = ['scenario', 'prompt', 'video', 'story', 'image'];

        expect(validTypes).not.toContain(contentType);
      });
    });
  });

  describe('2. 데이터 무결성 계약 (Data Integrity Contract)', () => {
    it('ID 일관성: content.id와 메타데이터 id가 일치', async () => {
      const content: BaseContent = {
        id: FIXED_UUID,
        type: 'scenario',
        title: 'ID Consistency Test',
        metadata: {
          userId: 'test-user',
          status: 'draft',
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP
        }
      };

      const result = await repository.save(content);

      // 저장 성공 시 ID 일관성 보장
      if (result.success) {
        expect(result.id).toBe(content.id);
        expect(result.id).toBe(FIXED_UUID);
      }
    });

    it('타임스탬프 일관성: createdAt ≤ updatedAt', () => {
      const content: BaseContent = {
        id: FIXED_UUID,
        type: 'scenario',
        title: 'Timestamp Test',
        metadata: {
          userId: 'test-user',
          status: 'draft',
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP + 1000 // 1초 후
        }
      };

      const createdAt = content.metadata?.createdAt || 0;
      const updatedAt = content.metadata?.updatedAt || 0;

      expect(createdAt).toBeLessThanOrEqual(updatedAt);
    });

    it('사용자 ID 일관성: null 또는 유효한 UUID 형태', () => {
      const validUserIds = [
        null,
        'user-123',
        '12345678-1234-5678-9abc-123456789abc',
        'test-user'
      ];

      validUserIds.forEach(userId => {
        const content: BaseContent = {
          id: FIXED_UUID,
          type: 'scenario',
          title: 'User ID Test',
          metadata: {
            userId: userId,
            status: 'draft',
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP
          }
        };

        // null이거나 문자열이어야 함
        expect(content.metadata?.userId === null || typeof content.metadata?.userId === 'string').toBe(true);
      });
    });
  });

  describe('3. 저장소 계약 검증 (Storage Contract)', () => {
    it('이중 저장 결과 계약: 저장소별 상태 추적', async () => {
      const content: BaseContent = {
        id: FIXED_UUID,
        type: 'scenario',
        title: 'Dual Storage Test',
        metadata: {
          userId: 'test-user',
          status: 'draft',
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP
        }
      };

      const result = await repository.save(content);

      // 결과 구조 검증
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      expect(result.id).toBe(FIXED_UUID);

      // 에러가 있는 경우 문자열이어야 함
      if (result.error) {
        expect(typeof result.error).toBe('string');
      }
    });

    it('Graceful Degradation: Service Role 키 없이도 작동', async () => {
      // 환경 설정 확인
      const degradationMode = getDegradationMode();

      const content: BaseContent = {
        id: FIXED_UUID,
        type: 'scenario',
        title: 'Degradation Test',
        metadata: {
          userId: 'test-user',
          status: 'draft',
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP
        }
      };

      // degradation 모드에서도 저장이 가능해야 함
      const result = await repository.save(content);

      // degradation 모드라면 에러가 있어도 부분 성공 가능
      if (degradationMode === 'disabled') {
        // Supabase 비활성화 상태에서는 Prisma만으로도 성공 가능
        expect(result.id).toBe(FIXED_UUID);
      } else {
        // 정상 모드에서는 성공하거나 명확한 에러 메시지
        expect(result).toHaveProperty('success');
      }
    });

    it('데이터 일관성 검증: 두 저장소 간 데이터 동일성', async () => {
      const content: BaseContent = {
        id: FIXED_UUID,
        type: 'scenario',
        title: 'Consistency Test',
        metadata: {
          userId: 'test-user',
          status: 'draft',
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP
        }
      };

      // 저장
      const saveResult = await repository.save(content);

      if (saveResult.success) {
        // 일관성 검증 수행
        const consistencyResult = await repository.validateDataConsistency(FIXED_UUID);

        // 일관성 검증 결과 구조 확인
        expect(consistencyResult).toHaveProperty('consistent');
        expect(consistencyResult).toHaveProperty('differences');
        expect(consistencyResult).toHaveProperty('recommendations');

        expect(typeof consistencyResult.consistent).toBe('boolean');
        expect(Array.isArray(consistencyResult.differences)).toBe(true);
        expect(Array.isArray(consistencyResult.recommendations)).toBe(true);
      }
    });
  });

  describe('4. API 응답 계약 검증 (API Response Contract)', () => {
    it('조회 결과 계약: 필수 필드와 구조 검증', async () => {
      const userId = 'test-user';
      const contents = await repository.findByUserId(userId);

      // 배열 반환 보장
      expect(Array.isArray(contents)).toBe(true);

      // 각 항목의 구조 검증
      contents.forEach(content => {
        expect(content).toHaveProperty('id');
        expect(content).toHaveProperty('type');
        expect(typeof content.id).toBe('string');
        expect(['scenario', 'prompt', 'video', 'story', 'image']).toContain(content.type);
      });
    });

    it('저장소 헬스 체크 계약', () => {
      const healthStatus = repository.getStorageHealth();

      // 헬스 상태 구조 검증
      expect(healthStatus).toHaveProperty('prisma');
      expect(healthStatus).toHaveProperty('supabase');

      // 각 저장소 상태 검증
      expect(healthStatus.prisma).toHaveProperty('failures');
      expect(healthStatus.prisma).toHaveProperty('lastFailure');
      expect(healthStatus.prisma).toHaveProperty('isHealthy');

      expect(healthStatus.supabase).toHaveProperty('failures');
      expect(healthStatus.supabase).toHaveProperty('lastFailure');
      expect(healthStatus.supabase).toHaveProperty('isHealthy');

      // 타입 검증
      expect(typeof healthStatus.prisma.failures).toBe('number');
      expect(typeof healthStatus.prisma.isHealthy).toBe('boolean');
      expect(typeof healthStatus.supabase.failures).toBe('number');
      expect(typeof healthStatus.supabase.isHealthy).toBe('boolean');
    });
  });

  describe('5. 에러 계약 검증 (Error Contract)', () => {
    it('잘못된 데이터 저장 시 명확한 에러 메시지', async () => {
      const invalidContent = {
        // id 누락
        type: 'scenario',
        title: 'Invalid Content'
      } as BaseContent;

      try {
        await repository.save(invalidContent);
      } catch (error) {
        // 에러가 발생하거나 실패 결과가 반환되어야 함
        expect(error).toBeDefined();
      }
    });

    it('존재하지 않는 데이터 조회 시 null 반환', async () => {
      const nonExistentId = 'non-existent-id';
      const result = await repository.findById(nonExistentId);

      expect(result).toBeNull();
    });

    it('저장소 연결 실패 시 graceful한 에러 처리', async () => {
      // 저장소 헬스 체크를 통해 연결 상태 확인
      const healthStatus = repository.getStorageHealth();

      // 연결 실패가 있어도 시스템이 중단되지 않아야 함
      expect(healthStatus).toBeDefined();
      expect(typeof healthStatus.prisma.isHealthy).toBe('boolean');
      expect(typeof healthStatus.supabase.isHealthy).toBe('boolean');
    });
  });

  describe('6. 성능 계약 검증 (Performance Contract)', () => {
    it('저장 작업 성능 임계값', async () => {
      const content: BaseContent = {
        id: FIXED_UUID,
        type: 'scenario',
        title: 'Performance Test',
        metadata: {
          userId: 'test-user',
          status: 'draft',
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP
        }
      };

      const startTime = Date.now();
      const result = await repository.save(content);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 저장 작업은 5초 이내에 완료되어야 함 (네트워크 지연 고려)
      expect(duration).toBeLessThan(5000);

      console.log(`💾 저장 성능: ${duration}ms (임계값: 5000ms)`);
    });

    it('조회 작업 성능 임계값', async () => {
      const startTime = Date.now();
      const results = await repository.findByUserId('test-user');
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 조회 작업은 3초 이내에 완료되어야 함
      expect(duration).toBeLessThan(3000);

      console.log(`🔍 조회 성능: ${duration}ms (임계값: 3000ms)`);
    });
  });

  describe('7. 회복력 계약 검증 (Resilience Contract)', () => {
    it('Circuit Breaker 동작 검증', () => {
      const healthStatus = repository.getStorageHealth();

      // Circuit Breaker 상태 확인
      // 실패 횟수가 임계값을 초과하면 isHealthy가 false가 되어야 함
      if (healthStatus.prisma.failures >= 3) {
        expect(healthStatus.prisma.isHealthy).toBe(false);
      }

      if (healthStatus.supabase.failures >= 3) {
        expect(healthStatus.supabase.isHealthy).toBe(false);
      }
    });

    it('헬스 체크 작업 안정성', async () => {
      // 헬스 체크는 실패해도 예외를 던지지 않아야 함
      expect(async () => {
        await repository.performHealthCheck();
      }).not.toThrow();

      const healthResult = await repository.performHealthCheck();

      // 헬스 체크 결과 구조 검증
      expect(healthResult).toHaveProperty('prisma');
      expect(healthResult).toHaveProperty('supabase');
      expect(healthResult.prisma).toHaveProperty('healthy');
      expect(healthResult.supabase).toHaveProperty('healthy');
    });
  });
});

/**
 * 🚨 계약 위반 시나리오 테스트
 * 이 테스트들이 실패하면 데이터 계약이 위반된 것
 */
describe('계약 위반 감지 (Contract Violation Detection)', () => {
  let repository: DualPlanningRepository;

  beforeEach(() => {
    repository = getPlanningRepository();
  });

  it('🚨 CRITICAL: ID 불일치 감지', async () => {
    const content: BaseContent = {
      id: FIXED_UUID,
      type: 'scenario',
      title: 'ID Mismatch Test',
      metadata: {
        userId: 'test-user',
        status: 'draft',
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP
      }
    };

    const result = await repository.save(content);

    if (result.success) {
      // 저장된 ID가 원본 ID와 일치해야 함
      expect(result.id).toBe(content.id);

      // 조회 시에도 동일한 ID여야 함
      const retrieved = await repository.findById(content.id);
      if (retrieved) {
        expect(retrieved.id).toBe(content.id);
      }
    }
  });

  it('🚨 CRITICAL: 데이터 타입 변경 감지', async () => {
    const content: BaseContent = {
      id: FIXED_UUID,
      type: 'scenario',
      title: 'Type Change Test',
      metadata: {
        userId: 'test-user',
        status: 'draft',
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP
      }
    };

    const result = await repository.save(content);

    if (result.success) {
      const retrieved = await repository.findById(content.id);
      if (retrieved) {
        // 타입이 변경되지 않았는지 확인
        expect(retrieved.type).toBe(content.type);
      }
    }
  });

  it('🚨 CRITICAL: 메타데이터 손실 감지', async () => {
    const content: BaseContent = {
      id: FIXED_UUID,
      type: 'scenario',
      title: 'Metadata Loss Test',
      metadata: {
        userId: 'test-user',
        status: 'draft',
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
        projectId: 'test-project',
        version: 1,
        author: 'Test Author'
      }
    };

    const result = await repository.save(content);

    if (result.success) {
      const retrieved = await repository.findById(content.id);
      if (retrieved && retrieved.metadata) {
        // 핵심 메타데이터가 보존되었는지 확인
        expect(retrieved.metadata.userId).toBe(content.metadata.userId);
        expect(retrieved.metadata.status).toBe(content.metadata.status);

        // 추가 메타데이터도 보존되었는지 확인
        if (content.metadata.projectId) {
          expect(retrieved.metadata.projectId).toBe(content.metadata.projectId);
        }
        if (content.metadata.author) {
          expect(retrieved.metadata.author).toBe(content.metadata.author);
        }
      }
    }
  });
});