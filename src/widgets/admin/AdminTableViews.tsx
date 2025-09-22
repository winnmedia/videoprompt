/**
 * Admin Table Views
 *
 * 관리자 대시보드의 4개 테이블 뷰를 제공하는 컴포넌트입니다.
 * Users, Projects, Scenarios/Prompts, VideoAssets 테이블을 포함합니다.
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { AdminDataTable, type TableColumn, type TableAction } from './AdminDataTable';
import { AdminActionModal } from './AdminActionModal';
import type {
  AdminUser,
  AdminProject,
  AdminVideoAsset,
  TableFilter,
  PaginationInfo,
  AdminActionType
} from '../../entities/admin';

// 시나리오/프롬프트를 위한 타입 정의
interface ScenarioPrompt {
  id: string;
  type: 'scenario' | 'prompt';
  title: string;
  version: string;
  updatedAt: Date;
  owner: {
    id: string;
    email: string;
  };
  projectId: string;
  projectTitle: string;
}

interface AdminTableViewsProps {
  /** 사용자 데이터 */
  users: AdminUser[];
  /** 프로젝트 데이터 */
  projects: AdminProject[];
  /** 시나리오/프롬프트 데이터 */
  scenariosPrompts: ScenarioPrompt[];
  /** 비디오 에셋 데이터 */
  videoAssets: AdminVideoAsset[];
  /** 로딩 상태 */
  loading?: boolean;
  /** 페이지네이션 정보 */
  pagination?: PaginationInfo;
  /** 관리자 액션 실행 콜백 */
  onAdminAction: (action: AdminActionType, targetType: string, targetId: string, reason?: string) => Promise<void>;
}

/**
 * 관리자 테이블 뷰
 */
