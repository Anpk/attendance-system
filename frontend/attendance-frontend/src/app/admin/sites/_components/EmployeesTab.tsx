'use client';

import type {
  AdminEmployeeResponse,
  AdminSiteResponse,
  EmployeeRole,
} from '@/lib/api/types';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useState } from 'react';

export default function EmployeesTab(props: {
  user: { userId: number; role: EmployeeRole } | null;
  loading: boolean;

  sites: AdminSiteResponse[];
  filteredEmployees: AdminEmployeeResponse[];

  create: {
    canCreateEmployee: boolean;
    isCreateEmployeeOpen: boolean;
    setIsCreateEmployeeOpen: Dispatch<SetStateAction<boolean>>;
    createEmpUserId: string;
    setCreateEmpUserId: (v: string) => void;
    createEmpUsername: string;
    setCreateEmpUsername: (v: string) => void;
    createEmpPassword: string;
    setCreateEmpPassword: (v: string) => void;
    createEmpSiteId: string;
    setCreateEmpSiteId: (v: string) => void;
    createEmpRole: EmployeeRole;
    setCreateEmpRole: (v: EmployeeRole) => void;
    createEmpUserIdRef: MutableRefObject<HTMLInputElement | null>;
    submitCreateEmployee: () => Promise<void>;
  };

  list: {
    empFilterSiteId: string;
    setEmpFilterSiteId: (v: string) => void;
    refreshEmployees: () => Promise<void>;
  };

  bulkMove: {
    bulkTargetSiteId: string;
    setBulkTargetSiteId: (v: string) => void;
    bulkSelectedUserIds: number[];
    setBulkSelectedUserIds: Dispatch<SetStateAction<number[]>>;
    bulkSelectableInView: AdminEmployeeResponse[];
    bulkSelectedEmployees: AdminEmployeeResponse[];
    bulkMoving: boolean;
    submitBulkMoveEmployees: () => Promise<void>;
  };

  rowEdit: {
    editingUserId: number | null;
    startEditEmployee: (x: AdminEmployeeResponse) => void;
    cancelEditEmployee: () => void;
    submitUpdateEmployee: (targetUserId: number) => Promise<void>;

    editEmpActive: boolean;
    setEditEmpActive: (v: boolean) => void;
    editingEmpRole: EmployeeRole;

    editEmpUsername: string;
    setEditEmpUsername: (v: string) => void;

    editEmpSiteId: string;
    setEditEmpSiteId: (v: string) => void;
    canEditEmployeeSiteId: boolean;
  };

  quickToggle: {
    pendingActiveUserId: number | null;
    submitToggleActiveQuick: (
      targetUserId: number,
      nextActive: boolean
    ) => Promise<void>;
  };

  assignments: {
    showAssignmentsUi: boolean;
    isAssignmentsOpen: boolean;
    setIsAssignmentsOpen: Dispatch<SetStateAction<boolean>>;
    mgrAssignedSiteIds: number[];
    mgrSelectedSiteIds: number[];
    setMgrSelectedSiteIds: Dispatch<SetStateAction<number[]>>;
    mgrSiteQuery: string;
    setMgrSiteQuery: (v: string) => void;
    mgrDelta: { toAdd: number[]; toRemove: number[] };
    refreshManagerAssignments: (managerUserId: number) => Promise<void>;
    applyManagerAssignments: (managerUserId: number) => Promise<void>;
  };
}) {
  // ✅ 그대로 page.tsx에서 옮긴 렌더링(동작 변경 없음)
  const { user, loading, sites, filteredEmployees } = props;

  const {
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
  } = props.create;

  const { empFilterSiteId, setEmpFilterSiteId, refreshEmployees } = props.list;

  const {
    bulkTargetSiteId,
    setBulkTargetSiteId,
    bulkSelectedUserIds,
    setBulkSelectedUserIds,
    bulkSelectableInView,
    bulkSelectedEmployees,
    bulkMoving,
    submitBulkMoveEmployees,
  } = props.bulkMove;

  const {
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
  } = props.rowEdit;

  const { pendingActiveUserId, submitToggleActiveQuick } = props.quickToggle;

  const {
    showAssignmentsUi,
    isAssignmentsOpen,
    setIsAssignmentsOpen,
    mgrAssignedSiteIds,
    mgrSelectedSiteIds,
    setMgrSelectedSiteIds,
    mgrSiteQuery,
    setMgrSiteQuery,
    mgrDelta,
    refreshManagerAssignments,
    applyManagerAssignments,
  } = props.assignments;

  // For edit modal
  const [editModalOpenUserId, setEditModalOpenUserId] = useState<number | null>(
    null
  );

  const editingEmp =
    filteredEmployees.find((e) => e.userId === editModalOpenUserId) ?? null;

  return (
    <section className="rounded border border-gray-300 bg-white p-4 dark:border-gray-600 dark:bg-gray-900">
      {canCreateEmployee && (
        <div className="mb-6 rounded border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-900">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">직원 생성</div>
            <button
              type="button"
              onClick={() => setIsCreateEmployeeOpen((v) => !v)}
              className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {isCreateEmployeeOpen ? '접기' : '펼치기'}
            </button>
          </div>

          {!isCreateEmployeeOpen ? (
            <div className="text-xs text-gray-600 dark:text-gray-300">
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
              <label className="text-xs text-gray-700 dark:text-gray-200">
                <span className="block mb-1">사용자 ID</span>
                <input
                  ref={createEmpUserIdRef}
                  value={createEmpUserId}
                  onChange={(e) => setCreateEmpUserId(e.target.value)}
                  className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
                  inputMode="numeric"
                  placeholder="예: 200"
                  disabled={loading}
                />
              </label>

              <label className="text-xs text-gray-700 dark:text-gray-200">
                <span className="block mb-1">사용자명</span>
                <input
                  value={createEmpUsername}
                  onChange={(e) => setCreateEmpUsername(e.target.value)}
                  className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
                  placeholder="예: user-200"
                  disabled={loading}
                />
              </label>

              <label className="text-xs text-gray-700 dark:text-gray-200">
                <span className="block mb-1">비밀번호</span>
                <input
                  value={createEmpPassword}
                  onChange={(e) => setCreateEmpPassword(e.target.value)}
                  className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
                  placeholder="예: pw200"
                  type="password"
                  disabled={loading}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-700 dark:text-gray-200">
                  <span className="block mb-1">근무지</span>
                  <select
                    value={createEmpSiteId}
                    onChange={(e) => setCreateEmpSiteId(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm disabled:opacity-50 text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100"
                    disabled={loading || sites.length === 0}
                  >
                    {sites.length === 0 ? (
                      <option value={createEmpSiteId}>
                        근무지 목록 로딩중...
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
                  <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-300">
                    * 근무지는 선택 방식으로만 지정됩니다.
                  </div>
                  {(() => {
                    const sid = Number(createEmpSiteId);
                    const s = sites.find((x) => x.siteId === sid);
                    if (!s) return null;
                    if (s.active) return null;
                    return (
                      <div className="mt-1 text-[11px] text-red-600">
                        * 비활성 근무지는 선택할 수 없습니다.
                      </div>
                    );
                  })()}
                </label>

                <label className="text-xs text-gray-700 dark:text-gray-200">
                  <span className="block mb-1">권한</span>
                  <select
                    value={createEmpRole}
                    onChange={(e) =>
                      setCreateEmpRole(e.target.value as EmployeeRole)
                    }
                    className="mt-1 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100"
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
                className="rounded border border-gray-400 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                {loading ? '생성 중…' : '생성'}
              </button>

              <div className="text-[11px] text-gray-500 dark:text-gray-300">
                * 직원 생성은 ADMIN 전용입니다.
              </div>
            </form>
          )}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">직원 목록</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 dark:text-gray-200">
            근무지 필터
            <select
              value={empFilterSiteId}
              onChange={(e) => setEmpFilterSiteId(e.target.value)}
              className="ml-2 rounded border border-gray-400 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
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
            className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            새로고침
          </button>
        </div>
      </div>

      {(user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
        <div className="mb-3 rounded border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-900">
          <div className="mb-2 text-sm font-semibold">
            직원 일괄 근무지 이동
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-700 dark:text-gray-200">
              이동할 근무지
              <select
                value={bulkTargetSiteId}
                onChange={(e) => setBulkTargetSiteId(e.target.value)}
                className="ml-2 rounded border border-gray-400 px-2 py-1 text-xs disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
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
            <div className="text-[11px] text-gray-700 dark:text-gray-200">
              선택: {bulkSelectedUserIds.length}명
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const ids = bulkSelectableInView.map((e) => e.userId);
                setBulkSelectedUserIds(ids);
              }}
              disabled={bulkMoving || bulkSelectableInView.length === 0}
              className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              전체 선택(현재 필터)
            </button>
            <button
              type="button"
              onClick={() => setBulkSelectedUserIds([])}
              disabled={bulkMoving || bulkSelectedUserIds.length === 0}
              className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              선택 해제
            </button>
            <button
              type="button"
              onClick={() => void submitBulkMoveEmployees()}
              disabled={bulkMoving || bulkSelectedUserIds.length === 0}
              className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              일괄 이동
            </button>
            <div className="text-[11px] text-gray-500 dark:text-gray-300">
              * 목록에서 EMPLOYEE만 선택할 수 있습니다. (MANAGER는 서버에서
              담당(assignments) 범위로 추가 검증)
            </div>
          </div>
          {bulkSelectedEmployees.length > 0 ? (
            <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">
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
      )}

      {filteredEmployees.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
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
                className={`rounded border border-gray-300 p-3 dark:border-gray-600 ${x.active ? '' : 'bg-gray-100 dark:bg-gray-900/50'}`}
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
                        {(x as unknown as { username?: string }).username ? (
                          <span className="ml-2 text-xs text-gray-600 dark:text-gray-300">
                            @{(x as unknown as { username?: string }).username}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        활성: {x.active ? '활성' : '비활성'} · 근무지:{' '}
                        {x.siteId}
                        {!x.active ? (
                          <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-[11px] dark:bg-gray-800">
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
                            if (x.active) {
                              const ok = window.confirm(
                                `직원(#${x.userId})을 비활성화할까요?`
                              );
                              if (!ok) return;
                            }
                            void submitToggleActiveQuick(x.userId, !x.active);
                          }}
                          disabled={pendingActiveUserId === x.userId}
                          className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                        >
                          {x.active ? '비활성' : '활성'}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => {
                          startEditEmployee(x);
                          setEditModalOpenUserId(x.userId);
                        }}
                        className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                      >
                        수정
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {/* Edit modal */}
      {editModalOpenUserId !== null && editingEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !loading) {
              cancelEditEmployee();
              setEditModalOpenUserId(null);
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow dark:bg-gray-900 dark:text-gray-100 flex flex-col max-h-[85vh] overflow-auto">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold">
                직원 수정 (#{editModalOpenUserId})
              </div>
              <button
                type="button"
                onClick={() => {
                  cancelEditEmployee();
                  setEditModalOpenUserId(null);
                }}
                disabled={loading}
                className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                닫기
              </button>
            </div>
            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={editEmpActive}
                  onChange={(e) => setEditEmpActive(e.target.checked)}
                />
                활성
              </label>
              <label className="text-xs text-gray-700 dark:text-gray-200">
                <span className="block mb-1">권한</span>
                <div className="mt-0 w-full rounded border border-gray-400 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2">
                  {editingEmpRole}
                </div>
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-300">
                  * 권한은 이번 통합 UX에서 수정하지 않습니다.
                </div>
              </label>
              <label className="text-xs text-gray-700 dark:text-gray-200">
                <span className="block mb-1">사용자명</span>
                <input
                  value={editEmpUsername}
                  onChange={(e) => setEditEmpUsername(e.target.value)}
                  className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
                  placeholder="사용자명"
                />
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-300">
                  * 사용자명만 수정 가능합니다. (권한은 수정하지 않음)
                </div>
              </label>
              <label className="text-xs text-gray-700 dark:text-gray-200">
                <span className="block mb-1">근무지</span>
                <select
                  value={editEmpSiteId}
                  onChange={(e) => setEditEmpSiteId(e.target.value)}
                  className="mt-0 w-full rounded border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-50 dark:border-gray-500 dark:bg-gray-950 dark:text-gray-100 md:w-1/2"
                  disabled={!canEditEmployeeSiteId || sites.length === 0}
                >
                  {sites.length === 0 ? (
                    <option value={editEmpSiteId}>근무지 목록 로딩중...</option>
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
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-300">
                  * 근무지는 선택 방식으로만 변경됩니다.
                  {user?.role === 'MANAGER'
                    ? ' (MANAGER는 담당(assignments) 근무지 범위 내에서만 선택 가능)'
                    : ''}
                </div>
                {(() => {
                  const sid = Number(editEmpSiteId);
                  const s = sites.find((x) => x.siteId === sid);
                  if (!s) return null;
                  if (s.active) return null;
                  return (
                    <div className="mt-1 text-[11px] text-red-600">
                      * 비활성 근무지로는 변경할 수 없습니다.
                    </div>
                  );
                })()}
              </label>
              {showAssignmentsUi && (
                <div className="rounded border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-900">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      담당 근무지(Assignments)
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAssignmentsOpen((v) => !v)}
                      className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                    >
                      {isAssignmentsOpen ? '접기' : '펼치기'}
                    </button>
                  </div>

                  <div className="mb-3">
                    <div className="mb-1 text-xs font-semibold">
                      현재 담당 근무지ID
                    </div>
                    {mgrAssignedSiteIds.length === 0 ? (
                      <div className="text-sm text-gray-600">없음</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {mgrAssignedSiteIds.map((id) => (
                          <span
                            key={id}
                            className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
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
                          변경할 근무지 선택(복수)
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            value={mgrSiteQuery}
                            onChange={(e) => setMgrSiteQuery(e.target.value)}
                            placeholder="근무지 검색(ID/이름)"
                            className="rounded border border-gray-400 px-2 py-1 text-xs dark:border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              void refreshManagerAssignments(editingUserId!)
                            }
                            disabled={loading}
                            className="rounded border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                          >
                            새로고침
                          </button>
                        </div>
                      </div>

                      {sites.length === 0 ? (
                        <div className="text-sm text-gray-600">
                          근무지 목록 로딩중...
                        </div>
                      ) : (
                        <div className="max-h-40 overflow-auto rounded border border-gray-300 p-2 dark:border-gray-600">
                          <div className="grid gap-2">
                            {(() => {
                              const q = mgrSiteQuery.trim().toLowerCase();
                              const list =
                                q.length === 0
                                  ? sites
                                  : sites.filter((s) => {
                                      const name = s.name.toLowerCase();
                                      return (
                                        String(s.siteId).includes(q) ||
                                        name.includes(q)
                                      );
                                    });

                              return list.map((s) => {
                                const checked = mgrSelectedSiteIds.includes(
                                  s.siteId
                                );
                                const disabled = !s.active && !checked;

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
                                        const next = e.target.checked;
                                        setMgrSelectedSiteIds((prev) => {
                                          if (next) {
                                            return prev.includes(s.siteId)
                                              ? prev
                                              : [...prev, s.siteId];
                                          }
                                          return prev.filter(
                                            (x) => x !== s.siteId
                                          );
                                        });
                                      }}
                                    />
                                    <span>
                                      #{s.siteId} · {s.name}
                                      {s.active ? '' : ' (inactive)'}
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
                            void applyManagerAssignments(editingUserId!)
                          }
                          disabled={loading}
                          className="rounded border border-gray-400 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                        >
                          적용
                          {mgrDelta.toAdd.length + mgrDelta.toRemove.length > 0
                            ? ` (+${mgrDelta.toAdd.length}/-${mgrDelta.toRemove.length})`
                            : ''}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMgrSelectedSiteIds(mgrAssignedSiteIds)
                          }
                          disabled={loading}
                          className="rounded border border-gray-400 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                        >
                          되돌리기
                        </button>
                        <button
                          type="button"
                          onClick={() => setMgrSelectedSiteIds([])}
                          disabled={loading || mgrSelectedSiteIds.length === 0}
                          className="rounded border border-gray-400 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                        >
                          전체 해제
                        </button>
                      </div>

                      {mgrDelta.toAdd.length + mgrDelta.toRemove.length > 0 ? (
                        <div className="mt-2 text-[11px] text-gray-600">
                          변경 예정: 추가 {mgrDelta.toAdd.length}개 / 해제{' '}
                          {mgrDelta.toRemove.length}개
                          {mgrDelta.toAdd.length > 0 ? (
                            <span>
                              {' '}
                              · 추가: {mgrDelta.toAdd.slice(0, 8).join(', ')}
                              {mgrDelta.toAdd.length > 8
                                ? ` 외 ${mgrDelta.toAdd.length - 8}개`
                                : ''}
                            </span>
                          ) : null}
                          {mgrDelta.toRemove.length > 0 ? (
                            <span>
                              {' '}
                              · 해제: {mgrDelta.toRemove.slice(0, 8).join(', ')}
                              {mgrDelta.toRemove.length > 8
                                ? ` 외 ${mgrDelta.toRemove.length - 8}개`
                                : ''}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-2 text-[11px] text-gray-500">
                        * 비활성 근무지는 선택할 수 없습니다.
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500">
                * 근무지는 존재하는 근무지ID여야 합니다. (서버 검증)
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await submitUpdateEmployee(editModalOpenUserId);
                    setEditModalOpenUserId(null);
                  } catch {
                    // 실패 시 모달 유지 (에러 메시지는 상위 flash/toast 로직에서 처리)
                  }
                }}
                disabled={loading}
                className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelEditEmployee();
                  setEditModalOpenUserId(null);
                }}
                disabled={loading}
                className="rounded border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
