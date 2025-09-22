/**
 * Integrations Page Component - FSD Pages Layer
 *
 * CLAUDE.md 준수사항:
 * - FSD pages 레이어 컴포넌트
 * - 콘텐츠 관리 UI/UX 구현
 * - 접근성 WCAG 2.1 AA 준수
 * - data-testid 네이밍 규약
 */

import type { Metadata } from 'next'
import Link from 'next/link'

// Shared UI 컴포넌트 (FSD Public API 준수)
import { Button, Card } from '../shared/ui'

export const metadata: Metadata = {
  title: '콘텐츠 관리',
  description: '영상 자료 및 통합 관리 - VideoPlanet',
}

/**
 * 통합 관리 페이지 컴포넌트
 *
 * 영상 자료와 외부 서비스 연동을 관리합니다:
 * - 업로드된 파일 관리
 * - 외부 서비스 연동
 * - 프로젝트 자료 정리
 * - 백업 및 동기화
 */
export function IntegrationsPage() {
  const integrations = [
    { name: 'Google Drive', status: '연결됨', icon: '📁' },
    { name: 'YouTube', status: '연결 필요', icon: '📺' },
    { name: 'Vimeo', status: '연결 필요', icon: '🎬' },
    { name: 'Dropbox', status: '연결됨', icon: '📦' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <nav className="mb-4" aria-label="브레드크럼">
            <ol className="flex items-center space-x-2 text-sm text-neutral-600">
              <li><Link href="/" className="hover:text-primary-600">홈</Link></li>
              <li><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></li>
              <li className="text-neutral-900 font-medium">콘텐츠 관리</li>
            </ol>
          </nav>

          <h1 className="text-3xl font-bold text-neutral-900 mb-2">콘텐츠 관리</h1>
          <p className="text-lg text-neutral-600">영상 자료를 체계적으로 관리하고 외부 서비스와 연동하세요</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">외부 서비스 연동</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{integration.icon}</span>
                      <div>
                        <div className="font-medium text-neutral-900">{integration.name}</div>
                        <div className={`text-sm ${
                          integration.status === '연결됨' ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {integration.status}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      {integration.status === '연결됨' ? '설정' : '연결'}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">파일 관리</h2>
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto text-neutral-400 mb-4">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <p className="text-neutral-600 mb-4">파일을 드래그하여 업로드하거나 버튼을 클릭하세요</p>
                <Button>파일 업로드</Button>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">저장 공간</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>사용량</span>
                  <span>2.1GB / 10GB</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div className="bg-primary-600 h-2 rounded-full" style={{width: '21%'}}></div>
                </div>
                <Button variant="outline" className="w-full">저장 공간 늘리기</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}