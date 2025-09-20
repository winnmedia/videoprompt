/**
 * 📋 PermissionSystemDemo - 권한 관리 시스템 사용 예시
 * 개발된 UX 개선 사항들의 실제 사용법 데모
 *
 * 데모 내용:
 * - PermissionBoundary 사용법
 * - FeatureGate의 Graceful Degradation
 * - 키보드 네비게이션 및 접근성
 * - 성능 최적화된 권한 체크
 */

'use client';

import React, { useState } from 'react';
import { PermissionBoundary } from './PermissionBoundary';
import { FeatureGate, FeatureSwitch } from './FeatureGate';
import { KeyboardNavigationProvider, KeyboardShortcutsGuide } from './KeyboardNavigationProvider';
import { usePermissionOptimized, usePermissionsBatch, useConditionalRender } from '@/shared/hooks/usePermissionOptimized';
import { logger } from '@/shared/lib/logger';


/**
 * 스토리 생성 기능 데모
 */
function StoryGenerationDemo() {
  const [storyCount, setStoryCount] = useState(0);

  const variants = [
    {
      level: 'guest' as const,
      component: (
        <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
          <h3 className="font-semibold text-blue-900">게스트 모드 스토리 생성</h3>
          <p className="text-sm text-blue-700 mb-3">하루 3회까지 무료로 이용 가능합니다.</p>
          <button
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={storyCount >= 3}
            onClick={() => setStoryCount(prev => prev + 1)}
          >
            스토리 생성 ({storyCount}/3)
          </button>
        </div>
      ),
      limitations: ['하루 3회 제한', '고급 템플릿 사용 불가', '프로젝트 저장 불가'],
      upgradePrompt: '로그인하시면 무제한으로 스토리를 생성하고 저장할 수 있습니다.'
    },
    {
      level: 'user' as const,
      component: (
        <div className="p-4 border border-green-200 rounded-lg bg-green-50">
          <h3 className="font-semibold text-green-900">프리미엄 스토리 생성</h3>
          <p className="text-sm text-green-700 mb-3">무제한 생성 및 고급 기능 사용 가능</p>
          <div className="space-y-2">
            <button
              className="block w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              onClick={() => setStoryCount(prev => prev + 1)}
            >
              스토리 생성 ({storyCount}회 사용)
            </button>
            <button className="block w-full px-3 py-2 border border-green-600 text-green-600 rounded-md hover:bg-green-50">
              고급 템플릿 사용
            </button>
            <button className="block w-full px-3 py-2 border border-green-600 text-green-600 rounded-md hover:bg-green-50">
              프로젝트로 저장
            </button>
          </div>
        </div>
      ),
      upgradePrompt: '관리자 권한으로 팀 협업 기능과 고급 분석을 사용해보세요.'
    },
    {
      level: 'admin' as const,
      component: (
        <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
          <h3 className="font-semibold text-purple-900">관리자 스토리 생성</h3>
          <p className="text-sm text-purple-700 mb-3">팀 관리 및 분석 기능 포함</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
              개인 스토리 생성
            </button>
            <button className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
              팀 템플릿 생성
            </button>
            <button className="px-3 py-2 border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50">
              사용량 분석
            </button>
            <button className="px-3 py-2 border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50">
              팀 관리
            </button>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">1. FeatureGate 데모 - Graceful Degradation</h2>
      <FeatureGate
        feature="story-generation"
        variants={variants}
        showUpgradePrompts={true}
        onUpgradeClick={(level) => alert(`${level} 권한으로 업그레이드 요청`)}
      />
    </div>
  );
}

/**
 * 프로젝트 관리 기능 데모
 */
function ProjectManagementDemo() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">2. PermissionBoundary 데모 - 권한별 접근 제어</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 프로젝트 저장 */}
        <PermissionBoundary
          feature="project-save"
          onAccessDenied={(permission) => logger.info('Access denied:', permission)}
        >
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-semibold mb-2">프로젝트 저장</h3>
            <p className="text-sm text-gray-600 mb-3">현재 작업을 프로젝트로 저장합니다.</p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              저장하기
            </button>
          </div>
        </PermissionBoundary>

        {/* 관리자 대시보드 */}
        <PermissionBoundary feature="admin-dashboard">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-semibold mb-2">관리자 대시보드</h3>
            <p className="text-sm text-gray-600 mb-3">시스템 전체 관리 및 설정</p>
            <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
              관리자 메뉴
            </button>
          </div>
        </PermissionBoundary>

        {/* 비디오 업로드 */}
        <PermissionBoundary feature="video-upload">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-semibold mb-2">비디오 업로드</h3>
            <p className="text-sm text-gray-600 mb-3">비디오 파일을 업로드하고 편집</p>
            <input type="file" accept="video/*" className="block w-full text-sm text-gray-500 mb-2" />
            <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
              업로드 시작
            </button>
          </div>
        </PermissionBoundary>

        {/* 서비스 관리 (Degraded 모드 테스트) */}
        <PermissionBoundary feature="service-management">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-semibold mb-2">서비스 관리</h3>
            <p className="text-sm text-gray-600 mb-3">고급 서비스 설정 및 모니터링</p>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
              서비스 설정
            </button>
          </div>
        </PermissionBoundary>
      </div>
    </div>
  );
}

