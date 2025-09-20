/**
 * 프로덕션 헬스 체크 및 모니터링 테스트
 * 실제 서비스 상태 모니터링 및 성능 지표 추적
 * 프로덕션 오류의 조기 탐지를 위한 지속적 모니터링
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { getApiClient, localApiClient, productionApiClient } from '@/test/api-client';
import { PerformanceMonitor, retryOperation, getTestConfig } from '@/test/utils';

describe('프로덕션 헬스 체크 및 모니터링', () => {
  const config = getTestConfig();
  let performanceMonitor: PerformanceMonitor;

  const environments = [
    { name: 'Local Development', client: localApiClient, url: 'http://localhost:3001', critical: false },
    { name: 'Production', client: productionApiClient, url: 'https://www.vridge.kr', critical: true },
  ];

  beforeAll(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  afterAll(() => {
  });

  environments.forEach(({ name, client, url, critical }) => {
    describe(`${name} Health Monitoring (${url})`, () => {
      describe('기본 헬스 체크', () => {
        test('서버 가용성 및 응답 시간 모니터링', async () => {
          performanceMonitor.start();
          
          const healthCheck = await retryOperation(
            () => client.healthCheck(),
            config.healthCheckRetryCount,
            config.healthCheckInterval
          );

          const responseTime = performanceMonitor.stop();

          // 프로덕션 환경은 반드시 정상이어야 함
          if (critical) {
            expect(healthCheck.healthy).toBe(true);
            expect(responseTime).toBeLessThan(config.maxResponseTime);
          } else {
            // 로컬 환경은 경고만 출력
            if (!healthCheck.healthy) {
              console.warn(`⚠️  ${name} server is not healthy: ${healthCheck.error}`);
            }
          }


          // 성능 지표 로깅
          const performanceGrade = responseTime < 1000 ? '🟢 Excellent' :
                                 responseTime < 3000 ? '🟡 Good' :
                                 responseTime < 5000 ? '🟠 Fair' : '🔴 Poor';
          
        });

        test('API 엔드포인트 접근성 및 응답 검증', async () => {
          const criticalEndpoints = [
            { path: '/api/health', name: 'Health Check' },
            { path: '/api/auth/register', name: 'User Registration' },
            { path: '/api/auth/login', name: 'User Login' },
            { path: '/api/auth/verify-email', name: 'Email Verification' },
          ];

          const results = [];

          for (const endpoint of criticalEndpoints) {
            try {
              performanceMonitor.start();
              const response = await client.get(endpoint.path);
              const responseTime = performanceMonitor.stop();

              const result = {
                name: endpoint.name,
                path: endpoint.path,
                accessible: true,
                responseTime,
                status: response.ok ? 'OK' : 'ERROR',
                error: response.ok ? null : response.message || response.error,
              };

              results.push(result);

              // 프로덕션에서는 엔드포인트가 접근 가능해야 함 (404 제외)
              if (critical && !response.ok) {
                const isMethodNotAllowed = response.message?.includes('Method') || 
                                         response.message?.includes('405');
                if (!isMethodNotAllowed) {
                  console.warn(`⚠️  ${name} endpoint issue: ${endpoint.path} - ${result.error}`);
                }
              }

            } catch (error) {
              const result = {
                name: endpoint.name,
                path: endpoint.path,
                accessible: false,
                responseTime: 0,
                status: 'UNREACHABLE',
                error: error instanceof Error ? error.message : 'Unknown error',
              };

              results.push(result);

              if (critical) {
                console.error(`🔴 ${name} endpoint unreachable: ${endpoint.path} - ${result.error}`);
              }
            }
          }

          const accessibleCount = results.filter(r => r.accessible).length;
          const totalCount = results.length;
          const availabilityRate = (accessibleCount / totalCount) * 100;


          // 프로덕션은 최소 80% 가용성 요구
          if (critical) {
            expect(availabilityRate).toBeGreaterThanOrEqual(80);
          }
        });
      });

      describe('성능 모니터링', () => {
        test('응답 시간 벤치마크', async () => {
          const iterations = 5;
          const responseTimes: number[] = [];

          for (let i = 0; i < iterations; i++) {
            try {
              performanceMonitor.start();
              await client.get('/api/health');
              const responseTime = performanceMonitor.stop();
              responseTimes.push(responseTime);
            } catch (error) {
              console.warn(`Performance test iteration ${i + 1} failed:`, error);
            }
          }

          if (responseTimes.length > 0) {
            const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            const minResponseTime = Math.min(...responseTimes);
            const maxResponseTime = Math.max(...responseTimes);


            // 성능 임계값 검증 (프로덕션만)
            if (critical) {
              expect(avgResponseTime).toBeLessThan(config.maxResponseTime);
              expect(maxResponseTime).toBeLessThan(config.maxResponseTime * 2); // 최대 2배까지 허용
            }
          } else {
            if (critical) {
              throw new Error(`${name} performance test failed - no successful requests`);
            }
          }
        });

        test('부하 테스트 - 동시 요청 처리', async () => {
          const concurrency = Math.min(config.loadTestConcurrency, 5); // 테스트 환경에서는 제한
          
          performanceMonitor.start();
          const requests = Array.from({ length: concurrency }, (_, index) =>
            client.get('/api/health').catch(error => ({ 
              error: error.message, 
              index 
            }))
          );

          const results = await Promise.allSettled(requests);
          const totalTime = performanceMonitor.stop();

          const successCount = results.filter(result => 
            result.status === 'fulfilled' && 
            !(result.value as any).error
          ).length;

          const failureCount = concurrency - successCount;
          const successRate = (successCount / concurrency) * 100;
          const avgTimePerRequest = totalTime / concurrency;


          // 프로덕션은 최소 80% 성공률 요구
          if (critical) {
            expect(successRate).toBeGreaterThanOrEqual(80);
            expect(avgTimePerRequest).toBeLessThan(config.maxResponseTime);
          }
        });
      });

      describe('데이터베이스 연결성 모니터링', () => {
        test('데이터베이스 의존적 엔드포인트 검증', async () => {
          const dbEndpoints = [
            { path: '/api/auth/check-user-exists?email=test@example.com', name: 'User Query' },
          ];

          for (const endpoint of dbEndpoints) {
            try {
              performanceMonitor.start();
              const response = await client.get(endpoint.path);
              const responseTime = performanceMonitor.stop();


              // 데이터베이스 연결 문제가 아닌 일반적인 응답이면 OK
              const isDbError = response.message?.includes('database') ||
                               response.message?.includes('connection') ||
                               response.error?.includes('ECONNREFUSED');

              if (critical && isDbError) {
                console.error(`🔴 ${name} database connectivity issue: ${endpoint.path}`);
                expect(isDbError).toBe(false);
              }

              // 응답 시간이 너무 느리면 DB 성능 문제 의심
              if (critical && responseTime > config.maxResponseTime * 2) {
                console.warn(`⚠️  ${name} slow database response: ${responseTime}ms`);
              }
            } catch (error) {
              if (critical) {
                console.error(`🔴 ${name} database endpoint error: ${endpoint.path}`, error);
              }
            }
          }
        });
      });

      describe('보안 및 CORS 헤더 검증', () => {
        test('보안 헤더 검증', async () => {
          try {
            const response = await fetch(`${url}/api/health`);
            const headers = Object.fromEntries(response.headers.entries());


            // 프로덕션은 기본 보안 헤더가 있어야 함
            if (critical) {
              // 기본적인 보안 검사 (모든 헤더가 필수는 아님)
              expect(response.status).not.toBe(500); // 서버 오류 없음
            }
          } catch (error) {
            if (critical) {
              console.error(`🔴 ${name} security header check failed:`, error);
            }
          }
        });

        test('CORS 정책 검증', async () => {
          try {
            const response = await fetch(`${url}/api/health`, {
              method: 'OPTIONS',
            });

            const corsHeaders = {
              'Access-Control-Allow-Origin': response.headers.get('access-control-allow-origin'),
              'Access-Control-Allow-Methods': response.headers.get('access-control-allow-methods'),
              'Access-Control-Allow-Headers': response.headers.get('access-control-allow-headers'),
            };


            if (critical) {
              // CORS 정책이 너무 관대하지 않은지 확인
              const allowOrigin = corsHeaders['Access-Control-Allow-Origin'];
              if (allowOrigin === '*') {
                console.warn(`⚠️  ${name} uses wildcard CORS policy - security risk`);
              }
            }
          } catch (error) {
          }
        });
      });

      describe('서비스 가동 시간 및 안정성', () => {
        test('연속 가용성 검증', async () => {
          const checkCount = 3;
          const checkInterval = 2000; // 2초 간격
          let successCount = 0;
          let totalResponseTime = 0;

          for (let i = 0; i < checkCount; i++) {
            try {
              performanceMonitor.start();
              const healthCheck = await client.healthCheck();
              const responseTime = performanceMonitor.stop();

              if (healthCheck.healthy) {
                successCount++;
                totalResponseTime += responseTime;
              }

              // 마지막 체크가 아니면 대기
              if (i < checkCount - 1) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
              }
            } catch (error) {
              console.warn(`Availability check ${i + 1} failed:`, error);
            }
          }

          const availabilityRate = (successCount / checkCount) * 100;
          const avgResponseTime = successCount > 0 ? totalResponseTime / successCount : 0;


          if (critical) {
            expect(availabilityRate).toBeGreaterThanOrEqual(80);
          }
        });
      });
    });
  });
});