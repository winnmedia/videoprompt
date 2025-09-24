/**
 * User Entity Implementation (TDD GREEN Phase)
 * 테스트를 통과시키는 최소한의 구현
 */

export interface User {
  id: string;
  email?: string;
  name: string;
  isGuest: boolean;
  createdAt: string;
  updatedAt: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'ko' | 'en';
  autoSave: boolean;
  videoQuality: 'low' | 'medium' | 'high';
}

// 기본 preferences
const defaultPreferences: UserPreferences = {
  theme: 'auto',
  language: 'ko',
  autoSave: true,
  videoQuality: 'medium',
};

// 이메일 유효성 검사 함수
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 게스트 사용자 생성
export function createGuestUser(email?: string): User {
  const timestamp = new Date().toISOString();
  const guestId = `guest_${Date.now()}`;
  const guestEmail = email || `${guestId}@temp.com`;

  return {
    id: guestId,
    email: guestEmail,
    name: '게스트 사용자',
    isGuest: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// 등록된 사용자 생성
export function createRegisteredUser(email: string, name: string): User {
  if (!isValidEmail(email)) {
    throw new Error('유효하지 않은 이메일입니다');
  }

  const timestamp = new Date().toISOString();
  const userId = `user_${Date.now()}`;

  return {
    id: userId,
    email,
    name,
    isGuest: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// 사용자 검증
export function validateUser(user: Partial<User>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 필수 필드 검사
  if (!user.name) {
    errors.push('이름은 필수입니다');
  }

  if (!user.id) {
    errors.push('ID는 필수입니다');
  }

  if (user.isGuest === undefined) {
    errors.push('게스트 여부는 필수입니다');
  }

  // 이메일 형식 검사 (있는 경우에만)
  if (user.email && !isValidEmail(user.email)) {
    errors.push('이메일 형식이 올바르지 않습니다');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// 사용자 preferences 업데이트
export function updateUserPreferences(
  user: User,
  preferences: Partial<UserPreferences>
): User {
  const currentPreferences = user.preferences || defaultPreferences;
  const updatedPreferences = { ...currentPreferences, ...preferences };

  return {
    ...user,
    preferences: updatedPreferences,
    updatedAt: new Date().toISOString(),
  };
}