/**
 * 단순 기능 분기 데모
 */
function FeatureSwitchDemo() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">3. FeatureSwitch 데모 - 단순 권한 분기</h2>

      <FeatureSwitch
        feature="dashboard-view"
        guestComponent={
          <div className="p-4 bg-gray-100 rounded-lg">
            <h3 className="font-semibold">게스트 대시보드</h3>
            <p className="text-sm text-gray-600">기본 정보만 표시됩니다.</p>
          </div>
        }
        userComponent={
          <div className="p-4 bg-blue-100 rounded-lg">
            <h3 className="font-semibold">사용자 대시보드</h3>
            <p className="text-sm text-blue-700">개인화된 정보와 설정을 표시합니다.</p>
          </div>
        }
        adminComponent={
          <div className="p-4 bg-purple-100 rounded-lg">
            <h3 className="font-semibold">관리자 대시보드</h3>
            <p className="text-sm text-purple-700">시스템 관리 및 사용자 통계를 표시합니다.</p>
          </div>
        }
        serviceComponent={
          <div className="p-4 bg-green-100 rounded-lg">
            <h3 className="font-semibold">서비스 대시보드</h3>
            <p className="text-sm text-green-700">고급 모니터링 및 자동화 도구를 표시합니다.</p>
          </div>
        }
        fallback={
          <div className="p-4 bg-red-100 rounded-lg">
            <h3 className="font-semibold">오류</h3>
            <p className="text-sm text-red-700">대시보드를 로드할 수 없습니다.</p>
          </div>
        }
      />
    </div>
  );
}

/**
 * 성능 최적화 데모
 */
