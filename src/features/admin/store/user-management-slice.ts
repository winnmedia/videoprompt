/**
 * User Management Slice
 *
 * 사용자 관리 상태를 담당하는 Redux slice입니다.
 * admin 페이지에서 필요한 projects, videoAssets, executeAdminAction을 포함합니다.
 * RTK 2.0과 async thunk를 사용합니다.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type {
  AdminUser,
  AdminProject,
  AdminVideoAsset,
  AdminAction,
  AdminActionType,
  PaginationInfo,
  TableFilter
} from '../../../entities/admin';

/**
 * 사용자 관리 상태 인터페이스
 */
interface UserManagementState {
  /** 사용자 목록 */
  users: AdminUser[];
  /** 프로젝트 목록 */
  projects: AdminProject[];
  /** 비디오 자산 목록 */
  videoAssets: AdminVideoAsset[];
  /** 선택된 사용자 ID들 */
  selectedUsers: string[];
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 페이지네이션 정보 */
  pagination: PaginationInfo;
  /** 필터 설정 */
  filters: TableFilter;
  /** 마지막 업데이트 시간 */
  lastUpdated: Date | null;
}

/**
 * 초기 상태
 */
const initialState: UserManagementState = {
  users: [],
  projects: [],
  videoAssets: [],
  selectedUsers: [],
  loading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  },
  filters: {},
  lastUpdated: null
};

/**
 * 사용자 목록 조회 Async Thunk
 */
export const fetchUsers = createAsyncThunk(
  'userManagement/fetchUsers',
  async (params: { page: number; pageSize: number; filters: TableFilter }, { rejectWithValue }) => {
    try {
      const { page, pageSize, filters } = params;
      const queryParams = new URLSearchParams();

      queryParams.append('page', page.toString());
      queryParams.append('pageSize', pageSize.toString());

      if (filters.search) queryParams.append('search', filters.search);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.role) queryParams.append('role', filters.role);

      const response = await fetch(`/api/admin/users?${queryParams}`);

      if (!response.ok) {
        throw new Error(`사용자 조회 실패: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : '사용자 조회 중 오류가 발생했습니다'
      );
    }
  }
);

/**
 * 프로젝트 목록 조회 Async Thunk
 */
export const fetchProjects = createAsyncThunk(
  'userManagement/fetchProjects',
  async (params: { page: number; pageSize: number; filters: TableFilter }, { rejectWithValue }) => {
    try {
      const { page, pageSize, filters } = params;
      const queryParams = new URLSearchParams();

      queryParams.append('page', page.toString());
      queryParams.append('pageSize', pageSize.toString());

      if (filters.search) queryParams.append('search', filters.search);
      if (filters.status) queryParams.append('status', filters.status);

      const response = await fetch(`/api/admin/projects?${queryParams}`);

      if (!response.ok) {
        throw new Error(`프로젝트 조회 실패: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : '프로젝트 조회 중 오류가 발생했습니다'
      );
    }
  }
);

/**
 * 비디오 자산 목록 조회 Async Thunk
 */
