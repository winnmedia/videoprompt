/**
 * Layout Widget - 통합 버전
 */

import React, { useState } from 'react';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: string;
  href: string;
  isActive?: boolean;
}

export interface SidebarProps {
  items?: SidebarItem[];
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items = [
    { id: 'home', label: '홈', icon: '🏠', href: '/' },
    { id: 'stories', label: '스토리', icon: '📖', href: '/stories' },
    { id: 'scenarios', label: '시나리오', icon: '📝', href: '/scenarios' },
    { id: 'storyboards', label: '스토리보드', icon: '🎨', href: '/storyboards' },
    { id: 'prompts', label: '프롬프트', icon: '💡', href: '/prompts' }
  ],
  className = ''
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`bg-gray-900 text-white transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    } ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-8">
          {!isCollapsed && (
            <h1 className="text-xl font-bold">VideoPlanet</h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {isCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="space-y-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                item.isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export interface HeaderProps {
  title?: string;
  user?: {
    name: string;
    avatar?: string;
  };
  onUserClick?: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'VideoPlanet',
  user,
  onUserClick,
  className = ''
}) => {
  return (
    <header className={`bg-white shadow-sm border-b border-gray-200 ${className}`}>
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>

        {user && (
          <button
            onClick={onUserClick}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {user.avatar && (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="text-gray-700">{user.name}</span>
          </button>
        )}
      </div>
    </header>
  );
};

export interface LayoutProps {
  children: React.ReactNode;
  sidebarItems?: SidebarItem[];
  headerTitle?: string;
  user?: HeaderProps['user'];
  onUserClick?: () => void;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  sidebarItems,
  headerTitle,
  user,
  onUserClick,
  className = ''
}) => {
  return (
    <div className={`flex h-screen bg-gray-50 ${className}`}>
      <Sidebar items={sidebarItems} />
      <div className="flex-1 flex flex-col">
        <Header
          title={headerTitle}
          user={user}
          onUserClick={onUserClick}
        />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};