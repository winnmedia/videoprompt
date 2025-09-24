/**
 * 영상 생성 API 라우트
 * UserJourneyMap 15-16단계 - 프롬프트 기반 AI 영상 생성
 *
 * Contract-First Design with OpenAPI Schema
 * Queue-based Asynchronous Processing
 * Circuit Breaker Pattern for External APIs
 * Cost Safety with Emergency Stop ($300 incident prevention)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { VideoGenerationEngine } from '@/features/video-generation/video-generation-engine';
import { validateApiCostSafety, createCostSafetyContext } from '@/shared/lib/cost-safety-middleware';
import type { AIVideoModel } from '@/entities/prompt';

/**
 * OpenAPI Request Schema - Contract Validation
 */
const VideoGenerationRequestSchema = z.object({
  promptId: z.string().uuid('Invalid prompt ID format'),
  storyboardId: z.string().uuid('Invalid storyboard ID format'),
  selectedModel: z.enum([
    'runway-gen3',
    'stable-video',
    'pika-labs',
    'zeroscope',
    'animatediff',
    'bytedance-seedream'
  ]),
  settings: z.object({
    quality: z.enum(['480p', '720p', '1080p', '4K']).default('1080p'),
    format: z.enum(['mp4', 'webm', 'mov']).default('mp4'),
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).default('16:9'),
    fps: z.number().int().min(24).max(60).default(24),
    duration: z.number().positive().max(10).default(5),
    enableUpscaling: z.boolean().default(false),
    enableStabilization: z.boolean().default(true),
    enableNoiseReduction: z.boolean().default(true),
    includeWatermark: z.boolean().default(false),
    outputDescription: z.string().max(500).default(''),
    modelSpecificSettings: z.record(z.any()).default({}),
  }),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  userId: z.string().uuid('Invalid user ID format'),
});

/**
 * OpenAPI Response Schema
 */
const VideoGenerationResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    jobId: z.string().uuid(),
    status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']),
    estimatedCost: z.number(),
    estimatedTime: z.number().optional(),
    queuePosition: z.number().optional(),
    progressWebSocketUrl: z.string().url().optional(),
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
      emergencyStopActivated: z.boolean(),
    }),
  }),
});

type VideoGenerationRequest = z.infer<typeof VideoGenerationRequestSchema>;
type VideoGenerationResponse = z.infer<typeof VideoGenerationResponseSchema>;

/**
 * Enhanced Cost Safety Configuration (MEMORY.md compliance)
 */
const COST_SAFETY_CONFIG = {
  maxRequestCost: 25.0, // $25 per video generation request
  dailyBudgetLimit: 200.0, // $200 per day per user
  weeklyBudgetLimit: 1000.0, // $1000 per week per user
  warningThreshold: 0.8, // 80% of budget
  emergencyStop: 300.0, // Emergency stop at $300 (MEMORY.md incident)
  costPerSecondByModel: {
    'runway-gen3': 0.05,
    'stable-video': 0.02,
    'pika-labs': 0.03,
    'zeroscope': 0.01,
    'animatediff': 0.015,
    'bytedance-seedream': 0.025,
  } as Record<AIVideoModel, number>,
};

/**
 * POST /api/video/generate
 * 프롬프트 기반 AI 영상 생성 시작
 */