export const fetchVideoAssets = createAsyncThunk(
  'userManagement/fetchVideoAssets',
  async (params: { page: number; pageSize: number; filters: TableFilter }, { rejectWithValue }) => {
    try {
      const { page, pageSize, filters } = params;
      const queryParams = new URLSearchParams();

      queryParams.append('page', page.toString());
      queryParams.append('pageSize', pageSize.toString());

      if (filters.search) queryParams.append('search', filters.search);
      if (filters.status) queryParams.append('status', filters.status);

      const response = await fetch(`/api/admin/video-assets?${queryParams}`);

      if (!response.ok) {
        throw new Error(`비디오 자산 조회 실패: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : '비디오 자산 조회 중 오류가 발생했습니다'
      );
    }
  }
);

/**
 * 관리자 액션 수행 Async Thunk
 */
export const performAction = createAsyncThunk(
  'userManagement/performAction',
  async (action: AdminAction, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(action)
      });

      if (!response.ok) {
        throw new Error(`관리자 액션 실패: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : '관리자 액션 수행 중 오류가 발생했습니다'
      );
    }
  }
);

/**
 * User Management Slice
 */
export const userManagementSlice = createSlice({
  name: 'userManagement',
  initialState,
  reducers: {
    /**
     * 사용자 선택/해제
     */
    selectUser: (state, action: PayloadAction<string>) => {
      const userId = action.payload;
      const index = state.selectedUsers.indexOf(userId);

      if (index > -1) {
        state.selectedUsers.splice(index, 1);
      } else {
        state.selectedUsers.push(userId);
      }
    },

    /**
     * 여러 사용자 선택
     */
    selectMultipleUsers: (state, action: PayloadAction<string[]>) => {
      const userIds = action.payload;
      userIds.forEach(userId => {
        if (!state.selectedUsers.includes(userId)) {
          state.selectedUsers.push(userId);
        }
      });
    },

    /**
     * 선택 초기화
     */
    clearSelection: (state) => {
      state.selectedUsers = [];
    },

    /**
     * 필터 설정
     */
    setFilters: (state, action: PayloadAction<TableFilter>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1; // 필터 변경 시 첫 페이지로
    },

    /**
     * 필터 초기화
     */
    clearFilters: (state) => {
      state.filters = {};
      state.pagination.page = 1;
    },

    /**
     * 페이지네이션 설정
     */
    setPagination: (state, action: PayloadAction<Partial<PaginationInfo>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },

    /**
     * 에러 초기화
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * 사용자 상태 업데이트 (낙관적 업데이트)
     */
    updateUserStatus: (state, action: PayloadAction<{ userId: string; status: string }>) => {
      const { userId, status } = action.payload;
      const user = state.users.find(u => u.id === userId);
      if (user) {
        user.accountStatus = status as any;
      }
    },

    /**
     * 프로젝트 상태 업데이트 (낙관적 업데이트)
     */
    updateProjectStatus: (state, action: PayloadAction<{ projectId: string; status: string }>) => {
      const { projectId, status } = action.payload;
      const project = state.projects.find(p => p.id === projectId);
      if (project) {
        project.status = status as any;
      }
    }
  },
  extraReducers: (builder) => {
    // fetchUsers
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.users || [];
        state.pagination = action.payload.pagination || state.pagination;
        state.lastUpdated = new Date();
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // fetchProjects
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload.projects || [];
        state.lastUpdated = new Date();
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // fetchVideoAssets
    builder
      .addCase(fetchVideoAssets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVideoAssets.fulfilled, (state, action) => {
        state.loading = false;
        state.videoAssets = action.payload.videoAssets || [];
        state.lastUpdated = new Date();
      })
      .addCase(fetchVideoAssets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // performAction
    builder
      .addCase(performAction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(performAction.fulfilled, (state, action) => {
        state.loading = false;
        // 액션 수행 후 필요에 따라 상태 업데이트
        state.lastUpdated = new Date();
      })
      .addCase(performAction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

/**
 * 선택자 (Selectors)
 */
export const selectUsers = (state: { userManagement: UserManagementState }) =>
  state.userManagement.users;

export const selectProjects = (state: { userManagement: UserManagementState }) =>
  state.userManagement.projects;

export const selectVideoAssets = (state: { userManagement: UserManagementState }) =>
  state.userManagement.videoAssets;

export const selectSelectedUsers = (state: { userManagement: UserManagementState }) =>
  state.userManagement.selectedUsers;

export const selectUserManagementLoading = (state: { userManagement: UserManagementState }) =>
  state.userManagement.loading;

export const selectUserManagementError = (state: { userManagement: UserManagementState }) =>
  state.userManagement.error;

export const selectPagination = (state: { userManagement: UserManagementState }) =>
  state.userManagement.pagination;

export const selectFilters = (state: { userManagement: UserManagementState }) =>
  state.userManagement.filters;

// 액션 export
export const {
  selectUser,
  selectMultipleUsers,
  clearSelection,
  setFilters,
  clearFilters,
  setPagination,
  clearError,
  updateUserStatus,
  updateProjectStatus
} = userManagementSlice.actions;

export default userManagementSlice.reducer;