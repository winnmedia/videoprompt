#!/usr/bin/env node

/**
 * Next.js 15 동적 라우트 파라미터 수정 스크립트
 * params가 Promise로 변경된 것에 대응
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/app/api/admin/video-assets/[id]/retry/route.ts',
  'src/app/api/shares/[token]/route.ts',
  'src/app/api/veo/status/[id]/route.ts',
  'src/app/api/planning/video-assets/[id]/route.ts',
  'src/app/api/video/status/[id]/route.ts',
  'src/app/api/templates/use/[id]/route.ts',
  'src/app/api/share/[token]/comment/route.ts',
  'src/app/api/share/[token]/route.ts',
  'src/app/api/seedance/status/[id]/route.ts',
  'src/app/api/seedance/status-debug/[id]/route.ts',
];

async function fixRouteFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Remove RouteContext interface
    const routeContextPattern = /interface RouteContext \{[\s\S]*?\}/;
    if (routeContextPattern.test(content)) {
      content = content.replace(routeContextPattern, '');
      modified = true;
    }

    // 2. Fix function signatures
    const patterns = [
      // Pattern 1: { params }: RouteContext
      {
        from: /, \{ params \}: RouteContext\)/g,
        to: ', { params }: { params: Promise<{ id: string }> })'
      },
      // Pattern 2: { params }: RouteContext
      {
        from: /\{ params \}: RouteContext\)/g,
        to: '{ params }: { params: Promise<{ id: string }> })'
      },
      // Pattern 3: token routes
      {
        from: /, \{ params \}: \{ params: \{ token: string \} \}\)/g,
        to: ', { params }: { params: Promise<{ token: string }> })'
      },
    ];

    patterns.forEach(({ from, to }) => {
      if (from.test(content)) {
        content = content.replace(from, to);
        modified = true;
      }
    });

    // 3. Fix params usage - add await
    const paramUsagePatterns = [
      {
        from: /const \{ (id|token) \} = params;/g,
        to: 'const { $1 } = await params;'
      }
    ];

    paramUsagePatterns.forEach(({ from, to }) => {
      if (from.test(content)) {
        content = content.replace(from, to);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  No changes needed: ${filePath}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

async function fixAllRoutes() {
  console.log('🔧 Fixing Next.js 15 dynamic route parameters...\n');

  let fixedCount = 0;
  let totalCount = 0;

  for (const filePath of filesToFix) {
    totalCount++;
    const wasFixed = await fixRouteFile(filePath);
    if (wasFixed) fixedCount++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Fixed: ${fixedCount} files`);
  console.log(`   📄 Total: ${totalCount} files`);
  
  if (fixedCount > 0) {
    console.log('\n🎉 Route parameters fixed for Next.js 15!');
  } else {
    console.log('\n✨ All files were already up to date.');
  }
}

// 스크립트 실행
fixAllRoutes().catch(console.error);