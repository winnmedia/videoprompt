/**
 * User Entity Tests (TDD GREEN Phase)
 * 구현된 함수들을 import하여 테스트
 */

// Jest 글로벌 함수들은 jest 환경에서 자동으로 사용 가능
import {
  User,
  UserPreferences,
  createGuestUser,
  createRegisteredUser,
  validateUser,
  updateUserPreferences,
} from './User';

describe('User Entity', () => {
  describe('createGuestUser', () => {
    it('should create a guest user with default values', () => {
      const user = createGuestUser();

      expect(user).toMatchObject({
        name: '게스트 사용자',
        isGuest: true,
      });
      expect(user.id).toMatch(/^guest_/);
      expect(user.email).toMatch(/@temp\.com$/);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('should create a guest user with provided email', () => {
      const email = 'test@example.com';
      const user = createGuestUser(email);

      expect(user.email).toBe(email);
      expect(user.isGuest).toBe(true);
    });
  });

  describe('createRegisteredUser', () => {
    it('should create a registered user', () => {
      const email = 'user@example.com';
      const name = '홍길동';
      const user = createRegisteredUser(email, name);

      expect(user).toMatchObject({
        email,
        name,
        isGuest: false,
      });
      expect(user.id).not.toMatch(/^guest_/);
    });

    it('should throw error for invalid email', () => {
      expect(() => {
        createRegisteredUser('invalid-email', '홍길동');
      }).toThrow('유효하지 않은 이메일입니다');
    });
  });

  describe('validateUser', () => {
    it('should validate complete user object', () => {
      const user: User = {
        id: 'user123',
        email: 'test@example.com',
        name: '테스트 사용자',
        isGuest: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validateUser(user);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', () => {
      const incompleteUser = {
        email: 'test@example.com',
        // name 누락
        isGuest: false,
      };

      const result = validateUser(incompleteUser);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('이름은 필수입니다');
    });

    it('should fail validation for invalid email format', () => {
      const userWithInvalidEmail = {
        id: 'user123',
        email: 'invalid-email',
        name: '테스트 사용자',
        isGuest: false,
      };

      const result = validateUser(userWithInvalidEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('이메일 형식이 올바르지 않습니다');
    });

    it('should fail validation for undefined isGuest', () => {
      const userWithUndefinedIsGuest = {
        id: 'user123',
        email: 'test@example.com',
        name: '테스트 사용자',
        // isGuest 누락 (undefined)
      };

      const result = validateUser(userWithUndefinedIsGuest);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('게스트 여부는 필수입니다');
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', async () => {
      const baseTime = new Date().toISOString();
      const user: User = {
        id: 'user123',
        name: '테스트 사용자',
        isGuest: false,
        createdAt: baseTime,
        updatedAt: baseTime,
      };

      // 시간 차이를 보장하기 위해 5ms 대기
      await new Promise((resolve) => setTimeout(resolve, 5));

      const newPreferences: Partial<UserPreferences> = {
        theme: 'dark',
        language: 'en',
      };

      const updatedUser = updateUserPreferences(user, newPreferences);

      expect(updatedUser.preferences).toMatchObject(newPreferences);
      expect(updatedUser.preferences?.autoSave).toBe(true); // 기본값 유지
      expect(updatedUser.updatedAt).not.toBe(user.updatedAt); // 업데이트 시간 변경
    });
  });
});
