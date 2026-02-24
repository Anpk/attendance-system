'use client';

import { useMemo, useRef, useState } from 'react';
import { toUserMessage } from '@/lib/api/error-messages';
import type {
  AdminEmployeeResponse,
  AdminEmployeeCreateRequest,
  AdminSiteResponse,
  EmployeeRole,
} from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import {
  adminCreateEmployee,
  adminListEmployees,
  adminUpdateEmployee,
} from '@/lib/api/admin';
import { useManagerAssignmentsOps } from './useManagerAssignmentsOps';

type UserLite = { userId: number; role: 'ADMIN' | 'MANAGER' | string } | null;

type Params = {
  user: UserLite;
  sites: AdminSiteResponse[];
  setLoading: (v: boolean) => void;
  setFlashMessage: (msg: string) => void;
};

export function useEmployeesOps({
  user,
  sites,
  setLoading,
  setFlashMessage,
}: Params) {
  const [employees, setEmployees] = useState<AdminEmployeeResponse[]>([]);
  const [empFilterSiteId, setEmpFilterSiteId] = useState<string>('');
  const [pendingActiveUserId, setPendingActiveUserId] = useState<number | null>(
    null
  );

  const [bulkSelectedUserIds, setBulkSelectedUserIds] = useState<number[]>([]);
  const [bulkTargetSiteId, setBulkTargetSiteId] = useState<string>('');
  const [bulkMoving, setBulkMoving] = useState<boolean>(false);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editEmpActive, setEditEmpActive] = useState<boolean>(true);
  const [editEmpSiteId, setEditEmpSiteId] = useState<string>('1');
  const [editingEmpRole, setEditingEmpRole] =
    useState<EmployeeRole>('EMPLOYEE');
  const [editEmpUsername, setEditEmpUsername] = useState<string>('');

  const [createEmpUserId, setCreateEmpUserId] = useState<string>('');
  const [createEmpUsername, setCreateEmpUsername] = useState<string>('');
  const [createEmpPassword, setCreateEmpPassword] = useState<string>('');
  const [createEmpSiteId, setCreateEmpSiteId] = useState<string>('1');
  const [createEmpRole, setCreateEmpRole] = useState<EmployeeRole>('EMPLOYEE');
  const createEmpUserIdRef = useRef<HTMLInputElement | null>(null);

  const canCreateEmployee = user?.role === 'ADMIN';
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] =
    useState<boolean>(false);

  const canEditEmployeeSiteId =
    user?.role === 'ADMIN' ||
    (user?.role === 'MANAGER' && editingEmpRole === 'EMPLOYEE');

  const showAssignmentsUi =
    user?.role === 'ADMIN' &&
    editingUserId != null &&
    editingEmpRole === 'MANAGER';

  const assignments = useManagerAssignmentsOps({
    user,
    sites,
    setLoading,
    setFlashMessage,
  });

  const filteredEmployees = useMemo(() => {
    if (!empFilterSiteId) return employees;
    const sid = Number(empFilterSiteId);
    if (!Number.isFinite(sid)) return employees;
    return employees.filter((e) => e.siteId === sid);
  }, [employees, empFilterSiteId]);

  const bulkSelectableInView = useMemo(() => {
    const selfId = user?.userId;
    return filteredEmployees.filter(
      (e) => e.role === 'EMPLOYEE' && (selfId == null || e.userId !== selfId)
    );
  }, [filteredEmployees, user]);

  const bulkSelectedEmployees = useMemo(() => {
    const selected = new Set(bulkSelectedUserIds);
    return employees.filter((e) => selected.has(e.userId));
  }, [employees, bulkSelectedUserIds]);

  async function refreshEmployees() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await adminListEmployees();
      setEmployees(data);
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function startEditEmployee(x: AdminEmployeeResponse) {
    setEditingUserId(x.userId);
    setEditEmpActive(x.active);
    setEditEmpSiteId(String(x.siteId));
    setEditingEmpRole(x.role);

    setEditEmpUsername((x as unknown as { username?: string }).username ?? '');

    if (user?.role === 'ADMIN') {
      assignments.resetAssignmentsUi();
    }
  }

  function cancelEditEmployee() {
    setEditingUserId(null);
    setEditEmpUsername('');
    assignments.resetAssignmentsUi();
  }

  async function submitToggleActiveQuick(
    targetUserId: number,
    nextActive: boolean
  ) {
    if (!user) return;

    setPendingActiveUserId(targetUserId);
    try {
      const updated = await adminUpdateEmployee(targetUserId, {
        active: nextActive,
        siteId: null,
        username: null,
      });

      setEmployees((prev) =>
        prev.map((it) => (it.userId === targetUserId ? updated : it))
      );

      if (editingUserId === targetUserId) {
        setEditEmpActive(updated.active);
      }

      setFlashMessage(
        nextActive ? '직원이 활성화되었습니다.' : '직원이 비활성화되었습니다.'
      );
    } catch (e) {
      if (e instanceof ApiError) {
        if (
          e.code === 'INVALID_REQUEST_PARAM' ||
          e.code === 'INVALID_REQUEST_PAYLOAD'
        ) {
          setFlashMessage(e.message);
          return;
        }
      }
      setFlashMessage(toUserMessage(e));
    } finally {
      setPendingActiveUserId(null);
    }
  }

  async function submitBulkMoveEmployees() {
    if (!user) return;

    if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
      setFlashMessage('권한이 없습니다.');
      return;
    }

    if (bulkSelectedUserIds.length === 0) {
      setFlashMessage('이동할 직원을 선택해 주세요.');
      return;
    }

    const target = Number(bulkTargetSiteId);
    if (!Number.isFinite(target)) {
      setFlashMessage('이동할 site를 선택해 주세요.');
      return;
    }

    if (sites.length === 0) {
      setFlashMessage(
        'site 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'
      );
      return;
    }

    const targetSite = sites.find((s) => s.siteId === target);
    if (!targetSite) {
      setFlashMessage('선택할 수 없는 site입니다.');
      return;
    }
    if (!targetSite.active) {
      setFlashMessage('비활성 site로는 이동할 수 없습니다.');
      return;
    }

    if (user.role === 'MANAGER') {
      const manageable = new Set(sites.map((s) => s.siteId));
      const invalid = bulkSelectedUserIds.filter((uid) => {
        const emp = employees.find((e) => e.userId === uid);
        if (!emp) return true;
        return !manageable.has(emp.siteId);
      });
      if (invalid.length > 0) {
        setFlashMessage('관리 범위 밖 직원이 포함되어 이동할 수 없습니다.');
        return;
      }
    }

    setBulkMoving(true);
    try {
      let okCount = 0;
      const failed: Array<{ userId: number; reason: string }> = [];

      for (const uid of bulkSelectedUserIds) {
        try {
          const updated = await adminUpdateEmployee(uid, {
            siteId: target,
            active: null,
            username: null,
          });
          okCount += 1;
          setEmployees((prev) =>
            prev.map((it) => (it.userId === uid ? updated : it))
          );
        } catch (e) {
          failed.push({
            userId: uid,
            reason: e instanceof ApiError ? e.message : toUserMessage(e),
          });
        }
      }

      if (failed.length === 0) {
        setFlashMessage(`직원 ${okCount}명을 site #${target}로 이동했습니다.`);
      } else {
        const ids = failed
          .slice(0, 5)
          .map((x) => x.userId)
          .join(', ');
        const more = failed.length > 5 ? ` 외 ${failed.length - 5}명` : '';
        setFlashMessage(
          `이동 완료: ${okCount}명, 실패: ${failed.length}명 (#${ids}${more}).`
        );
        console.error('bulk move failed', failed);
      }

      setBulkSelectedUserIds([]);
    } finally {
      setBulkMoving(false);
    }
  }

  async function submitUpdateEmployee(targetUserId: number) {
    if (!user) return;

    if (canEditEmployeeSiteId) {
      const selected = Number(editEmpSiteId);
      if (!Number.isFinite(selected)) {
        setFlashMessage('siteId를 확인해 주세요.');
        return;
      }
      if (sites.length === 0) {
        setFlashMessage(
          'site 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'
        );
        return;
      }
      const selectedSite = sites.find((s) => s.siteId === selected);
      if (!selectedSite) {
        setFlashMessage('선택할 수 없는 site입니다.');
        return;
      }
      if (!selectedSite.active) {
        setFlashMessage('비활성 site로는 변경할 수 없습니다.');
        return;
      }
    }

    setLoading(true);
    try {
      const siteIdNum = Number(editEmpSiteId);
      const trimmedUsername = editEmpUsername.trim();
      const body = {
        active: editEmpActive,
        siteId: canEditEmployeeSiteId
          ? Number.isFinite(siteIdNum)
            ? siteIdNum
            : null
          : null,
        username: trimmedUsername.length > 0 ? trimmedUsername : null,
      };
      const updated = await adminUpdateEmployee(targetUserId, body);
      setEmployees((prev) =>
        prev.map((it) => (it.userId === targetUserId ? updated : it))
      );
      setFlashMessage('직원 정보가 수정되었습니다.');
      cancelEditEmployee();
    } catch (e) {
      if (e instanceof ApiError) {
        if (
          e.code === 'INVALID_REQUEST_PARAM' ||
          e.code === 'INVALID_REQUEST_PAYLOAD'
        ) {
          setFlashMessage(e.message);
          return;
        }
      }
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitCreateEmployee() {
    if (!user) return;

    const userIdNum = Number(createEmpUserId);
    const siteIdNum = Number(createEmpSiteId);

    if (!Number.isFinite(userIdNum)) {
      setIsCreateEmployeeOpen(true);
      setFlashMessage('userId를 확인해 주세요.');
      return;
    }
    if (!createEmpUsername.trim()) {
      setIsCreateEmployeeOpen(true);
      setFlashMessage('username은 필수입니다.');
      return;
    }
    if (!createEmpPassword.trim()) {
      setIsCreateEmployeeOpen(true);
      setFlashMessage('password는 필수입니다.');
      return;
    }
    if (!Number.isFinite(siteIdNum)) {
      setIsCreateEmployeeOpen(true);
      setFlashMessage('siteId를 확인해 주세요.');
      return;
    }

    if (sites.length === 0) {
      setFlashMessage(
        'site 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'
      );
      return;
    }
    const selectedSite = sites.find((s) => s.siteId === siteIdNum);
    if (!selectedSite) {
      setFlashMessage('선택할 수 없는 site입니다.');
      return;
    }
    if (!selectedSite.active) {
      setFlashMessage('비활성 site에는 직원을 생성할 수 없습니다.');
      return;
    }

    setLoading(true);
    try {
      const body: AdminEmployeeCreateRequest = {
        userId: userIdNum,
        username: createEmpUsername.trim(),
        password: createEmpPassword.trim(),
        role: createEmpRole,
        siteId: siteIdNum,
      };
      await adminCreateEmployee(body);
      setCreateEmpUserId('');
      setCreateEmpUsername('');
      setCreateEmpPassword('');
      setCreateEmpRole('EMPLOYEE');
      await refreshEmployees();
      setFlashMessage('직원이 생성되었습니다.');
      setIsCreateEmployeeOpen(true);
      setBulkSelectedUserIds([]);

      requestAnimationFrame(() => {
        createEmpUserIdRef.current?.focus();
      });
    } catch (e) {
      if (e instanceof ApiError) {
        if (
          e.code === 'INVALID_REQUEST_PARAM' ||
          e.code === 'INVALID_REQUEST_PAYLOAD'
        ) {
          setFlashMessage(e.message);
          return;
        }
      }
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return {
    // list
    employees,
    filteredEmployees,
    empFilterSiteId,
    setEmpFilterSiteId,

    refreshEmployees,

    // quick toggle
    pendingActiveUserId,
    submitToggleActiveQuick,

    // bulk move
    bulkSelectedUserIds,
    setBulkSelectedUserIds,
    bulkTargetSiteId,
    setBulkTargetSiteId,
    bulkSelectableInView,
    bulkSelectedEmployees,
    bulkMoving,
    submitBulkMoveEmployees,

    // edit
    editingUserId,
    startEditEmployee,
    cancelEditEmployee,
    submitUpdateEmployee,
    editEmpActive,
    setEditEmpActive,
    editingEmpRole,
    editEmpUsername,
    setEditEmpUsername,
    editEmpSiteId,
    setEditEmpSiteId,
    canEditEmployeeSiteId,

    // create
    canCreateEmployee,
    isCreateEmployeeOpen,
    setIsCreateEmployeeOpen,
    createEmpUserId,
    setCreateEmpUserId,
    createEmpUsername,
    setCreateEmpUsername,
    createEmpPassword,
    setCreateEmpPassword,
    createEmpSiteId,
    setCreateEmpSiteId,
    createEmpRole,
    setCreateEmpRole,
    createEmpUserIdRef,
    submitCreateEmployee,

    // assignments
    showAssignmentsUi,
    mgrAssignedSiteIds: assignments.mgrAssignedSiteIds,
    isAssignmentsOpen: assignments.isAssignmentsOpen,
    setIsAssignmentsOpen: assignments.setIsAssignmentsOpen,
    mgrSelectedSiteIds: assignments.mgrSelectedSiteIds,
    setMgrSelectedSiteIds: assignments.setMgrSelectedSiteIds,
    mgrSiteQuery: assignments.mgrSiteQuery,
    setMgrSiteQuery: assignments.setMgrSiteQuery,
    mgrDelta: assignments.mgrDelta,
    refreshManagerAssignments: assignments.refreshManagerAssignments,
    applyManagerAssignments: assignments.applyManagerAssignments,
  } as const;
}
