/**
 * 스토리보드 Redux 슬라이스
 * 클라이언트 상태 관리 (생성 진행 상태, UI 상태 등)
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  StoryboardGenerationState,
  ShotGenerationState,
  ShotGenerationStatus,
  StoryboardResult,
} from '../../types/storyboard';

// =============================================================================
// 상태 타입 정의
// =============================================================================

interface StoryboardSliceState {
  /** 현재 활성 프로젝트 ID */
  activeProjectId: string | null;
  
  /** 프로젝트별 생성 상태 */
  generationStates: Record<string, StoryboardGenerationState>;
  
  /** 생성된 결과 (프로젝트별) */
  generatedResults: Record<string, StoryboardResult[]>;
  
  /** UI 상태 */
  ui: {
    /** 생성 패널 표시 여부 */
    isGenerationPanelOpen: boolean;
    
    /** 선택된 샷 ID */
    selectedShotId: string | null;
    
    /** 뷰 모드 */
    viewMode: 'grid' | 'list' | 'timeline';
    
    /** 필터 */
    filter: {
      status: ShotGenerationStatus | 'all';
      model: string | 'all';
    };
    
    /** 정렬 */
    sort: {
      by: 'sequence' | 'status' | 'generatedAt';
      order: 'asc' | 'desc';
    };
  };
  
  /** 에러 상태 */
  errors: Array<{
    id: string;
    message: string;
    timestamp: number;
    shotId?: string;
  }>;
  
  /** 통계 */
  statistics: {
    totalGenerated: number;
    totalFailed: number;
    averageGenerationTime: number;
    cacheHitRate: number;
  };
}

// =============================================================================
// 초기 상태
// =============================================================================

const initialState: StoryboardSliceState = {
  activeProjectId: null,
  generationStates: {},
  generatedResults: {},
  ui: {
    isGenerationPanelOpen: false,
    selectedShotId: null,
    viewMode: 'grid',
    filter: {
      status: 'all',
      model: 'all',
    },
    sort: {
      by: 'sequence',
      order: 'asc',
    },
  },
  errors: [],
  statistics: {
    totalGenerated: 0,
    totalFailed: 0,
    averageGenerationTime: 0,
    cacheHitRate: 0,
  },
};

// =============================================================================
// Redux 슬라이스
// =============================================================================

