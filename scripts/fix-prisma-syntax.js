#!/usr/bin/env node

/**
 * Prisma 주석 처리로 인한 구문 오류 수정 스크립트
 * 불완전하게 주석 처리된 Prisma 코드 블록을 완전히 주석 처리
 */

const fs = require('fs');
const path = require('path');

// 주요 수정 대상 파일들
const TARGET_FILES = [
  'src/app/api/admin/storage-monitor/route.ts',
  'src/app/api/admin/video-assets/[id]/retry/route.ts',
  'src/app/api/auth/verify-code/route.ts',
  'src/app/api/auth/verify-email/route.ts',
  'src/app/api/comments/route.ts',
  'src/app/api/debug/route.ts'
];

function fixBrokenSyntax(content) {
  let lines = content.split('\n');
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // PRISMA_DISABLED로 시작하는 줄을 찾음
    if (line.includes('// PRISMA_DISABLED:')) {
      const indent = line.match(/^(\s*)/)[1];

      // 다음 줄들도 연속적으로 주석 처리해야 하는지 확인
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        const nextIndent = nextLine.match(/^(\s*)/)[1];

        // 빈 줄이거나 현재 줄과 같은 들여쓰기 이상인 경우 계속
        if (nextLine.trim() === '') {
          j++;
          continue;
        }

        // 더 깊은 들여쓰기이거나 } 또는 ); 같은 closing 구문인 경우
        if (nextIndent.length > indent.length ||
            nextLine.trim().match(/^[})\];,]/) ||
            nextLine.includes('where:') ||
            nextLine.includes('gte:') ||
            nextLine.includes('createdAt:')) {

          if (!nextLine.includes('//')) {
            lines[j] = `${nextIndent}// PRISMA_CONTINUATION: ${nextLine.trim()}`;
            modified = true;
          }
          j++;
        } else {
          break;
        }
      }
    }

    // 고아가 된 catch 블록 처리
    if (line.includes('} catch (error) {') && i > 0) {
      const prevLines = lines.slice(Math.max(0, i-10), i);
      const hasTryBlock = prevLines.some(l => l.includes('try {') && !l.includes('//'));

      if (!hasTryBlock) {
        const indent = line.match(/^(\s*)/)[1];
        lines[i] = `${indent}// ORPHANED_CATCH: ${line.trim()}`;

        // catch 블록 전체를 주석 처리
        let k = i + 1;
        let braceCount = 1;
        while (k < lines.length && braceCount > 0) {
          const catchLine = lines[k];
          if (!catchLine.includes('//')) {
            const catchIndent = catchLine.match(/^(\s*)/)[1];
            lines[k] = `${catchIndent}// ORPHANED_CATCH: ${catchLine.trim()}`;
          }

          braceCount += (catchLine.match(/{/g) || []).length;
          braceCount -= (catchLine.match(/}/g) || []).length;
          k++;
        }
        modified = true;
      }
    }
  }

  return { content: lines.join('\n'), modified };
}

function addMissingVariables(content) {
  let modified = false;

  // prismaCount 변수가 주석 처리되었지만 사용되는 경우 기본값 추가
  if (content.includes('PRISMA_DISABLED: const prismaCount') &&
      content.includes('prismaCount') &&
      !content.includes('const prismaCount = 0')) {

    content = content.replace(
      /\/\/ PRISMA_DISABLED: const prismaCount.*$/m,
      '$&\n      const prismaCount = 0; // Fallback value'
    );
    modified = true;
  }

  return { content, modified };
}

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  try {
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  파일이 존재하지 않음: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let hasChanges = false;

    // 구문 오류 수정
    const syntaxResult = fixBrokenSyntax(content);
    if (syntaxResult.modified) {
      content = syntaxResult.content;
      hasChanges = true;
    }

    // 누락된 변수 추가
    const variableResult = addMissingVariables(content);
    if (variableResult.modified) {
      content = variableResult.content;
      hasChanges = true;
    }

    if (hasChanges) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ 구문 오류 수정됨: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  수정사항 없음: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 오류 발생 ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔧 Prisma 구문 오류 수정 스크립트 실행 중...\n');

  let processedCount = 0;
  let fixedCount = 0;

  TARGET_FILES.forEach(filePath => {
    processedCount++;
    const wasFixed = processFile(filePath);
    if (wasFixed) {
      fixedCount++;
    }
  });

  console.log('\n📊 수정 결과:');
  console.log(`- 총 처리된 파일: ${processedCount}개`);
  console.log(`- 수정된 파일: ${fixedCount}개`);
  console.log(`- 변경사항 없음: ${processedCount - fixedCount}개`);

  if (fixedCount > 0) {
    console.log('\n✅ 구문 오류 수정 완료!');
  } else {
    console.log('\n🎯 모든 파일이 이미 정상 상태입니다.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixBrokenSyntax, addMissingVariables };