'use client';

import AppHeader from '@/app/_components/AppHeader';
import { useFlashMessage, useRequireAuth } from '@/app/context/AuthContext';
import { toUserMessage } from '@/lib/api/error-messages';
import type {
  AdminEmployeeResponse,
  AdminEmployeeCreateRequest,
  AdminSiteResponse,
  EmployeeRole,
} from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import {
  adminAssignManagerSite,
  adminCreateEmployee,
  adminCreateSite,
  adminListEmployees,
  adminListManagerSites,
  adminListSites,
  adminRemoveManagerSite,
  adminUpdateEmployee,
  adminUpdateSite,
} from '@/lib/api/admin';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type TabKey = 'sites' | 'employees';

function tabLabel(tab: TabKey): string {
  return tab === 'sites' ? 'Sites' : 'Employees';
}

export default function AdminSitesPage() {
  const { user, ready, forbidden } = useRequireAuth({
    roles: ['ADMIN', 'MANAGER'],
  });

  const router = useRouter();
  const sp = useSearchParams();
  const initialTab = (sp.get('tab') as TabKey | null) ?? 'sites';
  const [tab, setTab] = useState<TabKey>(initialTab);

  const { message, setFlashMessage } = useFlashMessage({ ttlMs: 4000 });
  const [loading, setLoading] = useState(false);

  // ---------- Sites state ----------
  const [sites, setSites] = useState<AdminSiteResponse[]>([]);
  const [createName, setCreateName] = useState('');
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteActive, setEditSiteActive] = useState<boolean>(true);

  // ---------- Employees state ----------
  const [employees, setEmployees] = useState<AdminEmployeeResponse[]>([]);
  const [empFilterSiteId, setEmpFilterSiteId] = useState<string>(''); // '' = 전체
  const [pendingActiveUserId, setPendingActiveUserId] = useState<number | null>(
    null
  );

  // bulk site move (MANAGER/ADMIN)
  const [bulkSelectedUserIds, setBulkSelectedUserIds] = useState<number[]>([]);
  const [bulkTargetSiteId, setBulkTargetSiteId] = useState<string>('');
  const [bulkMoving, setBulkMoving] = useState<boolean>(false);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editEmpActive, setEditEmpActive] = useState<boolean>(true);
  const [editEmpSiteId, setEditEmpSiteId] = useState<string>('1');
  const [editingEmpRole, setEditingEmpRole] =
    useState<EmployeeRole>('EMPLOYEE');
  const [editEmpUsername, setEditEmpUsername] = useState<string>('');

  // create (ADMIN only)
  const [createEmpUserId, setCreateEmpUserId] = useState<string>('');
  const [createEmpUsername, setCreateEmpUsername] = useState<string>('');
  const [createEmpPassword, setCreateEmpPassword] = useState<string>('');
  const [createEmpSiteId, setCreateEmpSiteId] = useState<string>('1');
  const [createEmpRole, setCreateEmpRole] = useState<EmployeeRole>('EMPLOYEE');
  const createEmpUserIdRef = useRef<HTMLInputElement | null>(null);

  const canCreateEmployee = user?.role === 'ADMIN';
  // 직원 생성 섹션: 접기/펼치기 (기본: 접힘)
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] =
    useState<boolean>(false);

  // siteId 변경(할당) 권한
  // - ADMIN: 항상 가능
  // - MANAGER: EMPLOYEE에 대해서만 가능(서버에서도 최종 검증)
  const canEditEmployeeSiteId =
    user?.role === 'ADMIN' ||
    (user?.role === 'MANAGER' && editingEmpRole === 'EMPLOYEE');
  const showAssignmentsUi =
    user?.role === 'ADMIN' &&
    editingUserId != null &&
    editingEmpRole === 'MANAGER';

  // employees 목록 필터(프론트): siteId 기준
  const filteredEmployees = useMemo(() => {
    if (!empFilterSiteId) return employees;
    const sid = Number(empFilterSiteId);
    if (!Number.isFinite(sid)) return employees;
    return employees.filter((e) => e.siteId === sid);
  }, [employees, empFilterSiteId]);

  // --- Bulk selection memos
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

  // ---------- Assignments (ADMIN 전용 / target=MANAGER일 때만) ----------
  const [mgrAssignedSiteIds, setMgrAssignedSiteIds] = useState<number[]>([]);

  // Assignments UI: 접기/펼치기 (기본: 접힘)
  const [isAssignmentsOpen, setIsAssignmentsOpen] = useState<boolean>(false);

  // 체크박스 선택(복수): 할당/해제 대상 siteId들
  const [mgrSelectedSiteIds, setMgrSelectedSiteIds] = useState<number[]>([]);
  const [mgrSiteQuery, setMgrSiteQuery] = useState<string>('');

  // Assignments delta memo
  const mgrDelta = useMemo(() => {
    const current = new Set(mgrAssignedSiteIds);
    const desired = new Set(mgrSelectedSiteIds);
    const toAdd = Array.from(desired).filter((id) => !current.has(id));
    const toRemove = Array.from(current).filter((id) => !desired.has(id));
    return { toAdd, toRemove };
  }, [mgrAssignedSiteIds, mgrSelectedSiteIds]);

  // (legacy) 기존 단일 입력 변수는 남겨두되 UI에서는 사용하지 않음
  const [mgrSiteIdInput, setMgrSiteIdInput] = useState<string>('1');

  function setTabAndSync(next: TabKey) {
    setTab(next);
    const url = `/admin/sites?tab=${next}`;
    router.replace(url);
  }

  useEffect(() => {
    // URL 변경(뒤로가기 등)에 tab 동기화
    const q = (sp.get('tab') as TabKey | null) ?? 'sites';
    if (q !== tab) setTab(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  // ---------- Sites data ----------
  async function refreshSites() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await adminListSites();
      setSites(data);
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitCreateSite() {
    if (!user) return;
    if (user.role !== 'ADMIN') {
      setFlashMessage('권한이 없습니다.');
      return;
    }
    const name = createName.trim();
    if (!name) {
      setFlashMessage('site name은 필수입니다.');
      return;
    }
    setLoading(true);
    try {
      await adminCreateSite({ name });
      setCreateName('');
      await refreshSites();
      setFlashMessage('Site가 생성되었습니다.');
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function startEditSite(s: AdminSiteResponse) {
    setEditingSiteId(s.siteId);
    setEditSiteName(s.name);
    setEditSiteActive(s.active);
  }

  function cancelEditSite() {
    setEditingSiteId(null);
    setEditSiteName('');
    setEditSiteActive(true);
  }

  async function submitUpdateSite(siteId: number) {
    if (!user) return;
    setLoading(true);
    try {
      const body = {
        name: editSiteName.trim(),
        active: editSiteActive,
      };
      const updated = await adminUpdateSite(siteId, body);
      setSites((prev) => prev.map((x) => (x.siteId === siteId ? updated : x)));
      setFlashMessage('Site가 수정되었습니다.');
      cancelEditSite();
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // ---------- Employees data ----------
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

    // username(응답에 포함되어 있을 수 있음: 구버전 호환)
    setEditEmpUsername((x as unknown as { username?: string }).username ?? '');

    // assignments는 ADMIN에서만 편집(UI 노출)하므로 초기화도 ADMIN에서만
    if (user?.role === 'ADMIN') {
      setMgrAssignedSiteIds([]);
      setMgrSiteIdInput(String(x.siteId));
      setIsAssignmentsOpen(false);
      setMgrSelectedSiteIds([]);
    }
  }

  function cancelEditEmployee() {
    setEditingUserId(null);
    setEditEmpUsername('');
    // assignments UI 상태도 함께 초기화(ADMIN만 의미 있음)
    setMgrAssignedSiteIds([]);
    setMgrSiteIdInput('1');
    setIsAssignmentsOpen(false);
    setMgrSelectedSiteIds([]);
  }

  // ---------- Quick active toggle helper ----------
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

      // 편집 중인 대상이면 폼 상태도 동기화
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

  // ---------- Bulk site move helper (Option B) ----------
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

    // 옵션 A 정합(서버가 최종 검증): MANAGER는 현재 site도 manageable 범위 내여야 함
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

    // ✅ 옵션 B: siteId는 선택지(sites) 내에서만 변경 가능
    // (ADMIN은 전체 site, MANAGER는 assignments scope로 필터된 site만 내려오므로 그대로 사용)
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
        // role은 수정 금지: 보내지 않음
      };
      const updated = await adminUpdateEmployee(targetUserId, body);
      setEmployees((prev) =>
        prev.map((it) => (it.userId === targetUserId ? updated : it))
      );
      setFlashMessage('직원 정보가 수정되었습니다.');
      cancelEditEmployee();
    } catch (e) {
      // ✅ Admin Ops UX: 요청값 문제는 서버 메시지를 그대로 노출(중복/검증 사유 확인 목적)
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

  // ---------- Employee create helper ----------
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

    // ✅ 옵션 B: siteId는 선택지(sites) 내에서만 생성 가능
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
      // siteId는 유지(연속 생성 UX)
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

  // ---------- Assignments helpers ----------
  async function refreshManagerAssignments(managerUserId: number) {
    if (user?.role !== 'ADMIN') {
      setFlashMessage('권한이 없습니다.');
      return;
    }
    setLoading(true);
    try {
      const ids = await adminListManagerSites(managerUserId);
      setMgrAssignedSiteIds(ids);
      setMgrSelectedSiteIds(ids);
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function assignManagerSite(managerUserId: number) {
    if (user?.role !== 'ADMIN') {
      setFlashMessage('권한이 없습니다.');
      return;
    }
    if (mgrSelectedSiteIds.length === 0) {
      setFlashMessage('할당할 site를 선택해 주세요.');
      return;
    }

    // 비활성 site는 선택 단계에서 disabled 처리되지만, 방어적으로 한번 더 체크
    const inactive = mgrSelectedSiteIds.find((id) => {
      const s = sites.find((x) => x.siteId === id);
      return s ? !s.active : false;
    });
    if (inactive != null) {
      setFlashMessage('비활성 site는 할당할 수 없습니다.');
      return;
    }

    setLoading(true);
    try {
      for (const siteId of mgrSelectedSiteIds) {
        await adminAssignManagerSite({ managerUserId, siteId });
      }
      setFlashMessage('할당 완료');
      await refreshManagerAssignments(managerUserId);
      setMgrSelectedSiteIds([]);
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function removeManagerSite(managerUserId: number) {
    if (user?.role !== 'ADMIN') {
      setFlashMessage('권한이 없습니다.');
      return;
    }
    if (mgrSelectedSiteIds.length === 0) {
      setFlashMessage('해제할 site를 선택해 주세요.');
      return;
    }

    setLoading(true);
    try {
      for (const siteId of mgrSelectedSiteIds) {
        await adminRemoveManagerSite(managerUserId, siteId);
      }
      setFlashMessage('해제 완료');
      await refreshManagerAssignments(managerUserId);
      setMgrSelectedSiteIds([]);
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function applyManagerAssignments(managerUserId: number) {
    if (user?.role !== 'ADMIN') {
      setFlashMessage('권한이 없습니다.');
      return;
    }

    const current = new Set(mgrAssignedSiteIds);
    const desired = new Set(mgrSelectedSiteIds);

    const toAdd = Array.from(desired).filter((id) => !current.has(id));
    const toRemove = Array.from(current).filter((id) => !desired.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      setFlashMessage('변경 사항이 없습니다.');
      return;
    }

    // 비활성 site는 신규 할당 금지
    const inactiveAdd = toAdd.find((id) => {
      const s = sites.find((x) => x.siteId === id);
      return s ? !s.active : false;
    });
    if (inactiveAdd != null) {
      setFlashMessage('비활성 site는 할당할 수 없습니다.');
      return;
    }

    setLoading(true);
    try {
      for (const siteId of toAdd) {
        await adminAssignManagerSite({ managerUserId, siteId });
      }
      for (const siteId of toRemove) {
        await adminRemoveManagerSite(managerUserId, siteId);
      }

      setFlashMessage('담당 site가 업데이트되었습니다.');
      await refreshManagerAssignments(managerUserId);
    } catch (e) {
      setFlashMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  // ---------- initial load ----------
  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (forbidden) return;
    // 기본은 sites 탭 먼저 로드
    refreshSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, forbidden]);

  // employees 탭 진입 시 로드(최소 호출)
  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (forbidden) return;
    if (tab !== 'employees') return;
    // 직원 생성 섹션은 탭 진입 시 기본 접힘(원하면 수동으로 펼침)
    setIsCreateEmployeeOpen(false);
    // employees 탭에서는 siteId select를 위해 sites도 필요
    if (sites.length === 0) {
      refreshSites();
    }
    refreshEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ready, user, forbidden]);

  // target=MANAGER 편집 진입 시 할당 목록 로드(ADMIN 전용 UI일 때만)
  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (forbidden) return;
    if (!showAssignmentsUi) return;
    if (editingUserId == null) return;
    refreshManagerAssignments(editingUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAssignmentsUi, editingUserId, ready, user, forbidden]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">관리자</h1>
          <div className="mt-2 flex gap-2">
            {(['sites', 'employees'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTabAndSync(k)}
                className={`rounded border px-3 py-1 text-xs hover:bg-gray-50 ${
                  tab === k ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                {tabLabel(k)}
              </button>
            ))}
          </div>
        </div>

        {ready && forbidden && (
          <div className="mb-4 rounded border bg-white p-4 text-sm">
            권한이 없습니다. (ADMIN/MANAGER 전용)
          </div>
        )}

        {message && (
          <div className="mb-4 rounded border bg-white px-3 py-2 text-sm">
            {message}
          </div>
        )}

        {/* -----------------------
            TAB: SITES
        ------------------------ */}
        {tab === 'sites' && (
          <>
            {/* Create (ADMIN only) */}
            {user?.role === 'ADMIN' && (
              <section className="mb-6 rounded border bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold">Site 생성</h2>
                <div className="flex gap-2">
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Site name"
                    className="flex-1 rounded border px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={submitCreateSite}
                    disabled={loading}
                    className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    생성
                  </button>
                </div>
              </section>
            )}

            <section className="rounded border bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Site 목록</h2>
                <button
                  type="button"
                  onClick={refreshSites}
                  disabled={loading}
                  className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  새로고침
                </button>
              </div>

              {sites.length === 0 ? (
                <div className="text-sm text-gray-600">
                  표시할 site가 없습니다.
                </div>
              ) : (
                <ul className="space-y-2">
                  {sites.map((s) => {
                    const isEditing = editingSiteId === s.siteId;
                    return (
                      <li key={s.siteId} className="rounded border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm">
                            <div className="font-medium">
                              #{s.siteId} · {s.name}
                            </div>
                            <div className="text-xs text-gray-600">
                              active: {String(s.active)}
                            </div>
                          </div>

                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => startEditSite(s)}
                              className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                            >
                              수정
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => submitUpdateSite(s.siteId)}
                                disabled={loading}
                                className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditSite}
                                disabled={loading}
                                className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                              >
                                취소
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditing && (
                          <div className="mt-3 grid gap-2">
                            <label className="text-xs text-gray-700">
                              name
                              <input
                                value={editSiteName}
                                onChange={(e) =>
                                  setEditSiteName(e.target.value)
                                }
                                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={editSiteActive}
                                onChange={(e) =>
                                  setEditSiteActive(e.target.checked)
                                }
                              />
                              active
                            </label>
                            <div className="text-xs text-gray-500">
                              * MANAGER는 담당 site만 수정 가능(권한은 서버에서
                              검증)
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {/* -----------------------
            TAB: EMPLOYEES
        ------------------------ */}
        {tab === 'employees' && (
          <section className="rounded border bg-white p-4">
            {canCreateEmployee && (
              <div className="mb-6 rounded border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">직원 생성</div>
                  <button
                    type="button"
                    onClick={() => setIsCreateEmployeeOpen((v) => !v)}
                    className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                  >
                    {isCreateEmployeeOpen ? '접기' : '펼치기'}
                  </button>
                </div>

                {!isCreateEmployeeOpen ? (
                  <div className="text-xs text-gray-600">
                    * 필요 시 펼쳐서 신규 직원을 생성하세요. (ADMIN 전용)
                  </div>
                ) : (
                  <form
                    className="grid gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (loading) return;
                      void submitCreateEmployee();
                    }}
                  >
                    <label className="text-xs text-gray-700">
                      userId
                      <input
                        ref={createEmpUserIdRef}
                        value={createEmpUserId}
                        onChange={(e) => setCreateEmpUserId(e.target.value)}
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        inputMode="numeric"
                        placeholder="예: 200"
                        disabled={loading}
                      />
                    </label>

                    <label className="text-xs text-gray-700">
                      username
                      <input
                        value={createEmpUsername}
                        onChange={(e) => setCreateEmpUsername(e.target.value)}
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        placeholder="예: user-200"
                        disabled={loading}
                      />
                    </label>

                    <label className="text-xs text-gray-700">
                      password
                      <input
                        value={createEmpPassword}
                        onChange={(e) => setCreateEmpPassword(e.target.value)}
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        placeholder="예: pw200"
                        type="password"
                        disabled={loading}
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-gray-700">
                        siteId
                        <select
                          value={createEmpSiteId}
                          onChange={(e) => setCreateEmpSiteId(e.target.value)}
                          className="mt-1 w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
                          disabled={loading || sites.length === 0}
                        >
                          {sites.length === 0 ? (
                            <option value={createEmpSiteId}>
                              site 목록 로딩중...
                            </option>
                          ) : (
                            sites.map((s) => (
                              <option
                                key={s.siteId}
                                value={String(s.siteId)}
                                disabled={!s.active}
                              >
                                #{s.siteId} · {s.name}
                                {s.active ? '' : ' (inactive)'}
                              </option>
                            ))
                          )}
                        </select>
                        <div className="mt-1 text-[11px] text-gray-500">
                          * siteId는 선택 방식으로만 지정됩니다.
                        </div>
                        {(() => {
                          const sid = Number(createEmpSiteId);
                          const s = sites.find((x) => x.siteId === sid);
                          if (!s) return null;
                          if (s.active) return null;
                          return (
                            <div className="mt-1 text-[11px] text-red-600">
                              * 비활성 site는 선택할 수 없습니다.
                            </div>
                          );
                        })()}
                      </label>

                      <label className="text-xs text-gray-700">
                        role
                        <select
                          value={createEmpRole}
                          onChange={(e) =>
                            setCreateEmpRole(e.target.value as EmployeeRole)
                          }
                          className="mt-1 w-full rounded border px-3 py-2 text-sm"
                          disabled={loading}
                        >
                          <option value="EMPLOYEE">EMPLOYEE</option>
                          <option value="MANAGER">MANAGER</option>
                        </select>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      {loading ? '생성 중…' : '생성'}
                    </button>

                    <div className="text-[11px] text-gray-500">
                      * 직원 생성은 ADMIN 전용입니다.
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">직원 목록</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-700">
                  site 필터
                  <select
                    value={empFilterSiteId}
                    onChange={(e) => setEmpFilterSiteId(e.target.value)}
                    className="ml-2 rounded border px-2 py-1 text-xs"
                    disabled={sites.length === 0}
                  >
                    <option value="">전체</option>
                    {sites.map((s) => (
                      <option key={s.siteId} value={String(s.siteId)}>
                        #{s.siteId} · {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={refreshEmployees}
                  disabled={loading}
                  className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  새로고침
                </button>
              </div>
            </div>

            {(user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
              <div className="mb-3 rounded border bg-white p-3">
                <div className="mb-2 text-sm font-semibold">
                  직원 일괄 site 이동
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-gray-700">
                    대상 site
                    <select
                      value={bulkTargetSiteId}
                      onChange={(e) => setBulkTargetSiteId(e.target.value)}
                      className="ml-2 rounded border px-2 py-1 text-xs disabled:opacity-50"
                      disabled={sites.length === 0 || bulkMoving}
                    >
                      <option value="">선택</option>
                      {sites.map((s) => (
                        <option
                          key={s.siteId}
                          value={String(s.siteId)}
                          disabled={!s.active}
                        >
                          #{s.siteId} · {s.name}
                          {s.active ? '' : ' (inactive)'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="text-[11px] text-gray-700">
                    선택: {bulkSelectedUserIds.length}명
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const ids = bulkSelectableInView.map((e) => e.userId);
                      setBulkSelectedUserIds(ids);
                    }}
                    disabled={bulkMoving || bulkSelectableInView.length === 0}
                    className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    전체 선택(현재 필터)
                  </button>

                  <button
                    type="button"
                    onClick={() => void submitBulkMoveEmployees()}
                    disabled={bulkMoving || bulkSelectedUserIds.length === 0}
                    className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    일괄 이동
                  </button>

                  <button
                    type="button"
                    onClick={() => setBulkSelectedUserIds([])}
                    disabled={bulkMoving || bulkSelectedUserIds.length === 0}
                    className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    선택 해제
                  </button>

                  <div className="text-[11px] text-gray-500">
                    * 목록에서 EMPLOYEE만 선택할 수 있습니다. (MANAGER는
                    서버에서 담당(assignments) 범위로 추가 검증)
                  </div>
                  {bulkSelectedEmployees.length > 0 ? (
                    <div className="mt-2 text-[11px] text-gray-600">
                      선택된 직원:{' '}
                      {bulkSelectedEmployees
                        .slice(0, 10)
                        .map((e) => `#${e.userId}`)
                        .join(', ')}
                      {bulkSelectedEmployees.length > 10
                        ? ` 외 ${bulkSelectedEmployees.length - 10}명`
                        : ''}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {filteredEmployees.length === 0 ? (
              <div className="text-sm text-gray-600">
                표시할 직원이 없습니다.
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredEmployees.map((x) => {
                  const isEditing = editingUserId === x.userId;

                  // ✅ Quick active toggle guard
                  const isSelf = user?.userId === x.userId;
                  const isEmployee = x.role === 'EMPLOYEE';
                  const canQuickToggle = !isSelf && isEmployee;

                  return (
                    <li
                      key={x.userId}
                      className={`rounded border p-3 ${x.active ? '' : 'bg-gray-100 border-gray-300'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1"
                            disabled={
                              x.role !== 'EMPLOYEE' ||
                              user?.userId === x.userId ||
                              bulkMoving
                            }
                            checked={bulkSelectedUserIds.includes(x.userId)}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setBulkSelectedUserIds((prev) => {
                                if (next) {
                                  return prev.includes(x.userId)
                                    ? prev
                                    : [...prev, x.userId];
                                }
                                return prev.filter((id) => id !== x.userId);
                              });
                            }}
                          />
                          <div className="text-sm">
                            <div className="font-medium">
                              #{x.userId} · {x.role}
                              {(x as unknown as { username?: string })
                                .username ? (
                                <span className="ml-2 text-xs text-gray-600">
                                  @
                                  {
                                    (x as unknown as { username?: string })
                                      .username
                                  }
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-gray-600">
                              active: {String(x.active)} · siteId: {x.siteId}
                              {!x.active ? (
                                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-[11px]">
                                  비활성
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {!isEditing ? (
                          <div className="flex gap-2">
                            {canQuickToggle ? (
                              <button
                                type="button"
                                onClick={() => {
                                  // 비활성화 시에만 확인(운영 사고 방지)
                                  if (x.active) {
                                    const ok = window.confirm(
                                      `직원(#${x.userId})을 비활성화할까요?`
                                    );
                                    if (!ok) return;
                                  }
                                  submitToggleActiveQuick(x.userId, !x.active);
                                }}
                                disabled={pendingActiveUserId === x.userId}
                                className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                              >
                                {x.active ? '비활성' : '활성'}
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => startEditEmployee(x)}
                              className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                            >
                              수정
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => submitUpdateEmployee(x.userId)}
                              disabled={loading}
                              className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditEmployee}
                              disabled={loading}
                              className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              취소
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing && (
                        <div className="mt-3 grid gap-3">
                          <label className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={editEmpActive}
                              onChange={(e) =>
                                setEditEmpActive(e.target.checked)
                              }
                            />
                            active
                          </label>

                          <div className="text-xs text-gray-700">
                            role
                            <div className="mt-1 rounded border bg-gray-50 px-3 py-2 text-sm">
                              {editingEmpRole}
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500">
                              * role은 이번 통합 UX에서 수정하지 않습니다.
                            </div>
                          </div>

                          <label className="text-xs text-gray-700">
                            username
                            <input
                              value={editEmpUsername}
                              onChange={(e) =>
                                setEditEmpUsername(e.target.value)
                              }
                              className="mt-1 w-full rounded border px-3 py-2 text-sm"
                              placeholder="username"
                            />
                          </label>

                          <div className="text-[11px] text-gray-500">
                            * username만 수정 가능합니다. (role은 수정하지 않음)
                          </div>

                          <label className="text-xs text-gray-700">
                            siteId
                            <select
                              value={editEmpSiteId}
                              onChange={(e) => setEditEmpSiteId(e.target.value)}
                              className="mt-1 w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
                              disabled={
                                !canEditEmployeeSiteId || sites.length === 0
                              }
                            >
                              {sites.length === 0 ? (
                                <option value={editEmpSiteId}>
                                  site 목록 로딩중...
                                </option>
                              ) : (
                                sites.map((s) => (
                                  <option
                                    key={s.siteId}
                                    value={String(s.siteId)}
                                    disabled={!s.active}
                                  >
                                    #{s.siteId} · {s.name}
                                    {s.active ? '' : ' (inactive)'}
                                  </option>
                                ))
                              )}
                            </select>
                            <div className="mt-1 text-[11px] text-gray-500">
                              * siteId는 선택 방식으로만 변경됩니다.
                              {user?.role === 'MANAGER'
                                ? ' (MANAGER는 담당(assignments) site 범위 내에서만 선택 가능)'
                                : ''}
                            </div>
                            {(() => {
                              const sid = Number(editEmpSiteId);
                              const s = sites.find((x) => x.siteId === sid);
                              if (!s) return null;
                              if (s.active) return null;
                              return (
                                <div className="mt-1 text-[11px] text-red-600">
                                  * 비활성 site로는 변경할 수 없습니다.
                                </div>
                              );
                            })()}
                          </label>

                          {/* Assignments: target이 MANAGER일 때만(ADMIN 전용 UI) */}
                          {showAssignmentsUi && (
                            <div className="rounded border bg-white p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <div className="text-sm font-semibold">
                                  담당 Site(Assignments)
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setIsAssignmentsOpen((v) => !v)
                                  }
                                  className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                                >
                                  {isAssignmentsOpen ? '접기' : '펼치기'}
                                </button>
                              </div>

                              {/* 1) 현재 담당 siteId를 상단에 */}
                              <div className="mb-3">
                                <div className="mb-1 text-xs font-semibold">
                                  현재 담당 siteId
                                </div>
                                {mgrAssignedSiteIds.length === 0 ? (
                                  <div className="text-sm text-gray-600">
                                    없음
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {mgrAssignedSiteIds.map((id) => (
                                      <span
                                        key={id}
                                        className="rounded bg-gray-100 px-2 py-1 text-xs"
                                      >
                                        {id}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {!isAssignmentsOpen ? null : (
                                <>
                                  <div className="mb-2 flex items-center justify-between">
                                    <div className="text-xs text-gray-700">
                                      변경할 site 선택(복수)
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        value={mgrSiteQuery}
                                        onChange={(e) =>
                                          setMgrSiteQuery(e.target.value)
                                        }
                                        placeholder="site 검색(ID/이름)"
                                        className="rounded border px-2 py-1 text-xs"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          refreshManagerAssignments(
                                            editingUserId!
                                          )
                                        }
                                        disabled={loading}
                                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                                      >
                                        새로고침
                                      </button>
                                    </div>
                                  </div>

                                  {/* 2) select 대신 체크박스로 복수 선택 */}
                                  {sites.length === 0 ? (
                                    <div className="text-sm text-gray-600">
                                      site 목록 로딩중...
                                    </div>
                                  ) : (
                                    <div className="max-h-40 overflow-auto rounded border p-2">
                                      <div className="grid gap-2">
                                        {(() => {
                                          const q = mgrSiteQuery
                                            .trim()
                                            .toLowerCase();
                                          const list =
                                            q.length === 0
                                              ? sites
                                              : sites.filter((s) => {
                                                  const name =
                                                    s.name.toLowerCase();
                                                  return (
                                                    String(s.siteId).includes(
                                                      q
                                                    ) || name.includes(q)
                                                  );
                                                });

                                          return list.map((s) => {
                                            const checked =
                                              mgrSelectedSiteIds.includes(
                                                s.siteId
                                              );
                                            // inactive라도 이미 선택된 것은 해제 가능
                                            const disabled =
                                              !s.active && !checked;

                                            return (
                                              <label
                                                key={s.siteId}
                                                className={`flex items-center gap-2 text-xs ${
                                                  disabled
                                                    ? 'text-gray-400'
                                                    : 'text-gray-700'
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  disabled={disabled}
                                                  checked={checked}
                                                  onChange={(e) => {
                                                    const next =
                                                      e.target.checked;
                                                    setMgrSelectedSiteIds(
                                                      (prev) => {
                                                        if (next) {
                                                          return prev.includes(
                                                            s.siteId
                                                          )
                                                            ? prev
                                                            : [
                                                                ...prev,
                                                                s.siteId,
                                                              ];
                                                        }
                                                        return prev.filter(
                                                          (x) => x !== s.siteId
                                                        );
                                                      }
                                                    );
                                                  }}
                                                />
                                                <span>
                                                  #{s.siteId} · {s.name}
                                                  {s.active
                                                    ? ''
                                                    : ' (inactive)'}
                                                </span>
                                              </label>
                                            );
                                          });
                                        })()}
                                      </div>
                                    </div>
                                  )}

                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        applyManagerAssignments(editingUserId!)
                                      }
                                      disabled={loading}
                                      className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      적용
                                      {mgrDelta.toAdd.length +
                                        mgrDelta.toRemove.length >
                                      0
                                        ? ` (+${mgrDelta.toAdd.length}/-${mgrDelta.toRemove.length})`
                                        : ''}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMgrSelectedSiteIds(
                                          mgrAssignedSiteIds
                                        )
                                      }
                                      disabled={loading}
                                      className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      되돌리기
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setMgrSelectedSiteIds([])}
                                      disabled={
                                        loading ||
                                        mgrSelectedSiteIds.length === 0
                                      }
                                      className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      전체 해제
                                    </button>
                                  </div>

                                  {mgrDelta.toAdd.length +
                                    mgrDelta.toRemove.length >
                                  0 ? (
                                    <div className="mt-2 text-[11px] text-gray-600">
                                      변경 예정: 추가 {mgrDelta.toAdd.length}개
                                      / 해제 {mgrDelta.toRemove.length}개
                                      {mgrDelta.toAdd.length > 0 ? (
                                        <span>
                                          {' '}
                                          · 추가:{' '}
                                          {mgrDelta.toAdd
                                            .slice(0, 8)
                                            .join(', ')}
                                          {mgrDelta.toAdd.length > 8
                                            ? ` 외 ${mgrDelta.toAdd.length - 8}개`
                                            : ''}
                                        </span>
                                      ) : null}
                                      {mgrDelta.toRemove.length > 0 ? (
                                        <span>
                                          {' '}
                                          · 해제:{' '}
                                          {mgrDelta.toRemove
                                            .slice(0, 8)
                                            .join(', ')}
                                          {mgrDelta.toRemove.length > 8
                                            ? ` 외 ${mgrDelta.toRemove.length - 8}개`
                                            : ''}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className="mt-2 text-[11px] text-gray-500">
                                    * 비활성 site는 선택할 수 없습니다.
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          <div className="text-xs text-gray-500">
                            * siteId는 존재하는 siteId여야 합니다. (서버 검증)
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
