/**
 * 기본 데이터베이스 스키마 검증 테스트
 * 
 * CineGenius v3 마이그레이션 적용 후 기본적인 검증만 수행
 */

import { PrismaClient } from '@prisma/client';

describe('기본 데이터베이스 스키마 검증', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('CineGenius v3 새 필드 검증', () => {
    test('VideoAsset 테이블의 새 필드들에 접근 가능해야 함', async () => {
      // generation_metadata, quality_score 필드 접근 테스트
      const result = await prisma.videoAsset.findFirst({
        select: {
          id: true,
          generation_metadata: true,
          quality_score: true
        }
      });

      // 에러 없이 쿼리가 실행되면 성공 (레코드가 없어도 OK)
      expect(true).toBe(true);
    });

    test('ShareToken 테이블의 permissions 필드에 접근 가능해야 함', async () => {
      const result = await prisma.shareToken.findFirst({
        select: {
          id: true,
          permissions: true
        }
      });

      // 에러 없이 쿼리가 실행되면 성공
      expect(true).toBe(true);
    });

    test('Comment 테이블의 새 필드들에 접근 가능해야 함', async () => {
      const result = await prisma.comment.findFirst({
        select: {
          id: true,
          comment_type: true,
          feedback_data: true,
          rating: true
        }
      });

      // 에러 없이 쿼리가 실행되면 성공
      expect(true).toBe(true);
    });
  });

  describe('MigrationLog 테이블 검증', () => {
    test('MigrationLog 테이블에 접근 가능해야 함', async () => {
      const count = await prisma.migrationLog.count();
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('CineGenius v3 마이그레이션 기록이 존재해야 함', async () => {
      const migration = await prisma.migrationLog.findFirst({
        where: {
          migration_id: '001_cinegenius_v3_schema_upgrade'
        }
      });

      expect(migration).toBeTruthy();
      expect(migration?.status).toBe('APPLIED');
    });
  });

  describe('기본 테이블 접근성 검증', () => {
    test('주요 테이블들에 정상 접근 가능해야 함', async () => {
      // 각 테이블에 대한 기본 count 쿼리
      const userCount = await prisma.user.count();
      const projectCount = await prisma.project.count();
      const promptCount = await prisma.prompt.count();
      const shareTokenCount = await prisma.shareToken.count();
      const commentCount = await prisma.comment.count();

      // 숫자 타입이면 성공
      expect(typeof userCount).toBe('number');
      expect(typeof projectCount).toBe('number');
      expect(typeof promptCount).toBe('number');
      expect(typeof shareTokenCount).toBe('number');
      expect(typeof commentCount).toBe('number');
    });
  });
});