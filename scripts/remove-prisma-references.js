#!/usr/bin/env node

/**
 * Prisma 참조 제거 스크립트
 * 51개 파일에서 Prisma 관련 코드를 주석 처리하거나 Supabase로 전환
 */

const fs = require('fs');
const path = require('path');

// Prisma 참조가 있는 파일들
const PRISMA_FILES = [
  'src/shared/lib/user-sync.service.ts',
  'src/shared/services/dual-storage-engine.service.ts',
  'src/entities/planning/model/services.ts',
  'src/app/api/planning/scenarios/route.ts',
  'src/app/api/admin/storage-monitor/route.ts',
  'src/app/api/auth/verify-code/route.ts',
  'src/app/api/debug/route.ts',
  'src/app/api/projects/[id]/route.ts',
  'src/app/api/projects/route.ts',
  'src/entities/planning/infrastructure/dual-storage-factory.ts',
  'src/shared/lib/auth.ts',
  'src/app/api/planning/dashboard/route.ts',
  'src/app/api/auth/register/route-legacy.ts',
  'src/app/api/planning/video-assets/route.ts',
  'src/app/api/queue/list/route-legacy.ts',
  'src/app/api/queue/cancel/[id]/route.ts',
  'src/app/api/queue/retry/[id]/route-legacy.ts',
  'src/app/api/auth/get-verification-code/route.ts',
  'src/app/api/auth/user-status/route.ts',
  'src/app/api/auth/verification-status/route.ts',
  'src/app/api/auth/user-details/route.ts',
  'src/app/api/auth/login/route-legacy.ts',
  'src/app/api/auth/expire-verification-code/route.ts',
  'src/app/api/auth/me/route-legacy.ts',
  'src/app/api/auth/verify-email/route.ts',
  'src/app/api/auth/verify-email-direct/route.ts',
  'src/app/api/templates/[id]/route.ts',
  'src/app/api/planning/stories/route.ts',
  'src/app/api/planning/register/route.ts',
  'src/app/api/planning/videos/route.ts',
  'src/app/api/planning/video-assets/[id]/route.ts',
  'src/app/api/health/route.ts',
  'src/app/api/comments/route.ts',
  'src/app/api/test/cleanup-user/route.ts',
  'src/app/api/test/route.ts',
  'src/app/api/shares/route.ts',
  'src/app/api/shares/[token]/route.ts',
  'src/app/api/admin/video-assets/[id]/retry/route.ts',
  'src/shared/infrastructure/planning-repository.ts'
];

// Prisma 패턴들
const PRISMA_PATTERNS = [
  /^(\s*)(.*)prisma\.(.*)$/gm,
  /^(\s*)(.*)await prisma\.(.*)$/gm,
  /^(\s*)(.*)const.*prisma\.(.*)$/gm,
  /^(\s*)(.*)return prisma\.(.*)$/gm,
  /^(\s*)(.*)= prisma\.(.*)$/gm
];

function commentOutPrismaLines(content) {
  let modifiedContent = content;
  let hasChanges = false;

  PRISMA_PATTERNS.forEach(pattern => {
    modifiedContent = modifiedContent.replace(pattern, (match, indent, prefix, suffix) => {
      // 이미 주석 처리된 경우 스킵
      if (prefix.trim().startsWith('//')) {
        return match;
      }

      hasChanges = true;
      return `${indent}// PRISMA_DISABLED: ${prefix.trim()}prisma.${suffix}`;
    });
  });

  return { content: modifiedContent, hasChanges };
}

function addSupabaseImportIfNeeded(content) {
  // 이미 Supabase import가 있는지 확인
  if (content.includes("from '@/shared/lib/supabase-safe'") ||
      content.includes("getSupabaseClientSafe")) {
    return content;
  }

  // Prisma 관련 import가 있는 경우 Supabase import 추가
  if (content.includes('prisma.')) {
    const lines = content.split('\n');
    const importIndex = lines.findIndex(line => line.includes('import') && !line.includes('//'));

    if (importIndex !== -1) {
      lines.splice(importIndex + 1, 0, "import { getSupabaseClientSafe } from '@/shared/lib/supabase-safe';");
      return lines.join('\n');
    }
  }

  return content;
}

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  try {
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  파일이 존재하지 않음: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const { content: modifiedContent, hasChanges } = commentOutPrismaLines(content);

    if (hasChanges) {
      const finalContent = addSupabaseImportIfNeeded(modifiedContent);
      fs.writeFileSync(fullPath, finalContent, 'utf8');
      console.log(`✅ 수정됨: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  변경사항 없음: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 오류 발생 ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔄 Prisma 참조 제거 스크립트 실행 중...\n');

  let processedCount = 0;
  let modifiedCount = 0;

  PRISMA_FILES.forEach(filePath => {
    processedCount++;
    const wasModified = processFile(filePath);
    if (wasModified) {
      modifiedCount++;
    }
  });

  console.log('\n📊 처리 결과:');
  console.log(`- 총 처리된 파일: ${processedCount}개`);
  console.log(`- 수정된 파일: ${modifiedCount}개`);
  console.log(`- 건너뛴 파일: ${processedCount - modifiedCount}개`);

  if (modifiedCount > 0) {
    console.log('\n✅ Prisma 참조 제거 완료!');
    console.log('⚠️  주의: 주석 처리된 Prisma 코드는 Supabase로 마이그레이션이 필요합니다.');
  } else {
    console.log('\n🎯 모든 파일이 이미 정리되어 있습니다.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { processFile, commentOutPrismaLines };