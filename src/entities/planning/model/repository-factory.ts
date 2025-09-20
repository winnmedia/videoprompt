/**
 * Planning Repository Factory
 * API 라우트에서 사용할 수 있는 팩토리 함수들
 */

import { planningRepositoryFactory } from '@/shared/infrastructure/planning-repository';
import type { PlanningRepository } from './repository-interfaces';

/**
 * Planning Repository 인스턴스 생성
 * API 라우트에서 사용하는 메인 함수
 */
export function getPlanningRepository(): PlanningRepository {
  // Supabase로 완전 전환 완료 (2025-09-21)
  // Prisma 제거됨 - createSupabaseRepository만 사용
  return planningRepositoryFactory.createSupabaseRepository();
}

/**
 * Dual Storage Repository 생성 (향후 확장용)
 */
export function getDualPlanningRepository(): PlanningRepository {
  // Prisma 완전 제거 - Supabase만 사용
  const supabase = planningRepositoryFactory.createSupabaseRepository();

  // Supabase를 primary로 사용
  // 추후 필요시 다른 storage 추가 가능
  return supabase;
}