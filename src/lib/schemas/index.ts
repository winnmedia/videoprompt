// Schema validation and utility exports
// Migrated from @ts-nocheck to explicit type handling for Vercel build compatibility
import { z } from 'zod';

// Re-export essential types only (avoiding duplicates)
export type { CineGeniusV31 } from './cinegenius-v3.1.types';
export { 
  MAX_VEO_PROMPT_LENGTH,
  MIN_VIDEO_DURATION,
  MAX_VIDEO_DURATION,
} from './cinegenius-v3.1.types';

// Export only non-conflicting Zod schemas
export { 
  UUIDSchema,
  UserInputSchema,
  ProjectConfigSchema,
  PromptBlueprintSchema,
  GenerationControlSchema,
  FinalOutputSchema,
} from './cinegenius-v3.1.zod';

// Export compiler functions if they exist
export { compilePrompt } from './cinegenius-v3.1.compiler';

// Universal prompt schema for backward compatibility
export const UniversalPromptSchema = z.object({
  scenarioId: z.string().uuid(),
  // NOTE: z.unknown() used for backward compatibility with v2.x
  // These fields have flexible schemas that change based on AI model versions
  metadata: z.unknown(), // AI analysis metadata - structure varies by model version
  timeline: z.unknown(), // Timeline data - flexible schema for different formats
  negative: z.unknown().optional(), // Negative prompts - varies by provider
  version: z.number().int().min(1).default(1),
});

// 메모리 절약을 위해 기본 스키마만 유지
export const CineGeniusV3PromptSchema = z.object({
  version: z.string().default('3.1'),
  projectId: z.string().uuid(),
  userInput: z.unknown(),
  projectConfig: z.unknown(),
  promptBlueprint: z.unknown(),
  generationControl: z.unknown().optional(),
  finalOutput: z.unknown().optional(),
});

/**
 * Detect prompt version from input data
 * NOTE: Uses 'unknown' type for maximum compatibility with various data sources
 */
export function detectPromptVersion(data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (obj.version === '3.1' || obj.cinegeniusVersion === '3.1' || obj.projectConfig) {
      return '3.1';
    }
  }
  return '2.0';
}

/**
 * Validate data by version
 * NOTE: Uses 'unknown' type to accept data from external sources before validation
 */
export function validateByVersion(data: unknown, version: string) {
  if (version === '3.1') {
    return CineGeniusV3PromptSchema.parse(data);
  } else {
    return UniversalPromptSchema.parse(data);
  }
}

// Export types for TypeScript usage
export type UniversalPrompt = z.infer<typeof UniversalPromptSchema>;
export type CineGeniusV3Prompt = z.infer<typeof CineGeniusV3PromptSchema>;