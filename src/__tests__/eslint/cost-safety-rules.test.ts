/**
 * $300 사건 방지 ESLint 규칙 TDD 테스트
 * CLAUDE.md Part 7: 비용 안전 규칙 검증
 */

import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

describe('ESLint 비용 안전 규칙 ($300 방지)', () => {
  let eslint: ESLint;

  beforeEach(async () => {
    eslint = new ESLint({
      cwd: projectRoot,
      overrideConfigFile: join(projectRoot, 'eslint.config.mjs'),
    });
  });

  describe('useEffect 의존성 배열 함수 패턴 감지', () => {
    it('함수 접미사 패턴을 감지해야 함', async () => {
      const code = `
        import React, { useEffect } from 'react';

        export function BadComponent() {
          const checkAuth = () => {};
          const handleSubmit = () => {};
          const onValidate = () => {};

          // 🚨 위험 패턴들 - 반드시 에러 발생
          useEffect(() => {
            checkAuth();
          }, [checkAuth]); // Function 접미사

          useEffect(() => {
            handleSubmit();
          }, [handleSubmit]); // Handler 접미사

          useEffect(() => {
            onValidate();
          }, [onValidate]); // Method 접미사

          return <div>Test</div>;
        }
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages;

      // $300 방지 메시지가 포함된 에러만 필터링
      const costSafetyErrors = errors.filter(error =>
        error.message.includes('🚨 $300 사건 방지')
      );

      // 최소 3개의 위험 패턴이 감지되어야 함
      expect(costSafetyErrors.length).toBeGreaterThanOrEqual(3);

      // 각 에러 메시지가 올바른 형식이어야 함
      costSafetyErrors.forEach(error => {
        expect(error.message).toContain('🚨 $300 사건 방지');
        expect(error.message).toContain('useCallback으로 감싸거나 빈 배열 []을 사용하세요');
        expect(error.severity).toBe(2); // error level
      });

      // 디버깅을 위한 에러 메시지 출력
      console.log('실제 에러 메시지들:', errors.map(e => e.message));
    });

    it('React Hook 함수들(use로 시작)을 감지해야 함', async () => {
      const code = `
        import React, { useEffect } from 'react';
        import { useAuth } from '../hooks/useAuth';

        export function BadComponent() {
          const useCustomHook = () => {};

          // 🚨 Hook 함수 의존성 - 반드시 에러 발생
          useEffect(() => {
            useAuth();
          }, [useAuth]);

          useEffect(() => {
            useCustomHook();
          }, [useCustomHook]);

          return <div>Test</div>;
        }
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages;
      const costSafetyErrors = errors.filter(error =>
        error.message.includes('🚨 $300 사건 방지')
      );

      expect(costSafetyErrors.length).toBeGreaterThanOrEqual(2);
      costSafetyErrors.forEach(error => {
        expect(error.message).toContain('🚨 $300 사건 방지');
      });
    });

    it('알려진 위험 함수명들을 감지해야 함', async () => {
      const code = `
        import React, { useEffect } from 'react';

        export function BadComponent() {
          const checkAuth = () => {};
          const authenticate = () => {};
          const refreshAuth = () => {};

          // 🚨 알려진 위험 함수들 - 반드시 에러 발생
          useEffect(() => {
            checkAuth();
          }, [checkAuth]);

          useEffect(() => {
            authenticate();
          }, [authenticate]);

          useEffect(() => {
            refreshAuth();
          }, [refreshAuth]);

          return <div>Test</div>;
        }
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages;
      const costSafetyErrors = errors.filter(error =>
        error.message.includes('🚨 $300 사건 방지')
      );

      expect(costSafetyErrors.length).toBeGreaterThanOrEqual(3);
      costSafetyErrors.forEach(error => {
        expect(error.message).toContain('🚨 $300 사건 방지');
      });
    });

    it('일반적인 함수 동사 패턴을 감지해야 함', async () => {
      const code = `
        import React, { useEffect } from 'react';

        export function BadComponent() {
          const handleClick = () => {};
          const fetchData = () => {};
          const sendRequest = () => {};
          const validateForm = () => {};

          // 🚨 함수 동사 패턴들 - 반드시 에러 발생
          useEffect(() => {
            handleClick();
          }, [handleClick]);

          useEffect(() => {
            fetchData();
          }, [fetchData]);

          useEffect(() => {
            sendRequest();
          }, [sendRequest]);

          useEffect(() => {
            validateForm();
          }, [validateForm]);

          return <div>Test</div>;
        }
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages;
      const costSafetyErrors = errors.filter(error =>
        error.message.includes('🚨 $300 사건 방지')
      );

      expect(costSafetyErrors.length).toBeGreaterThanOrEqual(4);
      costSafetyErrors.forEach(error => {
        expect(error.message).toContain('🚨 $300 사건 방지');
      });
    });

    it('의존성이 3개 초과인 경우 경고해야 함', async () => {
      const code = `
        import React, { useEffect } from 'react';

        export function PerformanceWarningComponent() {
          const a = 1, b = 2, c = 3, d = 4;

          // ⚠️ 성능 주의 - 의존성 3개 초과
          useEffect(() => {
            console.log(a, b, c, d);
          }, [a, b, c, d]);

          return <div>Test</div>;
        }
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages;
      const performanceWarnings = errors.filter(error =>
        error.message.includes('⚠️ 성능 주의')
      );

      expect(performanceWarnings.length).toBeGreaterThanOrEqual(1);
      expect(performanceWarnings[0].message).toContain('⚠️ 성능 주의: useEffect 의존성이 3개 초과');
    });
  });

  describe('안전한 패턴 허용', () => {
    it('useCallback으로 감싼 함수는 허용해야 함', async () => {
      const code = `
        import React, { useEffect, useCallback } from 'react';

        export function SafeComponent() {
          const safeHandler = useCallback(() => {
            // 안전한 로직
          }, []);

          // ✅ 안전한 패턴 - 에러 없어야 함
          useEffect(() => {
            safeHandler();
          }, [safeHandler]);

          return <div>Test</div>;
        }
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const costSafetyErrors = results[0].messages.filter(msg =>
        msg.message.includes('🚨 $300 사건 방지')
      );

      // useCallback으로 감싼 함수는 $300 방지 규칙에 걸리지 않아야 함
      expect(costSafetyErrors).toHaveLength(0);

      // 디버깅: 다른 에러가 있을 수 있음
      if (results[0].messages.length > 0) {
        console.log('useCallback 테스트 에러들:', results[0].messages.map(e => e.message));
      }
    });

    it('빈 의존성 배열은 허용해야 함', async () => {
      const code = `
        import React, { useEffect } from 'react';

        export function SafeComponent() {
          const checkAuth = () => {};

          // ✅ 안전한 패턴 - 에러 없어야 함
          useEffect(() => {
            checkAuth();
          }, []); // 빈 배열

          return <div>Test</div>;
        }
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages.filter(msg =>
        msg.message.includes('🚨 $300 사건 방지')
      );

      expect(errors).toHaveLength(0);
    });

    it('원시값 의존성은 허용해야 함', async () => {
      const code = `
        import React, { useEffect } from 'react';

        export function SafeComponent() {
          const userId = 123;
          const isLoading = false;

          // ✅ 안전한 패턴 - 원시값 의존성
          useEffect(() => {
            if (userId && !isLoading) {
              console.log('Safe effect');
            }
          }, [userId, isLoading]);

          return <div>Test</div>;
        }
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages.filter(msg =>
        msg.message.includes('🚨 $300 사건 방지')
      );

      expect(errors).toHaveLength(0);
    });
  });

  describe('useLayoutEffect 지원', () => {
    it('useLayoutEffect에서도 동일한 규칙이 적용되어야 함', async () => {
      const code = `
        import React, { useLayoutEffect } from 'react';

        export function BadLayoutComponent() {
          const checkAuth = () => {};

          // 🚨 useLayoutEffect에서도 위험 패턴 감지
          useLayoutEffect(() => {
            checkAuth();
          }, [checkAuth]);

          return <div>Test</div>;
        }
      `;

      const results = await eslint.lintText(code, { filePath: 'test.tsx' });
      const errors = results[0].messages;
      const costSafetyErrors = errors.filter(error =>
        error.message.includes('🚨 $300 사건 방지')
      );

      expect(costSafetyErrors.length).toBeGreaterThanOrEqual(1);
      expect(costSafetyErrors[0].message).toContain('🚨 $300 사건 방지');
    });
  });
});