/**
 * Date Utility Functions
 * 날짜 관련 유틸리티 함수들
 */

import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

// 날짜 포맷팅 (한국어)
export function formatDate(
  date: Date | string,
  pattern = 'yyyy-MM-dd'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(dateObj)) {
    return '잘못된 날짜';
  }

  return format(dateObj, pattern, { locale: ko });
}

// 상대 시간 표시 (예: "3분 전", "1시간 전")
export function getRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(dateObj)) {
    return '잘못된 날짜';
  }

  return formatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: ko,
  });
}

// 현재 시간을 ISO 문자열로 반환
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// 날짜를 읽기 쉬운 형태로 변환
export function formatDateReadable(date: Date | string): string {
  return formatDate(date, 'yyyy년 MM월 dd일');
}

// 날짜와 시간을 모두 포함한 형태로 변환
export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'yyyy-MM-dd HH:mm:ss');
}

// 시간만 추출
export function formatTime(date: Date | string): string {
  return formatDate(date, 'HH:mm');
}

// 두 날짜 사이의 차이 계산 (일 단위)
export function getDaysDifference(
  startDate: Date | string,
  endDate: Date | string
): number {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

  if (!isValid(start) || !isValid(end)) {
    return 0;
  }

  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// 날짜가 오늘인지 확인
export function isToday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const today = new Date();

  if (!isValid(dateObj)) {
    return false;
  }

  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

// 날짜가 어제인지 확인
export function isYesterday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (!isValid(dateObj)) {
    return false;
  }

  return (
    dateObj.getDate() === yesterday.getDate() &&
    dateObj.getMonth() === yesterday.getMonth() &&
    dateObj.getFullYear() === yesterday.getFullYear()
  );
}

// 미래 날짜인지 확인
export function isFuture(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(dateObj)) {
    return false;
  }

  return dateObj.getTime() > new Date().getTime();
}

// 과거 날짜인지 확인
export function isPast(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  if (!isValid(dateObj)) {
    return false;
  }

  return dateObj.getTime() < new Date().getTime();
}

// 지정된 범위 내의 날짜인지 확인
export function isWithinRange(
  date: Date | string,
  startDate: Date | string,
  endDate: Date | string
): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

  if (!isValid(dateObj) || !isValid(start) || !isValid(end)) {
    return false;
  }

  const dateTime = dateObj.getTime();
  const startTime = start.getTime();
  const endTime = end.getTime();

  return dateTime >= startTime && dateTime <= endTime;
}

// 월의 첫 번째 날 구하기
export function getFirstDayOfMonth(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
}

// 월의 마지막 날 구하기
export function getLastDayOfMonth(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
}

// 나이 계산
export function calculateAge(birthDate: Date | string): number {
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  const today = new Date();

  if (!isValid(birth)) {
    return 0;
  }

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

// 작업일(평일)만 계산 (주말 제외)
export function getWorkingDaysDifference(
  startDate: Date | string,
  endDate: Date | string
): number {
  const start =
    typeof startDate === 'string' ? parseISO(startDate) : new Date(startDate);
  const end =
    typeof endDate === 'string' ? parseISO(endDate) : new Date(endDate);

  if (!isValid(start) || !isValid(end)) {
    return 0;
  }

  let count = 0;
  const currentDate = new Date(start);

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // 일요일(0)과 토요일(6) 제외
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return count;
}

// 타임스탬프를 읽기 쉬운 형태로 변환
export function formatTimestamp(timestamp: number): string {
  return formatDateTime(new Date(timestamp));
}

// UTC 시간을 로컬 시간으로 변환
export function utcToLocal(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
}

// 로컬 시간을 UTC로 변환
export function localToUtc(localDate: Date | string): Date {
  const date = typeof localDate === 'string' ? parseISO(localDate) : localDate;
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
}
