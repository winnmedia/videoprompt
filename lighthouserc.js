module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/scenario'],
      startServerCommand: 'pnpm start',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 60000,
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: ['--no-sandbox', '--headless'],
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4
        }
      }
    },
    assert: {
      assertions: {
        // Lighthouse 점수 기준
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        
        // Core Web Vitals 기준
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'interaction-to-next-paint': ['error', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        
        // 기타 성능 메트릭
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'speed-index': ['warn', { maxNumericValue: 3400 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
        
        // 리소스 최적화
        'unused-javascript': ['warn', { maxNumericValue: 0.2 }],
        'unused-css-rules': ['warn', { maxNumericValue: 0.2 }],
        'render-blocking-resources': ['warn', { maxNumericValue: 0 }],
        
        // 이미지 최적화
        'modern-image-formats': ['warn', { maxNumericValue: 0 }],
        'uses-optimized-images': ['warn', { maxNumericValue: 0 }],
        'uses-responsive-images': ['warn', { maxNumericValue: 0 }],
        
        // 네트워크 최적화
        'uses-text-compression': ['warn', { maxNumericValue: 0 }],
        'efficient-animated-content': ['warn', { maxNumericValue: 0 }],
        'uses-rel-preconnect': ['warn', { maxNumericValue: 0 }],
        
        // 접근성
        'color-contrast': ['error', { minScore: 1 }],
        'tap-targets': ['error', { minScore: 1 }],
        'accesskeys': ['error', { minScore: 1 }],
        
        // SEO
        'meta-description': ['error', { minScore: 1 }],
        'document-title': ['error', { minScore: 1 }],
        'robots-txt': ['warn', { minScore: 1 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
}