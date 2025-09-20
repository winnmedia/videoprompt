#!/usr/bin/env node

/**
 * 모든 잘못된 import 문을 수정하는 포괄적 스크립트
 * TypeScript 컴파일 차단 오류 해결
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 변환 통계
let stats = {
  filesProcessed: 0,
  filesFixed: 0,
  errors: 0
};

/**
 * 잘못된 import 문을 수정
 */
function fixBrokenImports(content, filePath) {
  let fixed = content;
  let changed = false;

  // 패턴 1: import { 바로 뒤에 logger import가 삽입된 경우
  const pattern1 = /import\s*\{\s*\nimport\s*\{\s*logger\s*\}\s*from\s*['"`][^'"`]*['"`];\s*\n/g;
  if (pattern1.test(content)) {
    fixed = fixed.replace(pattern1, (match) => {
      changed = true;
      const loggerImportMatch = match.match(/import\s*\{\s*logger\s*\}\s*from\s*['"`][^'"`]*['"`];/);
      if (loggerImportMatch) {
        return loggerImportMatch[0] + '\nimport {\n';
      }
      return match;
    });
  }

  // 패턴 2: 복잡한 import 블록 내부에 logger가 삽입된 경우
  const pattern2 = /import\s*\{[^}]*\nimport\s*\{\s*logger\s*\}\s*from\s*['"`][^'"`]*['"`];\s*\n\s*([^}]*)\}/g;
  if (pattern2.test(fixed)) {
    fixed = fixed.replace(pattern2, (match) => {
      changed = true;
      const loggerImportMatch = match.match(/import\s*\{\s*logger\s*\}\s*from\s*['"`][^'"`]*['"`];/);
      if (!loggerImportMatch) return match;

      const loggerImport = loggerImportMatch[0];
      let cleanedImport = match
        .replace(loggerImport, '')
        .replace(/import\s*\{([^}]*)\n\s*([^}]*)\}/g, 'import {$1$2}')
        .trim();

      return loggerImport + '\n' + cleanedImport;
    });
  }

  // 패턴 3: 단순한 잘못된 import 블록
  const pattern3 = /import\s*\{[^}]*import\s*\{\s*logger\s*\}[^}]*\}/g;
  if (pattern3.test(fixed)) {
    fixed = fixed.replace(pattern3, (match) => {
      changed = true;
      console.log(`  Complex import pattern found in ${filePath}`);

      // 수동으로 처리해야 할 복잡한 경우들
      const loggerImportMatch = match.match(/import\s*\{\s*logger\s*\}\s*from\s*['"`][^'"`]*['"`];?/);
      if (loggerImportMatch) {
        let loggerImport = loggerImportMatch[0];
        if (!loggerImport.endsWith(';')) loggerImport += ';';

        // logger import 제거하고 나머지 정리
        let cleanedMatch = match.replace(/import\s*\{\s*logger\s*\}\s*from\s*['"`][^'"`]*['"`];?\s*\n?/, '');

        return loggerImport + '\n' + cleanedMatch;
      }

      return match;
    });
  }

  return { content: fixed, changed };
}

/**
 * TypeScript 에러로 문제가 있는 파일들 찾기
 */
function findProblematicFiles() {
  try {
    // TypeScript 컴파일러로 에러가 있는 파일들 찾기
    const result = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8' });
    const lines = result.split('\n');

    const files = new Set();
    lines.forEach(line => {
      if (line.includes('error TS1003') || line.includes('error TS1005') || line.includes('error TS1128')) {
        const match = line.match(/^([^(]+)\(/);
        if (match) {
          files.add(match[1]);
        }
      }
    });

    return Array.from(files);
  } catch (error) {
    console.log('TypeScript 에러가 있는 파일들을 찾는 중...');
    const output = error.stdout || error.stderr || '';
    const lines = output.split('\n');

    const files = new Set();
    lines.forEach(line => {
      if (line.includes('error TS1003') || line.includes('error TS1005') || line.includes('error TS1128')) {
        const match = line.match(/^([^(]+)\(/);
        if (match) {
          files.add(match[1]);
        }
      }
    });

    return Array.from(files);
  }
}

/**
 * 파일 처리
 */
function processFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);

    if (!fs.existsSync(fullPath)) {
      console.log(`⏭️  Skipping: ${filePath} (not found)`);
      return;
    }

    console.log(`Processing: ${filePath}`);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const { content: fixedContent, changed } = fixBrokenImports(content, filePath);

    if (changed) {
      fs.writeFileSync(fullPath, fixedContent, 'utf-8');
      console.log(`  ✅ Fixed broken imports`);
      stats.filesFixed++;
    } else {
      console.log(`  ⏭️  No broken imports found`);
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
  console.log('🔧 모든 잘못된 import 문 수정 시작...\n');

  // TypeScript 에러가 있는 파일들 찾기
  const problematicFiles = findProblematicFiles();

  if (problematicFiles.length === 0) {
    console.log('✅ TypeScript 컴파일 에러가 있는 파일을 찾지 못했습니다.');
    return;
  }

  console.log(`📁 TypeScript 에러가 있는 파일: ${problematicFiles.length}개\n`);

  // 파일들 처리
  problematicFiles.forEach(processFile);

  // 결과 출력
  console.log('\n📊 수정 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📁 처리된 파일: ${stats.filesProcessed}개`);
  console.log(`🔧 수정된 파일: ${stats.filesFixed}개`);
  console.log(`❌ 오류: ${stats.errors}개`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (stats.errors > 0) {
    console.log('\n⚠️  일부 파일 처리에 실패했습니다. 수동으로 확인해주세요.');
    process.exit(1);
  } else {
    console.log('\n✅ 모든 파일이 성공적으로 처리되었습니다!');
    console.log('\n📋 다음 단계:');
    console.log('   1. npx tsc --noEmit 실행하여 TypeScript 에러 해결 확인');
    console.log('   2. TypeScript strict 모드 활성화');
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { fixBrokenImports, processFile };