import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { success, failure, getTraceId, supabaseErrors } from '@/shared/lib/api-response';
import { signUpWithSupabase } from '@/shared/lib/auth-supabase';
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rate-limiter';
import { getSupabaseClientSafe, ServiceConfigError } from '@/shared/lib/supabase-safe';
import { logger } from '@/shared/lib/logger';


export const runtime = 'nodejs';

// CORS preflight 처리
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

const RegisterSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  username: z.string().min(3, '사용자명은 최소 3자 이상이어야 합니다').max(32, '사용자명은 최대 32자까지 가능합니다'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').max(128),
});

/**
 * Supabase Auth 기반 회원가입 API
 * 기존 API 구조 유지, Supabase Auth로 내부 로직 변경
 */
export async function POST(req: NextRequest) {
  const traceId = getTraceId(req);

  try {
    // Rate Limiting 유지
    const rateLimitResult = checkRateLimit(req, 'register', RATE_LIMITS.register);
    if (!rateLimitResult.allowed) {
      logger.debug(`🚫 Rate limit exceeded for register from IP: ${req.headers.get('x-forwarded-for') || '127.0.0.1'}`);

      const response = failure(
        'RATE_LIMIT_EXCEEDED',
        '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
        429,
        `retryAfter: ${rateLimitResult.retryAfter}`,
        traceId
      );

      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    // 요청 데이터 검증
    const body = await req.json();
    const { email, username, password } = RegisterSchema.parse(body);

    logger.info(`📝 Registration attempt for email: ${email}, username: ${username}`);

    // 1단계: Supabase Auth로 회원가입
    const { user, session, error } = await signUpWithSupabase(email, password, {
      username,
    });

    if (error) {
      logger.debug(`❌ Registration failed for ${email}:`, (error as any)?.originalMessage || (error as any)?.message);

      // 이미 한국어로 변환된 에러 메시지 사용
      const errorMessage = (error as any)?.message || '회원가입 중 오류가 발생했습니다.';
      const debugMessage = (error as any)?.originalMessage || (error as any)?.message;

      return failure('REGISTRATION_FAILED', errorMessage, 400, debugMessage, traceId);
    }

    if (!user) {
      return failure('REGISTRATION_FAILED', '회원가입에 실패했습니다.', 400, undefined, traceId);
    }

    // 2단계: 실제 users 테이블에 사용자 정보 저장
    let supabaseClient;
    try {
      supabaseClient = await getSupabaseClientSafe('anon');
    } catch (error) {
      logger.error('❌ Supabase 클라이언트 접근 실패:', error instanceof Error ? error : new Error(String(error)));

      if (error instanceof ServiceConfigError) {
        return supabaseErrors.configError(traceId, error.message);
      }

      // 네트워크 관련 오류
      const errorMessage = String(error);
      if (errorMessage.includes('fetch') ||
          errorMessage.includes('network') ||
          errorMessage.includes('ENOTFOUND')) {
        return supabaseErrors.unavailable(traceId, errorMessage);
      }

      // 기타 Supabase 오류
      return supabaseErrors.unavailable(traceId, errorMessage);
    }

    try {
      // users 테이블에 실제 데이터 저장
      const { data: insertedUser, error: insertError } = await supabaseClient
        .from('users')
        .insert({
          id: user.id,
          email: user.email!,
          username: username,
          role: 'user',
          email_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        logger.debug('❌ users 테이블 저장 실패:', insertError);

        // 🔄 롤백: Supabase Auth에서 생성된 사용자 삭제
        try {
          logger.info(`🔄 사용자 데이터 롤백 시작: ${user.id}`);
          const adminClient = await getSupabaseClientSafe('admin');

          const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

          if (deleteError) {
            logger.debug('❌ 사용자 롤백 실패:', deleteError);
          } else {
            logger.info(`✅ 사용자 롤백 완료: ${user.id}`);
          }
        } catch (rollbackError) {
          logger.debug('❌ 롤백 중 예외 발생:', rollbackError);
          // 롤백 실패는 로그만 남기고 원래 에러를 반환
        }

        // 중복 데이터 에러 처리
        if (insertError.code === '23505') { // Unique constraint violation
          return failure('DUPLICATE_USER', '이미 등록된 사용자입니다.', 409, insertError.message, traceId);
        }

        return failure('DATABASE_ERROR', '사용자 정보 저장에 실패했습니다. 다시 시도해주세요.', 500, insertError.message, traceId);
      }

      logger.info(`✅ User data saved to users table:`, insertedUser);
    } catch (tableError) {
      logger.debug('❌ 테이블 저장 중 예외 발생:', tableError);

      // 🔄 롤백: Supabase Auth에서 생성된 사용자 삭제
      try {
        logger.info(`🔄 예외 발생으로 인한 사용자 롤백 시작: ${user.id}`);
        const adminClient = await getSupabaseClientSafe('admin');

        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

        if (deleteError) {
          logger.debug('❌ 예외 시 사용자 롤백 실패:', deleteError);
        } else {
          logger.info(`✅ 예외 시 사용자 롤백 완료: ${user.id}`);
        }
      } catch (rollbackError) {
        logger.debug('❌ 예외 시 롤백 중 에러:', rollbackError);
        // 롤백 실패는 로그만 남기고 원래 에러를 반환
      }

      return failure('DATABASE_ERROR', '데이터베이스 오류가 발생했습니다. 다시 시도해주세요.', 500, String(tableError), traceId);
    }

    logger.info(`✅ Registration successful for ${email}, user ID: ${user.id}`);

    // 이메일 확인 필요 여부 체크
    let needsEmailConfirmation = !user.email_confirmed_at;

    // 개발 환경에서 자동 이메일 확인 (테스트 편의성)
    if (process.env.NODE_ENV === 'development' && needsEmailConfirmation) {
      try {
        const adminClient = await getSupabaseClientSafe('admin');

        logger.info(`🔧 개발 환경: 사용자 ${user.id}의 이메일 자동 확인 중...`);

        const { error: confirmError } = await adminClient.auth.admin.updateUserById(
          user.id,
          { email_confirm: true }
        );

        if (!confirmError) {
          needsEmailConfirmation = false;
          logger.info(`✅ 개발 환경: 사용자 ${user.id}의 이메일이 자동 확인되었습니다.`);

          // users 테이블도 업데이트
          await supabaseClient
            .from('users')
            .update({ email_verified: true, verified_at: new Date().toISOString() })
            .eq('id', user.id);
        } else {
          logger.debug(`⚠️ 개발 환경: 이메일 자동 확인 실패:`, confirmError.message);
        }
      } catch (autoConfirmError) {
        logger.debug(`⚠️ 개발 환경: Admin 클라이언트 사용 불가 또는 이메일 자동 확인 중 오류:`, autoConfirmError);
      }
    }

    // 기존 API 응답 구조 유지
    const responseData = {
      id: user.id,
      email: user.email,
      username: username,
      emailVerified: !needsEmailConfirmation,
      needsEmailConfirmation,
      message: needsEmailConfirmation
        ? '회원가입이 완료되었습니다. 이메일을 확인하여 계정을 활성화해주세요.'
        : '회원가입이 완료되었습니다.',
      // 세션이 있으면 토큰도 반환 (이메일 확인이 필요없는 경우)
      ...(session && {
        accessToken: session.access_token,
        token: session.access_token,
      }),
    };

    const response = success(responseData, 201, traceId);

    // 세션이 있으면 쿠키 설정
    if (session) {
      response.cookies.set('sb-access-token', session.access_token, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: true,
        path: '/',
        maxAge: 60 * 60, // 1시간
      });

      response.cookies.set('sb-refresh-token', session.refresh_token, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: true,
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7일
      });
    }

    return response;

  } catch (e: any) {
    logger.debug('Registration error:', e);

    return e instanceof z.ZodError
      ? failure('INVALID_INPUT_FIELDS', '요청이 올바르지 않습니다. 입력 내용을 확인해주세요.', 400, e.message, traceId)
      : failure('UNKNOWN', e?.message || 'Server error', 500, undefined, traceId);
  }
}