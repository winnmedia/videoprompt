/**
 * Email Templates Module
 * Provides HTML and text templates for various email types
 * 
 * @module email/templates
 * @layer shared/lib
 */

import { z } from 'zod';
import {
  VerificationTemplateDataSchema,
  PasswordResetTemplateDataSchema,
  WelcomeTemplateDataSchema,
  type EmailTemplateType,
} from './contracts/email.schema';

// ============================================================================
// Template Base Styles
// ============================================================================

const baseStyles = `
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    /* Base styles */
    body {
      width: 100% !important;
      height: 100%;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f4;
    }
    
    /* Container styles */
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    /* Header styles */
    .email-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
    }
    
    .email-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    
    /* Content styles */
    .email-content {
      padding: 40px 30px;
    }
    
    .email-content h2 {
      color: #333333;
      font-size: 24px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 20px;
    }
    
    .email-content p {
      margin: 15px 0;
      color: #555555;
    }
    
    /* Button styles */
    .button {
      display: inline-block;
      padding: 14px 30px;
      margin: 20px 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 5px;
      font-weight: 600;
      font-size: 16px;
      transition: opacity 0.3s;
    }
    
    .button:hover {
      opacity: 0.9;
    }
    
    .button-secondary {
      background: #f0f0f0;
      color: #333333 !important;
    }
    
    /* Code block styles */
    .code-block {
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 15px;
      margin: 20px 0;
      font-family: 'Courier New', monospace;
      font-size: 24px;
      letter-spacing: 3px;
      text-align: center;
      color: #495057;
    }
    
    /* Feature list styles */
    .feature-list {
      margin: 20px 0;
      padding: 0;
      list-style: none;
    }
    
    .feature-item {
      padding: 15px;
      margin: 10px 0;
      background-color: #f8f9fa;
      border-left: 4px solid #667eea;
      border-radius: 4px;
    }
    
    .feature-title {
      font-weight: 600;
      color: #333333;
      margin-bottom: 5px;
    }
    
    .feature-description {
      color: #666666;
      font-size: 14px;
    }
    
    /* Footer styles */
    .email-footer {
      background-color: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    
    .email-footer p {
      margin: 5px 0;
      color: #999999;
      font-size: 14px;
    }
    
    .email-footer a {
      color: #667eea;
      text-decoration: none;
    }
    
    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        border-radius: 0;
      }
      
      .email-header, .email-content, .email-footer {
        padding: 20px 15px;
      }
      
      .button {
        display: block;
        width: 100%;
        box-sizing: border-box;
      }
    }
  </style>
`;

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Base template wrapper
 */
