import { configureStore } from '@reduxjs/toolkit';
import {
  storyReducer,
  addStory,
  updateStory,
  deleteStory,
  setCurrentStory,
  generateStorySuccess,
} from '@/entities/story';
import type { Story, StoryGenerateResponse, StoryGenre, StoryStatus, FourActStoryChapters } from '@/entities/story';

type TestStore = ReturnType<typeof configureStore<{
  story: ReturnType<typeof storyReducer>
}>>;

describe('Story Entity', () => {
  let store: TestStore;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        story: storyReducer,
      },
    });
  });

  it('초기 상태가 올바르게 설정되어야 함', () => {
    const state = store.getState().story as ReturnType<typeof storyReducer>;
    expect(state.stories).toEqual([]);
    expect(state.currentStory).toBeNull();
    expect(state.generateStatus).toBe('idle');
    expect(state.generateProgress).toBe(0);
    expect(state.error).toBeNull();
  });

  it('스토리 추가가 올바르게 동작해야 함', () => {
    const mockStory: Story = {
      id: 'story-1',
      title: '테스트 스토리',
      summary: '테스트 스토리 요약',
      synopsis: '테스트 시놉시스',
      userId: 'user-1',
      genre: 'drama' as StoryGenre,
      totalDuration: 120,
      chapters: {
        exposition: {
          title: '발단',
          content: '스토리의 시작 부분',
          thumbnailUrl: '',
          duration: 30,
        },
        rising_action: {
          title: '전개',
          content: '갈등이 발생',
          thumbnailUrl: '',
          duration: 40,
        },
        climax: {
          title: '절정',
          content: '최고조의 갈등',
          thumbnailUrl: '',
          duration: 30,
        },
        resolution: {
          title: '결말',
          content: '갈등의 해결',
          thumbnailUrl: '',
          duration: 20,
        },
      },
      metadata: {
        tone: '진지한',
        message: '메시지',
        keywords: ['테스트'],
        generatedAt: new Date().toISOString(),
      },
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.dispatch(addStory(mockStory));

    const state = store.getState().story as ReturnType<typeof storyReducer>;
    expect(state.stories).toHaveLength(1);
    expect(state.stories[0]).toEqual(mockStory);
    expect(state.currentStory).toEqual(mockStory);
  });

  it('스토리 업데이트가 올바르게 동작해야 함', () => {
    const mockStory: Story = {
      id: 'story-1',
      title: '원본 제목',
      summary: '원본 스토리 요약',
      synopsis: '원본 시놉시스',
      userId: 'user-1',
      genre: 'drama' as StoryGenre,
      totalDuration: 120,
      chapters: {
        exposition: {
          title: '발단',
          content: '스토리의 시작 부분',
          thumbnailUrl: '',
          duration: 30,
        },
        rising_action: {
          title: '전개',
          content: '갈등이 발생',
          thumbnailUrl: '',
          duration: 40,
        },
        climax: {
          title: '절정',
          content: '최고조의 갈등',
          thumbnailUrl: '',
          duration: 30,
        },
        resolution: {
          title: '결말',
          content: '갈등의 해결',
          thumbnailUrl: '',
          duration: 20,
        },
      },
      metadata: {
        tone: '진지한',
        message: '메시지',
        keywords: ['테스트'],
        generatedAt: new Date().toISOString(),
      },
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.dispatch(addStory(mockStory));
    store.dispatch(updateStory({
      id: 'story-1',
      updates: { title: '수정된 제목', status: 'published' },
    }));

    const state = store.getState().story as ReturnType<typeof storyReducer>;
    expect(state.stories[0].title).toBe('수정된 제목');
    expect(state.stories[0].status).toBe('published');
  });

  it('스토리 삭제가 올바르게 동작해야 함', () => {
    const story1: Story = {
      id: 'story-1',
      title: '스토리 1',
      summary: '스토리 1 요약',
      synopsis: '시놉시스 1',
      userId: 'user-1',
      genre: 'drama' as StoryGenre,
      totalDuration: 120,
      chapters: {
        exposition: {
          title: '발단',
          content: '스토리의 시작 부분',
          thumbnailUrl: '',
          duration: 30,
        },
        rising_action: {
          title: '전개',
          content: '갈등이 발생',
          thumbnailUrl: '',
          duration: 40,
        },
        climax: {
          title: '절정',
          content: '최고조의 갈등',
          thumbnailUrl: '',
          duration: 30,
        },
        resolution: {
          title: '결말',
          content: '갈등의 해결',
          thumbnailUrl: '',
          duration: 20,
        },
      },
      metadata: {
        tone: '진지한',
        message: '메시지',
        keywords: [],
        generatedAt: new Date().toISOString(),
      },
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const story2: Story = {
      ...story1,
      id: 'story-2',
      title: '스토리 2',
    };

    store.dispatch(addStory(story1));
    store.dispatch(addStory(story2));
    store.dispatch(deleteStory('story-2'));

    const state = store.getState().story as ReturnType<typeof storyReducer>;
    expect(state.stories).toHaveLength(1);
    expect(state.stories[0].id).toBe('story-1');
    expect(state.currentStory?.id).toBe('story-1');
  });

  it('스토리 생성 성공이 올바르게 동작해야 함', () => {
    const mockResponse: StoryGenerateResponse = {
      id: 'generated-1',
      title: '생성된 스토리',
      summary: '생성된 시놉시스',
      synopsis: '생성된 시놉시스',
      genre: 'action' as StoryGenre,
      status: 'draft',
      totalDuration: 120,
      chapters: {
        exposition: {
          title: '발단',
          content: '스토리 시작',
          thumbnailUrl: '',
          duration: 30,
        },
        rising_action: {
          title: '전개',
          content: '갈등 발생',
          thumbnailUrl: '',
          duration: 40,
        },
        climax: {
          title: '절정',
          content: '최고조',
          thumbnailUrl: '',
          duration: 30,
        },
        resolution: {
          title: '결말',
          content: '해결',
          thumbnailUrl: '',
          duration: 20,
        },
      },
      metadata: {
        tone: '긴장감있는',
        message: '메시지',
        keywords: ['액션', '스릴'],
        generatedAt: new Date().toISOString(),
      },
    };

    store.dispatch(generateStorySuccess(mockResponse));

    const state = store.getState().story as ReturnType<typeof storyReducer>;
    expect(state.stories).toHaveLength(1);
    expect(state.currentStory?.title).toBe('생성된 스토리');
    expect(state.generateStatus).toBe('succeeded');
    expect(state.generateProgress).toBe(100);
  });
});