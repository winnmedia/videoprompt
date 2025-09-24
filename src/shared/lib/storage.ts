/**
 * Storage Utility for Redux State Persistence
 * Redux 상태의 localStorage 지속성 관리
 * $300 사건 방지를 위한 안전한 저장소 관리
 */

import type { RootState } from '@/app/store';

// 저장할 상태 키들
const STORAGE_KEYS = {
  USER_JOURNEY: 'videoplanet_user_journey',
  USER_DATA: 'videoplanet_user_data',
  PROJECT_DATA: 'videoplanet_project_data',
  COST_STATS: 'videoplanet_cost_stats',
} as const;

// 저장소 인터페이스
interface StorageData {
  timestamp: number;
  version: string;
  data: any;
}

// 현재 버전 (데이터 구조 변경 시 업데이트)
const STORAGE_VERSION = '1.0.0';

// 안전한 JSON 직렬화/역직렬화
class SafeStorage {
  private isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('[Storage] localStorage is not available');
      return false;
    }
  }

  set(key: string, data: any): boolean {
    if (!this.isAvailable()) return false;

    try {
      const storageData: StorageData = {
        timestamp: Date.now(),
        version: STORAGE_VERSION,
        data,
      };

      localStorage.setItem(key, JSON.stringify(storageData));
      return true;
    } catch (error) {
      console.error(`[Storage] Failed to save ${key}:`, error);
      return false;
    }
  }

  get<T = any>(key: string): T | null {
    if (!this.isAvailable()) return null;

    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const storageData: StorageData = JSON.parse(item);

      // 버전 체크
      if (storageData.version !== STORAGE_VERSION) {
        console.warn(`[Storage] Version mismatch for ${key}, clearing data`);
        this.remove(key);
        return null;
      }

      // 만료 체크 (7일)
      const EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000; // 7일
      if (Date.now() - storageData.timestamp > EXPIRY_TIME) {
        console.info(`[Storage] Expired data for ${key}, clearing`);
        this.remove(key);
        return null;
      }

      return storageData.data;
    } catch (error) {
      console.error(`[Storage] Failed to load ${key}:`, error);
      this.remove(key); // 손상된 데이터 제거
      return null;
    }
  }

  remove(key: string): boolean {
    if (!this.isAvailable()) return false;

    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[Storage] Failed to remove ${key}:`, error);
      return false;
    }
  }

  clear(): boolean {
    if (!this.isAvailable()) return false;

    try {
      // VideoplaNet 관련 키만 제거
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      console.error('[Storage] Failed to clear storage:', error);
      return false;
    }
  }

  getSize(): number {
    if (!this.isAvailable()) return 0;

    try {
      let totalSize = 0;
      Object.values(STORAGE_KEYS).forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          totalSize += new Blob([item]).size;
        }
      });
      return totalSize;
    } catch (error) {
      console.error('[Storage] Failed to calculate size:', error);
      return 0;
    }
  }
}

const storage = new SafeStorage();

// UserJourney 상태 지속성
export const saveUserJourney = (journeyState: RootState['userJourney']): boolean => {
  // 민감한 데이터 제외하고 저장
  const dataToSave = {
    currentStep: journeyState.currentStep,
    completedSteps: journeyState.completedSteps,
    stepProgress: journeyState.stepProgress,
    stepData: journeyState.stepData,
    totalProgress: journeyState.totalProgress,
    sessionId: journeyState.sessionId,
    startedAt: journeyState.startedAt,
  };

  return storage.set(STORAGE_KEYS.USER_JOURNEY, dataToSave);
};

export const loadUserJourney = (): Partial<RootState['userJourney']> | null => {
  return storage.get(STORAGE_KEYS.USER_JOURNEY);
};

// 사용자 데이터 지속성 (게스트 사용자용)
export const saveUserData = (userData: RootState['user']): boolean => {
  // 현재 사용자만 저장 (배열은 저장하지 않음)
  const dataToSave = {
    currentUser: userData.currentUser,
  };

  return storage.set(STORAGE_KEYS.USER_DATA, dataToSave);
};

export const loadUserData = (): Partial<RootState['user']> | null => {
  return storage.get(STORAGE_KEYS.USER_DATA);
};

// 프로젝트 데이터 지속성
export const saveProjectData = (projectState: RootState['project']): boolean => {
  // 현재 프로젝트와 최근 5개 프로젝트만 저장
  const dataToSave = {
    currentProject: projectState.currentProject,
    projects: projectState.projects.slice(-5), // 최근 5개만
  };

  return storage.set(STORAGE_KEYS.PROJECT_DATA, dataToSave);
};

export const loadProjectData = (): Partial<RootState['project']> | null => {
  return storage.get(STORAGE_KEYS.PROJECT_DATA);
};

// 비용 통계 지속성
export const saveCostStats = (stats: any): boolean => {
  return storage.set(STORAGE_KEYS.COST_STATS, stats);
};

export const loadCostStats = (): any | null => {
  return storage.get(STORAGE_KEYS.COST_STATS);
};

// 저장소 정보 조회
export const getStorageInfo = () => {
  return {
    available: storage['isAvailable'](),
    size: storage.getSize(),
    keys: Object.values(STORAGE_KEYS),
    version: STORAGE_VERSION,
  };
};

// 저장소 클리어
export const clearStorage = (): boolean => {
  return storage.clear();
};

// 자동 저장을 위한 디바운스 함수
export const createDebouncedSave = <T>(
  saveFn: (data: T) => boolean,
  delay: number = 1000
) => {
  let timeoutId: NodeJS.Timeout;

  return (data: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      saveFn(data);
    }, delay);
  };
};

// 디바운스된 저장 함수들
export const debouncedSaveUserJourney = createDebouncedSave(saveUserJourney);
export const debouncedSaveUserData = createDebouncedSave(saveUserData);
export const debouncedSaveProjectData = createDebouncedSave(saveProjectData);

export default storage;