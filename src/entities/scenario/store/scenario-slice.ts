/**
 * Scenario Slice Implementation
 * 시나리오 상태 관리를 위한 Redux slice
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Scenario } from '../model/Scenario';
import { db, auth } from '@/shared/lib/supabase';
// FSD 구조 준수 - 타입만 정의
interface ScenarioGenerateRequest {
  idea: string;
  genre: string;
  targetAudience: string;
  duration: number;
}

interface ScenarioGenerateResponse {
  scenario: Scenario;
}

// API 호출 함수는 외부에서 주입
let generateScenarioAPI: (
  request: ScenarioGenerateRequest
) => Promise<ScenarioGenerateResponse> = async () => {
  throw new Error('API 함수가 주입되지 않았습니다');
};

// API 함수 주입 (테스트용)
export function setApiGenerateScenario(
  generateFn: (
    request: ScenarioGenerateRequest
  ) => Promise<ScenarioGenerateResponse>
) {
  generateScenarioAPI = generateFn;
}

export interface ScenarioState {
  scenarios: Scenario[];
  currentScenario: Scenario | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
}

const initialState: ScenarioState = {
  scenarios: [],
  currentScenario: null,
  isLoading: false,
  isGenerating: false,
  error: null,
};

// Supabase에서 시나리오 목록 가져오기
export const fetchScenarios = createAsyncThunk(
  'scenario/fetchAll',
  async () => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const { data, error } = await db.scenarios.getAll(user.id);
    if (error) throw new Error(error.message);

    return data || [];
  }
);

// Supabase에서 특정 시나리오 가져오기
export const fetchScenario = createAsyncThunk(
  'scenario/fetchOne',
  async (scenarioId: string) => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const { data, error } = await db.scenarios.getById(scenarioId, user.id);
    if (error) throw new Error(error.message);

    return data;
  }
);

// Supabase에 시나리오 저장
export const saveScenario = createAsyncThunk(
  'scenario/save',
  async (scenario: Scenario) => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const scenarioData = {
      user_id: user.id,
      title: scenario.title,
      content: scenario.content,
      genre: scenario.genre,
      style: scenario.style || 'natural',
      target: scenario.targetAudience || 'general',
      structure: scenario.structure || 'traditional',
      intensity: scenario.intensity || 'medium',
      quality_score: scenario.qualityScore,
      estimated_duration: scenario.estimatedDuration,
      cost: scenario.cost,
      tokens: scenario.metadata?.tokens || 0,
      feedback: scenario.feedback || [],
      suggestions: scenario.suggestions || [],
    };

    const { data, error } = await db.scenarios.create(scenarioData);
    if (error) throw new Error(error.message);

    return data;
  }
);

// Supabase에서 시나리오 업데이트
export const updateScenario = createAsyncThunk(
  'scenario/update',
  async (scenario: Scenario) => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다');

    if (!scenario.id) throw new Error('시나리오 ID가 필요합니다');

    const updateData = {
      title: scenario.title,
      content: scenario.content,
      genre: scenario.genre,
      style: scenario.style || 'natural',
      target: scenario.targetAudience || 'general',
      structure: scenario.structure || 'traditional',
      intensity: scenario.intensity || 'medium',
      quality_score: scenario.qualityScore,
      estimated_duration: scenario.estimatedDuration,
      cost: scenario.cost,
      tokens: scenario.metadata?.tokens || 0,
      feedback: scenario.feedback || [],
      suggestions: scenario.suggestions || [],
    };

    const { data, error } = await db.scenarios.update(scenario.id, updateData, user.id);
    if (error) throw new Error(error.message);

    return data;
  }
);

// Supabase에서 시나리오 삭제
export const deleteScenario = createAsyncThunk(
  'scenario/delete',
  async (scenarioId: string) => {
    const user = await auth.getCurrentUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const { error } = await db.scenarios.delete(scenarioId, user.id);
    if (error) throw new Error(error.message);

    return scenarioId;
  }
);

export const generateScenario = createAsyncThunk(
  'scenario/generate',
  async (request: ScenarioGenerateRequest) => {
    const response = await generateScenarioAPI(request);
    return response;
  }
);

export const scenarioSlice = createSlice({
  name: 'scenario',
  initialState,
  reducers: {
    setCurrentScenario: (state, action: PayloadAction<Scenario>) => {
      state.currentScenario = action.payload;
      state.error = null;
    },
    clearCurrentScenario: (state) => {
      state.currentScenario = null;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 시나리오 목록 가져오기
      .addCase(fetchScenarios.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchScenarios.fulfilled, (state, action) => {
        state.isLoading = false;
        state.scenarios = action.payload;
        state.error = null;
      })
      .addCase(fetchScenarios.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '시나리오 목록 조회 실패';
      })

      // 특정 시나리오 가져오기
      .addCase(fetchScenario.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchScenario.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentScenario = action.payload;
        state.error = null;
      })
      .addCase(fetchScenario.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '시나리오 조회 실패';
      })

      // 시나리오 저장
      .addCase(saveScenario.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(saveScenario.fulfilled, (state, action) => {
        state.isLoading = false;
        const newScenario = action.payload;

        // 기존 목록에 추가
        const existingIndex = state.scenarios.findIndex(
          (s) => s.id === newScenario.id
        );
        if (existingIndex >= 0) {
          state.scenarios[existingIndex] = newScenario;
        } else {
          state.scenarios.push(newScenario);
        }

        state.currentScenario = newScenario;
        state.error = null;
      })
      .addCase(saveScenario.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '시나리오 저장 실패';
      })

      // 시나리오 업데이트
      .addCase(updateScenario.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateScenario.fulfilled, (state, action) => {
        state.isLoading = false;
        const updatedScenario = action.payload;

        // 목록에서 업데이트
        const existingIndex = state.scenarios.findIndex(
          (s) => s.id === updatedScenario.id
        );
        if (existingIndex >= 0) {
          state.scenarios[existingIndex] = updatedScenario;
        }

        // 현재 시나리오가 업데이트된 시나리오라면 교체
        if (state.currentScenario?.id === updatedScenario.id) {
          state.currentScenario = updatedScenario;
        }

        state.error = null;
      })
      .addCase(updateScenario.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '시나리오 업데이트 실패';
      })

      // 시나리오 삭제
      .addCase(deleteScenario.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteScenario.fulfilled, (state, action) => {
        state.isLoading = false;
        const deletedId = action.payload;

        // 목록에서 제거
        state.scenarios = state.scenarios.filter(s => s.id !== deletedId);

        // 현재 시나리오가 삭제된 시나리오라면 초기화
        if (state.currentScenario?.id === deletedId) {
          state.currentScenario = null;
        }

        state.error = null;
      })
      .addCase(deleteScenario.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || '시나리오 삭제 실패';
      })

      // 시나리오 생성 (AI)
      .addCase(generateScenario.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(generateScenario.fulfilled, (state, action) => {
        state.isGenerating = false;
        state.currentScenario = action.payload.scenario;

        // 기존 시나리오 목록에 추가 (중복 제거)
        const existingIndex = state.scenarios.findIndex(
          (s) => s.id === action.payload.scenario.id
        );
        if (existingIndex >= 0) {
          state.scenarios[existingIndex] = action.payload.scenario;
        } else {
          state.scenarios.push(action.payload.scenario);
        }

        state.error = null;
      })
      .addCase(generateScenario.rejected, (state, action) => {
        state.isGenerating = false;
        state.currentScenario = null;
        state.error = action.error.message || '시나리오 생성 실패';
      });
  },
});

export const {
  setCurrentScenario,
  clearCurrentScenario,
  setError,
  clearError,
} = scenarioSlice.actions;

// Async thunk actions export
export {
  fetchScenarios,
  fetchScenario,
  saveScenario,
  updateScenario,
  deleteScenario,
  generateScenario,
};

export default scenarioSlice.reducer;
