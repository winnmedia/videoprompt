/**
 * Type Utility Functions
 * 타입 안전성 및 타입 검증을 위한 유틸리티 함수들
 */

// 타입 가드: 값이 null이 아닌지 확인
export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

// 타입 가드: 값이 undefined가 아닌지 확인
export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

// 타입 가드: 값이 null도 undefined도 아닌지 확인
export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// 타입 가드: 값이 문자열인지 확인
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// 타입 가드: 값이 숫자인지 확인
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

// 타입 가드: 값이 불린인지 확인
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

// 타입 가드: 값이 함수인지 확인
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

// 타입 가드: 값이 객체인지 확인 (null과 배열 제외)
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// 타입 가드: 값이 배열인지 확인
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// 타입 가드: 값이 Date 객체인지 확인
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

// 타입 가드: 값이 Error 객체인지 확인
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// 타입 가드: 값이 Promise인지 확인
export function isPromise(value: unknown): value is Promise<unknown> {
  return (
    value instanceof Promise ||
    (isObject(value) &&
      'then' in value &&
      'catch' in value &&
      isFunction(value.then) &&
      isFunction(value.catch))
  );
}

// 타입 가드: 값이 빈 문자열이 아닌지 확인
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

// 타입 가드: 값이 양수인지 확인
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

// 타입 가드: 값이 음이 아닌 수인지 확인
export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

// 타입 가드: 값이 정수인지 확인
export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

// 타입 가드: 값이 유한수인지 확인
export function isFiniteNumber(value: unknown): value is number {
  return isNumber(value) && Number.isFinite(value);
}

// 타입 가드: 값이 빈 배열이 아닌지 확인
export function isNonEmptyArray<T>(value: T[]): value is [T, ...T[]] {
  return isArray(value) && value.length > 0;
}

// 타입 가드: 값이 빈 객체가 아닌지 확인
export function isNonEmptyObject(
  value: unknown
): value is Record<string, unknown> {
  return isObject(value) && Object.keys(value).length > 0;
}

// 객체의 키가 존재하는지 확인하는 타입 가드
export function hasProperty<
  T extends object,
  K extends string | number | symbol,
>(obj: T, key: K): obj is T & Record<K, unknown> {
  return key in obj;
}

// 객체의 특정 키가 특정 타입인지 확인하는 타입 가드
export function hasPropertyOfType<T extends object, K extends keyof T, V>(
  obj: T,
  key: K,
  typeGuard: (value: unknown) => value is V
): obj is T & Record<K, V> {
  return hasProperty(obj, key) && typeGuard(obj[key]);
}

// 안전한 타입 캐스팅 함수
export function safeCast<T>(
  value: unknown,
  typeGuard: (value: unknown) => value is T
): T | null {
  return typeGuard(value) ? value : null;
}

// JSON 안전 파싱 with 타입 검증
export function safeJsonParseWithValidation<T>(
  json: string,
  validator: (value: unknown) => value is T,
  defaultValue: T
): T {
  try {
    const parsed = JSON.parse(json);
    return validator(parsed) ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
}

// 열거형 값인지 확인하는 타입 가드
export function isEnumValue<T extends Record<string, string | number>>(
  enumObject: T,
  value: unknown
): value is T[keyof T] {
  return Object.values(enumObject).includes(value as T[keyof T]);
}

// 유니온 타입 중 하나인지 확인하는 타입 가드 생성기
export function createUnionTypeGuard<T extends readonly unknown[]>(
  ...values: T
): (value: unknown) => value is T[number] {
  return (value: unknown): value is T[number] => {
    return values.includes(value);
  };
}

// 객체 스키마 검증기
export type SchemaValidator<T> = {
  [K in keyof T]: (value: unknown) => value is T[K];
};

export function validateObjectSchema<T extends Record<string, unknown>>(
  obj: unknown,
  schema: SchemaValidator<T>
): obj is T {
  if (!isObject(obj)) {
    return false;
  }

  for (const key in schema) {
    if (!hasProperty(obj, key) || !schema[key](obj[key])) {
      return false;
    }
  }

  return true;
}

// 배열의 모든 요소가 특정 타입인지 확인
export function isArrayOfType<T>(
  value: unknown,
  typeGuard: (item: unknown) => item is T
): value is T[] {
  return isArray(value) && value.every(typeGuard);
}

// 옵셔널 체이닝을 위한 안전한 접근자
export function safeGet<T, K1 extends keyof T>(
  obj: T,
  key1: K1
): T[K1] | undefined;
export function safeGet<T, K1 extends keyof T, K2 extends keyof T[K1]>(
  obj: T,
  key1: K1,
  key2: K2
): T[K1][K2] | undefined;
export function safeGet<
  T,
  K1 extends keyof T,
  K2 extends keyof T[K1],
  K3 extends keyof T[K1][K2],
>(obj: T, key1: K1, key2: K2, key3: K3): T[K1][K2][K3] | undefined;
export function safeGet(obj: unknown, ...keys: (string | number)[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (current == null || !hasProperty(current, key)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

// 타입 단언을 위한 assertion 함수
export function assertIsType<T>(
  value: unknown,
  typeGuard: (value: unknown) => value is T,
  errorMessage?: string
): asserts value is T {
  if (!typeGuard(value)) {
    throw new Error(errorMessage || '타입 검증 실패');
  }
}

// 값이 특정 조건을 만족하는지 확인하는 assertion 함수
export function assert(
  condition: boolean,
  message?: string
): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion 실패');
  }
}

// exhaustive 체크를 위한 함수 (switch 문에서 사용)
export function exhaustiveCheck(value: never): never {
  throw new Error(
    `Unhandled discriminated union member: ${JSON.stringify(value)}`
  );
}
