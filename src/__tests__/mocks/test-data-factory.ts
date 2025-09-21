/**
 * 테스트 데이터 팩토리 - 일관된 테스트 데이터 생성
 * TDD 및 deterministic 테스트를 위한 표준화된 데이터 생성기
 */

// 간단한 테스트 데이터 생성기 (faker 없이)
// deterministic 결과를 위한 시드 기반 랜덤 생성기
class SimpleRandom {
  private seed: number;

  constructor(seed: number = 123) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number, decimals: number = 2): number {
    const value = this.next() * (max - min) + min;
    return parseFloat(value.toFixed(decimals));
  }

  choice<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)];
  }

  string(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.int(0, chars.length - 1)];
    }
    return result;
  }
}

const random = new SimpleRandom(123);

export interface TestUser {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestProject {
  id: string;
  name: string;
  description: string;
  userId: string;
  scenes: TestScene[];
  createdAt: string;
  updatedAt: string;
}

export interface TestScene {
  id: string;
  projectId: string;
  title: string;
  description: string;
  prompt: string;
  duration: number;
  order: number;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface TestStory {
  id: string;
  title: string;
  content: string;
  scenes: TestScene[];
  userId: string;
  metadata: {
    genre: string;
    themes: string[];
    duration: number;
    complexity: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 테스트 데이터 팩토리 클래스
 */
export class TestDataFactory {
  private static userCounter = 1;
  private static projectCounter = 1;
  private static sceneCounter = 1;
  private static storyCounter = 1;

  /**
   * 기본 테스트 사용자 생성
   */
  static createUser(overrides?: Partial<TestUser>): TestUser {
    const id = `user-${this.userCounter++}`;
    const now = new Date().toISOString();

    return {
      id,
      email: `user${this.userCounter}@example.com`,
      name: `Test User ${this.userCounter}`,
      verified: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * 인증된 관리자 사용자 생성
   */
  static createAdminUser(): TestUser {
    return this.createUser({
      email: 'admin@example.com',
      name: 'Admin User',
      verified: true,
    });
  }

  /**
   * 미인증 사용자 생성
   */
  static createUnverifiedUser(): TestUser {
    return this.createUser({
      verified: false,
    });
  }

  /**
   * 테스트 프로젝트 생성
   */
  static createProject(userId?: string, overrides?: Partial<TestProject>): TestProject {
    const id = `project-${this.projectCounter++}`;
    const now = new Date().toISOString();

    return {
      id,
      name: `Test Project ${this.projectCounter}`,
      description: `Test project description ${this.projectCounter}`,
      userId: userId || this.createUser().id,
      scenes: [],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * 복잡한 프로젝트 생성 (여러 씬 포함)
   */
  static createComplexProject(userId?: string, sceneCount: number = 3): TestProject {
    const project = this.createProject(userId);

    for (let i = 0; i < sceneCount; i++) {
      project.scenes.push(this.createScene(project.id, { order: i + 1 }));
    }

    return project;
  }

  /**
   * 테스트 씬 생성
   */
  static createScene(projectId?: string, overrides?: Partial<TestScene>): TestScene {
    const id = `scene-${this.sceneCounter++}`;
    const now = new Date().toISOString();

    return {
      id,
      projectId: projectId || this.createProject().id,
      title: `Scene ${this.sceneCounter}`,
      description: `Scene ${this.sceneCounter} description`,
      prompt: `Test prompt for scene ${this.sceneCounter}`,
      duration: random.int(10, 60),
      order: this.sceneCounter,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * 완료된 씬 생성
   */
  static createCompletedScene(projectId?: string): TestScene {
    return this.createScene(projectId, {
      status: 'completed',
    });
  }

  /**
   * 처리 중인 씬 생성
   */
  static createProcessingScene(projectId?: string): TestScene {
    return this.createScene(projectId, {
      status: 'processing',
    });
  }

  /**
   * 실패한 씬 생성
   */
  static createFailedScene(projectId?: string): TestScene {
    return this.createScene(projectId, {
      status: 'failed',
    });
  }

  /**
   * 테스트 스토리 생성
   */
  static createStory(userId?: string, overrides?: Partial<TestStory>): TestStory {
    const id = `story-${this.storyCounter++}`;
    const now = new Date().toISOString();

    return {
      id,
      title: `Test Story ${this.storyCounter}`,
      content: `This is test story content for story ${this.storyCounter}`,
      scenes: [],
      userId: userId || this.createUser().id,
      metadata: {
        genre: random.choice(['Drama', 'Comedy', 'Action', 'Thriller', 'Romance']),
        themes: ['theme1', 'theme2'],
        duration: random.int(60, 300),
        complexity: random.float(1, 10, 1),
      },
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * 씬이 포함된 완전한 스토리 생성
   */
  static createCompleteStory(userId?: string, sceneCount: number = 5): TestStory {
    const story = this.createStory(userId);
    const project = this.createProject(userId);

    for (let i = 0; i < sceneCount; i++) {
      story.scenes.push(this.createScene(project.id, {
        title: `${story.title} - Scene ${i + 1}`,
        order: i + 1,
      }));
    }

    return story;
  }

  /**
   * API 응답 형태의 데이터 생성
   */
  static createApiResponse<T>(data: T, status: number = 200) {
    return {
      data,
      status,
      message: status === 200 ? 'Success' : 'Error',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 페이지네이션 응답 생성
   */
  static createPaginatedResponse<T>(
    items: T[],
    page: number = 1,
    limit: number = 10,
    total?: number
  ) {
    const actualTotal = total || items.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = items.slice(startIndex, endIndex);

    return {
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total: actualTotal,
        totalPages: Math.ceil(actualTotal / limit),
        hasNext: endIndex < actualTotal,
        hasPrev: page > 1,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 에러 응답 생성
   */
  static createErrorResponse(message: string, code?: string, status: number = 500) {
    return {
      error: {
        message,
        code: code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
      status,
    };
  }

  /**
   * 성능 메트릭 데이터 생성
   */
  static createPerformanceMetrics() {
    return {
      responseTime: random.int(50, 500),
      throughput: random.int(100, 1000),
      errorRate: random.float(0, 0.05, 3),
      cpuUsage: random.float(10, 80, 1),
      memoryUsage: random.float(20, 90, 1),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 카운터 리셋 (테스트 격리용)
   */
  static resetCounters() {
    this.userCounter = 1;
    this.projectCounter = 1;
    this.sceneCounter = 1;
    this.storyCounter = 1;

    // 랜덤 시드도 다시 설정
    random.seed = 123;
  }

  /**
   * 대량 데이터 생성 (성능 테스트용)
   */
  static createBulkData(type: 'users' | 'projects' | 'scenes' | 'stories', count: number) {
    const items = [];

    for (let i = 0; i < count; i++) {
      switch (type) {
        case 'users':
          items.push(this.createUser());
          break;
        case 'projects':
          items.push(this.createProject());
          break;
        case 'scenes':
          items.push(this.createScene());
          break;
        case 'stories':
          items.push(this.createStory());
          break;
      }
    }

    return items;
  }
}

/**
 * 테스트 시나리오별 프리셋 데이터
 */
export const TestPresets = {
  // 기본 테스트 시나리오
  basicScenario: {
    user: TestDataFactory.createUser(),
    project: TestDataFactory.createProject(),
    scene: TestDataFactory.createScene(),
  },

  // 복합 워크플로우 테스트
  complexWorkflow: {
    admin: TestDataFactory.createAdminUser(),
    users: TestDataFactory.createBulkData('users', 3),
    projects: TestDataFactory.createBulkData('projects', 5),
    stories: TestDataFactory.createBulkData('stories', 10),
  },

  // 에러 시나리오
  errorScenarios: {
    unverifiedUser: TestDataFactory.createUnverifiedUser(),
    failedScene: TestDataFactory.createFailedScene(),
    errorResponse: TestDataFactory.createErrorResponse('Test error'),
  },

  // 성능 테스트
  performanceTest: {
    largeDataset: {
      users: TestDataFactory.createBulkData('users', 100),
      projects: TestDataFactory.createBulkData('projects', 50),
      scenes: TestDataFactory.createBulkData('scenes', 200),
    },
    metrics: TestDataFactory.createPerformanceMetrics(),
  },
};

// 테스트 후크용 유틸리티
export const testDataUtils = {
  /**
   * 각 테스트 전에 데이터 초기화
   */
  beforeEach: () => {
    TestDataFactory.resetCounters();
  },

  /**
   * 특정 시나리오 데이터 준비
   */
  setupScenario: (scenarioName: keyof typeof TestPresets) => {
    TestDataFactory.resetCounters();
    return TestPresets[scenarioName];
  },

  /**
   * Mock 데이터베이스 시뮬레이션
   */
  mockDatabase: {
    users: new Map<string, TestUser>(),
    projects: new Map<string, TestProject>(),
    scenes: new Map<string, TestScene>(),
    stories: new Map<string, TestStory>(),

    reset() {
      this.users.clear();
      this.projects.clear();
      this.scenes.clear();
      this.stories.clear();
    },

    seedData() {
      const preset = TestPresets.basicScenario;
      this.users.set(preset.user.id, preset.user);
      this.projects.set(preset.project.id, preset.project);
      this.scenes.set(preset.scene.id, preset.scene);
    },
  },
};