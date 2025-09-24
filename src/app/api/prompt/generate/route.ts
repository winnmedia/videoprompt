/**
 * 프롬프트 생성 API 라우트
 * UserJourneyMap 12-14단계 - 선택된 숏트에서 AI 모델별 최적화된 프롬프트 생성
 *
 * Contract-First Design with OpenAPI Schema
 * Resilient Error Handling with Circuit Breaker
 * Cost Safety Enforcement ($300 incident prevention)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PromptGenerationEngine } from '@/features/prompt/prompt-generator';
import { validateApiCostSafety, createCostSafetyContext } from '@/shared/lib/cost-safety-middleware';

/**
 * OpenAPI Request Schema - Contract Validation
 */
const PromptGenerationRequestSchema = z.object({
  shotCollectionId: z.string().uuid('Invalid shot collection ID format'),
  selectedShotIds: z.array(z.string().uuid()).min(1, 'At least one shot must be selected').max(12, 'Cannot select more than 12 shots'),
  selectedModels: z.array(z.enum([
    'runway-gen3',
    'stable-video',
    'pika-labs',
    'zeroscope',
    'animatediff',
    'bytedance-seedream'
  ])).min(1, 'At least one AI model must be selected'),
  options: z.object({
    optimizationLevel: z.enum(['basic', 'standard', 'advanced', 'expert']).default('standard'),
    enableAIEnhancement: z.boolean().default(true),
    prioritizeConsistency: z.boolean().default(true),
    maxCostPerPrompt: z.number().positive().max(5.0).default(1.0),
    customTemplateId: z.string().uuid().optional(),
  }),
  userId: z.string().uuid('Invalid user ID format'),
});

/**
 * OpenAPI Response Schema
 */
const PromptGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    prompts: z.array(z.object({
      id: z.string().uuid(),
      sourceShot: z.object({
        id: z.string().uuid(),
        globalOrder: z.number(),
        title: z.string(),
      }),
      qualityScore: z.number().min(0).max(100),
      modelOptimizations: z.record(z.object({
        prompt: z.string(),
        negativePrompt: z.string().optional(),
        estimatedCost: z.number(),
        tokenCount: z.number(),
        qualityPrediction: z.object({
          overallScore: z.number().min(0).max(100),
          consistency: z.number().min(0).max(100),
          creativity: z.number().min(0).max(100),
          technical: z.number().min(0).max(100),
        }),
      })),
      createdAt: z.string().datetime(),
    })),
    totalCost: z.number(),
    processingTime: z.number(),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  metadata: z.object({
    requestId: z.string().uuid(),
    timestamp: z.string().datetime(),
    costSafety: z.object({
      budgetRemaining: z.number(),
      warningThreshold: z.number(),
      isNearLimit: z.boolean(),
    }),
  }),
});

type PromptGenerationRequest = z.infer<typeof PromptGenerationRequestSchema>;
type PromptGenerationResponse = z.infer<typeof PromptGenerationResponseSchema>;

/**
 * Cost Safety Configuration
 */
const COST_SAFETY_CONFIG = {
  maxRequestCost: 10.0, // $10 per request
  dailyBudgetLimit: 100.0, // $100 per day per user
  warningThreshold: 0.8, // 80% of budget
  emergencyStop: 150.0, // Emergency stop at $150
};

/**
 * POST /api/prompt/generate
 * 선택된 숏트들에 대해 AI 모델별 최적화된 프롬프트 생성
 */
