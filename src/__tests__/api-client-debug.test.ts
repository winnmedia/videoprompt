/**
 * API 클라이언트 디버깅 테스트
 * 단순한 케이스부터 확인하여 문제를 찾아보자
 */

import { describe, test, expect } from 'vitest';
import { localApiClient } from '@/test/api-client';

describe('API 클라이언트 디버깅', () => {
  test('직접 fetch로 헬스 체크 API 호출', async () => {
    
    const response = await fetch('http://localhost:3001/api/health');
    
    const text = await response.text();
    
    const data = JSON.parse(text);
    
    expect(response.ok).toBe(true);
    expect(data.ok).toBe(true);
  });

  test('API 클라이언트로 헬스 체크 API 호출', async () => {
    
    try {
      const response = await localApiClient.get('/api/health');
      
      console.log('📊 API 클라이언트 응답:', {
        ok: response.ok,
        data: response.data,
        message: response.message,
        error: response.error,
      });
      
      expect(response).toBeDefined();
      expect(response.ok).toBe(true);
    } catch (error) {
      console.error('❌ API 클라이언트 오류:', error);
      throw error;
    }
  });

  test('헬스 체크 함수 직접 호출', async () => {
    
    try {
      const healthResult = await localApiClient.healthCheck();
      
      console.log('📊 헬스 체크 결과:', {
        healthy: healthResult.healthy,
        responseTime: healthResult.responseTime,
        error: healthResult.error,
      });
      
      expect(healthResult).toBeDefined();
      expect(typeof healthResult.healthy).toBe('boolean');
      expect(typeof healthResult.responseTime).toBe('number');
    } catch (error) {
      console.error('❌ 헬스 체크 오류:', error);
      throw error;
    }
  });
});