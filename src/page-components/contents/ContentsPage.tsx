'use client';

import { useState } from 'react';
import { useAppSelector } from '@/shared/hooks';
import { ContentTabs, ContentGrid, EmptyState } from '@/widgets/content-manager';
import { selectAllStories } from '@/entities/story';
import type { ContentType } from '@/widgets/content-manager/ContentTabs';

/**
 * 콘텐츠 관리 페이지 컴포넌트
 *
 * FSD 아키텍처:
 * - page-components: 페이지별 컴포넌트 조립 및 데이터 연결
 * - widgets/content-manager의 컴포넌트들을 조합
 * - Redux store에서 실제 데이터를 가져와 표시
 *
 * 기능:
 * - 4개 탭으로 콘텐츠 분류 (시나리오, 스토리보드, 영상, 템플릿)
 * - 생성된 콘텐츠 그리드 형태 표시
 * - 빈 상태 처리 및 가이드 제공
 * - 검색 및 필터링 기능
 */
export function ContentsPage() {
  const [activeTab, setActiveTab] = useState<ContentType>('scenario');

  // Redux store에서 데이터 가져오기
  const stories = useAppSelector(selectAllStories);

  // 탭별 데이터 변환
  const getContentItems = () => {
    switch (activeTab) {
      case 'scenario':
        return stories.map(story => ({
          id: story.id,
          type: 'scenario' as const,
          title: story.title || '제목 없음',
          description: story.metadata.theme || story.summary || '설명 없음',
          createdAt: story.createdAt,
          thumbnail: undefined,
          status: story.status
        }));

      case 'storyboard':
        // 추후 스토리보드 데이터 연결
        return [];

      case 'video':
        // 추후 비디오 데이터 연결
        return [];

      case 'template':
        // 추후 템플릿 데이터 연결
        return [];

      default:
        return [];
    }
  };

  const contentItems = getContentItems();

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="container mx-auto px-4 py-12">
        {/* 페이지 헤더 */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">내 콘텐츠</span>
          </h1>
          <p className="text-gray-400 text-lg">
            생성한 스토리와 영상을 관리하세요
          </p>

          {/* 콘텐츠 요약 */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-bold text-neon-green">{stories.length}</div>
              <div className="text-sm text-gray-400">시나리오</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-bold text-neon-pink">0</div>
              <div className="text-sm text-gray-400">스토리보드</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-bold text-neon-cyan">0</div>
              <div className="text-sm text-gray-400">영상</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-bold text-neon-purple">0</div>
              <div className="text-sm text-gray-400">템플릿</div>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mb-8">
          <ContentTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* 콘텐츠 그리드 */}
        <div className="glass-card p-6">
          {contentItems.length > 0 ? (
            <ContentGrid
              items={contentItems}
              emptyStateComponent={<EmptyState type={activeTab} />}
            />
          ) : (
            <EmptyState type={activeTab} />
          )}
        </div>

        {/* 액션 섹션 */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 mb-4">
            새로운 콘텐츠를 만들어보세요
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => window.location.href = '/story-generator'}
              className="btn-primary"
            >
              새 스토리 생성
            </button>
            <button
              onClick={() => window.location.href = '/video-generator'}
              className="btn-secondary"
            >
              영상 생성
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}