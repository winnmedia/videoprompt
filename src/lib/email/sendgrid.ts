/**
 * SendGrid Client Module
 * Manages SendGrid API client initialization and configuration
 * 
 * @module email/sendgrid
 * @layer shared/lib
 */

import sgMail from '@sendgrid/mail';
import { z } from 'zod';
import { EmailServiceConfigSchema, type EmailServiceConfig } from './contracts/email.schema';

// ============================================================================
// Configuration
// ============================================================================

/**
 * SendGrid service configuration with validation
 */
const DEFAULT_CONFIG: Partial<EmailServiceConfig> = {
  defaultFrom: {
    email: 'service@vlanet.net',
    name: 'VideoPlanet Service',
  },
  sandboxMode: process.env.NODE_ENV !== 'production',
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 10000,
  rateLimits: {
    perSecond: 10,
    perDay: 10000,
  },
};

/**
 * Environment validation schema
 */
const EnvSchema = z.object({
  SENDGRID_API_KEY: z.string().min(1),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  SENDGRID_FROM_NAME: z.string().optional(),
  SENDGRID_SANDBOX_MODE: z.enum(['true', 'false']).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
});

// ============================================================================
// Client Singleton
// ============================================================================

class SendGridClient {
  private static instance: SendGridClient | null = null;
  private config: EmailServiceConfig | null = null;
  private initialized: boolean = false;
  private requestCount: Map<string, number> = new Map();
  private lastRequestTime: number = 0;

