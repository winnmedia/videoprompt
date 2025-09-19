// ESLint 품질 게이트 전용 구성 - CI/CD 파이프라인용
// 거짓 양성 제거하면서 핵심 품질 기준 유지

module.exports = {
  extends: ['./eslint.config.mjs'],

  // CI 환경에서만 적용되는 엄격한 규칙
  rules: {
    // 🚨 $300 사건 방지 규칙은 절대 완화 금지
    'react-hooks/exhaustive-deps': 'error',
    'no-restricted-syntax': 'error',

    // 거짓 양성 제거된 규칙들
    '@typescript-eslint/no-explicit-any': [
      'error',
      {
        ignoreRestArgs: true,
        fixToUnknown: false
      }
    ],

    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
        destructuredArrayIgnorePattern: '^_'
      }
    ],

    // 성능 임계값 설정
    'complexity': ['error', { max: 10 }],
    'max-depth': ['error', { max: 4 }],
    'max-lines-per-function': ['error', { max: 50 }],

    // FSD 아키텍처 강제
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
          }
        ]
      }
    ]
  },

  // CI 환경에서 제외할 파일들
  ignorePatterns: [
    'node_modules/**',
    '.next/**',
    'build/**',
    'dist/**',
    // 테스트 파일은 별도 설정으로 관리
    '**/*.test.{ts,tsx}',
    '**/*.spec.{ts,tsx}',
    'src/__tests__/**'
  ]
};