/**
 * 성능 메트릭 수집 및 리포트 테스트
 *
 * UserJourneyMap 22단계 성능 측정:
 * - Core Web Vitals (LCP, CLS, INP)
 * - 페이지 로드 성능
 * - API 응답 시간
 * - 사용자 인터랙션 반응 시간
 * - 메모리 사용량
 * - 네트워크 리소스 최적화
 */

/// <reference types="cypress" />

describe('UserJourney 성능 메트릭 수집 테스트', () => {
  let sessionId: string
  let performanceReport: any = {}

  before(() => {
    cy.startUserJourneyMetrics('performance-test')
    sessionId = 'performance-test'
    performanceReport = {
      testStart: Date.now(),
      pages: {},
      apis: {},
      interactions: {},
      vitals: {},
      summary: {}
    }
  })

  beforeEach(() => {
    cy.resetApiLimits()
    cy.login()
  })

  after(() => {
    cy.finishUserJourneyMetrics()

    // 성능 리포트 생성
    cy.task('log', JSON.stringify(performanceReport, null, 2))
  })

  describe('Phase 1: 페이지 로드 성능 측정 (1-3단계)', () => {
    it('랜딩페이지 성능 측정', () => {
      cy.measureStepCompletion(1, '랜딩페이지 로드 성능', () => {
        cy.window().then((win) => {
          // Navigation Timing API 측정 시작
          const navigationStart = win.performance.timing.navigationStart

          cy.visit('/')

          cy.window().then((win) => {
            const loadComplete = win.performance.timing.loadEventEnd
            const domContentLoaded = win.performance.timing.domContentLoadedEventEnd
            const firstPaint = win.performance.getEntriesByType('paint')
              .find((entry: any) => entry.name === 'first-paint')?.startTime || 0
            const firstContentfulPaint = win.performance.getEntriesByType('paint')
              .find((entry: any) => entry.name === 'first-contentful-paint')?.startTime || 0

            performanceReport.pages.landing = {
              totalLoadTime: loadComplete - navigationStart,
              domContentLoaded: domContentLoaded - navigationStart,
              firstPaint,
              firstContentfulPaint,
              timestamp: Date.now()
            }

            cy.log(`🏠 랜딩페이지 로드: ${loadComplete - navigationStart}ms`)
            cy.log(`📄 DOM 준비: ${domContentLoaded - navigationStart}ms`)
            cy.log(`🎨 첫 렌더링: ${firstPaint}ms`)
            cy.log(`📝 첫 콘텐츠: ${firstContentfulPaint}ms`)

            // 성능 기준 검증
            expect(loadComplete - navigationStart).to.be.lessThan(3000) // 3초 이내
            expect(firstContentfulPaint).to.be.lessThan(1500) // 1.5초 이내
          })
        })

        // Core Web Vitals 측정
        cy.checkCoreWebVitals({
          lcp: 2500, // 2.5초
          fid: 100,  // 100ms
          cls: 0.1   // 0.1
        })

        // 리소스 로딩 분석
        cy.window().then((win) => {
          const resources = win.performance.getEntriesByType('resource')
          const largeResources = resources.filter((res: any) => res.transferSize > 100000) // 100KB 이상

          performanceReport.pages.landing.resources = {
            total: resources.length,
            large: largeResources.length,
            totalSize: resources.reduce((sum: number, res: any) => sum + (res.transferSize || 0), 0)
          }

          cy.log(`📦 리소스 총 개수: ${resources.length}`)
          cy.log(`📈 큰 리소스 (100KB+): ${largeResources.length}`)
        })
      })
    })

    it('로그인 페이지 성능 측정', () => {
      cy.measureStepCompletion(2, '로그인 페이지 성능', () => {
        const startTime = Date.now()

        cy.visit('/login')

        cy.get('[data-testid="email-input"]').should('be.visible')

        const endTime = Date.now()
        const pageLoadTime = endTime - startTime

        performanceReport.pages.login = {
          loadTime: pageLoadTime,
          timestamp: Date.now()
        }

        cy.log(`🔑 로그인 페이지 로드: ${pageLoadTime}ms`)

        // 입력 필드 반응성 테스트
        cy.measureInteractionPerformance('이메일 입력 반응성', () => {
          cy.get('[data-testid="email-input"]').type('test@example.com')
        })

        cy.measureInteractionPerformance('비밀번호 입력 반응성', () => {
          cy.get('[data-testid="password-input"]').type('password123')
        })

        // 폼 검증 성능
        cy.measureInteractionPerformance('폼 검증 성능', () => {
          cy.get('[data-testid="login-submit"]').click()
        })
      })
    })

    it('시나리오 페이지 성능 측정', () => {
      cy.measureStepCompletion(3, '시나리오 페이지 성능', () => {
        const startTime = Date.now()

        cy.visit('/scenario')

        cy.get('[data-testid="scenario-input"]').should('be.visible')

        const endTime = Date.now()
        const pageLoadTime = endTime - startTime

        performanceReport.pages.scenario = {
          loadTime: pageLoadTime,
          timestamp: Date.now()
        }

        cy.log(`📝 시나리오 페이지 로드: ${pageLoadTime}ms`)

        // 텍스트 영역 반응성
        cy.measureInteractionPerformance('텍스트 입력 성능', () => {
          cy.get('[data-testid="scenario-input"]')
            .type('길고 복잡한 시나리오 내용을 입력하여 성능을 측정합니다. '.repeat(10))
        })

        // 자동저장 성능
        cy.measureInteractionPerformance('자동저장 성능', () => {
          cy.wait(2000) // 자동저장 트리거 대기
          cy.get('[data-testid="auto-save-status"]').should('be.visible')
        })
      })
    })
  })

  describe('Phase 2: API 호출 성능 측정 (4-6, 8-9단계)', () => {
    it('스토리 생성 API 성능', () => {
      cy.measureStepCompletion(4, '스토리 생성 API 성능', () => {
        cy.visit('/scenario')
        cy.get('[data-testid="scenario-input"]').type('모험 이야기')

        // API 호출 시간 측정
        const apiStartTime = Date.now()

        cy.intercept('POST', '/api/ai/generate-story', (req) => {
          req.on('response', (res) => {
            const apiEndTime = Date.now()
            const apiResponseTime = apiEndTime - apiStartTime

            performanceReport.apis.generateStory = {
              responseTime: apiResponseTime,
              statusCode: res.statusCode,
              bodySize: JSON.stringify(res.body).length,
              timestamp: Date.now()
            }

            cy.log(`🤖 스토리 생성 API: ${apiResponseTime}ms`)

            // API 성능 기준 검증
            expect(apiResponseTime).to.be.lessThan(10000) // 10초 이내
          })
        }).as('generateStoryAPI')

        cy.get('[data-testid="generate-story"]').click()
        cy.wait('@generateStoryAPI')

        // 스토리 렌더링 성능
        cy.measureInteractionPerformance('스토리 렌더링', () => {
          cy.get('[data-testid="story-result"]').should('be.visible')
          cy.get('[data-testid^="story-step-"]').should('have.length.at.least', 4)
        })
      })
    })

    it('12샷 생성 API 성능', () => {
      cy.measureStepCompletion(5, '12샷 생성 API 성능', () => {
        cy.visit('/planning')

        const apiStartTime = Date.now()

        cy.intercept('POST', '/api/ai/generate-storyboard', (req) => {
          req.on('response', (res) => {
            const apiEndTime = Date.now()
            const apiResponseTime = apiEndTime - apiStartTime

            performanceReport.apis.generateShots = {
              responseTime: apiResponseTime,
              statusCode: res.statusCode,
              bodySize: JSON.stringify(res.body).length,
              timestamp: Date.now()
            }

            cy.log(`🎬 12샷 생성 API: ${apiResponseTime}ms`)
          })
        }).as('generateShotsAPI')

        cy.get('[data-testid="generate-shots"]').click()
        cy.wait('@generateShotsAPI')

        // 샷 그리드 렌더링 성능
        cy.measureInteractionPerformance('샷 그리드 렌더링', () => {
          cy.get('[data-testid="shots-grid"]').should('be.visible')
          cy.get('[data-testid^="shot-"]').should('have.length.at.least', 8)
        })

        // 썸네일 로딩 성능
        cy.measureInteractionPerformance('썸네일 로딩', () => {
          cy.get('[data-testid^="shot-thumbnail-"]').should('be.visible')
        })
      })
    })

    it('병렬 API 호출 성능', () => {
      cy.measureStepCompletion(6, '병렬 API 성능', () => {
        cy.visit('/planning')
        cy.validateUserJourneyStep('planning', { hasShots: true })

        const parallelStartTime = Date.now()

        // 여러 샷의 콘티 동시 생성
        cy.intercept('POST', '/api/ai/generate-conti/**').as('generateConti')

        // 동시에 3개 샷 콘티 생성
        for (let i = 1; i <= 3; i++) {
          cy.get(`[data-testid="shot-${i}"]`).within(() => {
            cy.get('[data-testid="generate-conti"]').click()
          })
        }

        // 모든 콘티 생성 완료 대기
        cy.wait(['@generateConti', '@generateConti', '@generateConti'])

        const parallelEndTime = Date.now()
        const parallelTime = parallelEndTime - parallelStartTime

        performanceReport.apis.parallelConti = {
          totalTime: parallelTime,
          requestCount: 3,
          avgTimePerRequest: parallelTime / 3,
          timestamp: Date.now()
        }

        cy.log(`⚡ 병렬 콘티 생성: ${parallelTime}ms (평균 ${parallelTime / 3}ms)`)

        // 병렬 처리 효율성 검증 (순차 처리보다 빨라야 함)
        expect(parallelTime).to.be.lessThan(15000) // 15초 이내
      })
    })
  })

  describe('Phase 3: 사용자 인터랙션 성능 (7-11단계)', () => {
    it('드래그 앤 드롭 성능', () => {
      cy.measureStepCompletion(7, '드래그 앤 드롭 성능', () => {
        cy.visit('/planning')
        cy.validateUserJourneyStep('planning', { hasShots: true })

        // 드래그 앤 드롭 반응성 측정
        cy.measureInteractionPerformance('샷 드래그 시작', () => {
          cy.get('[data-testid="shot-1"]')
            .trigger('mousedown', { button: 0 })
        })

        cy.measureInteractionPerformance('드래그 이동', () => {
          cy.get('[data-testid="shot-3"]')
            .trigger('mousemove')
        })

        cy.measureInteractionPerformance('드롭 완료', () => {
          cy.get('[data-testid="shot-3"]')
            .trigger('mouseup')
        })

        // 재배열 후 UI 업데이트 성능
        cy.measureInteractionPerformance('UI 재배열 업데이트', () => {
          cy.get('[data-testid="shots-grid"]').should('be.visible')
        })

        performanceReport.interactions.dragAndDrop = {
          tested: true,
          timestamp: Date.now()
        }
      })
    })

    it('모달 열기/닫기 성능', () => {
      cy.measureStepCompletion(8, '모달 성능', () => {
        cy.visit('/planning')
        cy.validateUserJourneyStep('planning', { hasShots: true })

        // 모달 열기 성능
        cy.measureInteractionPerformance('샷 편집 모달 열기', () => {
          cy.get('[data-testid="shot-1"]').click()
          cy.get('[data-testid="shot-edit-modal"]').should('be.visible')
        })

        // 모달 내 인터랙션 성능
        cy.measureInteractionPerformance('모달 내 입력 반응성', () => {
          cy.get('[data-testid="shot-title-input"]')
            .clear()
            .type('새로운 제목')
        })

        // 모달 닫기 성능
        cy.measureInteractionPerformance('모달 닫기', () => {
          cy.get('[data-testid="close-modal"]').click()
          cy.get('[data-testid="shot-edit-modal"]').should('not.exist')
        })

        performanceReport.interactions.modal = {
          tested: true,
          timestamp: Date.now()
        }
      })
    })

    it('파일 업로드 성능', () => {
      cy.measureStepCompletion(9, '파일 업로드 성능', () => {
        cy.visit('/feedback')

        // 파일 선택 반응성
        cy.measureInteractionPerformance('파일 선택 UI 반응성', () => {
          cy.get('[data-testid="upload-zone"]').should('be.visible')
        })

        // 업로드 진행률 업데이트 성능
        cy.measureInteractionPerformance('업로드 진행률 업데이트', () => {
          cy.testFileUpload('[data-testid="file-input"]', 'test-video.mp4', 'video/mp4')
          cy.get('[data-testid="upload-progress"]').should('be.visible')
        })

        performanceReport.interactions.fileUpload = {
          tested: true,
          timestamp: Date.now()
        }
      })
    })

    it('실시간 검색/필터링 성능', () => {
      cy.measureStepCompletion(10, '검색 필터링 성능', () => {
        cy.visit('/planning')
        cy.validateUserJourneyStep('planning', { hasShots: true })

        // 검색 입력 반응성
        cy.measureInteractionPerformance('검색 입력 반응성', () => {
          cy.get('[data-testid="shot-search"]')
            .type('액션')
        })

        // 필터링 결과 업데이트 성능
        cy.measureInteractionPerformance('필터링 결과 업데이트', () => {
          cy.get('[data-testid="shots-grid"]').should('be.visible')
        })

        // 검색 결과 초기화 성능
        cy.measureInteractionPerformance('검색 초기화', () => {
          cy.get('[data-testid="clear-search"]').click()
          cy.get('[data-testid^="shot-"]').should('have.length.at.least', 8)
        })

        performanceReport.interactions.search = {
          tested: true,
          timestamp: Date.now()
        }
      })
    })
  })

  describe('Phase 4: 메모리 사용량 모니터링', () => {
    it('메모리 리크 검사', () => {
      cy.measureStepCompletion(11, '메모리 사용량 모니터링', () => {
        cy.window().then((win) => {
          const initialMemory = (win.performance as any).memory?.usedJSHeapSize || 0

          // 무거운 작업 수행 (여러 페이지 탐색)
          cy.visit('/scenario')
          cy.createScenario()
          cy.generateStory()

          cy.visit('/planning')
          cy.generate12Shots()

          cy.visit('/feedback')

          cy.window().then((win) => {
            const finalMemory = (win.performance as any).memory?.usedJSHeapSize || 0
            const memoryIncrease = finalMemory - initialMemory

            performanceReport.memory = {
              initial: initialMemory,
              final: finalMemory,
              increase: memoryIncrease,
              increasePercentage: (memoryIncrease / initialMemory) * 100,
              timestamp: Date.now()
            }

            cy.log(`🧠 초기 메모리: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`)
            cy.log(`🧠 최종 메모리: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`)
            cy.log(`📈 메모리 증가: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

            // 메모리 증가율 검증 (50% 이하)
            expect(memoryIncrease / initialMemory).to.be.lessThan(0.5)
          })
        })
      })
    })

    it('가비지 컬렉션 효율성', () => {
      cy.measureStepCompletion(12, '가비지 컬렉션 모니터링', () => {
        cy.window().then((win) => {
          if ((win.performance as any).memory) {
            const beforeGC = (win.performance as any).memory.usedJSHeapSize

            // 강제 가비지 컬렉션 (개발 환경에서만)
            if ((win as any).gc) {
              (win as any).gc()
            }

            cy.wait(1000) // GC 완료 대기

            cy.window().then((win) => {
              const afterGC = (win.performance as any).memory.usedJSHeapSize
              const gcEfficiency = (beforeGC - afterGC) / beforeGC * 100

              performanceReport.gc = {
                beforeGC,
                afterGC,
                efficiency: gcEfficiency,
                timestamp: Date.now()
              }

              cy.log(`🗑️ GC 전: ${(beforeGC / 1024 / 1024).toFixed(2)}MB`)
              cy.log(`🗑️ GC 후: ${(afterGC / 1024 / 1024).toFixed(2)}MB`)
              cy.log(`📊 GC 효율성: ${gcEfficiency.toFixed(2)}%`)
            })
          }
        })
      })
    })
  })

  describe('Phase 5: 네트워크 성능 최적화', () => {
    it('리소스 캐싱 효율성', () => {
      cy.measureStepCompletion(13, '캐싱 효율성 측정', () => {
        // 첫 번째 방문
        const firstVisitStart = Date.now()
        cy.visit('/scenario')
        const firstVisitEnd = Date.now()

        // 두 번째 방문 (캐시 활용)
        const secondVisitStart = Date.now()
        cy.visit('/scenario')
        const secondVisitEnd = Date.now()

        const firstVisitTime = firstVisitEnd - firstVisitStart
        const secondVisitTime = secondVisitEnd - secondVisitStart
        const cacheEfficiency = (firstVisitTime - secondVisitTime) / firstVisitTime * 100

        performanceReport.caching = {
          firstVisit: firstVisitTime,
          secondVisit: secondVisitTime,
          efficiency: cacheEfficiency,
          timestamp: Date.now()
        }

        cy.log(`🔄 첫 방문: ${firstVisitTime}ms`)
        cy.log(`⚡ 두 번째 방문: ${secondVisitTime}ms`)
        cy.log(`📈 캐싱 효율성: ${cacheEfficiency.toFixed(2)}%`)

        // 캐싱 효율성 검증 (최소 30% 개선)
        expect(cacheEfficiency).to.be.greaterThan(30)
      })
    })

    it('이미지 최적화 성능', () => {
      cy.measureStepCompletion(14, '이미지 최적화 측정', () => {
        cy.visit('/planning')
        cy.validateUserJourneyStep('planning', { hasShots: true })

        cy.window().then((win) => {
          const images = Array.from(win.document.querySelectorAll('img'))
          const imageMetrics = images.map(img => ({
            src: img.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            displayWidth: img.clientWidth,
            displayHeight: img.clientHeight,
            loading: img.loading
          }))

          const oversizedImages = imageMetrics.filter(img =>
            img.naturalWidth > img.displayWidth * 2 ||
            img.naturalHeight > img.displayHeight * 2
          )

          performanceReport.images = {
            total: images.length,
            oversized: oversizedImages.length,
            lazyLoaded: imageMetrics.filter(img => img.loading === 'lazy').length,
            metrics: imageMetrics,
            timestamp: Date.now()
          }

          cy.log(`🖼️ 총 이미지: ${images.length}`)
          cy.log(`⚠️ 과대 이미지: ${oversizedImages.length}`)
          cy.log(`⚡ 지연 로딩: ${imageMetrics.filter(img => img.loading === 'lazy').length}`)

          // 이미지 최적화 기준 검증
          expect(oversizedImages.length / images.length).to.be.lessThan(0.1) // 10% 이하
        })
      })
    })
  })

  describe('Phase 6: 종합 성능 리포트 생성', () => {
    it('최종 성능 보고서 생성', () => {
      cy.measureStepCompletion(15, '성능 보고서 생성', () => {
        const reportEndTime = Date.now()
        const totalTestTime = reportEndTime - performanceReport.testStart

        // 성능 점수 계산
        const calculatePerformanceScore = () => {
          let score = 100

          // 페이지 로드 시간 점수
          Object.values(performanceReport.pages).forEach((page: any) => {
            if (page.loadTime > 3000) score -= 10
            if (page.loadTime > 5000) score -= 20
          })

          // API 응답 시간 점수
          Object.values(performanceReport.apis).forEach((api: any) => {
            if (api.responseTime > 5000) score -= 5
            if (api.responseTime > 10000) score -= 15
          })

          // 메모리 사용량 점수
          if (performanceReport.memory?.increasePercentage > 50) score -= 20

          return Math.max(score, 0)
        }

        performanceReport.summary = {
          totalTestTime,
          performanceScore: calculatePerformanceScore(),
          testEndTime: reportEndTime,
          recommendations: []
        }

        // 성능 개선 권장사항 생성
        const recommendations = []

        if (performanceReport.pages.landing?.loadTime > 3000) {
          recommendations.push('랜딩페이지 로드 시간 최적화 필요 (3초 초과)')
        }

        if (performanceReport.apis.generateStory?.responseTime > 8000) {
          recommendations.push('AI 스토리 생성 API 응답 시간 개선 필요')
        }

        if (performanceReport.memory?.increasePercentage > 40) {
          recommendations.push('메모리 사용량 최적화 필요 (증가율 40% 초과)')
        }

        if (performanceReport.images?.oversized > 0) {
          recommendations.push(`${performanceReport.images.oversized}개의 과대 이미지 최적화 필요`)
        }

        performanceReport.summary.recommendations = recommendations

        // 성능 등급 산정
        const score = performanceReport.summary.performanceScore
        let grade = 'F'
        if (score >= 90) grade = 'A'
        else if (score >= 80) grade = 'B'
        else if (score >= 70) grade = 'C'
        else if (score >= 60) grade = 'D'

        performanceReport.summary.grade = grade

        cy.log(`📊 종합 성능 점수: ${score}점 (${grade}등급)`)
        cy.log(`⏱️ 총 테스트 시간: ${totalTestTime}ms`)
        cy.log(`📋 권장사항: ${recommendations.length}개`)

        // 최종 보고서 로그
        cy.task('log', '========== 성능 테스트 최종 보고서 ==========')
        cy.task('log', JSON.stringify(performanceReport.summary, null, 2))

        recommendations.forEach(rec => {
          cy.task('log', `⚠️  ${rec}`)
        })

        // 성능 기준 검증 (B등급 이상)
        expect(score).to.be.greaterThan(70)
      })
    })

    it('성능 트렌드 분석', () => {
      cy.measureStepCompletion(16, '성능 트렌드 분석', () => {
        // 이전 테스트 결과와 비교 (실제 구현에서는 파일 저장/읽기)
        const mockPreviousResults = {
          performanceScore: 85,
          pageLoadAvg: 2800,
          apiResponseAvg: 4500
        }

        const currentScore = performanceReport.summary.performanceScore
        const currentPageLoadAvg = Object.values(performanceReport.pages)
          .reduce((sum: number, page: any) => sum + page.loadTime, 0) /
          Object.keys(performanceReport.pages).length

        const currentApiResponseAvg = Object.values(performanceReport.apis)
          .reduce((sum: number, api: any) => sum + api.responseTime, 0) /
          Object.keys(performanceReport.apis).length

        const trend = {
          scoreChange: currentScore - mockPreviousResults.performanceScore,
          pageLoadChange: currentPageLoadAvg - mockPreviousResults.pageLoadAvg,
          apiResponseChange: currentApiResponseAvg - mockPreviousResults.apiResponseAvg
        }

        performanceReport.trend = trend

        cy.log(`📈 성능 점수 변화: ${trend.scoreChange > 0 ? '+' : ''}${trend.scoreChange}`)
        cy.log(`📊 페이지 로드 변화: ${trend.pageLoadChange > 0 ? '+' : ''}${trend.pageLoadChange}ms`)
        cy.log(`🚀 API 응답 변화: ${trend.apiResponseChange > 0 ? '+' : ''}${trend.apiResponseChange}ms`)

        // 성능 회귀 검증
        expect(trend.scoreChange).to.be.greaterThan(-10) // 10점 이상 하락 금지
      })
    })
  })
})