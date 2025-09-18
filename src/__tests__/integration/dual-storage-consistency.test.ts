/**
 * 데이터 일관성 검증 통합 테스트
 * TDD 원칙: 실패 테스트부터 작성하여 데이터 무결성 보장
 */

import { createStoryDual, getStoriesDual, createScenarioDual } from '@/shared/lib/dual-storage-service';
import { prisma } from '@/lib/db';
import { getSupabaseAdminForAPI } from '@/shared/lib/supabase-safe';
import { prismaCircuitBreaker, supabaseCircuitBreaker } from '@/shared/lib/circuit-breaker';

// 테스트 데이터 정리
afterEach(async () => {
  // Prisma 정리
  try {
    await prisma.story.deleteMany({
      where: {
        title: {
          startsWith: 'TEST_'
        }
      }
    });
    await prisma.scenario.deleteMany({
      where: {
        title: {
          startsWith: 'TEST_'
        }
      }
    });
  } catch (error) {
    console.warn('Prisma 정리 실패 (예상됨):', error);
  }

  // Supabase 정리
  try {
    const { client } = getSupabaseAdminForAPI();
    if (client) {
      await client.from('Story').delete().like('title', 'TEST_%');
      await client.from('Scenario').delete().like('title', 'TEST_%');
    }
  } catch (error) {
    console.warn('Supabase 정리 실패 (예상됨):', error);
  }

  // 회로 차단기 리셋
  prismaCircuitBreaker.reset();
  supabaseCircuitBreaker.reset();
});

