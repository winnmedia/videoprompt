/**
 * Project Slice 단위 테스트
 * Redux Toolkit을 사용한 프로젝트 파이프라인 상태 관리 테스트
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import projectReducer, {
  init,
  setScenario,
  setPrompt,
  setVideo,
  updateVideo,
  addVersion,
  setScenarioId,
  setPromptId,
  setVideoAssetId,
  reset,
  selectProject,
  selectProjectId,
  selectScenario,
  selectPrompt,
  selectVideo,
  selectVersions,
  type ProjectPipelineState,
  type ScenarioData,
  type PromptData,
  type VideoData,
  type VersionMeta
} from '../project-slice';

// Mock crypto.randomUUID
const mockUUID = 'test-uuid-123';
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => mockUUID)
});

describe('Project Slice 단위 테스트', () => {
  let store: ReturnType<typeof configureStore>;
  const fixedDate = '2024-09-21T10:00:00.000Z';

  beforeEach(() => {
    // Date를 고정하여 테스트 결정론성 확보
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedDate));

    store = configureStore({
      reducer: {
        project: projectReducer
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('초기 상태 검증', () => {
    it('올바른 초기 상태를 가져야 한다', () => {
      const state = store.getState().project;

      expect(state.id).toBe('');
      expect(state.scenario).toEqual({});
      expect(state.prompt).toEqual({});
      expect(state.video).toEqual({});
      expect(state.versions).toEqual([]);
      expect(state.createdAt).toBeDefined();
      expect(state.updatedAt).toBeDefined();
      expect(typeof state.createdAt).toBe('string');
      expect(typeof state.updatedAt).toBe('string');
    });
  });

  describe('init 액션', () => {
    it('새로운 UUID로 프로젝트를 초기화해야 한다', () => {
      store.dispatch(init());

      const state = store.getState().project;
      expect(state.id).toBe(mockUUID);
      expect(state.createdAt).toBe(fixedDate);
      expect(state.updatedAt).toBe(fixedDate);
    });

    it('제공된 ID로 프로젝트를 초기화해야 한다', () => {
      const customId = 'custom-project-id';
      store.dispatch(init(customId));

      const state = store.getState().project;
      expect(state.id).toBe(customId);
    });
  });

  describe('setScenario 액션', () => {
    it('시나리오 데이터를 설정하고 updatedAt을 갱신해야 한다', () => {
      const scenarioData: ScenarioData = {
        title: '로봇과 인간의 우정',
        description: '감동적인 SF 드라마',
        duration: 60,
        genre: '드라마',
        target: '일반 시청자',
        toneAndManner: ['감동적', '따뜻한']
      };

      store.dispatch(setScenario(scenarioData));

      const state = store.getState().project;
      expect(state.scenario).toEqual(scenarioData);
      expect(state.updatedAt).toBe(fixedDate);
    });

    it('기존 시나리오에 부분 업데이트해야 한다', () => {
      // 첫 번째 업데이트
      store.dispatch(setScenario({ title: '첫 번째 제목' }));

      // 두 번째 부분 업데이트
      store.dispatch(setScenario({ description: '두 번째 설명' }));

      const state = store.getState().project;
      expect(state.scenario).toEqual({
        title: '첫 번째 제목',
        description: '두 번째 설명'
      });
    });
  });

  describe('setPrompt 액션', () => {
    it('프롬프트 데이터를 설정해야 한다', () => {
      const promptData: PromptData = {
        content: '로봇과 인간이 만나는 장면을 그려주세요',
        visualStyle: 'cinematic',
        mood: 'warm',
        quality: 'high',
        keywords: ['robot', 'human', 'friendship'],
        generatedAt: fixedDate
      };

      store.dispatch(setPrompt(promptData));

      const state = store.getState().project;
      expect(state.prompt).toEqual(promptData);
      expect(state.updatedAt).toBe(fixedDate);
    });
  });

  describe('setVideo 및 updateVideo 액션', () => {
    const videoData: VideoData = {
      url: 'https://example.com/video.mp4',
      status: 'completed',
      duration: 60,
      format: 'mp4',
      size: 1024000,
      generatedAt: fixedDate
    };

    it('setVideo로 비디오 데이터를 설정해야 한다', () => {
      store.dispatch(setVideo(videoData));

      const state = store.getState().project;
      expect(state.video).toEqual(videoData);
      expect(state.updatedAt).toBe(fixedDate);
    });

    it('updateVideo로 비디오 데이터를 업데이트해야 한다', () => {
      store.dispatch(updateVideo(videoData));

      const state = store.getState().project;
      expect(state.video).toEqual(videoData);
      expect(state.updatedAt).toBe(fixedDate);
    });

    it('비디오 상태만 부분 업데이트해야 한다', () => {
      store.dispatch(setVideo({ url: 'initial-url' }));
      store.dispatch(updateVideo({ status: 'generating' }));

      const state = store.getState().project;
      expect(state.video).toEqual({
        url: 'initial-url',
        status: 'generating'
      });
    });
  });

  describe('addVersion 액션', () => {
    it('새 버전을 리스트 맨 앞에 추가해야 한다', () => {
      const version1: VersionMeta = {
        id: 'v1',
        type: 'scenario',
        timestamp: fixedDate,
        description: '첫 번째 버전',
        data: { title: '첫 번째' }
      };

      const version2: VersionMeta = {
        id: 'v2',
        type: 'prompt',
        timestamp: fixedDate,
        description: '두 번째 버전',
        data: { content: '두 번째' }
      };

      store.dispatch(addVersion(version1));
      store.dispatch(addVersion(version2));

      const state = store.getState().project;
      expect(state.versions).toEqual([version2, version1]);
      expect(state.versions).toHaveLength(2);
    });
  });

  describe('ID 설정 액션들', () => {
    it('setScenarioId로 시나리오 ID를 설정해야 한다', () => {
      const scenarioId = 'scenario-123';
      store.dispatch(setScenarioId(scenarioId));

      const state = store.getState().project;
      expect(state.scenarioId).toBe(scenarioId);
      expect(state.updatedAt).toBe(fixedDate);
    });

    it('setPromptId로 프롬프트 ID를 설정해야 한다', () => {
      const promptId = 'prompt-456';
      store.dispatch(setPromptId(promptId));

      const state = store.getState().project;
      expect(state.promptId).toBe(promptId);
    });

    it('setVideoAssetId로 비디오 에셋 ID를 설정해야 한다', () => {
      const videoAssetId = 'video-789';
      store.dispatch(setVideoAssetId(videoAssetId));

      const state = store.getState().project;
      expect(state.videoAssetId).toBe(videoAssetId);
    });
  });

  describe('reset 액션', () => {
    it('모든 상태를 초기화하고 새 UUID를 생성해야 한다', () => {
      // 먼저 상태를 변경
      store.dispatch(setScenario({ title: '테스트 제목' }));
      store.dispatch(setPrompt({ content: '테스트 내용' }));
      store.dispatch(addVersion({
        id: 'v1',
        type: 'scenario',
        timestamp: fixedDate,
        data: {}
      }));

      // 리셋 실행
      store.dispatch(reset());

      const state = store.getState().project;
      expect(state.id).toBe(mockUUID);
      expect(state.scenario).toEqual({});
      expect(state.prompt).toEqual({});
      expect(state.video).toEqual({});
      expect(state.versions).toEqual([]);
      expect(state.scenarioId).toBeUndefined();
      expect(state.promptId).toBeUndefined();
      expect(state.videoAssetId).toBeUndefined();
    });
  });

  describe('Selectors 테스트', () => {
    beforeEach(() => {
      // 테스트 데이터 설정
      store.dispatch(init('test-project'));
      store.dispatch(setScenario({ title: 'Test Scenario' }));
      store.dispatch(setPrompt({ content: 'Test Prompt' }));
      store.dispatch(setVideo({ url: 'test-video.mp4' }));
      store.dispatch(addVersion({
        id: 'v1',
        type: 'scenario',
        timestamp: fixedDate,
        data: {}
      }));
    });

    it('selectProject가 전체 프로젝트 상태를 반환해야 한다', () => {
      const state = store.getState();
      const project = selectProject(state);

      expect(project.id).toBe('test-project');
      expect(project.scenario.title).toBe('Test Scenario');
    });

    it('selectProjectId가 프로젝트 ID를 반환해야 한다', () => {
      const state = store.getState();
      const projectId = selectProjectId(state);

      expect(projectId).toBe('test-project');
    });

    it('selectScenario가 시나리오 데이터를 반환해야 한다', () => {
      const state = store.getState();
      const scenario = selectScenario(state);

      expect(scenario.title).toBe('Test Scenario');
    });

    it('selectPrompt가 프롬프트 데이터를 반환해야 한다', () => {
      const state = store.getState();
      const prompt = selectPrompt(state);

      expect(prompt.content).toBe('Test Prompt');
    });

    it('selectVideo가 비디오 데이터를 반환해야 한다', () => {
      const state = store.getState();
      const video = selectVideo(state);

      expect(video.url).toBe('test-video.mp4');
    });

    it('selectVersions가 버전 배열을 반환해야 한다', () => {
      const state = store.getState();
      const versions = selectVersions(state);

      expect(versions).toHaveLength(1);
      expect(versions[0].id).toBe('v1');
    });
  });

  describe('상태 불변성 확인', () => {
    it('액션 실행 후 이전 상태가 변경되지 않아야 한다', () => {
      const initialState = store.getState().project;
      const initialScenario = initialState.scenario;

      store.dispatch(setScenario({ title: '새 제목' }));

      // 이전 상태 객체가 변경되지 않았는지 확인
      expect(initialScenario).toEqual({});
      expect(initialState.scenario).toEqual({});
    });
  });

  describe('에러 케이스 처리', () => {
    it('undefined 값으로 업데이트해도 에러가 발생하지 않아야 한다', () => {
      expect(() => {
        store.dispatch(setScenario(undefined as any));
      }).not.toThrow();

      const state = store.getState().project;
      expect(state.scenario).toEqual({});
    });

    it('null 값으로 업데이트해도 안전해야 한다', () => {
      expect(() => {
        store.dispatch(setPrompt(null as any));
      }).not.toThrow();

      const state = store.getState().project;
      expect(state.prompt).toEqual({});
    });
  });

  describe('타임스탬프 관리', () => {
    it('모든 업데이트 액션이 updatedAt을 갱신해야 한다', () => {
      const actions = [
        () => store.dispatch(setScenario({ title: 'test' })),
        () => store.dispatch(setPrompt({ content: 'test' })),
        () => store.dispatch(setVideo({ url: 'test' })),
        () => store.dispatch(updateVideo({ status: 'completed' })),
        () => store.dispatch(addVersion({ id: 'v1', type: 'scenario', timestamp: fixedDate, data: {} })),
        () => store.dispatch(setScenarioId('test')),
        () => store.dispatch(setPromptId('test')),
        () => store.dispatch(setVideoAssetId('test'))
      ];

      actions.forEach((action) => {
        const beforeState = store.getState().project;
        action();
        const afterState = store.getState().project;

        expect(afterState.updatedAt).toBe(fixedDate);
      });
    });
  });
});