export function AdminTableViews({
  users,
  projects,
  scenariosPrompts,
  videoAssets,
  loading = false,
  pagination,
  onAdminAction
}: AdminTableViewsProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'projects' | 'scenarios' | 'videos'>('users');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    actionType: AdminActionType;
    targetType: string;
    targetId: string;
    targetName?: string;
  }>({
    isOpen: false,
    actionType: 'video_retry',
    targetType: '',
    targetId: '',
    targetName: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  // PII 마스킹 함수
  const maskEmail = useCallback((email: string) => {
    const [local, domain] = email.split('@');
    if (local.length <= 3) return email;
    return `${local.slice(0, 2)}***@${domain}`;
  }, []);

  // 필터링된 데이터 계산
  const filteredData = useMemo(() => {
    const filter = filterText.toLowerCase();

    switch (activeTab) {
      case 'users':
        return users.filter(user =>
          user.email.toLowerCase().includes(filter) ||
          (user.username && user.username.toLowerCase().includes(filter))
        );
      case 'projects':
        return projects.filter(project =>
          project.title.toLowerCase().includes(filter) ||
          project.owner.email.toLowerCase().includes(filter)
        );
      case 'scenarios':
        return scenariosPrompts.filter(item =>
          item.title.toLowerCase().includes(filter) ||
          item.owner.email.toLowerCase().includes(filter) ||
          item.projectTitle.toLowerCase().includes(filter)
        );
      case 'videos':
        return videoAssets.filter(video =>
          video.id.toLowerCase().includes(filter) ||
          video.owner.email.toLowerCase().includes(filter) ||
          video.project.title.toLowerCase().includes(filter)
        );
      default:
        return [];
    }
  }, [activeTab, filterText, users, projects, scenariosPrompts, videoAssets]);

  // 관리자 액션 핸들러
  const handleAdminAction = useCallback((actionType: AdminActionType, targetType: string, targetId: string, targetName?: string) => {
    setActionModal({
      isOpen: true,
      actionType,
      targetType,
      targetId,
      targetName
    });
  }, []);

  // 액션 확인 핸들러
  const handleConfirmAction = useCallback(async (reason?: string) => {
    setActionLoading(true);
    try {
      await onAdminAction(actionModal.actionType, actionModal.targetType, actionModal.targetId, reason);
      setActionModal({ ...actionModal, isOpen: false });
    } catch (error) {
      console.error('Admin action failed:', error);
    } finally {
      setActionLoading(false);
    }
  }, [actionModal, onAdminAction]);

  // 사용자 테이블 컬럼
  const userColumns: TableColumn<AdminUser>[] = [
    {
      key: 'id',
      title: 'ID',
      width: '100px',
      render: (value) => <span className="font-mono text-sm text-gray-600">{value.slice(0, 8)}</span>
    },
    {
      key: 'email',
      title: 'Email / Username',
      sortable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{maskEmail(value)}</div>
          {record.username && (
            <div className="text-sm text-gray-500">@{record.username}</div>
          )}
        </div>
      )
    },
    {
      key: 'role',
      title: 'Role',
      width: '100px',
      render: (value) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          value === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'accountStatus',
      title: 'Status',
      width: '100px',
      render: (value) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          value === 'active' ? 'bg-green-100 text-green-800' :
          value === 'suspended' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {value === 'active' ? '활성' : value === 'suspended' ? '정지' : '대기'}
        </span>
      )
    },
    {
      key: 'projectsCount',
      title: 'Projects',
      width: '80px',
      sortable: true,
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'createdAt',
      title: 'Created',
      width: '120px',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('ko-KR')
    }
  ];

  // 사용자 테이블 액션
  const userActions: TableAction<AdminUser>[] = [
    {
      key: 'suspend',
      title: '사용자 정지',
      danger: true,
      disabled: (record) => record.accountStatus === 'suspended' || record.role === 'admin',
      onClick: (record) => handleAdminAction('user_suspend', 'user', record.id, record.email),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
        </svg>
      )
    }
  ];

  // 프로젝트 테이블 컬럼
  const projectColumns: TableColumn<AdminProject>[] = [
    {
      key: 'id',
      title: 'ID',
      width: '100px',
      render: (value) => <span className="font-mono text-sm text-gray-600">{value.slice(0, 8)}</span>
    },
    {
      key: 'title',
      title: 'Title',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'status',
      title: 'Status',
      width: '100px',
      render: (value) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          value === 'active' ? 'bg-green-100 text-green-800' :
          value === 'archived' ? 'bg-gray-100 text-gray-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {value === 'active' ? '활성' : value === 'archived' ? '보관됨' : '진행중'}
        </span>
      )
    },
    {
      key: 'owner',
      title: 'Owner',
      render: (value) => maskEmail(value.email)
    },
    {
      key: 'scenariosCount',
      title: 'Scenarios',
      width: '80px',
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'videoAssetsCount',
      title: 'Videos',
      width: '80px',
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'updatedAt',
      title: 'Updated',
      width: '120px',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('ko-KR')
    }
  ];

  // 프로젝트 테이블 액션
  const projectActions: TableAction<AdminProject>[] = [
    {
      key: 'archive',
      title: '프로젝트 아카이브',
      disabled: (record) => record.status === 'archived',
      onClick: (record) => handleAdminAction('project_archive', 'project', record.id, record.title),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4 4-4" />
        </svg>
      )
    }
  ];

  // 시나리오/프롬프트 테이블 컬럼
  const scenarioColumns: TableColumn<ScenarioPrompt>[] = [
    {
      key: 'id',
      title: 'ID',
      width: '100px',
      render: (value) => <span className="font-mono text-sm text-gray-600">{value.slice(0, 8)}</span>
    },
    {
      key: 'type',
      title: 'Type',
      width: '80px',
      render: (value) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          value === 'scenario' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
        }`}>
          {value === 'scenario' ? '시나리오' : '프롬프트'}
        </span>
      )
    },
    {
      key: 'title',
      title: 'Title',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'version',
      title: 'Version',
      width: '80px',
      render: (value) => <span className="font-mono text-sm">{value}</span>
    },
    {
      key: 'projectTitle',
      title: 'Project',
      render: (value) => <span className="text-gray-600">{value}</span>
    },
    {
      key: 'owner',
      title: 'Owner',
      render: (value) => maskEmail(value.email)
    },
    {
      key: 'updatedAt',
      title: 'Updated',
      width: '120px',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('ko-KR')
    }
  ];

  // 비디오 에셋 테이블 컬럼
  const videoColumns: TableColumn<AdminVideoAsset>[] = [
    {
      key: 'id',
      title: 'ID',
      width: '100px',
      render: (value) => <span className="font-mono text-sm text-gray-600">{value.slice(0, 8)}</span>
    },
    {
      key: 'provider',
      title: 'Provider',
      width: '100px',
      render: (value) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          value === 'seedance' ? 'bg-green-100 text-green-800' :
          value === 'veo' ? 'bg-blue-100 text-blue-800' :
          value === 'imagen' ? 'bg-purple-100 text-purple-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'status',
      title: 'Status',
      width: '100px',
      render: (value) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          value === 'completed' ? 'bg-green-100 text-green-800' :
          value === 'processing' ? 'bg-blue-100 text-blue-800' :
          value === 'failed' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {value === 'completed' ? '완료' :
           value === 'processing' ? '처리중' :
           value === 'failed' ? '실패' : '대기'}
        </span>
      )
    },
    {
      key: 'duration',
      title: 'Duration',
      width: '80px',
      render: (value) => value ? `${value}s` : 'N/A'
    },
    {
      key: 'project',
      title: 'Project',
      render: (value) => <span className="text-gray-600">{value.title}</span>
    },
    {
      key: 'owner',
      title: 'Owner',
      render: (value) => maskEmail(value.email)
    },
    {
      key: 'createdAt',
      title: 'Created',
      width: '120px',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('ko-KR')
    }
  ];

  // 비디오 에셋 테이블 액션
  const videoActions: TableAction<AdminVideoAsset>[] = [
    {
      key: 'retry',
      title: '비디오 생성 재시도',
      disabled: (record) => record.status === 'processing' || record.status === 'completed',
      onClick: (record) => handleAdminAction('video_retry', 'video', record.id, `${record.project.title} 비디오`),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 헤더 */}
      <div className="border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">데이터 관리</h3>

            {/* 검색 */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="검색..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="pl-8 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex space-x-1 mt-4 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'users'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              사용자 ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'projects'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              프로젝트 ({projects.length})
            </button>
            <button
              onClick={() => setActiveTab('scenarios')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'scenarios'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              시나리오/프롬프트 ({scenariosPrompts.length})
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'videos'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              비디오 ({videoAssets.length})
            </button>
          </div>
        </div>
      </div>

      {/* 테이블 콘텐츠 */}
      <div>
        {activeTab === 'users' && (
          <AdminDataTable
            data={filteredData as AdminUser[]}
            columns={userColumns}
            actions={userActions}
            loading={loading}
            pagination={pagination}
            selectable
            selectedRowKeys={selectedRows}
            onSelectionChange={setSelectedRows}
            emptyText="사용자가 없습니다"
          />
        )}

        {activeTab === 'projects' && (
          <AdminDataTable
            data={filteredData as AdminProject[]}
            columns={projectColumns}
            actions={projectActions}
            loading={loading}
            pagination={pagination}
            selectable
            selectedRowKeys={selectedRows}
            onSelectionChange={setSelectedRows}
            emptyText="프로젝트가 없습니다"
          />
        )}

        {activeTab === 'scenarios' && (
          <AdminDataTable
            data={filteredData as ScenarioPrompt[]}
            columns={scenarioColumns}
            loading={loading}
            pagination={pagination}
            emptyText="시나리오/프롬프트가 없습니다"
          />
        )}

        {activeTab === 'videos' && (
          <AdminDataTable
            data={filteredData as AdminVideoAsset[]}
            columns={videoColumns}
            actions={videoActions}
            loading={loading}
            pagination={pagination}
            selectable
            selectedRowKeys={selectedRows}
            onSelectionChange={setSelectedRows}
            emptyText="비디오가 없습니다"
          />
        )}
      </div>

      {/* 액션 모달 */}
      <AdminActionModal
        open={actionModal.isOpen}
        actionType={actionModal.actionType}
        targetType={actionModal.targetType}
        targetId={actionModal.targetId}
        targetName={actionModal.targetName}
        loading={actionLoading}
        onClose={() => setActionModal({ ...actionModal, isOpen: false })}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}