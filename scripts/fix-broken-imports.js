#!/usr/bin/env node

/**
 * 잘못된 위치에 삽입된 logger import를 수정하는 스크립트
 * console.log 변환 스크립트로 인해 발생한 구문 오류 수정
 */

const fs = require('fs');
const path = require('path');

// 구문 오류가 있는 파일들
const BROKEN_FILES = [
  'src/app/api/ai/generate-story/route.ts',
  'src/app/api/ai/generate-storyboard/route.ts',
  'src/app/api/planning/scenarios/route.ts',
  'src/app/api/seedance/create/route.ts',
  'src/app/api/seedance/status/[jobId]/route.ts',
  'src/app/api/seedream/create/route.ts',
  'src/app/api/seedream/status/[id]/route.ts',
  'src/app/integrations/page.tsx',
  'src/app/prompt-generator/page.tsx',
  'src/app/scenario/page.tsx',
  'src/app/wizard/page.tsx',
  'src/entities/planning/infrastructure/supabase-repository.ts',
  'src/entities/planning/model/planning-storage.slice.ts',
  'src/entities/planning/model/services.ts',
  'src/entities/seedance/hooks/use-seedance-provider.ts',
];

// 변환 통계
let stats = {
  filesProcessed: 0,
  filesFixed: 0,
  errors: 0
};

/**
 * 잘못된 import 문을 수정
 */
function fixBrokenImports(content) {
  // 패턴: import { 뒤에 logger import가 삽입된 경우
  const brokenPattern = /import\s*\{[^}]*\nimport\s*\{\s*logger\s*\}\s*from\s*['"`][^'"`]*['"`];\s*\n\s*([^}]*)\}/g;

  let fixed = content.replace(brokenPattern, (match) => {
    // logger import 추출
    const loggerImportMatch = match.match(/import\s*\{\s*logger\s*\}\s*from\s*['"`][^'"`]*['"`];/);
    if (!loggerImportMatch) return match;

    const loggerImport = loggerImportMatch[0];

    // 나머지 import 블록 재구성
    const cleanedImport = match
      .replace(loggerImport, '')
      .replace(/import\s*\{([^}]*)\n\s*([^}]*)\}/g, 'import {$1$2}')
      .trim();

    return loggerImport + '\n' + cleanedImport;
  });

  // 더 단순한 패턴: import { 바로 뒤에 logger가 온 경우
  const simplePattern = /import\s*\{\s*\nimport\s*\{\s*logger\s*\}\s*from\s*['"`][^'"`]*['"`];\s*\n/g;

  fixed = fixed.replace(simplePattern, (match) => {
    const loggerImportMatch = match.match(/import\s*\{\s*logger\s*\}\s*from\s*['"`][^'"`]*['"`];/);
    if (!loggerImportMatch) return match;

    return loggerImportMatch[0] + '\nimport {\n';
  });

  return fixed;
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
    const originalContent = content;

    // import 문 수정
    const fixedContent = fixBrokenImports(content);

    if (fixedContent !== originalContent) {
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
  console.log('🔧 잘못된 import 문 수정 시작...\n');

  // 파일들 처리
  BROKEN_FILES.forEach(processFile);

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
    console.log('   1. pnpm run lint 실행하여 구문 오류 해결 확인');
    console.log('   2. 나머지 ESLint 위반 사항 수정');
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { fixBrokenImports, processFile };