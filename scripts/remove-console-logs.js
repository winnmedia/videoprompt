#!/usr/bin/env node
/**
 * Console Log 제거 스크립트
 * Phase 1: 즉시 안정화 - 3000+ console.log 노이즈 제거
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 설정
const SRC_DIR = 'src';
const BACKUP_BRANCH = 'backup-console-logs';
const FILE_PATTERNS = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];

console.log('🧹 Console Log 제거 스크립트 시작');
console.log('==================================');

// Git 백업 생성
function createGitBackup() {
  try {
    console.log('📦 Git 백업 생성 중...');
    execSync(`git stash push -m "Pre console-log-removal backup $(date)"`);
    console.log('✅ Git stash 백업 완료');
  } catch (error) {
    console.warn('⚠️ Git 백업 실패, 계속 진행:', error.message);
  }
}

// 파일에서 console.log 제거
function removeConsoleLogLines(content) {
  const lines = content.split('\n');
  let removedCount = 0;

  // 제거할 console 패턴들
  const consoleLogPatterns = [
    /^\s*console\.log\s*\([^;]*\);?\s*$/,  // 단독 console.log 라인
    /^\s*console\.log\s*\([^;]*\);\s*\/\/.*$/,  // 주석이 있는 console.log
    /^\s*console\.info\s*\([^;]*\);?\s*$/,  // console.info도 제거
  ];

  const filteredLines = lines.filter(line => {
    const isConsoleLog = consoleLogPatterns.some(pattern => pattern.test(line));
    if (isConsoleLog) {
      removedCount++;
      return false;
    }
    return true;
  });

  return {
    transformed: filteredLines.join('\n'),
    changes: removedCount
  };
}

// 재귀적으로 파일 찾기
function findFiles(dir, extensions) {
  const files = [];

  function searchDir(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // node_modules, .git 등 제외
        if (!item.startsWith('.') && item !== 'node_modules') {
          searchDir(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  searchDir(dir);
  return files;
}

// 메인 실행
function main() {
  // Git 백업
  createGitBackup();

  // 파일 검색
  console.log(`🔍 ${SRC_DIR}에서 파일 검색 중...`);
  const files = findFiles(SRC_DIR, ['.ts', '.tsx', '.js', '.jsx']);
  console.log(`📁 ${files.length}개 파일 발견`);

  let totalRemoved = 0;
  let processedFiles = 0;
  const modifiedFiles = [];

  // 각 파일 처리
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const result = removeConsoleLogLines(content);

      if (result.changes > 0) {
        fs.writeFileSync(filePath, result.transformed, 'utf8');
        totalRemoved += result.changes;
        processedFiles++;
        modifiedFiles.push({
          file: filePath,
          removed: result.changes
        });

        console.log(`  ✨ ${filePath}: ${result.changes}개 라인 제거`);
      }
    } catch (error) {
      console.error(`❌ ${filePath} 처리 실패:`, error.message);
    }
  }

  // 결과 요약
  console.log('\n📊 처리 결과 요약');
  console.log('==================');
  console.log(`총 검사 파일: ${files.length}개`);
  console.log(`수정된 파일: ${processedFiles}개`);
  console.log(`제거된 console.log: ${totalRemoved}개`);

  if (modifiedFiles.length > 0) {
    console.log('\n📝 수정된 파일 목록:');
    modifiedFiles
      .sort((a, b) => b.removed - a.removed)
      .slice(0, 10)  // 상위 10개만 표시
      .forEach(({ file, removed }) => {
        console.log(`  ${file}: ${removed}개`);
      });

    if (modifiedFiles.length > 10) {
      console.log(`  ... 및 ${modifiedFiles.length - 10}개 파일 더`);
    }
  }

  // 검증 실행
  console.log('\n🔍 변경사항 검증 중...');
  try {
    execSync('pnpm run type-check', { stdio: 'pipe' });
    console.log('✅ TypeScript 컴파일 검증 통과');
  } catch (error) {
    console.log('⚠️ TypeScript 오류 발견 - 다음 단계에서 수정 예정');
  }

  console.log('\n🎉 Console log 제거 완료!');
  console.log('💡 다음: git add . && git commit -m "cleanup: Remove console.log noise"');
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { removeConsoleLogLines, findFiles };