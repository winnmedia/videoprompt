// Safe JSON parsing utilities
import { z } from 'zod';

export interface JsonParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 안전한 JSON 파싱 (타입 체크 포함)
 */
export function safeJsonParse<T>(
  input: string,
  schema?: z.ZodSchema<T>
): JsonParseResult<T> {
  try {
    // 빈 문자열 처리
    if (!input || input.trim().length === 0) {
      return {
        success: false,
        error: '빈 JSON 문자열'
      };
    }

    // JSON 파싱
    const parsed = JSON.parse(input);

    // 스키마 검증 (선택적)
    if (schema) {
      const validation = schema.safeParse(parsed);
      if (!validation.success) {
        return {
          success: false,
          error: `JSON 스키마 검증 실패: ${validation.error.issues.map(i => i.message).join(', ')}`
        };
      }
      return {
        success: true,
        data: validation.data
      };
    }

    return {
      success: true,
      data: parsed as T
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'JSON 파싱 오류'
    };
  }
}

/**
 * NextRequest에서 안전한 JSON 본문 파싱
 */
export async function safeParseRequestBody<T>(
  request: Request,
  schema?: z.ZodSchema<T>
): Promise<JsonParseResult<T>> {
  try {
    // Content-Type 확인
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        error: `잘못된 Content-Type: ${contentType}. application/json이 필요합니다.`
      };
    }

    // 본문 읽기
    const text = await request.text();
    
    // JSON 파싱 및 검증
    return safeJsonParse(text, schema);

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '요청 본문 파싱 오류'
    };
  }
}

/**
 * 안전한 JSON 문자열 생성
 */
export function safeJsonStringify(
  value: unknown,
  replacer?: (key: string, value: unknown) => unknown,
  space?: string | number
): JsonParseResult<string> {
  try {
    const result = JSON.stringify(value, replacer, space);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'JSON 직렬화 오류'
    };
  }
}

/**
 * JSON 응답 생성 (에러 처리 포함)
 */
export function createJsonResponse<T>(
  data: T,
  status: number = 200,
  headers?: Record<string, string>
) {
  const stringifyResult = safeJsonStringify(data);
  
  if (!stringifyResult.success) {
    console.error('JSON 응답 생성 실패:', stringifyResult.error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  const responseHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };

  return new Response(stringifyResult.data, {
    status,
    headers: responseHeaders
  });
}

/**
 * Prisma JSON 필드 안전 처리
 */
export function safePrismaJsonField<T>(
  jsonValue: unknown,
  schema?: z.ZodSchema<T>,
  defaultValue?: T
): T | null {
  // null이나 undefined인 경우
  if (jsonValue === null || jsonValue === undefined) {
    return defaultValue || null;
  }

  // 이미 파싱된 객체인 경우
  if (typeof jsonValue === 'object') {
    if (schema) {
      const validation = schema.safeParse(jsonValue);
      if (validation.success) {
        return validation.data;
      }
    }
    return jsonValue as T;
  }

  // 문자열인 경우 파싱 시도
  if (typeof jsonValue === 'string') {
    const parseResult = safeJsonParse(jsonValue, schema);
    if (parseResult.success && parseResult.data !== undefined) {
      return parseResult.data;
    }
  }

  return defaultValue || null;
}

/**
 * AI 응답에서 JSON 추출 (마크다운 코드 블록 등 처리)
 */
export function extractJsonFromAiResponse<T>(
  response: string,
  schema?: z.ZodSchema<T>
): JsonParseResult<T> {
  // 1. 직접 JSON 파싱 시도
  let parseResult = safeJsonParse(response, schema);
  if (parseResult.success) {
    return parseResult;
  }

  // 2. 마크다운 코드 블록에서 JSON 추출 시도
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    parseResult = safeJsonParse(codeBlockMatch[1], schema);
    if (parseResult.success) {
      return parseResult;
    }
  }

  // 3. 첫 번째 { } 블록 추출 시도
  const jsonBlockMatch = response.match(/\{[\s\S]*\}/);
  if (jsonBlockMatch) {
    parseResult = safeJsonParse(jsonBlockMatch[0], schema);
    if (parseResult.success) {
      return parseResult;
    }
  }

  return {
    success: false,
    error: 'AI 응답에서 유효한 JSON을 찾을 수 없습니다'
  };
}