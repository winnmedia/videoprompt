/**
 * 🗄️ Planning Entity Repository (Pure Domain)
 * Clean Architecture - Domain Layer
 *
 * 핵심 원칙:
 * - 도메인 순수성: 인프라 의존성 없음 (Supabase, Prisma 클라이언트 import 금지)
 * - Dependency Inversion: 구현체는 외부에서 주입
 * - FSD 경계 준수: entities 레이어에서 순수 도메인 로직만
 */

// Re-export interfaces for convenience
export {
  type PlanningRepository,
  type PrismaRepository,
  type SupabaseRepository,
  type DualStorageRepository,
  type DualStorageResult,
  type RepositoryFactory
} from './repository-interfaces';