import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // 선별적 규칙 완화 - 거짓 양성 제거하면서 품질 유지
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn', // 점진적 복원 - 오류 대신 경고로
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      '@next/next/no-img-element': 'warn',
      // 프로덕션 품질 개선: console.log 사용 금지
      'no-console': [
        'error',
        {
          allow: ['warn', 'error'] // warn과 error는 허용 (개발 중 디버깅용)
        }
      ],
      // TypeScript 품질 강화
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 10
        }
      ],
      // React 품질 강화
      'react/no-unstable-nested-components': 'error',
      'react/jsx-no-bind': ['error', { allowArrowFunctions: true }],
      // 코드 복잡도 제한
      'complexity': ['warn', { max: 15 }],
      'max-depth': ['warn', { max: 4 }],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
    },
  },
  // 테스트와 타입 파일에 대해 엄격 규칙을 완화하여 배포 차단 방지
  {
    ignores: ['src/__tests__/**', 'src/test/**'],
  },
  {
    files: ['src/__tests__/**', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['src/types/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // FSD 의존 경계 강화: 상향 의존 및 내부 경로 직접 import 제한
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['src/**/app/**', '../**/app/**'],
              message: '하위 레이어에서 app 레이어로의 상향 의존은 금지됩니다.',
            },
            {
              group: ['../**/entities/**', '../**/features/**', '../**/widgets/**'],
              message: '상향 의존 금지: FSD 레이어 규칙을 준수하세요.',
            },
            {
              group: ['**/*/src/**'],
              message: '외부에서 내부 파일로 직접 import 하지 말고 Public API(배럴)를 사용하세요.',
            },
            // FSD Public API 위반 방지 - 내부 모듈 직접 접근 금지
            {
              group: ['@/entities/*/model/*', '@/entities/*/infrastructure/*', '@/entities/*/api/*'],
              message: 'FSD 위반: entities 내부 모듈에 직접 접근하지 말고 Public API(@/entities/*)를 사용하세요.',
            },
            {
              group: ['@/entities/*/store/*', '@/entities/*/hooks/*', '@/entities/*/services/*'],
              message: 'FSD 위반: entities 내부 모듈에 직접 접근하지 말고 Public API(@/entities/*)를 사용하세요.',
            },
            {
              group: ['@/features/*/lib/*', '@/features/*/components/*', '@/features/*/hooks/*'],
              message: 'FSD 위반: features 내부 모듈에 직접 접근하지 말고 Public API(@/features/*)를 사용하세요.',
            },
            {
              group: ['@/widgets/*/ui/*', '@/widgets/*/lib/*', '@/widgets/*/components/*'],
              message: 'FSD 위반: widgets 내부 모듈에 직접 접근하지 말고 Public API(@/widgets/*)를 사용하세요.',
            },
            // 레이어 간 상향 의존 금지
            {
              group: ['@/app/**'],
              message: 'FSD 위반: app 레이어로의 상향 의존은 금지됩니다.',
            },
            {
              group: ['@/pages/**', '@/widgets/**', '@/features/**'],
              message: 'FSD 위반: 상위 레이어로의 의존은 금지됩니다. shared나 entities 레이어를 사용하세요.',
            },
            // CLAUDE.md Part 5.3: moment.js 사용 금지
            {
              group: ['moment'],
              message: 'moment.js 사용 금지: date-fns나 dayjs를 사용하세요.',
            },
          ],
        },
      ],
    },
  },
  // 🚨 $300 사건 방지: useEffect 의존성 배열 함수 패턴 금지 (불변)
  {
    rules: {
      'react-hooks/exhaustive-deps': [
        'error',
        {
          additionalHooks: '(useEffect|useLayoutEffect|useCallback|useMemo)',
          enableDangerousAutofixThisMayCauseInfiniteLoops: false
        },
      ],
      // 함수 의존성 패턴 정밀 감지 - 알려진 위험 패턴만 차단
      'no-restricted-syntax': [
        'error',
        {
          // 명확한 함수 접미사 패턴
          selector: 'CallExpression[callee.name=/^use(Effect|LayoutEffect)$/] > ArrayExpression:last-child > Identifier[name=/^.*(Function|Handler|Callback|Method|Provider|Service|Interceptor)$/]',
          message: '🚨 $300 사건 방지: useEffect 의존성 배열에 함수 "{actual}"를 직접 넣지 마세요. useCallback으로 감싸거나 빈 배열 []을 사용하세요.',
        },
        {
          // React Hook 함수들 (use로 시작하는 변수)
          selector: 'CallExpression[callee.name=/^use(Effect|LayoutEffect)$/] > ArrayExpression:last-child > Identifier[name=/^use[A-Z]/]',
          message: '🚨 $300 사건 방지: useEffect 의존성 배열에 Hook 함수 "{actual}"를 직접 넣지 마세요. useCallback으로 감싸거나 빈 배열 []을 사용하세요.',
        },
        {
          // 알려진 위험 함수명들 (실제 코드베이스 기반)
          selector: 'CallExpression[callee.name=/^use(Effect|LayoutEffect)$/] > ArrayExpression:last-child > Identifier[name=/^(initializeProvider|refreshAuth|sendBatch|stopMonitoring|handleMetric|createFetchInterceptor|getCurrentSessionMetrics|checkAuth|authenticate)$/]',
          message: '🚨 $300 사건 방지: useEffect 의존성 배열에 함수 "{actual}"를 직접 넣지 마세요. useCallback으로 감싸거나 빈 배열 []을 사용하세요.',
        },
        {
          // 일반적인 함수 동사 패턴 (모든 위험 패턴 포함)
          selector: 'CallExpression[callee.name=/^use(Effect|LayoutEffect)$/] > ArrayExpression:last-child > Identifier[name=/^(handle|on|get|set|fetch|load|send|post|put|delete|create|update|remove|check|validate|initialize|init|start|stop|clear|reset|refresh|search|generate|process|execute|run|call|invoke|trigger|authenticate|measure)[A-Z][a-zA-Z]*$/]',
          message: '🚨 $300 사건 방지: useEffect 의존성 배열에 함수 "{actual}"를 직접 넣지 마세요. useCallback으로 감싸거나 빈 배열 []을 사용하세요.',
        },
        {
          // 의존성 배열이 3개 초과인 경우 경고
          selector: 'CallExpression[callee.name="useEffect"][arguments.1.type="ArrayExpression"][arguments.1.elements.length>3]',
          message: '⚠️ 성능 주의: useEffect 의존성이 3개 초과입니다. 로직 분리를 고려하세요.',
        }
      ],
      // 무한 루프 방지 강화
      'react/no-unstable-nested-components': 'error',
      'react/jsx-no-bind': ['error', { allowArrowFunctions: true }],
    },
  },
];

export default eslintConfig;
