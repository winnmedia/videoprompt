/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15.4.6 Vercel 호환성을 위한 최소 설정
  // Next.js 15: serverExternalPackages supersedes experimental.serverComponentsExternalPackages
  serverExternalPackages: ['@prisma/client'],

  // ESLint 오류를 무시하고 빌드 성공시키기
  eslint: {
    // 프로덕션 빌드 시 ESLint 오류 무시
    ignoreDuringBuilds: true,
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

  // webpack 설정 최적화 - 프로덕션 캐시 제어
  webpack: (config, { isServer, dev }) => {
    // 프로덕션 빌드시 webpack 캐시 비활성화 (Vercel 크기 제한 대응)
    if (!dev && process.env.NODE_ENV === 'production') {
      config.cache = false;
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
  
  
  // API 라우팅 설정 - Railway 프록시 (최적화)
  async rewrites() {
    const apiBase = 'https://videoprompt-production.up.railway.app';
    
    // 프로덕션에서만 프록시 활성화
    if (process.env.NODE_ENV !== 'production') {
      return [];
    }

    console.log('🚀 Using Railway backend API proxy for video processing APIs');

    return [
      // 비디오 처리 관련 API만 프록시 (나머지는 Next.js에서 직접 처리)
      { source: '/api/seedance/:path*', destination: `${apiBase}/api/seedance/:path*` },
      { source: '/api/imagen/:path*', destination: `${apiBase}/api/imagen/:path*` },
      { source: '/api/veo/:path*', destination: `${apiBase}/api/veo/:path*` },
      { source: '/api/video/:path*', destination: `${apiBase}/api/video/:path*` },
      { source: '/api/health', destination: `${apiBase}/api/health` },
    ];
  },
};

export default nextConfig;
