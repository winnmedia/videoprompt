import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ProjectPipelineState,
  ScenarioData,
  PromptData,
  VideoData,
  VersionMeta,
} from './model';

function nowIso() {
  return new Date().toISOString();
}

type ProjectActions = {
  init: (id?: string) => void;
  setScenario: (partial: Partial<ScenarioData>) => void;
  setPrompt: (partial: Partial<PromptData>) => void;
  setVideo: (partial: Partial<VideoData>) => void;
  addVersion: (version: VersionMeta) => void;
  setScenarioId: (id: string) => void;
  setPromptId: (id: string) => void;
  setVideoAssetId: (id: string) => void;
  reset: () => void;
};

type ProjectStore = ProjectPipelineState & ProjectActions;

const initialState: ProjectPipelineState = {
  id: '',
  scenario: {},
  prompt: {},
  video: {},
  versions: [],
  createdAt: nowIso(),
  updatedAt: nowIso(),
};

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      init: (id?: string) =>
        set(() => ({
          ...initialState,
          id: id || crypto.randomUUID(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })),

      setScenario: (partial) =>
        set((state) => ({
          scenario: { ...state.scenario, ...partial },
          updatedAt: nowIso(),
        })),

      setPrompt: (partial) =>
        set((state) => ({
          prompt: { ...state.prompt, ...partial },
          updatedAt: nowIso(),
        })),

      setVideo: (partial) =>
        set((state) => ({
          video: { ...state.video, ...partial },
          updatedAt: nowIso(),
        })),

      addVersion: (version) =>
        set((state) => ({
          versions: [version, ...state.versions],
          updatedAt: nowIso(),
        })),

      setScenarioId: (id) =>
        set(
          (state) =>
            ({
              scenario: { ...state.scenario },
              // store id in scenario metadata via special key
              // or expand model later; for now store under (as any)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...(state as any),
              scenarioId: id,
              updatedAt: nowIso(),
            }) as any,
        ),

      setPromptId: (id) =>
        set(
          (state) =>
            ({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...(state as any),
              promptId: id,
              updatedAt: nowIso(),
            }) as any,
        ),

      setVideoAssetId: (id) =>
        set(
          (state) =>
            ({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...(state as any),
              videoAssetId: id,
              updatedAt: nowIso(),
            }) as any,
        ),

      reset: () => set(() => ({ ...initialState, id: crypto.randomUUID() })),
    }),
    {
      name: 'project-storage',
      partialize: (state) => ({
        id: state.id,
        scenario: state.scenario,
        prompt: state.prompt,
        video: state.video,
        versions: state.versions,
        scenarioId: (state as any).scenarioId,
        promptId: (state as any).promptId,
        videoAssetId: (state as any).videoAssetId,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
      }),
      version: 1,
    }
  )
);
