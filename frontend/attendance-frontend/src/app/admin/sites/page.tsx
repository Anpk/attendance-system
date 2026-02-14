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
import { useEffect, useMemo, useState } from 'react';
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

  const canCreateEmployee = user?.role === 'ADMIN';
  const canEditEmployeeSiteId = user?.role === 'ADMIN';
  const showAssignmentsUi =
    user?.role === 'ADMIN' &&
    editingUserId != null &&
    editingEmpRole === 'MANAGER';

  // ---------- Assignments (for MANAGER target only) ----------
  const isEditingManager = useMemo(() => {
    return editingUserId != null && editingEmpRole === 'MANAGER';
  }, [editingUserId, editingEmpRole]);

  const [mgrAssignedSiteIds, setMgrAssignedSiteIds] = useState<number[]>([]);
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
    }
  }

  function cancelEditEmployee() {
    setEditingUserId(null);
    setEditEmpUsername('');
  }

  async function submitUpdateEmployee(targetUserId: number) {
    if (!user) return;
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
    const sId = Number(mgrSiteIdInput);
    if (!Number.isFinite(sId)) {
      setFlashMessage('siteId를 확인해 주세요.');
      return;
    }
    setLoading(true);
    try {
      await adminAssignManagerSite({ managerUserId, siteId: sId });
      setFlashMessage('할당 완료');
      await refreshManagerAssignments(managerUserId);
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
    const sId = Number(mgrSiteIdInput);
    if (!Number.isFinite(sId)) {
      setFlashMessage('siteId를 확인해 주세요.');
      return;
    }
    setLoading(true);
    try {
      await adminRemoveManagerSite(managerUserId, sId);
      setFlashMessage('해제 완료');
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
    refreshEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ready, user, forbidden]);

  // manager 대상 편집 진입 시 할당 목록 로드
  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    if (forbidden) return;
    if (!isEditingManager) return;
    if (editingUserId == null) return;
    refreshManagerAssignments(editingUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingManager, editingUserId, ready, user, forbidden]);

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
                <div className="mb-2 text-sm font-semibold">직원 생성</div>

                <div className="grid gap-2">
                  <label className="text-xs text-gray-700">
                    userId
                    <input
                      value={createEmpUserId}
                      onChange={(e) => setCreateEmpUserId(e.target.value)}
                      className="mt-1 w-full rounded border px-3 py-2 text-sm"
                      inputMode="numeric"
                      placeholder="예: 200"
                    />
                  </label>

                  <label className="text-xs text-gray-700">
                    username
                    <input
                      value={createEmpUsername}
                      onChange={(e) => setCreateEmpUsername(e.target.value)}
                      className="mt-1 w-full rounded border px-3 py-2 text-sm"
                      placeholder="예: user-200"
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
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-gray-700">
                      siteId
                      <input
                        value={createEmpSiteId}
                        onChange={(e) => setCreateEmpSiteId(e.target.value)}
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        inputMode="numeric"
                      />
                    </label>

                    <label className="text-xs text-gray-700">
                      role
                      <select
                        value={createEmpRole}
                        onChange={(e) =>
                          setCreateEmpRole(e.target.value as EmployeeRole)
                        }
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                      >
                        <option value="EMPLOYEE">EMPLOYEE</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      const userIdNum = Number(createEmpUserId);
                      const siteIdNum = Number(createEmpSiteId);

                      if (!Number.isFinite(userIdNum)) {
                        setFlashMessage('userId를 확인해 주세요.');
                        return;
                      }
                      if (!createEmpUsername.trim()) {
                        setFlashMessage('username은 필수입니다.');
                        return;
                      }
                      if (!createEmpPassword.trim()) {
                        setFlashMessage('password는 필수입니다.');
                        return;
                      }
                      if (!Number.isFinite(siteIdNum)) {
                        setFlashMessage('siteId를 확인해 주세요.');
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
                        setCreateEmpSiteId('1');
                        setCreateEmpRole('EMPLOYEE');
                        await refreshEmployees();
                        setFlashMessage('직원이 생성되었습니다.');
                      } catch (e) {
                        setFlashMessage(toUserMessage(e));
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    생성
                  </button>

                  <div className="text-[11px] text-gray-500">
                    * 직원 생성은 ADMIN 전용입니다.
                  </div>
                </div>
              </div>
            )}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">직원 목록</h2>
              <button
                type="button"
                onClick={refreshEmployees}
                disabled={loading}
                className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                새로고침
              </button>
            </div>

            {employees.length === 0 ? (
              <div className="text-sm text-gray-600">
                표시할 직원이 없습니다.
              </div>
            ) : (
              <ul className="space-y-2">
                {employees.map((x) => {
                  const isEditing = editingUserId === x.userId;
                  return (
                    <li key={x.userId} className="rounded border p-3">
                      <div className="flex items-center justify-between gap-3">
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
                          </div>
                        </div>

                        {!isEditing ? (
                          <button
                            type="button"
                            onClick={() => startEditEmployee(x)}
                            className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                          >
                            수정
                          </button>
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
                            <input
                              value={editEmpSiteId}
                              onChange={(e) => setEditEmpSiteId(e.target.value)}
                              className="mt-1 w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
                              inputMode="numeric"
                              disabled={!canEditEmployeeSiteId}
                            />
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
                                    refreshManagerAssignments(editingUserId!)
                                  }
                                  disabled={loading}
                                  className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                                >
                                  새로고침
                                </button>
                              </div>

                              <label className="text-xs text-gray-700">
                                siteId
                                <input
                                  value={mgrSiteIdInput}
                                  onChange={(e) =>
                                    setMgrSiteIdInput(e.target.value)
                                  }
                                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                                  inputMode="numeric"
                                />
                              </label>

                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    assignManagerSite(editingUserId!)
                                  }
                                  disabled={loading}
                                  className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                                >
                                  할당
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeManagerSite(editingUserId!)
                                  }
                                  disabled={loading}
                                  className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                                >
                                  해제
                                </button>
                              </div>

                              <div className="mt-3">
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