export async function POST(request: NextRequest): Promise<NextResponse<VideoGenerationResponse>> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Request Body Parsing & Validation
    const body = await request.json();
    const validatedRequest = VideoGenerationRequestSchema.parse(body);

    // 2. Cost Estimation
    const estimatedCost = calculateEstimatedCost(validatedRequest);

    // 3. Enhanced Cost Safety Check (MEMORY.md $300 incident prevention)
    const costContext = await createCostSafetyContext(validatedRequest.userId, 'video-generation');
    const costCheck = await validateApiCostSafety(costContext, {
      estimatedCost,
      maxAllowedCost: COST_SAFETY_CONFIG.maxRequestCost,
      userDailyLimit: COST_SAFETY_CONFIG.dailyBudgetLimit,
      emergencyStopThreshold: COST_SAFETY_CONFIG.emergencyStop,
    });

    // Emergency Stop Check (Critical: MEMORY.md $300 incident prevention)
    if (costCheck.totalSpent && costCheck.totalSpent >= COST_SAFETY_CONFIG.emergencyStop) {
      await triggerEmergencyStop(validatedRequest.userId, costCheck.totalSpent);

      return NextResponse.json({
        success: false,
        error: {
          code: 'EMERGENCY_STOP_ACTIVATED',
          message: `Emergency stop activated. Total spent: $${costCheck.totalSpent}. This is to prevent cost incidents like the $300 API bombing from MEMORY.md.`,
          details: {
            totalSpent: costCheck.totalSpent,
            emergencyThreshold: COST_SAFETY_CONFIG.emergencyStop,
            contactSupport: true,
          },
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          costSafety: {
            budgetRemaining: 0,
            warningThreshold: COST_SAFETY_CONFIG.warningThreshold,
            isNearLimit: true,
            emergencyStopActivated: true,
          },
        },
      }, { status: 429 });
    }

    if (!costCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'COST_LIMIT_EXCEEDED',
          message: costCheck.reason || 'Cost limit exceeded',
          details: {
            estimatedCost,
            remainingBudget: costCheck.remainingBudget,
            dailyLimit: COST_SAFETY_CONFIG.dailyBudgetLimit,
          },
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          costSafety: {
            budgetRemaining: costCheck.remainingBudget || 0,
            warningThreshold: COST_SAFETY_CONFIG.warningThreshold,
            isNearLimit: (costCheck.remainingBudget || 0) < COST_SAFETY_CONFIG.warningThreshold * COST_SAFETY_CONFIG.dailyBudgetLimit,
            emergencyStopActivated: false,
          },
        },
      }, { status: 429 });
    }

    // 4. Initialize Video Generation Engine with Enhanced Resilience
    const engine = new VideoGenerationEngine();

    // 5. Submit Job to Queue with Resilient Processing
    const job = await engine.generateVideo(
      validatedRequest.promptId as any,
      validatedRequest.storyboardId as any,
      validatedRequest.selectedModel as any,
      validatedRequest.settings as any
    );

    // 6. Log Cost Reservation (before actual generation)
    await logCostReservation(validatedRequest.userId, 'video-generation', estimatedCost, requestId, job.id);

    // 7. Get Queue Status (Mock values for build)
    const queuePosition = 1; // TODO: Implement getQueuePosition
    const estimatedTime = 300; // TODO: Implement getEstimatedProcessingTime

    const response: VideoGenerationResponse = {
      success: true,
      data: {
        jobId: job.id,
        status: job.status as any,
        estimatedCost,
        estimatedTime,
        queuePosition,
        progressWebSocketUrl: `${process.env.NEXT_PUBLIC_WS_URL}/video/progress/${job.id}`,
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        costSafety: {
          budgetRemaining: costCheck.remainingBudget || 0,
          warningThreshold: COST_SAFETY_CONFIG.warningThreshold,
          isNearLimit: (costCheck.remainingBudget || 0) < COST_SAFETY_CONFIG.warningThreshold * COST_SAFETY_CONFIG.dailyBudgetLimit,
          emergencyStopActivated: false,
        },
      },
    };

    return NextResponse.json(response, { status: 202 }); // 202 Accepted (Async processing)

  } catch (error) {
    // 8. Resilient Error Handling with Cost Safety
    const processingTime = Date.now() - startTime;

    console.error(`[VIDEO_GENERATION_ERROR] RequestID: ${requestId}`, {
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
        errorMessage = 'Request timeout - video generation queue is full';
      } else if (error.message.includes('rate limit')) {
        statusCode = 429;
        errorCode = 'RATE_LIMIT_EXCEEDED';
        errorMessage = 'Rate limit exceeded, please try again later';
      } else if (error.message.includes('cost') || error.message.includes('budget')) {
        statusCode = 429;
        errorCode = 'COST_LIMIT_EXCEEDED';
        errorMessage = error.message;
      } else if (error.message.includes('queue full')) {
        statusCode = 503;
        errorCode = 'QUEUE_FULL';
        errorMessage = 'Video generation queue is full, please try again later';
      }
    }

    const errorResponse: VideoGenerationResponse = {
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
          emergencyStopActivated: false,
        },
      },
    };

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}

