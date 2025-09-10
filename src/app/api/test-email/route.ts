import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, failure, getTraceId } from '@/shared/lib/api-response';
import { sendEmail, getEmailServiceStatus } from '@/lib/email/sender';
import { getSendGridConfig } from '@/lib/email/sendgrid';

export const runtime = 'nodejs';

// CORS preflight 처리
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

const TestEmailSchema = z.object({
  to: z.string().email(),
  type: z.enum(['status', 'test']).default('status'),
});

export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);
  
  console.log(`[TestEmail ${traceId}] 🧪 이메일 서비스 테스트 시작`);
  
  try {
    const body = await req.json();
    const { to, type } = TestEmailSchema.parse(body);
    
    console.log(`[TestEmail ${traceId}] 요청 타입: ${type}, 대상: ${to}`);
    
    // 1. 이메일 서비스 상태 확인
    const status = getEmailServiceStatus();
    console.log(`[TestEmail ${traceId}] 이메일 서비스 상태:`, status);
    
    if (type === 'status') {
      return success({
        emailService: status,
        message: '이메일 서비스 상태를 확인했습니다.',
      }, 200, traceId);
    }
    
    // 2. 설정 정보 확인
    let config;
    try {
      config = getSendGridConfig();
      console.log(`[TestEmail ${traceId}] SendGrid 설정:`, {
        configured: !!config,
        defaultFrom: config.defaultFrom,
        sandboxMode: config.sandboxMode,
        usingPlaceholder: config.apiKey === 'development-placeholder-key',
      });
    } catch (configError) {
      console.error(`[TestEmail ${traceId}] SendGrid 설정 오류:`, configError);
      return failure(
        'EMAIL_CONFIG_ERROR',
        'SendGrid 설정을 불러올 수 없습니다.',
        500,
        { error: String(configError) },
        traceId
      );
    }
    
    // 3. 실제 이메일 전송 테스트
    try {
      console.log(`[TestEmail ${traceId}] 테스트 이메일 전송 시작...`);
      
      const emailResult = await sendEmail({
        to: { email: to, name: 'Test User' },
        subject: '🧪 [VLANET] 이메일 서비스 테스트',
        html: `
          <h1>이메일 서비스 테스트</h1>
          <p>안녕하세요! 이것은 VLANET 이메일 서비스 테스트 메시지입니다.</p>
          <ul>
            <li><strong>테스트 시간:</strong> ${new Date().toLocaleString('ko-KR')}</li>
            <li><strong>추적 ID:</strong> ${traceId}</li>
            <li><strong>설정 상태:</strong> ${status.configured ? '정상' : '미설정'}</li>
            <li><strong>샌드박스 모드:</strong> ${config.sandboxMode ? '활성' : '비활성'}</li>
          </ul>
          <p>이 이메일을 받으셨다면 이메일 서비스가 정상적으로 작동하고 있습니다!</p>
        `,
        text: `
이메일 서비스 테스트

안녕하세요! 이것은 VLANET 이메일 서비스 테스트 메시지입니다.

테스트 시간: ${new Date().toLocaleString('ko-KR')}
추적 ID: ${traceId}
설정 상태: ${status.configured ? '정상' : '미설정'}
샌드박스 모드: ${config.sandboxMode ? '활성' : '비활성'}

이 이메일을 받으셨다면 이메일 서비스가 정상적으로 작동하고 있습니다!
        `,
      });
      
      console.log(`[TestEmail ${traceId}] ✅ 이메일 전송 성공:`, {
        messageId: emailResult.messageId,
        statusCode: emailResult.statusCode,
      });
      
      return success({
        emailService: status,
        sendGridConfig: {
          configured: true,
          defaultFrom: config.defaultFrom,
          sandboxMode: config.sandboxMode,
          usingPlaceholder: config.apiKey === 'development-placeholder-key',
        },
        emailResult: {
          messageId: emailResult.messageId,
          statusCode: emailResult.statusCode,
          timestamp: emailResult.timestamp,
        },
        message: '테스트 이메일이 성공적으로 전송되었습니다.',
      }, 200, traceId);
      
    } catch (emailError: any) {
      console.error(`[TestEmail ${traceId}] ❌ 이메일 전송 실패:`, emailError);
      
      return failure(
        'EMAIL_SEND_ERROR',
        '테스트 이메일 전송에 실패했습니다.',
        500,
        {
          error: emailError.message,
          code: emailError.code,
          details: emailError.details,
          emailService: status,
          sendGridConfig: {
            configured: !!config,
            defaultFrom: config?.defaultFrom,
            sandboxMode: config?.sandboxMode,
            usingPlaceholder: config?.apiKey === 'development-placeholder-key',
          },
        },
        traceId
      );
    }
    
  } catch (error: any) {
    console.error(`[TestEmail ${traceId}] 전체 오류:`, error);
    
    if (error instanceof z.ZodError) {
      return failure(
        'INVALID_REQUEST',
        '잘못된 요청 형식입니다.',
        400,
        { errors: error.issues },
        traceId
      );
    }
    
    return failure(
      'UNKNOWN_ERROR',
      '예상치 못한 오류가 발생했습니다.',
      500,
      { error: String(error) },
      traceId
    );
  }
}

export async function GET(req: NextRequest) {
  const traceId = getTraceId(req);
  
  try {
    const status = getEmailServiceStatus();
    
    return success({
      emailService: status,
      message: '이메일 서비스 상태 조회 완료',
      instructions: {
        statusCheck: 'GET /api/test-email - 이메일 서비스 상태만 확인',
        testEmail: 'POST /api/test-email { "to": "your@email.com", "type": "test" } - 실제 테스트 이메일 전송',
      },
    }, 200, traceId);
    
  } catch (error: any) {
    console.error(`[TestEmail ${traceId}] GET 오류:`, error);
    
    return failure(
      'EMAIL_STATUS_ERROR',
      '이메일 서비스 상태를 확인할 수 없습니다.',
      500,
      { error: String(error) },
      traceId
    );
  }
}