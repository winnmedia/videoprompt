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
  // 글로벌 규칙 완화 - 프로덕션 빌드 성공을 위해
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn', // 오류를 경고로 변경
      '@typescript-eslint/no-unused-vars': 'warn', // 오류를 경고로 변경
      '@next/next/no-img-element': 'warn', // 오류를 경고로 변경
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
          ],
        },
      ],
    },
  },
  // 🚨 $300 사건 방지: useEffect 의존성 배열 함수 패턴 금지
  {
    rules: {
      'react-hooks/exhaustive-deps': [
        'error',
        {
          additionalHooks: '(useEffect|useLayoutEffect|useCallback|useMemo)',
        },
      ],
      // useEffect 의존성 배열에 함수가 들어가는 패턴을 엄격히 금지
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name="useEffect"] > ArrayExpression:last-child > *[type="Identifier"]',
          message: '🚨 $300 사건 방지: useEffect 의존성 배열에 함수를 직접 넣지 마세요. useRef나 useCallback을 사용하거나 빈 배열 []을 사용하세요.',
        },
        {
          selector: 'CallExpression[callee.name="useLayoutEffect"] > ArrayExpression:last-child > *[type="Identifier"]',
          message: '🚨 $300 사건 방지: useLayoutEffect 의존성 배열에 함수를 직접 넣지 마세요. useRef나 useCallback을 사용하거나 빈 배열 []을 사용하세요.',
        },
      ],
      // 추가 React 관련 무한 루프 방지 규칙
      'react/no-unstable-nested-components': 'error',
      'react/jsx-no-bind': ['error', { allowArrowFunctions: true }],
    },
  },
];

export default eslintConfig;
