/**
 * User Management Hook
 *
 * 사용자 관리 기능을 담당하는 훅입니다.
 * 페이지네이션, 필터링, 검색, 액션 수행을 포함합니다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import {
  userManagementSlice,
  fetchUsers,
  fetchProjects,
  fetchVideoAssets,
  performAction,
  selectUsers,
  selectProjects,
  selectVideoAssets,
  selectSelectedUsers,
  selectUserManagementLoading,
  selectUserManagementError,
  selectPagination,
  selectFilters
} from '../store/user-management-slice';
import { AdminActionValidator } from '../../../entities/admin';
import type {
  AdminUser,
  AdminProject,
  AdminVideoAsset,
  TableFilter,
  PaginationInfo,
  AdminActionType,
  AdminAction
} from '../../../entities/admin';

/**
 * 사용자 관리 훅
 */
export function useUserManagement() {
  const dispatch = useAppDispatch();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const users = useAppSelector(selectUsers);
  const projects = useAppSelector(selectProjects);
  const videoAssets = useAppSelector(selectVideoAssets);
  const selectedUsers = useAppSelector(selectSelectedUsers);
  const loading = useAppSelector(selectUserManagementLoading);
  const error = useAppSelector(selectUserManagementError);
  const pagination = useAppSelector(selectPagination);
  const filters = useAppSelector(selectFilters);

  const currentUser = useAppSelector(state => state.auth.user);

  /**
   * 사용자 목록 조회
   */
  const fetchUsersData = useCallback(() => {
    dispatch(fetchUsers({
      page: currentPage,
      pageSize,
      filters
    }));
  }, [dispatch, currentPage, pageSize, filters]);

  /**
   * 프로젝트 목록 조회
   */
  const fetchProjectsData = useCallback(() => {
    dispatch(fetchProjects({
      page: currentPage,
      pageSize,
      filters
    }));
  }, [dispatch, currentPage, pageSize, filters]);

  /**
   * 비디오 자산 목록 조회
   */
  const fetchVideoAssetsData = useCallback(() => {
    dispatch(fetchVideoAssets({
      page: currentPage,
      pageSize,
      filters
    }));
  }, [dispatch, currentPage, pageSize, filters]);

  /**
   * 페이지 변경
   */
  const changePage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  /**
   * 페이지 크기 변경
   */
  const changePageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // 첫 페이지로 리셋
  }, []);

  /**
   * 필터 적용
   */
  const applyFilters = useCallback((newFilters: Partial<TableFilter>) => {
    dispatch(userManagementSlice.actions.setFilters({ ...filters, ...newFilters }));
    setCurrentPage(1); // 첫 페이지로 리셋
  }, [dispatch, filters]);

  /**
   * 필터 초기화
   */
  const clearFilters = useCallback(() => {
    dispatch(userManagementSlice.actions.clearFilters());
    setCurrentPage(1);
  }, [dispatch]);

  /**
   * 사용자 선택/해제
   */
  const selectUser = useCallback((userId: string) => {
    dispatch(userManagementSlice.actions.selectUser(userId));
  }, [dispatch]);

  const selectAllUsers = useCallback(() => {
    const userIds = users.map(user => user.id);
    dispatch(userManagementSlice.actions.selectMultipleUsers(userIds));
  }, [dispatch, users]);

  const clearSelection = useCallback(() => {
    dispatch(userManagementSlice.actions.clearSelection());
  }, [dispatch]);

  /**
   * 관리자 액션 수행
   */
  const executeAdminAction = useCallback(async (action: {
    type: AdminActionType;
    targetType: string;
    targetId: string;
    reason?: string;
  }) => {
    if (!currentUser) {
      throw new Error('로그인이 필요합니다');
    }

    // 권한 검증
    const canPerform = AdminActionValidator.canPerformAction(
      action.type,
      currentUser.role,
      action.targetType as any
    );

    if (!canPerform) {
      throw new Error('해당 액션을 수행할 권한이 없습니다');
    }

    // 위험도 확인
    const risk = AdminActionValidator.assessActionRisk(action.type);
    if (risk === 'high') {
      const confirmed = window.confirm(
        `위험한 액션입니다: ${AdminActionValidator.generateActionDescription({
          type: action.type,
          targetType: action.targetType,
          targetId: action.targetId
        } as any)}\n\n정말 수행하시겠습니까?`
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      const adminAction: AdminAction = {
        type: action.type,
        targetId: action.targetId,
        targetType: action.targetType as any,
        reason: action.reason,
        performedBy: {
          id: currentUser.id,
          email: currentUser.email
        },
        timestamp: new Date(),
        metadata: {}
      };

      await dispatch(performAction(adminAction)).unwrap();

      // 액션 수행 후 목록 새로고침
      fetchUsersData();
      fetchProjectsData();
      fetchVideoAssetsData();
    } catch (error) {
      console.error('관리자 액션 수행 실패:', error);
      throw error;
    }
  }, [currentUser, dispatch, fetchUsersData, fetchProjectsData, fetchVideoAssetsData]);

  /**
   * 사용자 정지
   */
  const suspendUser = useCallback((userId: string, reason?: string) => {
    return executeAdminAction({
      type: 'user_suspend',
      targetType: 'user',
      targetId: userId,
      reason
    });
  }, [executeAdminAction]);

  /**
   * 필터링된 사용자 통계
   */
  const statistics = useMemo(() => {
    if (!users.length) {
      return {
        total: 0,
        active: 0,
        suspended: 0,
        admins: 0
      };
    }

    return {
      total: users.length,
      active: users.filter(u => u.accountStatus === 'active').length,
      suspended: users.filter(u => u.accountStatus === 'suspended').length,
      admins: users.filter(u => u.role === 'admin').length
    };
  }, [users]);

  /**
   * 초기 데이터 로드
   */
  useEffect(() => {
    fetchUsersData();
    fetchProjectsData();
    fetchVideoAssetsData();
  }, [fetchUsersData, fetchProjectsData, fetchVideoAssetsData]);

  return {
    // 데이터
    users,
    projects,
    videoAssets,
    loading,
    error,
    pagination,
    selectedUsers,
    statistics,

    // 페이지네이션
    currentPage,
    pageSize,
    changePage,
    changePageSize,

    // 필터링
    filters,
    applyFilters,
    clearFilters,

    // 선택
    selectUser,
    selectAllUsers,
    clearSelection,

    // 액션
    executeAdminAction,
    suspendUser,

    // 새로고침
    refresh: fetchUsersData
  };
}