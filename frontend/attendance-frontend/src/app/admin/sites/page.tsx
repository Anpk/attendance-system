'use client';

import AppHeader from '@/app/_components/AppHeader';
import SitesTab from './_components/SitesTab';
import EmployeesTab from './_components/EmployeesTab';
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
      setIsAssignmentsOpen(false);
      setMgrSelectedSiteIds([]);
    }
  }

  function cancelEditEmployee() {
    setEditingUserId(null);
    setEditEmpUsername('');
    // assignments UI 상태도 함께 초기화(ADMIN만 의미 있음)
    setMgrAssignedSiteIds([]);
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
          <SitesTab
            userRole={user?.role}
            loading={loading}
            sites={sites}
            createName={createName}
            setCreateName={setCreateName}
            submitCreateSite={submitCreateSite}
            refreshSites={refreshSites}
            editingSiteId={editingSiteId}
            startEditSite={startEditSite}
            cancelEditSite={cancelEditSite}
            editSiteName={editSiteName}
            setEditSiteName={setEditSiteName}
            editSiteActive={editSiteActive}
            setEditSiteActive={setEditSiteActive}
            submitUpdateSite={submitUpdateSite}
          />
        )}

        {/* -----------------------
            TAB: EMPLOYEES
        ------------------------ */}
        {tab === 'employees' && (
          <EmployeesTab
            user={user ? { userId: user.userId, role: user.role } : null}
            loading={loading}
            sites={sites}
            filteredEmployees={filteredEmployees}
            canCreateEmployee={canCreateEmployee}
            isCreateEmployeeOpen={isCreateEmployeeOpen}
            setIsCreateEmployeeOpen={setIsCreateEmployeeOpen}
            createEmpUserId={createEmpUserId}
            setCreateEmpUserId={setCreateEmpUserId}
            createEmpUsername={createEmpUsername}
            setCreateEmpUsername={setCreateEmpUsername}
            createEmpPassword={createEmpPassword}
            setCreateEmpPassword={setCreateEmpPassword}
            createEmpSiteId={createEmpSiteId}
            setCreateEmpSiteId={setCreateEmpSiteId}
            createEmpRole={createEmpRole}
            setCreateEmpRole={setCreateEmpRole}
            createEmpUserIdRef={createEmpUserIdRef}
            submitCreateEmployee={submitCreateEmployee}
            empFilterSiteId={empFilterSiteId}
            setEmpFilterSiteId={setEmpFilterSiteId}
            refreshEmployees={refreshEmployees}
            bulkTargetSiteId={bulkTargetSiteId}
            setBulkTargetSiteId={setBulkTargetSiteId}
            bulkSelectedUserIds={bulkSelectedUserIds}
            setBulkSelectedUserIds={setBulkSelectedUserIds}
            bulkSelectableInView={bulkSelectableInView}
            bulkSelectedEmployees={bulkSelectedEmployees}
            bulkMoving={bulkMoving}
            submitBulkMoveEmployees={submitBulkMoveEmployees}
            editingUserId={editingUserId}
            startEditEmployee={startEditEmployee}
            cancelEditEmployee={cancelEditEmployee}
            submitUpdateEmployee={submitUpdateEmployee}
            editEmpActive={editEmpActive}
            setEditEmpActive={setEditEmpActive}
            editingEmpRole={editingEmpRole}
            editEmpUsername={editEmpUsername}
            setEditEmpUsername={setEditEmpUsername}
            editEmpSiteId={editEmpSiteId}
            setEditEmpSiteId={setEditEmpSiteId}
            canEditEmployeeSiteId={canEditEmployeeSiteId}
            pendingActiveUserId={pendingActiveUserId}
            submitToggleActiveQuick={submitToggleActiveQuick}
            showAssignmentsUi={showAssignmentsUi}
            isAssignmentsOpen={isAssignmentsOpen}
            setIsAssignmentsOpen={setIsAssignmentsOpen}
            mgrAssignedSiteIds={mgrAssignedSiteIds}
            mgrSelectedSiteIds={mgrSelectedSiteIds}
            setMgrSelectedSiteIds={setMgrSelectedSiteIds}
            mgrSiteQuery={mgrSiteQuery}
            setMgrSiteQuery={setMgrSiteQuery}
            mgrDelta={mgrDelta}
            refreshManagerAssignments={refreshManagerAssignments}
            applyManagerAssignments={applyManagerAssignments}
          />
        )}
      </main>
    </div>
  );
}
