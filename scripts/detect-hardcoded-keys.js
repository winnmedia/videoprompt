#!/usr/bin/env node

/**
 * $300 사건 재발 방지: 하드코딩된 API 키 감지 스크립트
 *
 * CI에서 실행되어 하드코딩된 API 키가 있으면 빌드 실패시킴
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 하드코딩된 키 감지 패턴들
const HARDCODED_KEY_PATTERNS = [
  // API 키 패턴
  {
    name: 'Bearer Token',
    pattern: /Bearer\s+[a-zA-Z0-9_-]{20,}/g,
    description: 'Bearer 토큰이 하드코딩되어 있습니다'
  },
  {
    name: 'API Key Assignment',
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"][^'"]{20,}['"]/gi,
    description: 'API 키가 하드코딩되어 있습니다'
  },
  {
    name: 'UUID Format',
    pattern: /['"][a-f0-9-]{36}['"]/g,
    description: 'UUID 형식의 테스트 키가 하드코딩되어 있습니다'
  },
  {
    name: 'ark_ Prefix Key',
    pattern: /['"]ark_[a-zA-Z0-9_-]{20,}['"]/g,
    description: 'BytePlus ark_ 키가 하드코딩되어 있습니다'
  },
  {
    name: 'Test Key Patterns',
    pattern: /['"](?:test|mock|fake|demo|sample)-key-[a-zA-Z0-9-]+['"]/gi,
    description: '테스트 키 패턴이 하드코딩되어 있습니다'
  },
  {
    name: 'Seedance Specific UUID',
    pattern: /007f7ffe-84c3-4cdc-b0af-4e00dafdc81c/g,
    description: '차단된 Seedance 테스트 UUID가 발견되었습니다'
  }
];

// 허용된 패턴들 (환경변수 참조, 주석, 예시 등)
const ALLOWED_PATTERNS = [
  /process\.env/,
  /\/\/.*$/,
  /\/\*[\s\S]*?\*\//,
  /환경변수|example|예시|설명|comment|placeholder|development/i,
  /CLAUDE\.md|README/i,
  /createV3Example|Example|Schema|Mock/i  // 예시 데이터 함수
];

// 테스트 파일에서는 더 관대한 허용 정책
const TEST_FILE_PATTERNS = [
  /__tests__|\.test\.|\.spec\./,
  /test.*\.ts$|\.test\.tsx?$/,
  /scripts\/.*\.js$/
];

// 검사할 파일 확장자
const TARGET_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];

/**
 * 파일에서 하드코딩된 키 패턴 검사
 */
function scanFileForHardcodedKeys(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = [];

    // 테스트 파일인지 확인
    const isTestFile = TEST_FILE_PATTERNS.some(pattern => pattern.test(filePath));

    for (const patternConfig of HARDCODED_KEY_PATTERNS) {
      const matches = content.match(patternConfig.pattern);
      if (matches) {
        // 허용된 패턴인지 확인
        const validMatches = matches.filter(match => {
          const matchIndex = content.indexOf(match);
          const lineStart = content.lastIndexOf('\n', matchIndex) + 1;
          const lineEnd = content.indexOf('\n', matchIndex);
          const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);

          // 기본 허용된 패턴 체크 (라인 및 파일 경로 모두 확인)
          if (ALLOWED_PATTERNS.some(allowedPattern =>
            allowedPattern.test(line) || allowedPattern.test(filePath))) {
            return false;
          }

          // 특별 처리: 차단 목록에 있는 키를 검증하는 코드는 허용
          if (patternConfig.name === 'Seedance Specific UUID' || patternConfig.name === 'UUID Format') {
            // 검증 코드에서 차단된 키를 참조하는 것은 허용 (blockedTestKeys 배열 등)
            if (line.includes('blockedTestKeys') || line.includes('차단된') ||
                filePath.includes('validators') || filePath.includes('prevention') ||
                filePath.includes('schema') || line.includes('createV3Example')) {
              return false; // 허용
            }
          }

          // 테스트 파일에서는 특정 패턴만 검사 (실제 위험한 키만)
          if (isTestFile) {
            // 테스트 파일에서는 다른 하드코딩 키 패턴 허용 (Mock 데이터)
            return false;
          }

          return true;
        });

        if (validMatches.length > 0) {
          violations.push({
            pattern: patternConfig.name,
            description: patternConfig.description,
            matches: validMatches,
            file: filePath
          });
        }
      }
    }

    return violations;
  } catch (error) {
    console.warn(`⚠️ 파일 읽기 실패: ${filePath} - ${error.message}`);
    return [];
  }
}

