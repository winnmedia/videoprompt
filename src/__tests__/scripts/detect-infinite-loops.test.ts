/**
 * $300 방지 테스트 - useEffect 무한 루프 검출 스크립트 테스트
 * Grace QA Lead 품질 게이트: Zero tolerance for infinite loops
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('$300 방지: useEffect 무한 루프 검출', () => {
  const testFilesDir = '/tmp/test-infinite-loops';
  const scriptPath = '/home/winnmedia/videoprompt/scripts/detect-infinite-loops.js';

  beforeEach(() => {
    // 테스트 디렉토리 생성
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true });
    }
    fs.mkdirSync(testFilesDir, { recursive: true });
  });

  afterEach(() => {
    // 정리
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true });
    }
  });

  describe('Red Phase: 실패하는 테스트 - 스크립트가 존재하지 않음', () => {
    it('스크립트 파일이 존재해야 한다', () => {
      expect(() => {
        execSync(`node ${scriptPath}`, { stdio: 'pipe' });
      }).toThrow();
    });
  });

  describe('useEffect 의존성 배열 함수 검출', () => {
    it('$300 패턴: useEffect 의존성 배열에 함수가 있으면 에러를 발생시켜야 한다', () => {
      const dangerousCode = `
import { useEffect } from 'react';

function Component() {
  const checkAuth = () => {
    // API 호출
  };

  // $300 폭탄 패턴
  useEffect(() => {
    checkAuth();
  }, [checkAuth]); // 함수가 의존성 배열에 있음

  return null;
}`;

      const testFile = path.join(testFilesDir, 'dangerous.tsx');
      fs.writeFileSync(testFile, dangerousCode);

      expect(() => {
        execSync(`node ${scriptPath} ${testFile}`, { stdio: 'pipe' });
      }).toThrow(); // 스크립트가 에러 상태로 종료되는지 확인
    });

    it('안전한 패턴: 빈 의존성 배열은 통과해야 한다', () => {
      const safeCode = `
import { useEffect } from 'react';

function Component() {
  const checkAuth = () => {
    // API 호출
  };

  // 안전한 패턴
  useEffect(() => {
    checkAuth();
  }, []); // 빈 배열

  return null;
}`;

      const testFile = path.join(testFilesDir, 'safe.tsx');
      fs.writeFileSync(testFile, safeCode);

      expect(() => {
        execSync(`node ${scriptPath} ${testFile}`, { stdio: 'pipe' });
      }).not.toThrow();
    });

    it('복합 패턴: 여러 useEffect가 있는 경우 모든 위험 패턴을 검출해야 한다', () => {
      const mixedCode = `
import { useEffect } from 'react';

function Component() {
  const fetchUser = () => {};
  const fetchData = () => {};

  // 안전
  useEffect(() => {
    fetchUser();
  }, []);

  // 위험 - $300 패턴
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return null;
}`;

      const testFile = path.join(testFilesDir, 'mixed.tsx');
      fs.writeFileSync(testFile, mixedCode);

      expect(() => {
        execSync(`node ${scriptPath} ${testFile}`, { stdio: 'pipe' });
      }).toThrow(); // 위험 패턴 검출로 에러 종료 확인
    });
  });

  describe('API 호출 중복 검출', () => {
    it('1분 내 동일 API 호출 패턴을 검출해야 한다', () => {
      const rapidCallCode = `
import { useEffect } from 'react';

function Component() {
  useEffect(() => {
    fetch('/api/auth/me');
    fetch('/api/auth/me'); // 중복 호출
  }, []);

  return null;
}`;

      const testFile = path.join(testFilesDir, 'rapid-calls.tsx');
      fs.writeFileSync(testFile, rapidCallCode);

      expect(() => {
        execSync(`node ${scriptPath} ${testFile}`, { stdio: 'pipe' });
      }).toThrow(); // 중복 API 호출 검출로 에러 종료 확인
    });

    it('캐싱 없는 API 호출 패턴을 검출해야 한다', () => {
      const noCacheCode = `
import { useEffect } from 'react';

function Component() {
  useEffect(() => {
    // 캐싱 메커니즘 없이 직접 호출
    fetch('/api/auth/me').then(res => res.json());
  }, []);

  return null;
}`;

      const testFile = path.join(testFilesDir, 'no-cache.tsx');
      fs.writeFileSync(testFile, noCacheCode);

      // 캐싱 없는 패턴은 경고만 발생하므로 에러로 종료되지 않음
      expect(() => {
        const result = execSync(`node ${scriptPath} ${testFile}`, {
          stdio: 'pipe',
          encoding: 'utf8'
        });
      }).not.toThrow();
    });
  });

  describe('Grace QA 요구사항: 제로 톨러런스 정책', () => {
    it('플래키 테스트 패턴을 검출해야 한다', () => {
      const flakyCode = `
import { useEffect } from 'react';

function Component() {
  useEffect(() => {
    // 시간 의존적 코드 - 플래키함의 원인
    setTimeout(() => {
      fetch('/api/data');
    }, Math.random() * 1000);
  }, []);

  return null;
}`;

      const testFile = path.join(testFilesDir, 'flaky.tsx');
      fs.writeFileSync(testFile, flakyCode);

      expect(() => {
        execSync(`node ${scriptPath} ${testFile}`, { stdio: 'pipe' });
      }).toThrow(); // 플래키 패턴 검출로 에러 종료 확인
    });

    it('성능 예산 위반: 무거운 연산이 useEffect에 있으면 경고해야 한다', () => {
      const heavyCode = `
import { useEffect } from 'react';

function Component() {
  useEffect(() => {
    // 무거운 연산 - 성능 예산 위반 가능성
    for (let i = 0; i < 1000000; i++) {
      document.querySelector('.expensive-operation');
    }
  }, []);

  return null;
}`;

      const testFile = path.join(testFilesDir, 'heavy.tsx');
      fs.writeFileSync(testFile, heavyCode);

      expect(() => {
        execSync(`node ${scriptPath} ${testFile}`, { stdio: 'pipe' });
      }).toThrow(); // 성능 예산 위반 검출로 에러 종료 확인
    });
  });

  describe('정상 케이스', () => {
    it('완벽한 TDD 패턴 코드는 모든 검사를 통과해야 한다', () => {
      const perfectCode = `
import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

function Component() {
  // 올바른 서버 상태 관리
  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => fetch('/api/auth/me').then(res => res.json()),
    staleTime: 60000, // 1분 캐싱
  });

  // 올바른 useEffect 사용
  useEffect(() => {
    if (user) {
      console.log('User authenticated');
    }
  }, [user]); // primitive value dependency

  return null;
}`;

      const testFile = path.join(testFilesDir, 'perfect.tsx');
      fs.writeFileSync(testFile, perfectCode);

      const result = execSync(`node ${scriptPath} ${testFile}`, {
        stdio: 'pipe',
        encoding: 'utf8'
      });
      expect(result).toContain('✅ All quality gates passed');
    });
  });
});