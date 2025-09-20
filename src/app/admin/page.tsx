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
    // TODO: Supabase 통계 구현 필요
    console.warn('📊 Admin overview - Supabase 통계 구현 대기 중');

    return {
      usersCount: 0,
      adminsCount: 0,
      projectsCount: 0,
      scenariosCount: 0,
      promptsCount: 0,
      videosCount: 0,
      failedVideosCount: 0,
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
    // TODO: Supabase 최근 데이터 조회 구현 필요
    console.warn('📊 Admin recent data - Supabase 구현 대기 중');

    return {
      recentProjects: [],
      recentScenarios: [],
      recentVideos: [],
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


