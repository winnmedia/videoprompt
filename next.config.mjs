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
};

export default nextConfig;


