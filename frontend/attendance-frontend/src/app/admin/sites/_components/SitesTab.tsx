'use client';

import type { AdminSiteResponse, EmployeeRole } from '@/lib/api/types';

export default function SitesTab(props: {
  userRole: EmployeeRole | null | undefined;
  loading: boolean;
  sites: AdminSiteResponse[];

  create: {
    name: string;
    setName: (v: string) => void;
    submitCreateSite: () => void | Promise<void>;
  };

  edit: {
    editingSiteId: number | null;
    startEditSite: (s: AdminSiteResponse) => void;
    cancelEditSite: () => void;
    name: string;
    setName: (v: string) => void;
    active: boolean;
    setActive: (v: boolean) => void;
    submitUpdateSite: (siteId: number) => void | Promise<void>;
  };

  actions: {
    refreshSites: () => void | Promise<void>;
  };
}) {
  const { userRole, loading, sites } = props;

  const {
    name: createName,
    setName: setCreateName,
    submitCreateSite,
  } = props.create;

  const { refreshSites } = props.actions;

  const {
    editingSiteId,
    startEditSite,
    cancelEditSite,
    name: editSiteName,
    setName: setEditSiteName,
    active: editSiteActive,
    setActive: setEditSiteActive,
    submitUpdateSite,
  } = props.edit;

  return (
    <>
      {/* Create (ADMIN only) */}
      {userRole === 'ADMIN' && (
        <section className="mb-6 rounded border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-3 text-sm font-semibold">Site 생성</h2>
          <div className="flex gap-2">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Site name"
              className="flex-1 rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={submitCreateSite}
              disabled={loading}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              생성
            </button>
          </div>
        </section>
      )}

      <section className="rounded border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Site 목록</h2>
          <button
            type="button"
            onClick={refreshSites}
            disabled={loading}
            className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            새로고침
          </button>
        </div>

        {sites.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">표시할 site가 없습니다.</div>
        ) : (
          <ul className="space-y-2">
            {sites.map((s) => {
              const isEditing = editingSiteId === s.siteId;
              return (
                <li key={s.siteId} className="rounded border p-3 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-medium">
                        #{s.siteId} · {s.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        active: {String(s.active)}
                      </div>
                    </div>

                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => startEditSite(s)}
                        className="rounded border px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        수정
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => submitUpdateSite(s.siteId)}
                          disabled={loading}
                          className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditSite}
                          disabled={loading}
                          className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          취소
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <div className="mt-3 grid gap-2">
                      <label className="text-xs text-gray-700 dark:text-gray-200">
                        name
                        <input
                          value={editSiteName}
                          onChange={(e) => setEditSiteName(e.target.value)}
                          className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={editSiteActive}
                          onChange={(e) => setEditSiteActive(e.target.checked)}
                        />
                        active
                      </label>
                      <div className="text-xs text-gray-500 dark:text-gray-300">
                        * MANAGER는 담당 site만 수정 가능(권한은 서버에서 검증)
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
  );
}