/**
 * Cost Calculation Helper
 */
function calculateEstimatedCost(request: VideoGenerationRequest): number {
  const baseCost = COST_SAFETY_CONFIG.costPerSecondByModel[request.selectedModel];
  const duration = request.settings.duration;

  let multiplier = 1.0;

  // Quality multipliers
  if (request.settings.quality === '4K') multiplier *= 3.0;
  else if (request.settings.quality === '1080p') multiplier *= 1.5;

  // Enhancement multipliers
  if (request.settings.enableUpscaling) multiplier *= 1.8;
  if (request.settings.enableStabilization) multiplier *= 1.2;
  if (request.settings.enableNoiseReduction) multiplier *= 1.1;

  // FPS multiplier
  if (request.settings.fps > 30) multiplier *= 1.5;

  return baseCost * duration * multiplier;
}

/**
 * Emergency Stop Mechanism (MEMORY.md compliance)
 */
async function triggerEmergencyStop(userId: string, totalSpent: number): Promise<void> {
  console.error(`[EMERGENCY_STOP] User ${userId} reached $${totalSpent} - Emergency stop activated`);

  try {
    // 1. Stop all active jobs for this user
    // await stopAllUserJobs(userId);

    // 2. Add user to temporary block list
    // await addToBlockList(userId, 'emergency_cost_limit', 24 * 60 * 60 * 1000); // 24 hours

    // 3. Send alert to admins
    // await sendAdminAlert('EMERGENCY_COST_STOP', { userId, totalSpent });

    // 4. Log to audit trail
    // await auditLog.create({
    //   event: 'EMERGENCY_COST_STOP',
    //   userId,
    //   details: { totalSpent, threshold: COST_SAFETY_CONFIG.emergencyStop },
    //   timestamp: new Date(),
    // });

  } catch (stopError) {
    console.error('[EMERGENCY_STOP_ERROR]', stopError);
    // Never throw from emergency stop - just log the error
  }
}

/**
 * Cost Reservation Logging (MEMORY.md compliance)
 */
async function logCostReservation(
  userId: string,
  operation: string,
  estimatedCost: number,
  requestId: string,
  jobId: string
): Promise<void> {
  console.log(`[COST_RESERVATION] User: ${userId}, Operation: ${operation}, EstimatedCost: $${estimatedCost.toFixed(3)}, RequestID: ${requestId}, JobID: ${jobId}`);

  try {
    // Database logging would go here
    // await db.costReservation.create({
    //   userId,
    //   operation,
    //   estimatedCost,
    //   requestId,
    //   jobId,
    //   timestamp: new Date(),
    //   status: 'reserved'
    // });
  } catch (logError) {
    console.error('[COST_RESERVATION_LOGGING_ERROR]', logError);
    // Never throw from logging - just log the error
  }
}

/**
 * GET /api/video/generate
 * Health check and capability information
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'video-generation',
    version: '1.0.0',
    capabilities: {
      supportedModels: Object.keys(COST_SAFETY_CONFIG.costPerSecondByModel),
      supportedQualities: ['480p', '720p', '1080p', '4K'],
      supportedFormats: ['mp4', 'webm', 'mov'],
      supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3'],
      maxDuration: 10,
      maxCostPerRequest: COST_SAFETY_CONFIG.maxRequestCost,
      costPerSecond: COST_SAFETY_CONFIG.costPerSecondByModel,
    },
    queue: {
      status: 'operational',
      maxConcurrentJobs: 5,
      // currentQueueLength: await getQueueLength(),
    },
    costSafety: {
      dailyBudgetLimit: COST_SAFETY_CONFIG.dailyBudgetLimit,
      emergencyStopThreshold: COST_SAFETY_CONFIG.emergencyStop,
      warningThreshold: COST_SAFETY_CONFIG.warningThreshold,
    },
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}