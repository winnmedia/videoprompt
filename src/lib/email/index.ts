/**
 * Email Service Public API
 * Exports all public interfaces for the email module
 * 
 * @module email
 * @layer shared/lib
 */

// Export main sender functions
export {
  sendEmail,
  sendBatchEmails,
  sendTemplateEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  validateEmailConfiguration,
  getEmailServiceStatus,
  EmailServiceError,
} from './sender';

// Export template functions
export {
  generateVerificationTemplate,
  generatePasswordResetTemplate,
  generateWelcomeTemplate,
  getTemplate,
} from './templates';

// Export SendGrid client utilities
export {
  getSendGridClient,
  getSendGridConfig,
  getSendGridInstance,
} from './sendgrid';

// Export types and schemas from contracts
export {
  // Schemas
  EmailAddressSchema,
  EmailRecipientSchema,
  EmailSenderSchema,
  EmailTemplateType,
  BaseTemplateDataSchema,
  VerificationTemplateDataSchema,
  PasswordResetTemplateDataSchema,
  WelcomeTemplateDataSchema,
  SendEmailRequestSchema,
  SendEmailResponseSchema,
  EmailErrorSchema,
  EmailServiceConfigSchema,
  BatchEmailRequestSchema,
  BatchEmailResponseSchema,
  EmailStatusEnum,
  EmailTrackingEventSchema,
  // Types
  type SendEmailRequest,
  type SendEmailResponse,
  type EmailError,
  type EmailServiceConfig,
  type BatchEmailRequest,
  type BatchEmailResponse,
  type EmailStatus,
  type EmailTrackingEvent,
} from './contracts/email.schema';