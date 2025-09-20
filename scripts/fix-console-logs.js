#!/usr/bin/env node

/**
 * Console.log를 logger.info로 자동 변환하는 스크립트
 * ESLint 품질 게이트 복원의 일환
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 변환 통계
let stats = {
  filesProcessed: 0,
  consoleLogsReplaced: 0,
  importsAdded: 0,
  errors: 0
};

// 제외할 디렉토리/파일 패턴
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/*.min.js',
  '**/logger.ts', // 로거 자체는 제외
  'scripts/**', // 스크립트 파일들 제외
  '**/mcp-servers/**', // MCP 서버 제외
  '**/__tests__/**', // 테스트 파일 우선 제외 (별도 처리)
  '**/*.test.*',
  '**/*.spec.*',
];

// Logger import 패턴들
const LOGGER_IMPORT_PATTERNS = [
  /import.*logger.*from.*['"`].*logger.*['"`]/i,
  /import.*\{.*logger.*\}.*from.*['"`].*shared.*['"`]/i,
];

/**
 * 파일에 logger import가 있는지 확인
 */
function hasLoggerImport(content) {
  return LOGGER_IMPORT_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * logger import 추가
 */
function addLoggerImport(content, filePath) {
  // 파일 타입에 따라 적절한 import 경로 결정
  const isApiRoute = filePath.includes('/api/');
  const isSharedLib = filePath.includes('/shared/lib/');
  const isTestFile = filePath.includes('__tests__') || filePath.includes('.test.') || filePath.includes('.spec.');

  let importPath;
  if (isSharedLib) {
    importPath = './logger';
  } else if (isApiRoute) {
    importPath = '@/shared/lib/logger';
  } else {
    importPath = '@/shared/lib/logger';
  }

  const loggerImport = `import { logger } from '${importPath}';\n`;

  // 기존 import들 뒤에 추가
  const lines = content.split('\n');
  let insertIndex = 0;

  // 마지막 import 문 뒤에 삽입
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('import{')) {
      insertIndex = i + 1;
    } else if (lines[i].trim() === '' && insertIndex > 0) {
      // import 블록 뒤의 첫 번째 빈 줄에서 멈춤
      break;
    } else if (insertIndex > 0 && !lines[i].trim().startsWith('import')) {
      // import가 아닌 다른 코드를 만나면 멈춤
      break;
    }
  }

  lines.splice(insertIndex, 0, loggerImport);
  return lines.join('\n');
}

/**
 * console.log 문장을 logger.info로 변환
 */
function replaceConsoleLogs(content) {
  let newContent = content;
  let replacements = 0;

  // 다양한 console.log 패턴 처리
  const patterns = [
    // 기본 console.log
    {
      regex: /console\.log\(/g,
      replacement: 'logger.info('
    },
    // console.debug
    {
      regex: /console\.debug\(/g,
      replacement: 'logger.debug('
    },
    // console.info
    {
      regex: /console\.info\(/g,
      replacement: 'logger.info('
    },
    // console.warn은 그대로 유지 (ESLint 허용)
    // console.error는 그대로 유지 (ESLint 허용)
  ];

  patterns.forEach(({ regex, replacement }) => {
    const matches = newContent.match(regex);
    if (matches) {
      replacements += matches.length;
      newContent = newContent.replace(regex, replacement);
    }
  });

  return { content: newContent, replacements };
}

/**
 * 파일 처리
 */
function processFile(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');

    // console.log 교체
    const { content: newContent, replacements } = replaceConsoleLogs(content);

    if (replacements > 0) {
      let finalContent = newContent;
      let importAdded = false;

      // logger import가 없고 교체가 일어났다면 import 추가
      if (!hasLoggerImport(newContent)) {
        finalContent = addLoggerImport(newContent, filePath);
        importAdded = true;
        stats.importsAdded++;
      }

      // 파일 저장
      fs.writeFileSync(filePath, finalContent, 'utf-8');

      console.log(`  ✅ ${replacements} console.log(s) replaced${importAdded ? ' + import added' : ''}`);
      stats.consoleLogsReplaced += replacements;
    } else {
      console.log(`  ⏭️  No console.log found`);
    }

    stats.filesProcessed++;

  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    stats.errors++;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🔧 Console.log → logger.info 자동 변환 시작...\n');

  // TypeScript/JavaScript 파일 찾기
  const pattern = 'src/**/*.{ts,tsx,js,jsx}';

  try {
    const files = glob.sync(pattern, {
      ignore: EXCLUDE_PATTERNS,
      absolute: true
    });

    console.log(`📁 발견된 파일: ${files.length}개\n`);

    // 파일들 처리
    files.forEach(processFile);

    // 결과 출력
    console.log('\n📊 변환 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📁 처리된 파일: ${stats.filesProcessed}개`);
    console.log(`🔄 변환된 console.log: ${stats.consoleLogsReplaced}개`);
    console.log(`📦 추가된 import: ${stats.importsAdded}개`);
    console.log(`❌ 오류: ${stats.errors}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (stats.errors > 0) {
      console.log('\n⚠️  일부 파일 처리에 실패했습니다. 수동으로 확인해주세요.');
      process.exit(1);
    } else {
      console.log('\n✅ 모든 파일이 성공적으로 처리되었습니다!');
      console.log('\n📋 다음 단계:');
      console.log('   1. pnpm run lint 실행하여 결과 확인');
      console.log('   2. 테스트 실행하여 기능 정상 작동 확인');
      console.log('   3. Git commit으로 변경사항 저장');
    }

  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { processFile, replaceConsoleLogs, addLoggerImport };