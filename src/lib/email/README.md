# Email Service Module

Production-ready email service module using SendGrid for VideoPlanet project.

## Features

- ✅ **Type-safe contracts** with Zod validation
- ✅ **OpenAPI-compliant** schemas
- ✅ **Built-in retry logic** with exponential backoff
- ✅ **Rate limiting** protection
- ✅ **Template system** for common email types
- ✅ **Sandbox mode** for development/testing
- ✅ **Comprehensive error handling**
- ✅ **Batch email support**
- ✅ **Full test coverage**

## Architecture

```
src/lib/email/
├── contracts/
│   └── email.schema.ts    # OpenAPI-compliant schemas & types
├── sendgrid.ts            # SendGrid client singleton
├── templates.ts           # Email HTML/text templates
├── sender.ts              # High-level sending utilities
├── index.ts              # Public API exports
└── __tests__/
    └── email.test.ts     # Comprehensive test suite
```

## Configuration

### Environment Variables

```env
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=service@vlanet.net  # Optional, defaults to service@vlanet.net
SENDGRID_FROM_NAME=VideoPlanet Service  # Optional
SENDGRID_SANDBOX_MODE=false            # Optional, auto-enabled in non-production
```

## Usage

### Basic Email Sending

```typescript
import { sendEmail } from '@/lib/email';

// Send a simple email
const response = await sendEmail({
  to: { email: 'user@example.com', name: 'John Doe' },
  subject: 'Welcome to VideoPlanet',
  html: '<h1>Welcome!</h1><p>Thanks for joining us.</p>',
  text: 'Welcome! Thanks for joining us.',
});

console.log('Email sent:', response.messageId);
```

### Using Templates

```typescript
import { 
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail 
} from '@/lib/email';

// Send verification email
await sendVerificationEmail(
  'user@example.com',
  '홍길동',
  'https://app.videoplanet.com/verify?token=abc123',
  '123456'
);

// Send password reset email
await sendPasswordResetEmail(
  'user@example.com',
  '김철수',
  'https://app.videoplanet.com/reset?token=xyz789',
  '987654',
  { 
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'] 
  }
);

// Send welcome email
await sendWelcomeEmail(
  'user@example.com',
  '이영희',
  'https://app.videoplanet.com/dashboard',
  'https://app.videoplanet.com/guide',
  [
    { 
      title: 'AI Video Generation',
      description: 'Create videos with AI assistance'
    },
    { 
      title: 'Advanced Editing',
      description: 'Professional video editing tools'
    }
  ]
);
```

### Batch Emails

```typescript
import { sendBatchEmails } from '@/lib/email';

const response = await sendBatchEmails({
  emails: [
    {
      to: { email: 'user1@example.com' },
      subject: 'Newsletter',
      html: '<p>Content 1</p>',
    },
    {
      to: { email: 'user2@example.com' },
      subject: 'Newsletter',
      html: '<p>Content 2</p>',
    }
  ],
  batchId: 'newsletter_2024_01',
});

console.log(`Sent: ${response.accepted}, Failed: ${response.rejected}`);
```

### Custom Templates

```typescript
import { sendTemplateEmail } from '@/lib/email';

await sendTemplateEmail(
  'verification', // template type
  {
    recipientName: 'John Doe',
    verificationLink: 'https://...',
    verificationCode: '123456',
  },
  { email: 'user@example.com', name: 'John Doe' }
);
```

### Error Handling

```typescript
import { sendEmail, EmailServiceError } from '@/lib/email';

try {
  await sendEmail({ /* ... */ });
} catch (error) {
  if (error instanceof EmailServiceError) {
    switch (error.code) {
      case 'INVALID_RECIPIENT':
        console.error('Invalid email address');
        break;
      case 'RATE_LIMIT_EXCEEDED':
        console.error('Too many emails sent');
        break;
      case 'INVALID_API_KEY':
        console.error('SendGrid API key is invalid');
        break;
      default:
        console.error('Email error:', error.message);
    }
  }
}
```

### API Endpoint Usage

```bash
# Send email via API
curl -X POST https://your-app.com/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Test Email",
    "html": "<p>This is a test</p>"
  }'

# Send template email via API
curl -X POST https://your-app.com/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "template": {
      "type": "verification",
      "data": {
        "recipientName": "John Doe",
        "verificationLink": "https://...",
        "verificationCode": "123456"
      }
    }
  }'

# Check service status
curl https://your-app.com/api/email/send
```

## Testing

```bash
# Run tests
pnpm test src/lib/email

# Run tests with coverage
pnpm test:coverage src/lib/email
```

## Rate Limits

Default rate limits (configurable):
- **10 emails per second**
- **10,000 emails per day**

## Sandbox Mode

- Automatically enabled in development/test environments
- Prevents actual email sending while maintaining full API compatibility
- Can be explicitly controlled via `SENDGRID_SANDBOX_MODE` environment variable

## Contract Verification

All email operations are validated against OpenAPI schemas:

```typescript
// All requests are validated
const request = SendEmailRequestSchema.parse(data);

// All responses are validated
const response = SendEmailResponseSchema.parse(result);
```

## Monitoring

The service includes built-in logging for:
- Successful sends with message IDs
- Failed attempts with error codes
- Retry attempts
- Rate limit violations
- Configuration validation

## Security Considerations

1. **API Key Protection**: Store SendGrid API key in environment variables only
2. **Input Validation**: All inputs are validated with Zod schemas
3. **Rate Limiting**: Built-in protection against abuse
4. **Sandbox Mode**: Prevents accidental sends in development
5. **Error Sanitization**: Sensitive information is not exposed in error messages

## Support

For issues or questions, contact the backend team or refer to the [SendGrid documentation](https://docs.sendgrid.com/).