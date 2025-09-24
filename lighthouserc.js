/**
 * Lighthouse CI Configuration
 * Robert의 Frontend Platform Lead 표준 - 성능 예산 엄격 적용
 */

module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000',
        'http://localhost:3000/story-generator',
        'http://localhost:3000/story-editor?id=test-story'
      ],
      startServerCommand: 'pnpm start',
      startServerReadyPattern: 'ready on',
      numberOfRuns: 3,
    },
    assert: {
      // Core Web Vitals 임계값 (P75 기준)
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],

        // 성능 예산 - 엄격한 기준
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],

        // 리소스 예산
        'resource-summary:script:size': ['error', { maxNumericValue: 500000 }], // 500KB
        'resource-summary:total:size': ['error', { maxNumericValue: 2000000 }], // 2MB

        // 접근성 필수 요구사항
        'color-contrast': 'error',
        'heading-order': 'error',
        'link-name': 'error',
        'button-name': 'error',

        // 보안
        'is-on-https': 'off', // localhost이므로 비활성화
        'external-anchors-use-rel-noopener': 'error',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
