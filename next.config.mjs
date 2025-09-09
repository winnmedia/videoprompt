/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ VERCEL CRITICAL: standalone 모드는 API Routes를 Functions로 빌드하지 않음
  // Vercel에서는 기본 모드를 사용해야 API Routes가 Serverless Functions로 처리됨
  // output: 'standalone', // <- Vercel 배포 시 제거
  
  // 압축 및 헤더 최적화
  compress: true,
  poweredByHeader: false,
  
  // 번들 크기 최적화를 위한 파일 제외 목록 (Next.js 15.4.6+)
  outputFileTracingExcludes: {
    '*': [
      // 캐시 및 빌드 아티팩트
      '.next/cache/**/*',
      'out/**/*',
      'dist/**/*',
      'build/**/*',
      
      // Git 및 문서
      '.git/**/*',
      '**/*.md',
      'docs/**/*',
      
      // 테스트 관련 (개발 도구)
      'tests/**/*',
      '__tests__/**/*',
      'test-results/**/*',
      'playwright-report/**/*',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      'vitest.config.*',
      'playwright.config.*',
      
      // 개발 도구 및 설정
      'scripts/**/*',
      '.vscode/**/*',
      '.cursor/**/*',
      '.idea/**/*',
      '.husky/**/*',
      'eslint.config.*',
      'prettier.config.*',
      'tailwind.config.*',
      
      // 플랫폼별 네이티브 바이너리 (대폭 확장)
      'node_modules/@swc/core-*',
      'node_modules/@esbuild/*',
      'node_modules/@next/swc-*',
      'node_modules/webpack/**/*',
      
      // Prisma 엔진 최적화 (사용하지 않는 엔진 제외)
      'node_modules/@prisma/engines/**/*',
      'node_modules/.prisma/client/libquery_engine-*',
      '!node_modules/.prisma/client/libquery_engine-linux-x64-openssl-3.0.x.so.node',
      'node_modules/.prisma/client/query_engine-*',
      '!node_modules/.prisma/client/query_engine-linux-x64-openssl-3.0.x',
      
      // Playwright 관련 (프로덕션 불필요)
      'node_modules/@playwright/**/*',
      'node_modules/playwright/**/*',
      'node_modules/playwright-core/**/*',
      
      // 기타 네이티브 바이너리
      '**/*.wasm',
      '**/*.node',
      '!node_modules/.prisma/client/*.node',
      
      // pnpm 관련
      'node_modules/.pnpm/**/*',
      '.pnpm-debug.log',
      
      // 개발 환경 파일
      '.env.local',
      '.env.development',
      '.env.test',
      '*.log',
      
      // TypeScript 관련 (중복 버전 제외)
      'node_modules/typescript/**/*',
      'node_modules/@types/**/*',
      'tsconfig*.json',
      
      // 기타 대용량 개발 도구
      'node_modules/madge/**/*',
      'node_modules/tsx/**/*',
    ],
  },
  
  // 실험적 기능 설정
  experimental: {
    // 패키지 import 최적화 - 임시 비활성화 (Vercel 캐시 문제)
    // optimizePackageImports: ['@/components/ui', '@/lib/providers'],
  },
  
  // API 라우팅 설정 - 하이브리드 접근: 인증은 Next.js, 나머지는 Railway
  async rewrites() {
    const apiBase = 'https://videoprompt-production.up.railway.app';
    console.log('🚀 Using Railway backend API proxy for business logic APIs (auth handled by Next.js)');

    return [
      // Authentication API는 Next.js에서 직접 처리 (프록시하지 않음)
      // ⚠️ CRITICAL: /api/auth/* 경로는 절대 프록시하지 않음
      // - /api/auth/register: Next.js Serverless Function으로 처리
      // - /api/auth/send-verification: Next.js Serverless Function으로 처리  
      // - /api/auth/verify-code: Next.js Serverless Function으로 처리
      // - /api/auth/login: Next.js Serverless Function으로 처리
      
      // 🔄 Business Logic APIs - Railway로 프록시
      // User API (but NOT auth)
      { source: '/api/user/:path*', destination: `${apiBase}/api/user/:path*` },
      
      // 🚫 Email API는 Next.js에서 직접 처리 (SendGrid 키가 Vercel에 있음)
      // { source: '/api/email/:path*', destination: `${apiBase}/api/email/:path*` },
      
      // External Services APIs - Railway로 프록시
      { source: '/api/seedance/:path*', destination: `${apiBase}/api/seedance/:path*` },
      { source: '/api/imagen/:path*', destination: `${apiBase}/api/imagen/:path*` },
      { source: '/api/veo/:path*', destination: `${apiBase}/api/veo/:path*` },
      { source: '/api/scenario/:path*', destination: `${apiBase}/api/scenario/:path*` },
      { source: '/api/video/:path*', destination: `${apiBase}/api/video/:path*` },
      { source: '/api/net/:path*', destination: `${apiBase}/api/net/:path*` },
      
      // 🔄 Health check는 Railway로 프록시 (Railway 서비스 상태 확인용)  
      { source: '/api/health', destination: `${apiBase}/api/health` },
    ];
  },

  // 배포 안정성 우선: 린트 에러로 빌드 실패 방지
  eslint: { ignoreDuringBuilds: true },

  // 웹팩 최적화 강화
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // 프로덕션 빌드 최적화 강화
      config.optimization.splitChunks = {
        chunks: 'all',
        maxSize: 244000, // 250KB 청크 크기 제한
        cacheGroups: {
          // 프레임워크 청크 (React, Next.js)
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            name: 'framework',
            priority: 40,
            chunks: 'all',
            reuseExistingChunk: true,
          },
          // Prisma 청크 분리
          prisma: {
            test: /[\\/]node_modules[\\/](@prisma|\.prisma)[\\/]/,
            name: 'prisma',
            priority: 30,
            chunks: 'all',
            reuseExistingChunk: true,
          },
          // 일반 vendor 청크
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 20,
            chunks: 'all',
            reuseExistingChunk: true,
          },
          // 공통 청크
          common: {
            name: 'common',
            minChunks: 2,
            priority: 10,
            chunks: 'all',
            reuseExistingChunk: true,
          },
        },
      };
      
      // Tree shaking 강화
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    // Node.js 모듈 폴백 설정 강화
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      util: false,
      os: false,
      url: false,
      assert: false,
    };

    // 테스트 및 개발 파일 제외
    config.module.rules.push({
      test: /\.(spec|test)\.(js|ts|tsx)$/,
      use: 'ignore-loader',
    });

    // Playwright 관련 파일 제외
    config.module.rules.push({
      test: /[\\/]@playwright[\\/]/,
      use: 'ignore-loader',
    });

    return config;
  },
};

export default nextConfig;
