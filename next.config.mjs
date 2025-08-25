/** @type {import('next').NextConfig} */
const nextConfig = {
  // API 라우팅 설정 - 강제로 Railway 백엔드 사용
  async rewrites() {
    const apiBase = 'https://videoprompt-production.up.railway.app';
    console.log('🚀 Using Railway backend API proxy for all API calls');
    
    return [
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


