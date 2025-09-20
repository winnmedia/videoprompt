/**
 * ✨ Header Widget - FSD Public API
 *
 * 🎯 Business Logic Integration
 * - 인증 상태 관리 연동
 * - 네비게이션 라우팅 로직
 * - 사용자 메뉴 상태 관리
 *
 * 🏗️ Architecture
 * - MainNav + Header 조합
 * - shared/ui 컴포넌트 활용
 * - Feature 레이어와 통신
 */

// 🎛️ Main Header Components
export { Header } from './ui/Header';
export { MainNav } from './ui/MainNav';
export { UserMenu } from './ui/UserMenu';

// 🏠 Composed Header Widget
export { AppHeader } from './ui/AppHeader';