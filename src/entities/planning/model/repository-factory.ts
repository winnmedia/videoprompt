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
  // 현재는 Prisma를 기본으로 사용
  // 향후 환경변수로 Provider 선택 가능하도록 확장 예정
  return planningRepositoryFactory.createPrismaRepository();
}

/**
 * Dual Storage Repository 생성 (향후 확장용)
 */
export function getDualPlanningRepository(): PlanningRepository {
  const prisma = planningRepositoryFactory.createPrismaRepository();
  const supabase = planningRepositoryFactory.createSupabaseRepository();

  // 현재는 Prisma를 primary로 사용
  // 향후 dual storage 로직 구현 시 확장
  return prisma;
}