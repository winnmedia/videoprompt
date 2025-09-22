/**
 * 피드백 시스템 유틸리티 함수 테스트
 *
 * crypto-utils, video-utils 등의 유틸리티 함수들에 대한 단위 테스트
 */


// 암호화 유틸리티 테스트
import {
  generateSecureToken,
  generateGuestId,
  generateInvitationToken,
  parseInvitationToken,
  hashData,
  createGuestSessionToken,
  parseGuestSessionToken,
  checkRolePermission,
  validateEmail,
  checkAllowedDomain,
  sanitizeFileName,
  sanitizeFilePath,
  maskEmail,
} from '@/shared/lib/crypto-utils';

// 비디오 유틸리티 테스트
import {
  generateUploadPath,
  validateVideoFile,
  UploadProgressTracker,
} from '@/shared/lib/video-utils';

// ===========================================
// 암호화 유틸리티 테스트
// ===========================================

describe('Crypto Utils', () => {
  describe('Token Generation', () => {
    it('should generate secure tokens of specified length', () => {
      // Act
      const token32 = generateSecureToken(32);
      const token16 = generateSecureToken(16);

      // Assert
      expect(token32).toHaveLength(64); // hex encoding doubles the length
      expect(token16).toHaveLength(32);
      expect(token32).toMatch(/^[a-f0-9]+$/);
      expect(token16).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique tokens', () => {
      // Act
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();

      // Assert
      expect(token1).not.toBe(token2);
    });

    it('should generate guest IDs with proper format', () => {
      // Act
      const guestId = generateGuestId();

      // Assert
      expect(guestId).toMatch(/^guest_[a-z0-9]+_[a-f0-9]+$/);
    });
  });

  describe('Invitation Token', () => {
    it('should create and parse invitation tokens correctly', () => {
      // Arrange
      const projectId = 'project-123';
      const email = 'test@example.com';

      // Act
      const token = generateInvitationToken(projectId, email);
      const parsed = parseInvitationToken(token);

      // Assert
      expect(parsed.isValid).toBe(true);
      expect(parsed.projectId).toBe(projectId);
      expect(parsed.email).toBe(email);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should reject expired tokens', () => {
      // Arrange
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      const fakeToken = Buffer.from(`project-123:test@example.com:${oldTimestamp}:fakehash`).toString('base64url');

      // Act
      const parsed = parseInvitationToken(fakeToken);

      // Assert
      expect(parsed.isValid).toBe(false);
    });

    it('should reject malformed tokens', () => {
      // Act
      const parsed1 = parseInvitationToken('invalid-token');
      const parsed2 = parseInvitationToken('');

      // Assert
      expect(parsed1.isValid).toBe(false);
      expect(parsed2.isValid).toBe(false);
    });
  });

  describe('Guest Session Management', () => {
    it('should create and parse guest session tokens', () => {
      // Arrange
      const session = {
        project_id: 'project-123',
        participant_id: 'participant-123',
        guest_id: 'guest-456',
        guest_name: 'Test Guest',
        guest_email: 'guest@example.com',
        permissions: { can_view: true, can_comment: true },
        expires_at: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };

      // Act
      const token = createGuestSessionToken(session);
      const parsed = parseGuestSessionToken(token);

      // Assert
      expect(parsed.isValid).toBe(true);
      expect(parsed.session).toEqual(session);
    });

    it('should reject expired guest sessions', () => {
      // Arrange
      const expiredSession = {
        project_id: 'project-123',
        participant_id: 'participant-123',
        guest_id: 'guest-456',
        guest_name: 'Test Guest',
        guest_email: 'guest@example.com',
        permissions: { can_view: true },
        expires_at: Date.now() - 1000, // expired
      };

      // Act
      const token = createGuestSessionToken(expiredSession);
      const parsed = parseGuestSessionToken(token);

      // Assert
      expect(parsed.isValid).toBe(false);
    });
  });

  describe('Permission Checking', () => {
    it('should check role permissions correctly', () => {
      // Act & Assert
      expect(checkRolePermission('owner', 'can_delete_project')).toBe(true);
      expect(checkRolePermission('admin', 'can_manage_participants')).toBe(true);
      expect(checkRolePermission('editor', 'can_upload')).toBe(true);
      expect(checkRolePermission('viewer', 'can_view')).toBe(true);
      expect(checkRolePermission('guest', 'can_upload')).toBe(false);
      expect(checkRolePermission('viewer', 'can_delete_project')).toBe(false);
    });

    it('should handle unknown roles gracefully', () => {
      // Act & Assert
      expect(checkRolePermission('unknown', 'can_view')).toBe(false);
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      // Act & Assert
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(validateEmail('simple@domain.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      // Act & Assert
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });

    it('should check allowed domains correctly', () => {
      // Arrange
      const allowedDomains = ['company.com', 'trusted.org'];

      // Act & Assert
      expect(checkAllowedDomain('user@company.com', allowedDomains)).toBe(true);
      expect(checkAllowedDomain('test@trusted.org', allowedDomains)).toBe(true);
      expect(checkAllowedDomain('external@gmail.com', allowedDomains)).toBe(false);
      expect(checkAllowedDomain('user@company.com', [])).toBe(true); // no restrictions
    });
  });

  describe('Data Hashing', () => {
    it('should generate consistent hashes', () => {
      // Arrange
      const data = 'test-data-123';

      // Act
      const hash1 = hashData(data);
      const hash2 = hashData(data);

      // Assert
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
      expect(hash1).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate different hashes for different data', () => {
      // Act
      const hash1 = hashData('data1');
      const hash2 = hashData('data2');

      // Assert
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Security Functions', () => {
    it('should sanitize file names properly', () => {
      // Act & Assert
      expect(sanitizeFileName('normal-file.txt')).toBe('normal-file.txt');
      expect(sanitizeFileName('file with spaces.txt')).toBe('file with spaces.txt');
      expect(sanitizeFileName('dangerous<>:"/\\|?*file.txt')).toBe('dangerous__________file.txt');
      expect(sanitizeFileName('very-long-filename'.repeat(20) + '.txt')).toMatch(/\.txt$/);
    });

    it('should sanitize file paths', () => {
      // Act & Assert
      expect(sanitizeFilePath('folder/file.txt')).toBe('folder/file.txt');
      expect(sanitizeFilePath('../../../etc/passwd')).toBe('etc/passwd');
      expect(sanitizeFilePath('/absolute/path')).toBe('absolute/path');
      expect(sanitizeFilePath('folder//double//slash')).toBe('folder/double/slash');
    });

    it('should mask email addresses for privacy', () => {
      // Act & Assert
      expect(maskEmail('test@example.com')).toBe('t***t@example.com');
      expect(maskEmail('ab@domain.com')).toBe('a***@domain.com');
      expect(maskEmail('a@domain.com')).toBe('a***@domain.com');
    });
  });
});

// ===========================================
// 비디오 유틸리티 테스트
// ===========================================

describe('Video Utils', () => {
  describe('Upload Path Generation', () => {
    it('should generate correct video upload paths', () => {
      // Arrange
      const projectId = 'project-123';
      const videoSlotId = 'slot-456';
      const fileName = 'test-video.mp4';

      // Act
      const path = generateUploadPath(projectId, videoSlotId, 'video', fileName);

      // Assert
      expect(path).toMatch(/^project-123\/videos\/slot-456\/\d+_test-video\.mp4$/);
    });

    it('should generate correct thumbnail paths', () => {
      // Arrange
      const projectId = 'project-123';
      const videoSlotId = 'slot-456';
      const fileName = 'original.mp4';

      // Act
      const path = generateUploadPath(projectId, videoSlotId, 'thumbnail', fileName);

      // Assert
      expect(path).toMatch(/^project-123\/thumbnails\/slot-456\/\d+_thumb\.jpg$/);
    });

    it('should clean file names in paths', () => {
      // Arrange
      const fileName = 'file with spaces & symbols!.mp4';

      // Act
      const path = generateUploadPath('proj', 'slot', 'video', fileName);

      // Assert
      expect(path).toContain('file_with_spaces___symbols_');
    });

    it('should throw error for unknown upload type', () => {
      // Act & Assert
      expect(() => {
        generateUploadPath('proj', 'slot', 'unknown' as any, 'file.txt');
      }).toThrow('Unknown upload type: unknown');
    });
  });

  describe('Video File Validation', () => {
    it('should validate correct video files', () => {
      // Arrange
      const mockVideoFile = new File([''], 'test.mp4', {
        type: 'video/mp4',
        lastModified: Date.now(),
      });
      Object.defineProperty(mockVideoFile, 'size', { value: 100 * 1024 * 1024 }); // 100MB

      // Act
      const result = validateVideoFile(mockVideoFile);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files that are too large', () => {
      // Arrange
      const mockLargeFile = new File([''], 'large.mp4', {
        type: 'video/mp4',
      });
      Object.defineProperty(mockLargeFile, 'size', { value: 400 * 1024 * 1024 }); // 400MB

      // Act
      const result = validateVideoFile(mockLargeFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('exceeds 300MB'));
    });

    it('should reject unsupported file types', () => {
      // Arrange
      const mockTextFile = new File([''], 'test.txt', {
        type: 'text/plain',
      });
      Object.defineProperty(mockTextFile, 'size', { value: 1024 });

      // Act
      const result = validateVideoFile(mockTextFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Unsupported file type'));
    });

    it('should reject files with names that are too long', () => {
      // Arrange
      const longName = 'very-long-filename'.repeat(20) + '.mp4';
      const mockFile = new File([''], longName, {
        type: 'video/mp4',
      });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      // Act
      const result = validateVideoFile(mockFile);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Filename too long (max 255 characters)');
    });

    it('should handle null file input', () => {
      // Act
      const result = validateVideoFile(null as any);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No file provided');
    });
  });

  describe('Upload Progress Tracker', () => {
    it('should track progress correctly', () => {
      // Arrange
      const tracker = new UploadProgressTracker();
      const progressValues: number[] = [];
      tracker.onProgress((progress) => progressValues.push(progress));

      // Act
      tracker.updateProgress(25);
      tracker.updateProgress(50);
      tracker.updateProgress(75);
      tracker.complete();

      // Assert
      expect(progressValues).toEqual([25, 50, 75, 100]);
    });

    it('should clamp progress values', () => {
      // Arrange
      const tracker = new UploadProgressTracker();
      const progressValues: number[] = [];
      tracker.onProgress((progress) => progressValues.push(progress));

      // Act
      tracker.updateProgress(-10); // below 0
      tracker.updateProgress(150); // above 100

      // Assert
      expect(progressValues).toEqual([0, 100]);
    });

    it('should handle multiple callbacks', () => {
      // Arrange
      const tracker = new UploadProgressTracker();
      const progress1: number[] = [];
      const progress2: number[] = [];

      tracker.onProgress((p) => progress1.push(p));
      tracker.onProgress((p) => progress2.push(p));

      // Act
      tracker.updateProgress(50);

      // Assert
      expect(progress1).toEqual([50]);
      expect(progress2).toEqual([50]);
    });

    it('should reset progress on error', () => {
      // Arrange
      const tracker = new UploadProgressTracker();
      const progressValues: number[] = [];
      tracker.onProgress((progress) => progressValues.push(progress));

      // Act
      tracker.updateProgress(50);
      tracker.error();

      // Assert
      expect(progressValues).toEqual([50, 0]);
    });
  });
});

// ===========================================
// 통합 테스트
// ===========================================

describe('Integration Tests', () => {
  it('should generate secure tokens and validate them in workflow', () => {
    // Arrange
    const projectId = 'test-project';
    const email = 'test@example.com';

    // Act - Generate invitation token
    const invitationToken = generateInvitationToken(projectId, email);
    const parsed = parseInvitationToken(invitationToken);

    // Generate guest session
    const guestId = generateGuestId();
    const session = {
      project_id: parsed.projectId!,
      participant_id: 'participant-123',
      guest_id: guestId,
      guest_name: 'Test Guest',
      guest_email: email,
      permissions: { can_view: true, can_comment: true },
      expires_at: Date.now() + (24 * 60 * 60 * 1000),
    };

    const sessionToken = createGuestSessionToken(session);
    const sessionParsed = parseGuestSessionToken(sessionToken);

    // Assert
    expect(parsed.isValid).toBe(true);
    expect(parsed.projectId).toBe(projectId);
    expect(sessionParsed.isValid).toBe(true);
    expect(sessionParsed.session?.guest_email).toBe(email);
  });

  it('should validate file workflow end-to-end', () => {
    // Arrange
    const mockFile = new File(['mock content'], 'test-video.mp4', {
      type: 'video/mp4',
    });
    Object.defineProperty(mockFile, 'size', { value: 50 * 1024 * 1024 }); // 50MB

    // Act
    const validation = validateVideoFile(mockFile);
    const uploadPath = generateUploadPath('project-123', 'slot-456', 'video', mockFile.name);
    const tracker = new UploadProgressTracker();

    const progressValues: number[] = [];
    tracker.onProgress(p => progressValues.push(p));

    tracker.updateProgress(10);
    tracker.updateProgress(50);
    tracker.complete();

    // Assert
    expect(validation.isValid).toBe(true);
    expect(uploadPath).toContain('test-video.mp4');
    expect(progressValues).toEqual([10, 50, 100]);
  });
});