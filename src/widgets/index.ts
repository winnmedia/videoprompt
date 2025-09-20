/**
 * ✨ Widgets Layer - FSD Public API
 *
 * 🎯 Complex UI Blocks
 * - 비즈니스 로직이 포함된 UI 위젯
 * - shared/ui 컴포넌트들의 조합
 * - features 레이어와 통신
 *
 * 🏗️ Architecture Rules
 * - entities와 features를 조율
 * - 페이지 레벨 UI 블록
 * - 재사용 가능한 위젯
 */

// 🏠 Layout Widgets
export * from './header';

// 🎬 Content Widgets
export * from './scenario';
export * from './storyboard';
export * from './workflow';

// 📊 Data Widgets
export * from './monitoring-dashboard';
export * from './performance';
export * from './planning';

// 🌱 Feature Widgets
export * from './seedance';