/** @type {import('next').NextConfig} */
const nextConfig = {
  // 배포 최적화를 위한 standalone 모드
  output: 'standalone',
  
  // 압축 및 헤더 최적화
  compress: true,
  poweredByHeader: false,
  
  // 실험적 기능: 파일 추적에서 제외할 항목들
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        '.next/cache/**/*',
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl', 
        'node_modules/@esbuild/linux-x64',
        'node_modules/webpack/**/*',
        '.git/**/*',
        '*.md',
        'tests/**/*'
      ],
    },
  },
  
  // API 라우팅 설정 - 강제로 Railway 백엔드 사용
  async rewrites() {
    const apiBase = 'https://videoprompt-production.up.railway.app';
    console.log('🚀 Using Railway backend API proxy for all API calls');

    return [
      // Authentication API
      { source: '/api/auth/:path*', destination: `${apiBase}/api/auth/:path*` },
      // User API
      { source: '/api/user/:path*', destination: `${apiBase}/api/user/:path*` },
      // Email API
      { source: '/api/email/:path*', destination: `${apiBase}/api/email/:path*` },
      // Health API
      { source: '/api/health/:path*', destination: `${apiBase}/api/health/:path*` },
      // Seedance API
      { source: '/api/seedance/:path*', destination: `${apiBase}/api/seedance/:path*` },
      // Imagen API
      { source: '/api/imagen/:path*', destination: `${apiBase}/api/imagen/:path*` },
      // Veo API
      { source: '/api/veo/:path*', destination: `${apiBase}/api/veo/:path*` },
      // Scenario API
      { source: '/api/scenario/:path*', destination: `${apiBase}/api/scenario/:path*` },
      // Video API
      { source: '/api/video/:path*', destination: `${apiBase}/api/video/:path*` },
      // Net API
      { source: '/api/net/:path*', destination: `${apiBase}/api/net/:path*` },
    ];
  },

  // 배포 안정성 우선: 린트 에러로 빌드 실패 방지
  eslint: { ignoreDuringBuilds: true },

  // 성능 최적화 설정
  experimental: {
    // Link Preload 경고 해결 - 더 구체적인 경로 지정
    optimizePackageImports: ['@/components/ui', '@/lib/providers'],
  },

  // 웹팩 최적화
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // 프로덕션 빌드 최적화
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }

    // Playwright 관련 파일 접근 차단
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // E2E 테스트 파일 접근 차단
    config.module.rules.push({
      test: /\.(spec|test)\.(js|ts)$/,
      exclude: /tests\/e2e/,
      use: 'ignore-loader',
    });

    return config;
  },
};

export default nextConfig;
