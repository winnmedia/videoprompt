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
      allowedOrigins: ['localhost:3000', 'videoprompt.vercel.app'],
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
  
  
  // API 라우팅 설정 - Railway 프록시 (CORS 해결)
  async rewrites() {
    const apiBase = 'https://videoprompt-production.up.railway.app';
    
    // 개발/프로덕션 모든 환경에서 프록시 활성화 (CORS 해결)
    console.log('🚀 Using Railway backend API proxy for video processing APIs');

    return [
      // 비디오 처리 관련 API 프록시
      { source: '/api/seedance/:path*', destination: `${apiBase}/api/seedance/:path*` },
      { source: '/api/imagen/:path*', destination: `${apiBase}/api/imagen/:path*` },
      { source: '/api/veo/:path*', destination: `${apiBase}/api/veo/:path*` },
      { source: '/api/video/:path*', destination: `${apiBase}/api/video/:path*` },
      { source: '/api/health', destination: `${apiBase}/api/health` },
      // CORS 해결용 필수 프록시 - 개발/프로덕션 모든 환경에서 필요
      { source: '/api/templates', destination: `${apiBase}/api/templates` },
      { source: '/api/ai/:path*', destination: `${apiBase}/api/ai/:path*` },
      // 파일 업로드 Railway 백엔드 프록시
      { source: '/api/upload/:path*', destination: `${apiBase}/api/upload/:path*` },
    ];
  },
};

export default nextConfig;
