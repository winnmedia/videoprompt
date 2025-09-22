/**
 * Content Statistics Cards Widget
 * 콘텐츠 통계 카드 그리드
 */

'use client';

import React from 'react';
import { useContentStats } from '../../features/content-management';

interface StatCard {
  id: string;
  label: string;
  icon: string;
  count: number;
  isActive: boolean;
}

interface ContentStatsProps {
  cards: StatCard[];
}

/**
 * 개별 통계 카드 컴포넌트
 */
function StatCard({ card }: { card: StatCard }) {
  const { typeGrowth, getTotalCount, getGrowthPercentage } = useContentStats();

  const growth = getGrowthPercentage(card.id as any);
  const isPositive = growth > 0;
  const isNegative = growth < 0;

  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-6 transition-all duration-200 ${
        card.isActive
          ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
      data-testid={`stat-card-${card.id}`}
    >
      {/* 메인 콘텐츠 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${
              card.isActive
                ? 'bg-blue-100'
                : 'bg-gray-100'
            }`}
          >
            {card.icon}
          </div>
          <div>
            <h3 className={`text-sm font-medium ${
              card.isActive ? 'text-blue-900' : 'text-gray-900'
            }`}>
              {card.label}
            </h3>
            <p className={`text-2xl font-bold ${
              card.isActive ? 'text-blue-700' : 'text-gray-700'
            }`}>
              {card.count.toLocaleString()}
            </p>
          </div>
        </div>

        {/* 증감 표시 */}
        {growth !== 0 && (
          <div className={`flex items-center space-x-1 text-sm ${
            isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
          }`}>
            <svg
              className={`h-4 w-4 ${
                isPositive ? 'rotate-0' : 'rotate-180'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
            <span className="font-medium">
              {Math.abs(growth).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* 추가 정보 (7일 변화량) */}
      {typeGrowth && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>지난 7일</span>
            <span className={`font-medium ${
              isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
            }`}>
              {isPositive ? '+' : ''}{typeGrowth[card.id]?.change || 0}
            </span>
          </div>
        </div>
      )}

      {/* 활성 상태 표시 */}
      {card.isActive && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500" />
      )}
    </div>
  );
}

/**
 * 콘텐츠 통계 카드 그리드
 */
export function ContentStats({ cards }: ContentStatsProps) {
  const { activitySummary, loading } = useContentStats();

  return (
    <div className="space-y-6">
      {/* 메인 통계 카드 그리드 */}
      <div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="stats-grid"
      >
        {cards.map((card) => (
          <StatCard key={card.id} card={card} />
        ))}
      </div>

      {/* 활동 요약 */}
      {activitySummary && !loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* 오늘 활동 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">오늘 활동</p>
                <p className="text-lg font-bold text-gray-700">
                  {activitySummary.today}
                </p>
              </div>
            </div>
          </div>

          {/* 이번 주 활동 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">이번 주</p>
                <p className="text-lg font-bold text-gray-700">
                  {activitySummary.thisWeek}
                </p>
              </div>
            </div>
          </div>

          {/* 가장 활발한 타입 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                <svg className="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">인기 타입</p>
                <p className="text-lg font-bold text-gray-700">
                  {Object.entries(activitySummary.typeBreakdown)
                    .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}