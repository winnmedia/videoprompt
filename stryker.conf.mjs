/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'json', 'dashboard'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',

  // Grace QA Lead의 핵심 파일 선별 ($300 사건 방지 우선순위)
  mutate: [
    // 1. $300 사건 방지 시스템 (최우선)
    'scripts/cost-prevention-detector.ts',

    // 2. 인증 시스템 (무한 루프 위험 최고)
    'src/shared/lib/auth-supabase.ts',
    'src/shared/lib/supabase-auth.ts',
    'src/shared/lib/api-client.ts',
    'src/shared/lib/token-manager.ts',
    'src/app/api/auth/me/route.ts',
    'src/app/api/auth/refresh/route.ts',
    'src/app/api/auth/login/route.ts',

    // 3. Planning 이중 저장소 (데이터 일관성 핵심)
    'src/entities/planning/model/*.ts',
    'src/entities/planning/infrastructure/*.ts',
    'src/app/api/planning/*/route.ts',

    // 4. Seedance 연동 (API 키 검증 핵심)
    'src/lib/seedance-service.ts',
    'src/lib/providers/seedance-service.ts',

    // 5. 핵심 비즈니스 로직
    'src/app/api/ai/generate-story/route.ts',
    'src/shared/api/dto-transformers.ts',
    'src/features/auth/hooks/useAuthRedirect.ts',
    'src/entities/auth/store/authStore.ts',

    // 6. 유틸리티 및 공통 라이브러리
    'src/shared/lib/utils.ts',
    'src/shared/lib/dual-storage.ts',
    'src/shared/lib/data-sync.ts',

    // 7. 품질 게이트 핵심 구성요소
    'src/features/*/lib/*.ts',
    'src/features/*/model/*.ts'
  ],

  // 뮤테이션에서 제외할 패턴들
  mutationExclude: [
    '**/*.test.{js,ts,jsx,tsx}',
    '**/*.spec.{js,ts,jsx,tsx}',
    '**/__tests__/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    // 타입 정의 및 상수
    '**/*.d.ts',
    '**/constants.ts',
    '**/types.ts',
    // Mock 및 테스트 유틸리티
    '**/*mock*',
    '**/test-utils/**',
  ],

  // Grace QA Lead의 무관용 품질 임계값 ($300 사건 재발 방지)
  thresholds: {
    high: 95,    // 95% 이상 - Grace 승인
    low: 85,     // 85% 이상 - 조건부 승인
    break: 80    // 80% 미만 - 즉시 배포 차단
  },

  // 성능 최적화
  timeoutMS: 300000, // 5분 타임아웃
  timeoutFactor: 2,
  maxConcurrentTestRunners: 2,

  // 임시 파일 관리
  tempDirName: 'stryker-tmp',
  cleanTempDir: true,

  // Vitest 설정
  vitest: {
    configFile: 'vitest.config.deterministic.js',
  },

  // 로깅 설정
  logLevel: 'info',
  fileLogLevel: 'debug',

  // 대시보드 설정 (선택사항)
  dashboard: {
    project: 'github.com/winnmedia/videoprompt',
    version: 'main',
    module: 'authentication',
  },

  // 플러그인 설정
  plugins: [
    '@stryker-mutator/vitest-runner',
    '@stryker-mutator/typescript-checker',
  ],

  // 특정 뮤테이터만 활성화 (실행 시간 단축)
  mutator: {
    plugins: ['typescript'],
    excludedMutations: [
      // 의미 없는 뮤테이션 제외 (실행 시간 단축)
      'StringLiteral',   // 문자열 변경은 대부분 무의미
      'BooleanLiteral',  // true/false 토글보다 로직에 집중
      'ArrayDeclaration', // 빈 배열 관련 뮤테이션
    ],
  },

  // TypeScript 검사기 설정
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',

  // 증분 뮤테이션 테스트 (속도 향상)
  incremental: true,
  incrementalFile: '.stryker-tmp/incremental.json',

  // 뮤테이션 결과 파일
  htmlReporter: {
    fileName: 'mutation-report.html',
    baseDir: 'reports/mutation',
  },

  jsonReporter: {
    fileName: 'mutation-report.json',
    baseDir: 'reports/mutation',
  },

  // 이그노어 패턴 (특별히 테스트하지 않을 코드)
  ignorers: [
    // 콘솔 로그 및 디버깅 코드
    /console\.(log|debug|info|warn|error)/,
    // 타입 가드
    /typeof\s+\w+\s+===\s+['"]undefined['"]/,
    // 환경 변수 체크
    /process\.env\./,
  ],
};