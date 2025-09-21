/**
 * 인증 상태 관리 훅 (FSD 호환)
 * shared 레이어에서 app 레이어의 Redux store에 접근
 */

// Re-export useAuth from app store for FSD compliance
export { useAuth, useAuthStore } from '@/app/store/hooks/useAuth';