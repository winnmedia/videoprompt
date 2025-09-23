/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@supabase/supabase-js'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // 이미지 최적화 설정
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 86400, // 24시간 캐시
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // FSD 아키텍처를 위한 절대 경로 활성화
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': './src',
      '@/app': './src/app',
      '@/processes': './src/processes',
      '@/page-components': './src/page-components',
      '@/widgets': './src/widgets',
      '@/features': './src/features',
      '@/entities': './src/entities',
      '@/shared': './src/shared',
    };
    return config;
  },
  // $300 사건 방지를 위한 빌드 최적화
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 성능 최적화 설정
  experimental: {
    optimizeCss: true,
  },

  // Turbopack 설정 (안정화됨)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  // API 호출 제한 및 보안 헤더 통합
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'x-ratelimit-limit',
            value: '30', // 분당 30회 제한 - $300 사건 방지
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;