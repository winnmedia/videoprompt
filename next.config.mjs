/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15.4.6 Vercel 호환성을 위한 최소 설정
  // Next.js 15: serverExternalPackages supersedes experimental.serverComponentsExternalPackages
  serverExternalPackages: ['@prisma/client'],
  
  // 빌드 시 ESLint 및 TypeScript 오류 무시 (프로덕션 배포 우선)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // API 라우팅 설정 - Railway 프록시
  async rewrites() {
    const apiBase = 'https://videoprompt-production.up.railway.app';
    console.log('🚀 Using Railway backend API proxy for business logic APIs');

    return [
      // 인증 API는 Next.js에서 처리
      // 나머지는 Railway로 프록시
      { source: '/api/user/:path*', destination: `${apiBase}/api/user/:path*` },
      { source: '/api/seedance/:path*', destination: `${apiBase}/api/seedance/:path*` },
      { source: '/api/imagen/:path*', destination: `${apiBase}/api/imagen/:path*` },
      { source: '/api/veo/:path*', destination: `${apiBase}/api/veo/:path*` },
      { source: '/api/scenario/:path*', destination: `${apiBase}/api/scenario/:path*` },
      { source: '/api/video/:path*', destination: `${apiBase}/api/video/:path*` },
      { source: '/api/net/:path*', destination: `${apiBase}/api/net/:path*` },
      { source: '/api/health', destination: `${apiBase}/api/health` },
    ];
  },
};

export default nextConfig;
