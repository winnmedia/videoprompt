/**
 * Email Service Contract Definitions
 * OpenAPI-compliant schemas for email operations
 * 
 * @module email/contracts
 * @layer shared/lib
 */

import { z } from 'zod';

// ============================================================================
// Base Email Schemas
// ============================================================================

/**
 * Email address validation schema
 * RFC 5322 compliant email validation
 */
export const EmailAddressSchema = z
  .string()
  .email()
  .min(3)
  .max(254)
  .describe('Valid email address');

/**
 * Email recipient schema
 */
export const EmailRecipientSchema = z.object({
  email: EmailAddressSchema,
  name: z.string().min(1).max(100).optional(),
});

/**
 * Email sender schema with required fields
 */
export const EmailSenderSchema = z.object({
  email: EmailAddressSchema,
  name: z.string().min(1).max(100),
});

// ============================================================================
// Email Template Schemas
// ============================================================================

/**
 * Email template types enum
 */
export const EmailTemplateType = z.enum([
  'verification',
  'password_reset',
  'welcome',
  'notification',
]);

export type EmailTemplateType = z.infer<typeof EmailTemplateType>;

/**
 * Base template data schema
 */
export const BaseTemplateDataSchema = z.object({
  recipientName: z.string().min(1).max(100),
  appName: z.string().default('VideoPlanet'),
  appUrl: z.string().url().default('https://videoplanet.app'),
  supportEmail: z.string().email().default('support@vlanet.net'),
  year: z.number().default(new Date().getFullYear()),
});

/**
 * Email verification template data
 */
export const VerificationTemplateDataSchema = BaseTemplateDataSchema.extend({
  verificationLink: z.string().url(),
  verificationCode: z.string().length(6),
  expiresIn: z.string().default('24 hours'),
});

/**
 * Password reset template data
 */
export const PasswordResetTemplateDataSchema = BaseTemplateDataSchema.extend({
  resetLink: z.string().url(),
  resetCode: z.string().length(6),
  expiresIn: z.string().default('1 hour'),
  ipAddress: z.string()
    .regex(
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      'Invalid IP address'
    )
    .optional(),
  userAgent: z.string().optional(),
});

/**
 * Welcome email template data
 */
export const WelcomeTemplateDataSchema = BaseTemplateDataSchema.extend({
  dashboardLink: z.string().url(),
  gettingStartedLink: z.string().url(),
  features: z.array(z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string().optional(),
  })).optional(),
});

// ============================================================================
// Email Request/Response Schemas
// ============================================================================

/**
 * Send email request schema
 */
export const SendEmailRequestSchema = z.object({
  to: z.union([EmailRecipientSchema, z.array(EmailRecipientSchema)]),
  from: EmailSenderSchema.optional(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  text: z.string().optional(),
  replyTo: EmailAddressSchema.optional(),
  cc: z.array(EmailRecipientSchema).optional(),
  bcc: z.array(EmailRecipientSchema).optional(),
  attachments: z.array(z.object({
    content: z.string(),
    filename: z.string(),
    type: z.string().optional(),
    disposition: z.enum(['attachment', 'inline']).optional(),
    contentId: z.string().optional(),
  })).optional(),
  trackingSettings: z.object({
    clickTracking: z.object({
      enable: z.boolean(),
      enableText: z.boolean().optional(),
    }).optional(),
    openTracking: z.object({
      enable: z.boolean(),
      substitutionTag: z.string().optional(),
    }).optional(),
  }).optional(),
  customArgs: z.record(z.string()).optional(),
  sendAt: z.number().optional(),
  batchId: z.string().optional(),
  categories: z.array(z.string()).max(10).optional(),
});

export type SendEmailRequest = z.infer<typeof SendEmailRequestSchema>;

/**
 * Send email response schema
 */
export const SendEmailResponseSchema = z.object({
  messageId: z.string(),
  statusCode: z.number(),
  headers: z.record(z.string()).optional(),
  timestamp: z.string().datetime(),
});

export type SendEmailResponse = z.infer<typeof SendEmailResponseSchema>;

/**
 * Email error schema
 */
export const EmailErrorSchema = z.object({
  code: z.enum([
    'INVALID_API_KEY',
    'RATE_LIMIT_EXCEEDED',
    'INVALID_RECIPIENT',
    'INVALID_SENDER',
    'TEMPLATE_NOT_FOUND',
    'TEMPLATE_RENDER_ERROR',
    'NETWORK_ERROR',
    'UNKNOWN_ERROR',
  ]),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

export type EmailError = z.infer<typeof EmailErrorSchema>;

// ============================================================================
// Email Service Configuration Schema
// ============================================================================

/**
 * Email service configuration schema
 */
export const EmailServiceConfigSchema = z.object({
  apiKey: z.string().min(1),
  defaultFrom: EmailSenderSchema,
  sandboxMode: z.boolean().default(false),
  ipPoolName: z.string().optional(),
  maxRetries: z.number().int().min(0).max(5).default(3),
  retryDelay: z.number().int().min(100).max(10000).default(1000),
  timeout: z.number().int().min(1000).max(30000).default(10000),
  webhookSecret: z.string().optional(),
  rateLimits: z.object({
    perSecond: z.number().int().min(1).max(100).default(10),
    perDay: z.number().int().min(1).max(100000).default(10000),
  }).optional(),
});

export type EmailServiceConfig = z.infer<typeof EmailServiceConfigSchema>;

// ============================================================================
// Batch Email Schemas
// ============================================================================

/**
 * Batch email request schema
 */
export const BatchEmailRequestSchema = z.object({
  emails: z.array(SendEmailRequestSchema).min(1).max(1000),
  batchId: z.string().optional(),
  sendAt: z.number().optional(),
});

export type BatchEmailRequest = z.infer<typeof BatchEmailRequestSchema>;

/**
 * Batch email response schema
 */
export const BatchEmailResponseSchema = z.object({
  batchId: z.string(),
  accepted: z.number(),
  rejected: z.number(),
  errors: z.array(EmailErrorSchema).optional(),
});

export type BatchEmailResponse = z.infer<typeof BatchEmailResponseSchema>;

// ============================================================================
// Email Status Schemas
// ============================================================================

/**
 * Email status enum
 */
export const EmailStatusEnum = z.enum([
  'pending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'blocked',
  'spam',
  'unsubscribed',
  'failed',
]);

export type EmailStatus = z.infer<typeof EmailStatusEnum>;

/**
 * Email tracking event schema
 */
export const EmailTrackingEventSchema = z.object({
  messageId: z.string(),
  event: EmailStatusEnum,
  timestamp: z.string().datetime(),
  recipient: EmailAddressSchema,
  metadata: z.record(z.unknown()).optional(),
});

export type EmailTrackingEvent = z.infer<typeof EmailTrackingEventSchema>;