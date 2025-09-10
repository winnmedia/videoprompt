import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://vridge.kr';
  
  // 정적 페이지들
  const staticPages = [
    '',
    '/scenario',
    '/prompt-generator', 
    '/workflow',
    '/feedback',
    '/planning',
    '/login',
    '/register',
    '/queue'
  ];

  // 정적 페이지 사이트맵 엔트리 생성
  const staticEntries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1.0 : 0.8,
  }));

  // TODO: 동적 페이지들 (나중에 데이터베이스에서 가져올 수 있음)
  const dynamicEntries: MetadataRoute.Sitemap = [
    // 예: 공유 페이지들
    // {
    //   url: `${baseUrl}/share/demo-share-token-123`,
    //   lastModified: new Date(),
    //   changeFrequency: 'monthly',
    //   priority: 0.5,
    // },
  ];

  return [...staticEntries, ...dynamicEntries];
}