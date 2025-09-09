/**
 * Email Sender Module
 * High-level utility functions for sending emails with retry logic and error handling
 * 
 * @module email/sender
 * @layer shared/lib
 */

import { z } from 'zod';
import { MailDataRequired } from '@sendgrid/mail';
import { getSendGridClient, getSendGridConfig } from './sendgrid';
import { getTemplate } from './templates';
import {
  SendEmailRequestSchema,
  SendEmailResponseSchema,
  EmailErrorSchema,
  EmailTemplateType,
  BatchEmailRequestSchema,
  BatchEmailResponseSchema,
  type SendEmailRequest,
  type SendEmailResponse,
  type EmailError,
  type BatchEmailRequest,
  type BatchEmailResponse,
} from './contracts/email.schema';

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom email error class
 */
export class EmailServiceError extends Error {
  public readonly code: EmailError['code'];
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(code: EmailError['code'], message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'EmailServiceError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON(): EmailError {
    return EmailErrorSchema.parse({
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    });
  }
}

/**
 * Parse SendGrid error response
 */
function parseSendGridError(error: any): EmailServiceError {
  // Handle rate limit errors
  if (error.code === 429 || error.response?.statusCode === 429) {
    return new EmailServiceError(
      'RATE_LIMIT_EXCEEDED',
      'SendGrid rate limit exceeded',
      { retryAfter: error.response?.headers?.['retry-after'] }
    );
  }

  // Handle authentication errors
  if (error.code === 401 || error.response?.statusCode === 401) {
    return new EmailServiceError(
      'INVALID_API_KEY',
      'Invalid SendGrid API key',
      { statusCode: 401 }
    );
  }

  // Handle invalid recipient errors
  if (error.code === 400 && error.message?.includes('recipient')) {
    return new EmailServiceError(
      'INVALID_RECIPIENT',
      'Invalid recipient email address',
      { error: error.response?.body }
    );
  }

  // Handle network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return new EmailServiceError(
      'NETWORK_ERROR',
      'Network error occurred while sending email',
      { code: error.code }
    );
  }

  // Default error
  return new EmailServiceError(
    'UNKNOWN_ERROR',
    error.message || 'An unknown error occurred',
    { originalError: error }
  );
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Exponential backoff with jitter
 */
