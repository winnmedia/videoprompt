/**
 * Video Generation Utils Tests
 *
 * 영상 생성 유틸리티 함수들의 단위 테스트
 * CLAUDE.md 준수: TDD 원칙, 예측 가능성, 타입 안전성
 */

import {
  getRecommendedProvider,
  estimateGenerationCost,
  isProviderCompatible,
  getOptimalProviderMix,
  checkCostSafetyStatus,
  type VideoGenerationRequest
} from '../../shared/lib/video-generation'

describe('Video Generation Utils', () => {
  const baseRequest: VideoGenerationRequest = {
    prompt: '테스트 프롬프트',
    duration: 5,
    quality: 'medium',
    style: 'realistic',
    aspectRatio: '16:9',
    fps: 24,
    motionLevel: 0.5
  }

  describe('getRecommendedProvider', () => {
    it('이미지가 없는 경우 textToVideo를 지원하는 제공업체를 추천해야 한다', () => {
      const request: VideoGenerationRequest = {
        ...baseRequest,
        imageUrl: undefined
      }

      const provider = getRecommendedProvider(request)
      expect(provider).toBe('runway') // Runway만 textToVideo 지원
    })

    it('긴 영상이 필요한 경우 긴 길이를 지원하는 제공업체를 추천해야 한다', () => {
      const request: VideoGenerationRequest = {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        duration: 25 // 25초
      }

      const provider = getRecommendedProvider(request)
      expect(provider).toBe('seedance') // Seedance가 최대 30초까지 지원
    })

    it('고품질이 필요한 경우 품질이 가장 좋은 제공업체를 추천해야 한다', () => {
      const request: VideoGenerationRequest = {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        quality: 'ultra'
      }

      const provider = getRecommendedProvider(request)
      expect(provider).toBe('runway') // Runway가 품질이 가장 좋음
    })

    it('일반적인 경우 비용 효율적인 제공업체를 추천해야 한다', () => {
      const request: VideoGenerationRequest = {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        duration: 5,
        quality: 'medium'
      }

      const provider = getRecommendedProvider(request)
      expect(provider).toBe('seedance') // 기본값으로 비용 효율적인 Seedance
    })

    it('짧은 고품질 영상의 경우 적절한 제공업체를 추천해야 한다', () => {
      const request: VideoGenerationRequest = {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        duration: 3,
        quality: 'high'
      }

      const provider = getRecommendedProvider(request)
      expect(provider).toBe('runway') // 고품질 요구사항으로 인해 Runway
    })
  })

  describe('estimateGenerationCost', () => {
    it('Runway의 비용을 정확히 계산해야 한다', () => {
      const cost = estimateGenerationCost('runway', baseRequest)

      // Runway 기본 비용: $0.05, 5초 기준, medium 품질(1.0배)
      expect(cost).toBe(0.05) // 0.05 * 1 * 1.0
    })

    it('Seedance의 비용을 정확히 계산해야 한다', () => {
      const cost = estimateGenerationCost('seedance', baseRequest)

      // Seedance 기본 비용: $0.03, 5초 기준, medium 품질(1.0배)
      expect(cost).toBe(0.03) // 0.03 * 1 * 1.0
    })

    it('StableVideo의 비용을 정확히 계산해야 한다', () => {
      const cost = estimateGenerationCost('stable-video', baseRequest)

      // StableVideo 기본 비용: $0.04, 5초 기준, medium 품질(1.0배)
      expect(cost).toBe(0.04) // 0.04 * 1 * 1.0
    })

    it('영상 길이에 따른 비용 변화를 반영해야 한다', () => {
      const shortRequest: VideoGenerationRequest = { ...baseRequest, duration: 2.5 } // 2.5초
      const longRequest: VideoGenerationRequest = { ...baseRequest, duration: 10 } // 10초

      const shortCost = estimateGenerationCost('runway', shortRequest)
      const baseCost = estimateGenerationCost('runway', baseRequest)
      const longCost = estimateGenerationCost('runway', longRequest)

      expect(shortCost).toBe(0.025) // 0.05 * 0.5 * 1.0
      expect(baseCost).toBe(0.05)   // 0.05 * 1.0 * 1.0
      expect(longCost).toBe(0.10)   // 0.05 * 2.0 * 1.0
    })

    it('품질에 따른 비용 변화를 반영해야 한다', () => {
      const lowQuality: VideoGenerationRequest = { ...baseRequest, quality: 'low' }
      const mediumQuality: VideoGenerationRequest = { ...baseRequest, quality: 'medium' }
      const highQuality: VideoGenerationRequest = { ...baseRequest, quality: 'high' }
      const ultraQuality: VideoGenerationRequest = { ...baseRequest, quality: 'ultra' }

      const lowCost = estimateGenerationCost('runway', lowQuality)
      const mediumCost = estimateGenerationCost('runway', mediumQuality)
      const highCost = estimateGenerationCost('runway', highQuality)
      const ultraCost = estimateGenerationCost('runway', ultraQuality)

      expect(lowCost).toBe(0.04)    // 0.05 * 1 * 0.8
      expect(mediumCost).toBe(0.05) // 0.05 * 1 * 1.0
      expect(highCost).toBe(0.065)  // 0.05 * 1 * 1.3
      expect(ultraCost).toBe(0.08)  // 0.05 * 1 * 1.6
    })
  })

  describe('isProviderCompatible', () => {
    it('Runway의 호환성을 정확히 판단해야 한다', () => {
      // 이미지 있음 - 호환
      expect(isProviderCompatible('runway', {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg'
      })).toBe(true)

      // 이미지 없음 - 호환 (textToVideo 지원)
      expect(isProviderCompatible('runway', {
        ...baseRequest,
        imageUrl: undefined
      })).toBe(true)

      // 너무 긴 영상 - 비호환
      expect(isProviderCompatible('runway', {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        duration: 15 // Runway 최대 10초
      })).toBe(false)

      // 지원하지 않는 품질 - 비호환
      expect(isProviderCompatible('runway', {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        quality: 'low' // Runway는 medium, high만 지원
      })).toBe(false)
    })

    it('Seedance의 호환성을 정확히 판단해야 한다', () => {
      // 이미지 있음 - 호환
      expect(isProviderCompatible('seedance', {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg'
      })).toBe(true)

      // 이미지 없음 - 비호환 (textToVideo 미지원)
      expect(isProviderCompatible('seedance', {
        ...baseRequest,
        imageUrl: undefined
      })).toBe(false)

      // 긴 영상 - 호환
      expect(isProviderCompatible('seedance', {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        duration: 25 // Seedance 최대 30초
      })).toBe(true)

      // 너무 긴 영상 - 비호환
      expect(isProviderCompatible('seedance', {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        duration: 35 // Seedance 최대 30초 초과
      })).toBe(false)
    })

    it('StableVideo의 호환성을 정확히 판단해야 한다', () => {
      // 이미지 있음 - 호환
      expect(isProviderCompatible('stable-video', {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        duration: 3 // StableVideo 최대 4초
      })).toBe(true)

      // 이미지 없음 - 비호환 (textToVideo 미지원)
      expect(isProviderCompatible('stable-video', {
        ...baseRequest,
        imageUrl: undefined
      })).toBe(false)

      // 너무 긴 영상 - 비호환
      expect(isProviderCompatible('stable-video', {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        duration: 10 // StableVideo 최대 4초 초과
      })).toBe(false)
    })

    it('지원하지 않는 화면 비율에 대해 비호환을 반환해야 한다', () => {
      const unsupportedAspectRatio: VideoGenerationRequest = {
        ...baseRequest,
        imageUrl: 'https://example.com/image.jpg',
        aspectRatio: '21:9' as any // 지원하지 않는 비율
      }

      expect(isProviderCompatible('runway', unsupportedAspectRatio)).toBe(false)
      expect(isProviderCompatible('seedance', unsupportedAspectRatio)).toBe(false)
      expect(isProviderCompatible('stable-video', unsupportedAspectRatio)).toBe(false)
    })
  })

  describe('getOptimalProviderMix', () => {
    it('여러 요청에 대해 최적의 제공업체 조합을 반환해야 한다', () => {
      const requests: VideoGenerationRequest[] = [
        // 텍스트-투-비디오 요청
        {
          ...baseRequest,
          imageUrl: undefined,
          duration: 5
        },
        // 이미지-투-비디오 요청 (짧음)
        {
          ...baseRequest,
          imageUrl: 'https://example.com/image1.jpg',
          duration: 3
        },
        // 긴 영상 요청
        {
          ...baseRequest,
          imageUrl: 'https://example.com/image2.jpg',
          duration: 20
        },
        // 고품질 요청
        {
          ...baseRequest,
          imageUrl: 'https://example.com/image3.jpg',
          quality: 'ultra'
        }
      ]

      const mix = getOptimalProviderMix(requests)

      expect(mix).toHaveLength(4)

      // 첫 번째: 텍스트-투-비디오는 Runway만 가능
      expect(mix[0].provider).toBe('runway')

      // 두 번째: 짧은 영상은 비용 효율적인 제공업체
      expect(['seedance', 'stable-video']).toContain(mix[1].provider)

      // 세 번째: 긴 영상은 Seedance만 가능
      expect(mix[2].provider).toBe('seedance')

      // 네 번째: 고품질은 Runway 선호
      expect(mix[3].provider).toBe('runway')

      // 모든 항목에 예상 비용이 포함되어야 함
      mix.forEach(item => {
        expect(item.estimatedCost).toBeGreaterThan(0)
        expect(typeof item.estimatedCost).toBe('number')
      })
    })

    it('빈 배열에 대해 빈 결과를 반환해야 한다', () => {
      const mix = getOptimalProviderMix([])
      expect(mix).toHaveLength(0)
    })

    it('호환되지 않는 요청에 대해 기본 제공업체를 할당해야 한다', () => {
      const impossibleRequest: VideoGenerationRequest = {
        ...baseRequest,
        duration: 100, // 모든 제공업체 한계 초과
        quality: 'invalid' as any
      }

      const mix = getOptimalProviderMix([impossibleRequest])

      expect(mix).toHaveLength(1)
      expect(mix[0].provider).toBe('seedance') // 기본값
    })
  })

  describe('checkCostSafetyStatus', () => {
    it('모든 제공업체의 비용 안전 상태를 반환해야 한다', async () => {
      const status = await checkCostSafetyStatus()

      expect(status).toHaveProperty('runway')
      expect(status).toHaveProperty('seedance')
      expect(status).toHaveProperty('stableVideo')

      // 각 제공업체 상태는 safe와 stats를 가져야 함
      expect(status.runway).toHaveProperty('safe')
      expect(status.runway).toHaveProperty('stats')
      expect(status.seedance).toHaveProperty('safe')
      expect(status.seedance).toHaveProperty('stats')
      expect(status.stableVideo).toHaveProperty('safe')
      expect(status.stableVideo).toHaveProperty('stats')

      // safe는 boolean이어야 함
      expect(typeof status.runway.safe).toBe('boolean')
      expect(typeof status.seedance.safe).toBe('boolean')
      expect(typeof status.stableVideo.safe).toBe('boolean')

      // stats는 올바른 구조를 가져야 함
      const requiredStatsFields = [
        'totalCalls',
        'lastCallTime',
        'recentCalls',
        'hourlyRecentCalls',
        'nextAvailableTime',
        'timeUntilNextCall',
        'totalCost',
        'monthlyCost'
      ]

      requiredStatsFields.forEach(field => {
        expect(status.runway.stats).toHaveProperty(field)
        expect(status.seedance.stats).toHaveProperty(field)
        expect(status.stableVideo.stats).toHaveProperty(field)
      })
    })
  })

  describe('에지 케이스 및 경계값', () => {
    it('duration이 0인 경우를 적절히 처리해야 한다', () => {
      const zeroRequest: VideoGenerationRequest = {
        ...baseRequest,
        duration: 0
      }

      // 비용 계산에서 0 duration 처리
      const cost = estimateGenerationCost('runway', zeroRequest)
      expect(cost).toBe(0) // 0초면 비용도 0
    })

    it('매우 높은 품질 설정을 처리해야 한다', () => {
      const ultraRequest: VideoGenerationRequest = {
        ...baseRequest,
        quality: 'ultra'
      }

      const cost = estimateGenerationCost('runway', ultraRequest)
      expect(cost).toBeGreaterThan(estimateGenerationCost('runway', baseRequest))
    })

    it('motionLevel 경계값을 처리해야 한다', () => {
      const noMotion: VideoGenerationRequest = { ...baseRequest, motionLevel: 0 }
      const maxMotion: VideoGenerationRequest = { ...baseRequest, motionLevel: 1 }

      // 호환성 검사가 motion level에 영향받지 않아야 함
      expect(isProviderCompatible('runway', noMotion)).toBe(
        isProviderCompatible('runway', maxMotion)
      )
    })

    it('모든 제공업체가 비호환인 요청을 처리해야 한다', () => {
      const incompatibleRequest: VideoGenerationRequest = {
        ...baseRequest,
        imageUrl: undefined, // textToVideo 필요
        duration: 50, // 모든 제공업체 한계 초과
        quality: 'low' // 일부 제공업체 미지원
      }

      expect(isProviderCompatible('runway', incompatibleRequest)).toBe(false)
      expect(isProviderCompatible('seedance', incompatibleRequest)).toBe(false)
      expect(isProviderCompatible('stable-video', incompatibleRequest)).toBe(false)

      // getOptimalProviderMix는 여전히 기본값을 반환해야 함
      const mix = getOptimalProviderMix([incompatibleRequest])
      expect(mix).toHaveLength(1)
      expect(mix[0].provider).toBe('seedance')
    })
  })
})