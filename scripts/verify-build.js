#!/usr/bin/env node

/**
 * ✅ Vercel 빌드 검증 스크립트
 * 빌드 프로세스에서 API Routes와 환경변수를 검증
 * package.json의 build 스크립트에서 호출
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Starting Vercel build verification...\n');

// 1. API Routes 검증
function verifyApiRoutes() {
  console.log('📁 Verifying API Routes...');
  
  const apiDir = path.join(process.cwd(), 'src/app/api');
  let routeCount = 0;
  const routes = [];

  function scanRoutes(dir, relativePath = '') {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const relativeFilePath = path.join(relativePath, file);
        
        if (fs.statSync(fullPath).isDirectory()) {
          scanRoutes(fullPath, relativeFilePath);
        } else if (file === 'route.ts' || file === 'route.js') {
          routeCount++;
          const routePath = '/api/' + relativePath.replace(/\\/g, '/');
          routes.push(routePath);
        }
      }
    } catch (error) {
      console.error('❌ Cannot scan API routes:', error.message);
      process.exit(1);
    }
  }

  if (!fs.existsSync(apiDir)) {
    console.error('❌ API directory not found:', apiDir);
    process.exit(1);
  }

  scanRoutes(apiDir);
  
  console.log(`✅ Found ${routeCount} API routes:`);
  routes.slice(0, 5).forEach(route => console.log(`   ${route}`));
  if (routes.length > 5) {
    console.log(`   ... and ${routes.length - 5} more routes`);
  }
  console.log();

  return { count: routeCount, routes };
}

// 2. 필수 환경변수 검증 
function verifyEnvironmentVariables() {
  console.log('🔐 Verifying environment variables...');
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SENDGRID_API_KEY', 
    'NEXT_PUBLIC_APP_URL'
  ];

  const missingVars = [];
  const presentVars = [];

  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      presentVars.push(envVar);
    } else {
      missingVars.push(envVar);
    }
  }

  console.log(`✅ Present: ${presentVars.length}/${requiredEnvVars.length} required variables`);
  presentVars.forEach(envVar => console.log(`   ✓ ${envVar}`));
  
  if (missingVars.length > 0) {
    console.log(`⚠️  Missing: ${missingVars.length} variables`);
    missingVars.forEach(envVar => console.log(`   ✗ ${envVar}`));
    console.log('\n❌ Build verification failed: Missing required environment variables');
    console.log('💡 Please check your Vercel environment variables configuration');
    process.exit(1);
  }
  console.log();

  return { present: presentVars, missing: missingVars };
}

// 3. Next.js 설정 검증
function verifyNextConfig() {
  console.log('⚙️  Verifying Next.js configuration...');
  
  const configPath = path.join(process.cwd(), 'next.config.mjs');
  if (!fs.existsSync(configPath)) {
    console.error('❌ next.config.mjs not found');
    process.exit(1);
  }

  // 설정 파일 내용 검증
  const configContent = fs.readFileSync(configPath, 'utf-8');
  
  // standalone 모드가 활성화되어 있지 않은지 확인
  if (configContent.includes('output: \'standalone\'') && !configContent.includes('// output: \'standalone\'')) {
    console.error('❌ Standalone mode detected in next.config.mjs');
    console.error('💡 Standalone mode prevents API Routes from being deployed as Vercel Functions');
    process.exit(1);
  }

  console.log('✅ Next.js configuration is Vercel-compatible');
  console.log();
}

// 4. Vercel 설정 검증
function verifyVercelConfig() {
  console.log('🚀 Verifying Vercel configuration...');
  
  const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
  if (!fs.existsSync(vercelJsonPath)) {
    console.log('⚠️  vercel.json not found (using defaults)');
    return;
  }

  try {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
    
    // Functions 설정 확인
    if (vercelConfig.functions) {
      console.log('✅ Explicit functions configuration found');
      Object.keys(vercelConfig.functions).forEach(pattern => {
        console.log(`   📄 ${pattern}: ${vercelConfig.functions[pattern].runtime || 'default'}`);
      });
    } else {
      console.log('ℹ️  Using default function configuration');
    }
    
    console.log();
  } catch (error) {
    console.error('❌ Invalid vercel.json:', error.message);
    process.exit(1);
  }
}

// 5. 종합 리포트 생성
function generateReport(apiRoutes, envVars) {
  console.log('📊 Build Verification Summary');
  console.log('═'.repeat(40));
  console.log(`API Routes: ${apiRoutes.count} routes detected`);
  console.log(`Environment: ${envVars.present.length}/${envVars.present.length + envVars.missing.length} variables configured`);
  console.log(`Platform: Vercel Serverless Functions`);
  console.log(`Runtime: Node.js 20.x`);
  console.log(`Status: ✅ Ready for deployment`);
  console.log();
  
  // 빌드 메타데이터 생성
  const buildMeta = {
    timestamp: new Date().toISOString(),
    apiRoutesCount: apiRoutes.count,
    environmentReady: envVars.missing.length === 0,
    vercelOptimized: true,
    buildVerificationPassed: true
  };

  // .next 디렉토리가 없으면 생성
  const nextDir = path.join(process.cwd(), '.next');
  if (!fs.existsSync(nextDir)) {
    fs.mkdirSync(nextDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(nextDir, 'build-verification.json'),
    JSON.stringify(buildMeta, null, 2)
  );

  console.log('✅ Build verification completed successfully!');
}

// 메인 실행
try {
  const apiRoutes = verifyApiRoutes();
  const envVars = verifyEnvironmentVariables();
  verifyNextConfig();
  verifyVercelConfig();
  generateReport(apiRoutes, envVars);
} catch (error) {
  console.error('❌ Build verification failed:', error.message);
  process.exit(1);
}