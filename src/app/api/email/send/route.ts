/**
 * Email Send API Route
 * RESTful endpoint for sending emails
 * 
 * @module api/email/send
 * @layer app
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { z } from 'zod';
import {
  sendEmail,
  sendTemplateEmail,
  EmailServiceError,
  SendEmailRequestSchema,
  EmailTemplateType,
} from '@/lib/email';

/**
 * API request schema for sending emails
 */
const ApiSendEmailRequestSchema = z.object({
  // Template-based email
  template: z.object({
    type: EmailTemplateType,
    data: z.record(z.string(), z.unknown()),
  }).optional(),
  
  // Direct email fields
  to: z.union([
    z.string().email(),
    z.array(z.string().email()),
    z.object({ email: z.string().email(), name: z.string().optional() }),
    z.array(z.object({ email: z.string().email(), name: z.string().optional() })),
  ]),
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  
  // Optional fields
  replyTo: z.string().email().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  categories: z.array(z.string()).optional(),
});

type ApiSendEmailRequest = z.infer<typeof ApiSendEmailRequestSchema>;

/**
 * POST /api/email/send
 * Send an email using either template or direct content
 * 
 * @openapi
 * /api/email/send:
 *   post:
 *     summary: Send an email
 *     description: Send an email using either a predefined template or custom content
 *     tags:
 *       - Email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *             properties:
 *               template:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [verification, password_reset, welcome]
 *                   data:
 *                     type: object
 *               to:
 *                 oneOf:
 *                   - type: string
 *                     format: email
 *                   - type: array
 *                     items:
 *                       type: string
 *                       format: email
 *                   - type: object
 *                     properties:
 *                       email:
 *                         type: string
 *                         format: email
 *                       name:
 *                         type: string
 *               subject:
 *                 type: string
 *               html:
 *                 type: string
 *               text:
 *                 type: string
 *               replyTo:
 *                 type: string
 *                 format: email
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 messageId:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: object
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 code:
 *                   type: string
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedRequest = ApiSendEmailRequestSchema.parse(body);
    
    // Normalize recipient format
    const normalizeRecipient = (recipient: any) => {
      if (typeof recipient === 'string') {
        return { email: recipient };
      }
      return recipient;
    };
    
    const normalizedTo = Array.isArray(validatedRequest.to)
      ? validatedRequest.to.map(normalizeRecipient)
      : normalizeRecipient(validatedRequest.to);
    
    let response;
    
    // Check if using template
    if (validatedRequest.template) {
      response = await sendTemplateEmail(
        validatedRequest.template.type,
        validatedRequest.template.data,
        normalizedTo,
        {
          subject: validatedRequest.subject,
          replyTo: validatedRequest.replyTo,
          categories: validatedRequest.categories,
        }
      );
    } else {
      // Direct email send
      if (!validatedRequest.html && !validatedRequest.text) {
        return NextResponse.json(
          {
            error: 'Either html or text content is required when not using a template',
            details: { missing: ['html', 'text'] },
          },
          { status: 400 }
        );
      }
      
      if (!validatedRequest.subject) {
        return NextResponse.json(
          {
            error: 'Subject is required when not using a template',
            details: { missing: ['subject'] },
          },
          { status: 400 }
        );
      }
      
      response = await sendEmail({
        to: normalizedTo,
        subject: validatedRequest.subject,
        html: validatedRequest.html || '',
        text: validatedRequest.text,
        replyTo: validatedRequest.replyTo,
        cc: validatedRequest.cc?.map(email => ({ email })),
        bcc: validatedRequest.bcc?.map(email => ({ email })),
        categories: validatedRequest.categories,
      });
    }
    
    // Return success response
    return NextResponse.json(
      {
        success: true,
        messageId: response.messageId,
        timestamp: response.timestamp,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] Email send error:', error instanceof Error ? error : new Error(String(error)));
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.issues,
        },
        { status: 400 }
      );
    }
    
    // Handle email service errors
    if (error instanceof EmailServiceError) {
      const statusCode = 
        error.code === 'INVALID_API_KEY' ? 401 :
        error.code === 'RATE_LIMIT_EXCEEDED' ? 429 :
        error.code === 'INVALID_RECIPIENT' || error.code === 'INVALID_SENDER' ? 400 :
        500;
      
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: statusCode }
      );
    }
    
    // Handle unexpected errors
    return NextResponse.json(
      {
        error: 'Failed to send email',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/email/send
 * Get email service status
 */
export async function GET() {
  try {
    const { getEmailServiceStatus } = await import('@/lib/email');
    const status = getEmailServiceStatus();
    
    return NextResponse.json(
      {
        status: 'healthy',
        service: status,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] Email status error:', error instanceof Error ? error : new Error(String(error)));
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Failed to get email service status',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}