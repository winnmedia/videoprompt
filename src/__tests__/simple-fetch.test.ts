/**
 * 간단한 fetch 테스트
 * MSW 설정 확인용
 */

describe('Fetch 테스트', () => {
  it('fetch가 정의되어 있다', () => {
    expect(typeof fetch).toBe('function');
  });

  it('간단한 fetch 호출', async () => {
    const response = await fetch('/api/admin/cost-tracking');
    console.log('Response status:', response.status);
    console.log('Response type:', typeof response);

    const data = await response.json();
    console.log('Response data:', data);

    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });
});