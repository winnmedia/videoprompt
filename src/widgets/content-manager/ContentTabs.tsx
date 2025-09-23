/**
 * ContentTabs 컴포넌트 - 콘텐츠 탭 관리
 * FSD 아키텍처 준수
 */

import React, { useState } from 'react';

interface ContentTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface ContentTabsProps {
  tabs: ContentTab[];
  defaultActiveId?: string;
  className?: string;
}

export const ContentTabs: React.FC<ContentTabsProps> = ({
  tabs,
  defaultActiveId,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState(defaultActiveId || tabs[0]?.id);

  const activeContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={className}>
      {/* Tab Headers */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-4">
        {activeContent}
      </div>
    </div>
  );
};