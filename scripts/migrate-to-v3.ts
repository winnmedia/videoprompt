#!/usr/bin/env tsx

/**
 * CineGenius v3.1 마이그레이션 스크립트
 * 
 * 기존 데이터를 안전하게 v3.1 형식으로 변환하고
 * 롤백 옵션을 제공합니다.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  timeout: number;
}

const DEFAULT_OPTIONS: MigrationOptions = {
  dryRun: false,
  batchSize: 100,
  timeout: 30000, // 30초
};

// =============================================================================
// 🛠️ Migration Functions
// =============================================================================

/**
 * 메인 마이그레이션 함수
 */
async function migrateToV3(options: MigrationOptions = DEFAULT_OPTIONS) {
  console.log('🚀 Starting CineGenius v3.1 Migration...');
  console.log(`📊 Options: ${JSON.stringify(options, null, 2)}`);
  
  const startTime = Date.now();
  let totalMigrated = 0;
  
  try {
    // 1. 스키마 마이그레이션 실행
    await runSchemaMigration(options.dryRun);
    
    // 2. 데이터 마이그레이션
    totalMigrated = await migratePromptData(options);
    
    // 3. 인덱스 최적화
    await optimizeIndexes(options.dryRun);
    
    // 4. 마이그레이션 로그 기록
    const executionTime = Date.now() - startTime;
    await logMigrationResult(true, totalMigrated, executionTime, options.dryRun);
    
    console.log(`✅ Migration completed successfully!`);
    console.log(`📈 Migrated ${totalMigrated} records in ${executionTime}ms`);
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    await logMigrationResult(false, totalMigrated, executionTime, options.dryRun, String(error));
    
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * 스키마 마이그레이션 실행
 */
async function runSchemaMigration(dryRun: boolean) {
  console.log('📋 Running schema migration...');
  
  if (dryRun) {
    console.log('🔍 DRY RUN: Schema migration would be executed');
    return;
  }
  
  try {
    // SQL 파일 읽기
    const migrationSql = readFileSync(
      join(process.cwd(), 'prisma/migrations/000001_add_cinegenius_v3_support.sql'),
      'utf-8'
    );
    
    // SQL 실행 (트랜잭션으로)
    await prisma.$executeRawUnsafe(migrationSql);
    console.log('✅ Schema migration completed');
    
  } catch (error) {
    console.error('❌ Schema migration failed:', error);
    throw error;
  }
}

/**
 * 프롬프트 데이터 마이그레이션
 */
async function migratePromptData(options: MigrationOptions): Promise<number> {
  console.log('📊 Migrating prompt data...');
  
  // 마이그레이션이 필요한 프롬프트 조회
  const totalCount = await prisma.prompt.count({
    where: {
      cinegenius_version: null, // 아직 마이그레이션되지 않은 것들
    },
  });
  
  console.log(`📄 Found ${totalCount} prompts to migrate`);
  
  if (totalCount === 0) {
    console.log('ℹ️ No prompts need migration');
    return 0;
  }
  
  if (options.dryRun) {
    console.log(`🔍 DRY RUN: Would migrate ${totalCount} prompts`);
    return totalCount;
  }
  
  let migratedCount = 0;
  let offset = 0;
  
  while (offset < totalCount) {
    const prompts = await prisma.prompt.findMany({
      where: {
        cinegenius_version: null,
      },
      take: options.batchSize,
      skip: offset,
      orderBy: {
        createdAt: 'asc', // 오래된 것부터 처리
      },
    });
    
    console.log(`🔄 Processing batch ${offset}-${offset + prompts.length} of ${totalCount}`);
    
    // 배치 처리
    for (const prompt of prompts) {
      try {
        await migratePrompt(prompt);
        migratedCount++;
        
        if (migratedCount % 10 === 0) {
          console.log(`📈 Progress: ${migratedCount}/${totalCount} (${Math.round(migratedCount/totalCount*100)}%)`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to migrate prompt ${prompt.id}:`, error);
        // 개별 실패는 전체 마이그레이션을 중단하지 않음
      }
    }
    
    offset += options.batchSize;
  }
  
  return migratedCount;
}

/**
 * 개별 프롬프트 마이그레이션
 */
async function migratePrompt(prompt: any) {
  // 기존 JSON 데이터 파싱
  const metadata = prompt.metadata;
  const timeline = prompt.timeline;
  const negative = prompt.negative;
  
  // v3.1 구조로 변환
  const v3Data = {
    project_id: generateUUID(),
    cinegenius_version: '3.1',
    
    // User Input 구성
    user_input: {
      oneLineScenario: metadata.scene_description || metadata.room_description || '',
      targetAudience: '',
    },
    
    // Project Config 구성
    project_config: {
      creationMode: 'VISUAL_FIRST',
      frameworkType: 'HYBRID',
      aiAssistantPersona: 'ASSISTANT_DIRECTOR',
    },
    
    // Generation Control 구성
    generation_control: {
      directorEmphasis: [],
      shotByShot: {
        enabled: false,
      },
      seed: Math.floor(Math.random() * 2147483647),
    },
    
    // AI Analysis는 비워둠
    ai_analysis: {},
  };
  
  // 기존 metadata를 v3.1 형식으로 확장
  const extendedMetadata = {
    ...metadata,
    // 새로운 v3.1 필드들 추가
    promptName: metadata.prompt_name || `Migrated Prompt ${Date.now()}`,
    baseStyle: {
      visualStyle: metadata.base_style || '',
      genre: 'Drama', // 기본값
      mood: 'Neutral', // 기본값
      quality: '4K', // 기본값
      styleFusion: {
        styleA: metadata.base_style || '',
        styleB: metadata.base_style || '',
        ratio: 1.0,
      },
    },
    spatialContext: {
      placeDescription: metadata.room_description || metadata.scene_description || '',
      weather: metadata.weather || 'Clear',
      lighting: metadata.lighting || 'Daylight (Midday)',
    },
    cameraSetting: {
      primaryLens: metadata.camera_setup || '35mm (Natural)',
      dominantMovement: metadata.camera_movement || 'Static Shot',
    },
    deliverySpec: {
      durationMs: Array.isArray(timeline) ? timeline.length * 2000 : 8000,
      aspectRatio: metadata.aspect_ratio || '16:9',
    },
  };
  
  // 타임라인을 v3.1 형식으로 변환
  const extendedTimeline = Array.isArray(timeline) 
    ? timeline.map((segment: any, index: number) => ({
        ...segment,
        // v3.1 필수 필드들 추가
        visualDirecting: segment.action || '',
        cameraWork: {
          angle: segment.camera_angle || 'Medium Shot (MS)',
          move: segment.camera_movement || 'Static Shot',
        },
        pacingFX: {
          pacing: segment.pacing || 'Real-time',
          editingStyle: 'Standard Cut',
          visualEffect: 'None',
        },
        audioLayers: {
          diegetic: segment.audio || '',
          non_diegetic: '',
          voice: '',
          concept: segment.audio_quality || '',
        },
      }))
    : [];
  
  // 데이터베이스 업데이트
  await prisma.prompt.update({
    where: { id: prompt.id },
    data: {
      // v3.1 새 필드들
      project_id: v3Data.project_id,
      cinegenius_version: v3Data.cinegenius_version,
      user_input: v3Data.user_input,
      project_config: v3Data.project_config,
      generation_control: v3Data.generation_control,
      ai_analysis: v3Data.ai_analysis,
      
      // 기존 필드들 확장 업데이트
      metadata: extendedMetadata,
      timeline: extendedTimeline,
      // negative는 그대로 유지
    },
  });
}

/**
 * 인덱스 최적화
 */
async function optimizeIndexes(dryRun: boolean) {
  console.log('🔧 Optimizing indexes...');
  
  if (dryRun) {
    console.log('🔍 DRY RUN: Index optimization would be executed');
    return;
  }
  
  try {
    // VACUUM ANALYZE (PostgreSQL 전용)
    await prisma.$executeRawUnsafe('VACUUM ANALYZE "Prompt";');
    await prisma.$executeRawUnsafe('VACUUM ANALYZE "VideoAsset";');
    await prisma.$executeRawUnsafe('VACUUM ANALYZE "Comment";');
    
    console.log('✅ Index optimization completed');
    
  } catch (error) {
    console.warn('⚠️ Index optimization failed (non-critical):', error);
  }
}

/**
 * 마이그레이션 결과 로그 기록
 */
async function logMigrationResult(
  success: boolean,
  recordsAffected: number,
  executionTimeMs: number,
  dryRun: boolean,
  errorMessage?: string
) {
  if (dryRun) {
    console.log('🔍 DRY RUN: Migration log would be recorded');
    return;
  }
  
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "MigrationLog" (
        "id", 
        "version", 
        "description", 
        "executed_at", 
        "execution_time_ms", 
        "records_affected", 
        "success", 
        "error_message"
      ) VALUES (
        gen_random_uuid()::text,
        '3.1.0',
        'CineGenius v3.1 data migration',
        NOW(),
        ${executionTimeMs},
        ${recordsAffected},
        ${success},
        ${errorMessage ? `'${errorMessage.replace(/'/g, "''")}'` : 'NULL'}
      )
    `);
    
  } catch (error) {
    console.warn('⚠️ Failed to log migration result:', error);
  }
}

// =============================================================================
// 🔄 Rollback Functions
// =============================================================================

/**
 * 마이그레이션 롤백
 */
async function rollbackMigration(dryRun: boolean = false) {
  console.log('🔄 Starting migration rollback...');
  
  if (dryRun) {
    console.log('🔍 DRY RUN: Rollback would be executed');
    return;
  }
  
  try {
    // v3.1 필드들을 NULL로 재설정
    await prisma.prompt.updateMany({
      where: {
        cinegenius_version: '3.1',
      },
      data: {
        project_id: null,
        cinegenius_version: '2.0',
        user_input: null,
        project_config: null,
        generation_control: null,
        ai_analysis: null,
      },
    });
    
    console.log('✅ Rollback completed successfully');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// =============================================================================
// 🧰 Utility Functions
// =============================================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 마이그레이션 상태 확인
 */
async function checkMigrationStatus() {
  console.log('🔍 Checking migration status...');
  
  const stats = await prisma.prompt.groupBy({
    by: ['cinegenius_version'],
    _count: true,
  });
  
  console.log('📊 Migration Status:');
  stats.forEach(stat => {
    const version = stat.cinegenius_version || '2.0 (legacy)';
    console.log(`  ${version}: ${stat._count} prompts`);
  });
  
  return stats;
}

// =============================================================================
// 🚀 CLI Interface
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const dryRun = args.includes('--dry-run');
  
  try {
    switch (command) {
      case 'migrate':
        await migrateToV3({ 
          dryRun, 
          batchSize: 100, 
          timeout: 30000 
        });
        break;
        
      case 'rollback':
        await rollbackMigration(dryRun);
        break;
        
      case 'status':
        await checkMigrationStatus();
        break;
        
      default:
        console.log(`
🚀 CineGenius v3.1 Migration Tool

Usage:
  pnpm tsx scripts/migrate-to-v3.ts migrate [--dry-run]    # Run migration
  pnpm tsx scripts/migrate-to-v3.ts rollback [--dry-run]   # Rollback migration
  pnpm tsx scripts/migrate-to-v3.ts status                 # Check status

Options:
  --dry-run    # Run without making actual changes
        `);
        break;
    }
    
  } catch (error) {
    console.error('💥 Operation failed:', error);
    process.exit(1);
    
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main();
}

export { migrateToV3, rollbackMigration, checkMigrationStatus };