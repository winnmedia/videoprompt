"use client";
import { DataTable, type Column } from '@/shared/ui/data-table';

type ProjectRow = { id: string; title: string; status: string; userEmail?: string; createdAt: string };
type ScenarioRow = { id: string; title: string; version: number; createdAt: string };
type VideoRow = { id: string; provider: string; status: string; version: number; createdAt: string };

export function AdminTablesClient({
  recentProjects,
  recentScenarios,
  recentVideos,
}: {
  recentProjects: ProjectRow[];
  recentScenarios: ScenarioRow[];
  recentVideos: VideoRow[];
}) {
  const projectCols: Column<ProjectRow>[] = [
    { key: 'id', header: 'ID', className: 'w-56', sortable: true },
    { key: 'title', header: '제목', sortable: true },
    { key: 'status', header: '상태', sortable: true },
    { key: 'userEmail', header: '소유자', sortable: true },
    { key: 'createdAt', header: '생성일', accessor: (p) => new Date(p.createdAt).toLocaleString(), sortable: true },
  ];

  const scenarioCols: Column<ScenarioRow>[] = [
    { key: 'id', header: 'ID', className: 'w-56', sortable: true },
    { key: 'title', header: '제목', sortable: true },
    { key: 'version', header: '버전', sortable: true },
    { key: 'createdAt', header: '생성일', accessor: (s) => new Date(s.createdAt).toLocaleString(), sortable: true },
  ];

  const videoCols: Column<VideoRow>[] = [
    { key: 'id', header: 'ID', className: 'w-56', sortable: true },
    { key: 'provider', header: '제공자', sortable: true },
    { key: 'status', header: '상태', sortable: true },
    { key: 'version', header: '버전', sortable: true },
    { key: 'createdAt', header: '생성일', accessor: (v) => new Date(v.createdAt).toLocaleString(), sortable: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-lg font-semibold">최근 프로젝트</h2>
        <DataTable
          ariaLabel="최근 프로젝트"
          initialSortKey="createdAt"
          initialSortDir="desc"
          columns={projectCols}
          data={recentProjects}
          pageSize={5}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">최근 시나리오</h2>
        <DataTable
          ariaLabel="최근 시나리오"
          initialSortKey="createdAt"
          initialSortDir="desc"
          columns={scenarioCols}
          data={recentScenarios}
          pageSize={5}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">최근 영상 자산</h2>
        <DataTable
          ariaLabel="최근 영상 자산"
          initialSortKey="createdAt"
          initialSortDir="desc"
          columns={videoCols}
          data={recentVideos}
          pageSize={5}
        />
      </div>
    </div>
  );
}


