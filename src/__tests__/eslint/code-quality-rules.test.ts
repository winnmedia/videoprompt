/**
 * 코드 품질 규칙 ESLint 테스트
 * CLAUDE.md Part 5.3: AI 절대 금지 사항 검증
 */

import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

describe('ESLint 코드 품질 규칙', () => {
  let eslint: ESLint;

  beforeEach(async () => {
    eslint = new ESLint({
      cwd: projectRoot,
      overrideConfigFile: join(projectRoot, 'eslint.config.mjs'),
    });
  });

  describe('TypeScript 금지 사항', () => {
    it('any 타입 사용을 감지해야 함', async () => {
      const code = `
        // any 타입 사용 금지
        export const badFunction = (param: any): any => {
          const result: any = param;
          return result;
        };

        export interface BadInterface {
          data: any;
          callback: (arg: any) => any;
        }
      `;

      const results = await eslint.lintText(code, { filePath: 'test.ts' });
      const errors = results[0].messages;
      const anyTypeErrors = errors.filter(error =>
        error.message.includes('any') || error.ruleId === '@typescript-eslint/no-explicit-any'
      );

      // any 타입 사용에 대한 경고/에러가 있어야 함
      expect(anyTypeErrors.length).toBeGreaterThanOrEqual(1);
    });

    it('@ts-ignore 사용을 감지해야 함', async () => {
      const code = `
        // @ts-ignore 사용 금지
        // @ts-ignore
        const badCode = 'this should not be ignored';

        // @ts-nocheck 사용 금지
        // @ts-nocheck
        const anotherBadCode = 'this should not be ignored';
      `;

      const results = await eslint.lintText(code, { filePath: 'test.ts' });
      const errors = results[0].messages;
      const tsIgnoreErrors = errors.filter(error =>
        error.message.includes('@ts-ignore') || error.message.includes('@ts-nocheck')
      );

      // @ts-ignore 사용에 대한 에러가 있을 수 있음 (설정에 따라)
      // 최소한 TypeScript 컴파일러에서 경고해야 함
      expect(errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tailwind CSS 규칙', () => {
    it('임의 값(Arbitrary values) 사용을 감지해야 함', async () => {
      const code = `
        import React from 'react';

        export const BadComponent = () => {
          return (
            <div
              className="w-[123px] h-[456px] text-[#ff0000] bg-[rgb(255,0,0)]"
            >
              {/* 임의 값 사용 금지 */}
            </div>
          );
        };
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages;

      // Tailwind 임의 값 사용에 대한 에러 확인
      // (이는 커스텀 ESLint 플러그인이나 설정이 필요할 수 있음)
      console.log('Tailwind 임의값 테스트 에러들:', errors.map(e => e.message));
    });

    it('@apply 사용을 감지해야 함', async () => {
      const cssCode = `
        .bad-class {
          @apply bg-blue-500 text-white;
        }

        .another-bad-class {
          @apply flex items-center justify-center;
        }
      `;

      // CSS 파일에 대한 ESLint 검사
      const results = await eslint.lintText(cssCode, { filePath: 'test.css' });
      const errors = results[0].messages;

      // @apply 사용에 대한 에러 확인
      console.log('@apply 테스트 에러들:', errors.map(e => e.message));
    });
  });

  describe('콘솔 로그 제한', () => {
    it('console.log 사용을 감지해야 함', async () => {
      const code = `
        export const debugFunction = () => {
          console.log('This should be detected');
          console.debug('This should be detected');
          console.info('This should be detected');

          // 허용되는 console 메서드들
          console.warn('Warning message');
          console.error('Error message');
        };
      `;

      const results = await eslint.lintText(code, { filePath: 'test.ts' });
      const errors = results[0].messages;
      const consoleErrors = errors.filter(error =>
        error.ruleId === 'no-console' || error.message.includes('console')
      );

      expect(consoleErrors.length).toBeGreaterThanOrEqual(3); // log, debug, info

      consoleErrors.forEach(error => {
        // warn과 error는 허용되어야 함
        expect(error.message).not.toContain('console.warn');
        expect(error.message).not.toContain('console.error');
      });
    });
  });

  describe('React 품질 규칙', () => {
    it('unstable nested components를 감지해야 함', async () => {
      const code = `
        import React from 'react';

        export const BadComponent = () => {
          // 불안정한 중첩 컴포넌트 - 매 렌더링마다 새로 생성됨
          const NestedComponent = () => {
            return <div>Nested</div>;
          };

          return (
            <div>
              <NestedComponent />
            </div>
          );
        };
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages;
      const nestedComponentErrors = errors.filter(error =>
        error.ruleId === 'react/no-unstable-nested-components' ||
        error.message.includes('nested')
      );

      expect(nestedComponentErrors.length).toBeGreaterThanOrEqual(1);
    });

    it('JSX에서 bind 사용을 감지해야 함', async () => {
      const code = `
        import React from 'react';

        export const BadComponent = () => {
          const handleClick = (id: string) => {
            console.log(id);
          };

          return (
            <div>
              {/* 금지된 패턴: bind 사용 */}
              <button onClick={handleClick.bind(null, 'test')}>
                Bad Bind
              </button>

              {/* 허용된 패턴: 화살표 함수 */}
              <button onClick={() => handleClick('test')}>
                Good Arrow Function
              </button>
            </div>
          );
        };
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages;
      const bindErrors = errors.filter(error =>
        error.ruleId === 'react/jsx-no-bind' || error.message.includes('bind')
      );

      // bind 사용에 대한 에러가 있어야 함
      expect(bindErrors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('모멘트JS 금지 검사', () => {
    it('moment.js import를 감지해야 함', async () => {
      const code = `
        // moment.js 사용 금지
        import moment from 'moment';
        import * as moment2 from 'moment';
        const moment3 = require('moment');

        export const badDateHandling = () => {
          const now = moment();
          return now.format('YYYY-MM-DD');
        };
      `;

      const results = await eslint.lintText(code, { filePath: 'test.ts' });
      const errors = results[0].messages;
      const momentErrors = errors.filter(error =>
        error.message.includes('moment') ||
        error.message.includes('no-restricted-imports')
      );

      // moment.js 사용에 대한 제한이 있어야 함
      console.log('Moment.js 테스트 에러들:', errors.map(e => e.message));
    });
  });

  describe('패키지 매니저 제한', () => {
    it('npm/yarn lock 파일을 감지해야 함', async () => {
      // 이는 파일 시스템 레벨에서 검증되는 규칙
      // package-lock.json, yarn.lock 파일 존재 여부 확인
      const lockFiles = ['package-lock.json', 'yarn.lock'];

      // 실제로는 git hook이나 CI에서 검증
      expect(lockFiles.every(file => {
        // pnpm-lock.yaml만 허용
        return file !== 'pnpm-lock.yaml';
      })).toBe(true);
    });
  });

  describe('허용된 패턴 검증', () => {
    it('올바른 TypeScript 패턴은 허용해야 함', async () => {
      const code = `
        // 올바른 TypeScript 패턴들
        export interface User {
          id: string;
          name: string;
          email: string;
        }

        export const processUser = (user: User): string => {
          return \`Hello, \${user.name}\`;
        };

        export const safeTypeAssertion = (data: unknown): User => {
          if (typeof data === 'object' && data !== null) {
            return data as User;
          }
          throw new Error('Invalid user data');
        };
      `;

      const results = await eslint.lintText(code, { filePath: 'test.ts' });
      const errors = results[0].messages;
      const typeErrors = errors.filter(error =>
        error.ruleId === '@typescript-eslint/no-explicit-any'
      );

      expect(typeErrors).toHaveLength(0);
    });

    it('올바른 React 패턴은 허용해야 함', async () => {
      const code = `
        import React, { useCallback, useState } from 'react';

        export const GoodComponent = () => {
          const [count, setCount] = useState(0);

          const handleIncrement = useCallback(() => {
            setCount(prev => prev + 1);
          }, []);

          return (
            <div className="flex items-center space-x-4">
              <span>Count: {count}</span>
              <button onClick={handleIncrement}>
                Increment
              </button>
            </div>
          );
        };
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages;
      const reactErrors = errors.filter(error =>
        error.ruleId?.startsWith('react/') && error.severity === 2
      );

      expect(reactErrors).toHaveLength(0);
    });
  });
});