import Link from 'next/link';
import { AdminClient } from './AdminClient';
import { StatCard } from '@/shared/ui/stat-card';
import { AdminTablesClient } from './AdminTablesClient';

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
        <StatCard title="사용자" value={overview.usersCount} sub={`관리자 ${overview.adminsCount}`} />
        <StatCard title="프로젝트" value={overview.projectsCount} />
        <StatCard title="시나리오" value={overview.scenariosCount} />
        <StatCard title="프롬프트" value={overview.promptsCount} />
        <StatCard title="영상 자산" value={overview.videosCount} sub={`실패 ${overview.failedVideosCount}`} />
      </section>

      <section className="space-y-6">
        <AdminTablesClient
          recentProjects={recent.recentProjects}
          recentScenarios={recent.recentScenarios}
          recentVideos={recent.recentVideos}
        />
      </section>
    </main>
  );
}


