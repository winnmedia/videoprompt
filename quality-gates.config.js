/**
 * VideoPlanet 품질 게이트 설정
 *
 * 모든 PR은 다음 품질 기준을 통과해야 함:
 * 1. 인증 시스템 테스트 100% 통과
 * 2. $300 사건 방지 검사 통과
 * 3. API 호출 패턴 안전성 검증
 * 4. 플래키 테스트 0% 보장
 * 5. 성능 회귀 방지
 */

module.exports = {
  // 테스트 커버리지 요구사항
  coverage: {
    // 인증 관련 파일은 100% 커버리지 필수
    critical: {
      threshold: 100,
      files: [
        'src/shared/lib/supabase-auth.ts',
        'src/shared/lib/auth-supabase.ts',
        'src/app/api/auth/*/route.ts'
      ]
    },
    // 전체 코드베이스 최소 커버리지
    overall: {
      lines: 85,
      functions: 90,
      branches: 80,
      statements: 85
    },
    // API 라우트 커버리지
    apiRoutes: {
      threshold: 95,
      pattern: 'src/app/api/**/route.ts'
    }
  },

  // 성능 예산
  performance: {
    // API 응답 시간 임계값
    apiResponseTime: {
      p95: 500, // 95 퍼센타일 500ms 이하
      p99: 1000, // 99 퍼센타일 1초 이하
      average: 200 // 평균 200ms 이하
    },
    // 테스트 실행 시간
    testExecution: {
      unit: 30000, // 단위 테스트: 30초 이하
      integration: 120000, // 통합 테스트: 2분 이하
      e2e: 600000 // E2E 테스트: 10분 이하
    },
    // 메모리 사용량
    memory: {
      testSuite: 512 * 1024 * 1024, // 테스트 스위트: 512MB 이하
      heapIncrease: 50 * 1024 * 1024 // 힙 증가량: 50MB 이하
    }
  },

  // API 호출 안전성 검사
  apiSafety: {
    // $300 사건 방지 규칙
    costSafety: {
      // 1초 내 동일 엔드포인트 최대 호출 수
      maxCallsPerSecond: 5,
      // 테스트당 최대 API 호출 수
      maxCallsPerTest: 50,
      // 위험 패턴 금지 목록
      forbiddenPatterns: [
        'rapid_succession',
        'auth_polling'
      ]
    },
    // 플래키 테스트 방지
    flakiness: {
      // 플래키 패턴 허용 개수 (0개만 허용)
      maxFlakyPatterns: 0,
      // 테스트 재실행 횟수
      maxRetries: 0,
      // 시간 기반 테스트 금지
      forbidTimeBasedTests: true
    }
  },

  // 보안 요구사항
  security: {
    // 인증 테스트 필수 시나리오
    authenticationTests: [
      'invalid_token',
      'expired_token',
      'missing_token',
      'malformed_token',
      'sql_injection_attempt',
      'xss_attempt',
      'unauthorized_access'
    ],
    // 민감 정보 노출 검사
    sensitiveDataLeaks: {
      forbidden: [
        'password',
        'secret',
        'private_key',
        'api_key',
        'access_token'
      ]
    }
  },

  // 코드 품질
  codeQuality: {
    // ESLint 규칙 위반 허용 개수
    eslintErrors: 0,
    eslintWarnings: 5, // 경고는 최대 5개까지 허용

    // TypeScript 엄격성
    typescript: {
      noImplicitAny: true,
      strictNullChecks: true,
      noUnusedLocals: true,
      noUnusedParameters: true
    },

    // 복잡도 제한
    complexity: {
      cyclomatic: 10, // 순환 복잡도 10 이하
      cognitive: 15   // 인지 복잡도 15 이하
    }
  },

  // 아키텍처 규칙
  architecture: {
    // FSD 레이어 의존성 규칙
    layerDependencies: {
      'shared': [], // shared는 다른 레이어에 의존하지 않음
      'entities': ['shared'],
      'features': ['shared', 'entities'],
      'widgets': ['shared', 'entities', 'features'],
      'pages': ['shared', 'entities', 'features', 'widgets'],
      'processes': ['shared', 'entities', 'features', 'widgets', 'pages'],
      'app': ['shared', 'entities', 'features', 'widgets', 'pages', 'processes']
    },
    // 금지된 의존성
    forbiddenDependencies: [
      {
        from: 'shared/**',
        to: ['entities/**', 'features/**', 'widgets/**', 'pages/**']
      },
      {
        from: 'entities/**',
        to: ['features/**', 'widgets/**', 'pages/**']
      }
    ]
  },

  // CI/CD 단계별 게이트
  ciStages: {
    // Stage 1: 빠른 검증 (2분 이내)
    fast: {
      timeout: 120000,
      checks: [
        'lint',
        'type-check',
        'unit-tests',
        'api-safety-basic'
      ]
    },
    // Stage 2: 통합 검증 (10분 이내)
    integration: {
      timeout: 600000,
      checks: [
        'integration-tests',
        'api-safety-full',
        'performance-check',
        'security-scan'
      ]
    },
    // Stage 3: 전체 검증 (30분 이내)
    full: {
      timeout: 1800000,
      checks: [
        'e2e-tests',
        'load-testing',
        'security-full-scan',
        'architecture-validation'
      ]
    }
  },

  // 실패 시 액션
  onFailure: {
    // 크리티컬 실패 시 즉시 중단
    critical: [
      'auth-test-failure',
      'cost-safety-violation',
      'security-vulnerability'
    ],
    // 경고 레벨 실패 시 알림
    warning: [
      'performance-degradation',
      'coverage-below-threshold',
      'code-quality-issues'
    ]
  },

  // 알림 설정
  notifications: {
    // Slack 알림
    slack: {
      webhook: process.env.SLACK_WEBHOOK_URL,
      channels: {
        critical: '#alerts-critical',
        warning: '#alerts-warning',
        success: '#ci-success'
      }
    },
    // 이메일 알림 (크리티컬만)
    email: {
      critical: ['tech-lead@videoplanet.com'],
      warning: []
    }
  },

  // 리포트 생성
  reporting: {
    // 품질 대시보드 업데이트
    dashboard: {
      enabled: true,
      url: 'https://quality-dashboard.videoplanet.com',
      updateOnSuccess: true,
      updateOnFailure: true
    },
    // 아티팩트 저장
    artifacts: {
      coverageReport: 'coverage/lcov-report',
      testResults: 'test-results.xml',
      performanceReport: 'performance-report.json',
      securityReport: 'security-report.json'
    }
  }
};