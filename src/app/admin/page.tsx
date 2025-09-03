import Link from 'next/link';
import { AdminClient } from './AdminClient';

export const revalidate = 0;

type Overview = {
  usersCount: number;
  adminsCount: number;
  projectsCount: number;
  scenariosCount: number;
  promptsCount: number;
  videosCount: number;
  failedVideosCount: number;
};

async function getOverview(): Promise<Overview> {
  try {
    const { prisma } = await import('@/lib/db');
    const [
      usersCount,
      adminsCount,
      projectsCount,
      scenariosCount,
      promptsCount,
      videosCount,
      failedVideosCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.project.count(),
      prisma.scenario.count(),
      prisma.prompt.count(),
      prisma.videoAsset.count(),
      prisma.videoAsset.count({ where: { status: 'failed' } }),
    ]);

    return {
      usersCount,
      adminsCount,
      projectsCount,
      scenariosCount,
      promptsCount,
      videosCount,
      failedVideosCount,
    };
  } catch {
    return {
      usersCount: 0,
      adminsCount: 0,
      projectsCount: 0,
      scenariosCount: 0,
      promptsCount: 0,
      videosCount: 0,
      failedVideosCount: 0,
    };
  }
}

type Recent = {
  recentProjects: { id: string; title: string; status: string; createdAt: string; userEmail?: string }[];
  recentScenarios: { id: string; title: string; version: number; createdAt: string }[];
  recentVideos: { id: string; provider: string; status: string; version: number; createdAt: string }[];
};

async function getRecent(): Promise<Recent> {
  try {
    const { prisma } = await import('@/lib/db');
    const [recentProjects, recentScenarios, recentVideos] = await Promise.all([
      prisma.project.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { user: true } }),
      prisma.scenario.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.videoAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
    return {
      recentProjects: recentProjects.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        userEmail: (p as unknown as { user?: { email?: string } }).user?.email,
      })),
      recentScenarios: recentScenarios.map((s) => ({
        id: s.id,
        title: s.title,
        version: s.version,
        createdAt: s.createdAt.toISOString(),
      })),
      recentVideos: recentVideos.map((v) => ({
        id: v.id,
        provider: v.provider,
        status: v.status,
        version: v.version,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  } catch {
    return { recentProjects: [], recentScenarios: [], recentVideos: [] };
  }
}

export default async function AdminPage() {
  const [overview, recent] = await Promise.all([getOverview(), getRecent()]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
          <p className="mt-2 text-gray-600">백엔드 데이터 상태를 빠르게 살펴보세요</p>
        </div>
        <Link href="/" className="rounded border px-3 py-1 text-gray-800 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">홈으로</Link>
      </header>

      <AdminClient />

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium text-gray-500">사용자</h2>
          <div className="text-2xl font-semibold">{overview.usersCount}</div>
          <div className="mt-1 text-sm text-gray-500">관리자 {overview.adminsCount}</div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium text-gray-500">프로젝트</h2>
          <div className="text-2xl font-semibold">{overview.projectsCount}</div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium text-gray-500">시나리오</h2>
          <div className="text-2xl font-semibold">{overview.scenariosCount}</div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium text-gray-500">프롬프트</h2>
          <div className="text-2xl font-semibold">{overview.promptsCount}</div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium text-gray-500">영상 자산</h2>
          <div className="text-2xl font-semibold">{overview.videosCount}</div>
          <div className="mt-1 text-sm text-red-600">실패 {overview.failedVideosCount}</div>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="mb-3 text-lg font-semibold">최근 프로젝트</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">제목</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">상태</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">소유자</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">생성일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.recentProjects.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                    <td className="px-3 py-2">{p.title}</td>
                    <td className="px-3 py-2">{p.status}</td>
                    <td className="px-3 py-2">{p.userEmail ?? '-'}</td>
                    <td className="px-3 py-2">{new Date(p.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">최근 시나리오</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">제목</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">버전</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">생성일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.recentScenarios.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-mono text-xs">{s.id}</td>
                    <td className="px-3 py-2">{s.title}</td>
                    <td className="px-3 py-2">{s.version}</td>
                    <td className="px-3 py-2">{new Date(s.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">최근 영상 자산</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">제공자</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">상태</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">버전</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">생성일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.recentVideos.map((v) => (
                  <tr key={v.id}>
                    <td className="px-3 py-2 font-mono text-xs">{v.id}</td>
                    <td className="px-3 py-2">{v.provider}</td>
                    <td className="px-3 py-2">{v.status}</td>
                    <td className="px-3 py-2">{v.version}</td>
                    <td className="px-3 py-2">{new Date(v.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}