function PerformanceDemo() {
  const { permission: storyPermission, isLoading: storyLoading } = usePermissionOptimized('story-generation');
  const { permissions: batchPermissions, isLoading: batchLoading } = usePermissionsBatch([
    'project-save',
    'admin-dashboard',
    'video-upload'
  ]);

  const { renderWithPermission, renderConditionally } = useConditionalRender('story-generation');

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">4. 성능 최적화 데모</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 단일 권한 체크 */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="font-semibold mb-2">단일 권한 체크 (캐싱됨)</h3>
          {storyLoading ? (
            <div className="animate-pulse bg-gray-200 h-4 rounded"></div>
          ) : (
            <div className="text-sm">
              <p>기능: story-generation</p>
              <p>권한: {storyPermission?.hasAccess ? '허용' : '거부'}</p>
              <p>레벨: {storyPermission?.level}</p>
            </div>
          )}
        </div>

        {/* 배치 권한 체크 */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="font-semibold mb-2">배치 권한 체크</h3>
          {batchLoading ? (
            <div className="animate-pulse bg-gray-200 h-4 rounded"></div>
          ) : (
            <div className="text-sm space-y-1">
              {Object.entries(batchPermissions).map(([feature, permission]) => (
                <p key={feature}>
                  {feature}: {permission.hasAccess ? '✅' : '❌'}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* 조건부 렌더링 */}
        <div className="p-4 border border-gray-200 rounded-lg md:col-span-2">
          <h3 className="font-semibold mb-2">조건부 렌더링 최적화</h3>

          {renderWithPermission(
            <div className="p-2 bg-green-100 rounded">권한 있음: 기능 표시</div>,
            <div className="p-2 bg-red-100 rounded">권한 없음: 대체 UI</div>,
            <div className="p-2 bg-gray-100 rounded animate-pulse">로딩 중...</div>
          )}

          <div className="mt-2">
            {renderConditionally({
              guest: <span className="px-2 py-1 bg-gray-200 rounded text-xs">게스트</span>,
              user: <span className="px-2 py-1 bg-blue-200 rounded text-xs">사용자</span>,
              admin: <span className="px-2 py-1 bg-purple-200 rounded text-xs">관리자</span>,
              service: <span className="px-2 py-1 bg-green-200 rounded text-xs">서비스</span>,
              fallback: <span className="px-2 py-1 bg-red-200 rounded text-xs">오류</span>
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 접근성 데모
 */
function AccessibilityDemo() {
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">5. 접근성 데모</h2>

      <div className="p-4 border border-gray-200 rounded-lg">
        <h3 className="font-semibold mb-2">키보드 네비게이션</h3>
        <p className="text-sm text-gray-600 mb-4">
          다음 키들을 사용해보세요:
        </p>
        <ul className="text-sm space-y-1 mb-4">
          <li><kbd className="px-1 bg-gray-200 rounded">Tab</kbd> - 다음 요소로 이동</li>
          <li><kbd className="px-1 bg-gray-200 rounded">Shift + Tab</kbd> - 이전 요소로 이동</li>
          <li><kbd className="px-1 bg-gray-200 rounded">Enter</kbd> - 버튼 활성화</li>
          <li><kbd className="px-1 bg-gray-200 rounded">?</kbd> - 키보드 단축키 도움말</li>
          <li><kbd className="px-1 bg-gray-200 rounded">Esc</kbd> - 모달 닫기</li>
        </ul>

        <div className="space-x-2">
          <button
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-search-input
          >
            포커스 테스트 1
          </button>
          <button
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            onClick={() => setShowShortcuts(!showShortcuts)}
          >
            포커스 테스트 2
          </button>
          <button
            className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            포커스 테스트 3
          </button>
        </div>
      </div>

      {showShortcuts && <KeyboardShortcutsGuide />}
    </div>
  );
}

/**
 * 메인 데모 컴포넌트
 */
export function PermissionSystemDemo() {
  return (
    <KeyboardNavigationProvider>
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            권한 관리 UX 시스템 데모
          </h1>
          <p className="text-lg text-gray-600">
            사용자 친화적인 권한 관리와 Graceful Degradation 패턴
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-800 mb-2">데모 안내</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• 이 데모는 현재 권한 수준에 따라 다른 UI를 보여줍니다</li>
            <li>• 키보드 네비게이션을 테스트해보세요 (Tab, Enter, ?, Esc)</li>
            <li>• 각 컴포넌트는 접근성 표준(WCAG 2.1 AA)을 준수합니다</li>
            <li>• 성능 최적화를 위해 권한 체크 결과가 캐싱됩니다</li>
          </ul>
        </div>

        <StoryGenerationDemo />
        <ProjectManagementDemo />
        <FeatureSwitchDemo />
        <PerformanceDemo />
        <AccessibilityDemo />

        <div className="text-center pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            권한 관리 시스템 v1.0 - 사용자 경험 최적화 완료
          </p>
        </div>
      </div>
    </KeyboardNavigationProvider>
  );
}