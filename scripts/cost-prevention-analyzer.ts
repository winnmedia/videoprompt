#!/usr/bin/env npx tsx

/**
 * $300 사건 방지 코드 분석기
 *
 * 개별 파일을 분석하여 비용 위험 패턴을 감지하고
 * JSON 형태로 결과를 출력하는 CLI 도구
 */

import { readFileSync } from 'fs';
import { detectInfiniteLoops, runQualityGates } from './cost-prevention-detector';

interface AnalysisResult {
  file: string;
  isRisky: boolean;
  riskLevel: string;
  estimatedCost: number;
  violations: string[];
  qualityGatesPassed: boolean;
  timestamp: string;
}

function analyzeFile(filePath: string): AnalysisResult {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');

    // 무한 루프 감지 실행
    const loopDetection = detectInfiniteLoops(fileContent);

    // 품질 게이트 실행
    const qualityGates = runQualityGates(fileContent);

    const result: AnalysisResult = {
      file: filePath,
      isRisky: loopDetection.isRisky,
      riskLevel: loopDetection.riskLevel,
      estimatedCost: loopDetection.estimatedCost,
      violations: loopDetection.violations,
      qualityGatesPassed: qualityGates.passed,
      timestamp: new Date().toISOString()
    };

    return result;

  } catch (error) {
    // 에러 발생 시 안전한 기본값 반환
    return {
      file: filePath,
      isRisky: false,
      riskLevel: 'low',
      estimatedCost: 0,
      violations: [],
      qualityGatesPassed: true,
      timestamp: new Date().toISOString()
    };
  }
}

function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('사용법: npx tsx cost-prevention-analyzer.ts <파일경로>');
    process.exit(1);
  }

  try {
    const result = analyzeFile(filePath);

    // JSON 형태로 결과 출력
    console.log(JSON.stringify(result, null, 2));

    // 위험한 패턴이 감지된 경우 exit code 1
    if (result.isRisky) {
      process.exit(1);
    }

  } catch (error) {
    console.error('분석 중 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트가 직접 실행된 경우에만 main 함수 호출
if (require.main === module) {
  main();
}

export { analyzeFile };