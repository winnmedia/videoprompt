// Schema validation and utility exports
import { z } from 'zod';

// Re-export all schema types and functions
export * from './cinegenius-v3.1.types';
export * from './cinegenius-v3.1.zod';
export * from './cinegenius-v3.1-simple';
export * from './cinegenius-v3.1.compiler';

// Universal prompt schema for backward compatibility
export const UniversalPromptSchema = z.object({
  scenarioId: z.string().uuid(),
  metadata: z.any(),
  timeline: z.any(),
  negative: z.any().optional(),
  version: z.number().int().min(1).default(1),
});

// CineGenius v3 prompt schema
export const CineGeniusV3PromptSchema = z.object({
  version: z.string().default('3.1'),
  projectId: z.string().uuid(),
  userInput: z.object({
    directPrompt: z.string().optional(),
    oneLineScenario: z.string().optional(),
  }),
  projectConfig: z.object({
    projectName: z.string(),
    videoLength: z.number().default(10),
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '21:9']).default('16:9'),
  }),
  promptBlueprint: z.object({
    metadata: z.any(),
    elements: z.any().optional(),
    timeline: z.any(),
  }),
  generationControl: z.any().optional(),
  aiAnalysis: z.any().optional(),
  finalOutput: z.object({
    finalPromptText: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    negativePrompts: z.array(z.string()).default([]),
  }),
});

/**
 * Detect prompt version from input data
 */
export function detectPromptVersion(data: any): string {
  if (data?.version === '3.1' || data?.cinegeniusVersion === '3.1' || data?.projectConfig) {
    return '3.1';
  }
  return '2.0';
}

/**
 * Validate data by version
 */
export function validateByVersion(data: any, version: string) {
  if (version === '3.1') {
    return CineGeniusV3PromptSchema.parse(data);
  } else {
    return UniversalPromptSchema.parse(data);
  }
}

// Export types for TypeScript usage
export type UniversalPrompt = z.infer<typeof UniversalPromptSchema>;
export type CineGeniusV3Prompt = z.infer<typeof CineGeniusV3PromptSchema>;