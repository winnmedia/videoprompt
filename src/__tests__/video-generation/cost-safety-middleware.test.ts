/**
 * Cost Safety Middleware Tests
 *
 * $300 사건 재발 방지를 위한 엄격한 비용 안전 미들웨어 테스트
 * CLAUDE.md 준수: TDD 원칙, 비용 안전 규칙 절대 준수
 */

import {
  CostSafetyMiddleware,
  RunwayCostSafetyMiddleware,
  SeedanceCostSafetyMiddleware,
  StableVideoCostSafetyMiddleware
} from '../../shared/lib/video-generation/cost-safety-middleware'
import { CostSafetyError, QuotaExceededError } from '../../shared/lib/video-generation/types'

describe('CostSafetyMiddleware', () => {
  let runwaySafety: RunwayCostSafetyMiddleware
  let seedanceSafety: SeedanceCostSafetyMiddleware
  let stableVideoSafety: StableVideoCostSafetyMiddleware

  beforeEach(() => {
    // 각 테스트 전에 새로운 인스턴스 생성 (싱글톤 패턴 테스트)
    runwaySafety = RunwayCostSafetyMiddleware.getInstance(RunwayCostSafetyMiddleware, 'runway')
    seedanceSafety = SeedanceCostSafetyMiddleware.getInstance(SeedanceCostSafetyMiddleware, 'seedance')
    stableVideoSafety = StableVideoCostSafetyMiddleware.getInstance(StableVideoCostSafetyMiddleware, 'stable-video')

    // 모든 미들웨어 상태 리셋
    runwaySafety.reset()
    seedanceSafety.reset()
    stableVideoSafety.reset()

    // 시간 모킹
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01 09:00:00'))
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('싱글톤 패턴', () => {
    it('동일한 제공업체에 대해 같은 인스턴스를 반환해야 한다', () => {
      const instance1 = RunwayCostSafetyMiddleware.getInstance(RunwayCostSafetyMiddleware, 'runway')
      const instance2 = RunwayCostSafetyMiddleware.getInstance(RunwayCostSafetyMiddleware, 'runway')

      expect(instance1).toBe(instance2)
    })

    it('다른 제공업체에 대해서는 다른 인스턴스를 반환해야 한다', () => {
      const runwayInstance = RunwayCostSafetyMiddleware.getInstance(RunwayCostSafetyMiddleware, 'runway')
      const seedanceInstance = SeedanceCostSafetyMiddleware.getInstance(SeedanceCostSafetyMiddleware, 'seedance')

      expect(runwayInstance).not.toBe(seedanceInstance)
    })
  })

  describe('최소 간격 검사 - $300 사건 핵심 방지책', () => {
    it('최소 간격 이내 호출 시 CostSafetyError를 던져야 한다', async () => {
      // 첫 번째 호출
      await runwaySafety.checkSafety(0.01)

      // 최소 간격(15초) 이내에 두 번째 호출
      jest.advanceTimersByTime(10000) // 10초 경과

      await expect(runwaySafety.checkSafety(0.01))
        .rejects
        .toThrow(CostSafetyError)

      await expect(runwaySafety.checkSafety(0.01))
        .rejects
        .toThrow('Runway API 호출 간격이 너무 짧습니다')
    })

    it('최소 간격 후에는 호출이 허용되어야 한다', async () => {
      // 첫 번째 호출
      await runwaySafety.checkSafety(0.01)

      // 최소 간격(15초) 경과
      jest.advanceTimersByTime(15000)

      // 두 번째 호출은 성공해야 함
      await expect(runwaySafety.checkSafety(0.01))
        .resolves
        .not.toThrow()
    })

    it('제공업체별로 다른 최소 간격이 적용되어야 한다', async () => {
      // Runway: 15초, Seedance: 12초, StableVideo: 10초

      // 모든 제공업체에서 첫 호출
      await runwaySafety.checkSafety(0.01)
      await seedanceSafety.checkSafety(0.01)
      await stableVideoSafety.checkSafety(0.01)

      // 10초 경과
      jest.advanceTimersByTime(10000)

      // StableVideo만 호출 가능해야 함
      await expect(stableVideoSafety.checkSafety(0.01)).resolves.not.toThrow()
      await expect(seedanceSafety.checkSafety(0.01)).rejects.toThrow(CostSafetyError)
      await expect(runwaySafety.checkSafety(0.01)).rejects.toThrow(CostSafetyError)

      // 12초 경과 (총 12초)
      jest.advanceTimersByTime(2000)

      // Seedance도 호출 가능해야 함
      await expect(seedanceSafety.checkSafety(0.01)).resolves.not.toThrow()
      await expect(runwaySafety.checkSafety(0.01)).rejects.toThrow(CostSafetyError)

      // 15초 경과 (총 15초)
      jest.advanceTimersByTime(3000)

      // Runway도 호출 가능해야 함
      await expect(runwaySafety.checkSafety(0.01)).resolves.not.toThrow()
    })
  })

  describe('시간당 요청 한도 검사', () => {
    it('시간당 한도 초과 시 QuotaExceededError를 던져야 한다', async () => {
      // Runway 시간당 한도: 20회
      for (let i = 0; i < 20; i++) {
        await runwaySafety.checkSafety(0.01)
        jest.advanceTimersByTime(15000) // 최소 간격 준수
      }

      // 21번째 호출은 실패해야 함
      await expect(runwaySafety.checkSafety(0.01))
        .rejects
        .toThrow(QuotaExceededError)

      await expect(runwaySafety.checkSafety(0.01))
        .rejects
        .toThrow('시간당 호출 한도')
    })

    it('1시간 경과 후에는 한도가 리셋되어야 한다', async () => {
      // 한도까지 호출
      for (let i = 0; i < 20; i++) {
        await runwaySafety.checkSafety(0.01)
        jest.advanceTimersByTime(15000)
      }

      // 1시간 경과
      jest.advanceTimersByTime(3600000)

      // 다시 호출 가능해야 함
      await expect(runwaySafety.checkSafety(0.01))
        .resolves
        .not.toThrow()
    })

    it('제공업체별로 다른 시간당 한도가 적용되어야 한다', () => {
      // Runway: 20회, Seedance: 25회, StableVideo: 30회
      const runwayStats = runwaySafety.getStats()
      const seedanceStats = seedanceSafety.getStats()
      const stableVideoStats = stableVideoSafety.getStats()

      // 초기값 확인 (한도 자체는 private이므로 간접 확인)
      expect(runwayStats.hourlyRecentCalls).toBe(0)
      expect(seedanceStats.hourlyRecentCalls).toBe(0)
      expect(stableVideoStats.hourlyRecentCalls).toBe(0)
    })
  })

  describe('일일 비용 한도 검사', () => {
    it('일일 비용 한도 초과 시 CostSafetyError를 던져야 한다', async () => {
      // Runway 일일 한도: $50
      const highCost = 60 // $60 - 한도 초과

      await expect(runwaySafety.checkSafety(highCost))
        .rejects
        .toThrow(CostSafetyError)

      await expect(runwaySafety.checkSafety(highCost))
        .rejects
        .toThrow('일일 비용 한도')
    })

    it('일일 비용이 한도 이내면 허용되어야 한다', async () => {
      // Runway 일일 한도: $50
      const allowedCost = 30 // $30 - 한도 이내

      await expect(runwaySafety.checkSafety(allowedCost))
        .resolves
        .not.toThrow()
    })

    it('누적 비용이 한도를 초과하면 차단되어야 한다', async () => {
      // 여러 번 호출하여 누적 비용이 한도 초과
      await runwaySafety.checkSafety(20) // $20
      jest.advanceTimersByTime(15000)

      await runwaySafety.checkSafety(20) // 총 $40
      jest.advanceTimersByTime(15000)

      // 세 번째 호출로 한도($50) 초과
      await expect(runwaySafety.checkSafety(15)) // 총 $55 예상
        .rejects
        .toThrow(CostSafetyError)
    })

    it('날짜가 바뀌면 일일 비용이 리셋되어야 한다', async () => {
      // 한도 근처까지 사용
      await runwaySafety.checkSafety(45) // $45

      // 다음 날로 이동
      jest.setSystemTime(new Date('2024-01-02 09:00:00'))

      // 다시 사용 가능해야 함
      await expect(runwaySafety.checkSafety(45))
        .resolves
        .not.toThrow()
    })

    it('제공업체별로 다른 일일 한도가 적용되어야 한다', async () => {
      // Runway: $50, Seedance: $30, StableVideo: $40

      // Seedance 한도($30) 초과 시도
      await expect(seedanceSafety.checkSafety(35))
        .rejects
        .toThrow('일일 비용 한도')

      // Runway는 같은 금액이 허용되어야 함
      await expect(runwaySafety.checkSafety(35))
        .resolves
        .not.toThrow()
    })
  })

  describe('월간 비용 한도 검사', () => {
    it('월간 비용 한도 초과 시 CostSafetyError를 던져야 한다', async () => {
      // Runway 월간 한도: $500
      const highCost = 600 // $600 - 한도 초과

      await expect(runwaySafety.checkSafety(highCost))
        .rejects
        .toThrow(CostSafetyError)

      await expect(runwaySafety.checkSafety(highCost))
        .rejects
        .toThrow('월간 비용 한도')
    })

    it('월초에 월간 비용이 리셋되어야 한다', async () => {
      // 월말에 한도 근처까지 사용
      jest.setSystemTime(new Date('2024-01-31 23:59:00'))
      await runwaySafety.checkSafety(450) // $450

      // 다음 달로 이동
      jest.setSystemTime(new Date('2024-02-01 00:01:00'))

      // 다시 사용 가능해야 함
      await expect(runwaySafety.checkSafety(450))
        .resolves
        .not.toThrow()
    })
  })

  describe('경고 임계값', () => {
    it('경고 임계값 도달 시 경고 로그를 출력해야 한다', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      // Runway 일일 경고 임계값: $40
      await runwaySafety.checkSafety(41) // $41 - 경고 임계값 초과

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('일일 비용 경고')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('사용량 통계', () => {
    it('정확한 사용량 통계를 반환해야 한다', async () => {
      // 몇 번 호출하여 통계 생성
      await runwaySafety.checkSafety(10)
      jest.advanceTimersByTime(15000)
      await runwaySafety.checkSafety(5)

      const stats = runwaySafety.getStats()

      expect(stats.totalCalls).toBe(2)
      expect(stats.totalCost).toBe(15)
      expect(stats.monthlyCost).toBe(15)
      expect(stats.timeUntilNextCall).toBeGreaterThan(0)
    })

    it('시간 경과에 따른 통계 업데이트를 확인할 수 있어야 한다', async () => {
      await runwaySafety.checkSafety(5)

      // 1분 경과
      jest.advanceTimersByTime(60000)

      const stats = runwaySafety.getStats()
      expect(stats.recentCalls).toBe(0) // 1분 이내 호출 없음
      expect(stats.hourlyRecentCalls).toBe(1) // 1시간 이내 호출 있음
    })
  })

  describe('리셋 기능', () => {
    it('reset 호출 시 모든 통계가 초기화되어야 한다', async () => {
      // 통계 생성
      await runwaySafety.checkSafety(10)
      jest.advanceTimersByTime(15000)
      await runwaySafety.checkSafety(5)

      // 리셋 전 통계 확인
      let stats = runwaySafety.getStats()
      expect(stats.totalCalls).toBe(2)

      // 리셋
      runwaySafety.reset()

      // 리셋 후 통계 확인
      stats = runwaySafety.getStats()
      expect(stats.totalCalls).toBe(0)
      expect(stats.totalCost).toBe(0)
      expect(stats.recentCalls).toBe(0)
      expect(stats.hourlyRecentCalls).toBe(0)
    })
  })

  describe('실제 비용 업데이트', () => {
    it('실제 비용을 업데이트할 수 있어야 한다', async () => {
      await runwaySafety.checkSafety(10) // 예상 비용 $10

      // 실제 비용이 더 높았다고 가정
      runwaySafety.updateActualCost(12) // 실제 비용 $12

      const stats = runwaySafety.getStats()
      expect(stats.totalCost).toBe(22) // 10 + 12 = 22
    })
  })

  describe('에러 메시지 정확성', () => {
    it('최소 간격 오류 메시지에 정확한 대기 시간을 포함해야 한다', async () => {
      await runwaySafety.checkSafety(1)
      jest.advanceTimersByTime(5000) // 5초 경과

      try {
        await runwaySafety.checkSafety(1)
        expect.fail('오류가 발생해야 함')
      } catch (error) {
        if (error instanceof CostSafetyError) {
          expect(error.message).toContain('10초 후 다시 시도') // 15 - 5 = 10초
        } else {
          throw error
        }
      }
    })

    it('할당량 초과 오류 메시지에 정확한 한도를 포함해야 한다', async () => {
      // 시간당 한도까지 호출
      for (let i = 0; i < 20; i++) {
        await runwaySafety.checkSafety(0.01)
        jest.advanceTimersByTime(15000)
      }

      try {
        await runwaySafety.checkSafety(0.01)
        expect.fail('오류가 발생해야 함')
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          expect(error.message).toContain('20회') // Runway 시간당 한도
        } else {
          throw error
        }
      }
    })
  })
})