import { describe, it, expect } from '@jest/globals';
import {
  BaseApiResponseSchema,
  createApiResponseSchema,
  PaginationSchema,
  ValidationErrorSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  VideoUploadValidationSchema,
  createValidationErrorResponse,
  createSuccessResponse,
  createErrorResponse,
} from '../api.schema';
import { z } from 'zod';

describe('API Schema Tests', () => {
  describe('BaseApiResponseSchema', () => {
    it('기본 API 응답 구조를 검증해야 함', () => {
      const validResponse = {
        success: true,
        message: 'Success',
        timestamp: new Date().toISOString(),
      };

      const result = BaseApiResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('잘못된 타임스탬프 형식을 거부해야 함', () => {
      const invalidResponse = {
        success: true,
        timestamp: 'invalid-date',
      };

      const result = BaseApiResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('createApiResponseSchema', () => {
    it('제네릭 데이터를 포함한 API 응답을 검증해야 함', () => {
      const dataSchema = z.object({
        id: z.string(),
        name: z.string(),
      });

      const ResponseSchema = createApiResponseSchema(dataSchema);

      const validResponse = {
        success: true,
        data: {
          id: '123',
          name: 'Test',
        },
        timestamp: new Date().toISOString(),
      };

      const result = ResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('PaginationSchema', () => {
    it('유효한 페이지네이션 데이터를 검증해야 함', () => {
      const validPagination = {
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
      };

      const result = PaginationSchema.safeParse(validPagination);
      expect(result.success).toBe(true);
    });

    it('음수 페이지를 거부해야 함', () => {
      const invalidPagination = {
        page: -1,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
      };

      const result = PaginationSchema.safeParse(invalidPagination);
      expect(result.success).toBe(false);
    });
  });

  describe('LoginRequestSchema', () => {
    it('유효한 로그인 요청을 검증해야 함', () => {
      const validLogin = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = LoginRequestSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it('잘못된 이메일 형식을 거부해야 함', () => {
      const invalidLogin = {
        email: 'invalid-email',
        password: 'password123',
      };

      const result = LoginRequestSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toContain('유효한 이메일');
    });

    it('짧은 비밀번호를 거부해야 함', () => {
      const invalidLogin = {
        email: 'test@example.com',
        password: '123',
      };

      const result = LoginRequestSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toContain('최소 8자');
    });
  });

  describe('RegisterRequestSchema', () => {
    it('유효한 회원가입 요청을 검증해야 함', () => {
      const validRegister = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123',
      };

      const result = RegisterRequestSchema.safeParse(validRegister);
      expect(result.success).toBe(true);
    });

    it('특수문자가 포함된 사용자명을 거부해야 함', () => {
      const invalidRegister = {
        email: 'test@example.com',
        username: 'test@user',
        password: 'Password123',
      };

      const result = RegisterRequestSchema.safeParse(invalidRegister);
      expect(result.success).toBe(false);
    });

    it('비밀번호 복잡성 요구사항을 확인해야 함', () => {
      const invalidRegister = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password', // 대문자, 숫자 없음
      };

      const result = RegisterRequestSchema.safeParse(invalidRegister);
      expect(result.success).toBe(false);
    });
  });

  describe('VideoUploadValidationSchema', () => {
    it('유효한 비디오 파일을 검증해야 함', () => {
      const validFile = {
        file: {
          name: 'test.mp4',
          size: 1024 * 1024, // 1MB
          type: 'video/mp4',
        },
      };

      const result = VideoUploadValidationSchema.safeParse(validFile);
      expect(result.success).toBe(true);
    });

    it('지원되지 않는 파일 형식을 거부해야 함', () => {
      const invalidFile = {
        file: {
          name: 'test.txt',
          size: 1024,
          type: 'text/plain',
        },
      };

      const result = VideoUploadValidationSchema.safeParse(invalidFile);
      expect(result.success).toBe(false);
    });

    it('너무 큰 파일을 거부해야 함', () => {
      const largeFile = {
        file: {
          name: 'large.mp4',
          size: 700 * 1024 * 1024, // 700MB
          type: 'video/mp4',
        },
      };

      const result = VideoUploadValidationSchema.safeParse(largeFile);
      expect(result.success).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    describe('createValidationErrorResponse', () => {
      it('Zod 에러를 정형화된 응답으로 변환해야 함', () => {
        const schema = z.object({
          name: z.string().min(1),
          age: z.number().min(0),
        });

        const parseResult = schema.safeParse({
          name: '',
          age: -1,
        });

        if (!parseResult.success) {
          const errorResponse = createValidationErrorResponse(parseResult.error);
          
          expect(errorResponse.success).toBe(false);
          expect(errorResponse.error).toBe('VALIDATION_ERROR');
          expect(errorResponse.validationErrors).toHaveLength(2);
          expect(errorResponse.timestamp).toBeDefined();
        }
      });
    });

    describe('createSuccessResponse', () => {
      it('성공 응답을 생성해야 함', () => {
        const data = { id: '123', name: 'Test' };
        const response = createSuccessResponse(data, 'Success message');

        expect(response.success).toBe(true);
        expect(response.data).toEqual(data);
        expect(response.message).toBe('Success message');
        expect(response.timestamp).toBeDefined();
      });
    });

    describe('createErrorResponse', () => {
      it('에러 응답을 생성해야 함', () => {
        const response = createErrorResponse(
          'CUSTOM_ERROR',
          'Error message',
          { details: 'Additional info' }
        );

        expect(response.success).toBe(false);
        expect(response.error).toBe('CUSTOM_ERROR');
        expect(response.message).toBe('Error message');
        expect(response.details).toEqual({ details: 'Additional info' });
        expect(response.timestamp).toBeDefined();
      });
    });
  });
});