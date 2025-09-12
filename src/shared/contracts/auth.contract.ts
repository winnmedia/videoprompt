/**
 * 인증 시스템 데이터 계약 정의
 * CLAUDE.md 데이터 계약 원칙에 따른 스키마 검증
 */

import { z } from 'zod';

// JWT 토큰 페이로드 계약
export const JWTPayloadContract = z.object({
  sub: z.string().min(1, '사용자 ID는 필수입니다'),
  email: z.string().email('유효한 이메일 형식이어야 합니다').optional(),
  username: z.string().min(1, '사용자명은 필수입니다').optional(),
  iat: z.number().optional(),
  exp: z.number().optional()
});

// 사용자 정보 스키마
export const UserDataContract = z.object({
  id: z.string().min(1, '사용자 ID는 필수입니다'),
  email: z.string().email('유효한 이메일 형식이어야 합니다'),
  username: z.string().min(1, '사용자명은 필수입니다'),
  role: z.string().optional(),
  avatarUrl: z.string().url('유효한 URL 형식이어야 합니다').optional(),
  token: z.string().min(1, 'JWT 토큰은 필수입니다') // 항상 data 안에 token 포함
});

// 성공 응답 계약 (통일된 구조)
export const AuthSuccessResponseContract = z.object({
  ok: z.literal(true),
  data: UserDataContract,
  traceId: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

// 에러 응답 계약
export const AuthErrorResponseContract = z.object({
  ok: z.literal(false),
  code: z.string().min(1, '에러 코드는 필수입니다'),
  error: z.string().min(1, '에러 메시지는 필수입니다'),
  message: z.string().optional(),
  details: z.unknown().optional(),
  statusCode: z.number().int().positive(),
  traceId: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

// 통합 인증 응답 계약
export const AuthResponseContract = z.discriminatedUnion('ok', [
  AuthSuccessResponseContract,
  AuthErrorResponseContract
]);

// 로그인 요청 계약
export const LoginRequestContract = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다')
});

// 회원가입 요청 계약
export const RegisterRequestContract = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  username: z.string().min(3, '사용자명은 최소 3자 이상이어야 합니다'),
  password: z.string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '비밀번호는 대소문자와 숫자를 포함해야 합니다')
});

// 타입 추론을 위한 타입 정의
export type JWTPayload = z.infer<typeof JWTPayloadContract>;
export type UserData = z.infer<typeof UserDataContract>;
export type AuthSuccessResponse = z.infer<typeof AuthSuccessResponseContract>;
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseContract>;
export type AuthResponse = z.infer<typeof AuthResponseContract>;
export type LoginRequest = z.infer<typeof LoginRequestContract>;
export type RegisterRequest = z.infer<typeof RegisterRequestContract>;

// 계약 위반 에러 클래스
export class ContractViolationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ContractViolationError';
  }
}

// 스키마 검증 유틸리티
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  response: unknown,
  context?: string
): T {
  try {
    return schema.parse(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((err: any) => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      console.error(`스키마 검증 실패 ${context ? `(${context})` : ''}:`, {
        errors: error.issues,
        received: response
      });
      
      throw new ContractViolationError(
        `API 응답이 계약을 위반했습니다: ${fieldErrors}`,
        error.issues[0]?.path.join('.'),
        response
      );
    }
    
    throw new ContractViolationError(
      `예상치 못한 검증 오류: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// 안전한 응답 파싱
export function parseAuthResponse(response: unknown): AuthResponse {
  return validateResponse(AuthResponseContract, response, 'Auth API Response');
}