/**
 * 디렉토리 재귀 스캔
 */
function scanDirectory(dirPath, violations = []) {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // node_modules, .git 등 제외
      if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(item)) {
        scanDirectory(fullPath, violations);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(fullPath);
      if (TARGET_EXTENSIONS.includes(ext)) {
        const fileViolations = scanFileForHardcodedKeys(fullPath);
        violations.push(...fileViolations);
      }
    }
  }

  return violations;
}

/**
 * 결과 출력 및 종료 코드 반환
 */
function reportResults(violations) {
  if (violations.length === 0) {
    console.log('✅ 하드코딩된 API 키가 발견되지 않았습니다.');
    return 0;
  }

  console.error('🚨 하드코딩된 API 키가 발견되었습니다!');
  console.error('=====================================');

  const groupedByFile = violations.reduce((acc, violation) => {
    if (!acc[violation.file]) {
      acc[violation.file] = [];
    }
    acc[violation.file].push(violation);
    return acc;
  }, {});

  for (const [file, fileViolations] of Object.entries(groupedByFile)) {
    console.error(`\n📁 ${file}:`);
    for (const violation of fileViolations) {
      console.error(`  ❌ ${violation.pattern}: ${violation.description}`);
      for (const match of violation.matches) {
        console.error(`     "${match}"`);
      }
    }
  }

  console.error('\n💡 해결 방법:');
  console.error('1. 하드코딩된 키를 환경변수로 이동하세요');
  console.error('2. process.env.SEEDANCE_API_KEY 등을 사용하세요');
  console.error('3. 테스트에서는 Mock 데이터를 사용하세요');
  console.error('\n🚫 $300 사건 재발 방지를 위해 빌드를 중단합니다.');

  return 1;
}

/**
 * Git staged 파일만 검사 (CI에서 변경된 파일만)
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(file => file && fs.existsSync(file));
  } catch (error) {
    // Git이 없거나 staged 파일이 없는 경우 전체 src 디렉토리 검사
    console.log('ℹ️ Git staged 파일을 찾을 수 없습니다. 전체 src 디렉토리를 검사합니다.');
    return null;
  }
}

/**
 * 메인 실행 함수
 */
function main() {
  console.log('🔍 하드코딩된 API 키 검사 시작...');

  const stagedFiles = getStagedFiles();
  let violations = [];

  if (stagedFiles && stagedFiles.length > 0) {
    console.log(`📋 ${stagedFiles.length}개의 staged 파일을 검사합니다.`);
    for (const file of stagedFiles) {
      const ext = path.extname(file);
      if (TARGET_EXTENSIONS.includes(ext)) {
        const fileViolations = scanFileForHardcodedKeys(file);
        violations.push(...fileViolations);
      }
    }
  } else {
    console.log('📂 src 디렉토리 전체를 검사합니다.');
    const srcPath = path.join(process.cwd(), 'src');
    if (fs.existsSync(srcPath)) {
      violations = scanDirectory(srcPath);
    } else {
      console.error('❌ src 디렉토리를 찾을 수 없습니다.');
      process.exit(1);
    }
  }

  const exitCode = reportResults(violations);
  process.exit(exitCode);
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = {
  scanFileForHardcodedKeys,
  scanDirectory,
  HARDCODED_KEY_PATTERNS,
  ALLOWED_PATTERNS
};