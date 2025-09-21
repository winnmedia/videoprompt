/**
 * $300 사건 ESLint 규칙 효과성 검증 테스트
 * Grace의 엄격한 품질 게이트 - ESLint 규칙이 실제로 위험한 패턴을 차단하는지 검증
 *
 * 검증 목표:
 * 1. 실제 $300 사건 패턴을 ESLint가 감지하는가?
 * 2. False Negative가 없는가?
 * 3. 합법적인 패턴이 오탐되지 않는가?
 * 4. 규칙의 정확성과 완전성
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ESLint } from 'eslint';
import * as fs from 'fs';
import * as path from 'path';

describe('$300 사건 ESLint 규칙 효과성 검증', () => {
  let eslint: ESLint;
  let tempDir: string;

  beforeEach(async () => {
    // 프로젝트 루트의 ESLint 설정을 사용
    eslint = new ESLint({
      baseConfig: {
        extends: ['next/core-web-vitals', 'next/typescript'],
        rules: {
          'react-hooks/exhaustive-deps': [
            'error',
            {
              additionalHooks: '(useEffect|useLayoutEffect|useCallback|useMemo)',
              enableDangerousAutofixThisMayCauseInfiniteLoops: false
            },
          ],
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
            {
              selector: 'CallExpression[callee.name="useEffect"][arguments.1.type="ArrayExpression"][arguments.1.elements.length>3]',
              message: '⚠️ 성능 주의: useEffect 의존성이 3개 초과입니다. 로직 분리를 고려하세요.',
            }
          ],
        }
      },
      useEslintrc: false,
    });

    // 임시 디렉토리 생성
    tempDir = path.join(process.cwd(), 'temp-eslint-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 임시 파일 정리
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('실제 $300 사건 패턴 감지 (회귀 테스트)', () => {
    it('원본 $300 사건 코드를 정확히 감지해야 함', async () => {
      // 실제 $300 사건을 일으킨 코드 패턴
      const dangerousCode = `
import { useEffect, useState } from 'react';

const Header = () => {
  const [user, setUser] = useState(null);

  const checkAuth = async () => {
    const response = await fetch('/api/auth/me');
    const userData = await response.json();
    setUser(userData);
  };

  // 🚨 이 코드가 $300을 날렸음 - ESLint가 반드시 잡아야 함
  useEffect(() => {
    checkAuth();
  }, [checkAuth]); // 함수를 의존성 배열에 직접 넣음

  return <div>Header</div>;
};

export default Header;
      `;

      const testFile = path.join(tempDir, 'dangerous-header.tsx');
      fs.writeFileSync(testFile, dangerousCode);

      const results = await eslint.lintFiles([testFile]);
      const errors = results[0]?.messages || [];

      // ESLint가 이 위험한 패턴을 반드시 감지해야 함
      const hasRelevantError = errors.some(error =>
        error.message.includes('$300 사건 방지') ||
        error.message.includes('exhaustive-deps') ||
        error.ruleId === 'no-restricted-syntax' ||
        error.ruleId === 'react-hooks/exhaustive-deps'
      );

      expect(hasRelevantError).toBe(true);
      expect(errors.length).toBeGreaterThan(0);

      // 구체적인 에러 메시지 검증
      const restrictedSyntaxError = errors.find(e => e.ruleId === 'no-restricted-syntax');
      if (restrictedSyntaxError) {
        expect(restrictedSyntaxError.message).toContain('$300 사건 방지');
      }
    });

    it('router.push, onClose 같은 함수들도 감지해야 함', async () => {
      const dangerousCode = `
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const Component = ({ onClose }) => {
  const router = useRouter();

  // 이런 패턴들도 위험함
  useEffect(() => {
    router.push('/dashboard');
  }, [router.push]); // 위험!

  useEffect(() => {
    onClose();
  }, [onClose]); // 위험!

  return <div>Component</div>;
};
      `;

      const testFile = path.join(tempDir, 'router-danger.tsx');
      fs.writeFileSync(testFile, dangerousCode);

      const results = await eslint.lintFiles([testFile]);
      const errors = results[0]?.messages || [];

      const functionDependencyErrors = errors.filter(error =>
        error.ruleId === 'no-restricted-syntax' ||
        (error.ruleId === 'react-hooks/exhaustive-deps' &&
         (error.message.includes('router.push') || error.message.includes('onClose')))
      );

      expect(functionDependencyErrors.length).toBeGreaterThan(0);
    });

    it('useLayoutEffect의 함수 의존성도 감지해야 함', async () => {
      const dangerousCode = `
import { useLayoutEffect } from 'react';

const Component = () => {
  const handleResize = () => {
  };

  // useLayoutEffect도 동일하게 위험함
  useLayoutEffect(() => {
    handleResize();
  }, [handleResize]); // 위험!

  return <div>Component</div>;
};
      `;

      const testFile = path.join(tempDir, 'layout-effect-danger.tsx');
      fs.writeFileSync(testFile, dangerousCode);

      const results = await eslint.lintFiles([testFile]);
      const errors = results[0]?.messages || [];

      const layoutEffectError = errors.find(error =>
        error.ruleId === 'no-restricted-syntax' &&
        error.message.includes('useLayoutEffect')
      );

      expect(layoutEffectError).toBeDefined();
      expect(layoutEffectError?.message).toContain('$300 사건 방지');
    });
  });

  describe('False Negative 방지 - 위험한 패턴이 놓치지 않는지 검증', () => {
    it('변수명이 바뀌어도 함수 의존성을 감지해야 함', async () => {
      const variants = [
        'checkAuthentication',
        'validateUser',
        'fetchUserData',
        'authenticateUser',
        'verifyToken',
        'refreshAuth'
      ];

      for (const funcName of variants) {
        const dangerousCode = `
import { useEffect } from 'react';

const Component = () => {
  const ${funcName} = async () => {
    // API 호출 로직
  };

  useEffect(() => {
    ${funcName}();
  }, [${funcName}]); // 모두 위험한 패턴

  return <div>Component</div>;
};
        `;

        const testFile = path.join(tempDir, `variant-${funcName}.tsx`);
        fs.writeFileSync(testFile, dangerousCode);

        const results = await eslint.lintFiles([testFile]);
        const errors = results[0]?.messages || [];

        const hasFunctionDependencyError = errors.some(error =>
          error.ruleId === 'no-restricted-syntax' ||
          error.ruleId === 'react-hooks/exhaustive-deps'
        );

        expect(hasFunctionDependencyError).toBe(true);
      }
    });

    it('복잡한 의존성 배열에서도 함수를 감지해야 함', async () => {
      const dangerousCode = `
import { useEffect, useState } from 'react';

const Component = () => {
  const [count, setCount] = useState(0);
  const [data, setData] = useState(null);

  const fetchData = async () => {};
  const updateCount = () => {};

  // 복잡한 의존성 배열에 함수가 섞여 있음
  useEffect(() => {
    fetchData();
    updateCount();
  }, [count, data, fetchData, updateCount]); // 함수 2개가 섞여 있음

  return <div>Component</div>;
};
      `;

      const testFile = path.join(tempDir, 'complex-deps.tsx');
      fs.writeFileSync(testFile, dangerousCode);

      const results = await eslint.lintFiles([testFile]);
      const errors = results[0]?.messages || [];

      // 함수 의존성 에러가 있어야 함
      const functionErrors = errors.filter(error =>
        error.ruleId === 'no-restricted-syntax' ||
        (error.ruleId === 'react-hooks/exhaustive-deps' &&
         (error.message.includes('fetchData') || error.message.includes('updateCount')))
      );

      expect(functionErrors.length).toBeGreaterThan(0);

      // 의존성 개수 초과 경고도 있어야 함 (4개 > 3개)
      const tooManyDepsError = errors.find(error =>
        error.message.includes('의존성이 3개 초과')
      );
      expect(tooManyDepsError).toBeDefined();
    });
  });

  describe('False Positive 방지 - 안전한 패턴이 오탐되지 않는지 검증', () => {
    it('데이터 객체는 의존성 배열에 넣어도 안전해야 함', async () => {
      const safeCode = `
import { useEffect, useState } from 'react';

const Component = ({ user, config, settings }) => {
  const [data, setData] = useState(null);

  // 이런 패턴들은 안전함 - 객체/데이터
  useEffect(() => {
    if (user) {
      setData(user.profile);
    }
  }, [user]); // 안전: 객체

  useEffect(() => {
  }, [config]); // 안전: 설정 객체

  useEffect(() => {
    applySettings(settings);
  }, [settings]); // 안전: 설정

  return <div>Component</div>;
};
      `;

      const testFile = path.join(tempDir, 'safe-objects.tsx');
      fs.writeFileSync(testFile, safeCode);

      const results = await eslint.lintFiles([testFile]);
      const errors = results[0]?.messages || [];

      // 데이터 객체에 대한 no-restricted-syntax 에러가 없어야 함
      const falsePositiveErrors = errors.filter(error =>
        error.ruleId === 'no-restricted-syntax' &&
        (error.message.includes('user') || error.message.includes('config') || error.message.includes('settings'))
      );

      expect(falsePositiveErrors.length).toBe(0);
    });

    it('원시값 변수는 의존성 배열에 넣어도 안전해야 함', async () => {
      const safeCode = `
import { useEffect, useState } from 'react';

const Component = ({ userId, isOpen, status, countdown }) => {
  const [data, setData] = useState(null);

  // 원시값들은 안전함
  useEffect(() => {
    if (userId) {
      fetchUserData(userId);
    }
  }, [userId]); // 안전: 숫자/문자열

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
  }, [isOpen]); // 안전: boolean

  useEffect(() => {
    updateStatus(status);
  }, [status]); // 안전: 문자열

  useEffect(() => {
    if (countdown === 0) {
      onTimeUp();
    }
  }, [countdown]); // 안전: 숫자

  return <div>Component</div>;
};
      `;

      const testFile = path.join(tempDir, 'safe-primitives.tsx');
      fs.writeFileSync(testFile, safeCode);

      const results = await eslint.lintFiles([testFile]);
      const errors = results[0]?.messages || [];

      // 원시값에 대한 no-restricted-syntax 에러가 없어야 함
      const falsePositiveErrors = errors.filter(error =>
        error.ruleId === 'no-restricted-syntax' &&
        (error.message.includes('userId') ||
         error.message.includes('isOpen') ||
         error.message.includes('status') ||
         error.message.includes('countdown'))
      );

      expect(falsePositiveErrors.length).toBe(0);
    });

    it('빈 의존성 배열과 의존성 없음은 안전해야 함', async () => {
      const safeCode = `
import { useEffect, useState } from 'react';

const Component = () => {
  const [mounted, setMounted] = useState(false);

  // 안전한 패턴들
  useEffect(() => {
    setMounted(true); // 마운트 시 1회만
  }, []); // 안전: 빈 배열

  useEffect(() => {
    const timer = setInterval(() => {
    }, 1000);

    return () => clearInterval(timer);
  }); // 안전: 의존성 없음 (매번 실행이지만 정리됨)

  return <div>Component</div>;
};
      `;

      const testFile = path.join(tempDir, 'safe-patterns.tsx');
      fs.writeFileSync(testFile, safeCode);

      const results = await eslint.lintFiles([testFile]);
      const errors = results[0]?.messages || [];

      // $300 사건 관련 에러가 없어야 함
      const criticalErrors = errors.filter(error =>
        error.message.includes('$300 사건 방지')
      );

      expect(criticalErrors.length).toBe(0);
    });
  });

  describe('규칙 정확성 검증', () => {
    it('ESLint 규칙이 활성화되어 있는지 확인', async () => {
      const config = await eslint.calculateConfigForFile(path.join(tempDir, 'test.tsx'));

      // react-hooks/exhaustive-deps 규칙 활성화 확인
      expect(config.rules['react-hooks/exhaustive-deps']).toEqual([
        'error',
        {
          additionalHooks: '(useEffect|useLayoutEffect|useCallback|useMemo)',
          enableDangerousAutofixThisMayCauseInfiniteLoops: false
        }
      ]);

      // no-restricted-syntax 규칙 활성화 확인
      expect(config.rules['no-restricted-syntax']).toBeDefined();
      expect(Array.isArray(config.rules['no-restricted-syntax'])).toBe(true);
      expect(config.rules['no-restricted-syntax'][0]).toBe('error');

      // $300 사건 방지 패턴이 포함되어 있는지 확인
      const restrictedPatterns = config.rules['no-restricted-syntax'].slice(1);
      const has300Prevention = restrictedPatterns.some((pattern: any) =>
        pattern.message && pattern.message.includes('$300 사건 방지')
      );

      expect(has300Prevention).toBe(true);
    });

    it('의존성 개수 제한 규칙이 정확히 작동하는지 확인', async () => {
      const tooManyDepsCode = `
import { useEffect, useState } from 'react';

const Component = () => {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [c, setC] = useState(0);
  const [d, setD] = useState(0);

  // 4개 의존성 (3개 초과)
  useEffect(() => {
  }, [a, b, c, d]);

  return <div>Component</div>;
};
      `;

      const testFile = path.join(tempDir, 'too-many-deps.tsx');
      fs.writeFileSync(testFile, tooManyDepsCode);

      const results = await eslint.lintFiles([testFile]);
      const errors = results[0]?.messages || [];

      const tooManyDepsError = errors.find(error =>
        error.message.includes('의존성이 3개 초과')
      );

      expect(tooManyDepsError).toBeDefined();
    });
  });

  describe('성능 영향 평가', () => {
    it('ESLint 규칙이 너무 많은 시간을 소비하지 않는지 확인', async () => {
      const largeCode = `
import { useEffect, useState } from 'react';

const Component = () => {
  ${Array.from({ length: 50 }, (_, i) => `
  const [state${i}, setState${i}] = useState(${i});

  useEffect(() => {
  }, [state${i}]);
  `).join('\n')}

  return <div>Large Component</div>;
};
      `;

      const testFile = path.join(tempDir, 'large-component.tsx');
      fs.writeFileSync(testFile, largeCode);

      const startTime = Date.now();
      const results = await eslint.lintFiles([testFile]);
      const endTime = Date.now();

      const lintingTime = endTime - startTime;

      // ESLint 실행이 5초를 넘지 않아야 함
      expect(lintingTime).toBeLessThan(5000);

      // 결과는 정상적으로 나와야 함
      expect(results).toBeDefined();
      expect(results.length).toBe(1);
    });
  });
});