function calculateBackoff(attempt: number, baseDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof EmailServiceError) {
        if (['INVALID_API_KEY', 'INVALID_RECIPIENT', 'INVALID_SENDER'].includes(error.code)) {
          throw error;
        }
      }

      // Last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate and apply backoff
      const delay = calculateBackoff(attempt, baseDelay);
      console.log(`[Email] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================================================
// Core Send Functions
// ============================================================================

/**
 * Send a single email
 */
export async function sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
  try {
    // Validate request
    const validatedRequest = SendEmailRequestSchema.parse(request);
    
    // Get client and config
    const client = getSendGridClient();
    const config = getSendGridConfig();
    
    // Prepare SendGrid message
    const message: MailDataRequired = {
      to: Array.isArray(validatedRequest.to) 
        ? validatedRequest.to.map(r => ({ email: r.email, name: r.name }))
        : { email: validatedRequest.to.email, name: validatedRequest.to.name },
      from: validatedRequest.from || config.defaultFrom,
      subject: validatedRequest.subject,
      html: validatedRequest.html,
      text: validatedRequest.text,
      replyTo: validatedRequest.replyTo,
      cc: validatedRequest.cc?.map(r => ({ email: r.email, name: r.name })),
      bcc: validatedRequest.bcc?.map(r => ({ email: r.email, name: r.name })),
      attachments: validatedRequest.attachments,
      trackingSettings: validatedRequest.trackingSettings as any,
      customArgs: validatedRequest.customArgs,
      sendAt: validatedRequest.sendAt,
      batchId: validatedRequest.batchId,
      categories: validatedRequest.categories,
      mailSettings: config.sandboxMode ? { sandboxMode: { enable: true } } : undefined,
    };
    
    // Send with retry
    const [response] = await retryWithBackoff(
      () => client.send(message),
      config.maxRetries,
      config.retryDelay
    );
    
    // Build response
    const result: SendEmailResponse = {
      messageId: response.headers['x-message-id'] || '',
      statusCode: response.statusCode,
      headers: response.headers as Record<string, string>,
      timestamp: new Date().toISOString(),
    };
    
    // Log success
    console.log('[Email] Sent successfully', {
      messageId: result.messageId,
      to: Array.isArray(validatedRequest.to) 
        ? validatedRequest.to.map(r => r.email) 
        : validatedRequest.to.email,
      subject: validatedRequest.subject,
      sandboxMode: config.sandboxMode,
    });
    
    return SendEmailResponseSchema.parse(result);
  } catch (error) {
    const emailError = error instanceof EmailServiceError 
      ? error 
      : parseSendGridError(error);
    
    console.error('[Email] Send failed', emailError.toJSON());
    throw emailError;
  }
}

/**
 * Send multiple emails in batch
 */
export async function sendBatchEmails(request: BatchEmailRequest): Promise<BatchEmailResponse> {
  try {
    // Validate request
    const validatedRequest = BatchEmailRequestSchema.parse(request);
    
    // Get client
    const client = getSendGridClient();
    const config = getSendGridConfig();
    
    // Prepare messages
    const messages = validatedRequest.emails.map(email => {
      const validated = SendEmailRequestSchema.parse(email);
      return {
        ...validated,
        from: validated.from || config.defaultFrom,
        batchId: validatedRequest.batchId || validated.batchId,
        sendAt: validatedRequest.sendAt || validated.sendAt,
        mailSettings: config.sandboxMode ? { sandboxMode: { enable: true } } : undefined,
      } as MailDataRequired;
    });
    
    // Send batch with retry
    const responses = await retryWithBackoff(
      () => client.send(messages),
      config.maxRetries,
      config.retryDelay
    );
    
    // Process responses
    const errors: EmailError[] = [];
    let accepted = 0;
    let rejected = 0;
    
    if (Array.isArray(responses)) {
      responses.forEach((response, index) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          accepted++;
        } else {
          rejected++;
          errors.push({
            code: 'UNKNOWN_ERROR',
            message: `Failed to send email ${index}`,
            details: { statusCode: response.statusCode },
            timestamp: new Date().toISOString(),
          });
        }
      });
    } else {
      // Single response for batch
      if (responses[0].statusCode >= 200 && responses[0].statusCode < 300) {
        accepted = messages.length;
      } else {
        rejected = messages.length;
      }
    }
    
    const result: BatchEmailResponse = {
      batchId: validatedRequest.batchId || `batch_${Date.now()}`,
      accepted,
      rejected,
      errors: errors.length > 0 ? errors : undefined,
    };
    
    console.log('[Email] Batch sent', {
      batchId: result.batchId,
      accepted: result.accepted,
      rejected: result.rejected,
      sandboxMode: config.sandboxMode,
    });
    
    return BatchEmailResponseSchema.parse(result);
  } catch (error) {
    const emailError = error instanceof EmailServiceError 
      ? error 
      : parseSendGridError(error);
    
    console.error('[Email] Batch send failed', emailError.toJSON());
    throw emailError;
  }
}

// ============================================================================
// Template-based Send Functions
// ============================================================================

/**
 * Send email using template
 */
export async function sendTemplateEmail(
  type: EmailTemplateType,
  templateData: any,
  recipients: SendEmailRequest['to'],
  options?: Partial<SendEmailRequest>
): Promise<SendEmailResponse> {
  try {
    // Generate template
    const { html, text, subject } = getTemplate(type, templateData);
    
    // Prepare email request
    const request: SendEmailRequest = {
      ...options,
      to: recipients,
      subject: options?.subject || subject,
      html,
      text,
    };
    
    // Send email
    return await sendEmail(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new EmailServiceError(
        'TEMPLATE_RENDER_ERROR',
        'Failed to render email template',
        { errors: error.errors }
      );
    }
    throw error;
  }
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(
  recipientEmail: string,
  recipientName: string,
  verificationLink: string,
  verificationCode: string
): Promise<SendEmailResponse> {
  return sendTemplateEmail(
    'verification',
    {
      recipientName,
      verificationLink,
      verificationCode,
      expiresIn: '24 hours',
    },
    { email: recipientEmail, name: recipientName }
  );
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  recipientEmail: string,
  recipientName: string,
  resetLink: string,
  resetCode: string,
  securityInfo?: { ipAddress?: string; userAgent?: string }
): Promise<SendEmailResponse> {
  return sendTemplateEmail(
    'password_reset',
    {
      recipientName,
      resetLink,
      resetCode,
      expiresIn: '1 hour',
      ...securityInfo,
    },
    { email: recipientEmail, name: recipientName }
  );
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(
  recipientEmail: string,
  recipientName: string,
  dashboardLink: string,
  gettingStartedLink: string,
  features?: Array<{ title: string; description: string }>
): Promise<SendEmailResponse> {
  return sendTemplateEmail(
    'welcome',
    {
      recipientName,
      dashboardLink,
      gettingStartedLink,
      features,
    },
    { email: recipientEmail, name: recipientName }
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate email configuration
 */
export async function validateEmailConfiguration(): Promise<boolean> {
  try {
    const config = getSendGridConfig();
    
    // Try to send a test email in sandbox mode
    await sendEmail({
      to: { email: 'test@example.com', name: 'Test User' },
      subject: 'Configuration Test',
      html: '<p>This is a configuration test email.</p>',
      text: 'This is a configuration test email.',
    });
    
    console.log('[Email] Configuration validated successfully');
    return true;
  } catch (error) {
    console.error('[Email] Configuration validation failed:', error);
    return false;
  }
}

/**
 * Get email service status
 */
export function getEmailServiceStatus(): {
  configured: boolean;
  sandboxMode: boolean;
  defaultFrom: string;
  rateLimits?: { perSecond: number; perDay: number };
} {
  try {
    const config = getSendGridConfig();
    return {
      configured: true,
      sandboxMode: config.sandboxMode,
      defaultFrom: config.defaultFrom.email,
      rateLimits: config.rateLimits,
    };
  } catch {
    return {
      configured: false,
      sandboxMode: true,
      defaultFrom: '',
    };
  }
}