const storyboardSlice = createSlice({
  name: 'storyboard',
  initialState,
  reducers: {
    /**
     * 활성 프로젝트 설정
     */
    setActiveProject: (state, action: PayloadAction<string>) => {
      state.activeProjectId = action.payload;
    },
    
    /**
     * 생성 상태 초기화
     */
    initializeGenerationState: (
      state,
      action: PayloadAction<{
        projectId: string;
        state: StoryboardGenerationState;
      }>,
    ) => {
      const { projectId, state: generationState } = action.payload;
      state.generationStates[projectId] = {
        ...generationState,
        shotStates: new Map(Object.entries(generationState.shotStates as any)),
      };
    },
    
    /**
     * 생성 상태 업데이트
     */
    updateGenerationState: (
      state,
      action: PayloadAction<{
        projectId: string;
        updates: Partial<StoryboardGenerationState>;
      }>,
    ) => {
      const { projectId, updates } = action.payload;
      
      if (state.generationStates[projectId]) {
        Object.assign(state.generationStates[projectId], updates);
      }
    },
    
    /**
     * 개별 샷 상태 업데이트
     */
    updateShotState: (
      state,
      action: PayloadAction<{
        projectId: string;
        shotId: string;
        updates: Partial<ShotGenerationState>;
      }>,
    ) => {
      const { projectId, shotId, updates } = action.payload;
      const generationState = state.generationStates[projectId];
      
      if (generationState && generationState.shotStates) {
        const shotStatesObj = Object.fromEntries(generationState.shotStates as any);
        
        if (shotStatesObj[shotId]) {
          Object.assign(shotStatesObj[shotId], updates);
          generationState.shotStates = new Map(Object.entries(shotStatesObj));
        }
      }
    },
    
    /**
     * 생성 결과 추가
     */
    addGeneratedResult: (
      state,
      action: PayloadAction<{
        projectId: string;
        result: StoryboardResult;
      }>,
    ) => {
      const { projectId, result } = action.payload;
      
      if (!state.generatedResults[projectId]) {
        state.generatedResults[projectId] = [];
      }
      
      state.generatedResults[projectId].push(result);
      
      // 통계 업데이트
      state.statistics.totalGenerated++;
      
      // 평균 생성 시간 업데이트
      const allResults = Object.values(state.generatedResults).flat();
      const totalTime = allResults.reduce(
        (sum, r) => sum + (r.metadata.generationTimeMs || 0),
        0,
      );
      state.statistics.averageGenerationTime = totalTime / allResults.length;
    },
    
    /**
     * 배치 결과 추가
     */
    addBatchResults: (
      state,
      action: PayloadAction<{
        projectId: string;
        results: StoryboardResult[];
      }>,
    ) => {
      const { projectId, results } = action.payload;
      
      if (!state.generatedResults[projectId]) {
        state.generatedResults[projectId] = [];
      }
      
      state.generatedResults[projectId].push(...results);
      state.statistics.totalGenerated += results.length;
    },
    
    /**
     * 생성 상태 제거
     */
    removeGenerationState: (state, action: PayloadAction<string>) => {
      const projectId = action.payload;
      delete state.generationStates[projectId];
    },
    
    /**
     * UI 상태 업데이트
     */
    updateUIState: (
      state,
      action: PayloadAction<Partial<StoryboardSliceState['ui']>>,
    ) => {
      Object.assign(state.ui, action.payload);
    },
    
    /**
     * 샷 선택
     */
    selectShot: (state, action: PayloadAction<string | null>) => {
      state.ui.selectedShotId = action.payload;
    },
    
    /**
     * 뷰 모드 변경
     */
    setViewMode: (
      state,
      action: PayloadAction<StoryboardSliceState['ui']['viewMode']>,
    ) => {
      state.ui.viewMode = action.payload;
    },
    
    /**
     * 필터 설정
     */
    setFilter: (
      state,
      action: PayloadAction<Partial<StoryboardSliceState['ui']['filter']>>,
    ) => {
      Object.assign(state.ui.filter, action.payload);
    },
    
    /**
     * 정렬 설정
     */
    setSort: (
      state,
      action: PayloadAction<Partial<StoryboardSliceState['ui']['sort']>>,
    ) => {
      Object.assign(state.ui.sort, action.payload);
    },
    
    /**
     * 에러 추가
     */
    addError: (
      state,
      action: PayloadAction<{
        message: string;
        shotId?: string;
      }>,
    ) => {
      state.errors.push({
        id: crypto.randomUUID(),
        message: action.payload.message,
        timestamp: Date.now(),
        shotId: action.payload.shotId,
      });
      
      if (action.payload.shotId) {
        state.statistics.totalFailed++;
      }
      
      // 최대 10개의 에러만 유지
      if (state.errors.length > 10) {
        state.errors = state.errors.slice(-10);
      }
    },
    
    /**
     * 에러 제거
     */
    removeError: (state, action: PayloadAction<string>) => {
      state.errors = state.errors.filter(e => e.id !== action.payload);
    },
    
    /**
     * 모든 에러 제거
     */
    clearErrors: (state) => {
      state.errors = [];
    },
    
    /**
     * 통계 업데이트
     */
    updateStatistics: (
      state,
      action: PayloadAction<Partial<StoryboardSliceState['statistics']>>,
    ) => {
      Object.assign(state.statistics, action.payload);
    },
    
    /**
     * 프로젝트 결과 초기화
     */
    clearProjectResults: (state, action: PayloadAction<string>) => {
      const projectId = action.payload;
      delete state.generatedResults[projectId];
      delete state.generationStates[projectId];
    },
    
    /**
     * 전체 상태 초기화
     */
    resetState: () => initialState,
  },
});

