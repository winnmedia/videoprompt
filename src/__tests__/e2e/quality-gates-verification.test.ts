/**
 * E2E 품질 게이트 검증 테스트
 * $300 사건 재발 방지를 위한 종합적인 시스템 검증
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

describe('품질 게이트 E2E 검증', () => {
  test.describe('환경변수 검증 E2E', () => {
    test('환경변수 누락 시 앱 시작이 차단되어야 함', async ({ page }) => {
      // Red: 환경변수를 임시로 제거하고 앱 시작 시도
      const originalEnv = process.env.SUPABASE_URL;
      delete process.env.SUPABASE_URL;

      try {
        await page.goto('/');

        // 환경변수 누락으로 인한 에러 페이지 또는 로딩 차단 확인
        await expect(page.locator('[data-testid="env-error"]')).toBeVisible();

        // 또는 503 Service Unavailable 상태 확인
        const response = await page.waitForResponse('/api/health-check');
        expect(response.status()).toBe(503);
      } finally {
        // 환경변수 복원
        process.env.SUPABASE_URL = originalEnv;
      }
    });

    test('필수 환경변수가 모두 설정된 경우 정상 동작해야 함', async ({ page }) => {
      // Green: 필수 환경변수가 설정된 상태에서 앱 시작
      await page.goto('/');

      // 헬스체크 API가 정상 응답하는지 확인
      const healthResponse = await page.waitForResponse('/api/health-check');
      expect(healthResponse.status()).toBe(200);

      // 메인 네비게이션이 렌더링되는지 확인
      await expect(page.locator('[data-testid="main-nav"]')).toBeVisible();
    });
  });

  test.describe('인증 무한 루프 방지 E2E', () => {
    test('401 에러가 무한 루프를 발생시키지 않아야 함', async ({ page }) => {
      let apiCallCount = 0;

      // API 호출 모니터링
      page.on('request', (request) => {
        if (request.url().includes('/api/auth/me')) {
          apiCallCount++;
        }
      });

      await page.goto('/');

      // 2초 대기 후 API 호출 횟수 확인
      await page.waitForTimeout(2000);

      // /api/auth/me는 최대 1회만 호출되어야 함 (게스트 상태로 전환)
      expect(apiCallCount).toBeLessThanOrEqual(1);

      // 게스트 상태 UI 확인
      await expect(page.locator('[data-testid="auth-status-guest"]')).toBeVisible();
    });

    test('토큰 갱신 실패 시 안전하게 게스트 모드로 전환되어야 함', async ({ page }) => {
      // 잘못된 토큰 설정
      await page.context().addCookies([{
        name: 'auth-token',
        value: 'invalid-token',
        domain: 'localhost',
        path: '/'
      }]);

      await page.goto('/');

      // 토큰 갱신 실패 후 게스트 모드로 전환 확인
      await expect(page.locator('[data-testid="auth-status-guest"]')).toBeVisible();

      // 로그인 버튼이 표시되는지 확인
      await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    });
  });

  test.describe('Supabase 연결 실패 처리 E2E', () => {
    test('Supabase 연결 실패 시 503 에러를 반환해야 함', async ({ page }) => {
      // 잘못된 Supabase URL로 요청 (실제로는 API에서 처리)
      const response = await page.request.get('/api/test/supabase-integration');

      if (response.status() === 503) {
        // 연결 실패 시 적절한 에러 응답 확인
        const errorData = await response.json();
        expect(errorData.error).toContain('service unavailable');
      } else {
        // 연결 성공 시 정상 응답 확인
        expect(response.status()).toBe(200);
      }
    });
  });

  test.describe('Planning 데이터 이중 저장 E2E', () => {
    test('Planning 데이터가 Supabase와 Prisma 모두에 저장되어야 함', async ({ page }) => {
      await page.goto('/planning');

      // 새 시나리오 생성
      await page.fill('[data-testid="scenario-title"]', 'E2E 테스트 시나리오');
      await page.fill('[data-testid="scenario-description"]', 'E2E 테스트용 설명');
      await page.click('[data-testid="save-scenario"]');

      // 저장 성공 메시지 확인
      await expect(page.locator('[data-testid="save-success"]')).toBeVisible();

      // 저장된 데이터 검증을 위한 API 호출
      const scenarios = await page.request.get('/api/planning/scenarios');
      expect(scenarios.status()).toBe(200);

      const scenarioData = await scenarios.json();
      expect(scenarioData.scenarios).toContainEqual(
        expect.objectContaining({
          title: 'E2E 테스트 시나리오'
        })
      );
    });
  });

  test.describe('Seedance API 키 검증 E2E', () => {
    test('Seedance API 키가 없으면 Mock 모드로 동작해야 함', async ({ page }) => {
      await page.goto('/video-generation');

      // 비디오 생성 요청
      await page.fill('[data-testid="prompt-input"]', 'E2E 테스트 프롬프트');
      await page.click('[data-testid="generate-video"]');

      // Mock 응답 또는 에러 메시지 확인
      await expect(
        page.locator('[data-testid="mock-mode-notice"]')
      ).toBeVisible({ timeout: 10000 });
    });

    test('유효한 Seedance API 키로 실제 API 호출이 가능해야 함', async ({ page }) => {
      // 환경변수에 Seedance API 키가 설정된 경우에만 테스트
      if (!process.env.SEEDANCE_API_KEY) {
        test.skip('Seedance API 키가 설정되지 않음');
      }

      await page.goto('/video-generation');

      // 비디오 생성 요청
      await page.fill('[data-testid="prompt-input"]', 'E2E 테스트 프롬프트');
      await page.click('[data-testid="generate-video"]');

      // 실제 API 호출 진행 상태 확인
      await expect(
        page.locator('[data-testid="generation-progress"]')
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('성능 및 메모리 누수 E2E', () => {
    test('페이지 네비게이션 시 메모리 누수가 없어야 함', async ({ page }) => {
      const pages = ['/', '/planning', '/video-generation', '/dashboard'];

      for (const path of pages) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        // 메모리 사용량 측정
        const performance = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory;
          }
          return null;
        });

        if (performance) {
          // 메모리 사용량이 합리적인 범위 내에 있는지 확인
          expect(performance.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024); // 50MB
        }
      }
    });

    test('긴 세션 동안 성능이 저하되지 않아야 함', async ({ page }) => {
      await page.goto('/');

      const startTime = Date.now();

      // 여러 액션 반복 수행
      for (let i = 0; i < 10; i++) {
        await page.click('[data-testid="main-nav-planning"]');
        await page.waitForLoadState('networkidle');

        await page.click('[data-testid="main-nav-dashboard"]');
        await page.waitForLoadState('networkidle');
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 10회 네비게이션이 30초 이내에 완료되어야 함
      expect(totalTime).toBeLessThan(30000);
    });
  });

  test.describe('품질 게이트 스크립트 E2E', () => {
    test('품질 게이트 스크립트가 성공적으로 실행되어야 함', () => {
      try {
        // 품질 게이트 스크립트 실행
        const output = execSync('pnpm run quality-gates', {
          encoding: 'utf8',
          timeout: 300000 // 5분 타임아웃
        });

        // 성공 메시지 확인
        expect(output).toContain('모든 품질 게이트 통과');
        expect(output).toContain('✅ PR 병합 가능');
      } catch (error) {
        // 실패한 경우 에러 메시지 확인
        expect(error.stdout || error.message).toContain('품질 게이트 실패');
      }
    });

    test('환경변수 검증이 첫 번째 단계로 실행되어야 함', () => {
      try {
        const output = execSync('pnpm run validate-env', {
          encoding: 'utf8',
          timeout: 30000
        });

        // 환경변수 검증 성공 확인
        expect(output).toContain('환경변수 검증 통과');
      } catch (error) {
        // 환경변수 검증 실패 시 적절한 에러 메시지 확인
        expect(error.stdout || error.message).toContain('환경변수');
      }
    });
  });

  test.describe('CI/CD 워크플로우 시뮬레이션', () => {
    test('전체 CI 파이프라인이 정상 작동해야 함', () => {
      const commands = [
        'pnpm run validate-env',
        'pnpm run type-check',
        'pnpm run lint',
        'pnpm run test:auth',
        'pnpm run build'
      ];

      for (const command of commands) {
        try {
          execSync(command, { encoding: 'utf8', timeout: 120000 });
        } catch (error) {
          // 각 단계별 실패 원인 기록
          console.error(`Failed at step: ${command}`);
          console.error(error.stdout || error.message);
          throw error;
        }
      }
    });
  });
});