/**
 * Redux Toolkit 2.0 기반 전역 UI 상태 슬라이스
 * FSD shared 레이어 - 앱 전반의 UI 상태 관리
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // ms, 0이면 수동 닫기
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface LoadingState {
  isLoading: boolean;
  message: string;
  progress?: number; // 0-100
  cancellable?: boolean;
  onCancel?: () => void;
}

export interface ModalState {
  isOpen: boolean;
  modalId: string | null;
  modalProps: Record<string, unknown>;
}

export interface NavigationState {
  currentPage: string;
  previousPage: string | null;
  breadcrumbs: Array<{ label: string; href: string }>;
  isNavigating: boolean;
}

export interface ErrorState {
  hasError: boolean;
  errorId: string | null;
  errorType: 'network' | 'server' | 'client' | 'validation' | 'auth';
  errorMessage: string;
  errorDetails?: string;
  canRetry: boolean;
  retryCount: number;
  maxRetries: number;
  retryAction?: () => void;
}

export interface UIState {
  // 토스트 알림
  toasts: ToastMessage[];

  // 전역 로딩
  loading: LoadingState;

  // 모달 관리
  modal: ModalState;

  // 네비게이션
  navigation: NavigationState;

  // 에러 처리
  error: ErrorState;

  // 레이아웃 상태
  sidebar: {
    isOpen: boolean;
    isCollapsed: boolean;
    width: number;
  };

  // 테마 및 설정
  theme: 'light' | 'dark' | 'system';
  language: 'ko' | 'en';

  // 접근성 설정
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    fontSize: 'small' | 'medium' | 'large';
  };

  // 개발 모드 설정
  debug: {
    isEnabled: boolean;
    showPerformance: boolean;
    showStateUpdates: boolean;
  };
}

const initialLoadingState: LoadingState = {
  isLoading: false,
  message: '',
  progress: undefined,
  cancellable: false,
  onCancel: undefined
};

const initialModalState: ModalState = {
  isOpen: false,
  modalId: null,
  modalProps: {}
};

const initialNavigationState: NavigationState = {
  currentPage: '/',
  previousPage: null,
  breadcrumbs: [],
  isNavigating: false
};

const initialErrorState: ErrorState = {
  hasError: false,
  errorId: null,
  errorType: 'client',
  errorMessage: '',
  errorDetails: undefined,
  canRetry: false,
  retryCount: 0,
  maxRetries: 3,
  retryAction: undefined
};

const initialState: UIState = {
  toasts: [],
  loading: initialLoadingState,
  modal: initialModalState,
  navigation: initialNavigationState,
  error: initialErrorState,
  sidebar: {
    isOpen: false,
    isCollapsed: false,
    width: 280
  },
  theme: 'system',
  language: 'ko',
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    fontSize: 'medium'
  },
  debug: {
    isEnabled: false,
    showPerformance: false,
    showStateUpdates: false
  }
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // 토스트 관리
    addToast: (state, action: PayloadAction<Omit<ToastMessage, 'id'>>) => {
      const toast: ToastMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        duration: 5000, // 기본 5초
        ...action.payload
      };
      state.toasts.push(toast);
    },

    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(toast => toast.id !== action.payload);
    },

    clearAllToasts: (state) => {
      state.toasts = [];
    },

    // 전역 로딩 상태
    setLoading: (state, action: PayloadAction<Partial<LoadingState>>) => {
      state.loading = { ...state.loading, ...action.payload };
    },

    clearLoading: (state) => {
      state.loading = initialLoadingState;
    },

    // 모달 관리
    openModal: (state, action: PayloadAction<{ modalId: string; modalProps?: Record<string, unknown> }>) => {
      const { modalId, modalProps = {} } = action.payload;
      state.modal = {
        isOpen: true,
        modalId,
        modalProps
      };
    },

    closeModal: (state) => {
      state.modal = initialModalState;
    },

    updateModalProps: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.modal.modalProps = { ...state.modal.modalProps, ...action.payload };
    },

    // 네비게이션 상태
    setCurrentPage: (state, action: PayloadAction<string>) => {
      state.navigation.previousPage = state.navigation.currentPage;
      state.navigation.currentPage = action.payload;
      state.navigation.isNavigating = false;
    },

    setNavigating: (state, action: PayloadAction<boolean>) => {
      state.navigation.isNavigating = action.payload;
    },

    setBreadcrumbs: (state, action: PayloadAction<Array<{ label: string; href: string }>>) => {
      state.navigation.breadcrumbs = action.payload;
    },

    // 에러 처리
    setError: (state, action: PayloadAction<{
      errorType: ErrorState['errorType'];
      errorMessage: string;
      errorDetails?: string;
      canRetry?: boolean;
      retryAction?: () => void;
    }>) => {
      const { errorType, errorMessage, errorDetails, canRetry = false, retryAction } = action.payload;

      state.error = {
        hasError: true,
        errorId: Date.now().toString(),
        errorType,
        errorMessage,
        errorDetails,
        canRetry,
        retryCount: 0,
        maxRetries: 3,
        retryAction
      };
    },

    clearError: (state) => {
      state.error = initialErrorState;
    },

    incrementRetryCount: (state) => {
      state.error.retryCount += 1;
      if (state.error.retryCount >= state.error.maxRetries) {
        state.error.canRetry = false;
      }
    },

    // 사이드바 관리
    toggleSidebar: (state) => {
      state.sidebar.isOpen = !state.sidebar.isOpen;
    },

    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebar.isOpen = action.payload;
    },

    toggleSidebarCollapse: (state) => {
      state.sidebar.isCollapsed = !state.sidebar.isCollapsed;
    },

    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebar.width = Math.max(200, Math.min(400, action.payload));
    },

    // 테마 및 설정
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },

    setLanguage: (state, action: PayloadAction<'ko' | 'en'>) => {
      state.language = action.payload;
    },

    // 접근성 설정
    setAccessibility: (state, action: PayloadAction<Partial<UIState['accessibility']>>) => {
      state.accessibility = { ...state.accessibility, ...action.payload };
    },

    toggleReducedMotion: (state) => {
      state.accessibility.reducedMotion = !state.accessibility.reducedMotion;
    },

    toggleHighContrast: (state) => {
      state.accessibility.highContrast = !state.accessibility.highContrast;
    },

    // 디버그 설정
    setDebug: (state, action: PayloadAction<Partial<UIState['debug']>>) => {
      state.debug = { ...state.debug, ...action.payload };
    },

    toggleDebug: (state) => {
      state.debug.isEnabled = !state.debug.isEnabled;
    },

    // 전역 상태 초기화
    resetUI: () => initialState
  },

  // RTK 2.0 선택자
  selectors: {
    selectToasts: (state) => state.toasts,
    selectLatestToast: (state) => state.toasts[state.toasts.length - 1] || null,
    selectToastCount: (state) => state.toasts.length,

    selectLoading: (state) => state.loading,
    selectIsLoading: (state) => state.loading.isLoading,
    selectLoadingMessage: (state) => state.loading.message,
    selectLoadingProgress: (state) => state.loading.progress,

    selectModal: (state) => state.modal,
    selectIsModalOpen: (state) => state.modal.isOpen,
    selectCurrentModal: (state) => state.modal.modalId,
    selectModalProps: (state) => state.modal.modalProps,

    selectNavigation: (state) => state.navigation,
    selectCurrentPage: (state) => state.navigation.currentPage,
    selectPreviousPage: (state) => state.navigation.previousPage,
    selectBreadcrumbs: (state) => state.navigation.breadcrumbs,
    selectIsNavigating: (state) => state.navigation.isNavigating,

    selectError: (state) => state.error,
    selectHasError: (state) => state.error.hasError,
    selectErrorMessage: (state) => state.error.errorMessage,
    selectCanRetry: (state) => state.error.canRetry,
    selectRetryCount: (state) => state.error.retryCount,

    selectSidebar: (state) => state.sidebar,
    selectIsSidebarOpen: (state) => state.sidebar.isOpen,
    selectIsSidebarCollapsed: (state) => state.sidebar.isCollapsed,
    selectSidebarWidth: (state) => state.sidebar.width,

    selectTheme: (state) => state.theme,
    selectLanguage: (state) => state.language,
    selectAccessibility: (state) => state.accessibility,
    selectDebug: (state) => state.debug,
    selectIsDebugEnabled: (state) => state.debug.isEnabled,

    // 복합 선택자
    selectUIState: (state) => ({
      hasActiveToasts: state.toasts.length > 0,
      isLoading: state.loading.isLoading,
      hasModal: state.modal.isOpen,
      hasError: state.error.hasError,
      isNavigating: state.navigation.isNavigating
    }),

    selectThemeConfig: (state) => ({
      theme: state.theme,
      reducedMotion: state.accessibility.reducedMotion,
      highContrast: state.accessibility.highContrast,
      fontSize: state.accessibility.fontSize
    })
  }
});

// 액션과 선택자 export
export const {
  addToast,
  removeToast,
  clearAllToasts,
  setLoading,
  clearLoading,
  openModal,
  closeModal,
  updateModalProps,
  setCurrentPage,
  setNavigating,
  setBreadcrumbs,
  setError,
  clearError,
  incrementRetryCount,
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapse,
  setSidebarWidth,
  setTheme,
  setLanguage,
  setAccessibility,
  toggleReducedMotion,
  toggleHighContrast,
  setDebug,
  toggleDebug,
  resetUI
} = uiSlice.actions;

export const {
  selectToasts,
  selectLatestToast,
  selectToastCount,
  selectLoading,
  selectIsLoading,
  selectLoadingMessage,
  selectLoadingProgress,
  selectModal,
  selectIsModalOpen,
  selectCurrentModal,
  selectModalProps,
  selectNavigation,
  selectCurrentPage,
  selectPreviousPage,
  selectBreadcrumbs,
  selectIsNavigating,
  selectError,
  selectHasError,
  selectErrorMessage,
  selectCanRetry,
  selectRetryCount,
  selectSidebar,
  selectIsSidebarOpen,
  selectIsSidebarCollapsed,
  selectSidebarWidth,
  selectTheme,
  selectLanguage,
  selectAccessibility,
  selectDebug,
  selectIsDebugEnabled,
  selectUIState,
  selectThemeConfig
} = uiSlice.selectors;

export default uiSlice.reducer;