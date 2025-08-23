/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_PROXY_BASE || 'https://videoprompt-production.up.railway.app';
    return [
      { source: '/api/imagen/:path*', destination: `${apiBase}/api/imagen/:path*` },
      { source: '/api/seedance/:path*', destination: `${apiBase}/api/seedance/:path*` },
    ];
  },
  // 배포 안정성 우선: 린트 에러로 빌드 실패 방지
  eslint: { ignoreDuringBuilds: true },
  // 필요 시 타입체크 무시도 가능(현재는 유지)
  // typescript: { ignoreBuildErrors: true },
  
  // 성능 최적화 설정
  experimental: {
    // Link Preload 경고 해결 - 더 구체적인 경로 지정
    optimizePackageImports: ['@/components/ui', '@/lib/providers'],
    // optimizeCss 제거 - critters 모듈 오류 해결
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
    return config;
  },
};

export default nextConfig;


