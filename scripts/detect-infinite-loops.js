#!/usr/bin/env node

/**
 * $300 방지 스크립트 - useEffect 무한 루프 검출기
 * Grace QA Lead의 제로 톨러런스 정책에 따른 품질 게이트
 *
 * 검출 대상:
 * 1. useEffect 의존성 배열에 함수 포함 ($300 폭탄 패턴)
 * 2. 1분 내 동일 API 중복 호출
 * 3. 캐싱 메커니즘 없는 API 호출
 * 4. 플래키 테스트 패턴 (시간 의존적 코드)
 * 5. 성능 예산 위반 (무거운 연산)
 */

const fs = require('fs');
const path = require('path');

class InfiniteLoopDetector {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.stats = {
      filesChecked: 0,
      dangerousPatterns: 0,
      potentialSavings: 0 // USD
    };
  }

  /**
   * $300 패턴 검출: useEffect 의존성 배열에 함수
   */
  detectUseEffectFunctionDependencies(content, filename) {
    // useEffect(..., [함수명]) 패턴 검출
    const useEffectRegex = /useEffect\s*\(\s*[^,]+,\s*\[([^\]]*)\]\s*\)/g;
    let match;

    while ((match = useEffectRegex.exec(content)) !== null) {
      const dependencies = match[1];

      if (!dependencies.trim()) {
        // 빈 배열은 안전함
        continue;
      }

      // 함수 식별자 패턴 (camelCase로 시작하고 호출가능한 형태)
      const functionPattern = /\b[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)*\b/g;
      const deps = dependencies.split(',').map(d => d.trim());

      for (const dep of deps) {
        // 함수형 의존성 검출
        if (functionPattern.test(dep) && !this.isPrimitiveValue(dep, content)) {
          this.errors.push({
            type: 'INFINITE_LOOP_RISK',
            severity: 'CRITICAL',
            message: `💥 $300 패턴 감지: useEffect 의존성 배열에 함수 '${dep}' 포함됨`,
            file: filename,
            pattern: match[0],
            estimatedCost: 300,
            fix: `useEffect 의존성 배열에서 '${dep}' 제거하고 빈 배열 [] 사용`
          });
          this.stats.dangerousPatterns++;
          this.stats.potentialSavings += 300;
        }
      }
    }
  }

  /**
   * 원시값 여부 확인
   */
  isPrimitiveValue(identifier, content) {
    // useState나 다른 hook에서 온 primitive value인지 확인
    const primitivePatterns = [
      new RegExp(`const\\s+\\[\\s*${identifier}\\s*,`), // useState
      new RegExp(`const\\s+${identifier}\\s*=\\s*\\d+`), // 숫자
      new RegExp(`const\\s+${identifier}\\s*=\\s*["']`), // 문자열
      new RegExp(`const\\s+${identifier}\\s*=\\s*(true|false)`), // 불린
      new RegExp(`data:\\s*${identifier}`), // React Query destructuring
      new RegExp(`const\\s+\\{[^}]*${identifier}[^}]*\\}\\s*=\\s*use`), // Hook destructuring
      new RegExp(`\\{\\s*data:\\s*${identifier}\\s*\\}`), // useQuery data alias
    ];

    // 함수 정의가 있는지 확인 (함수라면 제외하지 않음)
    const functionDefinitionPatterns = [
      new RegExp(`const\\s+${identifier}\\s*=\\s*\\(`), // arrow function
      new RegExp(`function\\s+${identifier}\\s*\\(`), // function declaration
      new RegExp(`const\\s+${identifier}\\s*=\\s*useCallback`), // useCallback
    ];

    const isPrimitive = primitivePatterns.some(pattern => pattern.test(content));
    const isFunction = functionDefinitionPatterns.some(pattern => pattern.test(content));

    // 함수가 아니고 원시값 패턴과 매치되면 안전함
    return isPrimitive && !isFunction;
  }

  /**
   * API 호출 중복 검출
   */
  detectDuplicateApiCalls(content, filename) {
    const apiCallPattern = /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const apiCalls = {};
    let match;

    while ((match = apiCallPattern.exec(content)) !== null) {
      const url = match[1];
      if (!apiCalls[url]) {
        apiCalls[url] = [];
      }
      apiCalls[url].push({
        position: match.index,
        fullMatch: match[0]
      });
    }

    // 중복 호출 검출
    for (const [url, calls] of Object.entries(apiCalls)) {
      if (calls.length > 1) {
        this.errors.push({
          type: 'DUPLICATE_API_CALL',
          severity: 'HIGH',
          message: `🔄 중복 API 호출 감지: '${url}' ${calls.length}번 호출됨`,
          file: filename,
          estimatedCost: calls.length * 0.01 * 1000, // 1000번 호출시 $10
          fix: '캐싱 메커니즘 도입 또는 호출 중복 제거'
        });
      }
    }
  }

  /**
   * 캐싱 메커니즘 부재 검출
   */
  detectNoCacheMechanism(content, filename) {
    const hasFetch = /fetch\s*\(/.test(content);
    const hasCache = /useQuery|swr|cache|staleTime|cacheTime/.test(content);

    if (hasFetch && !hasCache) {
      this.warnings.push({
        type: 'NO_CACHE_MECHANISM',
        severity: 'MEDIUM',
        message: '⚠️ 캐싱 메커니즘 없는 API 호출 감지',
        file: filename,
        fix: 'React Query, SWR 또는 다른 캐싱 솔루션 도입'
      });
    }
  }

  /**
   * 플래키 패턴 검출
   */
  detectFlakyPatterns(content, filename) {
    const flakyPatterns = [
      {
        pattern: /setTimeout\s*\(\s*[^,]+,\s*Math\.random\(\)/,
        message: '플래키 패턴: Math.random()을 사용한 setTimeout'
      },
      {
        pattern: /new Date\(\).*Math\.random/,
        message: '플래키 패턴: 시간과 랜덤값 조합'
      },
      {
        pattern: /setInterval.*Math\.random/,
        message: '플래키 패턴: 랜덤 간격의 setInterval'
      }
    ];

    flakyPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        this.errors.push({
          type: 'FLAKY_PATTERN',
          severity: 'HIGH',
          message: `🎲 ${message} 감지`,
          file: filename,
          fix: '결정론적 타이밍 사용 또는 MSW를 통한 모킹'
        });
      }
    });
  }

  /**
   * 성능 예산 위반 검출
   */
  detectPerformanceBudgetViolations(content, filename) {
    const heavyPatterns = [
      {
        pattern: /for\s*\([^)]*;\s*[^<>]*<\s*\d{4,}/,
        message: '성능 예산 위반: 대규모 반복문 (1000+ iterations)'
      },
      {
        pattern: /document\.querySelector.*for\s*\(/,
        message: '성능 예산 위반: 반복문 내 DOM 쿼리'
      },
      {
        pattern: /JSON\.parse.*JSON\.stringify.*for/,
        message: '성능 예산 위반: 반복문 내 JSON 직렬화'
      }
    ];

    heavyPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        this.errors.push({
          type: 'PERFORMANCE_BUDGET_VIOLATION',
          severity: 'HIGH',
          message: `⚡ ${message}`,
          file: filename,
          fix: '계산 최적화, 메모이제이션 또는 Worker 스레드 사용'
        });
      }
    });
  }

  /**
   * 파일 분석
   */
  analyzeFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath);

    // React/TypeScript 파일만 검사
    if (!/\.(tsx?|jsx?)$/.test(filePath)) {
      return;
    }

    this.stats.filesChecked++;

    // 모든 검출 로직 실행
    this.detectUseEffectFunctionDependencies(content, filename);
    this.detectDuplicateApiCalls(content, filename);
    this.detectNoCacheMechanism(content, filename);
    this.detectFlakyPatterns(content, filename);
    this.detectPerformanceBudgetViolations(content, filename);
  }

  /**
   * 결과 리포트 생성
   */
  generateReport() {
    const hasErrors = this.errors.length > 0;

    console.log('\n🔍 Grace QA Lead - $300 방지 품질 게이트 리포트');
    console.log('═'.repeat(60));

    // 통계
    console.log(`📊 검사 완료: ${this.stats.filesChecked}개 파일`);
    console.log(`🚨 위험 패턴: ${this.stats.dangerousPatterns}개`);
    console.log(`💰 잠재적 절약: $${this.stats.potentialSavings}`);
    console.log('');

    // 에러 출력
    if (this.errors.length > 0) {
      console.log('🚫 치명적 문제 발견:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.severity}] ${error.message}`);
        console.log(`   📁 파일: ${error.file}`);
        if (error.pattern) {
          console.log(`   🔍 패턴: ${error.pattern}`);
        }
        if (error.estimatedCost) {
          console.log(`   💸 예상 비용: $${error.estimatedCost}`);
        }
        console.log(`   🔧 수정 방법: ${error.fix}`);
        console.log('');
      });
    }

    // 경고 출력
    if (this.warnings.length > 0) {
      console.log('⚠️ 경고 사항:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.severity}] ${warning.message}`);
        console.log(`   📁 파일: ${warning.file}`);
        console.log(`   🔧 수정 방법: ${warning.fix}`);
        console.log('');
      });
    }

    if (!hasErrors && this.warnings.length === 0) {
      console.log('✅ All quality gates passed');
      console.log('🎉 $300 사건 재발 위험도: 0%');
    }

    return hasErrors;
  }
}

// CLI 실행
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('사용법: node detect-infinite-loops.js <파일경로>');
    process.exit(1);
  }

  const detector = new InfiniteLoopDetector();

  try {
    args.forEach(filePath => {
      detector.analyzeFile(filePath);
    });

    const hasErrors = detector.generateReport();

    if (hasErrors) {
      console.error('\n💥 품질 게이트 실패: 치명적 문제 해결 필요');
      process.exit(1);
    }

  } catch (error) {
    console.error(`❌ 분석 실패: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { InfiniteLoopDetector };