import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus } from '@/shared/lib/job-store';
import { logger } from '@/shared/lib/logger';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const job = getJobStatus(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      jobId,
      status: job.status,
      progress: job.progress,
      imageUrl: job.imageUrl,
      error: job.error,
    });
    
  } catch (error) {
    logger.error('Job status check failed', error as Error, {
      operation: 'imagen-status-check'
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

