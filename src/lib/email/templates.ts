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
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .email-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="40" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="40" cy="80" r="1.5" fill="rgba(255,255,255,0.1)"/></svg>');
      opacity: 0.3;
      z-index: 0;
    }
    
    .email-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      position: relative;
      z-index: 1;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .logo-icon {
      display: inline-block;
      margin-bottom: 10px;
      font-size: 32px;
      position: relative;
      z-index: 1;
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
      padding: 16px 32px;
      margin: 25px 0;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      transition: all 0.3s ease;
      letter-spacing: 0.5px;
    }
    
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }
    
    /* Code block styles */
    .code-block {
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border: 2px solid #3b82f6;
      border-radius: 12px;
      padding: 20px;
      margin: 25px auto;
      max-width: 200px;
      text-align: center;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 4px;
      color: #1d4ed8;
      text-shadow: 0 1px 2px rgba(0,0,0,0.1);
      position: relative;
    }
    
    .code-block::before {
      content: '🔒';
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      background: #ffffff;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 14px;
    }
    
    .highlight-box {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-left: 4px solid #3b82f6;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      position: relative;
    }
    
    .highlight-box::before {
      content: 'ℹ️';
      position: absolute;
      top: 15px;
      left: 15px;
      font-size: 16px;
    }
    
    .highlight-box p {
      margin-left: 30px;
      margin-bottom: 0;
      color: #1e40af;
      font-weight: 500;
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
      <div class="logo-icon">🎬</div>
      <h1>VLANET</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">AI 영상 제작 플랫폼</p>
    </div>
    
    <div class="email-content">
      <h2 style="color: #1d4ed8; margin-bottom: 10px;">🎉 회원가입을 환영합니다!</h2>
      
      <p>안녕하세요, <strong>${validatedData.recipientName}</strong>님!</p>
      
      <p>VLANET에 가입해주셔서 감사합니다. AI로 멋진 영상을 만들 준비가 거의 끝났어요!</p>
      
      <div class="highlight-box">
        <p><strong>이메일 인증을 완료하시면 모든 기능을 이용하실 수 있습니다.</strong></p>
      </div>
      
      <p style="text-align: center; margin: 30px 0 10px 0; font-weight: 600; color: #374151;">
        👇 아래 버튼을 클릭하여 인증을 완료하세요
      </p>
      
      <div style="text-align: center;">
        <a href="${validatedData.verificationLink}" class="button">✨ 이메일 인증하기 ✨</a>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <p style="margin-bottom: 10px; color: #6b7280; font-weight: 500;">또는 6자리 인증 코드를 입력하세요</p>
        <div class="code-block">
          ${validatedData.verificationCode}
        </div>
      </div>
      
      <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          ⏰ <strong>중요:</strong> 이 인증 링크는 <strong>${validatedData.expiresIn}</strong> 동안만 유효합니다.
        </p>
      </div>
      
      <div style="border-top: 1px solid #e5e7eb; padding-top: 25px; margin-top: 30px;">
        <h3 style="color: #374151; font-size: 18px; margin-bottom: 15px;">🚀 VLANET에서 할 수 있는 일들:</h3>
        <ul style="color: #6b7280; line-height: 1.8;">
          <li>📝 <strong>AI 시나리오 생성:</strong> 아이디어만 입력하면 완성된 시나리오를 받아보세요</li>
          <li>🎥 <strong>프롬프트 최적화:</strong> 영상 생성에 최적화된 프롬프트를 AI가 만들어 드려요</li>
          <li>⚡ <strong>빠른 영상 생성:</strong> 몇 분 만에 전문가급 영상을 만들 수 있어요</li>
          <li>📊 <strong>피드백 분석:</strong> 생성된 영상의 품질을 자동으로 분석해 드려요</li>
        </ul>
      </div>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          🤔 <strong>회원가입을 하신 적이 없으신가요?</strong><br>
          이 이메일을 무시하시면 자동으로 계정이 삭제됩니다.
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
  `, '이메일 인증 - ' + validatedData.appName);
  
  const text = `
🎬 VLANET - AI 영상 제작 플랫폼

🎉 회원가입을 환영합니다!

안녕하세요, ${validatedData.recipientName}님!

VLANET에 가입해주셔서 감사합니다. AI로 멋진 영상을 만들 준비가 거의 끝났어요!

이메일 인증을 완료하시면 모든 기능을 이용하실 수 있습니다.

✨ 이메일 인증하기: ${validatedData.verificationLink}

또는 6자리 인증 코드를 입력하세요:
🔒 인증 코드: ${validatedData.verificationCode}

⏰ 중요: 이 인증 링크는 ${validatedData.expiresIn} 동안만 유효합니다.

🚀 VLANET에서 할 수 있는 일들:
📝 AI 시나리오 생성: 아이디어만 입력하면 완성된 시나리오를 받아보세요
🎥 프롬프트 최적화: 영상 생성에 최적화된 프롬프트를 AI가 만들어 드려요  
⚡ 빠른 영상 생성: 몇 분 만에 전문가급 영상을 만들 수 있어요
📊 피드백 분석: 생성된 영상의 품질을 자동으로 분석해 드려요

🤔 회원가입을 하신 적이 없으신가요?
이 이메일을 무시하시면 자동으로 계정이 삭제됩니다.

---
${validatedData.year} VLANET. All rights reserved.
웹사이트: ${validatedData.appUrl}
지원팀: ${validatedData.supportEmail}
  `.trim();
  
  return {
    html,
    text,
    subject: `🎬 [VLANET] 이메일 인증으로 AI 영상 제작을 시작하세요! (${validatedData.verificationCode})`,
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