function wrapTemplate(content: string, title: string = 'VideoPlanet'): string {
  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${title}</title>
      ${baseStyles}
    </head>
    <body>
      <div class="email-container">
        ${content}
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate email verification template
 */
export function generateVerificationTemplate(
  data: z.infer<typeof VerificationTemplateDataSchema>
): { html: string; text: string; subject: string } {
  // Validate input data
  const validatedData = VerificationTemplateDataSchema.parse(data);
  
  const html = wrapTemplate(`
    <div class="email-header">
      <h1>${validatedData.appName}</h1>
    </div>
    
    <div class="email-content">
      <h2>이메일 인증</h2>
      
      <p>안녕하세요, ${validatedData.recipientName}님!</p>
      
      <p>${validatedData.appName} 가입을 환영합니다. 아래 버튼을 클릭하여 이메일 주소를 인증해주세요.</p>
      
      <div style="text-align: center;">
        <a href="${validatedData.verificationLink}" class="button">이메일 인증하기</a>
      </div>
      
      <p>또는 아래 인증 코드를 입력하세요:</p>
      
      <div class="code-block">
        ${validatedData.verificationCode}
      </div>
      
      <p style="color: #999999; font-size: 14px;">
        이 링크는 ${validatedData.expiresIn} 동안 유효합니다.
      </p>
      
      <p style="color: #999999; font-size: 14px;">
        본인이 가입 신청을 하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.
      </p>
    </div>
    
    <div class="email-footer">
      <p>${validatedData.year} ${validatedData.appName}. All rights reserved.</p>
      <p>
        <a href="${validatedData.appUrl}">웹사이트 방문</a> | 
        <a href="mailto:${validatedData.supportEmail}">지원팀 문의</a>
      </p>
    </div>
  `, '이메일 인증 - ' + validatedData.appName);
  
  const text = `
${validatedData.appName} - 이메일 인증

안녕하세요, ${validatedData.recipientName}님!

${validatedData.appName} 가입을 환영합니다. 아래 링크를 클릭하여 이메일 주소를 인증해주세요.

인증 링크: ${validatedData.verificationLink}

또는 아래 인증 코드를 입력하세요:
${validatedData.verificationCode}

이 링크는 ${validatedData.expiresIn} 동안 유효합니다.

본인이 가입 신청을 하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.

---
${validatedData.year} ${validatedData.appName}. All rights reserved.
웹사이트: ${validatedData.appUrl}
지원팀: ${validatedData.supportEmail}
  `.trim();
  
  return {
    html,
    text,
    subject: `[${validatedData.appName}] 이메일 인증을 완료해주세요`,
  };
}

/**
 * Generate password reset template
 */
export function generatePasswordResetTemplate(
  data: z.infer<typeof PasswordResetTemplateDataSchema>
): { html: string; text: string; subject: string } {
  // Validate input data
  const validatedData = PasswordResetTemplateDataSchema.parse(data);
  
  const securityInfo = (validatedData.ipAddress || validatedData.userAgent) ? `
    <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        <strong>보안 정보:</strong><br>
        ${validatedData.ipAddress ? `IP 주소: ${validatedData.ipAddress}<br>` : ''}
        ${validatedData.userAgent ? `브라우저: ${validatedData.userAgent}` : ''}
      </p>
    </div>
  ` : '';
  
  const html = wrapTemplate(`
    <div class="email-header">
      <h1>${validatedData.appName}</h1>
    </div>
    
    <div class="email-content">
      <h2>비밀번호 재설정</h2>
      
      <p>안녕하세요, ${validatedData.recipientName}님!</p>
      
      <p>비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.</p>
      
      <div style="text-align: center;">
        <a href="${validatedData.resetLink}" class="button">비밀번호 재설정</a>
      </div>
      
      <p>또는 아래 코드를 입력하세요:</p>
      
      <div class="code-block">
        ${validatedData.resetCode}
      </div>
      
      ${securityInfo}
      
      <p style="color: #dc3545; font-weight: 600;">
        주의: 이 링크는 ${validatedData.expiresIn} 동안만 유효합니다.
      </p>
      
      <p style="color: #999999; font-size: 14px;">
        본인이 비밀번호 재설정을 요청하지 않으셨다면, 계정이 무단으로 접근되었을 수 있습니다. 
        즉시 <a href="mailto:${validatedData.supportEmail}">지원팀</a>에 문의해주세요.
      </p>
    </div>
    
    <div class="email-footer">
      <p>${validatedData.year} ${validatedData.appName}. All rights reserved.</p>
      <p>
        <a href="${validatedData.appUrl}">웹사이트 방문</a> | 
        <a href="mailto:${validatedData.supportEmail}">지원팀 문의</a>
      </p>
    </div>
  `, '비밀번호 재설정 - ' + validatedData.appName);
  
  const text = `
${validatedData.appName} - 비밀번호 재설정

안녕하세요, ${validatedData.recipientName}님!

비밀번호 재설정을 요청하셨습니다. 아래 링크를 클릭하여 새 비밀번호를 설정해주세요.

재설정 링크: ${validatedData.resetLink}

또는 아래 코드를 입력하세요:
${validatedData.resetCode}

${validatedData.ipAddress ? `IP 주소: ${validatedData.ipAddress}` : ''}
${validatedData.userAgent ? `브라우저: ${validatedData.userAgent}` : ''}

주의: 이 링크는 ${validatedData.expiresIn} 동안만 유효합니다.

본인이 비밀번호 재설정을 요청하지 않으셨다면, 계정이 무단으로 접근되었을 수 있습니다.
즉시 지원팀에 문의해주세요: ${validatedData.supportEmail}

---
${validatedData.year} ${validatedData.appName}. All rights reserved.
웹사이트: ${validatedData.appUrl}
지원팀: ${validatedData.supportEmail}
  `.trim();
  
  return {
    html,
    text,
    subject: `[${validatedData.appName}] 비밀번호 재설정 요청`,
  };
}

/**
 * Generate welcome email template
 */
export function generateWelcomeTemplate(
  data: z.infer<typeof WelcomeTemplateDataSchema>
): { html: string; text: string; subject: string } {
  // Validate input data
  const validatedData = WelcomeTemplateDataSchema.parse(data);
  
  const featuresHtml = validatedData.features && validatedData.features.length > 0 ? `
    <h3 style="margin-top: 30px;">주요 기능</h3>
    <div class="feature-list">
      ${validatedData.features.map(feature => `
        <div class="feature-item">
          <div class="feature-title">${feature.title}</div>
          <div class="feature-description">${feature.description}</div>
        </div>
      `).join('')}
    </div>
  ` : '';
  
  const html = wrapTemplate(`
    <div class="email-header">
      <h1>${validatedData.appName}</h1>
    </div>
    
    <div class="email-content">
      <h2>${validatedData.appName}에 오신 것을 환영합니다!</h2>
      
      <p>안녕하세요, ${validatedData.recipientName}님!</p>
      
      <p>
        ${validatedData.appName} 가입을 진심으로 환영합니다. 
        이제 모든 기능을 자유롭게 이용하실 수 있습니다.
      </p>
      
      <div style="text-align: center;">
        <a href="${validatedData.dashboardLink}" class="button">대시보드 바로가기</a>
        <a href="${validatedData.gettingStartedLink}" class="button button-secondary">시작 가이드</a>
      </div>
      
      ${featuresHtml}
      
      <div style="background-color: #f8f9fa; border-radius: 4px; padding: 20px; margin: 30px 0;">
        <h3 style="margin-top: 0;">도움이 필요하신가요?</h3>
        <p style="margin-bottom: 0;">
          궁금한 점이 있으시면 언제든지 <a href="mailto:${validatedData.supportEmail}">지원팀</a>에 문의해주세요.
          빠르고 친절하게 도와드리겠습니다.
        </p>
      </div>
    </div>
    
    <div class="email-footer">
      <p>${validatedData.year} ${validatedData.appName}. All rights reserved.</p>
      <p>
        <a href="${validatedData.appUrl}">웹사이트 방문</a> | 
        <a href="mailto:${validatedData.supportEmail}">지원팀 문의</a>
      </p>
    </div>
  `, '환영합니다 - ' + validatedData.appName);
  
  const featuresText = validatedData.features && validatedData.features.length > 0
    ? '\n\n주요 기능:\n' + validatedData.features.map(f => `- ${f.title}: ${f.description}`).join('\n')
    : '';
  
  const text = `
${validatedData.appName}에 오신 것을 환영합니다!

안녕하세요, ${validatedData.recipientName}님!

${validatedData.appName} 가입을 진심으로 환영합니다.
이제 모든 기능을 자유롭게 이용하실 수 있습니다.

대시보드 바로가기: ${validatedData.dashboardLink}
시작 가이드: ${validatedData.gettingStartedLink}
${featuresText}

도움이 필요하신가요?
궁금한 점이 있으시면 언제든지 지원팀에 문의해주세요: ${validatedData.supportEmail}

---
${validatedData.year} ${validatedData.appName}. All rights reserved.
웹사이트: ${validatedData.appUrl}
지원팀: ${validatedData.supportEmail}
  `.trim();
  
  return {
    html,
    text,
    subject: `${validatedData.appName}에 오신 것을 환영합니다!`,
  };
}

/**
 * Get template by type
 */
export function getTemplate(
  type: EmailTemplateType,
  data: any
): { html: string; text: string; subject: string } {
  switch (type) {
    case 'verification':
      return generateVerificationTemplate(data);
    case 'password_reset':
      return generatePasswordResetTemplate(data);
    case 'welcome':
      return generateWelcomeTemplate(data);
    default:
      throw new Error(`Unsupported template type: ${type}`);
  }
}