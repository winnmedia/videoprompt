/**
 * Project Metrics Widget
 *
 * 프로젝트 관련 메트릭을 표시하는 위젯입니다.
 * 프로젝트, 시나리오, 프롬프트, 비디오 에셋의 총계와 최근 활동을 표시합니다.
 */

'use client';

import { useMemo } from 'react';
import type { AdminMetrics } from '../../entities/admin';

interface ProjectMetricsProps {
  /** 콘텐츠 메트릭 데이터 */
  content: AdminMetrics['content'];
}

/**
 * 프로젝트 메트릭 위젯
 */
export function ProjectMetrics({ content }: ProjectMetricsProps) {
  // 총 콘텐츠 아이템 수 계산
  const totalContent = useMemo(() => {
    return content.projects + content.scenarios + content.prompts + content.videoAssets;
  }, [content]);

  // 비디오 대 프로젝트 비율 계산
  const videoToProjectRatio = useMemo(() => {
    if (content.projects === 0) return 0;
    return Math.round((content.videoAssets / content.projects) * 100) / 100;
  }, [content.projects, content.videoAssets]);

  // 평균 시나리오 수 계산
  const avgScenariosPerProject = useMemo(() => {
    if (content.projects === 0) return 0;
    return Math.round((content.scenarios / content.projects) * 100) / 100;
  }, [content.projects, content.scenarios]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">콘텐츠 메트릭</h3>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-indigo-500 rounded-full" />
          <span className="text-sm text-gray-500">총 {totalContent.toLocaleString()}개</span>
        </div>
      </div>

      {/* 메트릭 카드 그리드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 프로젝트 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">프로젝트</p>
              <p className="text-2xl font-bold text-blue-900">{content.projects.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-full">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        {/* 시나리오 */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">시나리오</p>
              <p className="text-2xl font-bold text-green-900">{content.scenarios.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-green-100 rounded-full">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 프롬프트 */}
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">프롬프트</p>
              <p className="text-2xl font-bold text-purple-900">{content.prompts.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-full">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 비디오 에셋 */}
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">비디오</p>
              <p className="text-2xl font-bold text-orange-900">{content.videoAssets.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-full">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 비율 및 통계 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">프로젝트당 평균</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">시나리오</span>
              <span className="text-sm font-medium text-gray-900">{avgScenariosPerProject}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">비디오</span>
              <span className="text-sm font-medium text-gray-900">{videoToProjectRatio}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">콘텐츠 분포</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">프로젝트</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.round((content.projects / totalContent) * 100)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">비디오</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.round((content.videoAssets / totalContent) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 프로젝트 목록 */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">최근 생성된 프로젝트</h4>
        {content.recentProjects.length > 0 ? (
          <div className="space-y-2">
            {content.recentProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                data-testid={`recent-project-${project.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {project.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    생성자: {project.owner}
                  </p>
                </div>
                <div className="flex-shrink-0 text-xs text-gray-500">
                  {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">최근 생성된 프로젝트가 없습니다</p>
          </div>
        )}
      </div>

      {/* 추가 인사이트 */}
      {(content.projects > 0 && content.videoAssets === 0) && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-yellow-800">
              프로젝트는 있지만 생성된 비디오가 없습니다. 비디오 생성 과정을 확인해보세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}