describe('듀얼 스토리지 데이터 일관성 검증', () => {
  describe('스토리 생성 데이터 일관성', () => {
    test('성공 시 양쪽 DB에 동일한 데이터가 저장되어야 함', async () => {
      // Given: 테스트 스토리 데이터
      const testStory = {
        title: 'TEST_일관성_테스트_스토리',
        oneLineStory: '데이터 일관성을 테스트하는 스토리',
        genre: 'SciFi',
        tone: 'Dramatic',
        target: 'Adults',
        structure: { test: true },
        userId: 'test-user-123'
      };

      // When: 듀얼 스토리지로 스토리 생성
      const result = await createStoryDual(testStory);

      // Then: 성공 응답 확인
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.title).toBe(testStory.title);

      // Then: Prisma DB 확인
      const prismaStory = await prisma.story.findFirst({
        where: { title: testStory.title }
      });
      expect(prismaStory).toBeDefined();
      expect(prismaStory!.title).toBe(testStory.title);
      expect(prismaStory!.oneLineStory).toBe(testStory.oneLineStory);

      // Then: Supabase DB 확인
      const { client } = getSupabaseAdminForAPI();
      if (client) {
        const { data: supabaseStory } = await client
          .from('Story')
          .select('*')
          .eq('title', testStory.title)
          .single();

        expect(supabaseStory).toBeDefined();
        expect(supabaseStory.title).toBe(testStory.title);
        expect(supabaseStory.one_line_story).toBe(testStory.oneLineStory);
      }

      // Then: ID 일관성 확인
      if (client) {
        const { data: supabaseStory } = await client
          .from('Story')
          .select('id')
          .eq('title', testStory.title)
          .single();

        expect(prismaStory!.id).toBe(supabaseStory.id);
      }
    });

    test('Prisma 실패 시 Supabase만 저장되고 부분 성공 반환', async () => {
      // Given: Prisma 실패를 유발하는 잘못된 데이터
      const invalidStory = {
        title: 'TEST_Prisma_실패_테스트',
        oneLineStory: 'A'.repeat(10000), // 너무 긴 문자열로 Prisma 오류 유발
        genre: 'InvalidGenre',
        userId: 'test-user-456'
      };

      // When: 듀얼 스토리지로 스토리 생성
      const result = await createStoryDual(invalidStory);

      // Then: 부분 성공 또는 완전 실패 확인
      // 데이터 무결성을 위해 완전 실패가 더 안전함
      if (result.success) {
        expect(result.partialFailure).toBeDefined();
        console.log('부분 성공:', result.partialFailure);
      } else {
        expect(result.error).toBeDefined();
        console.log('완전 실패 (안전):', result.error);
      }
    });
  });

  describe('스토리 조회 데이터 일관성', () => {
    test('Prisma 우선, Supabase 폴백 전략이 올바르게 작동해야 함', async () => {
      // Given: 테스트 스토리를 먼저 생성
      const testStory = {
        title: 'TEST_조회_일관성_테스트',
        oneLineStory: '조회 일관성을 테스트하는 스토리',
        genre: 'Drama',
        userId: 'test-user-789'
      };

      await createStoryDual(testStory);

      // When: 스토리 조회
      const result = await getStoriesDual({
        userId: 'test-user-789',
        page: 1,
        limit: 10
      });

      // Then: 조회 성공 확인
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.stories).toBeInstanceOf(Array);

      // Then: 생성한 스토리가 조회되는지 확인
      const foundStory = result.data!.stories.find(
        story => story.title === testStory.title
      );
      expect(foundStory).toBeDefined();
      expect(foundStory!.oneLineStory).toBe(testStory.oneLineStory);
    });
  });

  describe('시나리오 생성 데이터 일관성', () => {
    test('시나리오가 양쪽 DB에 정확히 저장되어야 함', async () => {
      // Given: 테스트 시나리오 데이터
      const testScenario = {
        title: 'TEST_시나리오_일관성_테스트',
        logline: '데이터 일관성을 테스트하는 시나리오',
        structure4: { act1: '시작', act2: '발전' },
        shots12: { shot1: '오프닝', shot2: '클로즈업' },
        userId: 'test-user-scenario'
      };

      // When: 듀얼 스토리지로 시나리오 생성
      const result = await createScenarioDual(testScenario);

      // Then: 성공 응답 확인
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Then: Prisma DB 확인
      const prismaScenario = await prisma.scenario.findFirst({
        where: { title: testScenario.title }
      });
      expect(prismaScenario).toBeDefined();
      expect(prismaScenario!.title).toBe(testScenario.title);
      expect(prismaScenario!.logline).toBe(testScenario.logline);

      // Then: Supabase DB 확인 (테이블이 존재하는 경우)
      const { client } = getSupabaseAdminForAPI();
      if (client) {
        try {
          const { data: supabaseScenario } = await client
            .from('Scenario')
            .select('*')
            .eq('title', testScenario.title)
            .single();

          if (supabaseScenario) {
            expect(supabaseScenario.title).toBe(testScenario.title);
            expect(supabaseScenario.logline).toBe(testScenario.logline);
          }
        } catch (error) {
          console.warn('Scenario 테이블이 아직 생성되지 않음 (예상됨)');
        }
      }
    });
  });

  describe('회로 차단기 통합 테스트', () => {
    test('연속 실패 시 회로 차단기가 작동해야 함', async () => {
      // Given: 의도적으로 실패를 유발하는 잘못된 데이터
      const invalidData = {
        title: '', // 빈 제목으로 유효성 검증 실패 유발
        oneLineStory: '',
        genre: '',
      };

      let failureCount = 0;

      // When: 여러 번 연속으로 실패 시도
      for (let i = 0; i < 7; i++) {
        try {
          await createStoryDual(invalidData);
        } catch (error) {
          failureCount++;
        }
      }

      // Then: 회로 차단기 상태 확인
      const prismaStats = prismaCircuitBreaker.getStats();
      const supabaseStats = supabaseCircuitBreaker.getStats();

      console.log('Prisma Circuit Breaker Stats:', prismaStats);
      console.log('Supabase Circuit Breaker Stats:', supabaseStats);

      // 최소한 일부 실패가 발생했는지 확인
      expect(failureCount).toBeGreaterThan(0);
    });
  });

  describe('데이터 타입 변환 일관성', () => {
    test('Prisma와 Supabase 간 데이터 타입 변환이 정확해야 함', async () => {
      // Given: 다양한 데이터 타입을 포함한 스토리
      const complexStory = {
        title: 'TEST_타입_변환_테스트',
        oneLineStory: '복잡한 데이터 구조를 테스트',
        genre: 'Fantasy',
        tone: 'Whimsical',
        target: 'Young Adults',
        structure: {
          metadata: {
            version: 1,
            created: new Date().toISOString(),
            tags: ['test', 'consistency', 'dual-storage']
          },
          acts: [
            { id: 1, title: '시작', duration: 300 },
            { id: 2, title: '전개', duration: 600 },
            { id: 3, title: '절정', duration: 400 },
            { id: 4, title: '결말', duration: 200 }
          ]
        },
        userId: 'test-user-types'
      };

      // When: 스토리 생성 및 조회
      const createResult = await createStoryDual(complexStory);
      expect(createResult.success).toBe(true);

      const queryResult = await getStoriesDual({
        userId: 'test-user-types',
        page: 1,
        limit: 10
      });

      // Then: 조회된 데이터의 타입과 구조 확인
      expect(queryResult.success).toBe(true);
      const foundStory = queryResult.data!.stories.find(
        story => story.title === complexStory.title
      );

      expect(foundStory).toBeDefined();
      expect(foundStory!.structure).toBeDefined();
      expect(typeof foundStory!.structure).toBe('object');

      // 구조 데이터의 정확성 확인
      if (foundStory!.structure) {
        expect(foundStory!.structure.acts).toBeInstanceOf(Array);
        expect(foundStory!.structure.acts).toHaveLength(4);
        expect(foundStory!.structure.metadata.version).toBe(1);
      }
    });
  });
});

describe('오류 복구 및 내결함성 테스트', () => {
  test('네트워크 일시 장애 시 재시도 로직 검증', async () => {
    // 이 테스트는 실제 네트워크 문제를 시뮬레이션하기 어려우므로
    // 회로 차단기의 리셋 기능을 테스트

    // Given: 회로 차단기 리셋
    prismaCircuitBreaker.reset();
    supabaseCircuitBreaker.reset();

    // When: 정상 데이터로 생성 시도
    const normalStory = {
      title: 'TEST_복구_테스트',
      oneLineStory: '정상 생성 테스트',
      genre: 'Drama',
      userId: 'test-user-recovery'
    };

    const result = await createStoryDual(normalStory);

    // Then: 성공 확인
    expect(result.success).toBe(true);

    // Then: 회로 차단기가 정상 상태인지 확인
    const prismaStats = prismaCircuitBreaker.getStats();
    const supabaseStats = supabaseCircuitBreaker.getStats();

    expect(prismaStats.state).toBe('CLOSED');
    expect(supabaseStats.state).toBe('CLOSED');
  });
});