export async function POST(request: NextRequest): Promise<NextResponse<PromptGenerationResponse>> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Request Body Parsing & Validation
    const body = await request.json();
    const validatedRequest = PromptGenerationRequestSchema.parse(body);

    // 2. Cost Safety Check (MEMORY.md $300 incident prevention)
    const costContext = await createCostSafetyContext(validatedRequest.userId, 'prompt-generation');
    const costCheck = await validateApiCostSafety(costContext, {
      estimatedCost: estimateCost(validatedRequest),
      maxAllowedCost: COST_SAFETY_CONFIG.maxRequestCost,
      userDailyLimit: COST_SAFETY_CONFIG.dailyBudgetLimit
    });

    if (!costCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'COST_LIMIT_EXCEEDED',
          message: costCheck.reason || 'Cost limit exceeded',
          details: {
            estimatedCost: costCheck.estimatedCost,
            remainingBudget: costCheck.remainingBudget,
          },
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          costSafety: {
            budgetRemaining: costCheck.remainingBudget || 0,
            warningThreshold: COST_SAFETY_CONFIG.warningThreshold,
            isNearLimit: (costCheck.remainingBudget || 0) < COST_SAFETY_CONFIG.warningThreshold * COST_SAFETY_CONFIG.dailyBudgetLimit,
          },
        },
      }, { status: 429 });
    }

    // 3. Initialize Prompt Generation Engine with Circuit Breaker
    const engine = new PromptGenerationEngine();

    // 4. Generate Prompts with Resilient Processing
    // TODO: Implement actual TwelveShotCollection fetching from shotCollectionId
    const mockCollection = {
      id: validatedRequest.shotCollectionId,
      shots: []
    } as any;

    const result = await engine.generateForSelectedShots(
      mockCollection,
      validatedRequest.selectedShotIds,
      validatedRequest.selectedModels,
      validatedRequest.options
    );

    // 5. Validate Generated Response
    const totalCost = result.reduce((sum, prompt) => {
      return sum + Object.values(prompt.modelOptimizations).reduce((modelSum, opt) => modelSum + opt.estimatedCost, 0);
    }, 0);

    // 6. Final Cost Safety Verification
    if (totalCost > COST_SAFETY_CONFIG.maxRequestCost) {
      throw new Error(`Generated cost ${totalCost} exceeds maximum allowed cost ${COST_SAFETY_CONFIG.maxRequestCost}`);
    }

    // 7. Log Cost Usage (for MEMORY.md incident prevention)
    await logCostUsage(validatedRequest.userId, 'prompt-generation', totalCost, requestId);

    const processingTime = Date.now() - startTime;

    const response: PromptGenerationResponse = {
      success: true,
      data: {
        prompts: result.map(prompt => ({
          id: prompt.id,
          sourceShot: {
            id: prompt.sourceShot.id,
            globalOrder: prompt.sourceShot.globalOrder,
            title: prompt.sourceShot.title,
          },
          qualityScore: prompt.qualityScore,
          modelOptimizations: prompt.modelOptimizations as any,
          createdAt: new Date().toISOString(),
        })) as any,
        totalCost,
        processingTime,
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        costSafety: {
          budgetRemaining: costCheck.remainingBudget || 0,
          warningThreshold: COST_SAFETY_CONFIG.warningThreshold,
          isNearLimit: (costCheck.remainingBudget || 0) < COST_SAFETY_CONFIG.warningThreshold * COST_SAFETY_CONFIG.dailyBudgetLimit,
        },
      },
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    // 8. Resilient Error Handling
    const processingTime = Date.now() - startTime;

    console.error(`[PROMPT_GENERATION_ERROR] RequestID: ${requestId}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime,
    });

    // Determine error type and status code
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'Internal server error occurred';

    if (error instanceof z.ZodError) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      errorMessage = 'Request validation failed';
    } else if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        statusCode = 408;
        errorCode = 'REQUEST_TIMEOUT';
        errorMessage = 'Request timeout - generation took too long';
      } else if (error.message.includes('rate limit')) {
        statusCode = 429;
        errorCode = 'RATE_LIMIT_EXCEEDED';
        errorMessage = 'Rate limit exceeded, please try again later';
      } else if (error.message.includes('cost')) {
        statusCode = 429;
        errorCode = 'COST_LIMIT_EXCEEDED';
        errorMessage = error.message;
      }
    }

    const errorResponse: PromptGenerationResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: error instanceof z.ZodError ? error.errors : undefined,
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        costSafety: {
          budgetRemaining: 0,
          warningThreshold: COST_SAFETY_CONFIG.warningThreshold,
          isNearLimit: true,
        },
      },
    };

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

/**
 * Cost Estimation Helper
 */
function estimateCost(request: PromptGenerationRequest): number {
  const baseCostPerShot = 0.1; // $0.10 per shot
  const modelMultiplier = request.selectedModels.length;
  const enhancementMultiplier = request.options.enableAIEnhancement ? 1.5 : 1.0;

  return request.selectedShotIds.length * baseCostPerShot * modelMultiplier * enhancementMultiplier;
}

/**
 * Cost Usage Logging (MEMORY.md compliance)
 */
async function logCostUsage(
  userId: string,
  operation: string,
  cost: number,
  requestId: string
): Promise<void> {
  // Implementation would log to database/monitoring system
  console.log(`[COST_USAGE] User: ${userId}, Operation: ${operation}, Cost: $${cost.toFixed(3)}, RequestID: ${requestId}`);

  // Critical: Ensure this logging never fails and blocks the main flow
  try {
    // Database logging would go here
    // await db.costUsage.create({ userId, operation, cost, requestId, timestamp: new Date() });
  } catch (logError) {
    console.error('[COST_LOGGING_ERROR]', logError);
    // Never throw from logging - just log the error
  }
}

/**
 * GET /api/prompt/generate
 * Health check and capability information
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'prompt-generation',
    version: '1.0.0',
    capabilities: {
      supportedModels: [
        'runway-gen3',
        'stable-video',
        'pika-labs',
        'zeroscope',
        'animatediff',
        'bytedance-seedream'
      ],
      optimizationLevels: ['basic', 'standard', 'advanced', 'expert'],
      maxShotsPerRequest: 12,
      maxCostPerRequest: COST_SAFETY_CONFIG.maxRequestCost,
    },
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}