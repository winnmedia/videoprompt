/**
 * Email Service Test Suite
 * Comprehensive tests for email service with MSW mocking
 * 
 * @module email/tests
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { z } from 'zod';

// Mock environment variables BEFORE importing modules
const mockEnv = {
  SENDGRID_API_KEY: 'SG.test_api_key',
  SENDGRID_FROM_EMAIL: 'test@vlanet.net',
  SENDGRID_FROM_NAME: 'Test Service',
  NODE_ENV: 'test',
};

// Set environment variables before any imports
Object.assign(process.env, mockEnv);

// Mock SendGrid module
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    setTimeout: vi.fn(),
    send: vi.fn(),
  },
}));

// Now import modules after environment is set
import {
  sendEmail,
  sendBatchEmails,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  EmailServiceError,
  validateEmailConfiguration,
  getEmailServiceStatus,
} from '../index';
import {
  generateVerificationTemplate,
  generatePasswordResetTemplate,
  generateWelcomeTemplate,
} from '../templates';
import { SendEmailRequestSchema } from '../contracts/email.schema';

// Get mocked module
const mockSgMail = vi.mocked((await import('@sendgrid/mail')).default);

describe('Email Service', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear mocks after each test
    vi.clearAllMocks();
  });

  describe('Contract Validation', () => {
    it('should validate email request schema', () => {
      const validRequest = {
        to: { email: 'user@example.com', name: 'Test User' },
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
      };

      const result = SendEmailRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      const invalidRequest = {
        to: { email: 'invalid-email', name: 'Test User' },
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = SendEmailRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email');
      }
    });

    it('should reject empty subject', () => {
      const invalidRequest = {
        to: { email: 'user@example.com' },
        subject: '',
        html: '<p>Test content</p>',
      };

      const result = SendEmailRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should accept array of recipients', () => {
      const validRequest = {
        to: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' },
        ],
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = SendEmailRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });
  });

  describe('Template Generation', () => {
    describe('Verification Template', () => {
      it('should generate verification email template', () => {
        const data = {
          recipientName: '홍길동',
          verificationLink: 'https://app.example.com/verify?token=abc123',
          verificationCode: '123456',
          expiresIn: '24 hours',
        };

        const result = generateVerificationTemplate(data);
        
        expect(result.html).toContain('이메일 인증');
        expect(result.html).toContain(data.recipientName);
        expect(result.html).toContain(data.verificationLink);
        expect(result.html).toContain(data.verificationCode);
        expect(result.text).toContain(data.verificationLink);
        expect(result.subject).toContain('이메일 인증');
      });

      it('should validate verification template data', () => {
        const invalidData = {
          recipientName: '홍길동',
          verificationLink: 'not-a-valid-url',
          verificationCode: '123', // Too short
        };

        expect(() => generateVerificationTemplate(invalidData as any)).toThrow(z.ZodError);
      });
    });

    describe('Password Reset Template', () => {
      it('should generate password reset email template', () => {
        const data = {
          recipientName: '김철수',
          resetLink: 'https://app.example.com/reset?token=xyz789',
          resetCode: '987654',
          expiresIn: '1 hour',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        };

        const result = generatePasswordResetTemplate(data);
        
        expect(result.html).toContain('비밀번호 재설정');
        expect(result.html).toContain(data.recipientName);
        expect(result.html).toContain(data.resetLink);
        expect(result.html).toContain(data.resetCode);
        expect(result.html).toContain(data.ipAddress);
        expect(result.text).toContain(data.resetLink);
        expect(result.subject).toContain('비밀번호 재설정');
      });

      it('should generate template without optional security info', () => {
        const data = {
          recipientName: '김철수',
          resetLink: 'https://app.example.com/reset?token=xyz789',
          resetCode: '987654',
          expiresIn: '1 hour',
        };

        const result = generatePasswordResetTemplate(data);
        
        expect(result.html).toContain('비밀번호 재설정');
        expect(result.html).not.toContain('IP 주소');
      });
    });

    describe('Welcome Template', () => {
      it('should generate welcome email template with features', () => {
        const data = {
          recipientName: '이영희',
          dashboardLink: 'https://app.example.com/dashboard',
          gettingStartedLink: 'https://app.example.com/guide',
          features: [
            { title: '고급 편집 도구', description: '전문가 수준의 비디오 편집 기능' },
            { title: 'AI 지원', description: '인공지능 기반 자동 편집' },
          ],
        };

        const result = generateWelcomeTemplate(data);
        
        expect(result.html).toContain('환영합니다');
        expect(result.html).toContain(data.recipientName);
        expect(result.html).toContain(data.dashboardLink);
        expect(result.html).toContain('고급 편집 도구');
        expect(result.html).toContain('AI 지원');
        expect(result.text).toContain(data.dashboardLink);
        expect(result.subject).toContain('환영합니다');
      });

      it('should generate welcome template without features', () => {
        const data = {
          recipientName: '이영희',
          dashboardLink: 'https://app.example.com/dashboard',
          gettingStartedLink: 'https://app.example.com/guide',
        };

        const result = generateWelcomeTemplate(data);
        
        expect(result.html).toContain('환영합니다');
        expect(result.html).toContain(data.recipientName);
      });
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      // Mock successful send response
      mockSgMail.send.mockResolvedValue([{
        statusCode: 202,
        headers: {
          'x-message-id': 'test-message-id-123',
        },
      }]);
    });

    it('should send email successfully', async () => {
      const request = {
        to: { email: 'user@example.com', name: 'Test User' },
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
      };

      const response = await sendEmail(request);
      
      expect(response.statusCode).toBe(202);
      expect(response.messageId).toBe('test-message-id-123');
      expect(response.timestamp).toBeDefined();
      expect(mockSgMail.send).toHaveBeenCalledTimes(1);
    });

    it('should use default sender when not specified', async () => {
      const request = {
        to: { email: 'user@example.com' },
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      await sendEmail(request);
      
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.objectContaining({
            email: 'test@vlanet.net',
          }),
        })
      );
    });

    it('should handle multiple recipients', async () => {
      const request = {
        to: [
          { email: 'user1@example.com', name: 'User 1' },
          { email: 'user2@example.com', name: 'User 2' },
        ],
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      await sendEmail(request);
      
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.arrayContaining([
            expect.objectContaining({ email: 'user1@example.com' }),
            expect.objectContaining({ email: 'user2@example.com' }),
          ]),
        })
      );
    });

    it('should handle SendGrid API errors', async () => {
      mockSgMail.send.mockRejectedValue({
        code: 401,
        response: { statusCode: 401 },
        message: 'Unauthorized',
      });

      await expect(sendEmail({
        to: { email: 'user@example.com' },
        subject: 'Test',
        html: '<p>Test</p>',
      })).rejects.toThrow(EmailServiceError);
    });

    it('should retry on transient errors', async () => {
      let callCount = 0;
      mockSgMail.send.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve([{
          statusCode: 202,
          headers: { 'x-message-id': 'success-after-retry' },
        }]);
      });

      const response = await sendEmail({
        to: { email: 'user@example.com' },
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(response.messageId).toBe('success-after-retry');
      expect(mockSgMail.send).toHaveBeenCalledTimes(3);
    });
  });

  describe('Batch Email Sending', () => {
    beforeEach(() => {
      mockSgMail.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'batch-123' },
      }]);
    });

    it('should send batch emails successfully', async () => {
      const request = {
        emails: [
          {
            to: { email: 'user1@example.com' },
            subject: 'Email 1',
            html: '<p>Content 1</p>',
          },
          {
            to: { email: 'user2@example.com' },
            subject: 'Email 2',
            html: '<p>Content 2</p>',
          },
        ],
      };

      const response = await sendBatchEmails(request);
      
      expect(response.accepted).toBe(2);
      expect(response.rejected).toBe(0);
      expect(response.batchId).toBeDefined();
    });

    it('should handle partial batch failures', async () => {
      mockSgMail.send.mockResolvedValue([
        { statusCode: 202, headers: {} },
        { statusCode: 400, headers: {} },
      ]);

      const request = {
        emails: [
          {
            to: { email: 'user1@example.com' },
            subject: 'Email 1',
            html: '<p>Content 1</p>',
          },
          {
            to: { email: 'invalid-email' },
            subject: 'Email 2',
            html: '<p>Content 2</p>',
          },
        ],
      };

      const response = await sendBatchEmails(request);
      
      expect(response.accepted).toBe(1);
      expect(response.rejected).toBe(1);
      expect(response.errors).toBeDefined();
    });
  });

  describe('Template Email Functions', () => {
    beforeEach(() => {
      mockSgMail.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'template-email-123' },
      }]);
    });

    it('should send verification email', async () => {
      const response = await sendVerificationEmail(
        'user@example.com',
        '홍길동',
        'https://app.example.com/verify?token=abc',
        '123456'
      );

      expect(response.statusCode).toBe(202);
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('이메일 인증'),
          html: expect.stringContaining('123456'),
        })
      );
    });

    it('should send password reset email', async () => {
      const response = await sendPasswordResetEmail(
        'user@example.com',
        '김철수',
        'https://app.example.com/reset?token=xyz',
        '987654',
        { ipAddress: '192.168.1.1' }
      );

      expect(response.statusCode).toBe(202);
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('비밀번호 재설정'),
          html: expect.stringContaining('987654'),
        })
      );
    });

    it('should send welcome email', async () => {
      const response = await sendWelcomeEmail(
        'user@example.com',
        '이영희',
        'https://app.example.com/dashboard',
        'https://app.example.com/guide',
        [{ title: 'Feature 1', description: 'Description 1' }]
      );

      expect(response.statusCode).toBe(202);
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('환영합니다'),
          html: expect.stringContaining('대시보드'),
        })
      );
    });
  });

  describe('Service Status and Configuration', () => {
    it('should validate configuration successfully', async () => {
      mockSgMail.send.mockResolvedValue([{
        statusCode: 202,
        headers: {},
      }]);

      const isValid = await validateEmailConfiguration();
      expect(isValid).toBe(true);
    });

    it('should return configuration failure on error', async () => {
      mockSgMail.send.mockRejectedValue(new Error('Invalid API key'));

      const isValid = await validateEmailConfiguration();
      expect(isValid).toBe(false);
    });

    it('should return service status', () => {
      const status = getEmailServiceStatus();
      
      expect(status.configured).toBe(true);
      expect(status.sandboxMode).toBe(true); // Test environment
      expect(status.defaultFrom).toBe('test@vlanet.net');
      expect(status.rateLimits).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should create EmailServiceError with correct properties', () => {
      const error = new EmailServiceError(
        'INVALID_RECIPIENT',
        'Invalid email address',
        { email: 'invalid' }
      );

      expect(error.code).toBe('INVALID_RECIPIENT');
      expect(error.message).toBe('Invalid email address');
      expect(error.details).toEqual({ email: 'invalid' });
      expect(error.timestamp).toBeDefined();
      
      const json = error.toJSON();
      expect(json.code).toBe('INVALID_RECIPIENT');
    });

    it('should handle rate limit errors', async () => {
      mockSgMail.send.mockRejectedValue({
        code: 429,
        response: {
          statusCode: 429,
          headers: { 'retry-after': '60' },
        },
      });

      await expect(sendEmail({
        to: { email: 'user@example.com' },
        subject: 'Test',
        html: '<p>Test</p>',
      })).rejects.toThrow(EmailServiceError);
    });

    it('should handle network errors', async () => {
      mockSgMail.send.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      await expect(sendEmail({
        to: { email: 'user@example.com' },
        subject: 'Test',
        html: '<p>Test</p>',
      })).rejects.toThrow(EmailServiceError);
    });
  });
});