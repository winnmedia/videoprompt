/**
 * Workflow Page
 * FSD Architecture - Pages Layer
 * 일시 비활성화 - VEO3 비용 절감
 */

'use client';

import Link from 'next/link';

export default function WorkflowPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center p-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
          <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          서비스 개선 중
        </h1>
        
        <p className="text-gray-600 mb-8">
          더 나은 AI 영상 생성 서비스를 위해<br />
          일시적으로 점검 중입니다.
        </p>

        <div className="space-y-3">
          <Link 
            href="/scenario" 
            className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            AI 영상 기획 하러 가기
          </Link>
          
          <Link 
            href="/prompt-generator" 
            className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            프롬프트 생성하러 가기
          </Link>
          
          <Link 
            href="/" 
            className="block w-full text-gray-500 hover:text-gray-700 transition-colors mt-4"
          >
            홈으로 돌아가기
          </Link>
        </div>

        <div className="mt-8 text-xs text-gray-400">
          <p>빠른 시일 내에 서비스를 재개하겠습니다.</p>
        </div>
      </div>
    </div>
  );
}

/* 임시 주석 처리 - 나중에 복구용
import { WorkflowWizard } from '@/widgets/workflow';

export default function WorkflowPage() {
  return <WorkflowWizard />;
}
*/