/**
 * Project Entity Tests (TDD RED Phase)
 * 프로젝트 관리 엔티티 테스트
 */

import {
  Project,
  createProject,
  updateProjectStatus,
  validateProject,
  attachStoryToProject,
} from './Project';

describe('Project Entity', () => {
  describe('createProject', () => {
    it('should create a project with required fields', () => {
      const title = '히어로의 모험';
      const description = '평범한 청년이 영웅이 되어가는 이야기';
      const userId = 'user_123';

      const project = createProject(title, description, userId);

      expect(project).toMatchObject({
        title,
        description,
        userId,
        status: 'planning',
      });
      expect(project.id).toMatch(/^project_/);
      expect(project.storyId).toBeUndefined();
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
    });

    it('should throw error for empty title', () => {
      expect(() => {
        createProject('', '설명', 'user_123');
      }).toThrow('프로젝트 제목은 필수입니다');
    });

    it('should throw error for empty description', () => {
      expect(() => {
        createProject('제목', '', 'user_123');
      }).toThrow('프로젝트 설명은 필수입니다');
    });

    it('should throw error for empty userId', () => {
      expect(() => {
        createProject('제목', '설명', '');
      }).toThrow('사용자 ID는 필수입니다');
    });
  });

  describe('updateProjectStatus', () => {
    let baseProject: Project;

    beforeEach(() => {
      baseProject = createProject('테스트 프로젝트', '테스트 설명', 'user_123');
    });

    it('should update project status from planning to storyboard', async () => {
      // 시간 차이를 보장하기 위해 5ms 대기
      await new Promise((resolve) => setTimeout(resolve, 5));

      const updatedProject = updateProjectStatus(baseProject, 'storyboard');

      expect(updatedProject.status).toBe('storyboard');
      expect(updatedProject.updatedAt).not.toBe(baseProject.updatedAt);
    });

    it('should update project status through all valid transitions', () => {
      const statuses: Array<Project['status']> = [
        'planning',
        'storyboard',
        'production',
        'completed',
      ];

      let project = baseProject;

      for (let i = 1; i < statuses.length; i++) {
        project = updateProjectStatus(project, statuses[i]);
        expect(project.status).toBe(statuses[i]);
      }
    });

    it('should not allow invalid status transitions', () => {
      expect(() => {
        updateProjectStatus(baseProject, 'completed');
      }).toThrow('planning에서 completed로 직접 전환할 수 없습니다');
    });

    it('should allow reverting to previous status', () => {
      const storyboardProject = updateProjectStatus(baseProject, 'storyboard');
      const revertedProject = updateProjectStatus(
        storyboardProject,
        'planning'
      );

      expect(revertedProject.status).toBe('planning');
    });
  });

  describe('validateProject', () => {
    it('should validate complete project object', () => {
      const project: Project = {
        id: 'project_123',
        title: '좋은 프로젝트',
        description: '충분히 긴 설명입니다. 최소 20자 이상이어야 합니다.',
        userId: 'user_123',
        status: 'planning',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validateProject(project);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for too short description', () => {
      const projectWithShortDescription: Partial<Project> = {
        id: 'project_123',
        title: '제목',
        description: '짧음',
        userId: 'user_123',
        status: 'planning',
      };

      const result = validateProject(projectWithShortDescription);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('설명은 최소 20자 이상이어야 합니다');
    });

    it('should fail validation for too long title', () => {
      const projectWithLongTitle: Partial<Project> = {
        id: 'project_123',
        title: 'a'.repeat(151), // 151자
        description: '충분히 긴 설명입니다. 최소 20자 이상이어야 합니다.',
        userId: 'user_123',
        status: 'planning',
      };

      const result = validateProject(projectWithLongTitle);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('제목은 150자를 초과할 수 없습니다');
    });

    it('should fail validation for missing required fields', () => {
      const incompleteProject: Partial<Project> = {
        title: '제목',
        // description, userId, status 누락
      };

      const result = validateProject(incompleteProject);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('설명은 필수입니다');
      expect(result.errors).toContain('사용자 ID는 필수입니다');
      expect(result.errors).toContain('상태는 필수입니다');
    });

    it('should fail validation for invalid status', () => {
      const projectWithInvalidStatus = {
        id: 'project_123',
        title: '제목',
        description: '충분히 긴 설명입니다. 최소 20자 이상이어야 합니다.',
        userId: 'user_123',
        status: 'invalid_status' as Project['status'],
      };

      const result = validateProject(projectWithInvalidStatus);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('유효하지 않은 상태입니다');
    });
  });

  describe('attachStoryToProject', () => {
    let baseProject: Project;

    beforeEach(() => {
      baseProject = createProject(
        '테스트 프로젝트',
        '충분히 긴 설명입니다. 최소 20자 이상이어야 합니다.',
        'user_123'
      );
    });

    it('should attach story to project', async () => {
      // 시간 차이를 보장하기 위해 5ms 대기
      await new Promise((resolve) => setTimeout(resolve, 5));

      const storyId = 'story_456';
      const updatedProject = attachStoryToProject(baseProject, storyId);

      expect(updatedProject.storyId).toBe(storyId);
      expect(updatedProject.updatedAt).not.toBe(baseProject.updatedAt);
    });

    it('should replace existing story', () => {
      const firstStoryId = 'story_456';
      const secondStoryId = 'story_789';

      const projectWithFirstStory = attachStoryToProject(
        baseProject,
        firstStoryId
      );
      const projectWithSecondStory = attachStoryToProject(
        projectWithFirstStory,
        secondStoryId
      );

      expect(projectWithSecondStory.storyId).toBe(secondStoryId);
    });

    it('should throw error for empty storyId', () => {
      expect(() => {
        attachStoryToProject(baseProject, '');
      }).toThrow('스토리 ID는 필수입니다');
    });

    it('should not attach same story twice', () => {
      const storyId = 'story_456';
      const projectWithStory = attachStoryToProject(baseProject, storyId);

      expect(() => {
        attachStoryToProject(projectWithStory, storyId);
      }).toThrow('스토리가 이미 프로젝트에 연결되어 있습니다');
    });
  });
});
