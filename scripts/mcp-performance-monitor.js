#!/usr/bin/env node

/**
 * MCP 테스트 성능 모니터링 시스템
 * 테스트 실행 시간, 성공률, 리소스 사용량을 추적하고 분석합니다.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class MCPPerformanceMonitor {
  constructor() {
    this.metricsDir = path.join(__dirname, '../mcp-metrics');
    this.metricsFile = path.join(this.metricsDir, 'performance.json');
    this.dailyReportFile = path.join(this.metricsDir, 'daily-report.json');
    
    // 디렉토리 생성
    if (!fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true });
    }
    
    this.metrics = this.loadMetrics();
  }

  loadMetrics() {
    try {
      if (fs.existsSync(this.metricsFile)) {
        return JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
      }
    } catch (error) {
      console.warn('메트릭 파일 로드 실패:', error.message);
    }
    
    return {
      testRuns: [],
      systemMetrics: [],
      averages: {},
      trends: {},
      alerts: []
    };
  }

  saveMetrics() {
    try {
      fs.writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('메트릭 저장 실패:', error.message);
    }
  }

  recordTestRun(testSuite, startTime, endTime, results) {
    const duration = endTime - startTime;
    const timestamp = new Date().toISOString();
    const passedTests = results.filter(r => r.success).length;
    const totalTests = results.length;
    const passRate = totalTests > 0 ? passedTests / totalTests : 0;

    // 시스템 메트릭 수집
    const systemMetrics = this.collectSystemMetrics();

    const testRun = {
      timestamp,
      testSuite,
      duration,
      passedTests,
      totalTests,
      passRate,
      systemMetrics,
      results: results.map(r => ({
        name: r.name,
        success: r.success,
        duration: r.duration || 0,
        error: r.error || null
      }))
    };

    this.metrics.testRuns.push(testRun);

    // 최근 100개 실행만 유지
    if (this.metrics.testRuns.length > 100) {
      this.metrics.testRuns = this.metrics.testRuns.slice(-100);
    }

    this.calculateAverages();
    this.analyzeTrends();
    this.checkAlerts(testRun);
    this.saveMetrics();

    return testRun;
  }

  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: new Date().toISOString(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      system: {
        loadAvg: os.loadavg(),
        freeMem: os.freemem(),
        totalMem: os.totalmem(),
        uptime: os.uptime()
      }
    };
  }

  calculateAverages() {
    const suites = ['enhanced', 'integration', 'website', 'performance'];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    suites.forEach(suite => {
      const allRuns = this.metrics.testRuns.filter(run => run.testSuite === suite);
      const dayRuns = allRuns.filter(run => new Date(run.timestamp) > oneDayAgo);
      const weekRuns = allRuns.filter(run => new Date(run.timestamp) > oneWeekAgo);

      if (allRuns.length > 0) {
        this.metrics.averages[suite] = {
          all: this.calculateSuiteAverage(allRuns),
          day: this.calculateSuiteAverage(dayRuns),
          week: this.calculateSuiteAverage(weekRuns)
        };
      }
    });
  }

  calculateSuiteAverage(runs) {
    if (runs.length === 0) return null;

    const totalDuration = runs.reduce((sum, run) => sum + run.duration, 0);
    const totalPassRate = runs.reduce((sum, run) => sum + run.passRate, 0);
    const avgMemory = runs.reduce((sum, run) => sum + run.systemMetrics.memory.heapUsed, 0);

    return {
      avgDuration: totalDuration / runs.length,
      avgPassRate: totalPassRate / runs.length,
      avgMemoryUsage: avgMemory / runs.length,
      totalRuns: runs.length,
      lastRun: runs[runs.length - 1].timestamp
    };
  }

  analyzeTrends() {
    const suites = ['enhanced', 'integration', 'website', 'performance'];
    
    suites.forEach(suite => {
      const recentRuns = this.metrics.testRuns
        .filter(run => run.testSuite === suite)
        .slice(-10); // 최근 10회 실행

      if (recentRuns.length >= 5) {
        const firstHalf = recentRuns.slice(0, Math.floor(recentRuns.length / 2));
        const secondHalf = recentRuns.slice(Math.floor(recentRuns.length / 2));

        const firstAvgDuration = firstHalf.reduce((sum, run) => sum + run.duration, 0) / firstHalf.length;
        const secondAvgDuration = secondHalf.reduce((sum, run) => sum + run.duration, 0) / secondHalf.length;
        
        const firstAvgPassRate = firstHalf.reduce((sum, run) => sum + run.passRate, 0) / firstHalf.length;
        const secondAvgPassRate = secondHalf.reduce((sum, run) => sum + run.passRate, 0) / secondHalf.length;

        this.metrics.trends[suite] = {
          durationTrend: secondAvgDuration > firstAvgDuration ? 'increasing' : 'decreasing',
          durationChange: ((secondAvgDuration - firstAvgDuration) / firstAvgDuration * 100).toFixed(2),
          passRateTrend: secondAvgPassRate > firstAvgPassRate ? 'improving' : 'declining',
          passRateChange: ((secondAvgPassRate - firstAvgPassRate) * 100).toFixed(2)
        };
      }
    });
  }

  checkAlerts(testRun) {
    const alerts = [];

    // 성능 저하 알림
    if (testRun.duration > 300000) { // 5분 초과
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `${testRun.testSuite} 테스트가 ${(testRun.duration / 1000).toFixed(1)}초 소요됨 (임계값: 5분)`,
        timestamp: testRun.timestamp
      });
    }

    // 실패율 알림
    if (testRun.passRate < 0.9) { // 90% 미만
      alerts.push({
        type: 'failure_rate',
        severity: testRun.passRate < 0.5 ? 'critical' : 'warning',
        message: `${testRun.testSuite} 테스트 성공률이 ${(testRun.passRate * 100).toFixed(1)}%로 낮음`,
        timestamp: testRun.timestamp
      });
    }

    // 메모리 사용량 알림
    const memoryUsageMB = testRun.systemMetrics.memory.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 1024) { // 1GB 초과
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `메모리 사용량이 ${memoryUsageMB.toFixed(1)}MB로 높음`,
        timestamp: testRun.timestamp
      });
    }

    // 알림 추가
    this.metrics.alerts.push(...alerts);

    // 최근 50개 알림만 유지
    if (this.metrics.alerts.length > 50) {
      this.metrics.alerts = this.metrics.alerts.slice(-50);
    }

    return alerts;
  }

  generateDailyReport() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const dayRuns = this.metrics.testRuns.filter(
      run => new Date(run.timestamp) > oneDayAgo
    );

    const report = {
      date: now.toISOString().split('T')[0],
      summary: {
        totalRuns: dayRuns.length,
        avgDuration: dayRuns.length > 0 ? 
          dayRuns.reduce((sum, run) => sum + run.duration, 0) / dayRuns.length : 0,
        avgPassRate: dayRuns.length > 0 ? 
          dayRuns.reduce((sum, run) => sum + run.passRate, 0) / dayRuns.length : 0,
        totalAlerts: this.metrics.alerts.filter(
          alert => new Date(alert.timestamp) > oneDayAgo
        ).length
      },
      suiteBreakdown: {},
      topIssues: [],
      recommendations: []
    };

    // 스위트별 분석
    const suites = ['enhanced', 'integration', 'website', 'performance'];
    suites.forEach(suite => {
      const suiteRuns = dayRuns.filter(run => run.testSuite === suite);
      if (suiteRuns.length > 0) {
        report.suiteBreakdown[suite] = {
          runs: suiteRuns.length,
          avgDuration: suiteRuns.reduce((sum, run) => sum + run.duration, 0) / suiteRuns.length,
          avgPassRate: suiteRuns.reduce((sum, run) => sum + run.passRate, 0) / suiteRuns.length,
          trend: this.metrics.trends[suite] || null
        };
      }
    });

    // 주요 이슈 식별
    const recentAlerts = this.metrics.alerts.filter(
      alert => new Date(alert.timestamp) > oneDayAgo
    );
    
    const alertCounts = {};
    recentAlerts.forEach(alert => {
      alertCounts[alert.type] = (alertCounts[alert.type] || 0) + 1;
    });

    report.topIssues = Object.entries(alertCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // 권장사항 생성
    report.recommendations = this.generateRecommendations(report);

    // 일일 리포트 저장
    try {
      fs.writeFileSync(this.dailyReportFile, JSON.stringify(report, null, 2));
    } catch (error) {
      console.error('일일 리포트 저장 실패:', error.message);
    }

    return report;
  }

  generateRecommendations(report) {
    const recommendations = [];

    // 성능 권장사항
    if (report.summary.avgDuration > 180000) { // 3분 초과
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: '테스트 실행 시간이 길어지고 있습니다. 병렬 실행 최적화를 고려하세요.',
        action: 'npm run optimize:mcp-tests'
      });
    }

    // 성공률 권장사항
    if (report.summary.avgPassRate < 0.95) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: '테스트 성공률이 낮습니다. 불안정한 테스트를 식별하고 수정하세요.',
        action: 'npm run analyze:flaky-tests'
      });
    }

    // 메모리 권장사항
    const hasMemoryIssues = report.topIssues.some(issue => issue.type === 'memory');
    if (hasMemoryIssues) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: '메모리 사용량이 높습니다. 테스트 정리(cleanup) 로직을 검토하세요.',
        action: 'npm run check:memory-leaks'
      });
    }

    return recommendations;
  }

  printReport() {
    const report = this.generateDailyReport();
    
    console.log('\n📊 MCP 테스트 일일 성능 리포트');
    console.log('================================');
    console.log(`📅 날짜: ${report.date}`);
    console.log(`🏃 총 실행 횟수: ${report.summary.totalRuns}회`);
    console.log(`⏱️  평균 실행 시간: ${(report.summary.avgDuration / 1000).toFixed(1)}초`);
    console.log(`✅ 평균 성공률: ${(report.summary.avgPassRate * 100).toFixed(1)}%`);
    console.log(`🚨 총 알림 수: ${report.summary.totalAlerts}개`);
    
    console.log('\n📈 스위트별 성과:');
    Object.entries(report.suiteBreakdown).forEach(([suite, data]) => {
      console.log(`  ${suite.toUpperCase()}:`);
      console.log(`    실행: ${data.runs}회`);
      console.log(`    평균 시간: ${(data.avgDuration / 1000).toFixed(1)}초`);
      console.log(`    성공률: ${(data.avgPassRate * 100).toFixed(1)}%`);
      if (data.trend) {
        console.log(`    트렌드: 시간 ${data.trend.durationTrend} (${data.trend.durationChange}%), 성공률 ${data.trend.passRateTrend} (${data.trend.passRateChange}%p)`);
      }
    });

    if (report.topIssues.length > 0) {
      console.log('\n🔍 주요 이슈:');
      report.topIssues.forEach(issue => {
        console.log(`  ${issue.type}: ${issue.count}회`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 권장사항:');
      report.recommendations.forEach(rec => {
        console.log(`  [${rec.priority.toUpperCase()}] ${rec.message}`);
        console.log(`    실행: ${rec.action}`);
      });
    }

    console.log('\n================================\n');
  }

  // 실시간 모니터링 시작
  startRealTimeMonitoring() {
    console.log('🔍 MCP 테스트 실시간 모니터링 시작...');
    
    setInterval(() => {
      const systemMetrics = this.collectSystemMetrics();
      this.metrics.systemMetrics.push(systemMetrics);
      
      // 최근 100개 시스템 메트릭만 유지
      if (this.metrics.systemMetrics.length > 100) {
        this.metrics.systemMetrics = this.metrics.systemMetrics.slice(-100);
      }
      
      // 메모리 사용량 체크
      const memoryUsageMB = systemMetrics.memory.heapUsed / 1024 / 1024;
      if (memoryUsageMB > 1024) {
        console.warn(`⚠️  높은 메모리 사용량 감지: ${memoryUsageMB.toFixed(1)}MB`);
      }
    }, 30000); // 30초마다 체크
  }
}

// CLI 인터페이스
if (require.main === module) {
  const monitor = new MCPPerformanceMonitor();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'report':
      monitor.printReport();
      break;
    case 'monitor':
      monitor.startRealTimeMonitoring();
      break;
    case 'record':
      // 테스트 결과 기록 (다른 스크립트에서 호출)
      const testSuite = process.argv[3];
      const startTime = parseInt(process.argv[4]);
      const endTime = parseInt(process.argv[5]);
      const results = JSON.parse(process.argv[6] || '[]');
      
      const testRun = monitor.recordTestRun(testSuite, startTime, endTime, results);
      console.log('✅ 테스트 결과 기록 완료:', testRun.timestamp);
      break;
    default:
      console.log('사용법:');
      console.log('  node mcp-performance-monitor.js report   # 일일 리포트 출력');
      console.log('  node mcp-performance-monitor.js monitor  # 실시간 모니터링 시작');
      console.log('  node mcp-performance-monitor.js record <suite> <start> <end> <results>  # 테스트 결과 기록');
  }
}

module.exports = MCPPerformanceMonitor;




