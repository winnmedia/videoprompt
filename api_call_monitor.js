/**
 * 🔍 VLANET API 호출 모니터링 도구
 *
 * 사용법:
 * 1. 브라우저 개발자도구(F12) → Console 탭 열기
 * 2. 이 스크립트 전체를 복사해서 콘솔에 붙여넣기
 * 3. Enter로 실행
 * 4. VLANET 사이트에서 기능 테스트 진행
 * 5. 콘솔에서 실시간 API 호출 모니터링
 */

(function() {
    console.log('🚀 VLANET API 모니터링 시작...');
    console.log('⚠️  $300 사건 방지를 위한 비용 안전 모니터링 활성화');

    // API 호출 통계
    const apiStats = {
        calls: [],
        totalCalls: 0,
        dangerousCalls: 0,
        startTime: Date.now()
    };

    // 위험한 API 패턴 정의
    const DANGER_PATTERNS = {
        '/api/auth/me': { maxPerMinute: 3, cost: 0.01 },
        '/api/planning/register': { maxPerMinute: 5, cost: 0.1 },
        '/api/scenario/develop': { maxPerMinute: 2, cost: 1.0 },
        '/api/scenario/develop-shots': { maxPerMinute: 2, cost: 2.0 }
    };

    // 비용 폭탄 감지 임계값
    const COST_BOMB_THRESHOLD = 10; // $10
    let totalEstimatedCost = 0;

    // 원본 fetch 함수 백업
    const originalFetch = window.fetch;
    const originalXHR = XMLHttpRequest.prototype.open;

    // fetch 호출 intercept
    window.fetch = function(...args) {
        const url = args[0];
        const options = args[1] || {};

        logApiCall('FETCH', url, options.method || 'GET');

        return originalFetch.apply(this, args)
            .then(response => {
                logApiResponse(url, response.status, response.ok);
                return response;
            })
            .catch(error => {
                logApiError(url, error);
                throw error;
            });
    };

    // XMLHttpRequest 호출 intercept
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._monitorMethod = method;
        this._monitorUrl = url;

        logApiCall('XHR', url, method);

        // 응답 모니터링
        this.addEventListener('load', () => {
            logApiResponse(url, this.status, this.status >= 200 && this.status < 300);
        });

        this.addEventListener('error', () => {
            logApiError(url, 'XHR Error');
        });

        return originalXHR.apply(this, [method, url, ...args]);
    };

    // API 호출 로깅
    function logApiCall(type, url, method) {
        const timestamp = new Date().toISOString();
        const call = {
            timestamp,
            type,
            method,
            url: normalizeUrl(url),
            fullUrl: url
        };

        apiStats.calls.push(call);
        apiStats.totalCalls++;

        console.log(`📡 [${type}] ${method} ${call.url}`, call);

        // 위험 패턴 검사
        checkDangerousPattern(call);

        // 실시간 통계 업데이트
        updateStats();
    }

    // API 응답 로깅
    function logApiResponse(url, status, success) {
        const normalizedUrl = normalizeUrl(url);
        const statusIcon = success ? '✅' : '❌';
        console.log(`${statusIcon} Response: ${status} | ${normalizedUrl}`);
    }

    // API 에러 로깅
    function logApiError(url, error) {
        console.error(`💥 Error: ${normalizeUrl(url)}`, error);
    }

    // URL 정규화 (쿼리 파라미터 제거)
    function normalizeUrl(url) {
        if (typeof url !== 'string') return String(url);
        try {
            const urlObj = new URL(url, window.location.origin);
            return urlObj.pathname;
        } catch {
            return url.split('?')[0]; // fallback
        }
    }

    // 위험한 API 호출 패턴 검사
    function checkDangerousPattern(call) {
        const oneMinuteAgo = Date.now() - 60000;
        const recentCalls = apiStats.calls.filter(c =>
            new Date(c.timestamp).getTime() > oneMinuteAgo &&
            c.url === call.url
        );

        const pattern = DANGER_PATTERNS[call.url];
        if (pattern && recentCalls.length >= pattern.maxPerMinute) {
            apiStats.dangerousCalls++;

            // 비용 추산
            const estimatedCost = recentCalls.length * pattern.cost;
            totalEstimatedCost += pattern.cost;

            console.warn(`🚨 위험한 API 패턴 감지!`);
            console.warn(`   엔드포인트: ${call.url}`);
            console.warn(`   1분간 호출 횟수: ${recentCalls.length}회`);
            console.warn(`   추정 비용: $${estimatedCost.toFixed(2)}`);
            console.warn(`   총 추정 비용: $${totalEstimatedCost.toFixed(2)}`);

            // 비용 폭탄 경고
            if (totalEstimatedCost >= COST_BOMB_THRESHOLD) {
                console.error(`💸 비용 폭탄 위험! 총 추정 비용: $${totalEstimatedCost.toFixed(2)}`);
                console.error(`⛔ 즉시 테스트를 중단하세요!`);
            }
        }
    }

    // 실시간 통계 업데이트
    function updateStats() {
        if (apiStats.totalCalls % 5 === 0) { // 5개마다 통계 출력
            const runtime = Math.round((Date.now() - apiStats.startTime) / 1000);
            console.group(`📊 API 호출 통계 (${runtime}초 경과)`);
            console.log(`총 호출 횟수: ${apiStats.totalCalls}`);
            console.log(`위험 패턴 감지: ${apiStats.dangerousCalls}회`);
            console.log(`추정 비용: $${totalEstimatedCost.toFixed(2)}`);

            // 최근 호출 요약
            const recentCalls = apiStats.calls.slice(-10);
            const callSummary = {};
            recentCalls.forEach(call => {
                callSummary[call.url] = (callSummary[call.url] || 0) + 1;
            });
            console.table(callSummary);
            console.groupEnd();
        }
    }

    // 최종 리포트 생성
    window.generateApiReport = function() {
        console.group('📋 최종 API 호출 리포트');

        const runtime = Math.round((Date.now() - apiStats.startTime) / 1000);
        console.log(`테스트 시간: ${runtime}초`);
        console.log(`총 API 호출: ${apiStats.totalCalls}회`);
        console.log(`위험 패턴: ${apiStats.dangerousCalls}회`);
        console.log(`추정 총 비용: $${totalEstimatedCost.toFixed(2)}`);

        // 엔드포인트별 호출 횟수
        const endpointStats = {};
        apiStats.calls.forEach(call => {
            const key = `${call.method} ${call.url}`;
            endpointStats[key] = (endpointStats[key] || 0) + 1;
        });

        console.log('\n📈 엔드포인트별 호출 횟수:');
        console.table(endpointStats);

        // 시간대별 호출 패턴
        const timePattern = {};
        apiStats.calls.forEach(call => {
            const minute = new Date(call.timestamp).toISOString().slice(0, 16);
            timePattern[minute] = (timePattern[minute] || 0) + 1;
        });

        console.log('\n⏰ 시간대별 호출 패턴:');
        console.table(timePattern);

        console.groupEnd();

        return {
            runtime,
            totalCalls: apiStats.totalCalls,
            dangerousCalls: apiStats.dangerousCalls,
            estimatedCost: totalEstimatedCost,
            endpointStats,
            timePattern,
            allCalls: apiStats.calls
        };
    };

    // 긴급 중단 함수
    window.emergencyStop = function() {
        console.error('🛑 긴급 중단 실행!');

        // fetch 복원
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalXHR;

        console.log('✅ API 모니터링 중단됨');
        generateApiReport();
    };

    console.log('✅ API 모니터링 설정 완료!');
    console.log('📝 사용법:');
    console.log('  - generateApiReport() : 현재까지 리포트 출력');
    console.log('  - emergencyStop() : 긴급 중단');
    console.log('🔍 이제 VLANET에서 기능을 테스트하세요...');
})();