// =============================================================================
// 셀렉터
// =============================================================================

export const storyboardSelectors = {
  /**
   * 현재 활성 프로젝트의 생성 상태 가져오기
   */
  selectActiveGenerationState: (state: { storyboard: StoryboardSliceState }) => {
    const { activeProjectId, generationStates } = state.storyboard;
    return activeProjectId ? generationStates[activeProjectId] : undefined;
  },
  
  /**
   * 특정 프로젝트의 생성 결과 가져오기
   */
  selectProjectResults: (projectId: string) => (state: { storyboard: StoryboardSliceState }) => {
    return state.storyboard.generatedResults[projectId] || [];
  },
  
  /**
   * 선택된 샷 정보 가져오기
   */
  selectSelectedShot: (state: { storyboard: StoryboardSliceState }) => {
    const { ui: { selectedShotId }, activeProjectId, generatedResults } = state.storyboard;
    
    if (!selectedShotId || !activeProjectId) return null;
    
    const results = generatedResults[activeProjectId] || [];
    return results.find(r => r.shotId === selectedShotId);
  },
  
  /**
   * 필터링된 결과 가져오기
   */
  selectFilteredResults: (state: { storyboard: StoryboardSliceState }) => {
    const { activeProjectId, generatedResults, generationStates, ui } = state.storyboard;
    
    if (!activeProjectId) return [];
    
    let results = generatedResults[activeProjectId] || [];
    const generationState = generationStates[activeProjectId];
    
    // 상태 필터링
    if (ui.filter.status !== 'all' && generationState) {
      const shotStatesObj = Object.fromEntries(generationState.shotStates as any);
      results = results.filter(r => {
        const shotState = shotStatesObj[r.shotId];
        return shotState && shotState.status === ui.filter.status;
      });
    }
    
    // 모델 필터링
    if (ui.filter.model !== 'all') {
      results = results.filter(r => r.metadata.model === ui.filter.model);
    }
    
    // 정렬
    results = [...results].sort((a, b) => {
      const order = ui.sort.order === 'asc' ? 1 : -1;
      
      switch (ui.sort.by) {
        case 'generatedAt':
          return order * (
            new Date(a.metadata.generatedAt).getTime() -
            new Date(b.metadata.generatedAt).getTime()
          );
        case 'status':
          // 상태별 정렬 로직
          return 0;
        default:
          // sequence 정렬 (shotId 기반)
          return order * a.shotId.localeCompare(b.shotId);
      }
    });
    
    return results;
  },
  
  /**
   * 진행률 정보 가져오기
   */
  selectProgressInfo: (state: { storyboard: StoryboardSliceState }) => {
    const generationState = storyboardSelectors.selectActiveGenerationState(state);
    
    if (!generationState) {
      return {
        progress: 0,
        completed: 0,
        total: 0,
        failed: 0,
        estimatedTime: null,
      };
    }
    
    return {
      progress: generationState.overallProgress,
      completed: generationState.completedShots,
      total: generationState.totalShots,
      failed: generationState.failedShots,
      estimatedTime: generationState.estimatedCompletionTime,
    };
  },
  
  /**
   * 최근 에러 가져오기
   */
  selectRecentErrors: (limit = 5) => (state: { storyboard: StoryboardSliceState }) => {
    return state.storyboard.errors.slice(-limit);
  },
};

// =============================================================================
// 내보내기
// =============================================================================

export const {
  setActiveProject,
  initializeGenerationState,
  updateGenerationState,
  updateShotState,
  addGeneratedResult,
  addBatchResults,
  removeGenerationState,
  updateUIState,
  selectShot,
  setViewMode,
  setFilter,
  setSort,
  addError,
  removeError,
  clearErrors,
  updateStatistics,
  clearProjectResults,
  resetState,
} = storyboardSlice.actions;

export default storyboardSlice.reducer;