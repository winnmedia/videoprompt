#!/usr/bin/env node

/**
 * Console.log를 Logger 시스템으로 자동 변환하는 스크립트
 *
 * 변환 규칙:
 * - console.log() → logger.info()
 * - console.error() → logger.error()
 * - console.warn() → logger.warn()
 * - console.debug() → logger.debug()
 * - console.info() → logger.info()
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');

// 변환 규칙 정의
const CONSOLE_REPLACEMENTS = [
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.info(',
    logLevel: 'info'
  },
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error(',
    logLevel: 'error'
  },
  {
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn(',
    logLevel: 'warn'
  },
  {
    pattern: /console\.debug\(/g,
    replacement: 'logger.debug(',
    logLevel: 'debug'
  },
  {
    pattern: /console\.info\(/g,
    replacement: 'logger.info(',
    logLevel: 'info'
  }
];

// Logger import 패턴들
const LOGGER_IMPORT_PATTERNS = [
  "import { logger } from '@/shared/lib/logger';",
  "import { logger } from '@/shared/lib/logger'",
  "from '@/shared/lib/logger'"
];

function hasLoggerImport(content) {
  return LOGGER_IMPORT_PATTERNS.some(pattern => content.includes(pattern));
}

function addLoggerImport(content) {
  // 이미 logger import가 있으면 추가하지 않음
  if (hasLoggerImport(content)) {
    return content;
  }

  // 다른 import 문들을 찾아서 그 뒤에 logger import 추가
  const importLines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < importLines.length; i++) {
    const line = importLines[i].trim();
    if (line.startsWith('import ') && !line.includes('type ')) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex >= 0) {
    importLines.splice(lastImportIndex + 1, 0, "import { logger } from '@/shared/lib/logger';");
  } else {
    // import가 없다면 파일 맨 위에 추가
    importLines.unshift("import { logger } from '@/shared/lib/logger';");
  }

  return importLines.join('\n');
}

function replaceConsoleStatements(content) {
  let modified = content;
  let hasReplacements = false;

  for (const rule of CONSOLE_REPLACEMENTS) {
    if (rule.pattern.test(modified)) {
      modified = modified.replace(rule.pattern, rule.replacement);
      hasReplacements = true;
    }
  }

  return { content: modified, hasReplacements };
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // console 사용이 있는지 확인
    const hasConsole = CONSOLE_REPLACEMENTS.some(rule => rule.pattern.test(content));

    if (!hasConsole) {
      return { processed: false, changes: 0 };
    }

    // Console 문을 logger로 변경
    const { content: replacedContent, hasReplacements } = replaceConsoleStatements(content);

    if (!hasReplacements) {
      return { processed: false, changes: 0 };
    }

    // Logger import 추가
    const finalContent = addLoggerImport(replacedContent);

    // 파일에 저장
    fs.writeFileSync(filePath, finalContent, 'utf8');

    // 변경 사항 카운트
    const changeCount = CONSOLE_REPLACEMENTS.reduce((count, rule) => {
      const matches = content.match(rule.pattern);
      return count + (matches ? matches.length : 0);
    }, 0);

    console.log(`✅ ${path.relative(SRC_DIR, filePath)}: ${changeCount}개 변경됨`);
    return { processed: true, changes: changeCount };

  } catch (error) {
    console.error(`❌ ${filePath}: ${error.message}`);
    return { processed: false, changes: 0, error: error.message };
  }
}

function findTypeScriptFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // 무시할 디렉토리 체크
        if (entry.name === 'node_modules' || entry.name === '__tests__') {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        // TypeScript/TSX 파일만 포함, 테스트 파일 제외
        if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
            !entry.name.includes('.test.') &&
            !entry.name.includes('.spec.')) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

function main() {
  console.log('🔄 Console.log를 Logger 시스템으로 변환 시작...\n');

  // TypeScript/TSX 파일 찾기
  const files = findTypeScriptFiles(SRC_DIR);

  console.log(`📁 대상 파일: ${files.length}개\n`);

  let totalProcessed = 0;
  let totalChanges = 0;
  const errors = [];

  for (const file of files) {
    const result = processFile(file);

    if (result.processed) {
      totalProcessed++;
      totalChanges += result.changes;
    } else if (result.error) {
      errors.push({ file, error: result.error });
    }
  }

  console.log(`\n📊 변환 완료:`);
  console.log(`   - 처리된 파일: ${totalProcessed}개`);
  console.log(`   - 총 변경 사항: ${totalChanges}개`);

  if (errors.length > 0) {
    console.log(`   - 오류 발생: ${errors.length}개`);
    errors.forEach(({ file, error }) => {
      console.log(`     ❌ ${path.relative(SRC_DIR, file)}: ${error}`);
    });
  }

  console.log('\n✨ Console.log → Logger 변환 완료!');
}

// 스크립트 실행
if (require.main === module) {
  main();
}