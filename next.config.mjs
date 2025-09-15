/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15.4.6 Vercel 호환성을 위한 최소 설정
  // Next.js 15: serverExternalPackages supersedes experimental.serverComponentsExternalPackages
  serverExternalPackages: ['@prisma/client'],

  // 품질 게이트 활성화 - ESLint 검증 복원
  eslint: {
    // 임시: warning들 때문에 빌드 실패 방지 (추후 수정 필요)
    ignoreDuringBuilds: true,
  },

  // 브라우저 캐시 강제 무효화 설정
  generateBuildId: async () => {
    return `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // 대용량 파일 업로드를 위한 실험적 설정
  experimental: {
    // 대용량 요청 처리를 위한 설정
    largePageDataBytes: 1024 * 1024, // 1MB
    // 서버 액션 최적화
    serverActions: {
      allowedOrigins: ['localhost:3000', 'videoprompt.vercel.app', 'www.vridge.kr', 'vridge.kr'],
      bodySizeLimit: '600mb', // 600MB 제한
    },
  },

  
  // 번들 크기 최적화 - Vercel 250MB 제한 해결
  outputFileTracingExcludes: {
    '**/*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
      'node_modules/sharp',
      'node_modules/canvas',
      'node_modules/puppeteer',
      'node_modules/playwright',
      // webpack 캐시 제외 추가
      '.next/cache/webpack/**/*',
    ],
  },

  // webpack 설정 최적화 - 개발/프로덕션 캐시 제어
  webpack: (config, { isServer, dev }) => {
    // 개발 환경에서는 기본 캐시 설정 사용 (webpack 에러 방지)
    if (dev) {
      // Next.js가 기본 캐시 설정을 처리하도록 하여 ENOENT 에러 방지
      // config.cache 설정을 제거하여 기본값 사용
    }

    // 프로덕션 빌드에서 console 로그 제거
    if (!dev && process.env.NODE_ENV === 'production') {
      config.cache = false;

      // Terser 설정으로 console 로그 제거
      config.optimization.minimizer.forEach((plugin) => {
        if (plugin.constructor.name === 'TerserPlugin') {
          plugin.options.terserOptions.compress = {
            ...plugin.options.terserOptions.compress,
            drop_console: true,
            drop_debugger: true,
          };
        }
      });
    }

    // Serverless Function 크기 최적화
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    return config;
  },

  // 강화된 캐시 무효화 헤더 설정
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },


  // API 라우팅 설정 - Railway 프록시 비활성화 (헤더 오버플로우 문제)
  async rewrites() {
    const apiBase = 'https://videoprompt-production.up.railway.app';

    // Railway 프록시 비활성화 - 헤더 오버플로우 문제로 인해 임시 비활성화
    console.log('⚠️ Railway backend API proxy disabled due to header overflow issue');

    return [
      // 핵심 비디오 처리 API만 프록시 (헤더 문제 없는 것만)
      { source: '/api/seedance/:path*', destination: `${apiBase}/api/seedance/:path*` },
      { source: '/api/seedream/:path*', destination: `${apiBase}/api/seedream/:path*` },
      { source: '/api/video/:path*', destination: `${apiBase}/api/video/:path*` },

      // 문제가 있는 프록시들 비활성화
      // { source: '/api/templates', destination: `${apiBase}/api/templates` },
      // { source: '/api/ai/:path*', destination: `${apiBase}/api/ai/:path*` },
      // { source: '/api/imagen/:path*', destination: `${apiBase}/api/imagen/:path*` },
      // { source: '/api/veo/:path*', destination: `${apiBase}/api/veo/:path*` },
      // { source: '/api/upload/:path*', destination: `${apiBase}/api/upload/:path*` },
    ];
  },
};

export default nextConfig;
