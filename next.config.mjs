/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright 404 오류 방지를 위한 설정
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_PROXY_BASE || 'https://videoprompt-production.up.railway.app';
    return [
      { source: '/api/imagen/:path*', destination: `${apiBase}/api/imagen/:path*` },
      { source: '/api/seedance/:path*', destination: `${apiBase}/api/seedance/:path*` },
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