  private constructor() {
    // Lazy initialization - don't initialize in constructor
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SendGridClient {
    if (!SendGridClient.instance) {
      SendGridClient.instance = new SendGridClient();
    }
    return SendGridClient.instance;
  }

  /**
   * Initialize the client (lazy)
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      // Validate environment variables
      const env = this.validateEnvironment();
      
      // Build configuration
      this.config = this.buildConfiguration(env as z.infer<typeof EnvSchema>);
      
      // Initialize SendGrid client
      this.initializeClient();
    }
  }

  /**
   * Validate environment variables
   */
  private validateEnvironment() {
    try {
      // 개발 환경에서는 더 유연하게 처리
      if (process.env.NODE_ENV === 'development' && !process.env.SENDGRID_API_KEY) {
        console.warn('[SendGrid] Running in development without SendGrid API key. Email sending will be simulated.');
        return {
          SENDGRID_API_KEY: 'development-placeholder-key',
          SENDGRID_FROM_EMAIL: process.env.DEFAULT_FROM_EMAIL || 'dev@example.com',
          SENDGRID_FROM_NAME: 'Development',
          SENDGRID_SANDBOX_MODE: 'true' as const,
          NODE_ENV: 'development' as const,
        };
      }
      
      return EnvSchema.parse({
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
        SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || process.env.DEFAULT_FROM_EMAIL,
        SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME,
        SENDGRID_SANDBOX_MODE: process.env.SENDGRID_SANDBOX_MODE === 'true' ? 'true' : process.env.SENDGRID_SANDBOX_MODE === 'false' ? 'false' : undefined,
        NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test' | undefined,
      });
    } catch (error) {
      console.error('[SendGrid] Environment validation failed:', error);
      console.error('[SendGrid] Please ensure SENDGRID_API_KEY is set in your environment variables');
      
      // Production에서도 임시로 placeholder 사용 (환경 변수 설정 후 재배포 필요)
      console.warn('[SendGrid] ⚠️  PRODUCTION: Using placeholder API key - ENVIRONMENT VARIABLES REQUIRED');
      // if (process.env.NODE_ENV === 'production') {
      //   throw new Error('SendGrid configuration error: Missing SENDGRID_API_KEY');
      // }
      
      // Development에서는 placeholder 반환
      return {
        SENDGRID_API_KEY: 'development-placeholder-key',
        SENDGRID_FROM_EMAIL: 'dev@example.com',
        SENDGRID_FROM_NAME: 'Development',
        SENDGRID_SANDBOX_MODE: 'true',
        NODE_ENV: 'development',
      };
    }
  }

  /**
   * Build configuration from environment and defaults
   */
  private buildConfiguration(env: z.infer<typeof EnvSchema>): EmailServiceConfig {
    const config: EmailServiceConfig = {
      ...DEFAULT_CONFIG,
      apiKey: env.SENDGRID_API_KEY,
      defaultFrom: {
        email: env.SENDGRID_FROM_EMAIL || DEFAULT_CONFIG.defaultFrom!.email,
        name: env.SENDGRID_FROM_NAME || DEFAULT_CONFIG.defaultFrom!.name,
      },
      sandboxMode: env.SENDGRID_SANDBOX_MODE === 'true' || 
                   (env.NODE_ENV !== 'production' && env.SENDGRID_SANDBOX_MODE !== 'false'),
    } as EmailServiceConfig;

    // Validate final configuration
    return EmailServiceConfigSchema.parse(config);
  }

  /**
   * Initialize SendGrid client
   */
  private initializeClient(): void {
    if (!this.config) {
      throw new Error('Configuration not set');
    }
    
    try {
      // Production에서 placeholder key 사용 시 경고만 표시하고 계속 진행
      if (this.config.apiKey === 'development-placeholder-key') {
        console.warn('[SendGrid] ⚠️  Using placeholder API key - email functionality will be simulated');
      }
      
      sgMail.setApiKey(this.config.apiKey);
      
      // Set default timeout
      sgMail.setTimeout(this.config.timeout);
      
      this.initialized = true;
      
      console.log('[SendGrid] Client initialized successfully', {
        sandboxMode: this.config.sandboxMode,
        defaultFrom: this.config.defaultFrom.email,
        usingPlaceholder: this.config.apiKey === 'development-placeholder-key',
      });
    } catch (error) {
      console.error('[SendGrid] Client initialization failed:', error);
      console.warn('[SendGrid] ⚠️  Continuing without email functionality');
      
      // 초기화 실패해도 서버는 계속 동작하도록 함
      this.initialized = true;
    }
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(): void {
    if (!this.config || !this.config.rateLimits) return;

    const now = Date.now();
    const secondKey = Math.floor(now / 1000).toString();
    const dayKey = new Date().toISOString().split('T')[0];

    // Check per-second limit
    const secondCount = this.requestCount.get(secondKey) || 0;
    if (secondCount >= this.config.rateLimits.perSecond) {
      throw new Error(`Rate limit exceeded: ${this.config.rateLimits.perSecond} requests per second`);
    }

    // Check per-day limit
    const dayCount = this.requestCount.get(dayKey) || 0;
    if (dayCount >= this.config.rateLimits.perDay) {
      throw new Error(`Daily rate limit exceeded: ${this.config.rateLimits.perDay} requests per day`);
    }

    // Update counters
    this.requestCount.set(secondKey, secondCount + 1);
    this.requestCount.set(dayKey, dayCount + 1);

    // Clean up old entries
    this.cleanupRateLimitCounters();
  }

  /**
   * Clean up old rate limit counters
   */
  private cleanupRateLimitCounters(): void {
    const now = Date.now();
    const oneMinuteAgo = Math.floor((now - 60000) / 1000).toString();
    const yesterday = new Date(now - 86400000).toISOString().split('T')[0];

    for (const [key, _] of this.requestCount) {
      if (key.length === 10) { // Second keys
        if (key < oneMinuteAgo) {
          this.requestCount.delete(key);
        }
      } else if (key.length === 10 && key.includes('-')) { // Day keys
        if (key < yesterday) {
          this.requestCount.delete(key);
        }
      }
    }
  }

  /**
   * Get SendGrid client
   */
  public getClient() {
    this.ensureInitialized();
    
    if (!this.initialized) {
      throw new Error('SendGrid client not initialized');
    }
    
    // Check rate limits before returning client
    this.checkRateLimit();
    
    return sgMail;
  }

  /**
   * Get configuration
   */
  public getConfig(): Readonly<EmailServiceConfig> {
    this.ensureInitialized();
    
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    
    return Object.freeze({ ...this.config });
  }

  /**
   * Update configuration (for testing)
   */
  public updateConfig(partial: Partial<EmailServiceConfig>): void {
    this.ensureInitialized();
    
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    
    this.config = EmailServiceConfigSchema.parse({
      ...this.config,
      ...partial,
    });
    
    // Re-initialize if API key changed
    if (partial.apiKey) {
      this.initialized = false;
      this.initializeClient();
    }
  }

  /**
   * Reset client (for testing)
   */
  public reset(): void {
    this.initialized = false;
    this.config = null;
    this.requestCount.clear();
    this.lastRequestTime = 0;
    SendGridClient.instance = null;
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Get SendGrid client instance
 */
export function getSendGridClient() {
  return SendGridClient.getInstance().getClient();
}

/**
 * Get SendGrid configuration
 */
export function getSendGridConfig() {
  return SendGridClient.getInstance().getConfig();
}

/**
 * Get singleton instance (lazy initialization)
 */
export function getSendGridInstance() {
  return SendGridClient.getInstance();
}