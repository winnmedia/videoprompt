#!/usr/bin/env node
/**
 * Console 로그를 logger.debug()로 변환하는 스크립트
 * Phase 2: 로그 체계화 - console.error/warn → logger.debug 변환
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 설정
const TARGET_DIRS = ['src/app', 'src/shared', 'src/features', 'src/entities', 'src/widgets'];
const FILE_EXTENSIONS = ['.ts', '.tsx'];

console.log('🔧 Console 로그 → logger.debug 변환 시작');
console.log('==========================================');

// Git 백업 생성
function createGitBackup() {
  try {
    console.log('📦 Git 백업 생성 중...');
    execSync(`git stash push -m "Pre console-to-logger conversion $(date)"`);
    console.log('✅ Git stash 백업 완료');
  } catch (error) {
    console.warn('⚠️ Git 백업 실패, 계속 진행:', error.message);
  }
}

// 파일 변환
function convertConsoleToLogger(content) {
  let converted = content;
  let changes = 0;

  // console.error → logger.debug 변환
  const errorPattern = /console\.error\(/g;
  const errorMatches = content.match(errorPattern) || [];
  converted = converted.replace(errorPattern, 'logger.debug(');
  changes += errorMatches.length;

  // console.warn → logger.debug 변환
  const warnPattern = /console\.warn\(/g;
  const warnMatches = content.match(warnPattern) || [];
  converted = converted.replace(warnPattern, 'logger.debug(');
  changes += warnMatches.length;

  // console.info → logger.debug 변환
  const infoPattern = /console\.info\(/g;
  const infoMatches = content.match(infoPattern) || [];
  converted = converted.replace(infoPattern, 'logger.debug(');
  changes += infoMatches.length;

  // console.log → logger.debug 변환 (개발 모드에서만)
  const logPattern = /console\.log\(/g;
  const logMatches = content.match(logPattern) || [];
  converted = converted.replace(logPattern, 'logger.debug(');
  changes += logMatches.length;

  return { converted, changes };
}

// logger import 추가
function addLoggerImport(content) {
  // 이미 logger import가 있는지 확인
  if (content.includes("from './logger'") ||
      content.includes("from '../logger'") ||
      content.includes("from '../../logger'") ||
      content.includes("from '../../../logger'") ||
      content.includes("from '@/shared/lib/logger'")) {
    return content;
  }

  // 첫 번째 import 찾기
  const importMatch = content.match(/^import.*from.*$/m);
  if (importMatch) {
    const insertPos = content.indexOf(importMatch[0]) + importMatch[0].length;
    return content.slice(0, insertPos) +
           "\nimport { logger } from '@/shared/lib/logger';" +
           content.slice(insertPos);
  }

  // import가 없으면 파일 맨 앞에 추가
  return "import { logger } from '@/shared/lib/logger';\n\n" + content;
}

// 재귀적으로 파일 찾기
function findFiles(dir, extensions) {
  const files = [];

  function searchDir(currentDir) {
    try {
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
    } catch (error) {
      console.warn(`⚠️ ${currentDir} 읽기 실패:`, error.message);
    }
  }

  searchDir(dir);
  return files;
}

// 메인 실행
function main() {
  // Git 백업
  createGitBackup();

  let totalFiles = 0;
  let totalChanges = 0;
  let modifiedFiles = [];

  // 각 디렉토리 처리
  for (const targetDir of TARGET_DIRS) {
    if (!fs.existsSync(targetDir)) {
      console.log(`⏭️ ${targetDir} 존재하지 않음, 건너뜀`);
      continue;
    }

    console.log(`🔍 ${targetDir} 처리 중...`);
    const files = findFiles(targetDir, FILE_EXTENSIONS);
    totalFiles += files.length;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        // console.* 사용이 없으면 건너뜀
        if (!content.includes('console.')) {
          continue;
        }

        const result = convertConsoleToLogger(content);

        if (result.changes > 0) {
          // logger import 추가
          const withImport = addLoggerImport(result.converted);

          fs.writeFileSync(filePath, withImport, 'utf8');
          totalChanges += result.changes;
          modifiedFiles.push({
            file: filePath,
            changes: result.changes
          });

          console.log(`  ✨ ${filePath}: ${result.changes}개 변환`);
        }
      } catch (error) {
        console.error(`❌ ${filePath} 처리 실패:`, error.message);
      }
    }
  }

  // 결과 요약
  console.log('\n📊 변환 결과 요약');
  console.log('==================');
  console.log(`총 검사 파일: ${totalFiles}개`);
  console.log(`수정된 파일: ${modifiedFiles.length}개`);
  console.log(`변환된 console.*: ${totalChanges}개`);

  if (modifiedFiles.length > 0) {
    console.log('\n📝 수정된 파일 목록:');
    modifiedFiles
      .sort((a, b) => b.changes - a.changes)
      .slice(0, 15)
      .forEach(({ file, changes }) => {
        console.log(`  ${file}: ${changes}개`);
      });

    if (modifiedFiles.length > 15) {
      console.log(`  ... 및 ${modifiedFiles.length - 15}개 파일 더`);
    }
  }

  console.log('\n🎉 Console 로그 변환 완료!');
  console.log('💡 다음: git add . && git commit -m "refactor: Convert console.* to logger.debug()"');
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { convertConsoleToLogger, addLoggerImport };